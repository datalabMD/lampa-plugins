import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { createTorrserveApp } from '../torrserve-server.js';

const source = 'https://torr.becor.example';
const gateway = 'https://player.becor.example';

async function listen(t, handler) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  return 'http://127.0.0.1:' + server.address().port;
}

function config(upstream) {
  return { TORRSERVE_UPSTREAM: upstream, TORRSERVE_SOURCE_ORIGIN: source, TORRSERVE_GATEWAY_ORIGIN: gateway };
}

test('public plugin and health expose only the configured addon and its readiness', async t => {
  const upstream = 'http://private-native:8090';
  const env = { ...config(upstream), TORRSERVER_PASSWORD: 'never-publish-test-value' };
  const base = await listen(t, createTorrserveApp(env));
  const health = await fetch(base + '/health');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { torrserveGateway: true });
  const plugin = await fetch(base + '/plugin.js', { headers: { Origin: 'https://lampa.example' } });
  assert.equal(plugin.status, 200);
  assert.match(plugin.headers.get('content-type'), /javascript/);
  assert.equal(plugin.headers.get('access-control-allow-origin'), '*');
  assert.match(plugin.headers.get('cache-control'), /no-store/);
  const code = await plugin.text();
  assert.ok(code.includes(source));
  assert.ok(code.includes(gateway + '/torrserve/ticket'));
  assert.ok(!code.includes(upstream));
  assert.ok(!code.includes(env.TORRSERVER_PASSWORD));
  assert.doesNotMatch(code, /rezka4|__TORRSERVE_[A-Z_]+__/i);
  for (const route of ['/p', '/debug/recent', '/proxy?url=' + source, '/']) {
    assert.equal((await fetch(base + route)).status, 404, route);
  }
});

test('missing upstream configuration makes health and the plugin unavailable', async t => {
  const base = await listen(t, createTorrserveApp(config('')));
  const health = await fetch(base + '/health');
  assert.equal(health.status, 503);
  assert.deepEqual(await health.json(), { torrserveGateway: false });
  assert.equal((await fetch(base + '/plugin.js')).status, 503);
});

test('standalone HTTP routes issue a scoped ticket and pass ranged media from the fixed native service', async t => {
  const auth = 'Basic ' + Buffer.from('lampa:loopback-test').toString('base64');
  const hash = 'abcde'.repeat(8);
  const settingsPath = '/settings';
  const mediaPath = '/stream?link=' + hash + '&index=2&play';
  const seen = [];
  const upstream = await listen(t, (req, res) => {
    seen.push([req.method, req.url]);
    if (req.headers.authorization !== auth) return res.writeHead(401).end();
    if (req.url === settingsPath && req.method === 'POST') {
      req.resume();
      return res.end('{"CacheSize":1024}');
    }
    if (req.url === mediaPath && req.headers.range === 'bytes=2-4') {
      return res.writeHead(206, {'Content-Length': 3, 'Content-Range': 'bytes 2-4/8'}).end('234');
    }
    res.writeHead(404).end();
  });
  const base = await listen(t, createTorrserveApp(config(upstream)));
  const ticketUrl = base + '/torrserve/ticket';
  const query = JSON.stringify({url: source + '/stream/movie?link=' + hash + '&index=2&preload'});
  const options = { method: 'POST', headers: {'Content-Type': 'application/json'}, body: query };
  assert.equal((await fetch(ticketUrl, options)).status, 401);
  const preflight = await fetch(ticketUrl, {method: 'OPTIONS', headers: {
    Origin: 'https://lampa.example', 'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'authorization,content-type'
  }});
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-headers'), /authorization/i);
  const response = await fetch(ticketUrl, {...options, headers: {...options.headers, Authorization: auth}});
  assert.equal(response.status, 200);
  const {url} = await response.json();
  const ticket = new URL(url);
  assert.equal(ticket.origin, gateway);
  assert.match(ticket.pathname, /^\/torrserve\/play\/[0-9a-f]{64}$/);
  const media = await fetch(base + ticket.pathname, {headers: {Range: 'bytes=2-4'}});
  assert.equal(media.status, 206);
  assert.equal(media.headers.get('content-range'), 'bytes 2-4/8');
  assert.equal(await media.text(), '234');
  assert.deepEqual(seen, [['POST', settingsPath], ['POST', settingsPath], ['GET', mediaPath]]);
});
