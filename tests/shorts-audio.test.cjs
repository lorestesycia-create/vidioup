const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const test=require('node:test');

async function setup({delayedApi=false}={}){
  const state={tab:'inicio',contentMode:'short',session:null,organicFeed:[],promotedFeed:[]};
  const timers=[];
  const intervals=new Set();
  const players=[];
  const listeners={};
  let observer;
  let items=[];
  class Player{
    constructor(iframe,{events}){
      this.iframe=iframe;
      this.events=events;
      this.muted=true;
      this.commands=[];
      players.push(this);
    }
    isMuted(){ return this.muted; }
    mute(){ this.commands.push('mute'); this.muted=true; }
    unMute(){ this.commands.push('unMute'); this.muted=false; }
    playVideo(){ this.commands.push('playVideo'); }
    destroy(){ this.destroyed=true; }
    ready(){ this.events.onReady(); }
  }
  const window={
    addEventListener:(name,cb)=>{listeners[name]=cb;},
    YT:delayedApi?undefined:{Player}
  };
  class IntersectionObserver{
    constructor(cb){ this.cb=cb; observer=this; }
    observe(){}
    disconnect(){}
  }
  window.IntersectionObserver=IntersectionObserver;
  const document={
    hidden:false,
    querySelectorAll:()=>items,
    addEventListener:(name,cb)=>{listeners[name]=cb;},
    createElement:()=>({}),
    head:{appendChild:script=>{document.apiScript=script;}}
  };
  const context=vm.createContext({
    window,document,console,IntersectionObserver,URLSearchParams,
    location:{origin:'https://vidioup.test'},performance:{now:()=>1000},
    setTimeout:cb=>{timers.push(cb);},
    setInterval:cb=>{intervals.add(cb);return cb;},
    clearInterval:cb=>intervals.delete(cb)
  });
  const modules={
    './context.js':new vm.SyntheticModule(['state','getGuestId'],function(){
      this.setExport('state',state);this.setExport('getGuestId',()=> 'test-guest');
    },{context}),
    './supabase.js':new vm.SyntheticModule(['rpc'],function(){
      this.setExport('rpc',()=>Promise.resolve());
    },{context}),
    './utils.js':new vm.SyntheticModule(['esc'],function(){
      this.setExport('esc',value=>String(value??'').replaceAll('&','&amp;'));
    },{context})
  };
  const signals=new vm.SourceTextModule(fs.readFileSync('www/js/signals.js','utf8'),{context});
  await signals.link(name=>modules[name]);
  await signals.evaluate();
  const feed=new vm.SourceTextModule(fs.readFileSync('www/js/feed.js','utf8'),{context});
  await feed.link(name=>modules[name]);
  await feed.evaluate();
  function item(){
    const classes=new Set(['short-item']);
    const iframe={dataset:{},commands:[],contentWindow:{
      postMessage:message=>iframe.commands.push(JSON.parse(message).func)
    },addEventListener:()=>{}};
    return {iframe,isConnected:true,dataset:{videoId:'test-video'},
      classList:{contains:c=>classes.has(c),add:c=>classes.add(c),remove:c=>classes.delete(c)},
      querySelector:()=>iframe};
  }
  items=[item(),item(),item()];
  return {
    state,items,players,feed:feed.namespace,document,
    async init(){signals.namespace.initFeedTracking();await Promise.resolve();},
    enter(el){observer.cb([{target:el,isIntersecting:true,intersectionRatio:0.9}]);},
    leave(el){observer.cb([{target:el,isIntersecting:false,intersectionRatio:0}]);},
    poll(){for(const cb of intervals) cb();},
    retry(){for(const cb of timers.splice(0)) cb();},
    manual(player,muted){player.muted=muted;},
    async apiReady(){window.YT={Player};window.onYouTubeIframeAPIReady();await Promise.resolve();},
    stop(){signals.namespace.stopFeedTracking();},
    visibility(hidden){document.hidden=hidden;listeners.visibilitychange();},
    replace(){items.forEach(el=>{el.isConnected=false;});items=[item(),item()];this.items=items;}
  };
}

test('first Short and every initial Shorts embed start muted; long videos do not',async()=>{
  const s=await setup();
  s.state.organicFeed=[{youtube_video_id:'first'},{youtube_video_id:'second'}];
  assert.equal((s.feed.home().match(/mute=1/g)||[]).length,2);
  assert.match(s.feed.videoCard({youtube_video_id:'following'},{followingOnly:true}),/mute=1/);
  s.state.contentMode='video';
  assert.doesNotMatch(s.feed.home(),/mute=1/);
  s.state.contentMode='short';
  await s.init();
  s.enter(s.items[0]);s.players[0].ready();s.poll();
  assert.equal(s.players[0].isMuted(),true);
  assert.deepEqual(s.players[0].commands,['mute','playVideo']);
});

