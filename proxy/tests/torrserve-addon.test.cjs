const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const addon = path.join(__dirname, '../torrserve-addon.js');
const source = 'https://torr.datalab.md';
const endpoint = 'https://lampa.datalab.md/torrserve/ticket';
const original = source + '/stream/film.mp4?link=' + 'a'.repeat(40) + '&index=1&preload';
const second = original.replace('index=1', 'index=2');
const gateway = 'https://lampa.datalab.md/torrserve/play/';
const signed = gateway + 'a'.repeat(64);
const otherSigned = gateway + 'b'.repeat(64);

function tv(options = {}) {
    const calls = [], plays = [], errors = [], handlers = {}, reads = [];
    let back;
    function emit(type, data) {
        (handlers[type] || []).forEach(fn => fn(data));
    }
    const player = {
        listener: {follow(type, fn) { (handlers[type] ||= []).push(fn); }},
        play(data) {
            let stopped = false;
            emit('create', {data, abort() { stopped = true; }});
            if (stopped) return;
            // Lampa chooses the default quality before sending 'start' and setting video.src.
            if (data.quality && Object.keys(data.quality).length > 1 && data.quality['1080p']) {
                data.url = data.quality['1080p'].url || data.quality['1080p'];
            }
            emit('start', data);
            plays.push({data, url: data.url, quality: data.quality});
            emit('ready', data);
        }
    };
    const Lampa = {
        Player: player,
        Torserver: {url() { return options.server || source; }},
        Storage: {
            field(k) { return k === 'torrserver_auth' && options.auth !== false; },
            get(k) { reads.push(k); return k === 'torrserver_login' ? 'lampa' : 123; },
            value(k) { reads.push(k); return k === 'torrserver_password' ? '000123' : ''; }
        },
        Loading: {start(fn) { back = fn; }, stop() { back = null; }},
        Noty: {show(msg) {errors.push(msg);}}
    };
    class XHR {
        constructor() { this.headers = {}; calls.push(this); }
        open(method, url) { this.method = method; this.url = url; }
        setRequestHeader(k, v) { this.headers[k.toLowerCase()] = v; }
        send(body) { this.body = JSON.parse(body); }
        abort() { this.aborted = true; if (this.onabort) this.onabort(); }
        reply(url = signed, expiresAt = Math.floor(Date.now()/1000) + 60, status = 200) {
            this.status = status;
            this.responseText = JSON.stringify({url, expiresAt});
            this.onload();
        }
    }
    const window = {Lampa, appready: true, btoa, XMLHttpRequest: XHR, URL};
    const ctx = {window, Lampa, btoa, XMLHttpRequest: XHR, URL, setTimeout, clearTimeout, Date: options.clock || Date};
    // Before the addon is bundled, this is the unmodified stock Player boundary.
    if (fs.existsSync(addon)) {
        const script = fs.readFileSync(addon, 'utf8')
            .replace('__TORRSERVE_TICKET_ENDPOINT_JSON__', JSON.stringify(endpoint))
            .replace('__TORRSERVE_SOURCE_ORIGIN_JSON__', JSON.stringify(source));
        vm.runInNewContext(script, ctx);
    }
    return {play: player.play, emit, calls, plays, errors, reads, back() {back();}};
}

test('native playback waits for authorization and replays the same item with callbacks and playlist intact', () => {
    const t = tv();
    const viewed = () => {}, timeline = {time: 15}, playlist = [{url: second}];
    const data = {url: original, id: 1, torrent_hash: 'a'.repeat(40), timeline, playlist, viewed};
    t.play(data);
    assert.equal(t.plays.length, 0, 'stock VIDAA received a plain unauthenticated stream URL');
    const req = t.calls[0];
    assert.equal(req.url, endpoint);
    assert.equal(req.method, 'POST');
    assert.equal(req.headers.authorization, 'Basic ' + Buffer.from('lampa:000123').toString('base64'));
    assert.deepEqual(req.body, {url: original});
    req.reply();
    assert.equal(t.plays[0].url, signed);
    assert.equal(t.plays[0].data, data);
    assert.equal(data.viewed, viewed);
    assert.equal(data.timeline, timeline);
    assert.equal(data.playlist, playlist);
    assert.equal(data.torrent_hash, 'a'.repeat(40));
    assert.equal(data.id, 1);
    assert.equal(t.calls.length, 1);
    t.play(data);
    assert.equal(t.calls.length, 2, 'same item must get a new ticket on re-open');
    assert.equal(t.calls[1].body.url, original);
    t.calls[1].reply(otherSigned);
    assert.equal(t.plays[1].url, otherSigned);
});

