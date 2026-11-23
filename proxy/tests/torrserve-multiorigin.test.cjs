const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createHash} = require('node:crypto');

const addon = fs.readFileSync(path.join(__dirname, '../torrserve-addon.js'), 'utf8');
const legacyGuard = '        if (window.datalabTorrServePlayerInstalled) return;\n' +
    '        window.datalabTorrServePlayerInstalled = true;';
const registryGuard = '        // Leave the legacy Datalab flag untouched so either plugin can load first.\n' +
    '        var installedOrigins = window.torrServePlayerInstalledByOrigin ||\n' +
    '            (window.torrServePlayerInstalledByOrigin = Object.create(null));\n' +
    '        if (installedOrigins[sourceOrigin]) return;\n' +
    '        installedOrigins[sourceOrigin] = true;';

// Offline legacy fixture: restore only the installation guard to deployed f029f88.
// Verify its complete Git blob so future addon changes cannot silently change the
// supposedly immutable legacy participant in these compatibility tests.
const legacy = addon.replace(registryGuard, legacyGuard);
assert.equal(createHash('sha1').update('blob ' + Buffer.byteLength(legacy) + '\0').update(legacy).digest('hex'),
    'ac0ad893626da0391565356a12e56074f68132cb', 'legacy fixture must remain exactly the reviewed f029f88 blob');

const providers = {
    datalab: {source: 'https://torrent.datalab.example', gateway: 'https://player.datalab.example'},
    becor: {source: 'https://torrent.becor.example', gateway: 'https://player.becor.example'}
};
const stream = (name, index = 1) => providers[name].source + '/stream/movie.mkv?link=' + 'a'.repeat(40) + '&index=' + index + '&play';
const signed = name => providers[name].gateway + '/torrserve/play/' + (name === 'datalab' ? 'b' : 'c').repeat(64);

function bus() {
    const listeners = {};
    return {
        follow(types, fn) { for (const type of types.split(',')) (listeners[type] ||= []).push(fn); },
        emit(type, data) { for (const fn of (listeners[type] || []).slice()) fn(data); }
    };
}

function tv(order) {
    let selected = 'datalab', configuredUrl, video, back;
    const requests = [], plays = [], errors = [], credentialReads = [], timers = [];
    const playerEvents = bus(), panelEvents = bus(), videoEvents = bus();
    const Lampa = {
        Player: {
            listener: playerEvents,
            play(data) {
                let aborted = false;
                playerEvents.emit('create', {data, abort() { aborted = true; }});
                if (aborted) return;
                video = {tagName: 'VIDEO', src: data.url, currentSrc: data.url, textTracks: {length: 2,
                    0: {index: 0, kind: 'subtitles', language: 'rus', mode: 'disabled', selected: false},
                    1: {index: 1, kind: 'subtitles', language: 'rus', mode: 'disabled', selected: false}}};
                plays.push({url: data.url, data});
                playerEvents.emit('ready', data);
            }
        },
        PlayerPanel: {listener: panelEvents},
        PlayerVideo: {listener: videoEvents, video: () => video},
        Torserver: {url: () => configuredUrl || providers[selected].source},
        Storage: {
            field: key => key === 'torrserver_auth',
            get(key) { credentialReads.push({selected, key}); return 'viewer-' + selected; },
            value(key) { credentialReads.push({selected, key}); return 'password-' + selected; }
        },
        Loading: {start(fn) { back = fn; }, stop() { back = null; }},
        Noty: {show(message) { errors.push(message); }}
    };
    class XHR {
        constructor() { this.headers = {}; requests.push(this); }
        open(method, url) { this.method = method; this.url = url; }
        setRequestHeader(name, value) { this.headers[name] = value; }
        send(body) { this.body = JSON.parse(body); }
        abort() { this.aborted = true; }
        reply(name) {
            this.status = 200;
            this.responseText = JSON.stringify({url: signed(name), expiresAt: 2000000000});
            this.onload();
        }
    }
    const window = {Lampa, URL, btoa, XMLHttpRequest: XHR, navigator: {userAgent: 'SmartTV VIDAA/8.0'}};
    const context = vm.createContext({window,
        setTimeout(fn, delay) { const timer = {fn, delay, cancelled: false}; timers.push(timer); return timer; },
        clearTimeout(timer) { timer.cancelled = true; }});
    function install(name) {
        vm.runInContext((name === 'datalab' ? legacy : addon)
            .replace('__TORRSERVE_SOURCE_ORIGIN_JSON__', JSON.stringify(providers[name].source))
            .replace('__TORRSERVE_TICKET_ENDPOINT_JSON__', JSON.stringify(providers[name].gateway + '/torrserve/ticket')), context);
    }
    order.forEach(install);
    return {
        requests, plays, errors, credentialReads, timers, install, playerEvents,
        get video() { return video; }, get back() { return back; },
        configure(name, url) { selected = name; configuredUrl = url; },
        play: Lampa.Player.play,
        close() { videoEvents.emit('destroy', {}); playerEvents.emit('destroy', {}); playerEvents.emit('close', {}); },
        subtitles(target) {
            for (let i = 0; i < video.textTracks.length; i++) {
                video.textTracks[i].mode = 'disabled'; video.textTracks[i].selected = false;
            }
            if (target) { target.mode = 'showing'; target.selected = true; }
            panelEvents.emit('subsview', {status: !!target});
        }
    };
}

