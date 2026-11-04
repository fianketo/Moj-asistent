"""Iz USDA FoodData Central (SR Legacy, javno dobro) izvlači hranljive vrednosti na 100 g
i težine porcija u kompaktan JSON: data/usda/sr.json"""
import csv, json, sys, os, collections
d = sys.argv[1]
NUT = {'1008': 'kcal', '1003': 'p', '1005': 'c', '1004': 'f', '1079': 'fib', '1093': 'na', '2000': 'sug'}
foods = {}
with open(os.path.join(d, 'food.csv'), encoding='utf-8') as fh:
    for r in csv.DictReader(fh):
        foods[r['fdc_id']] = {'d': r['description']}
with open(os.path.join(d, 'food_nutrient.csv'), encoding='utf-8') as fh:
    for r in csv.DictReader(fh):
        k = NUT.get(r['nutrient_id'])
        if k and r['fdc_id'] in foods:
            foods[r['fdc_id']][k] = round(float(r['amount'] or 0), 2)
mu = {}
if os.path.exists(os.path.join(d, 'measure_unit.csv')):
    with open(os.path.join(d, 'measure_unit.csv'), encoding='utf-8') as fh:
        for r in csv.DictReader(fh): mu[r['id']] = r['name']
with open(os.path.join(d, 'food_portion.csv'), encoding='utf-8') as fh:
    for r in csv.DictReader(fh):
        f = foods.get(r['fdc_id'])
        if not f: continue
        name = ' '.join(x for x in [r.get('amount', ''), mu.get(r.get('measure_unit_id', ''), ''), r.get('modifier', ''), r.get('portion_description', '')] if x and x != 'undetermined').strip()
        f.setdefault('por', []).append([name, round(float(r['gram_weight'] or 0), 1)])
json.dump(foods, open('data/usda/sr.json', 'w'), separators=(',', ':'))
print(len(foods), 'namirnica')
