#!/usr/bin/env python3
from pathlib import Path
import subprocess, json, sys

EXPECTED_HEAD = "776712d0edf77e110ad2f9a4bdd545f14b67aa2b"
BRANCH = "vidioup-next"

def run(cmd, check=True):
    print("$", " ".join(cmd))
    p = subprocess.run(cmd, text=True, capture_output=True)
    if p.stdout:
        print(p.stdout, end="")
    if p.stderr:
        print(p.stderr, end="", file=sys.stderr)
    if check and p.returncode != 0:
        raise SystemExit(p.returncode)
    return p

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"STOP: {label}: esperaba 1 coincidencia y encontré {count}.")
    return text.replace(old, new, 1)

print("VIDIOUP 1.0.6 GOOGLE PLAY PURCHASE PATCH")
print("No AAB will be generated. main will not be touched.")

branch = run(["git","branch","--show-current"]).stdout.strip()
head = run(["git","rev-parse","HEAD"]).stdout.strip()

if branch != BRANCH:
    raise SystemExit(f"STOP: rama actual {branch!r}; esperaba {BRANCH!r}.")
if head != EXPECTED_HEAD:
    raise SystemExit(f"STOP: HEAD actual {head}; esperaba {EXPECTED_HEAD}.")

targets = [
    "package.json",
    "www/app.js",
    "www/js/auth-events.js",
    "www/js/events.js",
]
for path in targets:
    if run(["git","diff","--quiet","--",path], check=False).returncode != 0:
        raise SystemExit(f"STOP: {path} tiene cambios locales previos.")
    if run(["git","diff","--cached","--quiet","--",path], check=False).returncode != 0:
        raise SystemExit(f"STOP: {path} tiene cambios staged previos.")

purchases_path = Path("www/js/purchases.js")
if purchases_path.exists():
    raise SystemExit("STOP: www/js/purchases.js ya existe; no continúo para no sobrescribirlo.")

pkg_path = Path("package.json")
pkg = json.loads(pkg_path.read_text(encoding="utf-8"))
deps = pkg.setdefault("dependencies", {})
if "capacitor-plugin-cdv-purchase" in deps:
    raise SystemExit("STOP: capacitor-plugin-cdv-purchase ya estaba configurado.")
deps["capacitor-plugin-cdv-purchase"] = "13.18.0"
pkg_path.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

app_path = Path("www/app.js")
app = app_path.read_text(encoding="utf-8")
app = replace_once(
    app,
    "import { render } from './js/ui.js';",
    "import { render, toast } from './js/ui.js';\nimport { initPurchases } from './js/purchases.js';",
    "app import"
)
app = replace_once(
    app,
    """  }finally{
    state.loading=false;
    render();
  }
}""",
    """  }finally{
    state.loading=false;
    render();

    if(state.session){
      initPurchases(render,toast).catch(()=>{});
    }
  }
}""",
    "app init purchases"
)
app_path.write_text(app, encoding="utf-8")

auth_path = Path("www/js/auth-events.js")
auth = auth_path.read_text(encoding="utf-8")
auth = replace_once(
    auth,
    "import { render, toast } from './ui.js';",
    "import { render, toast } from './ui.js';\nimport { initPurchases } from './purchases.js';",
    "auth import"
)
auth = replace_once(
    auth,
    """  render();
  restorePendingVideo(pending);

  if(pending){""",
    """  render();
  restorePendingVideo(pending);
  initPurchases(render,toast).catch(()=>{});

  if(pending){""",
    "auth init purchases"
)
auth_path.write_text(auth, encoding="utf-8")

events_path = Path("www/js/events.js")
events = events_path.read_text(encoding="utf-8")
events = replace_once(
    events,
    "import { stopFeedTracking } from './signals.js';",
    "import { stopFeedTracking } from './signals.js';\nimport { buyPack } from './purchases.js';",
    "events import"
)
events = replace_once(
    events,
    """    if(
      e.target.closest('[data-sku]')
    ){
      toast(
        'Las compras se activarán antes de publicar.'
      );
    }""",
    """    const packTarget=e.target.closest('[data-sku]');

    if(packTarget){
      packTarget.disabled=true;

      try{
        const result=await buyPack(
          packTarget.dataset.sku,
          render,
          toast
        );

        if(result?.cancelled){
          return;
        }
      }catch(x){
        toast(
          x.message ||
          'No se pudo iniciar la compra.'
        );
      }finally{
        packTarget.disabled=false;
      }

      return;
    }""",
    "events purchase handler"
)
events_path.write_text(events, encoding="utf-8")

purchases = r"""import { Capacitor } from '@capacitor/core';
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
"""
purchases_path.write_text(purchases, encoding="utf-8")

# Confirm version was not changed.
build = json.loads(Path("build-config.json").read_text(encoding="utf-8"))
webcfg = json.loads(Path("www/config.json").read_text(encoding="utf-8"))
if build["android"]["version_code"] != 7 or build["android"]["version_name"] != "1.0.6":
    raise SystemExit("STOP: build-config no está en 1.0.6 / code 7.")
if webcfg["app"]["versionCode"] != 7 or webcfg["app"]["versionName"] != "1.0.6":
    raise SystemExit("STOP: www/config no está en 1.0.6 / code 7.")

# Syntax checks.
for path in ["www/app.js","www/js/auth-events.js","www/js/events.js","www/js/purchases.js"]:
    run(["node","--check",path])

# Install only for a bundle/preflight test. No package-lock is created.
run([
    "npm","install","--no-save","--package-lock=false",
    "capacitor-plugin-cdv-purchase@13.18.0"
])
run([
    "npx","esbuild","www/app.js",
    "--bundle","--platform=browser","--format=iife",
    "--outfile=/tmp/vidioup-1.0.6-purchase-preflight.js"
])
run(["python3","preflight.py"])

run([
    "git","add",
    "package.json",
    "www/app.js",
    "www/js/auth-events.js",
    "www/js/events.js",
    "www/js/purchases.js"
])

staged = run(["git","diff","--cached","--name-only"]).stdout.strip().splitlines()
expected = sorted([
    "package.json",
    "www/app.js",
    "www/js/auth-events.js",
    "www/js/events.js",
    "www/js/purchases.js",
])
if sorted(staged) != expected:
    raise SystemExit(f"STOP: staged inesperado: {staged}")

run(["git","commit","-m","Add secure Google Play coin purchases"])
new_head = run(["git","rev-parse","HEAD"]).stdout.strip()

push = run(["git","push","origin",BRANCH], check=False)

print()
print("VIDIOUP PURCHASE PATCH OK")
print("Branch:", BRANCH)
print("Commit:", new_head)
print("Version: 1.0.6")
print("VersionCode: 7")
print("AAB: NOT GENERATED")
if push.returncode == 0:
    print("Push: OK")
else:
    print("Push: NEEDS REPLIT GIT PUSH BUTTON")
