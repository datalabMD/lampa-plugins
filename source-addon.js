/* Optional HDREZKA source-menu addon. Safe to fail without affecting the main plugin. */
(function () {
    'use strict';
    var scheduled = false;

    function injectStyles() {
        if (document.getElementById('rezka4-polish-style')) return;
        var style = document.createElement('style');
        style.id = 'rezka4-polish-style';
        style.textContent = [
            /* Native-Lampa visual language: neutral, theme-friendly, focus via white outline. */
            '.rezka4-ui{padding:1.25em 2em 2.5em!important;height:calc(100vh - 5.3em)!important;background:transparent!important;align-content:start;color:inherit!important}',
            '.rezka4-hero{position:relative;margin:0 0 .9em!important;padding:.72em .9em .78em!important;border-radius:.7em!important;background:rgba(255,255,255,.055)!important;border:0!important;box-shadow:none!important}',
            '.rezka4-brand{display:none!important}',
            '.rezka4-dot{display:none!important}',
            '.rezka4-title{font-size:1.42em!important;font-weight:500!important;line-height:1.15!important;margin:0!important;letter-spacing:0!important;color:inherit!important}',
            '.rezka4-sub{font-size:.78em!important;font-weight:400!important;opacity:.58!important;margin-top:.25em!important;color:inherit!important}',
            '.rezka4-card{position:relative!important;min-height:3.55em!important;margin:.3em 0!important;padding:.72em .9em!important;border-radius:.62em!important;background:rgba(255,255,255,.045)!important;border:.12em solid transparent!important;box-shadow:none!important;overflow:hidden!important;color:inherit!important;transition:none!important}',
            '.rezka4-card:before{display:none!important}',
            '.rezka4-card.focus{transform:none!important;background:rgba(255,255,255,.08)!important;border-color:rgba(255,255,255,.96)!important;box-shadow:0 0 0 .08em rgba(255,255,255,.28)!important;z-index:3}',
            '.rezka4-main{font-size:1em!important;font-weight:500!important;letter-spacing:0!important;color:inherit!important}',
            '.rezka4-meta{font-size:.72em!important;font-weight:400!important;opacity:.55!important;margin-top:.18em!important;color:inherit!important}',
            '.rezka4-badge{padding:.22em .5em!important;border-radius:.42em!important;background:rgba(255,255,255,.08)!important;border:0!important;color:inherit!important;font-size:.64em!important;font-weight:400!important;opacity:.72!important}',

            /* Seasons: eight compact native cards. */
            '.rezka4-ui.r4-seasons{display:grid!important;grid-template-columns:repeat(8,minmax(0,1fr))!important;gap:.48em!important;overflow-y:auto!important;padding-bottom:3em!important}',
            '.rezka4-ui.r4-seasons .rezka4-hero{grid-column:1/-1;margin-bottom:.12em!important}',
            '.rezka4-ui.r4-seasons .rezka4-card{margin:0!important;min-height:4.45em!important;padding:.68em .62em!important;display:flex!important;flex-direction:column!important;align-items:flex-start!important;justify-content:center!important}',
            '.rezka4-ui.r4-seasons .rezka4-card>div:first-child{width:100%!important}',
            '.rezka4-ui.r4-seasons .rezka4-main{font-size:.9em!important;white-space:normal!important;line-height:1.12!important}',
            '.rezka4-ui.r4-seasons .rezka4-meta{font-size:.62em!important;margin-top:.23em!important;white-space:nowrap!important}',
            '.rezka4-ui.r4-seasons .rezka4-badge{display:none!important}',
            '.rezka4-ui.r4-seasons .rezka4-back{grid-column:1/-1!important;min-height:2.55em!important;max-width:17em!important;display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:space-between!important;padding:.5em .72em!important}',
            '.rezka4-ui.r4-seasons .rezka4-back .rezka4-meta{display:none!important}',
            '.rezka4-ui.r4-seasons .rezka4-back .rezka4-badge{display:block!important}',

            /* Episodes: ten columns, intentionally terse like Lampa catalog tiles. */
            '.rezka4-ui.r4-episodes{display:grid!important;grid-template-columns:repeat(10,minmax(0,1fr))!important;gap:.44em!important;overflow-y:auto!important;padding-bottom:3em!important}',
            '.rezka4-ui.r4-episodes .rezka4-hero{grid-column:1/-1;margin-bottom:.12em!important}',
            '.rezka4-ui.r4-episodes .rezka4-card{margin:0!important}',
            '.rezka4-ui.r4-episodes .rezka4-card:not(.rezka4-back){min-height:3.9em!important;padding:.55em .28em!important;display:flex!important;align-items:center!important;justify-content:center!important;text-align:center!important}',
            '.rezka4-ui.r4-episodes .rezka4-card:not(.rezka4-back)>div:first-child{width:100%!important;text-align:center!important}',
            '.rezka4-ui.r4-episodes .rezka4-card:not(.rezka4-back) .rezka4-main{font-size:.86em!important;font-weight:500!important;white-space:nowrap!important}',
            '.rezka4-ui.r4-episodes .rezka4-card:not(.rezka4-back) .rezka4-meta,.rezka4-ui.r4-episodes .rezka4-card:not(.rezka4-back) .rezka4-badge{display:none!important}',
            '.rezka4-ui.r4-episodes .rezka4-back{grid-column:1/-1!important;min-height:2.55em!important;max-width:17em!important;display:flex!important;align-items:center!important;justify-content:space-between!important;padding:.5em .72em!important}',
            '.rezka4-ui.r4-episodes .rezka4-back .rezka4-meta{display:none!important}',

            /* Voices and qualities stay wide because their labels can be long. */
            '.rezka4-ui.r4-voices .rezka4-card{max-width:none!important;min-height:3.85em!important}',
            '.rezka4-ui.r4-voices .rezka4-main{font-size:1.04em!important;font-weight:500!important;white-space:normal!important;line-height:1.18!important}',
            '.rezka4-ui.r4-voices .rezka4-meta{font-size:.74em!important}',
            '.rezka4-ui.r4-quality .rezka4-card{max-width:none!important;min-height:3.8em!important}',
            '.rezka4-ui.r4-quality .rezka4-main{font-size:1.04em!important;font-weight:500!important}',
            '.rezka4-ui.r4-quality .rezka4-meta{font-size:.74em!important}',
            '.rezka4-ui.r4-quality .rezka4-badge{min-width:3.2em!important;text-align:center!important}',

            '.rezka4-back{background:rgba(255,255,255,.025)!important;opacity:.72!important}',
            '.rezka4-back.focus{opacity:1!important;background:rgba(255,255,255,.07)!important;border-color:rgba(255,255,255,.96)!important}',
            '.rezka4-loading,.rezka4-empty{grid-column:1/-1;margin-top:.4em!important;padding:.9em 1em!important;border-radius:.62em!important;background:rgba(255,255,255,.04)!important;border:0!important;color:inherit!important}',
            '.rezka4-spinner{border-color:rgba(255,255,255,.18)!important;border-top-color:rgba(255,255,255,.9)!important}',
            '.buttons--container .view--rezka4 svg{filter:none!important}'
        ].join('');
        document.head.appendChild(style);
    }

    function enhanceQualityLabels(ui){if(!ui.hasClass('r4-quality'))return;ui.find('.rezka4-card:not(.rezka4-back)').each(function(){var card=$(this),main=String(card.find('.rezka4-main').text()||'').trim(),n=parseInt(main,10),label=n>=1080?'Full HD':n>=720?'HD':n>=480?'SD':'Low';card.find('.rezka4-meta').text(label+' • HDREZKA');card.find('.rezka4-badge').text('▶')})}
    function decorateRezkaUI(){try{if(typeof window.$!=='function')return;$('.rezka4-ui').each(function(){var ui=$(this),sub=String(ui.find('.rezka4-sub').first().text()||'').toLowerCase();ui.removeClass('r4-seasons r4-episodes r4-voices r4-quality');if(sub.indexOf('выберите сезон')!==-1)ui.addClass('r4-seasons');else if(sub.indexOf('выберите сери')!==-1||ui.find('[data-r4-key^="episode:"]').length)ui.addClass('r4-episodes');else if(sub.indexOf('перевод')!==-1||sub.indexOf('озвуч')!==-1)ui.addClass('r4-voices');else if(ui.find('[data-r4-key^="quality:"]').length)ui.addClass('r4-quality');enhanceQualityLabels(ui)})}catch(e){console.log('REZKA4 decorate error',e)}}
    function hasGridLeftNeighbor(ui,focused){try{if(!ui||!focused)return false;var a=focused.getBoundingClientRect(),cy=a.top+a.height/2,nodes=ui.querySelectorAll('.selector');for(var i=0;i<nodes.length;i++){var n=nodes[i];if(n===focused||n.classList.contains('rezka4-back'))continue;var b=n.getBoundingClientRect(),by=b.top+b.height/2;if(Math.abs(by-cy)<Math.max(a.height,b.height)*.55&&b.right<=a.left+8)return true}}catch(e){}return false}
    function installGridLeftGuard(){if(window.rezka4_grid_left_guard)return;window.rezka4_grid_left_guard=true;document.addEventListener('keydown',function(e){var key=e.key||'',code=e.keyCode||e.which;if(!(key==='ArrowLeft'||code===37))return;var ui=document.querySelector('.rezka4-ui.r4-seasons,.rezka4-ui.r4-episodes');if(!ui)return;var focused=ui.querySelector('.selector.focus');if(!focused||!hasGridLeftNeighbor(ui,focused))return;e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();try{Navigator.move('left')}catch(x){}},true)}
    function focusWatchButton(){try{if(typeof window.$!=='function'||typeof Lampa==='undefined'||!Lampa.Controller)return;var full=$('.full-start-new:visible, .full-start:visible').last();if(!full.length)return;var watch=full.find('.button--play.selector:not(.hide)').first();if(!watch.length||watch[0].offsetParent===null)return;Lampa.Controller.collectionSet(full,false,true);Lampa.Controller.collectionFocus(watch[0],full,true);if(Lampa.Controller.focus)Lampa.Controller.focus(watch[0])}catch(e){console.log('REZKA4 watch focus error',e)}}
    function installFullStartFocus(){try{if(typeof Lampa==='undefined'||!Lampa.Controller||!Lampa.Controller.listener||window.rezka4_full_start_focus)return;window.rezka4_full_start_focus=true;Lampa.Controller.listener.follow('toggle',function(e){if(!e||e.name!=='full_start')return;setTimeout(focusWatchButton,0);setTimeout(focusWatchButton,60);setTimeout(focusWatchButton,180)})}catch(e){console.log('REZKA4 full_start focus hook error',e)}}
    function moveButtons(){try{if(typeof window.$!=='function')return;$('.full-start-new, .full-start').each(function(){var root=$(this),hidden=root.find('.buttons--container').first();if(!hidden.length)return;var rezka=root.find('.full-start-new__buttons .view--rezka4, .full-start__buttons .view--rezka4, .buttons--container .view--rezka4').first();if(!rezka.length)return;if(!rezka.find('svg').length)rezka.prepend('<svg><use xlink:href="#sprite-play"></use></svg>');rezka.attr('data-subtitle','HDREZKA');var first=hidden.children().first(),alreadyFirst=first.length&&first[0]===rezka[0]&&rezka.parent()[0]===hidden[0];if(!alreadyFirst)rezka.prependTo(hidden)})}catch(e){console.log('REZKA4 source addon move error',e)}}
    function refreshUI(){decorateRezkaUI();moveButtons()}
    function scheduleMove(){if(scheduled)return;scheduled=true;setTimeout(function(){scheduled=false;refreshUI()},20)}
    function install(){try{injectStyles();installGridLeftGuard();installFullStartFocus();refreshUI();if(typeof MutationObserver!=='undefined'&&document&&document.body){var observer=new MutationObserver(function(){scheduleMove()});observer.observe(document.body,{childList:true,subtree:true});window.rezka4_source_observer=observer}if(typeof Lampa!=='undefined'&&Lampa.Listener)Lampa.Listener.follow('full',function(){scheduleMove();setTimeout(scheduleMove,100)})}catch(e){console.log('REZKA4 source addon error',e)}}
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
