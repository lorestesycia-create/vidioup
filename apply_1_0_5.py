from pathlib import Path
import json, subprocess, sys

EXPECTED_BRANCH = 'vidioup-next'
EXPECTED_HEAD = '5886ae8af4fe48082ef145735b1c59b68e6dd769'
FILES = [
    'build-config.json',
    'codemagic.yaml',
    'www/config.json',
    'www/app.js',
    'www/js/context.js',
    'www/js/supabase.js',
    'www/js/data.js',
    'www/js/ui.js',
    'www/js/auth-events.js',
    'www/js/events.js',
    'www/js/signals.js',
]

def run(cmd, check=True):
    return subprocess.run(cmd, text=True, capture_output=True, check=check)

def replace_once(text, old, new, path):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly 1 match, found {count}')
    return text.replace(old, new, 1)

def replace_n(text, old, new, expected, path):
    count = text.count(old)
    if count != expected:
        raise RuntimeError(f'{path}: expected {expected} matches for {old!r}, found {count}')
    return text.replace(old, new)

branch = run(['git','branch','--show-current']).stdout.strip()
head = run(['git','rev-parse','HEAD']).stdout.strip()
if branch != EXPECTED_BRANCH:
    raise SystemExit(f'STOP: current branch is {branch!r}, expected {EXPECTED_BRANCH!r}')
if head != EXPECTED_HEAD:
    raise SystemExit(f'STOP: current HEAD is {head}, expected {EXPECTED_HEAD}')
if run(['git','diff','--quiet'], check=False).returncode != 0 or run(['git','diff','--cached','--quiet'], check=False).returncode != 0:
    raise SystemExit('STOP: tracked files have uncommitted changes. Nothing was modified.')

original = {p: Path(p).read_text(encoding='utf-8') for p in FILES}
patched = dict(original)

# Version files
b = json.loads(patched['build-config.json'])
if b['android']['version_code'] != 5 or b['android']['version_name'] != '1.0.4':
    raise SystemExit('STOP: build-config.json is not version 1.0.4 / code 5')
b['android']['version_code'] = 6
b['android']['version_name'] = '1.0.5'
patched['build-config.json'] = json.dumps(b, ensure_ascii=False, indent=2) + '\n'

w = json.loads(patched['www/config.json'])
if w['app']['versionCode'] != 5 or w['app']['versionName'] != '1.0.4':
    raise SystemExit('STOP: www/config.json is not version 1.0.4 / code 5')
w['app']['versionCode'] = 6
w['app']['versionName'] = '1.0.5'
patched['www/config.json'] = json.dumps(w, ensure_ascii=False, indent=2) + '\n'

c = patched['codemagic.yaml']
c = replace_n(c, '1.0.4', '1.0.5', 4, 'codemagic.yaml')
c = replace_once(c, 'data["app"]["versionCode"] = 5', 'data["app"]["versionCode"] = 6', 'codemagic.yaml')
c = replace_n(c, 'versionCode 5', 'versionCode 6', 2, 'codemagic.yaml')
c = replace_once(c, 'VersionCode: 5', 'VersionCode: 6', 'codemagic.yaml')
patched['codemagic.yaml'] = c

# Guest installation identity + auth return target
p = patched['www/js/context.js']
p = replace_once(
    p,
    "export let cfg;\nexport const setCfg = value => { cfg = value; };\n\nexport const state = {",
    "export let cfg;\nexport const setCfg = value => { cfg = value; };\n\nconst GUEST_ID_KEY='vidioup_guest_id';\n\nexport function getGuestId(){\n  let id=localStorage.getItem(GUEST_ID_KEY);\n  if(id&&/^[A-Za-z0-9._-]{16,128}$/.test(id)) return id;\n\n  id=globalThis.crypto?.randomUUID?.()\n    || `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;\n\n  localStorage.setItem(GUEST_ID_KEY,id);\n  return id;\n}\n\nexport const state = {",
    'www/js/context.js'
)
p = replace_once(
    p,
    "  loading: true,\n  authMode: 'login'\n};",
    "  loading: true,\n  authMode: 'login',\n  authReturnTab: 'inicio'\n};",
    'www/js/context.js'
)
patched['www/js/context.js'] = p

# Supabase RPCs can now use the anon role when there is no session
p = patched['www/js/supabase.js']
p = replace_once(
    p,
    "export const headers = token => ({\n  apikey: cfg.services.supabase_publishable_key,\n  Authorization: `Bearer ${token}`,\n  'Content-Type':'application/json'\n});",
    "export const headers = token => {\n  const h={\n    apikey:cfg.services.supabase_publishable_key,\n    'Content-Type':'application/json'\n  };\n\n  if(token){\n    h.Authorization=`Bearer ${token}`;\n  }\n\n  return h;\n};",
    'www/js/supabase.js'
)
p = replace_n(p, "headers:headers(state.session.access_token),", "headers:headers(state.session?.access_token),", 2, 'www/js/supabase.js')
patched['www/js/supabase.js'] = p

