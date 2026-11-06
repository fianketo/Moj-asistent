import json, urllib.request
def get(u):
    try: return urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'moj-asistent/1.0'}), timeout=120).read().decode('utf-8', 'replace')
    except Exception as e: return 'ERR ' + repr(e)
o = json.loads(get('https://opendata.kosava.cloud/openapi.json'))
out = []
for path, ops in o.get('paths', {}).items():
    if 'observ' in path or 'station' in path:
        for m, op in ops.items():
            out.append(f"{m.upper()} {path} :: " + ', '.join(f"{p.get('name')}({p.get('in')})" for p in op.get('parameters', [])))
for u in ['https://opendata.kosava.cloud/api/v1/observations?station_id=2&limit=3', 'https://opendata.kosava.cloud/api/v1/observations?station_id=2&parameter_code=PM10&window=1d']:
    t = get(u); out.append(f'=== {u} len {len(t)}\n{t[:1200]}')
open('data/datagov/sepa3.txt', 'w').write('\n'.join(out))
