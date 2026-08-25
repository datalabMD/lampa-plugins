/* Optional HDREZKA source-menu addon. Safe to fail without affecting the main plugin. */
(function () {
    'use strict';
    var scheduled = false;
    var historyChoice = {};

    function injectStyles(){if(document.getElementById('rezka4-polish-style'))return;var style=document.createElement('style');style.id='rezka4-polish-style';style.textContent=[
        '.rezka4-ui{padding:1.15em 2em 2.5em!important;height:calc(100vh - 5.3em)!important;background:transparent!important;align-content:start;color:inherit!important}',
        '.rezka4-hero{position:relative;margin:0 0 .62em!important;padding:.54em .78em .58em!important;min-height:0!important;border-radius:.62em!important;background:rgba(255,255,255,.038)!important;border:0!important;box-shadow:none!important}',
        '.rezka4-brand,.rezka4-dot{display:none!important}',
        '.rezka4-title{font-size:1.3em!important;font-weight:500!important;line-height:1.12!important;margin:0!important;letter-spacing:0!important;color:inherit!important}',
        '.rezka4-sub{font-size:.74em!important;font-weight:400!important;opacity:.56!important;margin-top:.18em!important;color:inherit!important}',
        '.rezka4-card{position:relative!important;min-height:3.45em!important;margin:.22em 0!important;padding:.66em .82em!important;border-radius:.58em!important;background:rgba(255,255,255,.04)!important;border:.12em solid transparent!important;box-shadow:none!important;overflow:hidden!important;color:inherit!important;transition:none!important}',
        '.rezka4-card:before{display:none!important}',
        '.rezka4-card.focus{transform:none!important;background:rgba(255,255,255,.075)!important;border-color:rgba(255,255,255,.96)!important;box-shadow:0 0 0 .07em rgba(255,255,255,.25)!important;z-index:3}',
        '.rezka4-main{font-size:1em!important;font-weight:500!important;letter-spacing:0!important;color:inherit!important}',
        '.rezka4-meta{font-size:.71em!important;font-weight:400!important;opacity:.54!important;margin-top:.15em!important;color:inherit!important}',
        '.rezka4-badge{display:none!important}',
        '.rezka4-watch{font-size:.59em!important;font-weight:400!important;line-height:1!important;opacity:.66!important;margin-top:.32em!important;white-space:nowrap!important}',
        '.rezka4-progress{position:absolute!important;left:.34em!important;right:.34em!important;bottom:.2em!important;height:.09em!important;border-radius:1em!important;background:rgba(255,255,255,.14)!important;overflow:hidden!important;pointer-events:none!important}',
        '.rezka4-progress>i{display:block!important;height:100%!important;border-radius:inherit!important;background:rgba(255,255,255,.9)!important}',
        '.rezka4-card.focus .rezka4-progress{background:rgba(255,255,255,.28)!important}',
        '.rezka4-card.focus .rezka4-progress>i{background:#fff!important}',
        '.rezka4-ui.r4-seasons{display:grid!important;grid-template-columns:repeat(8,minmax(0,1fr))!important;gap:.42em!important;overflow-y:auto!important;padding-bottom:3em!important}',
        '.rezka4-ui.r4-seasons .rezka4-hero{grid-column:1/-1;margin-bottom:.08em!important}',
        '.rezka4-ui.r4-seasons .rezka4-card{margin:0!important;min-height:4.15em!important;padding:.62em .58em!important;display:flex!important;flex-direction:column!important;align-items:flex-start!important;justify-content:center!important}',
        '.rezka4-ui.r4-seasons .rezka4-card>div:first-child{width:100%!important}',
        '.rezka4-ui.r4-seasons .rezka4-main{font-size:.88em!important;white-space:normal!important;line-height:1.1!important}',
        '.rezka4-ui.r4-seasons .rezka4-meta{font-size:.61em!important;margin-top:.2em!important;white-space:nowrap!important}',
        '.rezka4-ui.r4-seasons .rezka4-back{grid-column:1/-1!important;min-height:2.4em!important;max-width:16em!important;display:flex!important;flex-direction:row!important;align-items:center!important;padding:.42em .66em!important}',
        '.rezka4-ui.r4-seasons .rezka4-back .rezka4-meta{display:none!important}',
        '.rezka4-ui.r4-episodes{display:grid!important;grid-template-columns:repeat(10,minmax(0,1fr))!important;gap:.4em!important;overflow-y:auto!important;padding-bottom:3em!important}',
        '.rezka4-ui.r4-episodes .rezka4-hero{grid-column:1/-1;margin-bottom:.08em!important}',
        '.rezka4-ui.r4-episodes .rezka4-card{margin:0!important}',
        '.rezka4-ui.r4-episodes .rezka4-card:not(.rezka4-back){min-height:3.7em!important;padding:.48em .24em .62em!important;display:flex!important;align-items:center!important;justify-content:center!important;text-align:center!important}',
        '.rezka4-ui.r4-episodes .rezka4-card:not(.rezka4-back)>div:first-child{width:100%!important;text-align:center!important}',
        '.rezka4-ui.r4-episodes .rezka4-card:not(.rezka4-back) .rezka4-main{font-size:.84em!important;font-weight:500!important;white-space:nowrap!important}',
        '.rezka4-ui.r4-episodes .rezka4-card:not(.rezka4-back) .rezka4-meta{display:none!important}',
        '.rezka4-ui.r4-episodes .rezka4-back{grid-column:1/-1!important;min-height:2.4em!important;max-width:16em!important;display:flex!important;align-items:center!important;padding:.42em .66em!important}',
        '.rezka4-ui.r4-episodes .rezka4-back .rezka4-meta{display:none!important}',
        '.rezka4-ui.r4-voices .rezka4-card{max-width:none!important;min-height:3.6em!important}',
        '.rezka4-ui.r4-voices .rezka4-main{font-size:1.03em!important;font-weight:500!important;white-space:normal!important;line-height:1.16!important}',
        '.rezka4-ui.r4-voices .rezka4-meta{font-size:.73em!important}',
        '.rezka4-ui.r4-quality .rezka4-card{max-width:none!important;min-height:3.55em!important}',
        '.rezka4-ui.r4-quality .rezka4-main{font-size:1.03em!important;font-weight:500!important}',
        '.rezka4-ui.r4-quality .rezka4-meta{font-size:.73em!important}',
        '.rezka4-back{background:rgba(255,255,255,.018)!important;opacity:.72!important}',
        '.rezka4-back.focus{opacity:1!important;background:rgba(255,255,255,.065)!important;border-color:rgba(255,255,255,.96)!important}',
        '.rezka4-loading,.rezka4-empty{grid-column:1/-1;margin-top:.32em!important;padding:.78em .9em!important;border-radius:.58em!important;background:rgba(255,255,255,.035)!important;border:0!important;color:inherit!important}',
        '.rezka4-spinner{border-color:rgba(255,255,255,.18)!important;border-top-color:rgba(255,255,255,.9)!important}',
        '.buttons--container .view--rezka4 svg{filter:none!important}'
    ].join('');document.head.appendChild(style)}

    function enhanceQualityLabels(ui){if(!ui.hasClass('r4-quality'))return;ui.find('.rezka4-card:not(.rezka4-back)').each(function(){var card=$(this),main=String(card.find('.rezka4-main').text()||'').trim(),n=parseInt(main,10),label=n>=1080?'Full HD':n>=720?'HD':n>=480?'SD':'Low';card.find('.rezka4-meta').text(label+' • HDREZKA')})}
    function activeRezka(){try{if(typeof Lampa==='undefined'||!Lampa.Activity||!Lampa.Activity.active)return null;var a=Lampa.Activity.active();return a&&a.component==='rezka4_online'?a:null}catch(e){return null}}
    function movieKey(movie){return String(movie&&(movie.id||movie.original_name||movie.original_title||movie.name||movie.title)||'')}
    function choiceFor(movie){var k=movieKey(movie);if(!historyChoice[k])historyChoice[k]={season:0,episode:0};return historyChoice[k]}
    function numberFrom(text,kind){text=String(text||'');var re=kind==='season'?/(?:сезон|season)\s*[:#-]?\s*(\d+)/i:/(?:серия|эпизод|episode)\s*[:#-]?\s*(\d+)/i,m=text.match(re);if(m)return parseInt(m[1],10)||0;m=text.match(/^\s*(\d+)/);return m?(parseInt(m[1],10)||0):0}
    function clampPercent(n){n=Math.round(parseFloat(n)||0);return Math.max(0,Math.min(100,n))}
    function episodeRoad(movie,season,episode){try{if(!movie||!season||!episode||!Lampa.Timeline||!Lampa.Timeline.watchedEpisode)return null;return Lampa.Timeline.watchedEpisode(movie,season,episode,true)}catch(e){return null}}
    function setProgress(card,percent,label){percent=clampPercent(percent);card.find('.rezka4-watch,.rezka4-progress').remove();if(!percent)return;var holder=card.children('div').first();holder.append('<div class="rezka4-watch">'+String(label||percent+'%')+'</div>');card.append('<div class="rezka4-progress"><i style="width:'+percent+'%"></i></div>')}
    function decorateEpisodeProgress(ui,movie){if(!movie||!ui.hasClass('r4-episodes'))return;var season=numberFrom(ui.find('.rezka4-title').first().text(),'season');if(!season){var st=choiceFor(movie);season=st.season||0}if(!season)return;ui.find('[data-r4-key^="episode:"]').each(function(){var card=$(this),m=String(card.attr('data-r4-key')||'').match(/episode:(\d+)/),ep=m?(parseInt(m[1],10)||0):0,road=episodeRoad(movie,season,ep),p=road?clampPercent(road.percent):0;setProgress(card,p,p+'%')})}
    function decorateSeasonProgress(ui,movie){if(!movie||!ui.hasClass('r4-seasons'))return;ui.find('[data-r4-key^="season:"]').each(function(){var card=$(this),m=String(card.attr('data-r4-key')||'').match(/season:(\d+)/),season=m?(parseInt(m[1],10)||0):0,meta=String(card.find('.rezka4-meta').first().text()||''),cm=meta.match(/(\d+)/),total=cm?(parseInt(cm[1],10)||0):0;if(!season||!total)return;var sum=0,done=0,lastEp=0,lastPercent=0;for(var ep=1;ep<=total;ep++){var road=episodeRoad(movie,season,ep),p=road?clampPercent(road.percent):0;sum+=p;if(p>=90)done++;if(p>0){lastEp=ep;lastPercent=p}}var avg=total?Math.round(sum/total):0;card.find('.rezka4-watch,.rezka4-progress').remove();if(avg>0){card.find('.rezka4-meta').text(done+'/'+total+' просмотрено'+(done===total?' ✓':''));var detail=lastEp?('Серия '+lastEp+' • '+lastPercent+'%'):'';setProgress(card,avg,detail)}else card.find('.rezka4-meta').text('Серий: '+total)})}
    function decorateWatchProgress(ui){try{var a=activeRezka();if(!a||!a.movie)return;if(ui.hasClass('r4-seasons'))decorateSeasonProgress(ui,a.movie);else if(ui.hasClass('r4-episodes'))decorateEpisodeProgress(ui,a.movie)}catch(e){console.log('REZKA4 progress decorate error',e)}}
    function trackHistoryChoices(ui){try{var a=activeRezka();if(!a||!a.movie)return;var state=choiceFor(a.movie);ui.find('[data-r4-key^="season:"]').off('hover:enter.rezka4hist').on('hover:enter.rezka4hist',function(){var m=String($(this).attr('data-r4-key')||'').match(/season:(\d+)/);if(m){state.season=parseInt(m[1],10)||0;state.episode=0}});ui.find('[data-r4-key^="episode:"]').off('hover:enter.rezka4hist').on('hover:enter.rezka4hist',function(){var m=String($(this).attr('data-r4-key')||'').match(/episode:(\d+)/);if(m)state.episode=parseInt(m[1],10)||0})}catch(e){console.log('REZKA4 history choice error',e)}}
    function enrichHistory(data){try{var a=activeRezka();if(!a||!a.movie||!data)return;var movie=a.movie,state=choiceFor(movie),serial=!!(movie.original_name||movie.first_air_date||movie.number_of_seasons||movie.media_type==='tv'||movie.type==='tv');if(serial&&(!state.season||!state.episode)){var ui=$('.rezka4-ui.r4-quality:visible').last(),heroTitle=ui.find('.rezka4-title').first().text(),heroSub=ui.find('.rezka4-sub').first().text();if(!state.season)state.season=numberFrom(heroSub,'season');if(!state.episode)state.episode=numberFrom(heroTitle,'episode')}var hashSource;if(serial){if(!state.season||!state.episode)return;var base=movie.original_name||movie.original_title||movie.name||movie.title||'';hashSource=[state.season,state.season>10?':':'',state.episode,base].join('');data.season=state.season;data.episode=state.episode}else hashSource=movie.original_title||movie.title||movie.name||'';if(hashSource&&Lampa.Timeline&&Lampa.Timeline.view&&Lampa.Utils&&Lampa.Utils.hash&&!data.timeline)data.timeline=Lampa.Timeline.view(Lampa.Utils.hash(hashSource));if(Lampa.Favorite&&Lampa.Favorite.add)Lampa.Favorite.add('history',movie,100);data.rezka4_history=true}catch(e){console.log('REZKA4 history enrich error',e)}}
    function installHistoryBridge(){try{if(typeof Lampa==='undefined'||!Lampa.Player||!Lampa.Player.play||window.rezka4_history_bridge)return;window.rezka4_history_bridge=true;var original=Lampa.Player.play;Lampa.Player.play=function(data){try{enrichHistory(data)}catch(e){}return original.apply(this,arguments)}}catch(e){console.log('REZKA4 history bridge error',e)}}
    function decorateRezkaUI(){try{if(typeof window.$!=='function')return;$('.rezka4-ui').each(function(){var ui=$(this),sub=String(ui.find('.rezka4-sub').first().text()||'').toLowerCase();ui.removeClass('r4-seasons r4-episodes r4-voices r4-quality');if(sub.indexOf('выберите сезон')!==-1)ui.addClass('r4-seasons');else if(sub.indexOf('выберите сери')!==-1||ui.find('[data-r4-key^="episode:"]').length)ui.addClass('r4-episodes');else if(sub.indexOf('перевод')!==-1||sub.indexOf('озвуч')!==-1)ui.addClass('r4-voices');else if(ui.find('[data-r4-key^="quality:"]').length)ui.addClass('r4-quality');enhanceQualityLabels(ui);trackHistoryChoices(ui);decorateWatchProgress(ui)})}catch(e){console.log('REZKA4 decorate error',e)}}
    function hasGridLeftNeighbor(ui,focused){try{if(!ui||!focused)return false;var a=focused.getBoundingClientRect(),cy=a.top+a.height/2,nodes=ui.querySelectorAll('.selector');for(var i=0;i<nodes.length;i++){var n=nodes[i];if(n===focused||n.classList.contains('rezka4-back'))continue;var b=n.getBoundingClientRect(),by=b.top+b.height/2;if(Math.abs(by-cy)<Math.max(a.height,b.height)*.55