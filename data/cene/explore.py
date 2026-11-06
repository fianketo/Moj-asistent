#!/usr/bin/env python3
"""Istraži data.gov.rs: svi skupovi podataka sa cenovnicima trgovaca (Pravilnik o objavljivanju cenovnika)."""
import json, urllib.request, urllib.parse, sys, time

API = 'https://data.gov.rs/api/1/datasets/'
def get(url):
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'moj-asistent-cene/1.0'}), timeout=60) as r:
                return json.load(r)
        except Exception as e:
            print('retry', url, e, file=sys.stderr); time.sleep(3)
    return {}

seen, out = set(), []
for q in ['cenovnik', 'cenovnici', 'ценовник', 'ценовници', 'pravilnik cenovnika', 'Lidl', 'Maxi', 'Delhaize', 'Mercator', 'Idea', 'Univerexport', 'Tempo', 'Aman', 'DIS', 'Roda', 'Gomex', 'Shop&Go', 'Lilly', 'DM', 'Metro', 'Super Vero']:
    page = 1
    while page <= 10:
        d = get(API + '?' + urllib.parse.urlencode({'q': q, 'page_size': 100, 'page': page}))
        data = d.get('data') or []
        for ds in data:
            if ds['id'] in seen: continue
            seen.add(ds['id'])
            out.append({
                'id': ds['id'], 'slug': ds.get('slug'), 'title': ds.get('title'),
                'org': (ds.get('organization') or {}).get('name'), 'owner': (ds.get('owner') or {}).get('slug') if ds.get('owner') else None,
                'modified': ds.get('last_modified') or ds.get('last_update'),
                'resources': [{'title': r.get('title'), 'url': r.get('url'), 'format': r.get('format'), 'size': r.get('filesize'), 'modified': r.get('last_modified')} for r in (ds.get('resources') or [])][:400],
                'nres': len(ds.get('resources') or []),
            })
        if not d.get('next_page'): break
        page += 1

out = [x for x in out if any(w in (x['title'] or '').lower() for w in ['cenovn', 'ценовн', 'cene', 'цене', 'price'])]
out.sort(key=lambda x: (x['org'] or '', x['title'] or ''))
json.dump(out, open('data/cene/datasets.json', 'w'), ensure_ascii=False, indent=1)
print(len(out), 'skupova')
for x in out: print(f"{x['org']!s:45.45} | {x['title']!s:70.70} | {x['nres']} res | {x['modified']}")
