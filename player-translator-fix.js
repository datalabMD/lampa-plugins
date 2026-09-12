/* Keep HDREZKA playlist switches on the selected translator. */
(function(){
'use strict';
if(window.rezka4_playlist_translator_fix)return;window.rezka4_playlist_translator_fix=true;
function n(v){var m=String(v||'').match(/(\d+)/);return m?parseInt(m[1],10)||0:0}
function movie(){try{var a=Lampa.Activity&&Lampa.Activity.active&&Lampa.Activity.active();return a&&a.movie||null}catch(e){return null}}
function prefKey(m){if(!m)return'';var kind=m&&(m.first_air_date||m.original_name||m.media_type==='tv'||m.type==='tv')?'tv':'movie',id=m&&(m.tmdb_id||m.id||m.imdb_id)||'',name=m&&(m.original_name||m.original_title||m.name||m.title)||'',date=m&&(m.first_air_date||m.release_date)||'',raw=kind+'|'+(id?('id:'+id):(String(name).toLowerCase()+'|'+String(date).slice(0,4))),hash='';try{hash=Lampa.Utils&&Lampa.Utils.hash?Lampa.Utils.hash(raw):''}catch(e){}return'rezka4_title_pref_'+String(hash)}
function voiceId(){try{var key=prefKey(movie()),r=key&&Lampa.Storage.get(key);if(typeof r==='string')r=JSON.parse(r);return String(r&&r.voiceId||'')}catch(e){return''}}
var open=XMLHttpRequest.prototype.open,send=XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open=function(method,url){this.__r4url=String(url||'');return open.apply(this,arguments)};
XMLHttpRequest.prototype.send=function(body){try{var text=typeof body==='string'?body:'',id=voiceId();if(id&&/\/ajax\/get_cdn_series\//i.test(this.__r4url||'')&&/(?:^|&)action=get_stream(?:&|$)/.test(text)){var p=new URLSearchParams(text);p.set('translator_id',id);body=p.toString()}}catch(e){}return send.call(this,body)};
})();