// Izvoz celog sadržaja (recepti, planovi, programi, vežbe) u JSON za stručni pregled i USDA proračun.
// Upotreba: node data/review/export.js [--raw] > izlaz.json   (--raw = bez USDA vrednosti, za build_nutrition.py)
global.window = {}; const fs = require('fs'), path = require('path');
const W = path.join(__dirname, '../../www/'), raw = process.argv.includes('--raw');
const files = ['catalog', 'health', 'recipes2', 'recipes3', 'steps', 'exercises-pro', ...(raw ? [] : ['nutrition']), 'safety', 'reviews'];
global.esc = (s) => String(s);
eval(files.map((f) => fs.readFileSync(W + f + '.js', 'utf8')).join('\n') + `
globalThis.OUT = raw ? RECIPES.map((r) => ({ id: r.id, name: r.name, serv: r.serv, kcal: r.kcal, prot: r.prot, ing: r.ing })) : {
  recipes: RECIPES.map((r) => ({ id: r.id, name: r.name, type: r.type, serv: r.serv, min: r.min, ing: r.ing, steps: r.steps, tip: r.tip, nut: r.nut,
    allergens: recipeAllergens(r).map((k) => ALLERGENS[k].name), safety: recipeSafety(r).map((x) => x.t) })),
  plans: DIET_PLANS.map((p) => ({ id: p.id, name: p.name, kcal: p.kcal, target: PLAN_TARGET[p.id], desc: p.desc, cat: p.cat, days: p.days.map((d) => d.map((id) => { const r = RECIPES.find((x) => x.id === id); return r ? r.name : '—'; })) })),
  programs: TRAININGS.map((t) => ({ id: t.id, name: t.name, level: t.level, days: t.days, weeks: t.weeks, goal: t.goal, desc: t.desc, note: t.note, equipment: t.equipment,
    workouts: t.workouts.map((w) => ({ name: w.name, rest: w.rest, items: (w.items || []).map(([e, o]) => [EXERCISES[e].name, o]), intervals: (w.intervals || []).map(([e, s]) => [EXERCISES[e].name, s]) })) })),
  exercises: Object.entries(EXERCISES).filter(([k]) => k !== 'odmor').map(([k, e]) => ({ id: k, ...e })),
  safetyAlways: SAFETY_ALWAYS, parq: PARQ, stop: STOP_SIGNS,
};`);
process.stdout.write(JSON.stringify(OUT));
