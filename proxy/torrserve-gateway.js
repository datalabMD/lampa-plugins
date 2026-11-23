import http from 'node:http';
import https from 'node:https';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pipeline } from 'node:stream';

const PREFIX = '/torrserve';
const DEFAULT_TTL = 6 * 60 * 60;

function origin(value, protocols) {
  const url = new URL(value);
  if (!protocols.includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) throw new Error('Invalid gateway configuration');
  return url.origin;
}

function configFrom(env) {
  try {
    return {
      upstream: origin(env.TORRSERVE_UPSTREAM, ['http:', 'https:']),
      source: origin(env.TORRSERVE_SOURCE_ORIGIN, ['https:']),
      publicOrigin: origin(env.TORRSERVE_GATEWAY_ORIGIN, ['https:']),
      ttl: Math.min(DEFAULT_TTL, Math.max(1, Number(env.TORRSERVE_TICKET_TTL_SECONDS) || DEFAULT_TTL)),
      capacity: Math.min(1024, Math.max(1, Number(env.TORRSERVE_MAX_TICKETS) || 1024))
    };
  } catch { return null; }
}

function canonicalStream(raw, source) {
  if (typeof raw !== 'string' || raw.length > 8192) return null;
  try {
    const url = new URL(raw);
    if (url.origin !== source || url.username || url.password || url.hash ||
        !(url.pathname === '/stream' || url.pathname.startsWith('/stream/'))) return null;
    const params = url.searchParams;
    for (const key of params.keys()) {
      if (!['link', 'index', 'play', 'preload'].includes(key) || params.getAll(key).length !== 1) return null;
    }
    const hash = params.get('link'), index = params.get('index');
    if (!/^[a-f0-9]{40}$/i.test(hash || '') || !/^[1-9][0-9]{0,6}$/.test(index || '')) return null;
    if (params.has('play') === params.has('preload')) return null;
    if ((params.get('play') || params.get('preload') || '') !== '') return null;
    return '/stream?link=' + hash.toLowerCase() + '&index=' + index + '&play';
  } catch { return null; }
}

function basic(header) {
  return typeof header === 'string' && header.length <= 2048 && /^Basic [A-Za-z0-9+/]+={0,2}$/.test(header);
}

function transport(url) { return url.protocol === 'https:' ? https : http; }

// A loaded native TorrServe stream can be public even with HttpAuth enabled.
// Revalidate against the protected settings API for every new media request.
function authenticate(config, authorization, signal) {
  if (!basic(authorization)) return Promise.resolve(401);
  return new Promise(resolve => {
    const url = new URL('/settings', config.upstream);
    const body = '{"action":"get"}';
    let settled = false;
    const finish = status => { if (!settled) { settled = true; resolve(status); } };
    const request = transport(url).request(url, {method:'POST', signal, headers:{
      Authorization:authorization, 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(body),
      'Accept-Encoding':'identity'
    }}, response => {
      response.on('error', () => finish(502));
      if (response.statusCode !== 200) {
        finish([401,403].includes(response.statusCode) ? 401 : 502);
        response.destroy();
        return;
      }
      const chunks = []; let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 65536) { finish(502); response.destroy(); } else chunks.push(chunk);
      });
      response.on('end', () => {
        try { finish(typeof JSON.parse(Buffer.concat(chunks).toString('utf8')).CacheSize === 'number' ? 200 : 502); }
        catch { finish(502); }
      });
    });
    request.on('error', () => finish(502));
    request.end(body);
  });
}

function sendError(res, status, code) {
  if (!res.headersSent && !res.destroyed) res.status(status).json({error:code});
}

// Trace only validated ticket requests. Public access logs may contain bearer URLs;
// never include request paths, headers, bodies or request-derived IDs here.
function traceTicket(res) {
  const started = performance.now();
  const requestId = randomBytes(8).toString('hex');
  const trace = {authMs:null, outcome:'gateway_error'};
  console.info(JSON.stringify({event:'torrserve_ticket', phase:'begin', at:new Date().toISOString(), requestId}));
  function report() {
    res.off('finish', report);
    res.off('close', report);
    const totalMs = Math.round(performance.now() - started);
    console.info(JSON.stringify({
      event:'torrserve_ticket', phase:'end', at:new Date().toISOString(), requestId,
      status:res.headersSent ? res.statusCode : null,
      outcome:res.writableFinished ? trace.outcome : 'client_closed',
      totalMs, authMs:trace.authMs ?? totalMs
    }));
  }
  res.once('finish', report);
  res.once('close', report);
  return trace;
}

