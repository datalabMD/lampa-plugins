/* HDREZKA plugin for Lampa v2.1.0 - fixed settings + proxy/XHR */
(function () {
'use strict';
if (window.rezka2_plugin_ready) return;
window.rezka2_plugin_ready = true;

var DOMAIN = 'https://kvk.pub';
var PROXY  = 'https://lampa.datalab.md/?url=';
var STORAGE = {
  login: 'rezka2_login_v21',
  password: 'rezka2_password_v21',
  status: 'rezka2_status_v21'
};

function proxify(url){ return PROXY + encodeURIComponent(url); }

function xhr(method,url,body,ok,fail){
  try{
    var x=new XMLHttpRequest();
    x.open(method,proxify(url),true);
    x.timeout=20000;
    x.setRequestHeader('X-Requested-With','XMLHttpRequest');
    if(method==='POST') x.setRequestHeader('Content-Type','application/x-www-form-urlencoded');
    x.onload=function(){
      if(x.status>=200&&x.status<300) ok(x.responseText,x);
      else if(fail) fail('HTTP '+x.status);
    };
    x.onerror=function(){ if(fail) fail('Сетевая ошибка'); };
    x.ontimeout=function(){ if(fail) fail('Таймаут'); };
    x.send(body||null);
  }catch(e){ if(fail) fail(e.message); }
}

function jsonPost(url,body,ok,fail){
  xhr('POST',url,body,function(t){
    try{ ok(JSON.parse(t)); }catch(e){ if(fail) fail('Некорректный JSON'); }
  },fail);
}

function authenticate(login,password,cb){
  var body='login_name='+encodeURIComponent(login)+'&login_password='+encodeURIComponent(password)+'&login_not_save=0';
  jsonPost(DOMAIN+'/ajax/login/?t='+Date.now(),body,function(j){
    if(j&&j.success){
      Lampa.Storage.set(STORAGE.status,'logged');
      cb(true,'Успешный вход');
    }else{
      var m=(j&&j.message)||'login failed';
      Lampa.Storage.set(STORAGE.status,'error:'+m);
      cb(false,m);
    }
  },function(m){
    Lampa.Storage.set(STORAGE.status,'error:'+m);
    cb(false,m);
  });
}

function statusLabel(){
  var s=Lampa.Storage.get(STORAGE.status)||'guest';
  if(s==='logged') return 'Вы вошли в аккаунт';
  if(s.indexOf('error:')===0) return 'Ошибка: '+s.substring(6);
  return 'Не авторизованы';
}

function abs(href){
  try{return new URL(href,DOMAIN+'/').toString();}catch(e){return href;}
}

function searchRezka(q,year,cb){
  xhr('GET',DOMAIN+'/engine/ajax/search.php?q='+encodeURIComponent(q),null,function(html){
    var d=document.createElement('div'); d.innerHTML=html;
    var arr=[];
    d.querySelectorAll('a').forEach(function(el){
      var href=el.getAttribute('href');
      if(!href||href.indexOf('search')!==-1) return;
      var enty=el.querySelector('.enty');
      var full=(el.textContent||'').trim();
      var title=enty?(enty.textContent||'').trim():full.replace(/\s*\([^)]*\d{4}\)[\s\S]*$/,'').trim();
      var ym=full.match(/\b(19|20)\d{2}\b/);
      arr.push({url:abs(href),title:title,year:ym?ym[0]:''});
    });
    if(year){
      var exact=arr.filter(function(i){return i.year==String(year);});
      if(exact.length) arr=exact;
    }
    cb(arr);
  },function(){ cb([]); });
}

function fetchFilmPage(url,cb,fail){
  xhr('GET',url,null,function(str){
    var info={film_id:'',is_series:false,favs:'',voice:[],season:[],episode:[],page_url:url};
    var m=str.match(/initCDN(?:Series|Movies)Events\(\s*(\d+)\s*,\s*(\d+)\s*,\s*([01])\s*,\s*([01])\s*(?:,\s*([01]))?/);
    if(!m){ if(fail) fail('Не удалось распарсить страницу'); return; }
    info.film_id=m[1];
    var def=m[2],cam=m[3],ads=m[4],dir=m[5]||'0';
    info.is_series=/initCDNSeriesEvents/.test(str);
    var fm=str.match(/data-favs="([^"]+)"/); if(fm) info.favs=fm[1];

    var tm=str.match(/<ul[^>]+class="b-translator__list"[\s\S]*?<\/ul>/);
    if(tm){
      var td=document.createElement('div'); td.innerHTML=tm[0];
      td.querySelectorAll('.b-translator__item').forEach(function(li){
        info.voice.push({
          name:(li.getAttribute('title')||li.textContent||'').trim(),
          id:li.getAttribute('data-translator_id')||def,
          is_camrip:li.getAttribute('data-camrip')||cam,
          is_ads:li.getAttribute('data-ads')||ads,
          is_director:li.getAttribute('data-director')||dir
        });
      });
    }
    if(!info.voice.length) info.voice.push({name:'Оригинал',id:def,is_camrip:cam,is_ads:ads,is_director:dir});

    if(info.is_series){
      var sm=str.match(/<ul[^>]+class="b-simple_seasons__list"[\s\S]*?<\/ul>/);
      if(sm){
        var sd=document.createElement('div'); sd.innerHTML=sm[0];
        sd.querySelectorAll('.b-simple_season__item').forEach(function(li){
          info.season.push({name:(li.textContent||'').trim(),id:li.getAttribute('data-tab_id')});
        });
      }
      var em=str.match(/<ul[^>]+class="b-simple_episodes__list"[\s\S]*?<\/ul>/g);
      if(em) em.forEach(function(block){
        var ed=document.createElement('div'); ed.innerHTML=block;
        ed.querySelectorAll('.b-simple_episode__item').forEach(function(li){
          info.episode.push({name:(li.textContent||'').trim(),season_id:li.getAttribute('data-season_id'),episode_id:li.getAttribute('data-episode_id')});
        });
      });
    }
    cb(info);
  },fail);
}

function decodeTrash(data){
  if(!data||typeof data!=='string'||data.charAt(0)!=='#') return data;
  var trash=['$$!!@$$@^!@#$$@','@@@@@!##!^^^','####^!!##!@@','^^^!@##!!##','$$#!!@#!@##'];
  function enc(s){ return btoa(unescape(encodeURIComponent(s))); }
  var x=data.substring(2);
  trash.forEach(function(t){ x=x.split('//_//'+enc(t)).join(''); });
  try{return decodeURIComponent(escape(atob(x)));}catch(e){try{return atob(x);}catch(e2){return '';}}
}

function playlist(s){
  if(!s) return [];
  return s.split(',').map(function(p){
    var m=p.match(/\[([^\]]+)\](.+)/); if(!m) return null;
    var u=m[2].split(' or ');
    return {label:m[1].trim(),file:u[u.length-1].trim()};
  }).filter(Boolean);
}

