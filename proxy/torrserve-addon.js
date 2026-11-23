;(function () {
    'use strict';

    var sourceOrigin = __TORRSERVE_SOURCE_ORIGIN_JSON__;
    var ticketEndpoint = __TORRSERVE_TICKET_ENDPOINT_JSON__;
    var playbackPrefix = ticketEndpoint.slice(0, ticketEndpoint.lastIndexOf('/') + 1) + 'play/';

    function isTorrServeStream(url) {
        if (typeof url !== 'string' || url.indexOf(sourceOrigin + '/stream/') !== 0) return false;
        try {
            var parsed;
            if (typeof window.URL === 'function') parsed = new window.URL(url);
            else {
                parsed = document.createElement('a');
                parsed.href = url;
            }
            return parsed.protocol + '//' + parsed.host === sourceOrigin &&
                parsed.pathname.indexOf('/stream/') === 0 && !parsed.hash;
        } catch (e) {
            return false;
        }
    }

    function validTicket(reply) {
        // The gateway enforces expiry using its own clock.
        return reply && typeof reply.url === 'string' && reply.url.indexOf(playbackPrefix) === 0 &&
            /^[a-f0-9]{64}$/.test(reply.url.slice(playbackPrefix.length)) &&
            typeof reply.expiresAt === 'number' && isFinite(reply.expiresAt) &&
            reply.expiresAt === Math.floor(reply.expiresAt) && reply.expiresAt > 0;
    }

    function install() {
        var app = window.Lampa;
        if (!app || !app.Player || !app.Player.listener) return setTimeout(install, 200);
        if (window.datalabTorrServePlayerInstalled) return;
        window.datalabTorrServePlayerInstalled = true;

        var pending = null, active = null, replaying = null;
        var subtitleTimer = null, subtitleGeneration = 0;

        function cancelSubtitles() {
            subtitleGeneration++;
            if (subtitleTimer !== null) {
                try { clearTimeout(subtitleTimer); } catch (e) {}
                subtitleTimer = null;
            }
        }

        function selectedNativeSubtitle(job, video) {
            if (!job || active !== job || !video || app.PlayerVideo.video() !== video ||
                video.tagName !== 'VIDEO' || video.customSubs || video.webos_subs || video.destroy) return null;
            function owns(url) {
                return job.urls.some(function (original) { return job.tickets[original] === url; });
            }
            // During source loading, keep stock selection instead of disabling a track we may lose.
            if (!video.currentSrc || video.currentSrc !== video.src || !owns(video.src)) return null;
            var tracks = video.textTracks, selected = null;
            if (!tracks) return null;
            for (var i = 0; i < tracks.length; i++) {
                if (tracks[i].selected === true) {
                    if (selected) return null;
                    selected = tracks[i];
                }
            }
            return selected && !selected.onSelect &&
                (selected.kind === 'subtitles' || selected.kind === 'captions') ? selected : null;
        }

        function nativeSubtitleSelected() {
            cancelSubtitles();
            var generation = subtitleGeneration, job = active, video, selected, src, currentSrc;
            function enableCurrent() {
                if (generation === subtitleGeneration && selected && video.src === src &&
                    video.currentSrc === currentSrc && selectedNativeSubtitle(job, video) === selected &&
                    selected.mode !== 'showing') {
                    selected.mode = 'showing';
                }
            }
            try {
                video = app.PlayerVideo.video();
                selected = selectedNativeSubtitle(job, video);
                if (!selected || selected.mode !== 'showing') return;
                src = video.src;
                currentSrc = video.currentSrc;
                // VIDAA workaround: emulate the user's working Off -> On sequence once.
                // 200ms is a bounded off interval, not a guaranteed firmware timing requirement.
                selected.mode = 'disabled';
                subtitleTimer = setTimeout(function () {
                    if (generation !== subtitleGeneration) return;
                    subtitleTimer = null;
                    try { enableCurrent(); }
                    catch (e) { try { enableCurrent(); } catch (ignored) {} }
                }, 200);
            } catch (e) {
                // A failed setter/timer must not strand the still-current choice in Off.
                try { enableCurrent(); } catch (ignored) {}
            }
        }

        try {
            var ua = window.navigator && window.navigator.userAgent || '';
            if (/\bVIDAA\b/i.test(ua) && !/Android|Roku|CrKey|lampa_client/i.test(ua) &&
                app.PlayerPanel && app.PlayerPanel.listener && app.PlayerVideo &&
                typeof app.PlayerVideo.video === 'function' && app.PlayerVideo.listener) {
                app.PlayerPanel.listener.follow('subsview', nativeSubtitleSelected);
                app.PlayerVideo.listener.follow('destroy', cancelSubtitles);
            }
        } catch (e) {}

        function cancel() {
            cancelSubtitles();
            if (!pending) return;
            var job = pending;
            pending = null;
            if (job.retryTimer !== null) {
                clearTimeout(job.retryTimer);
                job.retryTimer = null;
            }
            var xhr = job.xhr;
            job.xhr = null;
            if (xhr) xhr.abort();
            app.Loading.stop();
        }

        // The stock player compares playlist items by their original URL. Restore it
        // once video.src is set. Keep signed quality choices until playback ends.
        function restoreUrl(job) {
            job.urls.forEach(function (url) {
                if (job.data.url === job.tickets[url]) job.data.url = url;
            });
        }

        function release() {
            cancelSubtitles();
            if (!active) return;
            restoreUrl(active);
            if (active.variants && active.data.quality === active.variants) active.data.quality = active.quality;
            active = null;
        }

        function fail(job, message) {
            if (pending !== job) return;
            cancel();
            app.Noty.show(message);
        }

        function replay(job) {
            var data = job.data;
            if (job.quality) {
                // Player.play can replace data.url from the quality selector before
                // setting video.src. Preserve its metadata and sign each direct file.
                job.variants = {};
                Object.keys(job.quality).forEach(function (key) {
                    var item = job.quality[key];
                    var signed = job.tickets[typeof item === 'string' ? item : item && item.url];
                    if (signed && typeof item === 'object') {
                        var copy = {};
                        Object.keys(item).forEach(function (name) { copy[name] = item[name]; });
                        copy.url = signed;
                        job.variants[key] = copy;
                    } else job.variants[key] = signed || item;
                });
                data.quality = job.variants;
            }
            data.url = job.tickets[job.urls[0]];
            pending = null;
            app.Loading.stop();
            active = job;
            replaying = data;
            try { app.Player.play(data); }
            finally { replaying = null; }
        }

        function request(job, index, authorization, isRetry) {
            if (pending !== job) return;
            if (index === job.urls.length) return replay(job);
            try {
                sendTicket(job, index, authorization, isRetry);
            } catch (e) {
                fail(job, 'TorrServe: не удалось запросить ссылку для воспроизведения.');
            }
        }

        function sendTicket(job, index, authorization, isRetry) {
            var xhr = new window.XMLHttpRequest();
            job.xhr = xhr;
            xhr.open('POST', ticketEndpoint, true);
            xhr.timeout = 12000;
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', authorization);
            xhr.onload = function () {
                if (pending !== job || job.xhr !== xhr) return;
                job.xhr = null;
                var reply;
                if (xhr.status === 200) {
                    try { reply = JSON.parse(xhr.responseText); } catch (e) {}
                }
                if (!validTicket(reply)) {
                    fail(job, xhr.status === 401 ? 'TorrServe: проверьте логин и пароль.' :
                        'TorrServe: не удалось получить ссылку для воспроизведения.');
                    return;
                }
                job.tickets[job.urls[index]] = reply.url;
                request(job, index + 1, authorization);
            };
            function transportFailed(message) {
                if (pending !== job || job.xhr !== xhr) return;
                job.xhr = null;
                if (isRetry) return fail(job, message);
                var timer = setTimeout(function () {
                    if (pending !== job || job.retryTimer !== timer) return;
                    job.retryTimer = null;
                    request(job, index, authorization, true);
                }, 750);
                job.retryTimer = timer;
            }
            xhr.onerror = function () {
                transportFailed('TorrServe: ошибка сети при получении ссылки (2 попытки).');
            };
            xhr.ontimeout = function () {
                transportFailed('TorrServe: истекло время ожидания ссылки (2 попытки).');
            };
            xhr.send(JSON.stringify({url: job.urls[index]}));
        }

        app.Player.listener.follow('create', function (event) {
            cancelSubtitles();
            var data = event.data;
            if (replaying && replaying === data) {
                replaying = null;
                return;
            }
            cancel();
            release();
            if (!data || !isTorrServeStream(data.url) || typeof event.abort !== 'function') return;
            // Lampa stores a single login for its selected TorrServer. A URL
            // supplied by another plugin must never borrow an unrelated login.
            if (!app.Torserver || typeof app.Torserver.url !== 'function' ||
                String(app.Torserver.url()).replace(/\/+$/, '') !== sourceOrigin ||
                !app.Storage.field('torrserver_auth')) return;
            event.abort();
            var job = {data: data, urls: [data.url], tickets: Object.create(null), quality: data.quality, retryTimer: null};
            if (job.quality && typeof job.quality === 'object') {
                Object.keys(job.quality).forEach(function (key) {
                    var item = job.quality[key];
                    var url = typeof item === 'string' ? item : item && item.url;
                    if (isTorrServeStream(url) && job.urls.indexOf(url) === -1) job.urls.push(url);
                });
            }
            pending = job;
            app.Loading.start(function () { if (pending === job) cancel(); }, 'TorrServe: открываем видео');
            try {
                var login = app.Storage.get('torrserver_login');
                // Storage.get converts all-digit strings to integers, losing leading zeros.
                var password = app.Storage.value('torrserver_password');
                if (!login || !password) return fail(job, 'TorrServe: укажите логин и пароль в настройках Lampa.');
                request(job, 0, 'Basic ' + window.btoa(login + ':' + password));
            } catch (e) {
                fail(job, 'TorrServe: не удалось запросить ссылку для воспроизведения.');
            }
        });

        app.Player.listener.follow('ready', function (data) {
            if (active && active.data === data) restoreUrl(active);
        });
        function close() { cancel(); release(); }
        app.Player.listener.follow('close', close);
        app.Player.listener.follow('destroy', close);
    }

    install();
})();
