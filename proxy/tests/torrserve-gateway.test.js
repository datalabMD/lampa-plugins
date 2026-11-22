import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

const auth = 'Basic ' + Buffer.from('lampa:123456789012').toString('base64');
const source = 'https://torr.example.test';
const hash = '0123456789abcdef0123456789abcdef01234567';
const input = source + '/stream/movie.mp4?link=' + hash + '&index=1&preload';
const bytes = Buffer.from('0123456789abcdef');
let upstream, child, base, authorized = true, requests = [], slow = false, release;
let viewerDisconnected = false, holdAuth = false;
const pendingAuth = new Set();

async function listen(server) {
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return server.address().port;
}
before(async () => {
  upstream = http.createServer((req, res) => {
    requests.push({url:req.url, method:req.method, range:req.headers.range, ifRange:req.headers['if-range']});
    if (req.url === '/settings') {
      req.resume();
      if (!authorized || req.headers.authorization !== auth) { res.writeHead(401).end(); return; }
      const finish = () => { pendingAuth.delete(finish); res.setHeader('Content-Type', 'application/json'); res.end('{"CacheSize":100}'); };
      if (holdAuth) pendingAuth.add(finish); else finish();
      return;
    }
    assert.equal(req.url, '/stream?link=' + hash + '&index=1&play');
    assert.equal(req.headers.authorization, auth);
    res.setHeader('Content-Type', 'video/mp4'); res.setHeader('Accept-Ranges', 'bytes'); res.setHeader('ETag', '"movie-v1"');
    res.setHeader('Set-Cookie', 'should-not-be-forwarded=1');
    if (slow) {
      res.on('close', () => { if (!res.writableEnded) viewerDisconnected = true; });
      res.setHeader('Content-Length', 10); res.write('first');
      release = () => res.end('final'); return;
    }
    if (req.headers.range === 'bytes=99-100') { res.writeHead(416, {'Content-Range':'bytes */16'}).end(); return; }
    if (req.headers.range === 'bytes=4-7') {
      res.writeHead(206, {'Content-Range':'bytes 4-7/16','Content-Length':4}); res.end(bytes.subarray(4,8)); return;
    }
    res.setHeader('Content-Length', bytes.length); res.end(req.method === 'HEAD' ? undefined : bytes);
  });
  const upstreamPort = await listen(upstream);
  const reservation = http.createServer(); const port = await listen(reservation);
  await new Promise(resolve => reservation.close(resolve));
  base = 'http://127.0.0.1:' + port;
  child = spawn(process.execPath, ['server.js'], {cwd:new URL('..',import.meta.url), env:{...process.env,
    PORT:String(port), TORRSERVE_UPSTREAM:'http://127.0.0.1:' + upstreamPort,
    TORRSERVE_SOURCE_ORIGIN:source, TORRSERVE_GATEWAY_ORIGIN:'https://gateway.example.test',
    TORRSERVE_TICKET_TTL_SECONDS:'2', TORRSERVE_MAX_TICKETS:'8'}, stdio:['ignore','pipe','pipe']});
  let errors=''; child.stderr.on('data',chunk => errors += chunk);
  for (let i=0; i<100; i++) {
    if (child.exitCode !== null) throw new Error('server exited: '+errors);
    try { const r=await fetch(base+'/health'); if(r.ok) return; } catch {}
    await delay(20);
  }
  throw new Error('server startup timed out: '+errors);
});
after(async () => {
  for (const finish of pendingAuth) finish();
  release?.(); child?.kill();
  if (upstream) { upstream.closeAllConnections(); await new Promise(resolve=>upstream.close(resolve)); }
});
async function ticket(url=input, credential=auth) {
  return fetch(base+'/torrserve/ticket',{method:'POST',headers:{'Content-Type':'application/json',...(credential?{Authorization:credential}:{})},body:JSON.stringify({url})});
}
async function mint() {
  const r=await ticket(); assert.equal(r.status,200); const value=await r.json();
  assert.match(value.url,/^https:\/\/gateway\.example\.test\/torrserve\/play\/[a-f0-9]{64}$/);
  assert.ok(Number.isInteger(value.expiresAt)); return {url:base+new URL(value.url).pathname, publicUrl:value.url};
}

