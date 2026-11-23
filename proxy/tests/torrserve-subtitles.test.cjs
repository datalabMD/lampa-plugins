const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = 'https://torrent.example';
const endpoint = 'https://player.example/torrserve/ticket';
const original = source + '/stream/movie.mkv?link=' + 'a'.repeat(40) + '&index=1&play';
const ticket = 'https://player.example/torrserve/play/' + 'b'.repeat(64);
const otherTicket = 'https://player.example/torrserve/play/' + 'c'.repeat(64);
const vidaa = 'Mozilla/5.0 (SmartTV; Linux) AppleWebKit/537.36 VIDAA/8.0';
const script = fs.readFileSync(path.join(__dirname, '../torrserve-addon.js'), 'utf8')
    .replace('__TORRSERVE_SOURCE_ORIGIN_JSON__', JSON.stringify(source))
    .replace('__TORRSERVE_TICKET_ENDPOINT_JSON__', JSON.stringify(endpoint));

function bus() {
    const handlers = {};
    return {
        follow(types, fn) { for (const type of types.split(',')) (handlers[type] ||= []).push(fn); },
        emit(type, data) { for (const fn of (handlers[type] || []).slice()) fn(data); }
    };
}

function clock() {
    let now = 0, serial = 0;
    const tasks = new Map();
    return {
        failNext: false,
        setTimeout(fn, ms) {
            if (this.failNext) { this.failNext = false; throw new Error('timer unavailable'); }
            const id = ++serial;
            tasks.set(id, {fn, at: now + ms});
            return id;
        },
        clearTimeout(id) { tasks.delete(id); },
        advance(ms) {
            const end = now + ms;
            for (;;) {
                const task = [...tasks].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
                if (!task) break;
                tasks.delete(task[0]);
                now = task[1].at;
                task[1].fn();
            }
            now = end;
        },
        queued() { return [...tasks.values()].map(t => t.fn); }
    };
}

function nativeVideo() {
    const textTracks = {length: 11};
    for (let i = 0; i < textTracks.length; i++) {
        let mode = 'disabled';
        const writes = [];
        textTracks[i] = {
            id: String(i), index: i, kind: 'subtitles', language: i < 7 ? 'rus' : i < 9 ? 'ukr' : 'eng',
            label: i < 7 ? 'Russian' : 'Other', selected: false, cues: [], activeCues: [], writes,
            get mode() { return mode; },
            set mode(value) { mode = value; writes.push(value); }
        };
    }
    const video = {tagName: 'VIDEO', textTracks, currentSrc: '', srcWrites: [], timeWrites: []};
    let src = '', currentTime = 100;
    Object.defineProperties(video, {
        src: {get() { return src; }, set(value) { src = value; video.srcWrites.push(value); }, configurable: true},
        currentTime: {get() { return currentTime; }, set(value) { currentTime = value; video.timeWrites.push(value); }}
    });
    return video;
}

// Browser/TV APIs are boundaries; the complete production addon runs in the VM.
// select() applies the stock Lampa panel's synchronous mode/selected changes
// before emitting subsview, as in yumata/lampa-source panel/option.js:200-213.
function tv(options = {}) {
    const timer = clock(), requests = [], playerEvents = bus(), panelEvents = bus(), videoEvents = bus();
    let video, loadingBack;
    const player = {
        listener: playerEvents,
        play(data) {
            let aborted = false;
            playerEvents.emit('create', {data, abort() { aborted = true; }});
            if (aborted) return;
            video = nativeVideo();
            video.src = video.currentSrc = data.url;
            playerEvents.emit('ready', data);
        }
    };
    const Lampa = {
        Player: player, PlayerPanel: {listener: panelEvents},
        PlayerVideo: {listener: videoEvents, video: () => video},
        Torserver: {url: () => source},
        Storage: {field: () => true, get: () => 'viewer', value: () => 'test-password'},
        Loading: {start(fn) { loadingBack = fn; }, stop() {}}, Noty: {show() {}}
    };
    class XHR {
        constructor() { requests.push(this); }
        open() {}
        setRequestHeader() {}
        send() {}
        abort() {}
        reply(url) {
            this.status = 200;
            this.responseText = JSON.stringify({url, expiresAt: 2000000000});
            this.onload();
        }
    }
    const navigator = {userAgent: options.ua === undefined ? vidaa : options.ua};
    const window = {Lampa, navigator, URL, XMLHttpRequest: XHR, btoa};
    const context = {window, navigator,
        setTimeout: options.realTimers ? setTimeout : timer.setTimeout.bind(timer),
        clearTimeout: options.realTimers ? clearTimeout : timer.clearTimeout.bind(timer)};
    vm.runInNewContext(script, context);
    return {
        timer, requests, playerEvents, panelEvents, videoEvents, Lampa,
        get video() { return video; },
        open(url = original, signed = ticket) {
            player.play({url});
            requests.at(-1).reply(signed);
            return video;
        },
        play: player.play,
        back() { loadingBack(); },
        select(target, beforeEvent = () => {}) {
            for (let i = 0; i < video.textTracks.length; i++) {
                video.textTracks[i].mode = 'disabled';
                video.textTracks[i].selected = false;
            }
            if (target) { target.mode = 'showing'; target.selected = true; }
            beforeEvent();
            panelEvents.emit('subsview', {status: !!target && target.index > -1});
        }
    };
}