function subtitles(s){
  if(!s) return [];
  return s.split(',').map(function(p){
    var m=p.match(/\[([^\]]+)\](.+)/); return m?{label:m[1],url:m[2]}:null;
  }).filter(Boolean);
}

function getStream(info,voice,season,episode,cb,fail){
  var body;
  if(info.is_series&&season&&episode){
    body='id='+encodeURIComponent(info.film_id)+'&translator_id='+encodeURIComponent(voice.id)+'&season='+encodeURIComponent(season.id)+'&episode='+encodeURIComponent(episode.episode_id)+'&favs='+encodeURIComponent(info.favs||'')+'&action=get_stream';
  }else{
    body='id='+encodeURIComponent(info.film_id)+'&translator_id='+encodeURIComponent(voice.id)+'&is_camrip='+encodeURIComponent(voice.is_camrip||0)+'&is_ads='+encodeURIComponent(voice.is_ads||0)+'&is_director='+encodeURIComponent(voice.is_director||0)+'&favs='+encodeURIComponent(info.favs||'')+'&action=get_movie';
  }
  jsonPost(DOMAIN+'/ajax/get_cdn_series/?t='+Date.now(),body,function(j){
    if(!j||!j.success){ if(fail) fail((j&&j.message)||'Сервер вернул ошибку'); return; }
    var arr=playlist(decodeTrash(j.url));
    if(!arr.length){ if(fail) fail('Пустой плейлист'); return; }
    var q={}; arr.forEach(function(i){q[i.label]=i.file;});
    cb({file:arr[arr.length-1].file,quality:q,subtitles:subtitles(j.subtitle)});
  },fail);
}

