import express from 'express';

const app = express();
app.set('trust proxy', true);
app.use(express.raw({ type: '*/*', limit: '2mb' }));

const PORT = Number(process.env.PORT || 3000);
const allowedHosts = new Set(
  (process.env.ALLOWED_HOSTS || 'kvk.pub,rezka.fi')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
);

const sessions = new Map();
const SESSION_TTL = 12 * 60 * 60 * 1000;

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
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
  const ua = String(req.headers['user-agent'] || '');
  return `${ip}|${ua}`;
}

function getSession(req) {
  const key = sessionKey(req);
  const now = Date.now();
  let session = sessions.get(key);
  if (!session || now - session.updatedAt > SESSION_TTL) {
    session = { cookies: new Map(), updatedAt: now, warmedHosts: new Set() };
    sessions.set(key, session);
  }
  if (!session.warmedHosts) session.warmedHosts = new Set();
  session.updatedAt = now;
  return session;
}

function cookieHeader(session) {
  return [...session.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

function cookieNames(session) {
  return [...session.cookies.keys()].join(',') || '(none)';
}

function storeSetCookies(session, response) {
  let list = [];
  if (typeof response.headers.getSetCookie === 'function') {
    list = response.headers.getSetCookie();
  } else {
    const single = response.headers.get('set-cookie');
    if (single) list = [single];
  }

  for (const item of list) {
    const first = item.split(';', 1)[0];
    const eq = first.indexOf('=');
    if (eq <= 0) continue;
    const name = first.slice(0, eq).trim();
    const value = first.slice(eq + 1).trim();
    if (!name) continue;
    if (!value || /^(deleted|none)$/i.test(value)) session.cookies.delete(name);
    else session.cookies.set(name, value);
  }
}

function parseTarget(req) {
  let raw = typeof req.query?.url === 'string' ? req.query.url : '';
  if (!raw) raw = req.originalUrl.replace(/^\//, '').split('?')[0];
  try { raw = decodeURIComponent(raw); } catch {}

  if (/^https:\/[^/]/i.test(raw)) raw = raw.replace(/^https:\//i, 'https://');
  if (/^http:\/[^/]/i.test(raw)) raw = raw.replace(/^http:\//i, 'http://');

  if (!/^https?:\/\//i.test(raw)) return null;

  let url;
  try { url = new URL(raw); } catch { return null; }
  if (!allowedHosts.has(url.hostname.toLowerCase())) return null;
  return url;
}

function baseHeaders(target, req, session, ajax = true) {
  const headers = new Headers();
  headers.set('User-Agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
  headers.set('Accept', req.headers.accept || '*/*');
  headers.set('Accept-Language', req.headers['accept-language'] || 'ru,en;q=0.9');
  headers.set('Referer', `${target.protocol}//${target.host}/`);
  headers.set('Origin', `${target.protocol}//${target.host}`);
  if (ajax) headers.set('X-Requested-With', 'XMLHttpRequest');
  const cookies = cookieHeader(session);
  if (cookies) headers.set('Cookie', cookies);
  return headers;
}

async function warmSession(target, req, session) {
  const hostKey = `${target.protocol}//${target.host}`;
  if (session.warmedHosts.has(hostKey)) return;

  const home = new URL('/', hostKey);
  const headers = baseHeaders(home, req, session, false);
  headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');

  try {
    let r = await fetch(home, { method: 'GET', headers, redirect: 'manual' });
    storeSetCookies(session, r);

    if ([301, 302, 303, 307, 308].includes(r.status)) {
      const location = r.headers.get('location');
      if (location) {
        const next = new URL(location, home);
        if (allowedHosts.has(next.hostname.toLowerCase())) {
          const h2 = baseHeaders(next, req, session, false);
          const r2 = await fetch(next, { method: 'GET', headers: h2, redirect: 'manual' });
          storeSetCookies(session, r2);
        }
      }
    }

    session.warmedHosts.add(hostKey);
    console.log(`[warm] ${hostKey} cookies=${cookieNames(session)}`);
  } catch (e) {
    console.warn(`[warm] failed ${hostKey}: ${String(e?.message || e)}`);
  }
}

function responseContentType(upstream) {
  return upstream.headers.get('content-type') || 'text/plain; charset=utf-8';
}

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'lampa-rezka-proxy', sessions: sessions.size });
});

app.all('*', async (req, res) => {
  const target = parseTarget(req);
  if (!target) return res.status(400).json({ error: 'Invalid or disallowed target URL' });

  const session = getSession(req);
  const isLogin = req.method === 'POST' && target.pathname.replace(/\/+$/, '') === '/ajax/login';

  try {
    if (isLogin) await warmSession(target, req, session);

    const headers = baseHeaders(target, req, session, true);
    const contentType = req.headers['content-type'];
    if (contentType) headers.set('Content-Type', contentType);

    const init = {
      method: req.method,
      headers,
      redirect: 'manual'
    };

    if (!['GET', 'HEAD'].includes(req.method) && req.body && req.body.length) {
      init.body = req.body;
    }

    let upstream = await fetch(target, init);
    storeSetCookies(session, upstream);

    if ([301, 302, 303, 307, 308].includes(upstream.status)) {
      const location = upstream.headers.get('location');
      if (location) {
        const next = new URL(location, target);
        if (!allowedHosts.has(next.hostname.toLowerCase())) {
          return res.status(502).json({ error: 'Redirected to a disallowed host' });
        }
        const redirectedInit = { ...init, headers: baseHeaders(next, req, session, true) };
        if (contentType) redirectedInit.headers.set('Content-Type', contentType);
        if (upstream.status === 303) {
          redirectedInit.method = 'GET';
          delete redirectedInit.body;
        }
        upstream = await fetch(next, redirectedInit);
        storeSetCookies(session, upstream);
      }
    }

    const body = Buffer.from(await upstream.arrayBuffer());

    if (isLogin) {
      const preview = body.toString('utf8').slice(0, 300).replace(/\s+/g, ' ');
      console.log(`[login] host=${target.host} status=${upstream.status} cookies=${cookieNames(session)} body=${preview}`);
    }

    res.status(upstream.status);
    res.setHeader('Content-Type', responseContentType(upstream));
    res.setHeader('Cache-Control', 'no-store');
    res.send(body);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(502).json({ error: 'Upstream request failed', detail: String(error?.message || error) });
  }
});

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of sessions.entries()) {
    if (now - value.updatedAt > SESSION_TTL) sessions.delete(key);
  }
}, 30 * 60 * 1000).unref();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Lampa Rezka proxy listening on :${PORT}`);
  console.log(`Allowed hosts: ${[...allowedHosts].join(', ')}`);
});
