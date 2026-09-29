export let cfg;
export const setCfg = value => { cfg = value; };

const GUEST_ID_KEY='vidioup_guest_id';

export function getGuestId(){
  let id=localStorage.getItem(GUEST_ID_KEY);
  if(id&&/^[A-Za-z0-9._-]{16,128}$/.test(id)) return id;

  id=globalThis.crypto?.randomUUID?.()
    || `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

  localStorage.setItem(GUEST_ID_KEY,id);
  return id;
}

export const state = {
  tab: 'inicio',
  session: null,
  user: { name: 'Creador', email: '', coins: 0, reserved: 0 },
  campaigns: [],
  promotedFeed: [],
  organicFeed: [],
  followingFeed: [],
  following: [],
  savedVideos: [],
  blockedUsers: [],
  interests: [],
  interestDraft: [],
  contentMode: 'short',
  exploreQuery: '',
  exploreCategory: '',
  selectedCreator: null,
  selectedCreatorVideos: [],
  myCreatorChannel: null,
  myVideos: [],
  rewardStatus: {
    used_today: 0,
    pending_today: 0,
    daily_limit: 8,
    remaining_today: 8
  },
  loading: true,
  authMode: 'login',
  authReturnTab: 'inicio'
};
