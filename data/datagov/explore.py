#!/usr/bin/env python3
"""Pretraga data.gov.rs po temama korisnim za ličnog asistenta (Novi Sad)."""
import json, urllib.request, urllib.parse, time, sys
API = 'https://data.gov.rs/api/1/datasets/'
def get(url):
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'moj-asistent/1.0'}), timeout=60) as r: return json.load(r)
        except Exception as e: print('retry', e, file=sys.stderr); time.sleep(3)
    return {}
TOPICS = ['Novi Sad', 'Нови Сад', 'kvalitet vazduha', 'квалитет ваздуха', 'polen', 'полен', 'gorivo', 'гориво', 'apoteke', 'апотеке', 'lekovi', 'лекови', 'praznici', 'нерадни дани',
          'GTFS', 'javni prevoz', 'parking', 'паркинг', 'saobraćajne nezgode', 'саобраћајне незгоде', 'vodovod', 'voda za piće', 'вода за пиће', 'struja', 'temperatura', 'meteorološki', 'хидролошки',
          'Dunav vodostaj', 'kupališta', 'plaže', 'zdravstvene ustanove', 'здравствене установе', 'domovi zdravlja', 'vrtići', 'škole', 'adresni registar', 'ulice', 'biciklističke staze', 'punionice', 'električna vozila',
          'radarske kontrole', 'kamere', 'nadzemni', 'buka', 'ambrozija', 'UV indeks', 'cene hrane', 'pijace', 'zelene pijace', 'cene na pijacama']
out = {}
for q in TOPICS:
    d = get(API + '?' + urllib.parse.urlencode({'q': q, 'page_size': 15}))
    out[q] = [{'title': x.get('title'), 'org': (x.get('organization') or {}).get('name'), 'slug': x.get('slug'), 'modified': (x.get('last_modified') or '')[:10],
               'freq': x.get('frequency'), 'res': [(r.get('format'), r.get('url')) for r in (x.get('resources') or [])][:3], 'n': len(x.get('resources') or [])} for x in (d.get('data') or [])]
json.dump(out, open('data/datagov/explore.json', 'w'), ensure_ascii=False, indent=1)
with open('data/datagov/explore.txt', 'w') as f:
    for q, xs in out.items():
        f.write(f'\n### {q} ({len(xs)})\n')
        for x in xs: f.write(f"- {x['title'][:90]} | {x['org']} | {x['modified']} | {x['freq']} | {x['n']} res | {x['res'][:1]}\n")
print('ok')
