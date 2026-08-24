/* Optional HDREZKA source-menu addon. Safe to fail without affecting the main plugin. */
(function () {
    'use strict';

    try {
        if (typeof Lampa === 'undefined' || !Lampa.Manifest) return;

        Lampa.Manifest.plugins = {
            type: 'video',
            version: '1.0.0',
            name: 'HDREZKA',
            description: 'Просмотр через HDREZKA',
            component: 'rezka4_online',
            onContextMenu: function () {
                return {
                    name: 'HDREZKA',
                    description: 'Онлайн'
                };
            },
            onContextLauch: function (object) {
                try {
                    Lampa.Activity.push({
                        title: 'HDREZKA - ' + ((object && (object.title || object.name)) || ''),
                        component: 'rezka4_online',
                        movie: object
                    });
                } catch (e) {
                    console.log('REZKA4 source launch error', e);
                }
            }
        };
    } catch (e) {
        console.log('REZKA4 source addon error', e);
    }
})();
