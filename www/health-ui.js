/* Zdravlje – ekrani: Danas, Recepti, Ishrana, Treninzi i vođeni trening. */
'use strict';

const H = () => (S.health = Object.assign({ plan: null, program: null, favs: [], log: [], persons: 1, weights: {} }, S.health || {}));
const recipeById = (id) => RECIPES.find((r) => r.id === id);
const WD = ['Nedelja', 'Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota'];
const WD_SHORT = ['ned', 'pon', 'uto', 'sre', 'čet', 'pet', 'sub'];
const planDayIdx = (d = new Date()) => (d.getDay() + 6) % 7; // pon=0 … ned=6
const MEAL_KEYS = Object.keys(MEALS);
// apsolutni broj nedelje (od ponedeljka)
const REF_MONDAY = new Date(2024, 0, 1); // ponedeljak
const weekAbs = (d = new Date()) => { const m = startOfDay(d); m.setDate(m.getDate() - planDayIdx(m)); return Math.round((m - REF_MONDAY) / (7 * DAY)); };
const weekStart = (w) => { const d = new Date(REF_MONDAY); d.setDate(d.getDate() + w * 7); return d; };
function seeded(seed) {
  let h = 1779033703;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 3432918353), h = (h << 13) | (h >>> 19);
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
function mealPool(plan, m) {
  const rule = PLAN_RULES[plan.id] || (() => true);
  // glavni obroci moraju biti dovoljno hranljivi (prilozi i lake čorbe ne mogu biti ceo ručak)
  const minK = { dorucak: 180, rucak: 280, vecera: 200, uzina: 0 }[m];
  const pool = RECIPES.filter((r) => r.meal.includes(m) && r.kcal >= minK && rule(r, m));
  return pool.length ? pool : RECIPES.filter((r) => r.meal.includes(m));
}
// 7 dana × 4 obroka; prva nedelja programa je ručno složena, ostale se slažu po pravilima programa
function planWeek(plan, w) {
  const h = H(), swaps = h.swaps || {};
  let days;
  if (plan.days && w === h.planWeek) days = plan.days.map((d) => d.slice());
  else {
    days = Array.from({ length: 7 }, () => [null, null, null, null]);
    MEAL_KEYS.forEach((m, mi) => {
      if (plan.id === 'post-168' && m === 'dorucak') return;
      const rnd = seeded(plan.id + ':' + w + ':' + m);
      const pool = mealPool(plan, m).map((r) => [rnd(), r.id]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
      for (let d = 0; d < 7; d++) days[d][mi] = pool[d % pool.length];
    });
  }
  for (let d = 0; d < 7; d++) for (let mi = 0; mi < 4; mi++) { const k = `${plan.id}|${w}|${d}|${mi}`; if (swaps[k] !== undefined) days[d][mi] = swaps[k]; }
  return days;
}
// porcija za dan tako da zbir bude blizu cilja programa (0,75–2,5 porcije, na četvrtine)
function dayScale(plan, day) {
  const kcal = day.reduce((s, id) => s + ((recipeById(id) || {}).kcal || 0), 0);
  const t = PLAN_TARGET[plan.id]; if (!t || !kcal) return 1;
  return Math.min(2.5, Math.max(0.75, Math.round((t / kcal) * 4) / 4));
}
const fmtK = (k) => (k === 1 ? '1 porcija' : `${fmtNum(k)} porcije`);
function swapMeal(plan, w, d, mi) {
  const h = H(); h.swaps = h.swaps || {};
  const week = planWeek(plan, w), cur = week[d][mi];
  const used = new Set(week.map((x) => x[mi]));
  const pool = mealPool(plan, MEAL_KEYS[mi]).map((r) => r.id);
  const fresh = pool.filter((id) => !used.has(id));
  const choices = (fresh.length ? fresh : pool.filter((id) => id !== cur));
  if (!choices.length) return toast('Nema drugih jela za ovaj obrok u programu');
  h.swaps[`${plan.id}|${w}|${d}|${mi}`] = choices[Math.floor(Math.random() * choices.length)];
  save(false); render();
}
let dWeek = 0;
let hsub = 'danas', rFilter = 'sve', rQuery = '', dCat = 'sve', tCat = 'sve';
const DIET_CATS = { sve: 'Sve', zdravlje: '❤️ Zdravlje', mrsavljenje: '🪶 Mršavljenje', sport: '💪 Sport', posno: '🌱 Posno / vege' };
const TRAIN_CATS = { sve: 'Sve', kuca: '🏠 Kod kuće', teretana: '🏋️ Teretana', trcanje: '🏃 Trčanje', mobilnost: '🧘 Mobilnost' };

function renderHealth() {
  const tabs = { danas: 'Danas', recepti: 'Recepti', ishrana: 'Ishrana', treninzi: 'Treninzi' };
  let html = `<div class="seg">${Object.entries(tabs).map(([k, v]) => `<button class="${k === hsub ? 'on' : ''}" data-h="sub" data-v="${k}">${v}</button>`).join('')}</div>`;
  html += ({ danas: hToday, recepti: hRecipes, ishrana: hDiet, treninzi: hTrain })[hsub]();
  html += `<p class="h-note">ℹ️ Opšti predlozi za zdrave odrasle osobe – nisu zamena za savet lekara ili nutricioniste. Kalorije su približne.</p>`;
  $('#view').innerHTML = html;
  if (hsub === 'recepti') {
    const q = $('#rSearch');
    q.addEventListener('input', () => { rQuery = q.value; $('#rList').innerHTML = recipeRows(); });
  }
}

// ---------------------------------------------------------------- DANAS
function hToday() {
  const h = H(), plan = DIET_PLANS.find((p) => p.id === h.plan), prog = TRAININGS.find((t) => t.id === h.program);
  const now = new Date();
  let out = `<div class="h-hero"><div class="h-day">${WD[now.getDay()]}</div><div class="h-date">${now.getDate()}. ${MONTHS[now.getMonth()]}</div></div>`;
  if (plan) {
    const day = planWeek(plan, weekAbs(now))[planDayIdx(now)];
    out += `<div class="grp-h">🍽️ Danas jedeš <span class="grow"></span><span class="link" data-h="sub" data-v="ishrana">${esc(plan.name)}</span></div>
      <div class="meta" style="margin:-2px 4px 6px">≈ ${Math.round(day.reduce((s, id) => s + ((recipeById(id) || {}).kcal || 0), 0) * dayScale(plan, day) / 10) * 10} kcal · ${fmtK(dayScale(plan, day))} po obroku</div>
      <div class="grp">${Object.keys(MEALS).map((m, i) => mealRow(m, day[i], '', dayScale(plan, day))).join('')}</div>
      <button class="btn small" data-h="day-shop" style="margin-top:8px">🛒 Sastojci za danas u listu</button>`;
  } else {
    out += `<button class="h-cta" data-h="sub" data-v="ishrana"><span>🥗</span><div><b>Izaberi program ishrane</b><small>Plan obroka za celu nedelju, sa receptima i listom za kupovinu</small></div></button>`;
  }
  if (prog) {
    const today = now.getDay(), isDay = prog.days.includes(today);
    const done = h.log.filter((l) => l.prog === prog.id && dayDiff(new Date(l.t)) === 0).length;
    const week = h.log.filter((l) => Date.now() - l.t < 7 * DAY).length;
    const w = nextWorkout(prog);
    out += `<div class="grp-h">🏋️ Trening <span class="grow"></span><span class="link" data-h="sub" data-v="treninzi">${esc(prog.name)}</span></div>
      <div class="card block h-train">
        ${done ? `<div class="h-big">✅ Današnji trening je urađen!</div>`
          : isDay ? `<div class="h-big">Danas je trening: <b>${esc(w.name)}</b></div><button class="btn primary block" data-h="start" data-p="${prog.id}" data-w="${prog.workouts.indexOf(w)}" style="margin-top:8px">▶ Počni trening</button>`
          : `<div class="h-big">Danas je odmor 😌</div><div class="meta">Sledeći trening: ${nextDayName(prog)} – ${esc(w.name)}</div>`}
        <div class="meta" style="margin-top:8px">Poslednjih 7 dana: <b>${week}</b> ${week === 1 ? 'trening' : 'treninga'} · cilj ${prog.days.length}</div>
      </div>`;
  } else {
    out += `<button class="h-cta" data-h="sub" data-v="treninzi"><span>🏋️</span><div><b>Izaberi program treninga</b><small>Vođeni treninzi kod kuće, sa tajmerom i podsetnikom</small></div></button>`;
  }
  return out;
}
function mealRow(meal, id, swap, k = 1) {
  if (!id) return `<div class="item-row h-meal"><span class="h-ic">⏳</span><span class="nm"><small>${MEALS[meal]}</small>Post do podneva – voda, čaj, kafa bez šećera</span></div>`;
  const r = recipeById(id); if (!r) return '';
  return `<div class="item-row h-meal" data-h="recipe" data-id="${r.id}"><span class="h-ic">${r.icon}</span>
    <span class="nm"><small>${MEALS[meal]} · ${r.min} min</small>${esc(r.name)}</span><span class="qty-pill">${Math.round(r.kcal * k / 10) * 10} kcal</span>
    ${swap ? `<button class="iconbtn h-swap" data-h="swap" data-s="${swap}" title="Zameni jelo">🔄</button>` : ''}</div>`;
}
function nextWorkout(prog) {
  const last = H().log.filter((l) => l.prog === prog.id).sort((a, b) => b.t - a.t)[0];
  const i = last ? (last.w + 1) % prog.workouts.length : 0;
  return prog.workouts[i];
}
function nextDayName(prog) {
  const t = new Date().getDay();
  for (let k = 1; k <= 7; k++) { const d = (t + k) % 7; if (prog.days.includes(d)) return k === 1 ? 'sutra' : WD[d].toLowerCase(); }
  return '';
}

// ---------------------------------------------------------------- RECEPTI
function hRecipes() {
  const chips = { sve: 'Sve', fav: '⭐ Omiljeni', ...MEALS, posno: '🌱 Posno', vege: '🥦 Vege' };
  return `<input class="input" id="rSearch" placeholder="🔎 Traži recept ili namirnicu (npr. piletina)" value="${esc(rQuery)}" autocomplete="off" style="margin:0 0 8px">
    <div class="chips">${Object.entries(chips).map(([k, v]) => `<button class="chip ${k === rFilter ? 'on' : ''}" data-h="rfilter" data-v="${k}">${v}</button>`).join('')}</div>
    <div class="grp" id="rList">${recipeRows()}</div>`;
}
function recipeRows() {
  const f = fold(rQuery.trim()), favs = H().favs;
  const tg = (r) => r.tags || [];
  const ok = (r) => rFilter === 'sve' || (rFilter === 'fav' ? favs.includes(r.id) : rFilter === 'posno' ? tg(r).some((t) => t.startsWith('posno'))
    : rFilter === 'vege' ? tg(r).some((t) => ['vege', 'vegan', 'posno'].includes(t)) : r.meal.includes(rFilter));
  const list = RECIPES.filter((r) => ok(r)
    && (!f || fold(r.name).includes(f) || r.ing.some(([n]) => fold(n).includes(f))));
  if (!list.length) return `<div class="empty" style="padding:24px">Nema recepata${rFilter === 'fav' ? ' – dodaj ⭐ u receptu' : ''}.</div>`;
  return list.map((r) => `<div class="item-row h-meal" data-h="recipe" data-id="${r.id}"><span class="h-ic">${r.icon}</span>
    <span class="nm">${esc(r.name)}<small>${r.min} min · ${r.kcal} kcal · ${r.prot} g proteina</small></span>${favs.includes(r.id) ? '<span>⭐</span>' : ''}</div>`).join('');
}
function openRecipe(id) {
  const r = recipeById(id), h = H();
  let serv = r.serv;
  const draw = () => {
    const k = serv / r.serv;
    return `<div id="recWrap"><div class="rec-head"><span class="rec-ic">${r.icon}</span><div><h3>${esc(r.name)}</h3>
      <div class="meta">⏱ ${r.min} min · 🔥 ${r.kcal} kcal · 💪 ${r.prot} g proteina <small>(po porciji)</small></div></div>
      <button class="iconbtn" data-r="fav" title="Omiljeni">${h.favs.includes(r.id) ? '⭐' : '☆'}</button></div>
      <div class="rec-serv"><span>Porcija:</span><div class="stepper"><button data-r="-">−</button><span>${serv}</span><button data-r="+">+</button></div></div>
      <h2>Sastojci</h2><ul class="rec-ing">${r.ing.map(([n, q, u, note]) => `<li><span>${esc(n)}</span><b>${q ? esc(fmtNum(Math.round(q * k * 100) / 100) + ' ' + u) : ''}${note ? ` <small>${esc(note)}</small>` : ''}</b></li>`).join('')}</ul>
      <button class="btn primary block" data-r="shop">🛒 Dodaj sastojke u listu „${esc(curList().name)}“</button>
      <h2>Priprema</h2><ol class="rec-steps">${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <div class="foot"><button class="btn" onclick="closeSheet()">Zatvori</button></div></div>`;
  };
  const mount = () => $('#recWrap').addEventListener('click', (e) => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    const a = b.dataset.r;
    if (a === '+') serv = Math.min(12, serv + 1);
    if (a === '-') serv = Math.max(1, serv - 1);
    if (a === 'fav') { h.favs = h.favs.includes(r.id) ? h.favs.filter((x) => x !== r.id) : [...h.favs, r.id]; save(false); }
    if (a === 'shop') { const n = addIngredients([[r, serv / r.serv]]); closeSheet(); toast(`Dodato ${n} ${artikala(n)} u „${curList().name}“`); return; }
    $('#sheet').innerHTML = draw(); mount();
  });
  openSheet(draw(), mount);
}
// [[recept, faktor]] → sabrani sastojci u trenutnu listu
function addIngredients(pairs) {
  const sum = new Map();
  for (const [r, k] of pairs) for (const [n, q, u] of r.ing) {
    const key = n + '|' + (u || 'kom'), cur = sum.get(key) || { n, q: 0, u: u || 'kom', hasQ: false };
    if (q) { cur.q += q * k; cur.hasQ = true; }
    sum.set(key, cur);
  }
  for (const it of sum.values()) {
    // zaokruži na ono što se stvarno kupuje: komadi i pakovanja naviše, grami na 10, kg/l na 0,1
    const r = { kom: (x) => Math.ceil(x - 0.05), pak: (x) => Math.ceil(x - 0.05), g: (x) => Math.ceil(x / 10) * 10, ml: (x) => Math.ceil(x / 10) * 10 }[it.u] || ((x) => Math.ceil(x * 10) / 10);
    const q = it.hasQ ? Math.max(r(it.q), it.u === 'kom' || it.u === 'pak' ? 1 : 0) : null;
    addToList(it.n, q, it.hasQ ? it.u : null, true);
  }
  save(false);
  return sum.size;
}

