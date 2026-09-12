/* Move Lampa "Continue watching" row to the top of the main page. */
(function(){
'use strict';
if(window.rezka4_home_history_top)return;window.rezka4_home_history_top=true;
function titleContinue(){try{return String(Lampa.Lang&&Lampa.Lang.translate?Lampa.Lang.translate('title_continue'):'').trim()}catch(e){return''}}
function isContinueRow(row){if(!row||typeof row!=='object')return false;var name=String(row.name||row.component||row.id||'').toLowerCase(),title=String(row.title||'').trim();if(name==='continue_watch'||name.indexOf('continue_watch')>=0)return true;var wanted=titleContinue();return !!(wanted&&title===wanted)}
function promote(data){if(!Array.isArray(data)||data.length<2)return data;var index=-1;for(var i=0;i<data.length;i++)if(isContinueRow(data[i])){index=i;break}if(index>0){var row=data.splice(index,1)[0];data.unshift(row)}return data}
function install(){try{if(!Lampa.Api||typeof Lampa.Api.main!=='function'||Lampa.Api.main.__rezka4_history_top)return false;var original=Lampa.Api.main;function wrapped(params,oncomplete,onerror){var next=original.call(this,params,function(data){if(typeof oncomplete==='function')oncomplete(promote(data))},onerror);if(typeof next==='function')return function(resolve,reject){return next(function(data){if(typeof resolve==='function')resolve(promote(data))},reject)};return next}wrapped.__rezka4_history_top=true;wrapped.__rezka4_original=original;Lampa.Api.main=wrapped;return true}catch(e){try{console.log('REZKA4 home history top error',e)}catch(x){}return false}}
function boot(){if(typeof Lampa==='undefined'||!Lampa.Api)return setTimeout(boot,200);install()}
boot();
})();