test('YouTube speaker unmute survives scroll, autoplay retries, and returning to an earlier Short',async()=>{
  const s=await setup();await s.init();
  s.enter(s.items[0]);s.players[0].ready();s.poll();
  s.manual(s.players[0],false);s.poll();s.retry();
  assert.equal(s.players[0].commands.filter(c=>c==='mute').length,1);
  assert.equal(s.players[0].isMuted(),false);
  s.leave(s.items[0]);s.enter(s.items[1]);s.players[1].ready();s.poll();s.retry();
  assert.equal(s.players[1].isMuted(),false);
  assert.equal(s.players[1].commands.includes('mute'),false);
  s.leave(s.items[1]);s.enter(s.items[0]);s.poll();s.retry();
  assert.equal(s.players[0].isMuted(),false);
  assert.equal(s.items[0].iframe.commands.includes('mute'),false);
});

test('manual mute is captured on rapid scroll even before the next polling tick',async()=>{
  const s=await setup();await s.init();
  s.enter(s.items[0]);s.players[0].ready();s.poll();
  s.manual(s.players[0],false);
  // Entering the next item before receiving the outgoing intersection must
  // capture its sound choice while pausing the previous player.
  s.enter(s.items[1]);s.players[1].ready();s.poll();
  assert.equal(s.players[1].isMuted(),false);
  s.manual(s.players[1],true);
  s.enter(s.items[2]);s.players[2].ready();s.poll();
  assert.equal(s.players[2].isMuted(),true);
});

test('inactive and late-ready players cannot overwrite the active sound preference',async()=>{
  const s=await setup();await s.init();
  s.enter(s.items[0]);s.players[0].ready();s.poll();
  s.manual(s.players[0],false);s.poll();
  s.enter(s.items[1]);s.enter(s.items[2]);
  s.players[1].ready();s.players[1].events.onStateChange();
  s.players[2].ready();s.poll();s.retry();
  assert.equal(s.players[2].isMuted(),false);
  assert.deepEqual(s.players[1].commands,[]);
  assert.equal(s.items[1].classList.contains('is-playing'),false);
});

test('asynchronous mute acknowledgements are not mistaken for manual changes',async()=>{
  const s=await setup();await s.init();
  s.enter(s.items[0]);s.players[0].ready();s.poll();
  s.manual(s.players[0],false);s.poll();
  s.players[1].unMute=function(){this.commands.push('unMute');};
  s.enter(s.items[1]);s.players[1].ready();
  s.poll(); // Its cached isMuted still reflects the initial muted embed.
  s.players[1].muted=false;s.poll();
  s.enter(s.items[2]);s.players[2].ready();s.poll();
  assert.equal(s.players[2].isMuted(),false);
});

test('sound survives backgrounding and feed re-render, but resets when leaving Shorts',async()=>{
  const s=await setup();await s.init();
  s.enter(s.items[0]);s.players[0].ready();s.poll();
  s.manual(s.players[0],false);
  s.visibility(true);s.visibility(false);await Promise.resolve();
  s.enter(s.items[0]);s.poll();
  assert.equal(s.players[0].isMuted(),false);
  s.replace();await s.init();s.enter(s.items[0]);s.players[3].ready();s.poll();
  assert.equal(s.players[3].isMuted(),false);
  assert.equal(s.players[0].destroyed,true);
  s.state.contentMode='video';await s.init();
  s.state.contentMode='short';await s.init();s.enter(s.items[0]);s.poll();
  assert.equal(s.players[3].isMuted(),true);
});

test('late API loading keeps the first Short muted and only starts the currently active player',async()=>{
  const s=await setup({delayedApi:true});await s.init();
  assert.equal(s.document.apiScript.src,'https://www.youtube.com/iframe_api');
  s.enter(s.items[0]);s.enter(s.items[1]);s.retry();
  await s.apiReady();
  s.players[0].ready();s.players[1].ready();s.poll();
  assert.deepEqual(s.players[0].commands,[]);
  assert.equal(s.players[1].isMuted(),true);
  assert.equal(s.items[0].iframe.commands.includes('mute'),false);
});