function stream(config, ticket, req, res) {
  const url = new URL(ticket.path, config.upstream);
  const headers = {Authorization:ticket.authorization, 'Accept-Encoding':'identity'};
  for (const name of ['range','if-range']) if (req.headers[name]) headers[name] = req.headers[name];
  let upstreamResponse;
  const started = performance.now(), requestId = randomBytes(8).toString('hex');
  const rawRange = req.headers.range;
  const safeRange = typeof rawRange === 'string' && rawRange.length <= 128 && /^bytes=[0-9,-]+$/.test(rawRange) ? rawRange : null;
  let bytes = 0, outcome, errorCode = null, reported = false;
  const mark = (reason, error) => {
    if (outcome) return;
    outcome = reason;
    if (typeof error?.code === 'string' && /^[A-Z0-9_]{1,64}$/.test(error.code)) errorCode = error.code;
  };
  const report = fallback => {
    if (reported) return;
    reported = true;
    // One private, bounded record per stream. Never log URLs, tickets, credentials or client addresses.
    console.info(JSON.stringify({
      event:'torrserve_stream', requestId, method:req.method, range:safeRange,
      status:res.headersSent ? res.statusCode : null, upstreamStatus:upstreamResponse?.statusCode || null,
      bytes, durationMs:Math.round(performance.now() - started), outcome:outcome || fallback,
      upstreamComplete:upstreamResponse?.complete || false, upstreamPaused:upstreamResponse?.isPaused() || false,
      downstreamBackpressure:res.writableNeedDrain, errorCode
    }));
  };
  const upstream = transport(url).request(url, {method:req.method, headers}, response => {
    upstreamResponse = response;
    if (res.destroyed) { response.destroy(); return; }
    response.once('aborted', () => mark('upstream_aborted'));
    response.once('error', error => mark('upstream_error',error));
    if (response.statusCode >= 300 && response.statusCode < 400) {
      mark('upstream_redirect');
      response.resume(); sendError(res,502,'upstream_redirect'); return;
    }
    res.statusCode = response.statusCode || 502;
    for (const name of ['content-type','content-length','content-range','accept-ranges','etag','last-modified','content-encoding']) {
      if (response.headers[name] !== undefined) res.setHeader(name,response.headers[name]);
    }
    // Raw HTTP piping preserves byte ranges, encoding and backpressure. Never buffer a video.
    // A full viewer buffer pauses the upstream on purpose; only time out while it can be read.
    response.on('pause', () => upstream.setTimeout(0));
    response.on('resume', () => upstream.setTimeout(120000));
    response.on('data', chunk => { bytes += chunk.length; }); // Bytes read upstream, not confirmed by the viewer.
    pipeline(response, res, error => {
      if (error) mark('stream_error',error);
      report(error ? 'stream_error' : 'completed');
      upstream.destroy();
    });
  });
  const cancel = () => { mark('client_closed'); upstream.destroy(); upstreamResponse?.destroy(); };
  req.on('aborted', cancel);
  res.once('finish', () => report('completed'));
  res.on('close', () => { if (!res.writableFinished) cancel(); report('completed'); });
  upstream.setTimeout(120000, () => {
    const error = Object.assign(new Error('upstream timeout'), {code:'UPSTREAM_IDLE_TIMEOUT'});
    mark('upstream_timeout',error);
    upstream.destroy(error);
  });
  upstream.on('error', error => {
    mark('upstream_error',error);
    if (res.headersSent) res.destroy(); else sendError(res,502,'upstream_unavailable');
  });
  upstream.end();
}

