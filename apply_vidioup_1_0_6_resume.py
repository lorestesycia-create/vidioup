from pathlib import Path
import subprocess, sys, json

EXPECTED_BRANCH='vidioup-next'
EXPECTED_HEAD='b4b540ff0c059f068bb708ed14dc5aaef12ba123'
COMMIT_MESSAGE='Prepare VidioUp 1.0.6 UX fixes'

PARTIAL_EXPECTED={
    'www/js/context.js','www/js/feed.js','www/js/creator.js','www/style.css',
    'www/js/events.js','www/js/auth-events.js','www/js/signals.js',
    'www/config.json','build-config.json'
}
FINAL_EXPECTED=PARTIAL_EXPECTED|{'codemagic.yaml'}

def run(*args,check=True):
    p=subprocess.run(args,text=True,capture_output=True)
    if check and p.returncode!=0:
        print(p.stdout)
        print(p.stderr,file=sys.stderr)
        raise SystemExit(f'Fallo ejecutando: {" ".join(args)}')
    return p.stdout.strip()

def read(path):
    return Path(path).read_text(encoding='utf-8')

def write(path,text):
    Path(path).write_text(text,encoding='utf-8')

def replace_count(text,old,new,expected,label):
    count=text.count(old)
    if count!=expected:
        raise SystemExit(f'ABORTADO: {label}: esperaba {expected} coincidencia(s) y encontré {count}. No se ha hecho commit.')
    return text.replace(old,new)

branch=run('git','branch','--show-current')
head=run('git','rev-parse','HEAD')
if branch!=EXPECTED_BRANCH:
    raise SystemExit(f'ABORTADO: rama actual {branch!r}; debe ser {EXPECTED_BRANCH!r}.')
if head!=EXPECTED_HEAD:
    raise SystemExit(f'ABORTADO: HEAD actual {head}; esperaba {EXPECTED_HEAD}. No voy a continuar sobre otra base.')

changed=set(run('git','diff','--name-only').splitlines())
if changed!=PARTIAL_EXPECTED:
    raise SystemExit('ABORTADO: el estado local no coincide con el punto seguro de reanudación:\n'+'\n'.join(sorted(changed)))

# Verificar que el parche 1.0.6 quedó aplicado hasta el punto anterior.
checks={
    'www/js/context.js':['PENDING_AUTH_ACTION_KEY','takePendingAuthAction'],
    'www/js/feed.js':['creatorAvatar(','muted:true'],
    'www/js/creator.js':['profile-avatar','creatorAvatar(p.avatar_url'],
    'www/style.css':['[hidden]{display:none!important}','.creator-avatar{'],
    'www/js/events.js':['setPendingAuthAction','clearPendingAuthAction'],
    'www/js/auth-events.js':['finishAuthentication','completePendingAction'],
    'www/js/signals.js':['playMutedShortItem','autoplay-muted'],
}
for path,needles in checks.items():
    text=read(path)
    for needle in needles:
        if needle not in text:
            raise SystemExit(f'ABORTADO: falta {needle!r} en {path}. No se ha hecho commit.')

b=json.loads(read('build-config.json'))
w=json.loads(read('www/config.json'))
if not (b['android']['version_code']==7 and b['android']['version_name']=='1.0.6'):
    raise SystemExit('ABORTADO: build-config.json no está en 1.0.6 / code 7.')
if not (w['app']['versionCode']==7 and w['app']['versionName']=='1.0.6'):
    raise SystemExit('ABORTADO: www/config.json no está en 1.0.6 / code 7.')

# Corregir únicamente Codemagic. El fallo anterior era que versionName aparece dos veces a propósito.
p='codemagic.yaml'
s=read(p)
s=replace_count(s,'data["app"]["versionName"] = "1.0.5"','data["app"]["versionName"] = "1.0.6"',1,p+' bundle versionName')
s=replace_count(s,'data["app"]["versionCode"] = 6','data["app"]["versionCode"] = 7',1,p+' bundle versionCode')
s=replace_count(s,'"versionCode 6"','"versionCode 7"',1,p+' gradle versionCode')
s=replace_count(s,"'versionCode 6'","'versionCode 7'",1,p+' verify versionCode')
s=replace_count(s,"'versionName \"1.0.5\"'","'versionName \"1.0.6\"'",2,p+' versionName')
s=replace_count(s,'echo "VersionCode: 6"','echo "VersionCode: 7"',1,p+' echo code')
s=replace_count(s,'echo "VersionName: 1.0.5"','echo "VersionName: 1.0.6"',1,p+' echo name')
write(p,s)

# Validaciones de sintaxis y configuración.
for js in [
    'www/js/context.js','www/js/feed.js','www/js/creator.js',
    'www/js/events.js','www/js/auth-events.js','www/js/signals.js'
]:
    run('node','--check',js)
run('python3','preflight.py')

changed=set(run('git','diff','--name-only').splitlines())
if changed!=FINAL_EXPECTED:
    raise SystemExit('ABORTADO: lista final de archivos modificados inesperada:\n'+'\n'.join(sorted(changed)))

# Verificación explícita de Codemagic.
cm=read('codemagic.yaml')
for old in ['1.0.5','versionCode 6','VersionCode: 6','VersionName: 1.0.5']:
    if old in cm:
        raise SystemExit(f'ABORTADO: Codemagic conserva un valor antiguo: {old}')
for new in ['1.0.6','versionCode 7','VersionCode: 7','VersionName: 1.0.6']:
    if new not in cm:
        raise SystemExit(f'ABORTADO: falta en Codemagic: {new}')

print('VIDIOUP 1.0.6 RESUME OK')
print('Branch:',branch)
print('Base:',head)
print('Version: 1.0.6')
print('VersionCode: 7')
print('Archivos revisados:',len(changed))

run('git','add',*sorted(FINAL_EXPECTED))
run('git','commit','-m',COMMIT_MESSAGE)
new_head=run('git','rev-parse','HEAD')
print('Commit:',new_head)
run('git','push','origin',EXPECTED_BRANCH)
print('Push OK')
print('NO AAB BUILT')
