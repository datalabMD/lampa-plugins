import assert from 'node:assert/strict';
import { test } from 'node:test';
import http from 'node:http';
import dns from 'node:dns';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import express from 'express';
import { createTorrserveGateway } from '../torrserve-gateway.js';

const authorization = 'Basic ' + Buffer.from('private-user:private-password').toString('base64');
const source = 'https://source.example.test';
const hash = '0123456789abcdef0123456789abcdef01234567';
const input = source + '/stream/private-title.mkv?link=' + hash + '&index=1&play';
const authDeadlineMs = 250;

async function until(check, message, ms = 1000) {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await delay(5);
  assert.ok(check(), message);
}

function shortenAuthTimeouts(t) {
  const timer = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, ms, ...args) =>
    timer(callback, ms === 10000 ? authDeadlineMs : ms, ...args));
  const setIdle = http.ClientRequest.prototype.setTimeout;
  t.mock.method(http.ClientRequest.prototype, 'setTimeout', function (ms, callback) {
    return setIdle.call(this, ms === 10000 ? authDeadlineMs : ms, callback);
  });
}

async function fixture(t, host = '127.0.0.1') {
  const records = [], held = new Set();
  let mode = 'accept', settings = 0, media = 0, cancelled = 0;
  t.mock.method(console, 'info', line => records.push(JSON.parse(line)));
  const origin = http.createServer((req, res) => {
    req.resume();
    if (req.url !== '/settings') { media++; res.end('movie'); return; }
    settings++;
    if (mode === 'hold') {
      held.add(res);
      res.once('close', () => { if (!res.writableFinished) cancelled++; held.delete(res); });
      return;
    }
    if (mode === 'reject') { res.writeHead(401).end(); return; }
    res.setHeader('Content-Type','application/json');
    if (mode === 'trickle') {
      res.write(' ');
      const interval = setInterval(() => res.write(' '), 25);
      const end = setTimeout(() => res.end('{"CacheSize":1}'), 800);
      res.once('close', () => { clearInterval(interval); clearTimeout(end); if (!res.writableFinished) cancelled++; });
    } else res.end('{"CacheSize":1}');
  });
  origin.listen(0, '127.0.0.1'); await once(origin, 'listening');
  const gateway = createTorrserveGateway({
    TORRSERVE_UPSTREAM: 'http://' + host + ':' + origin.address().port,
    TORRSERVE_SOURCE_ORIGIN: source, TORRSERVE_GATEWAY_ORIGIN: 'https://gateway.example.test'
  });
  const app = express();
  app.use('/torrserve', express.raw({type:'*/*'}), gateway.handler);
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  t.after(async () => {
    for (const res of held) res.destroy();
    origin.closeAllConnections(); server.closeAllConnections();
    await Promise.all([origin, server].map(s => new Promise(resolve => s.close(resolve))));
  });
  function request(path, body) {
    const req = http.request(base + path, {
      method: body ? 'POST' : 'GET', headers: body ? {Authorization: authorization,'Content-Type':'application/json'} : {}
    });
    const result = new Promise(resolve => {
      req.on('error', error => resolve({error}));
      req.on('response', res => {
        let text = '';
        res.setEncoding('utf8').on('data', chunk => {text += chunk;});
        res.on('end', () => resolve({status:res.statusCode, text}));
      });
    });
    req.end(body && JSON.stringify(body));
    return {req, result};
  }
  return {records, held, request, ticket: () => request('/torrserve/ticket', {url:input}),
    get settings() { return settings; }, get media() { return media; }, get cancelled() { return cancelled; },
    set mode(next) { mode = next; }};
}

test('abandoning a ticket cancels its native authorization and immediately makes a full slot reusable', async t => {
  const f = await fixture(t);
  f.mode = 'hold';
  const clients = Array.from({length:16}, () => f.ticket());
  await until(() => f.held.size === 16, 'all authorization slots should be occupied');
  assert.equal((await f.ticket().result).status,429);
  clients[0].req.destroy();
  await until(() => f.cancelled === 1, 'abandoned native settings request must be closed');
  f.mode = 'accept';
  assert.equal((await f.ticket().result).status,200);
  clients.slice(1).forEach(c => c.req.destroy());
  await until(() => f.held.size === 0, 'all abandoned requests must release their sockets');
  const closed = f.records.filter(r => r.phase === 'end' && r.outcome === 'client_closed');
  assert.equal(closed.length,16);
  assert.ok(closed.every(r => r.status === null));
});