export function createTorrserveGateway(env) {
  const config = configFrom(env);
  const tickets = new Map();
  let pendingAuth = 0;
  const authError = (status, unauthorizedCode) => status === 401 ? unauthorizedCode :
    status === 429 ? 'authorization_busy' : 'upstream_unavailable';

  async function verifyAuth(authorization, req, res) {
    if (pendingAuth >= 16) return {status:429, outcome:'authorization_busy'};
    pendingAuth++;
    const controller = new AbortController();
    const disconnect = () => controller.abort('client_closed');
    req.once('aborted', disconnect);
    res.once('close', disconnect);
    // A socket inactivity timer excludes DNS/connect and resets on every byte.
    // This deadline spans all phases, including receipt of the complete settings JSON.
    const deadline = setTimeout(() => controller.abort('auth_timeout'), 10000);
    try {
      if (req.aborted || res.destroyed) disconnect();
      const status = await authenticate(config, authorization, controller.signal);
      if (controller.signal.aborted) return {status:502, outcome:controller.signal.reason};
      return {status, outcome:status === 200 ? 'authorized' : authError(status,'authorization_required')};
    } finally {
      clearTimeout(deadline);
      req.off('aborted', disconnect);
      res.off('close', disconnect);
      pendingAuth--;
    }
  }
  const prune = () => {
    const now = Date.now();
    for (const [key,ticket] of tickets) if (ticket.expires <= now) tickets.delete(key);
  };
  return {
    enabled:!!config,
    renderAddon() {
      if (!config) return '';
      return readFileSync(new URL('./torrserve-addon.js',import.meta.url),'utf8')
        .replace('__TORRSERVE_SOURCE_ORIGIN_JSON__',JSON.stringify(config.source))
        .replace('__TORRSERVE_TICKET_ENDPOINT_JSON__',JSON.stringify(config.publicOrigin + PREFIX + '/ticket'));
    },
    async handler(req,res) {
      res.set('Cache-Control','private, no-store');
      res.set('Referrer-Policy','no-referrer');
      res.set('Access-Control-Allow-Origin','*');
      res.set('Access-Control-Allow-Headers','Authorization,Content-Type,Range,If-Range,Accept,X-Requested-With');
      res.set('Access-Control-Allow-Methods','GET,HEAD,POST,OPTIONS');
      res.set('Access-Control-Expose-Headers','Content-Length,Content-Range,Accept-Ranges,ETag,Last-Modified');
      res.set('Access-Control-Max-Age','600');
      if (req.method === 'OPTIONS') return res.status(204).end();
      if (!config) return sendError(res,503,'gateway_not_configured');
      prune();
      try {
        const url = new URL(req.url,'http://gateway.invalid');
        if (url.pathname === '/ticket') {
          if (req.method !== 'POST') return sendError(res,405,'method_not_allowed');
          if (!basic(req.headers.authorization)) return sendError(res,401,'authorization_required');
          if (!Buffer.isBuffer(req.body) || req.body.length > 16384) return sendError(res,400,'invalid_request');
          let body;
          try { body = JSON.parse(req.body.toString('utf8')); } catch { return sendError(res,400,'invalid_request'); }
          const path = canonicalStream(body?.url,config.source);
          if (!path) return sendError(res,400,'invalid_stream');
          const trace = traceTicket(res);
          const authStarted = performance.now();
          const {status, outcome} = await verifyAuth(req.headers.authorization, req, res);
          trace.authMs = Math.round(performance.now() - authStarted);
          if (status !== 200) {
            trace.outcome = outcome;
            return sendError(res,status,authError(status,'authorization_required'));
          }
          if (res.destroyed) return;
          prune();
          if (tickets.size >= config.capacity) {
            trace.outcome = 'ticket_capacity';
            return sendError(res,429,'ticket_capacity');
          }
          const token = randomBytes(32).toString('hex');
          const expires = Date.now() + config.ttl * 1000;
          tickets.set(token,{path,authorization:req.headers.authorization,expires});
          trace.outcome = 'issued';
          return res.json({url:config.publicOrigin + PREFIX + '/play/' + token,expiresAt:Math.ceil(expires/1000)});
        }
        if (url.pathname.startsWith('/play/')) {
          if (!['GET','HEAD'].includes(req.method)) return sendError(res,405,'method_not_allowed');
          const match = /^\/play\/([a-f0-9]{64})$/.exec(url.pathname);
          const token = match && !url.search ? match[1] : '';
          const ticket = tickets.get(token);
          if (!ticket) return sendError(res,401,'invalid_or_expired_ticket');
          const {status} = await verifyAuth(ticket.authorization, req, res);
          if (status !== 200) {
            if (status === 401) tickets.delete(token);
            return sendError(res,status,authError(status,'invalid_or_expired_ticket'));
          }
          if (ticket.expires <= Date.now()) { tickets.delete(token); return sendError(res,401,'invalid_or_expired_ticket'); }
          if (!res.destroyed) stream(config,ticket,req,res);
          return;
        }
        return sendError(res,404,'not_found');
      } catch { return sendError(res,500,'gateway_error'); }
    }
  };
}
