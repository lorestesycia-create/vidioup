from pathlib import Path
import subprocess, sys, json

EXPECTED_BRANCH = 'vidioup-next'
EXPECTED_HEAD = 'b4b540ff0c059f068bb708ed14dc5aaef12ba123'
COMMIT_MESSAGE = 'Prepare VidioUp 1.0.6 UX fixes'


def run(*args, check=True):
    p = subprocess.run(args, text=True, capture_output=True)
    if check and p.returncode != 0:
        print(p.stdout)
        print(p.stderr, file=sys.stderr)
        raise SystemExit(f'Fallo ejecutando: {" ".join(args)}')
    return p.stdout.strip()


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')


def replace_exact(text, old, new, expected=1, label=''):
    count = text.count(old)
    if count != expected:
        raise SystemExit(f'ABORTADO: {label or "reemplazo"}: esperaba {expected} coincidencia(s) y encontré {count}. No se ha hecho commit.')
    return text.replace(old, new)


branch = run('git', 'branch', '--show-current')
head = run('git', 'rev-parse', 'HEAD')
if branch != EXPECTED_BRANCH:
    raise SystemExit(f'ABORTADO: rama actual {branch!r}; debe ser {EXPECTED_BRANCH!r}.')
if head != EXPECTED_HEAD:
    raise SystemExit(f'ABORTADO: HEAD actual {head}; esperaba {EXPECTED_HEAD}. No voy a aplicar el parche sobre otra base.')

tracked = run('git', 'status', '--porcelain', '--untracked-files=no')
if tracked:
    raise SystemExit('ABORTADO: hay cambios locales en archivos versionados. No voy a pisarlos.\n' + tracked)

# ---------- www/js/context.js ----------
p = 'www/js/context.js'
s = read(p)
s = replace_exact(
    s,
    "const GUEST_ID_KEY='vidioup_guest_id';\n",
    "const GUEST_ID_KEY='vidioup_guest_id';\nconst PENDING_AUTH_ACTION_KEY='vidioup_pending_auth_action';\n",
    label=p+' pending key'
)
s = replace_exact(
    s,
    "export const state = {\n",
    """export function setPendingAuthAction(value){
  if(!value){
    localStorage.removeItem(PENDING_AUTH_ACTION_KEY);
    return;
  }
  localStorage.setItem(PENDING_AUTH_ACTION_KEY,JSON.stringify(value));
}

export function takePendingAuthAction(){
  const raw=localStorage.getItem(PENDING_AUTH_ACTION_KEY);
  localStorage.removeItem(PENDING_AUTH_ACTION_KEY);
  if(!raw) return null;
  try{
    const value=JSON.parse(raw);
    return value&&typeof value==='object'?value:null;
  }catch{
    return null;
  }
}

export function clearPendingAuthAction(){
  localStorage.removeItem(PENDING_AUTH_ACTION_KEY);
}

export const state = {
""",
    label=p+' pending helpers'
)
write(p,s)

# ---------- www/js/feed.js ----------
p = 'www/js/feed.js'
s = read(p)
old = """function youtubeEmbed(videoId){
  if(!videoId) return '';
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?playsinline=1&rel=0&modestbranding=1&enablejsapi=1`;
}
"""
new = """function youtubeEmbed(videoId,{muted=false}={}){
  if(!videoId) return '';
  const mute=muted?'&mute=1':'';
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?playsinline=1&rel=0&modestbranding=1&enablejsapi=1${mute}`;
}

function creatorAvatar(url,creator){
  const initial=(creator?.[0]||'C').toUpperCase();
  return `
    <span class="mini-avatar creator-avatar">
      <span class="creator-avatar-fallback">${esc(initial)}</span>
      ${url?`<img src="${esc(url)}" alt="" loading="lazy" onerror="this.style.display='none'">`:''}
    </span>
  `;
}
"""
s = replace_exact(s, old, new, label=p+' youtube/avatar helper')
s = replace_exact(
    s,
    "function shortCard(v,{followingOnly=false}={}){\n  const title=v.video_title||'Vídeo de VidioUp';\n  const creator=v.creator_name||'Creador';\n  const embed=youtubeEmbed(v.youtube_video_id);",
    "function shortCard(v,{followingOnly=false}={}){\n  const title=v.video_title||'Vídeo de VidioUp';\n  const creator=v.creator_name||'Creador';\n  const embed=youtubeEmbed(v.youtube_video_id,{muted:true});",
    label=p+' muted short embed'
)
s = replace_exact(
    s,
    '<span class="mini-avatar">${esc((creator[0]||\'C\').toUpperCase())}</span>',
    '${creatorAvatar(v.creator_avatar_url,creator)}',
    expected=2,
    label=p+' feed avatars'
)
write(p,s)

