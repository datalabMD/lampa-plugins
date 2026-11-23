import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import http from 'node:http';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import express from 'express';
import { createTorrserveGateway } from '../torrserve-gateway.js';

const idleMs = 600;
const originalTimeout = http.ClientRequest.prototype.setTimeout;
const auth = 'Basic ' + Buffer.from('private-test-user:private-test-password').toString('base64');
const hash = '0123456789abcdef0123456789abcdef01234567';
const input = 'https://torr.example.test/stream/private-film-title.mp4?link=' + hash + '&index=1&play';
const range = 'bytes=4294967296-';

before(() => {
  // Keep real sockets, timers and backpressure; shorten long production timeouts only in this test process.
  http.ClientRequest.prototype.setTimeout = function (milliseconds, callback) {
    return originalTimeout.call(this, Math.min(milliseconds, idleMs), callback);
  };
});
after(() => { http.ClientRequest.prototype.setTimeout = originalTimeout; });

async function waitFor(predicate, message, timeout = 3000) {
  const end = Date.now() + timeout;
  while (!predicate() && Date.now() < end) await delay(10);
  assert.ok(predicate(), message);
}

async function fixture(t, mode) {
  let producerResponse, gatewayResponse, producerTimer, viewerRequest, viewerResponse;
  let sourceClosed = false, received = 0;
  const logs = [], originalInfo = console.info;
  console.info = line => { if (JSON.parse(line).event === 'torrserve_stream') logs.push(line); };
  const length = mode === 'complete' ? 65536 : mode === 'paced' ? 1024 * 1024 : 32 * 1024 * 1024;
  const origin = http.createServer((req, res) => {
    assert.equal(req.headers.authorization, auth);
    if (req.url === '/settings') {
      req.resume(); res.setHeader('Content-Type', 'application/json'); res.end('{"CacheSize":536870912}'); return;
    }
    assert.equal(req.url, '/stream?link=' + hash + '&index=1&play');
    assert.equal(req.headers.range, range);
    producerResponse = res;
    res.on('close', () => { sourceClosed = true; clearTimeout(producerTimer); });
    if (mode === 'stall_headers') return;
    res.writeHead(206, {
      'Content-Type': 'video/mp4', 'Content-Length': length, 'Accept-Ranges': 'bytes',
      'Content-Range': 'bytes 4294967296-' + (4294967296 + length - 1) + '/' + (4294967296 + length)
    });
    const chunk = Buffer.alloc(65536, 0x71);
    if (mode === 'stall_body') { res.write(chunk); return; }
    if (mode === 'abort_body') { res.write(chunk); producerTimer = setTimeout(() => res.destroy(), 40); return; }
    let sent = 0;
    function pump() {
      if (sourceClosed) return;
      while (sent < length) {
        sent += chunk.length;
        const writable = res.write(chunk);
        if (mode === 'paced') { producerTimer = setTimeout(pump, 100); return; }
        if (!writable) { res.once('drain', pump); return; }
      }
      res.end();
    }
    pump();
  });
  origin.listen(0, '127.0.0.1'); await once(origin, 'listening');
  const gateway = createTorrserveGateway({
    TORRSERVE_UPSTREAM: 'http://127.0.0.1:' + origin.address().port,
    TORRSERVE_SOURCE_ORIGIN: 'https://torr.example.test',
    TORRSERVE_GATEWAY_ORIGIN: 'https://gateway.example.test'
  });
  const app = express();
  app.use('/torrserve', express.raw({ type: '*/*', limit: '16kb' }), (req, res) => {
    if (req.url.startsWith('/play/')) gatewayResponse = res;
    return gateway.handler(req, res);
  });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  t.after(async () => {
    clearTimeout(producerTimer); viewerRequest?.destroy(); viewerResponse?.destroy();
    server.closeAllConnections(); origin.closeAllConnections();
    await Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => origin.close(resolve))]);
    console.info = originalInfo;
  });
  const minted = await fetch(base + '/torrserve/ticket', {
    method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ url: input })
  });
  assert.equal(minted.status, 200);
  const ticket = await minted.json();
  let finish;
  const done = new Promise(resolve => { finish = resolve; });
  await new Promise((resolve, reject) => {
    viewerRequest = http.get(base + new URL(ticket.url).pathname, { headers: { Range: range } }, res => {
      viewerResponse = res;
      res.on('data', chunk => { received += chunk.length; });
      res.on('error', error => finish({ error, complete: res.complete }));
      res.on('end', () => finish({ complete: res.complete }));
      if (mode === 'pause' || mode === 'cancel') res.pause();
      resolve();
    });
    viewerRequest.on('error', reject);
  });
  return {
    done, length,
    get received() { return received; },
    get response() { return viewerResponse; },
    get sourceClosed() { return sourceClosed; },
    get backpressured() { return gatewayResponse.writableNeedDrain && !producerResponse.writableEnded; },
    token: new URL(ticket.url).pathname.split('/').pop(),
    async record() {
      await waitFor(() => logs.length > 0, 'a stream must emit a private outcome record', 500);
      assert.equal(logs.length, 1, 'emit one bounded outcome record, never per-chunk logs');
      return JSON.parse(logs[0]);
    },
    resume() { viewerResponse.resume(); },
    cancel() { viewerRequest.destroy(); viewerResponse.destroy(); }
  };
}

