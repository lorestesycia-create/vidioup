import { state } from './context.js';
import { rpc } from './supabase.js';

let observer=null;
const activeSessions=new Map();

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
      }else if(activeSessions.has(el)){
        stopSession(el);
      }
    });
  },{threshold:[0,0.25,0.65,0.9]});

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
