import { cfg, state } from './context.js';
import { sb, headers, rpc } from './supabase.js';

export async function loadAccount(){
  const t=state.session.access_token;
  const uid=state.session.user.id;

  const [p,w]=await Promise.all([
    sb(
      `/rest/v1/users?id=eq.${encodeURIComponent(uid)}&select=id,email,display_name,status`,
      {headers:headers(t)}
    ),
    sb(
      `/rest/v1/wallets?user_id=eq.${encodeURIComponent(uid)}&select=available_coins,reserved_coins`,
      {headers:headers(t)}
    )
  ]);

  if(!p?.[0]||!w?.[0]){
    throw new Error('La cuenta existe, pero su perfil o monedero no está preparado.');
  }

  state.user={
    name:p[0].display_name||'Usuario',
    email:p[0].email||state.session.user.email||'',
    coins:w[0].available_coins,
    reserved:w[0].reserved_coins
  };
}

export async function loadCampaigns(){
  const rows=await rpc('get_my_campaigns_v2');
  state.campaigns=Array.isArray(rows)?rows:[];
}

export async function loadPromotedFeed(kind=state.contentMode){
  const rows=await rpc('get_promoted_feed',{
    p_content_kind:kind,
    p_limit:12
  });
  state.promotedFeed=Array.isArray(rows)?rows:[];
}

export async function loadOrganicFeed(kind=state.contentMode){
  const rows=await rpc('get_organic_feed',{
    p_content_kind:kind,
    p_limit:40
  });
  state.organicFeed=Array.isArray(rows)?rows:[];
}

export async function loadFollowingFeed(kind=state.contentMode){
  const rows=await rpc('get_following_feed',{
    p_content_kind:kind,
    p_limit:40
  });
  state.followingFeed=Array.isArray(rows)?rows:[];
}


export async function loadSavedVideos(kind=state.contentMode){
  const rows=await rpc('get_my_saved_videos',{
    p_content_kind:kind
  });
  state.savedVideos=Array.isArray(rows)?rows:[];
}

export async function loadFollowing(){
  const rows=await rpc('get_my_following');
  state.following=Array.isArray(rows)?rows:[];
}

export async function loadCreator(creatorId){
  const [profile,videos]=await Promise.all([
    rpc('get_creator_profile',{p_creator_id:creatorId}),
    rpc('get_creator_videos',{
      p_creator_id:creatorId,
      p_content_kind:null
    })
  ]);

  state.selectedCreator=Array.isArray(profile)?profile[0]||null:profile||null;
  state.selectedCreatorVideos=Array.isArray(videos)?videos:[];
}



export async function loadMyChannel(){
  const [profile,videos]=await Promise.all([
    rpc('get_my_creator_channel'),
    rpc('get_my_videos')
  ]);

  state.myCreatorChannel=Array.isArray(profile)?profile[0]||null:profile||null;
  state.myVideos=Array.isArray(videos)?videos:[];
}

export async function loadInterests(){
  const rows=await rpc('get_my_interests');
  state.interests=Array.isArray(rows)?rows.map(x=>x.interest).filter(Boolean):[];
  state.interestDraft=[...state.interests];
}


export async function loadBlockedUsers(){
  const rows=await rpc('get_my_blocked_users');
  state.blockedUsers=Array.isArray(rows)?rows:[];
}

export async function loadRewardStatus(){
  const s=await rpc('get_reward_status');

  state.rewardStatus={
    used_today:Number(s?.used_today||0),
    pending_today:Number(s?.pending_today||0),
    daily_limit:Number(s?.daily_limit||cfg.economy.rewarded_daily_limit),
    remaining_today:Number(s?.remaining_today??cfg.economy.rewarded_daily_limit)
  };
}

export const loadAppData=()=>
  Promise.all([
    loadAccount(),
    loadCampaigns(),
    loadPromotedFeed(),
    loadOrganicFeed(),
    loadFollowingFeed(),
    loadFollowing(),
    loadInterests(),
    loadRewardStatus()
  ]);
