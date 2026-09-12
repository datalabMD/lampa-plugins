/* HDREZKA player UI polish: symmetric previous/play/next controls. */
(function(){
'use strict';
if(window.rezka4_player_ui_polish)return;window.rezka4_player_ui_polish=true;
function ensureStyle(){if(document.getElementById('rezka4-player-ui-polish-style'))return;var s=document.createElement('style');s.id='rezka4-player-ui-polish-style';s.textContent='\
.player-panel__center{position:relative!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:.78em!important}\
.player-panel__center .rezka4-center-prev,.player-panel__center .rezka4-center-next{box-sizing:border-box!important;display:flex!important;align-items:center!important;justify-content:center!important;flex:0 0 2.7em!important;min-width:2.7em!important;width:2.7em!important;max-width:2.7em!important;height:2.7em!important;min-height:2.7em!important;padding:0!important;margin:0!important;border-radius:50%!important;background:rgba(255,255,255,.16)!important;border:.07em solid rgba(255,255,255,.28)!important;opacity:1!important;transition:transform .12s ease,background .12s ease,border-color .12s ease!important}\
.player-panel__center .rezka4-center-prev{order:40!important}\
.player-panel__center .player-panel__playpause{order:50!important}\
.player-panel__center .rezka4-center-next{order:60!important}\
.player-panel__center .rezka4-center-prev svg,.player-panel__center .rezka4-center-next svg{display:block!important;width:1.5em!important;height:1.5em!important;min-width:1.5em!important;min-height:1.5em!important;fill:currentColor!important}\
.player-panel__center .rezka4-center-prev.focus,.player-panel__center .rezka4-center-next.focus{background:rgba(255,255,255,.94)!important;border-color:rgba(255,255,255,1)!important;color:#111!important;transform:scale(1.08)!important}\
.player-panel__center .rezka4-center-prev.focus svg,.player-panel__center .rezka4-center-next.focus svg{fill:#111!important;color:#111!important}\
.player-panel__center .rezka4-center-prev .tooltip,.player-panel__center .rezka4-center-next .tooltip{display:none!important}\
.player-panel__center .rezka4-center-prev.focus .tooltip,.player-panel__center .rezka4-center-next.focus .tooltip{display:block!important}\
';document.head.appendChild(s)}
function clean(){try{$('.rezka4-episode-now').remove()}catch(e){}}
function render(token){var tries=0;function step(){if(token!==window.rezka4_player_ui_polish_token)return;try{clean();var center=$('.player-panel__center').first(),play=center.find('.player-panel__playpause').first();if(!center.length||!play.length){if(tries++<40)return setTimeout(step,100);return}var prev=center.find('.rezka4-center-prev').first(),next=center.find('.rezka4-center-next').first();if(prev.length)prev.insertBefore(play);if(next.length)next.insertAfter(play)}catch(err){if(tries++<40)setTimeout(step,100)}}step()}
function install(){ensureStyle();if(!Lampa.Player||!Lampa.Player.listener)return;Lampa.Player.listener.follow('start',function(){window.rezka4_player_ui_polish_token=(window.rezka4_player_ui_polish_token||0)+1;var token=window.rezka4_player_ui_polish_token;setTimeout(function(){render(token)},140);setTimeout(function(){render(token)},450);setTimeout(function(){render(token)},900)});Lampa.Player.listener.follow('destroy',function(){window.rezka4_player_ui_polish_token=(window.rezka4_player_ui_polish_token||0)+1;clean()})}
if(typeof Lampa==='undefined')return;install();
})();
