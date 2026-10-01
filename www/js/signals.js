import { state, getGuestId } from './context.js';
import { rpc } from './supabase.js';

let observer=null;
const activeSessions=new Map();

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
  const iframe=el.querySelector('.player-shell iframe');
  youtubeCommand(iframe,'pauseVideo');
  el.classList.remove('is-playing');
}

function pauseOtherShorts(active){
  document.querySelectorAll('.short-item').forEach(item=>{
    if(item!==active) pauseShortItem(item);
  });
}

function playMutedShortItem(el){
  if(!el) return;
  pauseOtherShorts(el);
  const iframe=el.querySelector('.player-shell iframe');
  if(!iframe) return;

  const attempt=()=>{
    if(!activeSessions.has(el)||!el.isConnected) return;
    youtubeCommand(iframe,'mute');
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

  if(!('IntersectionObserver' in window)) return;

  const items=[...document.querySelectorAll('.feed-item[data-video-id]')];
  if(!items.length) return;

  observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      const el=entry.target;

      if(entry.isIntersecting&&entry.intersectionRatio>=0.65){
        if(!activeSessions.has(el)){
          activeSessions.set(el,performance.now());
        }
        if(el.classList.contains('short-item')&&entry.intersectionRatio>=0.75&&!el.classList.contains('is-playing')){
          playMutedShortItem(el);
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