# Public data loading + guest-aware promoted feed
p = patched['www/js/data.js']
p = replace_once(p, "import { cfg, state } from './context.js';", "import { cfg, state, getGuestId } from './context.js';", 'www/js/data.js')
p = replace_once(
    p,
    "export async function loadPromotedFeed(kind=state.contentMode){\n  const rows=await rpc('get_promoted_feed',{\n    p_content_kind:kind,\n    p_limit:12\n  });\n  state.promotedFeed=Array.isArray(rows)?rows:[];\n}",
    "export async function loadPromotedFeed(kind=state.contentMode){\n  const rows=await rpc('get_promoted_feed_v2',{\n    p_content_kind:kind,\n    p_limit:12,\n    p_guest_id:getGuestId()\n  });\n  state.promotedFeed=Array.isArray(rows)?rows:[];\n}",
    'www/js/data.js'
)
p = replace_once(
    p,
    "export const loadAppData=()=>\n  Promise.all([",
    "export const loadPublicData=()=>\n  Promise.all([\n    loadPromotedFeed(),\n    loadOrganicFeed()\n  ]);\n\nexport const loadAppData=()=>\n  Promise.all([",
    'www/js/data.js'
)
patched['www/js/data.js'] = p

# Auth is a gate for personal actions, not a wall in front of the app
p = patched['www/js/ui.js']
p = replace_once(
    p,
    "      <button class=\"ghost wide\" type=\"button\" data-action=\"${signup?'show-login':'show-signup'}\">${signup?'Ya tengo cuenta · Iniciar sesión':'Crear una cuenta'}</button>\n    </div></div>",
    "      <button class=\"ghost wide\" type=\"button\" data-action=\"${signup?'show-login':'show-signup'}\">${signup?'Ya tengo cuenta · Iniciar sesión':'Crear una cuenta'}</button>\n      <button class=\"ghost wide\" type=\"button\" data-action=\"guest-back\">Seguir viendo sin cuenta</button>\n    </div></div>",
    'www/js/ui.js'
)
p = replace_once(
    p,
    "  if(!state.session){\n    $('#app').innerHTML=authView();\n    document.querySelector('nav').hidden=true;\n    return;\n  }\n\n  const views={",
    "  if(state.tab==='auth'){\n    $('#app').innerHTML=authView();\n    document.querySelector('nav').hidden=true;\n    return;\n  }\n\n  const views={",
    'www/js/ui.js'
)
patched['www/js/ui.js'] = p

# After sign-in/sign-up, return to the section that requested authentication
p = patched['www/js/auth-events.js']
p = replace_once(
    p,
    "          saveSession(s);\n          await loadAppData();\n          render();\n          return;",
    "          saveSession(s);\n          await loadAppData();\n          state.tab=state.authReturnTab||'inicio';\n          state.authReturnTab='inicio';\n          render();\n          return;",
    'www/js/auth-events.js'
)
p = replace_once(
    p,
    "      saveSession(s);\n      await loadAppData();\n      render();",
    "      saveSession(s);\n      await loadAppData();\n      state.tab=state.authReturnTab||'inicio';\n      state.authReturnTab='inicio';\n      render();",
    'www/js/auth-events.js'
)
patched['www/js/auth-events.js'] = p

# Boot public feed even with no account
p = patched['www/app.js']
p = replace_once(p, "import { loadAppData } from './js/data.js';", "import { loadAppData, loadPublicData } from './js/data.js';", 'www/app.js')
old_boot = """async function boot(){
  try{
    setCfg(
      await fetch('config.json').then(r=>r.json())
    );

    const raw=localStorage.getItem('vidioup_session');

    if(raw){
      try{
        let s=JSON.parse(raw);

        if(s.refresh_token){
          try{
            s=await refreshSession(s.refresh_token);
            saveSession(s);
          }catch{
            saveSession(null);
          }
        }

        if(state.session){
          await loadAppData();
        }
      }catch{
        saveSession(null);
      }
    }
  }finally{
    state.loading=false;
    render();
  }
}
"""
new_boot = """async function boot(){
  try{
    setCfg(
      await fetch('config.json').then(r=>r.json())
    );

    const raw=localStorage.getItem('vidioup_session');

    if(raw){
      try{
        let s=JSON.parse(raw);

        if(s.refresh_token){
          try{
            s=await refreshSession(s.refresh_token);
            saveSession(s);
          }catch{
            saveSession(null);
          }
        }
      }catch{
        saveSession(null);
      }
    }

    if(state.session){
      await loadAppData();
    }else{
      await loadPublicData();
    }
  }finally{
    state.loading=false;
    render();
  }
}
"""
p = replace_once(p, old_boot, new_boot, 'www/app.js')
patched['www/app.js'] = p