// ---------------------------------------------------------------- ISHRANA
function hDiet() {
  const h = H(), plan = DIET_PLANS.find((p) => p.id === h.plan);
  let out = `<div class="chips">${Object.entries(DIET_CATS).map(([k, v]) => `<button class="chip ${k === dCat ? 'on' : ''}" data-h="dcat" data-v="${k}">${v}</button>`).join('')}</div>`;
  if (h.plan && !h.showPlans) out = `<button class="btn small" data-h="show-plans" style="margin-bottom:8px">↔ Promeni program ishrane</button>`;
  out += DIET_PLANS.filter((p) => (h.plan && !h.showPlans) ? p.id === h.plan : (dCat === 'sve' || p.cat === dCat || p.id === h.plan)).map((p) => `<button class="h-plan ${p.id === h.plan ? 'on' : ''}" data-h="plan" data-v="${p.id}">
      <span class="h-pi">${p.icon}</span><div><b>${esc(p.name)}</b><small>${esc(p.kcal)} · ${esc(p.desc)}</small></div>
      <span class="h-pick">${p.id === h.plan ? '✓' : ''}</span></button>`).join('');
  if (plan) {
    const today = planDayIdx(), w = weekAbs() + dWeek, days = planWeek(plan, w);
    const ws = weekStart(w), we = new Date(ws.getTime() + 6 * DAY);
    const wl = dWeek === 0 ? 'Ova nedelja' : dWeek === 1 ? 'Sledeća nedelja' : dWeek === -1 ? 'Prošla nedelja' : dWeek > 0 ? `Za ${dWeek} nedelje` : `Pre ${-dWeek} nedelje`;
    out += `<div class="week-nav"><button class="iconbtn" data-h="wk" data-v="-1">◀</button>
      <div><b>${wl}</b><small>${ws.getDate()}. ${MONTHS[ws.getMonth()]} – ${we.getDate()}. ${MONTHS[we.getMonth()]}</small></div>
      <button class="iconbtn" data-h="wk" data-v="1">▶</button></div>
      <p class="meta" style="margin:0 2px 6px">Jelovnik se menja svake nedelje. 🔄 zamenjuje jelo drugim iz istog programa.</p>`;
    out += `<div class="rec-serv" style="margin-top:6px"><span>Broj osoba za kupovinu:</span><div class="stepper"><button data-h="persons" data-v="-1">−</button><span>${h.persons}</span><button data-h="persons" data-v="1">+</button></div></div>
      <button class="btn primary block" data-h="week-shop" style="margin-top:8px">🛒 Kupovina za celu nedelju</button>`;
    out += days.map((d, i) => { const k = dayScale(plan, d), kc = Math.round(d.reduce((s, id) => s + ((recipeById(id) || {}).kcal || 0), 0) * k / 10) * 10;
      return `<div class="grp-h">${i === today && dWeek === 0 ? '👉 ' : ''}${WD[(i + 1) % 7]} <span class="grow"></span><span>${kc} kcal · ×${fmtNum(k)}</span></div>
      <div class="grp">${MEAL_KEYS.map((m, j) => mealRow(m, d[j], d[j] ? `${w}|${i}|${j}` : '', k)).join('')}</div>`; }).join('');
  }
  return out;
}

