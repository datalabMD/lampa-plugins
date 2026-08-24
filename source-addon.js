/* Optional HDREZKA source-menu addon. Safe to fail without affecting the main plugin. */
(function () {
    'use strict';

    var scheduled = false;

    function injectStyles() {
        if (document.getElementById('rezka4-polish-style')) return;

        var style = document.createElement('style');
        style.id = 'rezka4-polish-style';
        style.textContent = [
            '.rezka4-ui{padding:1.35em 2em 2.5em!important;height:calc(100vh - 5.3em)!important;background:radial-gradient(circle at 12% 0%,rgba(53,214,111,.11),transparent 34%)!important}',
            '.rezka4-hero{position:relative;margin:0 0 1.05em!important;padding:1.05em 1.2em 1.1em!important;border-radius:1em;background:linear-gradient(135deg,rgba(255,255,255,.105),rgba(255,255,255,.045))!important;border:1px solid rgba(255,255,255,.11);box-shadow:0 .6em 1.8em rgba(0,0,0,.16)}',
            '.rezka4-brand{display:inline-flex!important;align-items:center!important;padding:.38em .7em!important;border-radius:999px;background:rgba(55,214,111,.13)!important;border:1px solid rgba(55,214,111,.26)!important;color:#8df0ae!important;font-size:.68em!important;letter-spacing:.16em!important}',
            '.rezka4-dot{width:.55em!important;height:.55em!important;background:#39d66f!important;box-shadow:0 0 1em rgba(57,214,111,.75)!important}',
            '.rezka4-title{font-size:1.65em!important;font-weight:750!important;line-height:1.12!important;margin-top:.5em!important;letter-spacing:-.015em}',
            '.rezka4-sub{font-size:.87em!important;opacity:.64!important;margin-top:.42em!important}',
            '.rezka4-card{position:relative!important;min-height:3.45em!important;margin:.42em 0!important;padding:.86em 1.05em .86em 1.2em!important;border-radius:.9em!important;background:linear-gradient(90deg,rgba(255,255,255,.085),rgba(255,255,255,.052))!important;border:1px solid rgba(255,255,255,.085)!important;box-shadow:0 .18em .65em rgba(0,0,0,.09)!important;overflow:hidden!important}',
            '.rezka4-card:before{content:"";position:absolute;left:0;top:.55em;bottom:.55em;width:.2em;border-radius:0 .2em .2em 0;background:rgba(57,214,111,.52);opacity:.7}',
            '.rezka4-card.focus{transform:scale(1.018)!important;background:linear-gradient(90deg,rgba(57,214,111,.22),rgba(255,255,255,.14))!important;border-color:rgba(118,239,157,.62)!important;box-shadow:0 .45em 1.35em rgba(0,0,0,.25),0 0 0 .11em rgba(94,230,139,.16)!important}',
            '.rezka4-card.focus:before{width:.3em;background:#55e687;opacity:1;box-shadow:0 0 .85em rgba(85,230,135,.75)}',
            '.rezka4-main{font-size:1.08em!important;font-weight:650!important;letter-spacing:-.01em}',
            '.rezka4-meta{font-size:.75em!important;opacity:.55!important;margin-top:.23em!important}',
            '.rezka4-badge{padding:.31em .68em!important;border-radius:999px!important;background:rgba(57,214,111,.12)!important;border:1px solid rgba(81,226,130,.28)!important;color:#a5f4be!important;font-size:.7em!important;font-weight:750!important;letter-spacing:.02em}',
            '.rezka4-card.focus .rezka4-badge{background:rgba(74,225,124,.2)!important;border-color:rgba(117,239,158,.48)!important;color:#d8ffe5!important}',
            '.rezka4-back{background:rgba(255,255,255,.035)!important;border-style:solid!important;border-color:rgba(255,255,255,.065)!important;opacity:.82}',
            '.rezka4-back:before{background:rgba(255,255,255,.24)!important;box-shadow:none!important}',
            '.rezka4-back .rezka4-badge{background:rgba(255,255,255,.055)!important;border-color:rgba(255,255,255,.12)!important;color:rgba(255,255,255,.72)!important}',
            '.rezka4-back.focus{opacity:1;background:rgba(255,255,255,.13)!important;border-color:rgba(255,255,255,.3)!important}',
            '.rezka4-loading,.rezka4-empty{margin-top:.55em!important;padding:1.15em 1.2em!important;border-radius:.9em!important;background:rgba(255,255,255,.07)!important;border:1px solid rgba(255,255,255,.075)!important}',
            '.rezka4-spinner{border-color:rgba(255,255,255,.18)!important;border-top-color:#60e88e!important}',
            '.buttons--container .view--rezka4 svg{filter:drop-shadow(0 0 .3em rgba(57,214,111,.28))}',
            '.buttons--container .view--rezka4[data-subtitle="HDREZKA"]{--rezka-accent:#39d66f}'
        ].join('');
        document.head.appendChild(style);
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

                if (!rezka.find('svg').length) {
                    rezka.prepend('<svg><use xlink:href="#sprite-play"></use></svg>');
                }

                rezka.attr('data-subtitle', 'HDREZKA');

                var first = hidden.children().first();
                var alreadyFirst = first.length && first[0] === rezka[0] && rezka.parent()[0] === hidden[0];
                if (!alreadyFirst) rezka.prependTo(hidden);
            });
        } catch (e) {
            console.log('REZKA4 source addon move error', e);
        }
    }

    function scheduleMove() {
        if (scheduled) return;
        scheduled = true;
        setTimeout(function () {
            scheduled = false;
            moveButtons();
        }, 20);
    }

    function install() {
        try {
            injectStyles();
            moveButtons();

            if (typeof MutationObserver !== 'undefined' && document && document.body) {
                var observer = new MutationObserver(function () {
                    scheduleMove();
                });
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', install, { once: true });
    } else {
        install();
    }
})();