# Events: guest gate, public mode switching, public logout return, guest promo clicks
p = patched['www/js/events.js']
p = replace_once(p, "import { cfg, state } from './context.js';", "import { cfg, state, getGuestId } from './context.js';", 'www/js/events.js')
p = replace_once(
    p,
    "import { loadAppData, loadPromotedFeed, loadOrganicFeed, loadFollowingFeed, loadFollowing, loadCreator, loadAccount, loadRewardStatus, loadInterests, loadSavedVideos, loadBlockedUsers, loadMyChannel } from './data.js';",
    "import { loadAppData, loadPublicData, loadPromotedFeed, loadOrganicFeed, loadFollowingFeed, loadFollowing, loadCreator, loadAccount, loadRewardStatus, loadInterests, loadSavedVideos, loadBlockedUsers, loadMyChannel } from './data.js';",
    'www/js/events.js'
)
insert_anchor = "import { stopFeedTracking } from './signals.js';\n\n"
insert_code = """import { stopFeedTracking } from './signals.js';

const AUTH_ONLY_TABS=new Set(['siguiendo','perfil']);
const AUTH_ONLY_ACTIONS=new Set([
  'wallet','go-promote','creator-studio','settings','go-campaigns',
  'studio-channel','view-my-public-profile','youtube-link-channel',
  'youtube-sync-channel','youtube-import-video','youtube-toggle-hidden',
  'youtube-change-kind','youtube-unlink','toggle-follow','block-creator',
  'not-interested','report-video','my-following','saved','interests',
  'toggle-interest','save-interests','account-security','blocked-users',
  'unblock-user','rewarded','toggle-favorite','campaign-preview','save-draft',
  'pause-campaign','resume-campaign','cancel-campaign'
]);

function showAuthGate(returnTab='inicio'){
  state.authReturnTab=returnTab&&returnTab!=='auth'?returnTab:'inicio';
  state.authMode='login';
  state.tab='auth';
  render();
}

"""
p = replace_once(p, insert_anchor, insert_code, 'www/js/events.js')
p = replace_once(
    p,
    "    if(tab){\n      stopFeedTracking({record:true});\n      state.tab=tab;",
    "    if(tab){\n      stopFeedTracking({record:true});\n\n      if(!state.session&&AUTH_ONLY_TABS.has(tab)){\n        showAuthGate(tab);\n        return;\n      }\n\n      state.tab=tab;",
    'www/js/events.js'
)
p = replace_once(
    p,
    "    const a=\n      target?.dataset.action;\n\n    if(a==='show-signup'){\n",
    "    const a=\n      target?.dataset.action;\n\n    if(!state.session&&AUTH_ONLY_ACTIONS.has(a)){\n      stopFeedTracking({record:true});\n      showAuthGate(state.tab);\n      return;\n    }\n\n    if(a==='show-signup'){\n",
    'www/js/events.js'
)
p = replace_once(
    p,
    "    if(a==='show-login'){\n      state.authMode='login';\n      render();\n      return;\n    }\n\n    if(a==='wallet'){\n",
    "    if(a==='show-login'){\n      state.authMode='login';\n      render();\n      return;\n    }\n\n    if(a==='guest-back'){\n      state.tab='inicio';\n      state.authReturnTab='inicio';\n      render();\n      return;\n    }\n\n    if(a==='wallet'){\n",
    'www/js/events.js'
)
p = replace_once(
    p,
    "      state.rewardStatus={\n        used_today:0,\n        pending_today:0,\n        daily_limit:\n          cfg?.economy?.rewarded_daily_limit||8,\n        remaining_today:\n          cfg?.economy?.rewarded_daily_limit||8\n      };\n\n      render();\n      return;",
    "      state.rewardStatus={\n        used_today:0,\n        pending_today:0,\n        daily_limit:\n          cfg?.economy?.rewarded_daily_limit||8,\n        remaining_today:\n          cfg?.economy?.rewarded_daily_limit||8\n      };\n\n      state.tab='inicio';\n      state.authReturnTab='inicio';\n\n      try{\n        await loadPublicData();\n      }catch{}\n\n      render();\n      return;",
    'www/js/events.js'
)
p = replace_once(
    p,
    "          loadOrganicFeed(mode),\n          loadPromotedFeed(mode),\n          loadFollowingFeed(mode),\n          state.tab==='saved'?loadSavedVideos(mode):Promise.resolve()",
    "          loadOrganicFeed(mode),\n          loadPromotedFeed(mode),\n          state.session?loadFollowingFeed(mode):Promise.resolve(),\n          state.session&&state.tab==='saved'?loadSavedVideos(mode):Promise.resolve()",
    'www/js/events.js'
)
p = replace_once(
    p,
    "        rpc(\n          'record_outbound_click',\n          {\n            p_campaign_id:campaignId,\n            p_video_id:target.dataset.videoId\n          }\n        ).catch(()=>{});",
    "        rpc(\n          'record_outbound_click_v2',\n          {\n            p_campaign_id:campaignId,\n            p_video_id:target.dataset.videoId,\n            p_guest_id:getGuestId()\n          }\n        ).catch(()=>{});",
    'www/js/events.js'
)
patched['www/js/events.js'] = p

