#!/usr/bin/env python3
import json, urllib.request
def get(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'moj-asistent/1.0', 'Accept': 'application/json'}), timeout=90) as r:
            return r.status, dict(r.headers), r.read().decode('utf-8', 'replace')
    except Exception as e: return 0, {}, 'ERR ' + repr(e)
out = []
for u in ['https://opendata.kosava.cloud/api/v1/stations', 'https://opendata.kosava.cloud/api/v1/parameters',
          'https://opendata.kosava.cloud/api/v1/observations', 'https://opendata.kosava.cloud/api/v1/observations?limit=5',
          'https://opendata.kosava.cloud/api/v1/bulk', 'https://opendata.kosava.cloud/api/v1/metadata',
          'http://77.46.150.200/api/opendata/locations/', 'http://77.46.150.200/api/opendata/concentrations/',
          'http://77.46.150.200/api/opendata/pollens/2026/']:
    st, h, b = get(u)
    out.append(f'\n=== {u}\nstatus {st} ctype {h.get("Content-Type")} cors {h.get("Access-Control-Allow-Origin")} len {len(b)}\n' + b[:3500])
    if 'stations' in u and st == 200:
        try:
            d = json.loads(b); items = d if isinstance(d, list) else d.get('data') or d.get('stations') or d.get('items') or []
            out.append('NOVI SAD: ' + json.dumps([x for x in items if 'novi' in json.dumps(x, ensure_ascii=False).lower() or 'нови' in json.dumps(x, ensure_ascii=False).lower()], ensure_ascii=False)[:4000])
        except Exception as e: out.append('parse ' + repr(e))
open('data/datagov/sepa2.txt', 'w').write('\n'.join(out)); print('ok')
