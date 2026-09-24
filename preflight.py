import json,sys,os
b=json.load(open('build-config.json',encoding='utf-8'))
w=json.load(open('www/config.json',encoding='utf-8'))
errors=[]
def pending(name,value):
    if not value or (isinstance(value,str) and value.startswith('PENDING_')):
        errors.append(name)
for k,v in b['external_services'].items():
    if isinstance(v,str): pending('build-config external_services.'+k,v)
for k,v in w['services'].items(): pending('www/config services.'+k,v)
if b['android']['application_id']!=w['app']['package']: errors.append('package mismatch')
if b['android']['version_code']!=w['app']['versionCode']: errors.append('versionCode mismatch')
if b['android']['version_name']!=w['app']['versionName']: errors.append('versionName mismatch')
if errors:
    print('VIDIOUP NOT READY FOR CLOSED TESTING')
    for x in errors: print(' -',x)
    sys.exit(1)
print('VIDIOUP PREFLIGHT OK')
