import { state, getGuestId } from './context.js';
import { rpc } from './supabase.js';

let observer=null;
const activeSessions=new Map();
const shortPlayers=new Map();
let activeShort=null;
let shortsMuted=true;
let shortsPlayed=0;
let audioTimer=null;
let youtubeApiReady=null;

function loadYouTubeApi(){
  if(window.YT?.Player) return Promise.resolve();
  if(youtubeApiReady) return youtubeApiReady;
  youtubeApiReady=new Promise((resolve,reject)=>{
    const previous=window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady=()=>{
      try{ previous?.(); }finally{ resolve(); }
    };
    const script=document.createElement('script');
    script.src='https://www.youtube.com/iframe_api';
    script.onerror=()=>reject(new Error('No se pudo cargar la API de YouTube para Cortos.'));
    document.head.appendChild(script);
  }).catch(error=>{
    youtubeApiReady=null;
    throw error;
  });
  return youtubeApiReady;
}

function rememberShortAudio(){
  const record=shortPlayers.get(activeShort);
  if(!record?.ready) return;
  const muted=record.player.isMuted();
  if(typeof muted!=='boolean') return;
  // Commands reach the iframe asynchronously: wait for their acknowledgement
  // before treating a change as the user's choice in YouTube's speaker control.
  if(record.pendingMuted!==null){
    if(muted===record.pendingMuted){
      record.pendingMuted=null;
      return;
    }
    record.pendingMuted=null;
  }
  shortsMuted=muted;
}

function applyShortAudio(el){
  const record=shortPlayers.get(el);
  if(!record?.ready||activeShort!==el) return;
  record.pendingMuted=shortsMuted;
  if(shortsMuted) record.player.mute();
  else record.player.unMute();
}

function attachShortPlayer(el){
  const iframe=el.querySelector('.player-shell iframe');
  if(!iframe||shortPlayers.has(el)) return;
  const record={player:null,ready:false,pendingMuted:null};
  shortPlayers.set(el,record);
  record.player=new window.YT.Player(iframe,{
    events:{
      onReady:()=>{
        if(!el.isConnected) return;
        record.ready=true;
        if(activeShort===el&&activeSessions.has(el)){
          applyShortAudio(el);
          record.player.playVideo();
        }
      },
      onStateChange:()=>{
        if(activeShort===el) rememberShortAudio();
      }
    }
  });
}

function youtubeCommand(iframe,func){
  if(!iframe?.contentWindow) return;
  try{
    iframe.contentWindow.postMessage(JSON.stringify({
      event:'command',
      func,
      args:[]
    }),'*');
  }catch{}
}

function pauseShortItem(el){
  if(!el) return;
  if(activeShort===el){
    rememberShortAudio();
    activeShort=null;
  }
  const iframe=el.querySelector('.player-shell iframe');
  youtubeCommand(iframe,'pauseVideo');
  el.classList.remove('is-playing');
}

function pauseOtherShorts(active){
  document.querySelectorAll('.short-item').forEach(item=>{
    if(item!==active) pauseShortItem(item);
  });
}

function playShortItem(el){
  if(!el) return;
  pauseOtherShorts(el);
  const iframe=el.querySelector('.player-shell iframe');
  if(!iframe) return;
  if(shortsPlayed===0){
    shortsMuted=true;
  }else{
    shortsMuted=false;
  }
  shortsPlayed++;
  activeShort=el;
  applyShortAudio(el);

  const attempt=()=>{
    if(activeShort!==el||!activeSessions.has(el)||!el.isConnected) return;
    youtubeCommand(iframe,'playVideo');
    el.classList.add('is-playing');
  };

  attempt();

  if(!iframe.dataset.vidioupAutoplayHook){
    iframe.dataset.vidioupAutoplayHook='1';
    iframe.addEventListener('load',()=>setTimeout(attempt,120),{once:true});
  }

  setTimeout(attempt,450);
  setTimeout(attempt,1000);
}

function stopAllShorts(){
  document.querySelectorAll('.short-item').forEach(pauseShortItem);
}

function stopSession(el){
  const started=activeSessions.get(el);
  if(!started) return;

  activeSessions.delete(el);

  const seconds=(performance.now()-started)/1000;
  if(seconds<0.6) return;

  const videoId=el.dataset.videoId;
  if(!videoId) return;

  const visibleSeconds=Number(seconds.toFixed(1));

  if(state.session){
    rpc('record_video_signal',{
      p_video_id:videoId,
      p_visible_seconds:visibleSeconds,
      p_quick_swipe:seconds<2.5
    }).catch(()=>{});
  }

  const campaignId=el.dataset.campaignId;
  if(campaignId){
    rpc('record_campaign_exposure_v2',{
      p_campaign_id:campaignId,
      p_visible_seconds:visibleSeconds,
      p_guest_id:getGuestId()
    }).catch(()=>{});
  }
}

export function stopFeedTracking({record=false}={}){
  rememberShortAudio();
  clearInterval(audioTimer);
  audioTimer=null;
  if(observer){
    observer.disconnect();
    observer=null;
  }

  if(record){
    [...activeSessions.keys()].forEach(stopSession);
  }else{
    activeSessions.clear();
  }

  stopAllShorts();
}

export function initFeedTracking(){
  stopFeedTracking();

  for(const [el,record] of shortPlayers){
    if(!el.isConnected){
      record.player?.destroy();
      shortPlayers.delete(el);
    }
  }
  // Preserve the choice across feed re-renders and background/foreground,
  // but start muted again after leaving the Shorts feed.
  const shortsTabs=['inicio','siguiendo','saved'];
  if(state.contentMode!=='short'||!shortsTabs.includes(state.tab)){
  shortsMuted=true;
  shortsPlayed=0;
}

  if(!('IntersectionObserver' in window)) return;

  const items=[...document.querySelectorAll('.feed-item[data-video-id]')];
  if(!items.length) return;
  const shorts=items.filter(el=>el.classList.contains('short-item'));
  if(shorts.length){
    loadYouTubeApi().then(()=>{
      shorts.filter(el=>el.isConnected).forEach(attachShortPlayer);
    }).catch(error=>console.error(error));
    audioTimer=setInterval(rememberShortAudio,100);
  }

  observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      const el=entry.target;

      if(entry.isIntersecting&&entry.intersectionRatio>=0.65){
        if(!activeSessions.has(el)){
          activeSessions.set(el,performance.now());
        }
        if(el.classList.contains('short-item')&&entry.intersectionRatio>=0.75&&!el.classList.contains('is-playing')){
          playShortItem(el);
        }
      }else{
        if(activeSessions.has(el)) stopSession(el);
        if(el.classList.contains('short-item')) pauseShortItem(el);
      }
    });
  },{threshold:[0,0.25,0.65,0.75,0.9]});

  items.forEach(el=>observer.observe(el));
}

window.addEventListener('pagehide',()=>stopFeedTracking({record:true}));
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){
    stopFeedTracking({record:true});
  }else{
    initFeedTracking();
  }
});
