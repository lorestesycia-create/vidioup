#!/usr/bin/env python3
from pathlib import Path
import subprocess, sys, tempfile, shutil

ROOT = Path.cwd()
EXPECTED_BRANCH = "vidioup-next"
EXPECTED_HEAD = "4c310d0a47fc0cb421d834680d5a94a858732e46"
TARGET = ROOT / "www/js/youtube.js"

def run(*args, check=True):
    p = subprocess.run(args, cwd=ROOT, text=True, capture_output=True)
    if check and p.returncode != 0:
        print(p.stdout)
        print(p.stderr, file=sys.stderr)
        raise SystemExit(f"Fallo ejecutando: {' '.join(args)}")
    return p

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
if not TARGET.exists():
    raise SystemExit("ABORTADO: falta www/js/youtube.js.")

backup = Path(tempfile.mkdtemp(prefix="vidioup_before_terms_gate_"))
(backup / "youtube.js").write_bytes(TARGET.read_bytes())

text = TARGET.read_text(encoding="utf-8")

needle = """  const selected=p.youtube_default_category||'Entretenimiento';

  const linkedCard=linked?card(`
"""

replacement = """  const selected=p.youtube_default_category||'Entretenimiento';
  const termsAccepted=Boolean(
    p.creator_terms_accepted_at &&
    p.creator_terms_version==='2026-10-01'
  );

  if(!termsAccepted){
    return `
      <div class="section-title">
        <button class="back-btn" data-tab="creator">‹</button>
        <div><h2>Mi canal</h2><p>Contenido que aparecerá en VidioUp.</p></div>
      </div>
      ${card(`
        <h2>Antes de usar YouTube</h2>
        <p>Para enlazar, verificar, importar o promocionar contenido debes aceptar las condiciones para creadores y la Política de privacidad de VidioUp.</p>
        <p class="muted">Solo podrás usar contenido propio de un canal que controles. VidioUp utiliza los Servicios de la API de YouTube para consultar los datos públicos necesarios del canal y sus vídeos.</p>
        <p>
          <a href="https://vidioup-privacy.floot.app/terminos" target="_blank" rel="noopener">Leer condiciones</a>
          ·
          <a href="https://vidioup-privacy.floot.app" target="_blank" rel="noopener">Política de privacidad</a>
        </p>
        <button class="btn wide" data-action="accept-creator-terms">Aceptar y continuar</button>
      `)}
    `;
  }

  const linkedCard=linked?card(`
"""

if needle not in text:
    raise SystemExit("ABORTADO: no encuentro el bloque esperado. No he modificado nada.")

TARGET.write_text(text.replace(needle, replacement, 1), encoding="utf-8")

run("git", "diff", "--check")

bundle = run(
    "npx", "esbuild", "www/app.js",
    "--bundle",
    "--platform=browser",
    "--format=iife",
    "--outfile=/tmp/vidioup-terms-gate-check.js",
    check=False
)
if bundle.returncode != 0:
    print(bundle.stdout)
    print(bundle.stderr, file=sys.stderr)
    shutil.copy2(backup / "youtube.js", TARGET)
    raise SystemExit("ABORTADO: falló la validación y se restauró youtube.js.")

changed = run("git", "diff", "--name-only").stdout.strip().splitlines()
if changed != ["www/js/youtube.js"]:
    shutil.copy2(backup / "youtube.js", TARGET)
    raise SystemExit(f"ABORTADO: se modificaron archivos inesperados: {changed}. Se restauró youtube.js.")

print("PARCHE DE ACEPTACIÓN APLICADO Y VALIDADO.")
print("Rama:", branch)
print("HEAD base:", head)
print("Archivo modificado: www/js/youtube.js")
print("NO se ha hecho commit, push, merge, publicación ni cambio de versión.")
print("Backup temporal:", backup)