test('VIDAA selection leaves an asynchronous off interval, then enables the same Russian track only once', () => {
    const t = tv(), video = t.open(), wanted = video.textTracks[1];
    t.select(wanted);
    assert.equal(wanted.mode, 'disabled', 'native off/on must not be coalesced in the selection task');
    t.timer.advance(199);
    assert.equal(wanted.mode, 'disabled');
    t.timer.advance(1);
    assert.equal(wanted.mode, 'showing');
    assert.equal(video.textTracks[0].mode, 'disabled', 'same language/label must not select the first Russian track');
    const writes = wanted.writes.slice();
    t.timer.advance(1000);
    assert.deepEqual(wanted.writes, writes, 'the workaround must not poll or retry');
    assert.deepEqual(video.srcWrites, [ticket]);
    assert.deepEqual(video.timeWrites, []);
    assert.equal(t.requests.length, 1, 'subtitle selection must not request another ticket or stream');
});

test('a newer selection wins even if the cancelled callback was already queued', () => {
    const t = tv(), video = t.open(), first = video.textTracks[0], second = video.textTracks[1];
    t.select(first);
    assert.equal(first.mode, 'disabled');
    const queued = t.timer.queued();
    t.timer.advance(100);
    t.select(second);
    for (const fn of queued) fn();
    t.timer.advance(100);
    assert.equal(second.mode, 'disabled', 'an old callback must not shorten the new off interval');
    t.timer.advance(100);
    assert.equal(first.mode, 'disabled');
    assert.equal(second.mode, 'showing');
});

test('Off remains off after a pending or already queued enable', () => {
    const t = tv(), video = t.open(), wanted = video.textTracks[0];
    t.select(wanted);
    assert.equal(wanted.mode, 'disabled');
    const queued = t.timer.queued();
    t.select(null);
    for (const fn of queued) fn();
    t.timer.advance(1000);
    for (let i = 0; i < video.textTracks.length; i++) {
        assert.equal(video.textTracks[i].mode, 'disabled');
        assert.equal(video.textTracks[i].selected, false);
    }
});

test('player and video lifecycles cancel pending activation without reactivating the old film', () => {
    for (const event of ['close', 'destroy', 'videoDestroy', 'newFile', 'foreignCreate', 'cancel']) {
        const t = tv(), oldVideo = t.open(), wanted = oldVideo.textTracks[0];
        t.select(wanted);
        assert.equal(wanted.mode, 'disabled', event);
        const queued = t.timer.queued();
        if (event === 'videoDestroy') t.videoEvents.emit('destroy', {savemeta: true});
        else if (event === 'newFile') t.open(original.replace('index=1', 'index=2'), otherTicket);
        else if (event === 'foreignCreate') t.play({url: 'https://elsewhere.example/movie.mkv'});
        else if (event === 'cancel') { t.play({url: original}); t.back(); }
        else t.playerEvents.emit(event, {});
        for (const fn of queued) fn();
        t.timer.advance(1000);
        assert.equal(wanted.mode, 'disabled', event);
        if (t.video !== oldVideo) assert.equal(t.video.textTracks[0].mode, 'disabled', event);
    }
});

