#!/usr/bin/env python3
"""Dnevne cene iz zvaničnih cenovnika (Pravilnik o objavljivanju cenovnika, data.gov.rs).
Uzima VAŽEĆI cenovnik jednog formata po lancu, spaja proizvode po barkodu i pravi kompaktan cene.json za aplikaciju."""
import urllib.request, io, csv, json, re, sys, gzip, datetime, unicodedata, collections

# lanac: (URL, koji „format“ trgovca uzimamo, prikazni naziv)
CHAINS = [
  ('lidl', 'https://www.lidl.rs/explore/assets/webPriceData/rs/cene_proizvoda_Lidl.csv', None, 'Lidl'),
  ('maxi', 'https://tsmdelhaizeserbia.delhaize.rs/PublicDoc/cene_proizvoda_Delhaize.csv', 'Maxi', 'Maxi'),
  ('idea', 'https://ideacenovnici.blob.core.windows.net/cenovnici/drzavni/cene_proizvoda_ideamarketi.csv', 'IDEA', 'Idea'),
  ('mercator', 'https://ideacenovnici.blob.core.windows.net/cenovnici/drzavni/cene_proizvoda_ideamarketi.csv', 'MERCATOR', 'Mercator'),
  ('roda', 'https://ideacenovnici.blob.core.windows.net/cenovnici/drzavni/cene_proizvoda_ideamarketi.csv', 'RODA', 'Roda'),
  ('univer', 'https://ucloud.univerexport.rs/opendata/univer.csv', 'UNIVEREXPORT - M', 'Univerexport'),
  ('aman', 'https://lpfr.blob.core.windows.net/cene/cene_proizvoda_AMAN%20DOO.csv?sv=2025-07-05&spr=https&st=2026-10-14T11%3A04%3A33Z&se=2040-12-31T12%3A04%3A00Z&sr=b&sp=r&sig=YS0tjYdECfbCZNJpDrcjhG74bGKqbS%2BrKXxsVlNCqeg%3D', None, 'Aman'),
  ('gomex', 'https://aswcene.gomex.rs/upload/cene_proizvoda_gomex.csv', None, 'Gomex'),
  ('dm', 'https://www.dm.rs/prikaz-cena-dm', None, 'dm'),
  ('lilly', 'https://mis.lilly.rs/cene_proizvoda_Lilly_Drogerie.csv', None, 'Lilly'),
]
_cache = {}
def fetch(url):
    if url not in _cache:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 moj-asistent-cene/1.0 (licna aplikacija)'})
        _cache[url] = urllib.request.urlopen(req, timeout=240).read().decode('utf-8-sig', 'replace').replace('\x00', '')
    return _cache[url]
def num(s):
    s = (s or '').strip().replace(',', '.')
    try: v = float(s); return v if v > 0 else None
    except ValueError: return None
def dt(s):
    try: return datetime.datetime.strptime(s.strip(), '%d-%m-%Y').date()
    except Exception: return None
def norm(s):
    s = unicodedata.normalize('NFKD', s.lower().replace('đ', 'dj'))
    return re.sub(r'\s+', ' ', ''.join(c for c in s if not unicodedata.combining(c))).strip()

today = datetime.date.today()
products = {}   # ključ (ean ili lanac:naziv) → zapis
cats, report = {}, []
for key, url, fmt, label in CHAINS:
    try:
        rows = list(csv.reader(io.StringIO(fetch(url)), delimiter=';'))
    except Exception as e:
        report.append(f'{label}: GREŠKA {e!r}'); continue
    hdr = [h.strip().upper() for h in rows[0]]
    rows = [r for r in rows[1:] if len(r) >= 14]
    cur = [r for r in rows if 'VA' in r[14].upper() and 'ECI' in r[14].upper()] if len(hdr) > 14 else rows
    if len(cur) < 1000: cur = rows  # npr. Lilly: važeći cenovnik ima samo izmene – uzmi i mesečni presek
    if fmt: cur = [r for r in cur if r[6].strip() == fmt]
    elif cur:  # jedan format: najčešći (npr. jedna prodavnica Lilly)
        top = collections.Counter(r[6].strip() for r in cur).most_common(1)[0][0]; cur = [r for r in cur if r[6].strip() == top]
    if not cur: report.append(f'{label}: nema važećeg cenovnika'); continue
    # poslednja cena za svaki proizvod (važeći cenovnik sadrži najnoviji datum)
    last = max((dt(r[7]) for r in cur if dt(r[7])), default=None)
    byp = {}
    for r in sorted(cur, key=lambda r: dt(r[7]) or datetime.date.min):
        byp[(r[4].strip(), r[2].strip())] = r
    cur = list(byp.values())
    n = 0
    for r in cur:
        name, brand, ean, unit = r[2].strip(), r[3].strip(), re.sub(r'\D', '', r[4]), r[5].strip().lower()
        price, upj, sale = num(r[8]), num(r[9]), num(r[10])
        s0, s1 = dt(r[11]), dt(r[12])
        if not name or not price: continue
        if not (sale and sale < price and (not s0 or s0 <= today) and (not s1 or s1 >= today)): sale, s1 = None, None
        cats[r[0].strip()] = r[1].strip().capitalize()
        k = ean if len(ean) >= 8 and set(ean) != {'0'} else f'{key}:{norm(name)}'
        p = products.setdefault(k, {'n': name, 'b': brand, 'c': r[0].strip(), 'e': ean if len(ean) >= 8 and set(ean) != {'0'} else '', 'u': unit, 'p': {}})
        if key == 'lidl' or len(name) > len(p['n']) and not name.isupper(): p['n'] = name  # čitljiviji naziv
        p['p'][key] = [round(price, 2), round(sale, 2) if sale else 0, s1.strftime('%d.%m.') if s1 else '', round(upj, 2) if upj else 0]
        n += 1
    report.append(f'{label}: {n} proizvoda (cenovnik {last})')

chains = [c[0] for c in CHAINS]
out = {'date': today.isoformat(), 'chains': {c[0]: c[3] for c in CHAINS}, 'cats': cats,
       'src': 'Zvanični cenovnici trgovaca (Pravilnik o uslovima, sadržaju i načinu objavljivanja cenovnika), data.gov.rs',
       # [naziv, marka, kategorija, ean, jedinica, {lanac: [cena, akcijska, akcija do, cena po j.m.]}]
       'p': [[p['n'], p['b'], p['c'], p['e'], p['u'], p['p']] for p in products.values()]}
raw = json.dumps(out, ensure_ascii=False, separators=(',', ':')).encode()
open(sys.argv[1], 'wb').write(raw)
print('\n'.join(report)); print('proizvoda:', len(products), 'MB:', round(len(raw) / 1e6, 2), 'gzip MB:', round(len(gzip.compress(raw)) / 1e6, 2))
multi = sum(1 for p in products.values() if len(p['p']) > 1); print('u više lanaca:', multi)