test('a paused ranged download survives an idle interval and resumes with every byte', { timeout: 8000 }, async t => {
  const f = await fixture(t, 'pause');
  await waitFor(() => f.backpressured, 'the paused viewer must fill the real downstream socket');
  await delay(idleMs * 2.5);
  f.resume();
  const result = await f.done;
  assert.equal(result.error, undefined, 'viewer backpressure must not be treated as an upstream failure');
  assert.equal(result.complete, true);
  assert.equal(f.received, 33554432);
  assert.equal(f.response.statusCode, 206);
  assert.equal(f.response.headers['content-range'], 'bytes 4294967296-4328521727/4328521728');
});

test('ongoing progress survives longer than the upstream idle timeout', { timeout: 5000 }, async t => {
  const f = await fixture(t, 'paced');
  const result = await f.done;
  assert.equal(result.error, undefined); assert.equal(result.complete, true);
  assert.equal(f.received, 1048576);
});

test('a genuinely stalled upstream body still terminates the incomplete response', { timeout: 4000 }, async t => {
  const f = await fixture(t, 'stall_body');
  const result = await f.done;
  assert.equal(result.error?.code, 'ECONNRESET');
  assert.equal(result.complete, false); assert.equal(f.received, 65536);
  await waitFor(() => f.sourceClosed, 'a stalled upstream must be released');
  const record = await f.record();
  assert.equal(record.outcome, 'upstream_timeout');
  assert.equal(record.bytes, 65536); assert.equal(record.status, 206);
  assert.equal(record.upstreamComplete, false);
});

test('a stalled upstream before headers still returns a gateway error', { timeout: 4000 }, async t => {
  const f = await fixture(t, 'stall_headers');
  const result = await f.done;
  assert.equal(result.error, undefined); assert.equal(result.complete, true);
  assert.equal(f.response.statusCode, 502);
  const record = await f.record();
  assert.equal(record.outcome, 'upstream_timeout');
  assert.equal(record.upstreamStatus, null); assert.equal(record.bytes, 0);
});

test('viewer cancellation during backpressure promptly releases the upstream', { timeout: 4000 }, async t => {
  const f = await fixture(t, 'cancel');
  await waitFor(() => f.backpressured, 'the viewer must pause before cancelling');
  f.cancel();
  await waitFor(() => f.sourceClosed, 'cancellation must release the upstream even while its idle timer is suspended', idleMs / 2);
  assert.equal((await f.record()).outcome, 'client_closed');
});

test('an upstream abort is distinguishable from a client disconnect', { timeout: 4000 }, async t => {
  const f = await fixture(t, 'abort_body');
  const result = await f.done;
  assert.equal(result.error?.code, 'ECONNRESET'); assert.equal(result.complete, false);
  const record = await f.record();
  assert.equal(record.outcome, 'upstream_aborted');
  assert.equal(record.upstreamComplete, false); assert.equal(record.status, 206);
});

test('private diagnostics report transfer facts without credentials or media identifiers', { timeout: 4000 }, async t => {
  const f = await fixture(t, 'complete');
  assert.equal((await f.done).complete, true);
  const record = await f.record();
  assert.equal(record.event, 'torrserve_stream'); assert.match(record.requestId, /^[a-f0-9]{16}$/);
  assert.equal(record.outcome, 'completed'); assert.equal(record.method, 'GET');
  assert.equal(record.bytes, 65536); assert.equal(record.status, 206); assert.equal(record.upstreamStatus, 206);
  assert.equal(record.range, range); assert.equal(record.upstreamComplete, true);
  assert.ok(Number.isInteger(record.durationMs) && record.durationMs >= 0);
  assert.deepEqual(Object.keys(record).sort(), [
    'event', 'requestId', 'method', 'range', 'status', 'upstreamStatus', 'bytes', 'durationMs',
    'outcome', 'upstreamComplete', 'upstreamPaused', 'downstreamBackpressure', 'errorCode'
  ].sort());
  const serialized = JSON.stringify(record);
  for (const secret of [auth, 'private-test-user', 'private-test-password', 'private-film-title', hash, input, f.token, '127.0.0.1', 'https://']) {
    assert.ok(!serialized.includes(secret), 'diagnostics must not disclose credentials, media identifiers or network addresses');
  }
});
