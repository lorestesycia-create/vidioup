import { state } from './context.js';
import { rpc } from './supabase.js';

let observer=null;
let shortAutoplayArmed=false;
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

function playShortItem(el){
  if(!el) return;
  pauseOtherShorts(el);
  const iframe=el.querySelector('.player-shell iframe');
  youtubeCommand(iframe,'playVideo');
  el.classList.add('is-playing');
}

function stopAllShorts(){
  document.querySelectorAll('.short-item').forEach(pauseShortItem);
}

function flashPlaybackState(el,playing){
  const hint=el?.querySelector('.short-play-hint');
  if(!hint) return;
  hint.textContent=playing?'❚❚':'▶';
  hint.classList.add('visible');
  clearTimeout(hint._vidioupTimer);
  hint._vidioupTimer=setTimeout(()=>hint.classList.remove('visible'),650);
}

function stopSession(el){
  const started=activeSessions.get(el);
  if(!started) return;

  activeSessions.delete(el);

  const seconds=(performance.now()-started)/1000;
  if(seconds<0.6) return;

  const videoId=el.dataset.videoId;
  if(!videoId||!state.session) return;

  const visibleSeconds=Number(seconds.toFixed(1));

  rpc('record_video_signal',{
    p_video_id:videoId,
    p_visible_seconds:visibleSeconds,
    p_quick_swipe:seconds<2.5
  }).catch(()=>{});

  const campaignId=el.dataset.campaignId;
  if(campaignId){
    rpc('record_campaign_exposure',{
      p_campaign_id:campaignId,
      p_visible_seconds:visibleSeconds
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

  if(!state.session||!('IntersectionObserver' in window)) return;

  const items=[...document.querySelectorAll('.feed-item[data-video-id]')];
  if(!items.length) return;

  observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      const el=entry.target;

      if(entry.isIntersecting&&entry.intersectionRatio>=0.65){
        if(!activeSessions.has(el)){
          activeSessions.set(el,performance.now());
        }
        if(el.classList.contains('short-item')&&entry.intersectionRatio>=0.75){
          pauseOtherShorts(el);
          if(shortAutoplayArmed&&!el.classList.contains('is-playing')){
            playShortItem(el);
          }
        }
      }else{
        if(activeSessions.has(el)) stopSession(el);
        if(el.classList.contains('short-item')) pauseShortItem(el);
      }
    });
  },{threshold:[0,0.25,0.65,0.75,0.9]});

  items.forEach(el=>observer.observe(el));
}

document.addEventListener('click',e=>{
  const target=e.target.closest('[data-action="short-toggle-play"]');
  if(!target) return;

  const item=target.closest('.short-item');
  if(!item) return;

  const wasPlaying=item.classList.contains('is-playing');
  if(wasPlaying){
    pauseShortItem(item);
    flashPlaybackState(item,false);
  }else{
    shortAutoplayArmed=true;
    playShortItem(item);
    flashPlaybackState(item,true);
  }
});

window.addEventListener('pagehide',()=>stopFeedTracking({record:true}));
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){
    stopFeedTracking({record:true});
  }else{
    initFeedTracking();
  }
});
