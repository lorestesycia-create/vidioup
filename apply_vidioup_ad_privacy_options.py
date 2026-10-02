#!/usr/bin/env python3
from pathlib import Path
import subprocess, sys, tempfile, shutil

ROOT = Path.cwd()
EXPECTED_BRANCH = "vidioup-next"
EXPECTED_HEAD = "c9f31aa154c17818e29b7283a61bede7e6415262"
FILES = [
    "package.json",
    "www/js/ads.js",
    "www/js/events.js",
    "www/js/profile.js",
]

def run(*args, check=True):
    p = subprocess.run(args, cwd=ROOT, text=True, capture_output=True)
    if check and p.returncode != 0:
        print(p.stdout)
        print(p.stderr, file=sys.stderr)
        raise SystemExit(f"Fallo ejecutando: {' '.join(args)}")
    return p

def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"ABORTADO: no encuentro el bloque esperado de {label}. No se ha aplicado el parche.")
    return text.replace(old, new, 1)

branch = run("git", "branch", "--show-current").stdout.strip()
head = run("git", "rev-parse", "HEAD").stdout.strip()
status_lines = run("git", "status", "--porcelain").stdout.splitlines()
tracked_changes = [line for line in status_lines if not line.startswith("??")]

if branch != EXPECTED_BRANCH:
    raise SystemExit(f"ABORTADO: estás en {branch!r}, no en {EXPECTED_BRANCH!r}.")
if head != EXPECTED_HEAD:
    raise SystemExit(f"ABORTADO: HEAD es {head}, esperaba {EXPECTED_HEAD}.")
if tracked_changes:
    print("Cambios reales detectados:")
    for line in tracked_changes:
        print(" ", line)
    raise SystemExit("ABORTADO: hay cambios reales sin guardar. No toco nada.")

for rel in FILES:
    if not (ROOT / rel).exists():
        raise SystemExit(f"ABORTADO: falta {rel}.")

backup = Path(tempfile.mkdtemp(prefix="vidioup_before_ad_privacy_"))
for rel in FILES:
    dst = backup / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / rel, dst)

try:
    p = ROOT / "package.json"
    text = p.read_text(encoding="utf-8")
    text = replace_once(
        text,
        '"@capacitor-community/admob": "^7.0.0"',
        '"@capacitor-community/admob": "^7.0.3"',
        "versión mínima de AdMob"
    )
    p.write_text(text, encoding="utf-8")

    p = ROOT / "www/js/ads.js"
    text = p.read_text(encoding="utf-8")
    marker = "\nexport async function showRewarded(render, toast){\n"
    privacy_fn = """
export async function showAdPrivacyOptions(){
  if(Capacitor.getPlatform()!=='android'){
    throw new Error(
      'Las opciones de privacidad de anuncios están disponibles en la app Android.'
    );
  }

  await AdMob.initialize();

  const consent=
    await AdMob.requestConsentInfo();

  if(
    consent?.privacyOptionsRequirementStatus!=='REQUIRED'
  ){
    return {shown:false,required:false};
  }

  await AdMob.showPrivacyOptionsForm();

  admobReady=false;

  return {shown:true,required:true};
}
"""
    if marker not in text:
        raise SystemExit("ABORTADO: no encuentro el punto esperado en ads.js.")
    text = text.replace(marker, "\n" + privacy_fn + marker, 1)
    p.write_text(text, encoding="utf-8")

    p = ROOT / "www/js/profile.js"
    text = p.read_text(encoding="utf-8")
    old = '        <button>⚑ Denunciar contenido</button>\n        <button data-action="legal-privacy">§ Legal y privacidad</button>\n'
    new = '        <button>⚑ Denunciar contenido</button>\n        <button data-action="ad-privacy">Privacidad de anuncios</button>\n        <button data-action="legal-privacy">§ Legal y privacidad</button>\n'
    text = replace_once(text, old, new, "botón de privacidad de anuncios")
    p.write_text(text, encoding="utf-8")

    p = ROOT / "www/js/events.js"
    text = p.read_text(encoding="utf-8")
    text = replace_once(
        text,
        "import { showRewarded } from './ads.js';",
        "import { showRewarded, showAdPrivacyOptions } from './ads.js';",
        "import de privacidad AdMob"
    )

    old = """    if(a==='legal-privacy'){
      window.open('https://vidioup-privacy.floot.app','_blank','noopener,noreferrer');
      return;
    }

    if(a==='open-delete-account'){
"""
    new = """    if(a==='ad-privacy'){
      target.disabled=true;
      try{
        const result=await showAdPrivacyOptions();
        toast(
          result?.shown
            ? 'Opciones de privacidad actualizadas.'
            : 'No se requieren opciones adicionales de privacidad de anuncios para tu región.'
        );
      }catch(x){
        toast(x.message||'No se pudieron abrir las opciones de privacidad de anuncios.');
      }finally{
        target.disabled=false;
      }
      return;
    }

    if(a==='legal-privacy'){
      window.open('https://vidioup-privacy.floot.app','_blank','noopener,noreferrer');
      return;
    }

    if(a==='open-delete-account'){
"""
    text = replace_once(text, old, new, "handler de privacidad AdMob")
    p.write_text(text, encoding="utf-8")

    run("git", "diff", "--check")

    bundle = run(
        "npx", "esbuild", "www/app.js",
        "--bundle",
        "--platform=browser",
        "--format=iife",
        "--outfile=/tmp/vidioup-ad-privacy-check.js",
        check=False
    )
    if bundle.returncode != 0:
        print(bundle.stdout)
        print(bundle.stderr, file=sys.stderr)
        raise RuntimeError("Falló la compilación de comprobación.")

    changed = sorted(run("git", "diff", "--name-only").stdout.strip().splitlines())
    expected = sorted(FILES)
    if changed != expected:
        raise RuntimeError(
            f"Archivos modificados inesperados. Esperaba {expected}, hay {changed}."
        )

except Exception as e:
    for rel in FILES:
        shutil.copy2(backup / rel, ROOT / rel)
    raise SystemExit(f"ABORTADO: {e} Se restauraron los archivos originales.")

print("PARCHE DE PRIVACIDAD ADMOB APLICADO Y VALIDADO.")
print("Rama:", branch)
print("HEAD base:", head)
print("Archivos modificados:")
for rel in FILES:
    print(" -", rel)
print("NO se ha hecho commit, push, merge, publicación ni cambio de versión.")
print("Backup temporal:", backup)
