#!/usr/bin/env python3
"""Racuna nutritivne vrednosti po porciji iz USDA SR Legacy (data/usda/sr.json).
Ulaz: recipes.json (izvoz recepata iz aplikacije), izlaz: www/nutrition.js + izvestaj."""
import json, re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from map import M, IGNORE
from resolve import load

FRY = {'karadjordjeva': 0.2, 'becka': 0.2, 'kordon-blu': 0.2, 'mekike': 0.2}  # duboko przenje: upije se ~20% ulja
SPOON = {'kašika': 10, 'kašike': 10, 'kašičica': 4, 'kašičice': 4}
KEYS = ['kcal', 'p', 'c', 'f', 'fib', 'na', 'sug']

def grams(name, q, u, note, spec):
    _, gk, gp, edible, dens = spec
    note = note or ''
    m = re.search(r'(\d+(?:[.,]\d+)?)\s*g\b', note)
    if u in ('kom', 'pak') and m:
        g = float(m.group(1).replace(',', '.'))
    elif u in ('kom', 'pak') and (km := re.search(r'(\d+)\s*kriš', note)):
        g = int(km.group(1)) * 30  # kriska hleba ~30 g
    elif u in ('kom', 'pak') and (sm := re.search(r'(\d+)\s*(kašik\w*|kašičic\w*)', note)):
        g = int(sm.group(1)) * SPOON.get(sm.group(2), 10)
    elif u == 'g': g = q
    elif u == 'kg': g = q * 1000
    elif u == 'ml': g = q * dens
    elif u == 'l': g = q * 1000 * dens
    elif u == 'kom':
        if not gk: raise ValueError('nema g/kom za ' + name)
        g = q * gk
    elif u == 'pak':
        if (cm := re.search(r'(\d+)\s*komad', note)) and name == 'Tortilje': g = int(cm.group(1)) * 60
        elif not gp: raise ValueError('nema g/pak za ' + name)
        else: g = q * gp
    else: raise ValueError('jedinica ' + u + ' ' + name)
    return g * edible

def main(recipes_path, out_js):
    d = load(os.path.join(os.path.dirname(__file__), 'sr.json'))
    by = {v['d']: k for k, v in d.items()}
    R = json.load(open(recipes_path))
    out, rep, unknown = {}, [], set()
    for r in R:
        tot = dict.fromkeys(KEYS, 0.0)
        for it in r['ing']:
            name, q, u, note = (list(it) + [None, None, None])[:4]
            if q is None or name in IGNORE: continue
            if name not in M: unknown.add(name); continue
            spec = M[name]
            g = grams(name, q, u, note, spec)
            if 'ulje' in name.lower() and r['id'] in FRY: g *= FRY[r['id']]
            parts = spec[0] if isinstance(spec[0], list) else [(spec[0], 1)]
            for desc, frac in parts:
                f = d[by[desc]]
                for k in KEYS: tot[k] += (f.get(k) or 0) * g * frac / 100
        s = r['serv'] or 1
        per = [round(tot['kcal'] / s), round(tot['p'] / s, 1), round(tot['c'] / s, 1), round(tot['f'] / s, 1),
               round(tot['fib'] / s, 1), round(tot['na'] / s), round(tot['sug'] / s, 1)]
        out[r['id']] = per
        rep.append((r['id'], r['name'], r['kcal'], per[0], r['prot'], per[1]))
    if unknown: print('NEPOZNATI:', unknown)
    srcs = sorted({x[0] for v in M.values() for x in (v[0] if isinstance(v[0], list) else [(v[0], 1)])})
    with open(out_js, 'w') as fh:
        fh.write('// AUTOMATSKI GENERISANO: data/usda/build_nutrition.py – ne menjati rucno.\n')
        fh.write('// Izvor: USDA FoodData Central, SR Legacy (2018). Vrednosti po porciji: [kcal, proteini g, UH g, masti g, vlakna g, natrijum mg, secer g]\n')
        fh.write('var NUTRI = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
        fh.write('var NUTRI_SRC = ' + json.dumps({n: (v[0] if isinstance(v[0], str) else ' + '.join(f'{int(fr*100)}% {x}' for x, fr in v[0])) for n, v in M.items()}, ensure_ascii=False, separators=(',', ':')) + ';\n')
        fh.write('''(function () {
  if (typeof RECIPES === 'undefined') return;
  for (const r of RECIPES) {
    const n = NUTRI[r.id];
    if (!n) continue;
    r.est = { kcal: r.kcal, prot: r.prot };
    r.kcal = n[0]; r.prot = Math.round(n[1]);
    r.nut = { kcal: n[0], p: n[1], c: n[2], f: n[3], fib: n[4], na: n[5], sug: n[6] };
  }
})();
''')
    return rep

if __name__ == '__main__':
    rep = main(sys.argv[1], sys.argv[2])
    rep.sort(key=lambda x: -abs(x[3] - x[2]) / max(x[2], 1))
    big = [x for x in rep if abs(x[3] - x[2]) / max(x[2], 1) > 0.3]
    with open(os.path.join(os.path.dirname(__file__), 'izvestaj.md'), 'w') as fh:
        fh.write('# Poređenje: stare procene vs. USDA proračun (po porciji)\n\n')
        fh.write(f'Recepata: {len(rep)}; odstupanje > 30 %: {len(big)}\n\n| Recept | Staro kcal | USDA kcal | Staro prot | USDA prot |\n|---|---|---|---|---|\n')
        for x in rep: fh.write(f'| {x[1]} | {x[2]} | {x[3]} | {x[4]} | {x[5]} |\n')
    print(len(rep), 'recepata; odstupanje >30%:', len(big))
