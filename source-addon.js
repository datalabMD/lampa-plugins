/* Optional HDREZKA source-menu addon. Safe to fail without affecting the main plugin. */
(function () {
    'use strict';

    function install() {
        try {
            if (typeof Lampa === 'undefined' || !Lampa.Listener) return;

            Lampa.Listener.follow('full', function (e) {
                if (!e || e.type !== 'complite' || !e.object || !e.object.activity) return;

                try {
                    var root = e.object.activity.render();
                    var hidden = root.find('.buttons--container');
                    var rezka = root.find('.view--rezka4').first();

                    if (!hidden.length || !rezka.length) return;

                    if (!rezka.find('svg').length) {
                        rezka.prepend('<svg><use xlink:href="#sprite-play"></use></svg>');
                    }

                    rezka.attr('data-subtitle', 'HDREZKA');
                    rezka.appendTo(hidden);
                } catch (err) {
                    console.log('REZKA4 source addon move error', err);
                }
            });
        } catch (e) {
            console.log('REZKA4 source addon error', e);
        }
    }

    if (typeof Lampa === 'undefined') {
        var timer = setInterval(function () {
            if (typeof Lampa !== 'undefined') {
                clearInterval(timer);
                install();
            }
        }, 200);
    } else {
        install();
    }
})();