# ---------- www/js/creator.js ----------
p = 'www/js/creator.js'
s = read(p)
s = replace_exact(
    s,
    "import { esc, money, card } from './utils.js';\n",
    """import { esc, money, card } from './utils.js';

function creatorAvatar(url,name){
  const initial=(name||'C')[0].toUpperCase();
  return `
    <div class="avatar large creator-avatar profile-avatar">
      <span class="creator-avatar-fallback">${esc(initial)}</span>
      ${url?`<img src="${esc(url)}" alt="" loading="lazy" onerror="this.style.display='none'">`:''}
    </div>
  `;
}
""",
    label=p+' helper'
)
s = replace_exact(
    s,
    "  const initial=(p.display_name||'C')[0].toUpperCase();\n",
    "",
    label=p+' remove initial'
)
s = replace_exact(
    s,
    '        <div class="avatar large">${esc(initial)}</div>',
    '        ${creatorAvatar(p.avatar_url,p.display_name)}',
    label=p+' public avatar'
)
write(p,s)

# ---------- www/style.css ----------
p = 'www/style.css'
s = read(p)
s = replace_exact(
    s,
    '*{box-sizing:border-box}\n',
    '*{box-sizing:border-box}\n[hidden]{display:none!important}\n',
    label=p+' hidden rule'
)
if '.creator-avatar-fallback{' in s:
    raise SystemExit('ABORTADO: estilos de avatar ya presentes inesperadamente.')
s += "\n.creator-avatar{position:relative;overflow:hidden}\n.creator-avatar>.creator-avatar-fallback{position:relative;z-index:0;display:grid;place-items:center;width:100%;height:100%}\n.creator-avatar>img{position:absolute;inset:0;z-index:1;width:100%;height:100%;object-fit:cover;border-radius:inherit;background:#0e111a}\n"
write(p,s)

# ---------- www/js/events.js ----------
p = 'www/js/events.js'
s = read(p)
s = replace_exact(
    s,
    "import { cfg, state, getGuestId } from './context.js';",
    "import { cfg, state, getGuestId, setPendingAuthAction, clearPendingAuthAction } from './context.js';",
    label=p+' imports'
)
s = replace_exact(
    s,
    """    if(!state.session&&AUTH_ONLY_ACTIONS.has(a)){
      stopFeedTracking({record:true});
      showAuthGate(state.tab);
      return;
    }
""",
    """    if(!state.session&&AUTH_ONLY_ACTIONS.has(a)){
      stopFeedTracking({record:true});

      if(a==='toggle-follow'||a==='toggle-favorite'){
        const item=target.closest('.feed-item');
        setPendingAuthAction({
          action:a,
          creatorId:target.dataset.creatorId||null,
          following:target.dataset.following==='1',
          campaignId:target.dataset.campaignId||null,
          videoId:target.dataset.videoId||item?.dataset.videoId||null,
          returnTab:state.tab
        });
      }else{
        clearPendingAuthAction();
      }

      showAuthGate(state.tab);
      return;
    }
""",
    label=p+' auth pending capture'
)
s = replace_exact(
    s,
    """    if(a==='guest-back'){
      state.tab='inicio';
      state.authReturnTab='inicio';
      render();
      return;
    }
""",
    """    if(a==='guest-back'){
      clearPendingAuthAction();
      state.tab='inicio';
      state.authReturnTab='inicio';
      render();
      return;
    }
""",
    label=p+' guest back clear'
)
s = replace_exact(
    s,
    """    if(a==='logout'){
      saveSession(null);
""",
    """    if(a==='logout'){
      clearPendingAuthAction();
      saveSession(null);
""",
    label=p+' logout clear'
)
write(p,s)