// ---------------------------------------------------------------- TRENINZI
function hTrain() {
  const h = H(), prog = TRAININGS.find((t) => t.id === h.program);
  let out = `<div class="chips">${Object.entries(TRAIN_CATS).map(([k, v]) => `<button class="chip ${k === tCat ? 'on' : ''}" data-h="tcat" data-v="${k}">${v}</button>`).join('')}</div>`;
  if (h.program && !h.showProgs) out = `<button class="btn small" data-h="show-progs" style="margin-bottom:8px">↔ Promeni program treninga</button>`;
  out += TRAININGS.filter((t) => (h.program && !h.showProgs) ? t.id === h.program : (tCat === 'sve' || t.cat === tCat || t.id === h.program)).map((t) => `<button class="h-plan ${t.id === h.program ? 'on' : ''}" data-h="prog" data-v="${t.id}">
      <span class="h-pi">${t.icon}</span><div><b>${esc(t.name)}</b><small>${esc(t.level)} · ${esc(t.perWeek)} · ${t.days.map((d) => WD_SHORT[d]).join(', ')}<br>${esc(t.desc)}</small></div>
      <span class="h-pick">${t.id === h.program ? '✓' : ''}</span></button>`).join('');
  if (prog) {
    const hasRem = S.reminders.some((r) => r.src === 'trening' && !r.done);
    if (prog.note) out += `<div class="banner" style="margin-top:12px"><span>🧑‍🏫 ${esc(prog.note)}</span></div>`;
    out += `<button class="btn block" data-h="train-rem" style="margin-top:12px">⏰ ${hasRem ? 'Promeni podsetnik za trening' : 'Podseti me na dane treninga'}</button>`;
    out += prog.workouts.map((w, i) => `<div class="grp-h">${esc(w.name)}<span class="grow"></span></div>
      <div class="card block">
        <div class="h-ex">${(w.items || w.intervals.filter((x, k, a) => k === 0 || x[0] !== a[k - 1][0] || k === a.length - 1).slice(0, 6)).map(([e, o]) => {
          const ex = EXERCISES[e];
          const t = w.items ? (o.sets ? `${o.sets}× ${o.reps ? o.reps + (o.side ? ' po strani' : '') : fmtSec(o.sec)}` : fmtSec(o.sec)) : fmtSec(o);
          return `<div><span>${ex.icon} ${esc(ex.name)}</span><b>${t}</b></div>`;
        }).join('')}${w.intervals ? `<div class="meta">Ukupno ${fmtSec(w.intervals.reduce((s, [, sec]) => s + sec, 0))}, vodi te tajmer</div>` : ''}</div>
        <button class="btn primary block" data-h="start" data-p="${prog.id}" data-w="${i}" style="margin-top:8px">▶ Počni</button>
      </div>`).join('');
    const hist = h.log.filter((l) => l.prog === prog.id).slice(-5).reverse();
    if (hist.length) out += `<div class="grp-h">📈 Urađeno</div><div class="grp">${hist.map((l) => `<div class="item-row"><span class="tick" style="background:var(--ok);border-color:var(--ok)">✓</span><span class="nm">${esc(prog.workouts[l.w] ? prog.workouts[l.w].name : '')}</span><span class="meta">${fmtWhen(new Date(l.t))}</span></div>`).join('')}</div>`;
  }
  return out;
}
const fmtSec = (s) => (s >= 60 ? `${Math.floor(s / 60)}${s % 60 ? ':' + pad(s % 60) : ''} min` : `${s} s`);