# Playback observer must also work for guests; promo exposures use guest-safe v2 RPC
p = patched['www/js/signals.js']
p = replace_once(p, "import { state } from './context.js';", "import { state, getGuestId } from './context.js';", 'www/js/signals.js')
old_stop = """  const videoId=el.dataset.videoId;
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
"""
new_stop = """  const videoId=el.dataset.videoId;
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
"""
p = replace_once(p, old_stop, new_stop, 'www/js/signals.js')
p = replace_once(p, "  if(!state.session||!('IntersectionObserver' in window)) return;", "  if(!('IntersectionObserver' in window)) return;", 'www/js/signals.js')
patched['www/js/signals.js'] = p

# Write only after every expected replacement succeeded
try:
    for path, content in patched.items():
        Path(path).write_text(content, encoding='utf-8')

    checks = [
        ['python3','preflight.py'],
        ['node','--check','www/app.js'],
        ['node','--check','www/js/context.js'],
        ['node','--check','www/js/supabase.js'],
        ['node','--check','www/js/data.js'],
        ['node','--check','www/js/ui.js'],
        ['node','--check','www/js/auth-events.js'],
        ['node','--check','www/js/events.js'],
        ['node','--check','www/js/signals.js'],
    ]
    for cmd in checks:
        result = run(cmd, check=False)
        if result.returncode != 0:
            raise RuntimeError(f"Check failed: {' '.join(cmd)}\n{result.stdout}\n{result.stderr}")

    # Sanity checks for the release-critical values/guest behavior
    must_contain = {
        'build-config.json': ['"version_code": 6', '"version_name": "1.0.5"'],
        'www/config.json': ['"versionName": "1.0.5"', '"versionCode": 6'],
        'www/js/data.js': ['get_promoted_feed_v2', 'loadPublicData', 'p_guest_id:getGuestId()'],
        'www/js/signals.js': ['record_campaign_exposure_v2', "if(!('IntersectionObserver' in window)) return;"],
        'www/js/events.js': ['AUTH_ONLY_TABS', 'guest-back', 'record_outbound_click_v2'],
        'www/js/ui.js': ['Seguir viendo sin cuenta', "if(state.tab==='auth')"],
    }
    for path, needles in must_contain.items():
        text = Path(path).read_text(encoding='utf-8')
        for needle in needles:
            if needle not in text:
                raise RuntimeError(f'{path}: missing required check {needle!r}')

except Exception as e:
    for path, content in original.items():
        Path(path).write_text(content, encoding='utf-8')
    raise SystemExit(f'PATCH FAILED — all tracked files restored.\n{e}')

# Stage only the intended files, commit, and push the existing vidioup-next branch.
subprocess.run(['git','add',*FILES], check=True)
commit = subprocess.run(
    ['git','commit','-m','Enable guest browsing and guest promo tracking; bump Android to 1.0.5'],
    text=True,
    capture_output=True
)
if commit.returncode != 0:
    print(commit.stdout)
    print(commit.stderr, file=sys.stderr)
    raise SystemExit('PATCH OK, but git commit failed. Do not make more changes; show this screen.')

push = subprocess.run(['git','push','origin',EXPECTED_BRANCH], text=True, capture_output=True)
if push.returncode != 0:
    print(push.stdout)
    print(push.stderr, file=sys.stderr)
    raise SystemExit('COMMIT OK, but push failed. Do not make more changes; show this screen.')

new_head = run(['git','rev-parse','HEAD']).stdout.strip()
print('VIDIOUP 1.0.5 PATCH OK')
print('Branch:', EXPECTED_BRANCH)
print('Commit:', new_head)
print('Version: 1.0.5')
print('VersionCode: 6')
print('Push: OK')
