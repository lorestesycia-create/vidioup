export let cfg;
export const setCfg = value => { cfg = value; };

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
  authMode: 'login'
};
