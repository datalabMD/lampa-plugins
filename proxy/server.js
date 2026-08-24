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
    session = { cookies: new Map(), updatedAt: now };
    sessions.set(key, session);
  }
  session.updatedAt = now;
  return session;
}

function cookieHeader(session) {
  return [...session.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
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
  // Primary format: /?url=https%3A%2F%2Fkvk.pub%2F...
  let raw = typeof req.query?.url === 'string' ? req.query.url : '';

  // Backward-compatible format used by the current Lampa plugin:
  // /https://kvk.pub/... . Some reverse proxies normalize the double slash
  // inside https:// and Node receives /https:/kvk.pub/..., so repair it.
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
  const headers = new Headers();
  headers.set('User-Agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
  headers.set('Accept', req.headers.accept || '*/*');
  headers.set('Accept-Language', req.headers['accept-language'] || 'ru,en;q=0.9');
  headers.set('Referer', `${target.protocol}//${target.host}/`);
  headers.set('X-Requested-With', 'XMLHttpRequest');

  const cookies = cookieHeader(session);
  if (cookies) headers.set('Cookie', cookies);

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

  try {
    let upstream = await fetch(target, init);

    if ([301, 302, 303, 307, 308].includes(upstream.status)) {
      const location = upstream.headers.get('location');
      if (location) {
        const next = new URL(location, target);
        if (!allowedHosts.has(next.hostname.toLowerCase())) {
          return res.status(502).json({ error: 'Redirected to a disallowed host' });
        }
        const redirectedInit = { ...init };
        if (upstream.status === 303) {
          redirectedInit.method = 'GET';
          delete redirectedInit.body;
        }
        upstream = await fetch(next, redirectedInit);
      }
    }

    storeSetCookies(session, upstream);

    const body = Buffer.from(await upstream.arrayBuffer());
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