test('cancelling a media GET during revalidation closes settings and never starts the media request', async t => {
  const f = await fixture(t);
  const {url} = JSON.parse((await f.ticket().result).text);
  f.mode = 'hold';
  const viewer = f.request(new URL(url).pathname);
  await until(() => f.held.size === 1, 'media GET must revalidate credentials');
  viewer.req.destroy();
  await until(() => f.cancelled === 1, 'pending media auth should be cancelled');
  assert.equal(f.media,0);
});

test('authorization deadline includes DNS even when the socket has not connected', async t => {
  shortenAuthTimeouts(t);
  const lookup = dns.lookup;
  let pendingLookup;
  t.mock.method(dns, 'lookup', function (name, options, callback) {
    if (name !== 'slow-dns.invalid') return lookup.apply(this, arguments);
    pendingLookup = () => options.all ? callback(null,[{address:'127.0.0.1',family:4}]) : callback(null,'127.0.0.1',4);
  });
  const f = await fixture(t, 'slow-dns.invalid');
  const req = f.ticket();
  await until(() => pendingLookup, 'native DNS lookup should start');
  const result = await Promise.race([req.result,delay(750, {status:'still_pending'})]);
  pendingLookup();
  assert.equal(result.status,502);
  assert.equal(f.records.find(r => r.phase === 'end').outcome,'auth_timeout');
  await delay(30);
  assert.equal(f.settings,0,'a late DNS answer must not resurrect the cancelled request');
});

test('a settings body which keeps trickling bytes cannot extend the authorization deadline', async t => {
  shortenAuthTimeouts(t);
  const f = await fixture(t);
  f.mode = 'trickle';
  const result = await f.ticket().result;
  assert.equal(result.status,502);
  await until(() => f.cancelled === 1,'native response should close before completion');
  assert.equal(f.records.find(r => r.phase === 'end').outcome,'auth_timeout');
});

test('accepted and rejected tickets emit one correlated pair of private records and preserve fresh authorization', async t => {
  const f = await fixture(t);
  const accepted = await f.ticket().result;
  assert.equal(accepted.status,200);
  const {url} = JSON.parse(accepted.text);
  f.mode = 'reject';
  assert.equal((await f.ticket().result).status,401);
  assert.equal((await f.request(new URL(url).pathname).result).status,401);
  assert.equal(f.settings,3);
  assert.equal(f.media,0);
  assert.equal((await f.request('/torrserve/ticket',{url:'https://other.example/invalid'}).result).status,400);
  assert.equal(f.records.length,4,'only syntactically valid tickets are traced');
  for (const [index,status,outcome] of [[0,200,'issued'],[2,401,'authorization_required']]) {
    const [begin,end] = f.records.slice(index,index+2);
    assert.equal(begin.event,'torrserve_ticket'); assert.equal(end.event,'torrserve_ticket');
    assert.equal(begin.phase,'begin'); assert.equal(end.phase,'end');
    assert.match(begin.requestId,/^[0-9a-f]{16}$/); assert.equal(end.requestId,begin.requestId);
    for (const r of [begin,end]) assert.ok(Number.isFinite(Date.parse(r.at)));
    assert.deepEqual(Object.keys(begin).sort(),['event','phase','at','requestId'].sort());
    assert.deepEqual(Object.keys(end).sort(),['event','phase','at','requestId','status','outcome','totalMs','authMs'].sort());
    assert.equal(end.status,status); assert.equal(end.outcome,outcome);
    assert.ok(Number.isInteger(end.authMs) && end.authMs >= 0 && end.totalMs >= end.authMs);
  }
  const log = JSON.stringify(f.records);
  for (const secret of [authorization, 'private-user','private-password','private-title', hash, url, new URL(url).pathname.split('/').pop(),'127.0.0.1','https://']) {
    assert.ok(!log.includes(secret), 'private records must omit user, credentials, tokens, addresses and media identifiers');
  }
});
