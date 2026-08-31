/* HDREZKA dynamic feature loader. Stable base remains independent. */
(function(){
'use strict';
if(window.rezka4_dynamic_feature_loader)return;window.rezka4_dynamic_feature_loader=true;
var stamp=Date.now();
function loadOne(urls,done){var i=0;function next(){if(i>=urls.length)return done&&done(false);var s=document.createElement('script');s.async=false;s.src=urls[i++]+(urls[i-1].indexOf('?')>=0?'&':'?')+'ts='+stamp;s.onload=function(){done&&done(true)};s.onerror=function(){try{s.remove()}catch(e){}next()};(document.head||document.documentElement).appendChild(s)}next()}
function github(path){return['https://cdn.jsdelivr.net/gh/datalabMD/lampa-plugins@main/'+path,'https://raw.githubusercontent.com/datalabMD/lampa-plugins/main/'+path]}
loadOne(github('history-core.js'),function(ok){if(!ok){try{console.log('REZKA4 history core unavailable')}catch(e){}return}loadOne(github('player-playlist-addon.js'),function(playlistOk){if(!playlistOk)try{console.log('REZKA4 player playlist layer unavailable')}catch(e){}})});
})();