test('a video ticket requires valid Basic authorization', async () => {
  assert.equal((await ticket(input,null)).status,401);
  assert.equal((await ticket(input,'Basic '+Buffer.from('lampa:wrong').toString('base64'))).status,401);
});
test('preflight permits video requests and unknown routes never reach the generic proxy', async () => {
  const r=await fetch(base+'/torrserve/ticket',{method:'OPTIONS',headers:{Origin:'https://lampa.example.test','Access-Control-Request-Headers':'authorization,content-type'}});
  assert.equal(r.status,204); assert.match(r.headers.get('access-control-allow-headers'),/Authorization/);
  assert.match(r.headers.get('access-control-allow-methods'),/HEAD/);
  assert.equal((await fetch(base+'/torrserve/unknown?url=https://example.org/')).status,404);
  assert.equal((await fetch(base+'/torrserve/ticket')).status,405);
});
test('URL input cannot select another upstream, file, or operation', async () => {
  for (const bad of [input.replace('torr.example.test','evil.test'), input.replace('/stream/','/settings/'),
    input+'&index=2',input+'&link='+hash,input.replace('index=1','index=-1'),input+'&url=http://localhost/',
    input.replace('https://','https://user:pass@'),input.replace(hash,'bad'),input+'#fragment']) {
    assert.equal((await ticket(bad)).status,400,bad);
  }
});
test('oversized ticket bodies are rejected before upstream authorization', async () => {
  const count=requests.length;
  const r=await fetch(base+'/torrserve/ticket',{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({url:input,padding:'x'.repeat(20000)})});
  assert.equal(r.status,413);
  assert.equal(requests.length,count);
});
test('an opaque ticket returns actual Range bytes and preserves seek headers', async () => {
  const t=await mint();
  const r=await fetch(t.url,{headers:{Range:'bytes=4-7','If-Range':'"movie-v1"'}});
  assert.equal(r.status,206); assert.equal(await r.text(),'4567');
  assert.equal(r.headers.get('content-range'),'bytes 4-7/16'); assert.equal(r.headers.get('content-length'),'4');
  assert.equal(r.headers.get('content-type'),'video/mp4'); assert.equal(r.headers.get('accept-ranges'),'bytes');
  assert.equal(r.headers.get('set-cookie'),null); assert.match(r.headers.get('cache-control'),/no-store/);
  assert.match(r.headers.get('access-control-expose-headers'),/Content-Range/);
  assert.equal(requests.at(-1).ifRange,'"movie-v1"');
  const head=await fetch(t.url,{method:'HEAD'}); assert.equal(head.status,200); assert.equal(await head.text(),''); assert.equal(head.headers.get('content-length'),'16');
  const invalid=await fetch(t.url,{headers:{Range:'bytes=99-100'}}); assert.equal(invalid.status,416); assert.equal(invalid.headers.get('content-range'),'bytes */16');
});
test('forged tokens, wrong methods and revoked passwords cannot play', async () => {
  const count=requests.length;
  assert.equal((await fetch(base+'/torrserve/play/'+'0'.repeat(64))).status,401);
  assert.equal(requests.length,count);
  const t=await mint();
  assert.equal((await fetch(t.url,{method:'POST',body:'x'})).status,405);
  authorized=false;
  try { assert.equal((await fetch(t.url)).status,401); } finally { authorized=true; }
});
test('the first bytes reach the viewer before the upstream response ends', async () => {
  const t=await mint(); slow=true;
  try {
    const r=await fetch(t.url,{signal:AbortSignal.timeout(1500)});
    const reader=r.body.getReader(); const first=await reader.read();
    assert.equal(Buffer.from(first.value).toString(),'first');
    release(); const last=await reader.read(); assert.equal(Buffer.from(last.value).toString(),'final');
    assert.equal((await reader.read()).done,true);
  } finally { slow=false; release?.(); }
});
test('closing the viewer immediately cancels the unfinished upstream video', async () => {
  const t=await mint(); slow=true; viewerDisconnected=false;
  const controller=new AbortController();
  try {
    const r=await fetch(t.url,{signal:controller.signal});
    const first=await r.body.getReader().read();
    assert.equal(Buffer.from(first.value).toString(),'first');
    controller.abort();
    for (let i=0;i<50 && !viewerDisconnected;i++) await delay(20);
    assert.equal(viewerDisconnected,true,'upstream must close before its final bytes are released');
  } finally { controller.abort(); slow=false; release?.(); }
});
test('debug and health never include credentials or playback tickets', async () => {
  const t=await mint();
  for(const path of ['/health','/debug/recent']) {
    const text=await (await fetch(base+path)).text();
    assert.ok(!text.includes(auth)); assert.ok(!text.includes('123456789012'));
    assert.ok(!text.includes(new URL(t.publicUrl).pathname.split('/').pop()));
  }
});
test('expired tickets stop working and capacity does not evict active tickets', async () => {
  const t=await mint(); await delay(2200);
  assert.equal((await fetch(t.url)).status,401);
  const first=await mint();
  for(let i=0;i<7;i++) await mint();
  assert.equal((await ticket()).status,429);
  assert.equal((await fetch(first.url)).status,200);
});
test('concurrent authorization has a bounded budget instead of accumulating requests', async () => {
  holdAuth=true;
  const completed=[];
  const pending=Array.from({length:32},()=>ticket().then(async r=>{
    const result={status:r.status,...await r.json()}; completed.push(result); return result;
  }));
  try {
    for (let i=0;i<50 && completed.length<16;i++) await delay(20);
    assert.equal(pendingAuth.size,16,'only sixteen backend validations may wait concurrently');
    assert.equal(completed.length,16,'excess callers should fail promptly');
    assert.ok(completed.every(r=>r.status===429 && r.error==='authorization_busy'));
  } finally {
    holdAuth=false;
    for (const finish of pendingAuth) finish();
    await Promise.all(pending);
  }
});
