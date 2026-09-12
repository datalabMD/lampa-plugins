/* HDREZKA dynamic feature loader. Stable base remains independent. */
(function(){
'use strict';
if(window.rezka4_dynamic_feature_loader)return;window.rezka4_dynamic_feature_loader=true;
var stamp=Date.now();
function evalLoad(url,done){
 try{
  fetch(url+(url.indexOf('?')>=0?'&':'?')+'ts='+stamp,{cache:'no-store',headers:{'Cache-Control':'no-cache','Pragma':'no-cache'}})
   .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.text()})
   .then(function(code){try{(0,eval)(code+'\n//# sourceURL='+url);done&&done(true)}catch(e){console.log('REZKA4 eval load error',url,e);done&&done(false)}})
   .catch(function(){done&&done(false)})
 }catch(e){done&&done(false)}
}
function scriptLoad(url,done){var s=document.createElement('script');s.async=false;s.src=url+(url.indexOf('?')>=0?'&':'?')+'ts='+stamp;s.onload=function(){done&&done(true)};s.onerror=function(){try{s.remove()}catch(e){}done&&done(false)};(document.head||document.documentElement).appendChild(s)}
function loadOne(path,done){
 var raw='https://raw.githubusercontent.com/datalabMD/lampa-plugins/main/'+path;
 var cdn='https://cdn.jsdelivr.net/gh/datalabMD/lampa-plugins@main/'+path;
 evalLoad(raw,function(ok){if(ok)return done&&done(true);scriptLoad(cdn,done)})
}
loadOne('history-core.js',function(ok){
 if(!ok){try{console.log('REZKA4 history core unavailable')}catch(e){}return}
 loadOne('player-playlist-addon.js',function(playlistOk){
  if(!playlistOk){try{console.log('REZKA4 player playlist layer unavailable')}catch(e){}return}
  loadOne('player-translator-fix.js',function(fixOk){
   if(!fixOk){try{console.log('REZKA4 translator pin fix unavailable')}catch(e){}}
   loadOne('player-ui-polish.js',function(uiOk){if(!uiOk)try{console.log('REZKA4 player UI polish unavailable')}catch(e){}})
   loadOne('home-history-top.js',function(homeOk){if(!homeOk)try{console.log('REZKA4 home history prioritizer unavailable')}catch(e){}})
  })
 })
});
})();