# ---------- www/js/auth-events.js ----------
p = 'www/js/auth-events.js'
s = read(p)
s = replace_exact(
    s,
    "import { state } from './context.js';",
    "import { state, takePendingAuthAction } from './context.js';",
    label=p+' context import'
)
s = replace_exact(
    s,
    "import { loadAppData } from './data.js';\nimport { render } from './ui.js';",
    """import { rpc } from './supabase.js';
import { loadAppData, loadCreator } from './data.js';
import { render, toast } from './ui.js';

async function completePendingAction(pending){
  if(!pending) return {completed:false};

  try{
    if(pending.action==='toggle-follow'&&pending.creatorId){
      if(pending.following){
        await rpc('unfollow_creator',{p_creator_id:pending.creatorId});
      }else if(pending.campaignId){
        await rpc('follow_creator_from_campaign',{
          p_creator_id:pending.creatorId,
          p_campaign_id:pending.campaignId
        });
      }else{
        await rpc('follow_creator',{p_creator_id:pending.creatorId});
      }
      return {completed:true};
    }

    if(pending.action==='toggle-favorite'&&pending.videoId){
      await rpc('add_favorite',{p_video_id:pending.videoId});
      return {completed:true};
    }

    return {completed:false};
  }catch(x){
    return {
      completed:false,
      error:x.message||'No se pudo completar la acción pendiente.'
    };
  }
}

function restorePendingVideo(pending){
  if(!pending?.videoId) return;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const item=document.querySelector(`[data-video-id="${CSS.escape(pending.videoId)}"]`);
    item?.scrollIntoView({block:'start'});
  }));
}

async function finishAuthentication(session){
  saveSession(session);

  const pending=takePendingAuthAction();
  const result=await completePendingAction(pending);

  await loadAppData();

  if(
    pending?.action==='toggle-follow' &&
    pending?.creatorId &&
    pending?.returnTab==='creator-profile'
  ){
    try{ await loadCreator(pending.creatorId); }catch{}
  }

  state.tab=pending?.returnTab||state.authReturnTab||'inicio';
  state.authReturnTab='inicio';
  render();
  restorePendingVideo(pending);

  if(pending){
    if(result.completed){
      toast(
        pending.action==='toggle-follow'
          ? 'Ahora sigues a este creador.'
          : 'Guardado en favoritos.'
      );
    }else if(result.error){
      toast(result.error);
    }
  }
}
""",
    label=p+' auth helpers'
)
s = replace_exact(
    s,
    """          saveSession(s);
          await loadAppData();
          state.tab=state.authReturnTab||'inicio';
          state.authReturnTab='inicio';
          render();
          return;
""",
    """          await finishAuthentication(s);
          return;
""",
    label=p+' signup finish'
)
s = replace_exact(
    s,
    """      saveSession(s);
      await loadAppData();
      state.tab=state.authReturnTab||'inicio';
      state.authReturnTab='inicio';
      render();
""",
    """      await finishAuthentication(s);
""",
    label=p+' login finish'
)
write(p,s)

# ---------- www/js/signals.js ----------
p = 'www/js/signals.js'
s = read(p)
s = replace_exact(
    s,
    "let shortAutoplayArmed=false;\nconst activeSessions=new Map();",
    "let shortAutoplayArmed=false;\nconst mutedAutoplay=new WeakSet();\nconst activeSessions=new Map();",
    label=p+' muted state'
)
s = replace_exact(
    s,
    """function pauseShortItem(el){
  if(!el) return;
  const iframe=el.querySelector('.player-shell iframe');
  youtubeCommand(iframe,'pauseVideo');
  el.classList.remove('is-playing');
}
""",
    """function pauseShortItem(el){
  if(!el) return;
  const iframe=el.querySelector('.player-shell iframe');
  youtubeCommand(iframe,'pauseVideo');
  mutedAutoplay.delete(el);
  el.classList.remove('is-playing','autoplay-muted');
}
""",
    label=p+' pause short'
)
s = replace_exact(
    s,
    """function playShortItem(el){
  if(!el) return;
  pauseOtherShorts(el);
  const iframe=el.querySelector('.player-shell iframe');
  youtubeCommand(iframe,'playVideo');
  el.classList.add('is-playing');
}
""",
    """function playShortItem(el){
  if(!el) return;
  pauseOtherShorts(el);
  const iframe=el.querySelector('.player-shell iframe');
  if(shortAutoplayArmed) youtubeCommand(iframe,'unMute');
  youtubeCommand(iframe,'playVideo');
  mutedAutoplay.delete(el);
  el.classList.remove('autoplay-muted');
  el.classList.add('is-playing');
}

function playMutedShortItem(el){
  if(!el||shortAutoplayArmed) return;
  pauseOtherShorts(el);
  const iframe=el.querySelector('.player-shell iframe');
  if(!iframe) return;

  const attempt=()=>{
    if(shortAutoplayArmed||!activeSessions.has(el)||!el.isConnected) return;
    youtubeCommand(iframe,'mute');
    youtubeCommand(iframe,'playVideo');
    mutedAutoplay.add(el);
    el.classList.add('is-playing','autoplay-muted');
  };

  attempt();

  if(!iframe.dataset.vidioupAutoplayHook){
    iframe.dataset.vidioupAutoplayHook='1';
    iframe.addEventListener('load',()=>setTimeout(attempt,120),{once:true});
  }

  setTimeout(attempt,450);
  setTimeout(attempt,1000);
}
""",
    label=p+' play short'
)
s = replace_exact(
    s,
    """          if(shortAutoplayArmed&&!el.classList.contains('is-playing')){
            playShortItem(el);
          }
""",
    """          if(shortAutoplayArmed&&!el.classList.contains('is-playing')){
            playShortItem(el);
          }else if(!shortAutoplayArmed&&!el.classList.contains('is-playing')){
            playMutedShortItem(el);
          }
""",
    label=p+' observer autoplay'
)
s = replace_exact(
    s,
    """document.addEventListener('click',e=>{
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
""",
    """document.addEventListener('click',e=>{
  const target=e.target.closest('[data-action="short-toggle-play"]');
  if(!target) return;

  const item=target.closest('.short-item');
  if(!item) return;

  if(mutedAutoplay.has(item)){
    shortAutoplayArmed=true;
    mutedAutoplay.delete(item);
    item.classList.remove('autoplay-muted');
    const iframe=item.querySelector('.player-shell iframe');
    youtubeCommand(iframe,'unMute');
    youtubeCommand(iframe,'playVideo');
    item.classList.add('is-playing');
    flashPlaybackState(item,true);
    return;
  }

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
""",
    label=p+' click sound unlock'
)
write(p,s)

