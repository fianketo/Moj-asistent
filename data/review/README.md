# Stručni pregled i izvori podataka

| Šta | Izvor | Gde |
|---|---|---|
| Kalorije, proteini, UH, masti, vlakna, natrijum | USDA FoodData Central – SR Legacy (2018) | `data/usda/` → `www/nutrition.js` |
| Alergeni | EU Uredba 1169/2011, Prilog II (14 alergena) | `www/safety.js` |
| Bezbednost hrane | USDA FSIS – Safe Minimum Internal Temperatures; FDA | `www/safety.js` |
| Fizička aktivnost | SZO (WHO) smernice 2020; upitnik po uzoru na PAR-Q+ | `www/safety.js` |
| Stručni pregled | popunjava stvarni stručnjak | `docs/strucni-pregled.xlsx` → `www/reviews.js` |

## Ponovno računanje nutritivnih vrednosti (posle izmene recepata)
```
node data/review/export.js --raw > /tmp/recipes.json
python3 data/usda/build_nutrition.py /tmp/recipes.json www/nutrition.js   # + data/usda/izvestaj.md
```

## Novi dokument za stručnjaka
```
node data/review/export.js > /tmp/full.json
python3 data/review/make_xlsx.py /tmp/full.json docs/strucni-pregled.xlsx
```

## Upis pregleda
Kada stručnjak vrati dokument: unesi ispravke u recepte/programe, pa u `www/reviews.js` dodaj
`'id-recepta': { by: 'Ime Prezime', title: 'zvanje', date: 'datum' }`. Oznaka „✔ Stručno pregledano“
se prikazuje SAMO za stavke upisane tamo.