function trainingReminder() {
  const prog = TRAININGS.find((t) => t.id === H().program);
  const time = prompt(`U koliko sati da te podsetim na trening (${prog.days.map((d) => WD_SHORT[d]).join(', ')})?`, '18:00');
  if (!time) return;
  const m = time.match(/(\d{1,2})[:.]?(\d{2})?/); if (!m) return toast('Upiši vreme, npr. 18:00');
  S.reminders = S.reminders.filter((r) => r.src !== 'trening');
  for (const d of prog.days) {
    const n = new Date(); n.setHours(+m[1], +(m[2] || 0), 0, 0);
    while (n.getDay() !== d || n < new Date()) n.setDate(n.getDate() + 1);
    S.reminders.push({ id: uid(), src: 'trening', title: `🏋️ Trening: ${prog.name}`, at: toLocal(n), repeat: 'weekly', before: 0, note: 'Otvori Zdravlje → Danas → Počni trening' });
  }
  save(); ensurePermission(); render();
  toast(`Podsetnik: ${prog.days.map((d) => WD_SHORT[d]).join(', ')} u ${pad(+m[1])}:${pad(+(m[2] || 0))}`);
}

// ---------------------------------------------------------------- VOĐENI TRENING
let player = null;
function startWorkout(progId, wi) {
  const prog = TRAININGS.find((t) => t.id === progId), w = prog.workouts[wi];
  const steps = [];
  if (w.intervals) for (const [e, sec] of w.intervals) steps.push({ e, sec, auto: true });
  else w.items.forEach(([e, o], ii) => {
    if (!o.sets) steps.push({ e, sec: o.sec });
    else for (let s = 1; s <= o.sets; s++) {
      steps.push({ e, set: s, sets: o.sets, reps: o.reps, sec: o.reps ? 0 : o.sec, side: o.side });
      const last = ii === w.items.length - 1 && s === o.sets;
      if (!last) steps.push({ rest: w.rest || 60 });
    }
  });
  player = { prog, wi, w, steps, i: 0, left: 0, running: false, timer: null, wake: null };
  try { navigator.wakeLock && navigator.wakeLock.request('screen').then((l) => (player && (player.wake = l))).catch(() => {}); } catch { /* */ }
  openSheet('<div id="pl"></div>', () => { drawPlayer(); $('#pl').addEventListener('click', onPlayer); });
  $('#sheet').classList.add('full');
  enterStep();
}
function enterStep() {
  const st = player.steps[player.i];
  clearInterval(player.timer); player.running = false;
  player.left = st.rest || st.sec || 0;
  if (st.rest || st.auto) startTimer();
  drawPlayer();
}
function startTimer() {
  player.running = true;
  clearInterval(player.timer);
  player.timer = setInterval(() => {
    player.left--;
    if (player.left <= 3 && player.left > 0) beep(false);
    if (player.left <= 0) { clearInterval(player.timer); beep(true); return nextStep(); }
    const el = $('#plTime'); if (el) el.textContent = mmss(player.left);
  }, 1000);
  drawPlayer();
}
const mmss = (s) => `${Math.floor(s / 60)}:${pad(s % 60)}`;
function beep(long) { try { navigator.vibrate && navigator.vibrate(long ? [300, 100, 300] : 80); } catch { /* */ } }
function nextStep() {
  if (!player) return;
  if (player.i < player.steps.length - 1) { player.i++; enterStep(); }
  else finishWorkout();
}
function finishWorkout() {
  clearInterval(player.timer);
  H().log.push({ t: Date.now(), prog: player.prog.id, w: player.wi });
  H().log = H().log.slice(-200);
  save(false);
  $('#pl').innerHTML = `<div class="pl-done"><div style="font-size:72px">🎉</div><h3>Trening završen!</h3><p>${esc(player.w.name)} · ${player.steps.filter((s) => !s.rest).length} vežbi/serija</p>
    <button class="btn primary block" data-p="close">Super</button></div>`;
}
function closePlayer() {
  if (player) { clearInterval(player.timer); try { player.wake && player.wake.release(); } catch { /* */ } }
  player = null; $('#sheet').classList.remove('full'); closeSheet(); render();
}
function onPlayer(e) {
  const b = e.target.closest('[data-p]'); if (!b) return;
  const a = b.dataset.p;
  if (a === 'close') return closePlayer();
  if (a === 'quit') { if (confirm('Prekinuti trening?')) closePlayer(); return; }
  if (a === 'done' || a === 'skip') return nextStep();
  if (a === 'w+' || a === 'w-') {
    const st = player.steps[player.i], w = H().weights;
    const cur = w[st.e] != null ? w[st.e] : 20;
    w[st.e] = Math.max(0, (w[st.e] == null && a === 'w+') ? 20 : cur + (a === 'w+' ? 2.5 : -2.5));
    save(false); return drawPlayer();
  }
  if (a === 'back' && player.i > 0) { player.i--; return enterStep(); }
  if (a === 'play') { if (player.running) { clearInterval(player.timer); player.running = false; drawPlayer(); } else startTimer(); }
}
function drawPlayer() {
  const el = $('#pl'); if (!el || !player) return;
  const st = player.steps[player.i], total = player.steps.length;
  const nxt = player.steps.slice(player.i + 1).find((s) => !s.rest);
  const pct = Math.round((player.i / total) * 100);
  if (st.rest) {
    el.innerHTML = `<div class="pl-top"><button class="iconbtn" data-p="quit">✕</button><div class="progress grow"><div style="width:${pct}%"></div></div><span class="meta">${player.i + 1}/${total}</span></div>
      <div class="pl-main"><div class="pl-ic">😮‍💨</div><h3>Odmor</h3><div class="pl-time" id="plTime">${mmss(player.left)}</div>
      ${nxt ? `<p class="meta">Sledeće: ${EXERCISES[nxt.e].icon} ${esc(EXERCISES[nxt.e].name)}${nxt.set ? ` · serija ${nxt.set}/${nxt.sets}` : ''}</p>` : ''}</div>
      <div class="pl-btns"><button class="btn" data-p="back">◀</button><button class="btn primary grow" data-p="skip">Preskoči odmor ▶</button></div>`;
    return;
  }
  const ex = EXERCISES[st.e];
  const target = st.reps ? `<div class="pl-reps">${st.reps}<small>${st.side ? ' po strani' : ' ponavljanja'}</small></div>` : `<div class="pl-time" id="plTime">${mmss(player.left)}</div>${st.side ? '<div class="meta">po strani</div>' : ''}`;
  const wt = H().weights[st.e];
  const weight = ex.gym ? `<div class="pl-w"><span>Težina</span><div class="stepper"><button data-p="w-">−</button><span>${wt != null ? fmtNum(wt) + ' kg' : '–'}</span><button data-p="w+">+</button></div></div>` : '';
  el.innerHTML = `<div class="pl-top"><button class="iconbtn" data-p="quit">✕</button><div class="progress grow"><div style="width:${pct}%"></div></div><span class="meta">${player.i + 1}/${total}</span></div>
    <div class="pl-main"><div class="pl-ic">${ex.icon}</div><h3>${esc(ex.name)}</h3>${st.set ? `<div class="meta">Serija ${st.set} od ${st.sets}</div>` : ''}
      ${target}${weight}<p class="pl-how">${esc(ex.how)}</p></div>
    <div class="pl-btns"><button class="btn" data-p="back">◀</button>
      ${st.reps ? '<button class="btn ok grow" data-p="done">✓ Gotovo</button>'
        : `<button class="btn primary grow" data-p="play">${player.running ? '⏸ Pauza' : '▶ Start'}</button><button class="btn" data-p="skip">⏭</button>`}</div>`;
}

