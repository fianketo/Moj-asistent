#!/usr/bin/env python3
"""Vazduh (SEPA, satni neverifikovani podaci) i polen (SEPA Polen API) za Novi Sad → okolina.json."""
import json, urllib.request, urllib.parse, csv, io, sys, datetime as D, math
UA = {'User-Agent': 'moj-asistent/1.0 (licna aplikacija)'}
def get(url, timeout=180):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r: return r.read()
now = D.datetime.now(D.timezone.utc)
out = {'updated': now.strftime('%Y-%m-%dT%H:%MZ'), 'city': 'Novi Sad'}

# ---------------- VAZDUH: Evropski indeks kvaliteta vazduha (EEA, 2017), pragovi u µg/m³
BANDS = {'PM10': [20, 40, 50, 100, 150], 'PM2.5': [10, 20, 25, 50, 75], 'NO2': [40, 90, 120, 230, 340], 'O3': [50, 100, 130, 240, 380], 'SO2': [100, 200, 350, 500, 750]}
LABEL = ['Dobar', 'Prihvatljiv', 'Umeren', 'Loš', 'Veoma loš', 'Izuzetno loš']
def level(code, v):
    b = BANDS.get(code); return None if b is None or v is None else next((i for i, t in enumerate(b) if v <= t), 5)
try:
    st = json.loads(get('https://opendata.kosava.cloud/api/v1/stations'))
    ns = {s['station_id']: s for s in st if (s.get('municipality') or '').strip().lower() == 'novi sad' and s.get('active', True)}
    since = now - D.timedelta(hours=30)
    rows = {}
    for sid in ns:  # satna merenja za poslednjih 30 h (API se osvežava svakog sata)
        q = urllib.parse.urlencode({'station_id': sid, 'from': since.strftime('%Y-%m-%dT%H:%M:%SZ')})
        for r in json.loads(get('https://opendata.kosava.cloud/api/v1/observations?' + q)).get('data', []):
            t = D.datetime.fromisoformat(r['time_end_utc'].replace('Z', '+00:00'))
            if t < since or r.get('value') is None: continue
            code = r['parameter_code'].replace('PM2,5', 'PM2.5').upper().replace('PM25', 'PM2.5')
            rows.setdefault(sid, {}).setdefault(code, []).append((t, float(r['value'])))
    stations = []
    for sid, params in rows.items():
        s = {'name': ns[sid]['station_name'], 'lat': ns[sid]['latitude'], 'lng': ns[sid]['longitude'], 'values': {}}
        worst, main, last_t = -1, None, None
        for code, vals in params.items():
            vals.sort(); t, v = vals[-1]
            last24 = [x for tt, x in vals if tt > t - D.timedelta(hours=24)]
            # čestice se ocenjuju po 24 h proseku, gasovi po poslednjem satu
            use = sum(last24) / len(last24) if code in ('PM10', 'PM2.5') and len(last24) >= 12 else v
            lv = level(code, use)
            s['values'][code] = {'now': round(v, 1), 'avg24': round(sum(last24) / len(last24), 1) if last24 else None, 'level': lv}
            if lv is not None and (now - t) < D.timedelta(hours=6) and lv > worst: worst, main = lv, code
            last_t = max(last_t or t, t)
        s['time'] = last_t.strftime('%Y-%m-%dT%H:%MZ') if last_t else None
        s['level'] = worst if worst >= 0 else None; s['label'] = LABEL[worst] if worst >= 0 else None; s['main'] = main
        stations.append(s)
    lv = max((s['level'] for s in stations if s['level'] is not None), default=None)
    out['air'] = {'stations': sorted(stations, key=lambda s: s['name']), 'level': lv, 'label': LABEL[lv] if lv is not None else None,
                  'src': 'Agencija za zaštitu životne sredine (SEPA) – satni neverifikovani podaci; Evropski indeks kvaliteta vazduha (EEA)'}
    print('vazduh:', [(s['name'], s['label'], s['main']) for s in stations])
except Exception as e:
    print('VAZDUH GREŠKA', repr(e)); out['air'] = None

# ---------------- POLEN
CYR = dict(zip('абвгдђежзијклљмнњопрстћуфхцчџш', ['a','b','v','g','d','đ','e','ž','z','i','j','k','l','lj','m','n','nj','o','p','r','s','t','ć','u','f','h','c','č','dž','š']))
def lat(s): return ''.join(CYR.get(c, CYR.get(c.lower(), c).capitalize() if c.lower() in CYR else c) for c in s)
try:
    base = 'http://77.46.150.200/api/opendata/'
    allerg = json.loads(get(base + 'allergens/'))
    types = {t['id']: lat(t['name']) for t in json.loads(get(base + 'allergen-types/'))}
    locs = json.loads(get(base + 'locations/'))
    loc = next((l for l in locs if 'НОВИ САД' in l['name'].upper()), None)
    if not loc:  # najbliža lokacija Novom Sadu
        loc = min(locs, key=lambda l: math.hypot(float(l['latitude']) - 45.255, float(l['longitude']) - 19.845))
    year = now.year
    data = [d for d in json.loads(get(base + f'pollens/{year}/', 300)) if d.get('location') == loc['name']]
    data.sort(key=lambda d: d['date'])
    last = data[-1] if data else None
    items = []
    if last:
        prev = data[-8:-1]
        for a in allerg:
            v = last.get(a['name'])
            if v is None: continue
            hi, lo = a.get('margine_top') or 100, a.get('margine_bottom') or 30
            lvl = 2 if v >= hi else 1 if v >= lo else 0
            trend = None
            if prev:
                pv = [p.get(a['name']) or 0 for p in prev]; avg = sum(pv) / len(pv)
                trend = 'raste' if v > avg * 1.3 and v >= 5 else 'opada' if v < avg * 0.7 and avg >= 5 else 'stabilno'
            items.append({'key': a['name'], 'name': lat(a['localized_name']).capitalize(), 'type': types.get(a['type'], ''), 'value': v, 'level': lvl,
                          'allergenicity': a.get('allergenicity_display'), 'hi': hi, 'lo': lo, 'trend': trend})
        items.sort(key=lambda x: (-x['level'], -x['value']))
    age = (now.date() - D.date.fromisoformat(last['date'])).days if last else None
    out['pollen'] = {'location': lat(loc['name']).title(), 'date': last['date'] if last else None, 'age_days': age, 'season': bool(last and age is not None and age <= 10),
                     'items': items, 'allergens': [{'key': a['name'], 'name': lat(a['localized_name']).capitalize(), 'type': types.get(a['type'], '')} for a in allerg],
                     'src': 'Agencija za zaštitu životne sredine – Polen API (koncentracija polenovih zrna u m³ vazduha)'}
    print('polen:', out['pollen']['location'], out['pollen']['date'], [(i['name'], i['value'], i['level']) for i in items[:5]])
except Exception as e:
    print('POLEN GREŠKA', repr(e)); out['pollen'] = None

json.dump(out, open(sys.argv[1], 'w'), ensure_ascii=False, separators=(',', ':'))
