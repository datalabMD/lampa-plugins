/* HDREZKA player UI polish: symmetric episode controls + current episode label. */
(function(){
'use strict';
if(window.rezka4_player_ui_polish)return;window.rezka4_player_ui_polish=true;
function n(v){var m=String(v||'').match(/(\d+)/);return m?parseInt(m[1],10)||0:0}
function ensureStyle(){if(document.getElementById('rezka4-player-ui-polish-style'))return;var s=document.createElement('style');s.id='rezka4-player-ui-polish-style';s.textContent='\
.player-panel__center{position:relative!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:.22em!important}\
.player-panel__center .rezka4-center-prev,.player-panel__center .rezka4-center-next{display:flex!important;align-items:center!important;justify-content:center!important;flex:0 0 auto!important}\
.player-panel__center .rezka4-center-prev{order:40!important}\
.player-panel__center .player-panel__playpause{order:50!important}\
.player-panel__center .rezka4-center-next{order:60!important}\
.player-panel__center .rezka4-episode-now{position:absolute;left:50%;bottom:calc(100% + .32em);transform:translateX(-50%);padding:.18em .5em;border-radius:.42em;background:rgba(0,0,0,.48);font-size:.66em;font-weight:600;line-height:1.2;white-space:nowrap;pointer-events:none;opacity:.86;letter-spacing:.02em}\
.player-panel__center .rezka4-center-prev svg,.player-panel__center .rezka4-center-next svg{width:1.35em!important;height:1.35em!important}\
';document.head.appendChild(s)}
function clear(){try{$('.rezka4-episode-now').remove()}catch(e){}}
function render(data,token){var tries=0;function step(){if(token!==window.rezka4_player_ui_polish_token)return;try{var center=$('.player-panel__center').first(),play=center.find('.player-panel__playpause').first();if(!center.length||!play.length){if(tries++<40)return setTimeout(step,100);return}var s=n(data&&data.season),e=n(data&&data.episode);clear();if(!s||!e)return;center.append($('<div class="rezka4-episode-now"></div>').text('С'+s+' • Е'+e));var prev=center.find('.rezka4-center-prev').first(),next=center.find('.rezka4-center-next').first();if(prev.length)prev.insertBefore(play);if(next.length)next.insertAfter(play)}catch(err){if(tries++<40)setTimeout(step,100)}}step()}
function install(){ensureStyle();if(!Lampa.Player||!Lampa.Player.listener)return;Lampa.Player.listener.follow('start',function(data){window.rezka4_player_ui_polish_token=(window.rezka4_player_ui_polish_token||0)+1;var token=window.rezka4_player_ui_polish_token;setTimeout(function(){render(data,token)},140);setTimeout(function(){render(data,token)},450)});Lampa.Player.listener.follow('destroy',function(){window.rezka4_player_ui_polish_token=(window.rezka4_player_ui_polish_token||0)+1;clear()})}
if(typeof Lampa==='undefined')return;install();
})();