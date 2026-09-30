import { Capacitor } from '@capacitor/core';
import {
  store,
  ProductType,
  Platform,
  LogLevel
} from 'capacitor-plugin-cdv-purchase';
import { cfg, state } from './context.js';
import { edge } from './supabase.js';
import { loadAccount } from './data.js';

let registered=false;
let initialized=false;
let initPromise=null;
let renderFn=null;
let toastFn=null;

const processing=new Set();

function configuredProductIds(){
  return (cfg?.store||[])
    .map(x=>x?.sku)
    .filter(Boolean);
}

function productIsConfigured(productId){
  return configuredProductIds().includes(productId);
}

function purchaseErrorMessage(error){
  const message=String(
    error?.message ||
    error?.error ||
    ''
  );

  if(/cancel|cancelad/i.test(message)){
    return null;
  }

  return message ||
    'No se pudo completar la compra con Google Play.';
}

async function processApproved(transaction){
  if(!transaction||transaction.isPending){
    return;
  }

  const productId=
    (transaction.products||[])
      .map(x=>x?.id)
      .find(productIsConfigured);

  const purchaseToken=
    String(transaction.purchaseId||'').trim();

  if(!productId||!purchaseToken){
    return;
  }

  if(processing.has(purchaseToken)){
    return;
  }

  processing.add(purchaseToken);

  try{
    if(!state.session?.user?.id){
      toastFn?.(
        'Inicia sesión para recuperar esta compra.'
      );
      return;
    }

    const result=
      await edge(
        'google-play-purchase',
        {
          product_id:productId,
          purchase_token:purchaseToken
        }
      );

    await transaction.finish();

    await loadAccount();

    renderFn?.();

    toastFn?.(
      result?.already_completed
        ? 'Compra recuperada correctamente.'
        : `+${Number(result?.coins||0).toLocaleString('es-ES')} monedas añadidas.`
    );

  }catch(error){
    const message=purchaseErrorMessage(error);

    if(message){
      toastFn?.(
        'La compra no se ha perdido. ' +
        message
      );
    }
  }finally{
    processing.delete(purchaseToken);
  }
}

function registerStoreHandlers(){
  if(registered) return;

  const ids=configuredProductIds();

  store.verbosity=LogLevel.ERROR;

  // Google Play receives an MD5-obfuscated account id in legacy mode.
  // The backend independently compares it with md5(auth.uid()) before
  // crediting any coins.
  store.applicationUsername=
    ()=>state.session?.user?.id||undefined;

  store.obfuscator='legacy';

  store.register(
    ids.map(id=>({
      id,
      type:ProductType.CONSUMABLE,
      platform:Platform.GOOGLE_PLAY
    }))
  );

  store.when()
    .approved(transaction=>{
      processApproved(transaction).catch(()=>{});
    });

  registered=true;
}

export async function initPurchases(render,toast){
  if(render) renderFn=render;
  if(toast) toastFn=toast;

  if(Capacitor.getPlatform()!=='android'){
    return false;
  }

  if(initialized){
    return true;
  }

  if(initPromise){
    return initPromise;
  }

  registerStoreHandlers();

  initPromise=(async()=>{
    await store.initialize([
      Platform.GOOGLE_PLAY
    ]);

    initialized=true;
    return true;
  })();

  try{
    return await initPromise;
  }catch(error){
    initPromise=null;
    throw error;
  }
}

export async function buyPack(
  sku,
  render,
  toast
){
  if(!state.session?.user?.id){
    throw new Error(
      'Inicia sesión para comprar monedas.'
    );
  }

  if(!productIsConfigured(sku)){
    throw new Error(
      'Este pack no está configurado.'
    );
  }

  if(Capacitor.getPlatform()!=='android'){
    throw new Error(
      'Las compras están disponibles en la app Android.'
    );
  }

  await initPurchases(render,toast);

  let product=
    store.get(
      sku,
      Platform.GOOGLE_PLAY
    );

  if(!product){
    await store.update();

    product=
      store.get(
        sku,
        Platform.GOOGLE_PLAY
      );
  }

  const offer=
    product?.getOffer?.() ||
    product?.offers?.[0];

  if(!product||!offer){
    throw new Error(
      'Este pack todavía no está disponible en Google Play.'
    );
  }

  const error=
    await store.order(offer);

  if(error){
    const message=
      purchaseErrorMessage(error);

    if(!message){
      return {cancelled:true};
    }

    throw new Error(message);
  }

  return {started:true};
}
