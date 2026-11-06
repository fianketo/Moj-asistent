#!/usr/bin/env python3
"""Preuzmi cenovnike velikih lanaca i sačuvaj uzorak (zaglavlje + 40 redova + statistika) da vidimo format."""
import urllib.request, io, os, sys, csv, collections
SRC = {
  'maxi': 'https://tsmdelhaizeserbia.delhaize.rs/PublicDoc/cene_proizvoda_Delhaize.csv',
  'idea': 'https://ideacenovnici.blob.core.windows.net/cenovnici/drzavni/cene_proizvoda_ideamarketi.csv',
  'lidl': 'https://www.lidl.rs/explore/assets/webPriceData/rs/cene_proizvoda_Lidl.csv',
  'univerexport': 'https://ucloud.univerexport.rs/opendata/univer.csv',
  'aman': 'https://lpfr.blob.core.windows.net/cene/cene_proizvoda_AMAN%20DOO.csv?sv=2025-07-05&spr=https&st=2026-10-14T11%3A04%3A33Z&se=2040-12-31T12%3A04%3A00Z&sr=b&sp=r&sig=YS0tjYdECfbCZNJpDrcjhG74bGKqbS%2BrKXxsVlNCqeg%3D',
  'gomex': 'https://aswcene.gomex.rs/upload/cene_proizvoda_gomex.csv',
  'lilly': 'https://mis.lilly.rs/cene_proizvoda_Lilly_Drogerie.csv',
  'dm': 'https://www.dm.rs/prikaz-cena-dm',
  'mikromarket': 'https://mikromarket.rs/cenovnik/cene_proizvoda_mikromarketns.csv',
}
os.makedirs('data/cene/samples', exist_ok=True)
os.makedirs('/tmp/cene', exist_ok=True)
for k, url in SRC.items():
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 moj-asistent-cene/1.0'})
        raw = urllib.request.urlopen(req, timeout=180).read()
        open(f'/tmp/cene/{k}.csv', 'wb').write(raw)
        for enc in ('utf-8-sig', 'cp1250', 'latin-1'):
            try: txt = raw.decode(enc); break
            except UnicodeDecodeError: pass
        lines = txt.splitlines()
        delim = max([';', ',', '\t', '|'], key=lambda d: lines[0].count(d))
        rows = list(csv.reader(io.StringIO(txt), delimiter=delim))
        hdr = rows[0]
        stats = []
        for i, h in enumerate(hdr[:30]):
            vals = collections.Counter(r[i] for r in rows[1:] if len(r) > i)
            stats.append(f'  [{i}] {h!r}: {len(vals)} različitih; npr. {list(vals.most_common(3))}')
        with open(f'data/cene/samples/{k}.txt', 'w') as f:
            f.write(f'URL {url}\nbajtova {len(raw)} enc {enc} delim {delim!r} redova {len(rows)}\n\nKOLONE\n' + '\n'.join(stats) + '\n\nPRVIH 25\n' + '\n'.join(lines[:25]) + '\n')
        print(k, 'ok', len(rows))
    except Exception as e:
        open(f'data/cene/samples/{k}.txt', 'w').write(f'GREŠKA {url}\n{e!r}\n'); print(k, 'GREŠKA', e)
