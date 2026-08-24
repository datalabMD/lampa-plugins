/* Optional HDREZKA source-menu addon. Safe to fail without affecting the main plugin. */
(function () {
    'use strict';

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
                rezka.prependTo(hidden);
            });
        } catch (e) {
            console.log('REZKA4 source addon move error', e);
        }
    }

    function install() {
        try {
            moveButtons();

            if (typeof MutationObserver !== 'undefined' && document && document.body) {
                var observer = new MutationObserver(function () {
                    moveButtons();
                });
                observer.observe(document.body, { childList: true, subtree: true });
                window.rezka4_source_observer = observer;
            }

            if (typeof Lampa !== 'undefined' && Lampa.Listener) {
                Lampa.Listener.follow('full', function () {
                    setTimeout(moveButtons, 0);
                    setTimeout(moveButtons, 100);
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
