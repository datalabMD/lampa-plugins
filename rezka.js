/* HDREZKA loader - stable URL. Implementation v4.0.0 */
(function(){
'use strict';
if(window.rezka_stable_loader)return;window.rezka_stable_loader=true;
var s=document.createElement('script');
s.src='https://cdn.jsdelivr.net/gh/datalabMD/lampa-plugins@078911bbff99d7c63576fdd0050face1669c1d56/rezka4.js';
s.async=true;
s.onerror=function(){try{Lampa.Noty.show('HDREZKA: не удалось загрузить модуль');}catch(e){}};
document.head.appendChild(s);
})();
