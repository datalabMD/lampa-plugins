/* HDREZKA delivery probe */
(function(){
'use strict';
var MARK='R4-BUNDLE-PROBE';
window.rezka4_bundle_probe=MARK;
function style(){try{var s=document.getElementById('r4-bundle-probe-style');if(!s){s=document.createElement('style');s.id='r4-bundle-probe-style';s.textContent='.player-panel__playpause{background:#ff1744!important;border-color:#ff1744!important}.player-panel__playpause svg{fill:#fff!important;color:#fff!important}';(document.head||document.documentElement).appendChild(s)}}catch(e){}}
function install(){style();try{if(Lampa.Player&&Lampa.Player.listener)Lampa.Player.listener.follow('start',function(){style();try{Lampa.Noty.show(MARK+' LIVE')}catch(e){}})}catch(e){}try{if(Lampa.SettingsApi)Lampa.SettingsApi.addParam({component:'rezka4',param:{type:'button'},field:{name:'Bundle probe',description:MARK+' active'},onChange:function(){try{Lampa.Noty.show(MARK)}catch(e){}}})}catch(e){}}
if(typeof Lampa==='undefined'){var n=0,t=setInterval(function(){if(typeof Lampa!=='undefined'||n++>40){clearInterval(t);if(typeof Lampa!=='undefined')install()}},250)}else install();
})();
