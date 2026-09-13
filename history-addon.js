/* HDREZKA dynamic feature loader. Stable base remains independent. */
(function(){
'use strict';
var LOADER_REV='R4-DYN-0913-PINNED-121D';
if(window.rezka4_dynamic_feature_loader_rev===LOADER_REV)return;
window.rezka4_dynamic_feature_loader_rev=LOADER_REV;
window.rezka4_dynamic_feature_loader=true;
var stamp=Date.now();
var DYNAMIC_COMMIT='121d265b4a6684f0830493dbbdc70e7ead9a62d2';
var DYNAMIC_MARKER='R4-DYN-0913-LABELFIT2';
window.rezka4_dynamic_marker=DYNAMIC_MARKER;
function cleanupLegacyStyles(){try{['r4-bundle-probe-style','rezka4-playlist-probe-style','rezka4-translator-probe-style','rezka4-dyn-player-style'].forEach(function(id){var old=document.getElementById(id);if(old)old.remove()})}catch(e){}}
cleanupLegacyStyles();
function addVersionMarker(){try{if(typeof Lampa==='undefined'||!Lampa.SettingsApi)return false;if(window.rezka4_dynamic_marker_added===DYNAMIC_MARKER)return true;Lampa.SettingsApi.addParam({component:'rezka4',param:{type:'button'},field:{name:'Версия динамического слоя',description:DYNAMIC_MARKER+' • '+DYNAMIC_COMMIT.slice(0,8)},onChange:function(){try{Lampa.Noty.show('HDREZKA '+DYNAMIC_MARKER+' '+DYNAMIC_COMMIT.slice(0,8))}catch(e){}}});window.rezka4_dynamic_marker_added=DYNAMIC_MARKER;return true}catch(e){return false}}
function scheduleVersionMarker(){var tries=0;function step(){if(addVersionMarker())return;if(tries++<20)setTimeout(step,500)}step()}
scheduleVersionMarker();
function evalLoad(url,done){try{fetch(url+(url.indexOf('?')>=0?'&':'?')+'ts='+stamp,{cache:'no-store',headers:{'Cache-Control':'no-cache','Pragma':'no-cache'}}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.text()}).then(function(code){try{(0,eval)(code+'\n//# sourceURL='+url);done&&done(true)}catch(e){console.log('REZKA4 eval load error',url,e);done&&done(false)}}).catch(function(){done&&done(false)})}catch(e){done&&done(false)}}
function scriptLoad(url,done){var s=document.createElement('script');s.async=false;s.src=url+(url.indexOf('?')>=0?'&':'?')+'ts='+stamp;s.onload=function(){done&&done(true)};s.onerror=function(){try{s.remove()}catch(e){}done&&done(false)};(document.head||document.documentElement).appendChild(s)}
function loadOne(path,done){var raw='https://raw.githubusercontent.com/datalabMD/lampa-plugins/'+DYNAMIC_COMMIT+'/'+path;var cdn='https://cdn.jsdelivr.net/gh/datalabMD/lampa-plugins@'+DYNAMIC_COMMIT+'/'+path;evalLoad(raw,function(ok){if(ok)return done&&done(true);scriptLoad(cdn,done)})}
loadOne('history-core.js',function(ok){if(!ok){try{console.log('REZKA4 history core unavailable')}catch(e){}return}loadOne('player-playlist-addon.js',function(playlistOk){if(!playlistOk){try{console.log('REZKA4 player playlist layer unavailable')}catch(e){}return}loadOne('player-translator-fix.js',function(fixOk){if(!fixOk){try{console.log('REZKA4 translator pin fix unavailable')}catch(e){}}loadOne('player-ui-polish.js',function(uiOk){if(!uiOk)try{console.log('REZKA4 player UI polish unavailable')}catch(e){}});loadOne('home-history-top.js',function(homeOk){if(!homeOk)try{console.log('REZKA4 home history prioritizer unavailable')}catch(e){}})})})});
})();