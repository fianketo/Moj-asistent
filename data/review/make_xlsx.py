#!/usr/bin/env python3
"""Pravi docs/strucni-pregled.xlsx iz izvoza (node data/review/export.js > full.json)."""
import json, sys
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

D = json.load(open(sys.argv[1])); OUT = sys.argv[2]
UNIT = lambda q, u: '' if q is None else f'{q:g} {u}'
HEAD = PatternFill('solid', fgColor='4F46E5'); REV = PatternFill('solid', fgColor='FEF9C3')
thin = Side(style='thin', color='CBD5E1')
wb = Workbook()

def sheet(title, cols, rows, review=True, widths=None):
    ws = wb.create_sheet(title)
    allc = cols + (['OCENA', 'Ispravka / komentar', 'Pregledao (ime, zvanje)', 'Datum'] if review else [])
    ws.append(allc)
    for i, c in enumerate(ws[1], 1):
        c.font = Font(bold=True, color='FFFFFF'); c.fill = HEAD if i <= len(cols) else PatternFill('solid', fgColor='CA8A04')
        c.alignment = Alignment(wrap_text=True, vertical='center')
    for r in rows: ws.append(list(r) + ([''] * 4 if review else []))
    for row in ws.iter_rows(min_row=2):
        for i, c in enumerate(row, 1):
            c.alignment = Alignment(wrap_text=True, vertical='top'); c.border = Border(top=thin, bottom=thin, left=thin, right=thin)
            if review and i > len(cols): c.fill = REV
    for i, w in enumerate((widths or []) + ([12, 40, 24, 12] if review else []), 1):
        ws.column_dimensions[ws.cell(1, i).column_letter].width = w
    ws.freeze_panes = 'C2'; ws.auto_filter.ref = ws.dimensions
    if review and rows:
        col = ws.cell(1, len(cols) + 1).column_letter
        dv = DataValidation(type='list', formula1='"OK,Ispravka,Ukloniti"', allow_blank=True); ws.add_data_validation(dv)
        dv.add(f'{col}2:{col}{len(rows) + 1}')
    return ws

ws = wb.active; ws.title = 'Uputstvo'
txt = [
 ('Stručni pregled sadržaja – aplikacija „Moj Asistent“', True),
 ('', False),
 ('Ovaj dokument sadrži SAV zdravstveni sadržaj aplikacije: recepte, planove ishrane, programe treninga i vežbe.', False),
 ('Molimo stručnjaka (nutricionista-dijetetičar, lekar, kineziolog / licencirani trener) da pregleda svoje područje.', False),
 ('', False),
 ('KAKO POPUNITI', True),
 ('1. U žutim kolonama izaberite OCENA: OK / Ispravka / Ukloniti.', False),
 ('2. Ako je „Ispravka“ – u koloni „Ispravka / komentar“ napišite šta treba promeniti (količina, korak, temperatura, broj serija…).', False),
 ('3. Upišite svoje ime i zvanje (npr. „dipl. nutricionista-dijetetičar“, „master kineziolog“) i datum.', False),
 ('4. Vratite popunjen dokument autoru aplikacije.', False),
 ('', False),
 ('ŠTA SE DEŠAVA POSLE', True),
 ('Ispravke se unose u aplikaciju. Samo za stavke sa ocenom OK (ili posle unete ispravke) aplikacija prikazuje oznaku', False),
 ('„✔ Stručno pregledano – ime, zvanje, datum“. Sve ostalo nosi oznaku „Nije stručno pregledano“.', False),
 ('', False),
 ('KAKO SU DOBIJENE VREDNOSTI', True),
 ('• Kalorije i makronutrijenti po porciji: izračunati iz USDA FoodData Central (SR Legacy, 2018) za svaki sastojak i njegovu količinu.', False),
 ('  Mapiranje sastojaka na USDA namirnice: data/usda/map.py u repozitorijumu. So i ulje „po ukusu“ nisu uračunati.', False),
 ('• Alergeni: EU Uredba 1169/2011, Prilog II (14 alergena) – određeni prema nazivu sastojka.', False),
 ('• Bezbednost hrane: USDA FSIS minimalne unutrašnje temperature (živina 74 °C, mleveno meso 71 °C, celi komadi i riba 63 °C + 3 min odmora).', False),
 ('• Fizička aktivnost: SZO smernice 2020; upitnik pre vežbanja po uzoru na PAR-Q+.', False),
 ('', False),
 (f'Sadržaj: {len(D["recipes"])} recepata, {len(D["plans"])} planova ishrane, {len(D["programs"])} programa treninga, {len(D["exercises"])} vežbi.', True),
]
for t, b in txt:
    ws.append([t]); ws.cell(ws.max_row, 1).font = Font(bold=b, size=14 if ws.max_row == 1 else 11)