test('foreign, prefixed-host, non-stream and normalized out-of-scope URLs never access TV credentials', () => {
    const t = tv();
    for (const url of ['https://example.com/stream/a', source+'.evil.test/stream/a', source+'/gst/hash/master.m3u8',
        source+'/stream/../settings', 'https://other@torr.datalab.md/stream/a', source+'/streaming/file']) {
        t.play({url});
        assert.equal(t.plays.at(-1).url, url);
    }
    assert.equal(t.calls.length, 0);
    assert.equal(t.reads.length, 0);
});

test('new same-item, other playback, Back, close and destroy each cancel pending replies', () => {
    for (const event of ['same', 'unrelated', 'back', 'close', 'destroy']) {
        const t = tv();
        const data = {url: original};
        t.play(data);
        switch (event) {
        case 'same': t.play(data); break;
        case 'unrelated': t.play({url: 'https://example.com/film'}); break;
        case 'back': t.back(); break;
        default: t.emit(event, {}); break;
        }
        const req = t.calls[0];
        assert.equal(req.aborted,true,event);
        req.reply(); // Simulate a response callback already queued before abort.
        assert.deepEqual(t.plays.map(p => p.url),event === 'unrelated' ? ['https://example.com/film'] : [],event);
        if (event === 'same') {
            t.calls[1].reply(otherSigned);
            assert.equal(t.plays[0].url,otherSigned);
        }
    }
});

test('a ticket just issued by the gateway plays when the TV clock is one day fast', () => {
    const serverNow = 1800000000;
    const t = tv({clock: {now: () => (serverNow + 24 * 3600) * 1000}});
    t.play({url: original});
    t.calls[0].reply(signed, serverNow + 6 * 3600);
    assert.deepEqual(t.plays.map(p => p.url), [signed]);
});

test('an error, malformed expiry or off-contract playback URL never reaches the player', () => {
    for (const [url, expires, status] of [
        [signed, 0, 200], [signed, -1, 200], [signed, 1.5, 200], [signed, '123', 200], ['https://example.com/film', Date.now(), 200],
        [signed + '?x=1', Date.now(), 200], [gateway + 'short', Date.now(), 200],
        [signed, Date.now(), 401]
    ]) {
        const t = tv();
        t.play({url: original});
        t.calls[0].reply(url,expires,status);
        assert.equal(t.plays.length,0);
        assert.equal(t.errors.length,1);
    }
});

test('quality selection uses its own ticket, preserves quality metadata and leaves third-party variants alone', () => {
    const t = tv();
    const variants = {'720p': original, '1080p': {url: second, label: 'HD'}, '360p': 'https://other.example/movie'};
    const data = {url: original, quality: variants};
    t.play(data);
    const low = t.calls.find(c => c.body.url === original);
    const high = t.calls.find(c => c.body.url === second);
    // Finish requests in either sequence, permitting sequential or concurrent clients.
    assert.ok(low);
    low.reply(signed);
    assert.equal(t.plays.length,0);
    (high || t.calls.find(c => c.body.url === second)).reply(otherSigned);
    assert.equal(t.plays[0].url,otherSigned);
    assert.equal(t.plays[0].quality['1080p'].label,'HD');
    assert.equal(t.plays[0].quality['720p'],signed);
    assert.equal(t.plays[0].quality['360p'],variants['360p']);
    assert.equal(t.calls.length,2);
    t.emit('destroy',{});
    assert.equal(data.quality,variants);
    assert.equal(variants['1080p'].url,second);
});

test('credentials for a different configured server or a disabled login are never used to mint a ticket', () => {
    for (const options of [{server: 'https://other.example'}, {auth: false}]) {
        const t = tv(options);
        t.play({url: original});
        assert.equal(t.calls.length, 0);
        assert.deepEqual(t.reads, []);
        assert.equal(t.plays[0].url, original);
    }
});