test('only a standalone VIDAA marker without another device platform enables the workaround', () => {
    for (const ua of ['', 'Mozilla/5.0 Chrome/120', 'Hisense SmartTV', 'NotVIDAA',
        vidaa + ' Android', vidaa + ' Roku', vidaa + ' CrKey', vidaa + ' lampa_client']) {
        const t = tv({ua}), video = t.open(), wanted = video.textTracks[0];
        t.select(wanted);
        assert.equal(wanted.mode, 'showing', ua);
        t.timer.advance(1000);
        assert.deepEqual(wanted.writes, ['disabled', 'showing'], ua);
    }
    const t = tv({ua: 'SmartTV vidaa/7.6'}), video = t.open();
    t.select(video.textTracks[0]);
    assert.equal(video.textTracks[0].mode, 'disabled');
    t.timer.advance(200);
    assert.equal(video.textTracks[0].mode, 'showing');
});

test('custom subtitles, adapters, synthetic tracks and non-caption kinds keep their original behavior', () => {
    for (const change of [
        video => { video.customSubs = []; },
        video => { video.webos_subs = []; },
        video => { video.destroy = () => {}; },
        video => { video.tagName = 'OBJECT'; },
        video => { video.textTracks[0].onSelect = () => {}; },
        video => { video.textTracks[0].kind = 'metadata'; }
    ]) {
        const t = tv(), video = t.open(), wanted = video.textTracks[0];
        change(video);
        t.select(wanted);
        assert.equal(wanted.mode, 'showing');
        t.timer.advance(1000);
        assert.deepEqual(wanted.writes, ['disabled', 'showing']);
    }
});

test('both actual media URLs must belong to this active playback job, not just the gateway prefix', () => {
    for (const change of [
        video => { video.src = video.currentSrc = otherTicket; },
        video => { video.src = otherTicket; },
        video => { video.currentSrc = otherTicket; },
        video => { video.src = video.currentSrc = original; }
    ]) {
        const t = tv(), video = t.open(), wanted = video.textTracks[0];
        change(video);
        t.select(wanted);
        assert.equal(wanted.mode, 'showing');
        t.timer.advance(1000);
        assert.deepEqual(wanted.writes, ['disabled', 'showing']);
    }
    const t = tv();
    t.open();
    const video = t.open(original.replace('index=1', 'index=2'), otherTicket);
    video.src = video.currentSrc = ticket; // A valid ticket from the previous job is still out of scope.
    t.select(video.textTracks[0]);
    assert.equal(video.textTracks[0].mode, 'showing');
});

test('an empty currentSrc settling to the ticket preserves the stock selected track', () => {
    const t = tv(), video = t.open(), wanted = video.textTracks[0];
    video.currentSrc = '';
    t.select(wanted);
    t.timer.advance(100);
    video.currentSrc = ticket;
    t.timer.advance(200);
    assert.equal(wanted.selected, true);
    assert.equal(wanted.mode, 'showing', 'metadata settling must not strand the selected track in Off');
    assert.deepEqual(wanted.writes, ['disabled', 'showing'], 'an unsettled source must keep stock behavior');
});

test('switching between two tickets of the same job preserves stock selection until sources agree', () => {
    const t = tv(), second = original.replace('index=1', 'index=2');
    t.play({url: original, quality: {first: original, second}});
    t.requests[0].reply(ticket);
    t.requests[1].reply(otherTicket);
    const video = t.video, wanted = video.textTracks[0];
    video.src = otherTicket; // Both are minted for this job, but the media source is still changing.
    video.currentSrc = ticket;
    t.select(wanted);
    t.timer.advance(100);
    video.currentSrc = otherTicket;
    t.timer.advance(200);
    assert.equal(wanted.mode, 'showing');
    assert.deepEqual(wanted.writes, ['disabled', 'showing']);
});

