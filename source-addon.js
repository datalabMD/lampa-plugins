/* Optional HDREZKA source-menu addon. Safe to fail without affecting the main plugin. */
(function () {
    'use strict';

    var scheduled = false;

    function injectStyles() {
        if (document.getElementById('rezka4-polish-style')) return;

        var style = document.createElement('style');
        style.id = 'rezka4-polish-style';
        style.textContent = [
            '.rezka4-ui{padding:1.2em 2em 2.5em!important;height:calc(100vh - 5.3em)!important;background:radial-gradient(circle at 12% 0%,rgba(53,214,111,.12),transparent 36%)!important;align-content:start}',
            '.rezka4-hero{position:relative;margin:0 0 .9em!important;padding:.85em 1.05em .95em!important;border-radius:1em;background:linear-gradient(135deg,rgba(255,255,255,.105),rgba(255,255,255,.045))!important;border:1px solid rgba(255,255,255,.11);box-shadow:0 .5em 1.5em rgba(0,0,0,.15)}',
            '.rezka4-brand{display:inline-flex!important;align-items:center!important;padding:.32em .64em!important;border-radius:999px;background:rgba(55,214,111,.13)!important;border:1px solid rgba(55,214,111,.26)!important;color:#8df0ae!important;font-size:.66em!important;letter-spacing:.15em!important}',
            '.rezka4-dot{width:.52em!important;height:.52em!important;background:#39d66f!important;box-shadow:0 0 1em rgba(57,214,111,.75)!important}',
            '.rezka4-title{font-size:1.6em!important;font-weight:750!important;line-height:1.12!important;margin-top:.46em!important;letter-spacing:-.015em}',
            '.rezka4-sub{font-size:.86em!important;opacity:.64!important;margin-top:.35em!important}',
            '.rezka4-card{position:relative!important;min-height:3.4em!important;margin:.38em 0!important;padding:.82em 1em .82em 1.15em!important;border-radius:.88em!important;background:linear-gradient(90deg,rgba(255,255,255,.085),rgba(255,255,255,.052))!important;border:1px solid rgba(255,255,255,.085)!important;box-shadow:0 .16em .6em rgba(0,0,0,.09)!important;overflow:hidden!important}',
            '.rezka4-card:before{content:"";position:absolute;left:0;top:.52em;bottom:.52em;width:.2em;border-radius:0 .2em .2em 0;background:rgba(57,214,111,.52);opacity:.7}',
            '.rezka4-card.focus{transform:scale(1.025)!important;background:linear-gradient(135deg,rgba(65,224,118,.28),rgba(255,255,255,.16))!important;border-color:rgba(128,244,166,.72)!important;box-shadow:0 .5em 1.5em rgba(0,0,0,.28),0 0 0 .12em rgba(94,230,139,.18)!important;z-index:3}',
            '.rezka4-card.focus:before{width:.3em;background:#55e687;opacity:1;box-shadow:0 0 .85em rgba(85,230,135,.75)}',
            '.rezka4-main{font-size:1.05em!important;font-weight:680!important;letter-spacing:-.01em}',
            '.rezka4-meta{font-size:.73em!important;opacity:.55!important;margin-top:.2em!important}',
            '.rezka4-badge{padding:.29em .62em!important;border-radius:999px!important;background:rgba(57,214,111,.12)!important;border:1px solid rgba(81,226,130,.28)!important;color:#a5f4be!important;font-size:.67em!important;font-weight:750!important;letter-spacing:.02em}',
            '.rezka4-card.focus .rezka4-badge{background:rgba(74,225,124,.22)!important;border-color:rgba(132,247,170,.55)!important;color:#e4ffec!important}',
            '.rezka4-ui.r4-grid{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr));gap:.72em!important;overflow-y:auto!important;padding-bottom:3em!important}',
            '.rezka4-ui.r4-grid .rezka4-hero{grid-column:1/-1;margin-bottom:.15em!important}',
            '.rezka4-ui.r4-grid .rezka4-card{margin:0!important;min-height:5.25em!important;padding:1em 1em 1em 1.15em!important;display:flex!important;flex-direction:column!important;align-items:flex-start!important;justify-content:center!important;gap:.18em!important}',
            '.rezka4-ui.r4-grid .rezka4-card>div:first-child{width:100%!important}',
            '.rezka4-ui.r4-grid .rezka4-main{font-size:1.12em!important;white-space:normal!important;line-height:1.15!important}',
            '.rezka4-ui.r4-grid .rezka4-meta{font-size:.76em!important;margin-top:.32em!important}',
            '.rezka4-ui.r4-grid .rezka4-badge{position:absolute!important;right:.7em!important;top:.65em!important;font-size:.61em!important;opacity:.72!important}',
            '.rezka4-ui.r4-grid .rezka4-card.focus{transform:scale(1.055)!important}',
            '.rezka4-ui.r4-grid .rezka4-back{grid-column:1/-1!important;min-height:2.75em!important;max-width:18em!important;display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:space-between!important;padding:.62em .9em .62em 1.05em!important}',
            '.rezka4-ui.r4-grid .rezka4-back .rezka4-main{font-size:.9em!important}',
            '.rezka4-ui.r4-grid .rezka4-back .rezka4-meta{display:none!important}',
            '.rezka4-ui.r4-grid .rezka4-back .rezka4-badge{position:static!important}',
            '.rezka4-ui.r4-episodes{grid-template-columns:repeat(5,minmax(0,1fr))}',
            '.rezka4-ui.r4-episodes .rezka4-card:not(.rezka4-back){min-height:4.7em!important}',
            '.rezka4-ui.r4-episodes .rezka4-card:not(.rezka4-back) .rezka4-badge{display:none!important}',
            '.rezka4-ui.r4-episodes .rezka4-card:not(.rezka4-back) .rezka4-main{font-size:1.03em!important}',
            '.rezka4-ui.r4-voices .rezka4-card{max-width:none!important}',
            '.rezka4-ui.r4-quality .rezka4-card{max-width:46em!important}',
            '.rezka4-back{background:rgba(255,255,255,.035)!important;border-color:rgba(255,255,255,.075)!important;opacity:.82}',
            '.rezka4-back:before{background:rgba(255,255,255,.24)!important;box-shadow:none!important}',
            '.rezka4-back .rezka4-badge{background:rgba(255,255,255,.055)!important;border-color:rgba(255,255,255,.12)!important;color:rgba(255,255,255,.72)!important}',
            '.rezka4-back.focus{opacity:1;background:rgba(255,255,255,.14)!important;border-color:rgba(255,255,255,.34)!important}',
            '.rezka4-loading,.rezka4-empty{grid-column:1/-1;margin-top:.45em!important;padding:1.05em 1.15em!important;border-radius:.9em!important;background:rgba(255,255,255,.07)!important;border:1px solid rgba(255,255,255,.075)!important}',
            '.rezka4-spinner{border-color:rgba(255,255,255,.18)!important;border-top-color:#60e88e!important}',
            '.buttons--container .view--rezka4 svg{filter:drop-shadow(0 0 .3em rgba(57,214,111,.28))}',
            '.buttons--container .view--rezka4[data-subtitle="HDREZKA"]{--rezka-accent:#39d66f}',
            '@media (max-width:1100px){.rezka4-ui.r4-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.rezka4-ui.r4-episodes{grid-template-columns:repeat(4,minmax(0,1fr))}}'
        ].join('');
        document.head.appendChild(style);
    }

    function decorateRezkaUI() {
        try {
            if (typeof window.$ !== 'function') return;
            $('.rezka4-ui').each(function () {
                var ui = $(this);
                var sub = String(ui.find('.rezka4-sub').first().text() || '').toLowerCase();
                ui.removeClass('r4-grid r4-seasons r4-episodes r4-voices r4-quality');
                if (sub.indexOf('сезон') !== -1) ui.addClass('r4-grid r4-seasons');
                else if (sub.indexOf('сери') !== -1) ui.addClass('r4-grid r4-episodes');
                else if (sub.indexOf('перевод') !== -1 || sub.indexOf('озвуч') !== -1) ui.addClass('r4-voices');
                else if (sub.indexOf('качеств') !== -1) ui.addClass('r4-quality');
            });
        } catch (e) {
            console.log('REZKA4 decorate error', e);
        }
    }

    function hasGridLeftNeighbor(ui, focused) {
        try {
            if (!ui || !focused) return false;
            var a = focused.getBoundingClientRect();
            var cy = a.top + a.height / 2;
            var nodes = ui.querySelectorAll('.selector');
            for (var i = 0; i < nodes.length; i++) {
                var n = nodes[i];
                if (n === focused || n.classList.contains('rezka4-back')) continue;
                var b = n.getBoundingClientRect();
                var by = b.top + b.height / 2;
                var sameRow = Math.abs(by - cy) < Math.max(a.height, b.height) * 0.55;
                if (sameRow && b.right <= a.left + 8) return true;
            }
        } catch (e) {}
        return false;
    }

    function installGridLeftGuard() {
        if (window.rezka4_grid_left_guard) return;
        window.rezka4_grid_left_guard = true;
        document.addEventListener('keydown', function (e) {
            var key = e.key || '';
            var code = e.keyCode || e.which;
            if (!(key === 'ArrowLeft' || code === 37)) return;
            var ui = document.querySelector('.rezka4-ui.r4-grid');
            if (!ui) return;
            var focused = ui.querySelector('.selector.focus');
            if (!focused) return;
            if (!hasGridLeftNeighbor(ui, focused)) return;
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            try { Navigator.move('left'); } catch (x) {}
        }, true);
    }

    function moveButtons() {
        try {
            if (typeof window.$ !== 'function') return;
            $('.full-start-new, .full-start').each(function () {
                var root = $(this);
                var hidden = root.find('.buttons--container').first();
                if (!hidden.length) return;
                var rezka = root.find('.full-start-new__buttons .view--rezka4, .full-start__buttons .view--rezka4, .buttons--container .view--rezka4').first();
                if (!rezka.length) return;
                if (!rezka.find('svg').length) rezka.prepend('<svg><use xlink:href="#sprite-play"></use></svg>');
                rezka.attr('data-subtitle', 'HDREZKA');
                var first = hidden.children().first();
                var alreadyFirst = first.length && first[0] === rezka[0] && rezka.parent()[0] === hidden[0];
                if (!alreadyFirst) rezka.prependTo(hidden);
            });
        } catch (e) {
            console.log('REZKA4 source addon move error', e);
        }
    }

    function refreshUI() {
        decorateRezkaUI();
        moveButtons();
    }

    function scheduleMove() {
        if (scheduled) return;
        scheduled = true;
        setTimeout(function () {
            scheduled = false;
            refreshUI();
        }, 20);
    }

    function install() {
        try {
            injectStyles();
            installGridLeftGuard();
            refreshUI();
            if (typeof MutationObserver !== 'undefined' && document && document.body) {
                var observer = new MutationObserver(function () { scheduleMove(); });
                observer.observe(document.body, { childList: true, subtree: true });
                window.rezka4_source_observer = observer;
            }
            if (typeof Lampa !== 'undefined' && Lampa.Listener) {
                Lampa.Listener.follow('full', function () {
                    scheduleMove();
                    setTimeout(scheduleMove, 100);
                });
            }
        } catch (e) {
            console.log('REZKA4 source addon error', e);
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
})();