ws.column_dimensions['A'].width = 130

def nut(n, k): return '' if not n else n[k]
sheet('Recepti', ['ID', 'Naziv', 'Vrsta', 'Porcija', 'Min', 'Sastojci', 'Priprema', 'Savet', 'kcal/porc.', 'Proteini g', 'UH g', 'Masti g', 'Vlakna g', 'Na mg', 'Alergeni (EU 14)', 'Bezbednost hrane'],
  [(r['id'], r['name'], r.get('type', ''), r['serv'], r['min'],
    '\n'.join(f'• {i[0]}' + (f' – {UNIT(i[1], i[2])}' if len(i) > 1 and i[1] is not None else '') + (f' ({i[3]})' if len(i) > 3 and i[3] else '') for i in r['ing']),
    '\n'.join(f'{k + 1}. {s}' for k, s in enumerate(r['steps'])), r.get('tip') or '',
    nut(r['nut'], 'kcal'), nut(r['nut'], 'p'), nut(r['nut'], 'c'), nut(r['nut'], 'f'), nut(r['nut'], 'fib'), nut(r['nut'], 'na'),
    ', '.join(r['allergens']) or '—', '\n'.join(r['safety'] + [D['safetyAlways']])) for r in D['recipes']],
  widths=[16, 28, 10, 7, 6, 38, 70, 30, 8, 8, 8, 8, 8, 8, 20, 45])
WD = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned']
sheet('Planovi ishrane', ['ID', 'Naziv', 'Kategorija', 'Energija (opis)', 'Cilj kcal/dan', 'Opis', 'Primer dana (obroci)'],
  [(p['id'], p['name'], p['cat'], p['kcal'], p['target'], p['desc'], '\n'.join(f'Dan {i + 1}: ' + ' | '.join(d) for i, d in enumerate(p['days']))) for p in D['plans']],
  widths=[14, 28, 12, 18, 10, 40, 80])
def fmt(o):
    if not isinstance(o, dict): return f'{o} s'
    if o.get('sets'): return f"{o['sets']}× " + (f"{o['reps']}" if o.get('reps') else f"{o['sec']} s") + (' /strana' if o.get('side') else '')
    return f"{o.get('sec', '')} s"
def wtxt(w):
    if w['items']: return f"{w['name']} (odmor {w.get('rest') or 60} s):\n" + '\n'.join(f'  • {n} – {fmt(o)}' for n, o in w['items'])
    return f"{w['name']} (intervali):\n" + '\n'.join(f'  • {n} – {s} s' for n, s in w['intervals'])
sheet('Programi treninga', ['ID', 'Naziv', 'Nivo', 'Dana nedeljno', 'Nedelja', 'Cilj', 'Opis', 'Napredovanje', 'Oprema', 'Treninzi'],
  [(t['id'], t['name'], t['level'], len(t['days']), t.get('weeks') or '', t.get('goal') or '', t['desc'], t.get('note') or '', ', '.join(t['equipment']) or 'bez opreme', '\n\n'.join(wtxt(w) for w in t['workouts'])) for t in D['programs']],
  widths=[14, 24, 14, 8, 8, 30, 36, 36, 20, 60])
sheet('Vežbe', ['ID', 'Naziv', 'Vrsta', 'Glavni mišići', 'Pomoćni', 'Oprema', 'Kako se radi', 'Tehnika', 'Česte greške', 'Lakše', 'Teže'],
  [(e['id'], e['name'], e.get('kind', ''), e.get('prim', ''), e.get('sec', ''), e.get('equip', ''), e.get('how', ''), '\n'.join(e.get('cues') or []), '\n'.join(e.get('mistakes') or []), e.get('easier', ''), e.get('harder', '')) for e in D['exercises']],
  widths=[14, 22, 10, 22, 22, 14, 45, 45, 40, 25, 25])
sheet('Bezbednost treninga', ['Vrsta', 'Tekst u aplikaciji'],
  [('Upitnik pre početka (pitanje ' + str(i + 1) + ')', q) for i, q in enumerate(D['parq'])] + [('Prekini ako osetiš', s) for s in D['stop']],
  widths=[34, 100])
wb.save(OUT)
print('OK', OUT)