// ---------------------------------------------------------------- klikovi
document.addEventListener('DOMContentLoaded', () => $('#view').addEventListener('click', (e) => {
  const b = e.target.closest('[data-h]'); if (!b || tab !== 'zdravlje') return;
  const a = b.dataset.h, h = H();
  if (a === 'sub') { hsub = b.dataset.v; render(); window.scrollTo(0, 0); }
  if (a === 'rfilter') { rFilter = b.dataset.v; render(); }
  if (a === 'dcat') { dCat = b.dataset.v; render(); }
  if (a === 'tcat') { tCat = b.dataset.v; render(); }
  if (a === 'recipe') openRecipe(b.dataset.id);
  if (a === 'plan') { h.plan = h.plan === b.dataset.v && !h.showPlans ? null : b.dataset.v; h.planWeek = weekAbs(); h.showPlans = false; dWeek = 0; save(false); render(); }
  if (a === 'show-plans') { h.showPlans = true; render(); }
  if (a === 'show-progs') { h.showProgs = true; render(); }
  if (a === 'wk') { dWeek += +b.dataset.v; render(); }
  if (a === 'swap') { e.stopPropagation(); const [w, d, mi] = b.dataset.s.split('|').map(Number); return swapMeal(DIET_PLANS.find((p) => p.id === h.plan), w, d, mi); }
  if (a === 'prog') { h.program = h.program === b.dataset.v && !h.showProgs ? null : b.dataset.v; h.showProgs = false; save(false); render(); }
  if (a === 'persons') { h.persons = Math.max(1, Math.min(8, h.persons + +b.dataset.v)); save(false); render(); }
  if (a === 'start') startWorkout(b.dataset.p, +b.dataset.w);
  if (a === 'train-rem') trainingReminder();
  if (a === 'day-shop' || a === 'week-shop') {
    const plan = DIET_PLANS.find((p) => p.id === h.plan); if (!plan) return;
    const days = a === 'day-shop' ? [planWeek(plan, weekAbs())[planDayIdx()]] : planWeek(plan, weekAbs() + dWeek);
    const k = h.persons;
    const pairs = days.flatMap((d) => { const ds = dayScale(plan, d); return d.map((id) => recipeById(id)).filter(Boolean).map((r) => [r, (k * ds) / r.serv]); });
    const n = addIngredients(pairs);
    toast(`Dodato ${n} ${artikala(n)} u „${curList().name}“`, 4000, { label: 'Otvori', fn: () => setTab('kupovina') });
  }
}));

// zatvaranje prozora (dodir van njega) zaustavlja tajmer
window.onSheetClose = () => {
  if (!player) return;
  clearInterval(player.timer); try { player.wake && player.wake.release(); } catch { /* */ }
  player = null; $('#sheet').classList.remove('full');
};