# ---------- versions ----------
p='www/config.json'
data=json.loads(read(p))
data['app']['versionName']='1.0.6'
data['app']['versionCode']=7
write(p,json.dumps(data,ensure_ascii=False,indent=2)+'\n')

p='build-config.json'
data=json.loads(read(p))
data['android']['version_name']='1.0.6'
data['android']['version_code']=7
write(p,json.dumps(data,ensure_ascii=False,indent=2)+'\n')

p='codemagic.yaml'
s=read(p)
for old,new,label in [
    ('data["app"]["versionName"] = "1.0.5"','data["app"]["versionName"] = "1.0.6"','bundle versionName'),
    ('data["app"]["versionCode"] = 6','data["app"]["versionCode"] = 7','bundle versionCode'),
    ('"versionCode 6"','"versionCode 7"','gradle versionCode'),
    ('\'versionName "1.0.5"\'','\'versionName "1.0.6"\'','gradle versionName'),
    ("grep -q 'versionCode 6'","grep -q 'versionCode 7'",'verify code'),
    ('grep -q \'versionName "1.0.5"\'','grep -q \'versionName "1.0.6"\'','verify name'),
    ('echo "VersionCode: 6"','echo "VersionCode: 7"','echo code'),
    ('echo "VersionName: 1.0.5"','echo "VersionName: 1.0.6"','echo name'),
]:
    s=replace_exact(s,old,new,label=p+' '+label)
write(p,s)

# ---------- validation ----------
for js in [
    'www/js/context.js','www/js/feed.js','www/js/creator.js',
    'www/js/events.js','www/js/auth-events.js','www/js/signals.js'
]:
    run('node','--check',js)

run('python3','preflight.py')

# Make sure only intended tracked files changed.
changed=set(run('git','diff','--name-only').splitlines())
expected={
    'www/js/context.js','www/js/feed.js','www/js/creator.js','www/style.css',
    'www/js/events.js','www/js/auth-events.js','www/js/signals.js',
    'www/config.json','build-config.json','codemagic.yaml'
}
if changed != expected:
    raise SystemExit('ABORTADO: lista de archivos modificados inesperada:\n' + '\n'.join(sorted(changed)))

# Verify key version values.
b=json.loads(read('build-config.json'))
w=json.loads(read('www/config.json'))
assert b['android']['version_code']==7 and b['android']['version_name']=='1.0.6'
assert w['app']['versionCode']==7 and w['app']['versionName']=='1.0.6'

print('VIDIOUP 1.0.6 PATCH OK')
print('Branch:', branch)
print('Base:', head)
print('Version: 1.0.6')
print('VersionCode: 7')
print('Archivos revisados:', len(changed))

run('git','add',*sorted(expected))
run('git','commit','-m',COMMIT_MESSAGE)
new_head=run('git','rev-parse','HEAD')
print('Commit:',new_head)
run('git','push','origin',EXPECTED_BRANCH)
print('Push OK')
print('NO AAB BUILT')
