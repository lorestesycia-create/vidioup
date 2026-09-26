import { Capacitor } from '@capacitor/core';
import { AdMob, AdmobConsentStatus } from '@capacitor-community/admob';
import { cfg, state } from './context.js';
import { sleep } from './utils.js';
import { rpc } from './supabase.js';
import { loadAccount, loadRewardStatus } from './data.js';
let admobReady=false;

async function ensureAdMob(){
  if(admobReady) return true;

  if(Capacitor.getPlatform()==='web'){
    throw new Error(
      'Los anuncios solo están disponibles en la app Android.'
    );
  }

  await AdMob.initialize();

  let consent=
    await AdMob.requestConsentInfo();

  if(
    consent.isConsentFormAvailable &&
    consent.status===AdmobConsentStatus.REQUIRED
  ){
    consent=
      await AdMob.showConsentForm();
  }

  if(!consent.canRequestAds){
    throw new Error(
      'Todavía no se pueden solicitar anuncios.'
    );
  }

  admobReady=true;
  return true;
}

export async function showRewarded(render, toast){
  if(!state.session?.user?.id){
    throw new Error(
      'Inicia sesión de nuevo.'
    );
  }

  if(
    (state.rewardStatus?.remaining_today??1)<=0
  ){
    throw new Error(
      'Has alcanzado el límite diario de anuncios.'
    );
  }

  await ensureAdMob();

  const eventId=crypto.randomUUID();
  const start=Number(state.user.coins||0);

  await AdMob.prepareRewardVideoAd({
    adId:cfg.services.rewarded_ad_unit_id,
    isTesting:false,
    ssv:{
      userId:state.session.user.id,
      customData:eventId
    }
  });

  const reward=
    await AdMob.showRewardVideoAd();

  if(
    !reward ||
    Number(reward.amount||0)<=0
  ){
    throw new Error(
      'El anuncio terminó sin generar una recompensa.'
    );
  }

  try{
    await rpc(
      'register_rewarded_pending',
      {
        p_external_event_id:eventId
      }
    );
  }catch(x){
    if(
      /DAILY_LIMIT_REACHED/i.test(
        x.message||''
      )
    ){
      throw new Error(
        'Has alcanzado el límite diario de anuncios.'
      );
    }

    throw x;
  }

  for(
    const ms of [1000,2000,3000,5000,8000]
  ){
    await sleep(ms);

    try{
      await Promise.all([
        loadAccount(),
        loadRewardStatus()
      ]);

      if(Number(state.user.coins)>start){
        render();

        toast(
          `+${cfg.economy.rewarded_coin_reward} monedas acreditadas.`
        );

        return;
      }
    }catch{}
  }

  try{
    await Promise.all([
      loadAccount(),
      loadRewardStatus()
    ]);
  }catch{}

  render();

  toast(
    'Anuncio completado. Recompensa pendiente de verificación.'
  );
}
