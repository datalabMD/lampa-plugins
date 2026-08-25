/* Experimental HDREZKA history layer. Safe to skip. */
(function(){
'use strict';
if(window.rezka4_history_layer)return;window.rezka4_history_layer=true;
var state={movie:null,season:0,episode:0};
function active(){try{var a=Lampa.Activity&&Lampa.Activity.active&&Lampa.Activity.active();return a&&a.component==='rezka4_online'?a:null}catch(e){return null}}
function num(v){var m=String(v||'').match(/(\d+)/);return m?parseInt(m[1],10)||0:0}
function syncMovie(){var a=active();if(a&&a.movie)state.movie=a.movie}
function bindChoices(){try{if(typeof window.$!=='function')return;syncMovie();$('.rezka4-ui:visible [data-r4-key^="season:"]').off('hover:enter.r4hist').on('hover:enter.r4hist',function(){state.season=num($(this).attr('data-r4-key'));state.episode=0});$('.rezka4-ui:visible [data-r4-key^="episode:"]').off('hover:enter.r4hist').on('hover:enter.r4hist',function(){state.episode=num($(this).attr('data-r4-key'))})}catch(e){console.log('REZKA4 history bind error',e)}}
function fromQuality(){try{if(typeof window.$!=='function')return;var ui=$('.rezka4-ui.r4-quality:visible,.rezka4-ui:visible').last();if(!ui.length)return;var t=String(ui.find('.rezka4-title').first().text()||''),s=String(ui.find('.rezka4-sub').first().text()||'');if(!state.episode)state.episode=num(t);if(!state.season){var m=s.match(/(?:сезон|season)\s*(\d+)/i);if(m)state.season=parseInt(m[1],10)||0}}catch(e){}}
function serial(movie){return !!(movie&&(movie.original_name||movie.first_air_date||movie.number_of_seasons||movie.media_type==='tv'||movie.type==='tv'))}
function timelineFor(movie){try{if(!movie||!Lampa.Timeline||!Lampa.Timeline.view||!Lampa.Utils||!Lampa.Utils.hash)return null;var src;if(serial(movie)){fromQuality();if(!state.season||!state.episode)return null;src=String(state.season)+(state.season>10?':':'')+String(state.episode)+String(movie.original_name||movie.name||movie.title||'')}else src=String(movie.original_title||movie.title||movie.name||'');return src?Lampa.Timeline.view(Lampa.Utils.hash(src)):null}catch(e){return null}}
function enrich(data){try{syncMovie();var movie=state.movie;if(!movie||!data)return;var tl=timelineFor(movie);if(!tl)return;if(!data.timeline)data.timeline=tl;if(serial(movie)){data.season=state.season;data.episode=state.episode}if(Lampa.Favorite&&Lampa.Favorite.add)Lampa.Favorite.add('history',movie,100);data.rezka4_history=true;console.log('REZKA4 history attached',serial(movie)?('S'+state.season+'E'+state.episode):'movie')}catch(e){console.log('REZKA4 history attach error',e)}}
function hookPlayer(){try{if(!Lampa.Player||!Lampa.Player.play||window.rezka4_history_player_hook)return;window.rezka4_history_player_hook=true;var original=Lampa.Player.play;Lampa.Player.play=function(data){try{if(active())enrich(data)}catch(e){}return original.apply(this,arguments)}}catch(e){console.log('REZKA4 history player hook error',e)}}
function refresh(){syncMovie();bindChoices()}
function install(){try{hookPlayer();refresh();if(typeof MutationObserver!=='undefined'&&document.body){var o=new MutationObserver(function(){setTimeout(refresh,20)});o.observe(document.body,{childList:true,subtree:true});window.rezka4_history_observer=o}if(Lampa.Listener){Lampa.Listener.follow('full',function(){setTimeout(refresh,30)});Lampa.Listener.follow('activity',function(){setTimeout(refresh,30)})}}catch(e){console.log('REZKA4 history install error',e)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
