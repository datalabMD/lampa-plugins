import express from 'express';

const app = express();
app.set('trust proxy', true);
app.use(express.raw({ type: '*/*', limit: '2mb' }));

const PORT = Number(process.env.PORT || 3000);
const allowedHosts = new Set((process.env.ALLOWED_HOSTS || 'kvk.pub,rezka.fi').split(',').map(v => v.trim().toLowerCase()).filter(Boolean));
const DEFAULT_UPSTREAM = process.env.DEFAULT_UPSTREAM || 'https://kvk.pub';
const sessions = new Map();
const recent = [];
const SESSION_TTL = 12 * 60 * 60 * 1000;

function remember(entry) {
  recent.unshift({ time: new Date().toISOString(), ...entry });
  if (recent.length > 40) recent.length = 40;
}

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type,X-Requested-With,Referer');
  res.setHeader('Access-Control-Max-Age', '86400');
}

app.use((req, res, next) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function sessionKey(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || req.ip || req.socket.remoteAddress || 'unknown';
  return `${ip}|${String(req.headers['user-agent'] || '')}`;
}

function getSession(req) {
  const key = sessionKey(req), now = Date.now();
  let s = sessions.get(key);
  if (!s || now - s.updatedAt > SESSION_TTL) {
    s = { cookies: new Map(), updatedAt: now, warmedHosts: new Set() };
    sessions.set(key, s);
  }
  if (!s.warmedHosts) s.warmedHosts = new Set();
  s.updatedAt = now;
  return s;
}

function cookieHeader(s) { return [...s.cookies.entries()].map(([k,v]) => `${k}=${v}`).join('; '); }
function cookieNames(s) { return [...s.cookies.keys()].join(',') || '(none)'; }

function storeSetCookies(s, response) {
  let list = [];
  if (typeof response.headers.getSetCookie === 'function') list = response.headers.getSetCookie();
  else { const one = response.headers.get('set-cookie'); if (one) list = [one]; }
  for (const item of list) {
    const first = item.split(';',1)[0], eq = first.indexOf('=');
    if (eq <= 0) continue;
    const name = first.slice(0,eq).trim(), value = first.slice(eq+1).trim();
    if (!name) continue;
    if (!value || /^(deleted|none)$/i.test(value)) s.cookies.delete(name); else s.cookies.set(name,value);
  }
}

function parseTarget(req) {
  let raw = typeof req.query?.url === 'string' ? req.query.url : '';
  if (!raw) raw = req.originalUrl.replace(/^\/+/, '').split('?')[0];
  try { raw = decodeURIComponent(raw); } catch {}

  if (/^\/+https?:\/\//i.test(raw)) raw = raw.replace(/^\/+/, '');
  if (/^https:\/[^/]/i.test(raw)) raw = raw.replace(/^https:\//i,'https://');
  if (/^http:\/[^/]/i.test(raw)) raw = raw.replace(/^http:\//i,'http://');
  if (!/^https?:\/\//i.test(raw)) {
    raw = raw.replace(/^\/+/, '');
    try { raw = new URL('/' + raw, DEFAULT_UPSTREAM).toString(); } catch { return null; }
  }
  let url; try { url = new URL(raw); } catch { return null; }
  if (!allowedHosts.has(url.hostname.toLowerCase())) return null;
  return url;
}

function baseHeaders(target, req, s, ajax=true) {
  const h = new Headers();
  h.set('User-Agent','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36');
  h.set('Accept', req.headers.accept || '*/*');
  h.set('Accept-Language', req.headers['accept-language'] || 'ru,en;q=0.9');
  h.set('Referer', `${target.protocol}//${target.host}/`);
  h.set('Origin', `${target.protocol}//${target.host}`);
  if (ajax) h.set('X-Requested-With','XMLHttpRequest');
  const c = cookieHeader(s); if (c) h.set('Cookie',c);
  return h;
}

async function warmSession(target, req, s) {
  const hostKey = `${target.protocol}//${target.host}`;
  if (s.warmedHosts.has(hostKey)) return;
  const home = new URL('/', hostKey), h = baseHeaders(home, req, s, false);
  h.set('Accept','text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
  try {
    let r = await fetch(home,{method:'GET',headers:h,redirect:'manual'}); storeSetCookies(s,r);
    s.warmedHosts.add(hostKey);
    remember({ phase:'warm', method:'GET', target:home.toString(), status:r.status, cookies:cookieNames(s) });
  } catch(e) { remember({ phase:'warm', target:home.toString(), error:String(e?.message || e) }); }
}

app.get('/health',(req,res)=>res.json({ok:true,service:'lampa-rezka-proxy',sessions:sessions.size,defaultUpstream:DEFAULT_UPSTREAM}));
app.get('/debug/recent',(req,res)=>res.json({ok:true,recent}));
app.get('/favicon.ico',(req,res)=>res.sendStatus(204));

// Permanent short plugin URL for the TV. The server fetches the current
// implementation from GitHub and disables caching, so the Lampa URL never changes.
app.get('/plugin.js', async (req, res) => {
  try {
    const src = `https://raw.githubusercontent.com/datalabMD/lampa-plugins/main/rezka4.js?t=${Date.now()}`;
    const upstream = await fetch(src, { headers: { 'User-Agent': 'lampa-plugin-proxy' }, cache: 'no-store' });
    if (!upstream.ok) return res.status(502).type('text/plain').send(`plugin upstream HTTP ${upstream.status}`);
    const code = await upstream.text();
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(code);
  } catch (e) {
    res.status(502).type('text/plain').send(`plugin load failed: ${String(e?.message || e)}`);
  }
});

app.all('*', async (req,res) => {
  const target = parseTarget(req);
  if (!target) {
    remember({ phase:'reject', method:req.method, original:req.originalUrl });
    return res.status(400).json({error:'Invalid or disallowed target URL'});
  }
  const s = getSession(req);
  const isLogin = req.method === 'POST' && target.pathname.replace(/\/+$/,'') === '/ajax/login';
  try {
    if (isLogin) await warmSession(target,req,s);
    const h = baseHeaders(target,req,s,true), ct = req.headers['content-type'];
    if (ct) h.set('Content-Type',ct);
    const init = {method:req.method,headers:h,redirect:'manual'};
    if (!['GET','HEAD'].includes(req.method) && req.body && req.body.length) init.body=req.body;
    let up = await fetch(target,init); storeSetCookies(s,up);
    if ([301,302,303,307,308].includes(up.status)) {
      const loc=up.headers.get('location');
      if (loc) {
        const next=new URL(loc,target);
        if (!allowedHosts.has(next.hostname.toLowerCase())) return res.status(502).json({error:'Redirected to a disallowed host'});
        const init2={...init,headers:baseHeaders(next,req,s,true)}; if(ct)init2.headers.set('Content-Type',ct);
        if(up.status===303){init2.method='GET';delete init2.body;}
        up=await fetch(next,init2); storeSetCookies(s,up);
      }
    }
    const body=Buffer.from(await up.arrayBuffer());
    remember({ phase:isLogin?'login':'proxy', method:req.method, target:target.toString(), status:up.status, type:up.headers.get('content-type') || '', bytes:body.length, cookies:cookieNames(s) });
    res.status(up.status); res.setHeader('Content-Type',up.headers.get('content-type') || 'text/plain; charset=utf-8'); res.setHeader('Cache-Control','no-store'); res.send(body);
  } catch(e) {
    remember({ phase:'error', method:req.method, target:target.toString(), error:String(e?.message || e) });
    res.status(502).json({error:'Upstream request failed',detail:String(e?.message || e)});
  }
});

setInterval(()=>{const now=Date.now();for(const[k,v]of sessions.entries())if(now-v.updatedAt>SESSION_TTL)sessions.delete(k);},30*60*1000).unref();
app.listen(PORT,'0.0.0.0',()=>console.log(`Lampa Rezka proxy listening on :${PORT}`));