function component(object){
  var scroll=new Lampa.Scroll({mask:true,over:true});
  var files=new Lampa.Explorer(object);
  var filter=new Lampa.Filter(object);
  var html=$('<div></div>');
  var self=this;
  var state={info:null,choice:{voice:0,season:0}};

  this.create=function(){scroll.minus();files.appendFiles(scroll.render());files.appendHead(filter.render());return this.render();};
  this.render=function(){return files.render();};
  this.start=function(){
    if(Lampa.Activity.active().activity!==this.activity)return;
    Lampa.Controller.add('content',{
      toggle:function(){Lampa.Controller.collectionSet(scroll.render(),files.render());Lampa.Controller.collectionFocus(false,scroll.render());},
      up:function(){if(Navigator.canmove('up'))Navigator.move('up');else Lampa.Controller.toggle('head');},
      down:function(){Navigator.move('down');},left:function(){Lampa.Controller.toggle('menu');},right:function(){Navigator.move('right');},back:this.back
    });
    Lampa.Controller.toggle('content');
  };
  this.pause=function(){}; this.stop=function(){};
  this.back=function(){Lampa.Activity.backward();};
  this.destroy=function(){scroll.destroy();files.destroy();filter.destroy();html.remove();};

  function show(msg){
    html.empty(); var e=new Lampa.Empty({text:msg}); html.append(e.render()); scroll.append(html); Lampa.Controller.enable('content');
  }
  function buildFilter(){
    if(!state.info)return;
    var i=state.info;
    var list=[{title:'Перевод',subtitle:(i.voice[state.choice.voice]||i.voice[0]).name,stype:'voice'}];
    if(i.is_series) list.push({title:'Сезон',subtitle:(i.season[state.choice.season]||{}).name||'—',stype:'season'});
    filter.set('filter',list);
    filter.onSelect=function(type,a,b){if(a.stype){state.choice[a.stype]=b.index;buildFilter();buildList();}};
  }
  function buildList(){
    html.empty(); var i=state.info; if(!i)return;
    var v=i.voice[state.choice.voice]||i.voice[0]; var s=i.season[state.choice.season];
    var items=i.is_series&&s?i.episode.filter(function(e){return String(e.season_id)===String(s.id);}):[{name:'Смотреть фильм'}];
    items.forEach(function(ep){
      var item=$('<div class="online"><div class="online__title">'+Lampa.Utils.escape(ep.name)+'</div><div class="online__quality">'+Lampa.Utils.escape(v.name)+'</div></div>');
      item.on('hover:enter',function(){
        getStream(i,v,i.is_series?s:null,i.is_series?ep:null,function(d){
          var p={url:d.file,title:(object.movie.title||object.movie.name||''),quality:d.quality,subtitles:d.subtitles};
          Lampa.Player.play(p); Lampa.Player.playlist([p]);
        },function(m){Lampa.Noty.show('HDREZKA: '+m);});
      });
      html.append(item);
    });
    scroll.append(html); Lampa.Controller.enable('content');
  }

  this.initialize=function(){
    this.activity.loader(true);
    var m=object.movie||{},title=m.title||m.name||'',year=(m.release_date||m.first_air_date||'').slice(0,4);
    searchRezka(title,year,function(r){
      if(!r.length){self.activity.loader(false);show('Ничего не найдено на HDREZKA');self.activity.toggle();return;}
      fetchFilmPage(r[0].url,function(info){state.info=info;self.activity.loader(false);buildFilter();buildList();self.activity.toggle();},function(msg){self.activity.loader(false);show(msg);self.activity.toggle();});
    });
  };
}

function openRezka(movie){
  Lampa.Activity.push({url:'',title:'HDREZKA - '+(movie.title||movie.name||''),component:'rezka2_online',movie:movie,page:1});
}

function register(){
  Lampa.Component.add('rezka2_online',component);
  Lampa.Listener.follow('full',function(e){
    if(e.type!=='complite')return;
    var root=e.object.activity.render();
    var c=root.find('.full-start-new__buttons'); if(!c.length)c=root.find('.full-start__buttons');
    if(!c.length||root.find('.view--rezka2').length)return;
    var b=$('<div class="full-start__button selector view--online view--rezka2"><span>HDREZKA</span></div>');
    b.on('hover:enter',function(){openRezka(e.data.movie);}); c.prepend(b);
  });

  Lampa.SettingsApi.addComponent({
    component:'rezka2',
    name:'HDREZKA v2',
    icon:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="2"/><path d="M9 8l6 4-6 4V8z" fill="currentColor"/></svg>'
  });

  Lampa.SettingsApi.addParam({component:'rezka2',param:{name:STORAGE.login,type:'input',values:'',default:''},field:{name:'Логин / E-mail',description:'Аккаунт HDREZKA'}});
  Lampa.SettingsApi.addParam({component:'rezka2',param:{name:STORAGE.password,type:'input',values:'',default:''},field:{name:'Пароль',description:'Хранится локально на устройстве'}});
  Lampa.SettingsApi.addParam({component:'rezka2',param:{name:'rezka2_login_button_v21',type:'trigger'},field:{name:'Войти в аккаунт',description:statusLabel()},onChange:function(){
    var l=Lampa.Storage.get(STORAGE.login),p=Lampa.Storage.get(STORAGE.password);
    if(!l||!p){Lampa.Noty.show('Введите логин и пароль');return;}
    authenticate(l,p,function(ok,msg){Lampa.Noty.show((ok?'✓ ':'✗ ')+msg);});
  }});
  Lampa.SettingsApi.addParam({component:'rezka2',param:{name:'rezka2_logout_button_v21',type:'trigger'},field:{name:'Выйти из аккаунта',description:'Очистить локальный статус'},onChange:function(){Lampa.Storage.set(STORAGE.status,'guest');Lampa.Noty.show('Сессия очищена');}});
  Lampa.SettingsApi.addParam({component:'rezka2',param:{name:'rezka2_info_v21',type:'static'},field:{name:'Подключение',description:'kvk.pub через lampa.datalab.md'}});
}

function start(){if(window.rezka2_plugin_started)return;window.rezka2_plugin_started=true;register();console.log('REZKA2 v2.1 started');}
function boot(){if(typeof Lampa==='undefined')return setTimeout(boot,200);if(window.appready)start();else if(Lampa.Listener&&Lampa.Listener.follow){Lampa.Listener.follow('app',function(e){if(e.type==='ready')start();});setTimeout(function(){if(window.appready)start();},1000);}else start();}
boot();
})();