for (const order of [['datalab', 'becor'], ['becor', 'datalab']]) {
    const label = order.join(' then ');
    test('legacy and standalone providers each sign and replay their own stream: ' + label, () => {
        const t = tv(order);
        for (const name of ['datalab', 'becor', 'datalab']) {
            t.configure(name);
            const viewed = () => {}, data = {url: stream(name), viewed, timeline: {time: 10}};
            const before = t.requests.length;
            t.play(data);
            assert.equal(t.requests.length, before + 1, name + ' must not fall through to an unauthenticated native URL');
            const req = t.requests.at(-1);
            assert.equal(req.url, providers[name].gateway + '/torrserve/ticket');
            assert.equal(req.headers.Authorization, 'Basic ' + btoa('viewer-' + name + ':password-' + name));
            req.reply(name);
            assert.equal(t.plays.at(-1).url, signed(name));
            assert.equal(t.plays.at(-1).data, data);
            assert.equal(data.viewed, viewed);
            assert.equal(data.url, stream(name), 'only the owning ready handler restores the original item URL');
            t.close();
        }
        assert.equal(t.plays.length, 3);
        assert.equal(t.credentialReads.length, 6);
        assert.deepEqual(t.errors, []);
    });

    test('reloading the same standalone origin never installs a second ticket handler: ' + label, () => {
        const t = tv(order);
        t.install('becor'); t.install('becor'); t.install('datalab');
        for (const name of ['becor', 'datalab']) {
            t.configure(name); t.play({url: stream(name)});
            t.requests.at(-1).reply(name); t.close();
        }
        assert.equal(t.requests.length, 2);
        assert.deepEqual(t.plays.map(p => p.url), [signed('becor'), signed('datalab')]);
    });

    test('only the exactly configured server may read or send its stored credentials: ' + label, () => {
        const t = tv(order);
        for (const name of ['datalab', 'becor']) {
            const other = name === 'datalab' ? 'becor' : 'datalab';
            t.configure(other); t.play({url: stream(name)}); t.close();
            t.configure(name, providers[name].source + '.foreign.example'); t.play({url: stream(name)}); t.close();
            t.configure(name); t.play({url: 'https://unrelated.example/movie.mkv'}); t.close();
        }
        assert.equal(t.requests.length, 0);
        assert.deepEqual(t.credentialReads, []);
    });

    test('Back cancels a pending retry before switching providers, including queued callbacks: ' + label, () => {
        const t = tv(order);
        for (const name of ['datalab', 'becor']) {
            t.configure(name); t.play({url: stream(name)});
            const stale = t.requests.at(-1);
            stale.onerror();
            const retry = t.timers.at(-1);
            const before = t.requests.length;
            t.back();
            assert.equal(retry.cancelled, true);
            retry.fn(); stale.reply(name); stale.ontimeout();
            assert.equal(t.requests.length, before);
            assert.equal(t.plays.length, 0);
            assert.deepEqual(t.errors, []);
        }
        t.configure('becor'); t.play({url: stream('becor')}); t.requests.at(-1).reply('becor');
        assert.deepEqual(t.plays.map(p => p.url), [signed('becor')]);
    });

    test('a new cross-origin create prevents stale replies or failures from autoplaying the old provider: ' + label, () => {
        for (const [from, to] of [['datalab', 'becor'], ['becor', 'datalab']]) {
            const t = tv(order);
            t.configure(from); t.play({url: stream(from)});
            const stale = t.requests[0];
            t.configure(to); t.play({url: stream(to)});
            assert.equal(stale.aborted, true);
            stale.reply(from); stale.onerror(); stale.ontimeout();
            assert.equal(t.requests.length, 2);
            assert.equal(t.plays.length, 0);
            t.requests[1].reply(to);
            assert.deepEqual(t.plays.map(p => p.url), [signed(to)]);
            assert.deepEqual(t.errors, []);
            t.close();
        }
    });

    test('only the active ticket owner schedules a native subtitle toggle and Off cancels it: ' + label, () => {
        const t = tv(order);
        t.install('becor');
        for (const name of ['datalab', 'becor']) {
            t.configure(name); t.play({url: stream(name)}); t.requests.at(-1).reply(name);
            const wanted = t.video.textTracks[1], before = t.timers.length;
            t.subtitles(wanted);
            assert.equal(t.timers.length, before + 1);
            const timer = t.timers.at(-1);
            assert.equal(timer.delay, 200);
            assert.equal(wanted.mode, 'disabled');
            timer.fn();
            assert.equal(wanted.mode, 'showing');
            assert.equal(t.video.textTracks[0].mode, 'disabled');
            t.subtitles(wanted);
            const cancelled = t.timers.at(-1);
            t.subtitles(null); cancelled.fn();
            assert.equal(wanted.mode, 'disabled');
            assert.equal(wanted.selected, false);
            t.close();
        }
    });
}
