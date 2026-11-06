#!/usr/bin/env python3
"""Detalji skupova Agencije za zaštitu životne sredine (vazduh, polen) + uzorci odgovora API-ja."""
import json, urllib.request, urllib.parse, sys
def get(url, raw=False):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'moj-asistent/1.0'}), timeout=60) as r:
            b = r.read(); return b if raw else json.loads(b)
    except Exception as e: return ('ERR ' + repr(e)).encode() if raw else {'err': repr(e)}
out = []
for q in ['квалитет ваздуха', 'полен']:
    d = get('https://data.gov.rs/api/1/datasets/?' + urllib.parse.urlencode({'q': q, 'page_size': 10}))
    for x in d.get('data', []):
        if 'Агенција' not in ((x.get('organization') or {}).get('name') or ''): continue
        out.append(f"\n######## {x['title']}\n{(x.get('description') or '')[:3000]}")
        for r in x.get('resources', [])[:12]:
            out.append(f"--- RES {r.get('title')} {r.get('format')} {r.get('url')}\n{(r.get('description') or '')[:800]}")
            if r.get('format') in ('json', 'html', 'csv', 'api') or 'api' in (r.get('url') or ''):
                out.append(get(r['url'], raw=True)[:2500].decode('utf-8', 'replace'))
# probaj i poznate krajnje tačke
for u in ['http://77.46.150.200/api/opendata/schema', 'http://77.46.150.200/api/opendata/stations', 'http://77.46.150.200/api/opendata/']:
    out.append(f'--- TRY {u}\n' + get(u, raw=True)[:2500].decode('utf-8', 'replace'))
open('data/datagov/sepa.txt', 'w').write('\n'.join(out)); print('ok')