test('a delayed activation rechecks source, video, native list membership and the unique current choice', () => {
    for (const change of [
        (t, video) => { video.src = otherTicket; },
        (t, video) => { video.currentSrc = otherTicket; },
        (t, video) => { video.customSubs = []; },
        (t, video) => { video.textTracks[0].selected = false; },
        (t, video) => { video.textTracks[1].selected = true; },
        (t, video) => { video.textTracks[0] = nativeVideo().textTracks[0]; video.textTracks[0].selected = true; },
        t => { t.Lampa.PlayerVideo.video = () => nativeVideo(); }
    ]) {
        const t = tv(), video = t.open(), wanted = video.textTracks[0];
        t.select(wanted);
        assert.equal(wanted.mode, 'disabled');
        change(t, video);
        t.timer.advance(200);
        assert.equal(wanted.mode, 'disabled', 'stale native objects must never be re-enabled');
    }
});

test('native track objects need no nonstandard index and captions are also supported', () => {
    const t = tv(), video = t.open(), wanted = video.textTracks[3];
    delete wanted.index;
    wanted.kind = 'captions';
    t.select(wanted); // Stock Lampa emits status:false when a native TextTrack has no index.
    assert.equal(wanted.mode, 'disabled');
    t.timer.advance(200);
    assert.equal(wanted.mode, 'showing');
});

test('multiple selected native tracks are ambiguous and are left alone', () => {
    const t = tv(), video = t.open(), wanted = video.textTracks[0];
    t.select(wanted, () => { video.textTracks[1].selected = true; });
    assert.equal(wanted.mode, 'showing');
    t.timer.advance(1000);
    assert.deepEqual(wanted.writes, ['disabled', 'showing']);
});

test('unsupported media getters cannot throw through the panel listeners', () => {
    for (const property of ['src', 'currentSrc', 'customSubs', 'textTracks']) {
        const t = tv(), video = t.open(), wanted = video.textTracks[0];
        let laterListener = false;
        t.panelEvents.follow('subsview', () => { laterListener = true; });
        assert.doesNotThrow(() => t.select(wanted, () => {
            Object.defineProperty(video, property, {get() { throw new Error('unsupported getter'); }});
        }));
        assert.equal(laterListener, true, property);
        assert.equal(wanted.mode, 'showing', property);
    }
});

test('a failed timer or partially failing disable restores the current user choice safely', () => {
    for (const fault of ['timer', 'disable']) {
        const t = tv(), video = t.open(), wanted = video.textTracks[0];
        let laterListener = false;
        t.panelEvents.follow('subsview', () => { laterListener = true; });
        assert.doesNotThrow(() => t.select(wanted, () => {
            if (fault === 'timer') t.timer.failNext = true;
            else {
                const mode = Object.getOwnPropertyDescriptor(wanted, 'mode');
                Object.defineProperty(wanted, 'mode', {...mode, set(value) {
                    mode.set(value);
                    if (value === 'disabled') throw new Error('disable failed after applying');
                }});
            }
        }));
        assert.equal(laterListener, true, fault);
        assert.equal(wanted.mode, 'showing', fault);
        t.timer.advance(1000);
        assert.equal(wanted.mode, 'showing', fault);
    }
});

test('a delayed setter that applies before throwing is not applied twice', () => {
    const t = tv(), video = t.open(), wanted = video.textTracks[0];
    t.select(wanted);
    assert.equal(wanted.mode, 'disabled');
    const mode = Object.getOwnPropertyDescriptor(wanted, 'mode'), enables = [];
    Object.defineProperty(wanted, 'mode', {...mode, set(value) {
        mode.set(value);
        if (value === 'showing') { enables.push(value); throw new Error('applied before native failure'); }
    }});
    assert.doesNotThrow(() => t.timer.advance(200));
    assert.equal(wanted.mode, 'showing');
    assert.deepEqual(enables, ['showing']);
});

test('the real event loop observes Off before the bounded activation without restarting playback', async () => {
    const t = tv({realTimers: true}), video = t.open(), wanted = video.textTracks[0];
    try {
        t.select(wanted);
        assert.equal(wanted.mode, 'disabled');
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(wanted.mode, 'disabled', 'the next task must still observe Off');
        await new Promise(resolve => setTimeout(resolve, 230));
        assert.equal(wanted.mode, 'showing');
        assert.deepEqual(video.srcWrites, [ticket]);
        assert.deepEqual(video.timeWrites, []);
        assert.equal(t.requests.length, 1);
    } finally {
        t.playerEvents.emit('close', {});
    }
});
