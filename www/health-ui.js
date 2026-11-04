/* Zdravlje – ekrani: Danas, Recepti, Ishrana, Treninzi i vođeni trening. */
'use strict';

const H_DEF = () => ({ plan: null, program: null, favs: [], log: [], persons: 1, weights: {}, recent: [] });
const H = () => { // uvek isti objekat (ranije je svaki poziv pravio novi, pa su se izmene gubile)
  const h = S.health || (S.health = {}), d = H_DEF();
  for (const k in d) if (!(k in h)) h[k] = d[k];
  return h;
};
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
  const pool = RECIPES.filter((r) => r.meal.includes(m) && r.type !== 'desert' && r.kcal >= minK && rule(r, m));
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
let dWeek = 0, rType = 'sve';
let hsub = 'danas', rFilter = 'sve', rQuery = '', dCat = 'sve', tCat = 'sve';
const DIET_CATS = { sve: 'Sve', zdravlje: '❤️ Zdravlje', mrsavljenje: '🪶 Mršavljenje', sport: '💪 Sport', posno: '🌱 Posno / vege' };
const TRAIN_CATS = { sve: 'Sve', kuca: '🏠 Kod kuće', teretana: '🏋️ Teretana', trcanje: '🏃 Trčanje', mobilnost: '🧘 Mobilnost' };

function renderHealth() {
  const tabs = { danas: 'Danas', recepti: 'Recepti', ishrana: 'Ishrana', treninzi: 'Treninzi' };
  let html = `<div class="seg">${Object.entries(tabs).map(([k, v]) => `<button class="${k === hsub ? 'on' : ''}" data-h="sub" data-v="${k}">${v}</button>`).join('')}</div>`;
  html += ({ danas: hToday, recepti: hRecipes, ishrana: hDiet, treninzi: hTrain })[hsub]();
  html += `<p class="h-note">ℹ️ Opšti predlozi za zdrave odrasle osobe – nisu zamena za savet lekara ili nutricioniste. Kalorije su izračunate iz USDA baze na osnovu sastojaka (približno).</p>`;
  $('#view').innerHTML = html;
  if (hsub === 'recepti') {
    const q = $('#rSearch');
    q.addEventListener('input', () => {
      const was = !!$('#rList'); rQuery = q.value;
      const homeNow = !rQuery.trim() && rType === 'sve' && rFilter === 'sve';
      if (was && !homeNow) { $('#rList').innerHTML = recipeRows(); return; }
      clearTimeout(renderHealth.t); renderHealth.t = setTimeout(() => { render(); const n = $('#rSearch'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 0);
    });
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
const TYPE_COLOR = { corba: ['#fde68a', '#f59e0b'], meso: ['#fecaca', '#dc2626'], piletina: ['#fed7aa', '#ea580c'], riba: ['#bae6fd', '#0284c7'], testenina: ['#fef3c7', '#d97706'],
  povrce: ['#bbf7d0', '#16a34a'], salata: ['#d9f99d', '#65a30d'], pita: ['#fde68a', '#b45309'], dorucak: ['#fef9c3', '#ca8a04'], desert: ['#fbcfe8', '#db2777'], namaz: ['#e9d5ff', '#7c3aed'] };
const grad = (r) => { const c = TYPE_COLOR[r.type] || ['#e2e8f0', '#64748b']; return `background:linear-gradient(135deg, ${c[0]}, ${c[1]}33)`; };
const fmtMin = (m) => (m >= 60 ? fmtNum(Math.round(m / 6) / 10) + ' h' : m + ' min');
function badges(r) {
  const b = [];
  if (r.tags && r.tags.includes('posno')) b.push('🌱 Posno'); else if (r.tags && r.tags.includes('posno-riba')) b.push('🐟 Posno (riba)');
  if (r.f.vege && !(r.tags || []).includes('posno')) b.push('🥦 Vege');
  if (r.f.glutenFree) b.push('🌾 Bez glutena');
  if (r.f.lactoseFree) b.push('🥛 Bez laktoze');
  if (r.f.protein) b.push('💪 Proteinsko');
  if (r.min <= 20) b.push('⚡ Brzo');
  return b;
}
let rSel = { haves: [] };
function recipeCard(r, wide) {
  const fav = H().favs.includes(r.id);
  return `<button class="rcard ${wide ? 'wide' : ''}" data-h="recipe" data-id="${r.id}">
    <div class="rc-top" style="${grad(r)}"><span class="rc-ic">${r.icon}</span><span class="rc-time">⏱ ${fmtMin(r.min)}</span>${fav ? '<span class="rc-fav">⭐</span>' : ''}</div>
    <div class="rc-body"><div class="rc-name">${esc(r.name)}</div><div class="rc-meta">${r.kcal} kcal · ${DIFF[r.diff]}${r.tags && r.tags.includes('posno') ? ' · 🌱' : ''}</div></div></button>`;
}
function recipeDay() {
  const d = startOfDay(new Date()), pool = RECIPES.filter((r) => r.meal.includes('rucak') || r.meal.includes('vecera'));
  return pool[Math.abs(Math.floor(d / DAY) * 7919) % pool.length];
}
function hRecipes() {
  const types = { sve: '📚 Sve', ...RTYPES };
  const quick = { sve: 'Bez filtera', fav: '⭐ Omiljeni', brzo: '⚡ Do 30 min', posno: '🌱 Posno', vege: '🥦 Vege', gluten: '🌾 Bez glutena', laktoza: '🥛 Bez laktoze', lagano: '🪶 Lagano', protein: '💪 Proteini', lako: '👌 Lako za spremiti' };
  const home = !rQuery.trim() && rType === 'sve' && rFilter === 'sve';
  let out = `<div class="r-search"><input class="input" id="rSearch" placeholder="🔎 Traži jelo ili namirnicu" value="${esc(rQuery)}" autocomplete="off">
      <button class="btn" data-h="fridge" title="Šta imam u frižideru">🧊 Imam…</button></div>
    <div class="chips">${Object.entries(types).map(([k, v]) => `<button class="chip ${k === rType ? 'on' : ''}" data-h="rtype" data-v="${k}">${v}</button>`).join('')}</div>
    <div class="chips chips-sm">${Object.entries(quick).map(([k, v]) => `<button class="chip ${k === rFilter ? 'on' : ''}" data-h="rfilter" data-v="${k}">${v}</button>`).join('')}</div>`;
  if (home) {
    const day = recipeDay(), h = H();
    const recent = (h.recent || []).map(recipeById).filter(Boolean).slice(0, 10);
    const favs = h.favs.map(recipeById).filter(Boolean);
    out += `<div class="r-hero" data-h="recipe" data-id="${day.id}" style="${grad(day)}"><div><small>🍽️ PREDLOG DANA</small><b>${esc(day.name)}</b>
      <span>⏱ ${fmtMin(day.min)} · ${day.kcal} kcal · ${DIFF[day.diff]}</span></div><span class="r-hero-ic">${day.icon}</span></div>`;
    if (recent.length) out += `<div class="grp-h">🕘 Nedavno gledano</div><div class="hscroll">${recent.map((r) => recipeCard(r)).join('')}</div>`;
    if (favs.length) out += `<div class="grp-h">⭐ Omiljeni</div><div class="hscroll">${favs.map((r) => recipeCard(r)).join('')}</div>`;
    out += `<div class="grp-h">📂 Vrste jela</div><div class="type-grid">${Object.entries(RTYPES).map(([k, v]) => { const c = TYPE_COLOR[k]; const n = RECIPES.filter((r) => r.type === k).length;
      return `<button class="type-tile" data-h="rtype" data-v="${k}" style="background:linear-gradient(135deg, ${c[0]}, ${c[1]}22)"><span>${v.split(' ')[0]}</span><b>${v.split(' ').slice(1).join(' ')}</b><small>${n} recepata</small></button>`; }).join('')}</div>
      <div class="grp-h">⚡ Brzo i lako (do 20 min)</div><div class="hscroll">${RECIPES.filter((r) => r.min <= 20 && r.type !== 'namaz').slice(0, 14).map((r) => recipeCard(r)).join('')}</div>`;
    return out;
  }
  return out + `<div id="rList">${recipeRows()}</div>`;
}
function recipeRows() {
  const f = fold(rQuery.trim()), favs = H().favs;
  const tg = (r) => r.tags || [];
  const qf = { fav: (r) => favs.includes(r.id), posno: (r) => tg(r).some((t) => t.startsWith('posno')), vege: (r) => r.f.vege, brzo: (r) => r.min <= 30,
    lagano: (r) => r.kcal <= 350 && r.type !== 'desert', protein: (r) => r.prot >= 25, gluten: (r) => r.f.glutenFree, laktoza: (r) => r.f.lactoseFree, lako: (r) => r.diff === 1 };
  const list = RECIPES.filter((r) => (rType === 'sve' || r.type === rType) && (rFilter === 'sve' || (qf[rFilter] ? qf[rFilter](r) : true))
    && (!f || fold(r.name).includes(f) || r.ing.some(([n]) => fold(n).includes(f))));
  if (!list.length) return `<div class="empty" style="padding:24px">Nema recepata${rFilter === 'fav' ? ' – dodaj ⭐ u receptu' : ''}.</div>`;
  return `<div class="meta" style="margin:0 4px 6px">Pronađeno: <b>${list.length}</b> ${list.length % 10 === 1 && list.length % 100 !== 11 ? 'recept' : 'recepata'}</div>
    <div class="rgrid">${list.map((r) => recipeCard(r)).join('')}</div>`;
}
// „Šta imam u frižideru?“
function fridgeFinder() {
  const all = [...new Set(RECIPES.flatMap((r) => r.ing.map(([n]) => n)))].filter((n) => !PANTRY.has(n)).sort((a, b) => a.localeCompare(b, 'sr'));
  const draw = () => {
    const haves = rSel.haves;
    const res = haves.length ? RECIPES.map((r) => {
      const need = r.ing.map(([n]) => n).filter((n) => !PANTRY.has(n));
      const have = need.filter((n) => haves.includes(n));
      return { r, have: have.length, need: need.length, miss: need.filter((n) => !haves.includes(n)) };
    }).filter((x) => x.have).sort((a, b) => (b.have / b.need) - (a.have / a.need) || b.have - a.have).slice(0, 30) : [];
    return `<div id="frWrap"><h3>🧊 Šta imam u frižideru?</h3>
      <p class="meta" style="margin:0 0 8px">Dodaj namirnice koje imaš – pokazaću jela koja možeš da napraviš (so, ulje i začine računam da imaš).</p>
      <div class="fr-in"><input class="input" id="frIn" placeholder="🔎 npr. jaja, krompir, piletina…" autocomplete="off" autocorrect="off" spellcheck="false"><div class="fr-sug" id="frSug" hidden></div></div>
      <div class="chips" style="flex-wrap:wrap">${haves.map((n) => `<button class="chip on" data-fr="rm" data-n="${esc(n)}">${esc(n)} ✕</button>`).join('')}</div>
      <div class="chips chips-sm" style="flex-wrap:wrap">${['Jaja', 'Krompir', 'Pileći file', 'Crni luk', 'Paradajz', 'Mleko', 'Beli sir', 'Pirinač', 'Testenina (penne)', 'Tikvice', 'Mleveno meso (mešano)', 'Šargarepa', 'Paprika', 'Pečurke', 'Kupus', 'Spanać'].filter((n) => !haves.includes(n)).map((n) => `<button class="chip" data-fr="add" data-n="${esc(n)}">+ ${esc(n)}</button>`).join('')}</div>
      <div class="fr-res">${res.map(({ r, have, need, miss }) => `<button class="fr-row" data-fr="open" data-id="${r.id}"><span class="h-ic">${r.icon}</span>
        <span class="nm">${esc(r.name)}<small>${have === need ? '<b style="color:var(--ok)">✓ Imaš sve!</b>' : `Imaš ${have}/${need} · fali: ${esc(miss.slice(0, 3).join(', '))}${miss.length > 3 ? '…' : ''}`}</small></span>
        <span class="fr-pct" style="--p:${Math.round((have / need) * 100)}">${Math.round((have / need) * 100)}%</span></button>`).join('')}</div>
      <div class="foot"><button class="btn" onclick="closeSheet()">Zatvori</button></div></div>`;
  };
  const mount = () => {
    const inp = $('#frIn');
    let busy = false;
    const add = (n) => {
      if (busy) return; busy = true; inp.value = '';
      const m = all.find((x) => fold(x) === fold(n)) || all.find((x) => fold(x).startsWith(fold(n))) || all.find((x) => fold(x).includes(fold(n)));
      if (m && !rSel.haves.includes(m)) rSel.haves.push(m); else if (!m) toast('Nema te namirnice u receptima');
      setTimeout(() => { $('#sheet').innerHTML = draw(); mount(); const f = $('#frIn'); if (f) f.focus(); }, 0);
    };
    // sopstveni predlozi umesto <datalist> (Android WebView ga loše iscrtava)
    const sug = $('#frSug');
    inp.addEventListener('input', () => {
      const f = fold(inp.value.trim());
      const list = f ? all.filter((x) => !rSel.haves.includes(x) && fold(x).includes(f)).sort((a, b) => fold(b).startsWith(f) - fold(a).startsWith(f)).slice(0, 8) : [];
      sug.innerHTML = list.map((n) => `<button data-fr="add" data-n="${esc(n)}">+ ${esc(n)}</button>`).join('') || (f ? '<span class="meta">Nema te namirnice u receptima</span>' : '');
      sug.hidden = !f;
    });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && inp.value.trim()) { const first = sug.querySelector('[data-n]'); add(first ? first.dataset.n : inp.value.trim()); } });
    $('#frWrap').addEventListener('click', (e) => {
      const b = e.target.closest('[data-fr]'); if (!b) return;
      if (b.dataset.fr === 'add') add(b.dataset.n);
      if (b.dataset.fr === 'rm') { rSel.haves = rSel.haves.filter((x) => x !== b.dataset.n); $('#sheet').innerHTML = draw(); mount(); }
      if (b.dataset.fr === 'open') openRecipe(b.dataset.id);
    });
  };
  openSheet(draw(), mount);
}
function openRecipe(id) {
  const r = recipeById(id), h = H();
  h.recent = [id, ...(h.recent || []).filter((x) => x !== id)].slice(0, 12); save(false);
  let serv = r.serv, tabR = 'sastojci';
  const have = new Set(); // štiklirani sastojci = „imam“
  const draw = () => {
    const k = serv / r.serv, miss = r.ing.filter(([n]) => !have.has(n)).length;
    return `<div id="recWrap"><div class="rec-hero" style="${grad(r)}"><span class="rec-hero-ic">${r.icon}</span>
        <button class="iconbtn rec-fav" data-r="fav" title="Omiljeni">${h.favs.includes(r.id) ? '⭐' : '☆'}</button>
        <button class="iconbtn rec-x" data-r="close" title="Zatvori">✕</button></div>
      <h3 class="rec-title">${esc(r.name)}</h3>
      <div class="rec-stats"><div><b>${fmtMin(r.min)}</b><small>vreme</small></div><div><b>${r.kcal}</b><small>kcal/porc.</small></div><div><b>${r.prot} g</b><small>proteini</small></div><div><b>${DIFF[r.diff]}</b><small>težina</small></div></div>
      <div class="rec-badges">${badges(r).map((x) => `<span>${x}</span>`).join('')}</div>
      <div class="seg seg-in"><button class="${tabR === 'sastojci' ? 'on' : ''}" data-r="tab" data-v="sastojci">🧺 Sastojci (${r.ing.length})</button><button class="${tabR === 'priprema' ? 'on' : ''}" data-r="tab" data-v="priprema">👨‍🍳 Priprema (${r.steps.length})</button></div>
      ${tabR === 'sastojci' ? `
        <div class="rec-serv"><span>Porcija:</span><div class="stepper"><button data-r="-">−</button><span>${serv}</span><button data-r="+">+</button></div></div>
        <p class="meta" style="margin:4px 2px 6px">Štikliraj ono što već imaš – u listu idu samo sastojci koji fale.</p>
        <ul class="rec-ing">${r.ing.map(([n, q, u, note]) => `<li class="${have.has(n) ? 'have' : ''}" data-r="have" data-n="${esc(n)}"><span class="tick">${have.has(n) ? '✓' : ''}</span><span class="grow">${esc(n)}</span><b>${q ? esc(fmtNum(Math.round(q * k * 100) / 100) + ' ' + u) : ''}${note ? ` <small>${esc(note)}</small>` : ''}</b></li>`).join('')}</ul>
        <button class="btn primary block" data-r="shop" ${miss ? '' : 'disabled'}>🛒 ${miss === r.ing.length ? 'Dodaj sve sastojke' : `Dodaj ono što fali (${miss})`} u „${esc(curList().name)}“</button>
        <button class="btn block" data-r="tab" data-v="priprema" style="margin-top:8px">Dalje: priprema →</button>
        ${nutritionBlock(r)}${allergenBlock(r)}`
      : `<button class="btn primary block" data-r="cook" style="margin:10px 0">👨‍🍳 Kuvaj korak po korak</button>
        <ol class="rec-steps2">${r.steps.map((st, i) => { const m = stepMinutes(st); return `<li><span class="sn">${i + 1}</span><div>${esc(st)}${m ? ` <button class="tmr" data-r="timer" data-m="${m}" data-l="${esc(r.name)} – korak ${i + 1}">⏱ ${fmtMin(m)}</button>` : ''}</div></li>`; }).join('')}</ol>
        ${r.tip ? `<div class="rec-tip">💡 <b>Savet:</b> ${esc(r.tip)}</div>` : ''}
        ${safetyBlock(r)}`}
      ${reviewBadge('recipes', r.id)}
      <button class="btn block small" data-r="report" style="margin-top:6px">🚩 Prijavi grešku u receptu</button>
      <div class="foot"><button class="btn" data-r="close">Zatvori</button></div></div>`;
  };
  const mount = () => $('#recWrap').addEventListener('click', (e) => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    const a = b.dataset.r;
    if (a === 'close') { closeSheet(); if (tab === 'zdravlje' && hsub === 'recepti') render(); return; }
    if (a === '+') serv = Math.min(12, serv + 1);
    if (a === '-') serv = Math.max(1, serv - 1);
    if (a === 'tab') { tabR = b.dataset.v; $('#sheet').scrollTo(0, 0); }
    if (a === 'have') { const n = b.dataset.n; have.has(n) ? have.delete(n) : have.add(n); }
    if (a === 'fav') { h.favs = h.favs.includes(r.id) ? h.favs.filter((x) => x !== r.id) : [...h.favs, r.id]; save(false); }
    if (a === 'shop') {
      const part = { ...r, ing: r.ing.filter(([n]) => !have.has(n)) };
      const n = addIngredients([[part, serv / r.serv]]); toast(`Dodato ${n} ${artikala(n)} u „${curList().name}“`, 3500, { label: 'Otvori', fn: () => { closeSheet(); setTab('kupovina'); } }); return;
    }
    if (a === 'timer') return startKitchenTimer(+b.dataset.m, b.dataset.l);
    if (a === 'cook') return cookMode(r);
    if (a === 'report') return reportProblem('recipes', r.id, r.name, () => openRecipe(r.id));
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
// ---------------------------------------------------------------- TRENINZI – pregled, raspored, statistika
const CAT_COLOR = { kuca: ['#c7d2fe', '#4f46e5'], teretana: ['#fecaca', '#dc2626'], trcanje: ['#bbf7d0', '#16a34a'], mobilnost: ['#bae6fd', '#0891b2'] };
const pgrad = (t) => { const c = CAT_COLOR[t.cat] || ['#e2e8f0', '#64748b']; return `background:linear-gradient(135deg, ${c[0]}, ${c[1]}40)`; };
const KIND = { snaga: '💪 Snaga', core: '🧱 Trup', kardio: '❤️ Kardio', mobilnost: '🧘 Mobilnost', zagrevanje: '🔥 Zagrevanje', odmor: '😮‍💨 Odmor' };
function workoutMinutes(w) {
  if (w.intervals) return Math.round(w.intervals.reduce((s, [, sec]) => s + sec, 0) / 60);
  let sec = 0; for (const [, o] of w.items) sec += o.sets ? o.sets * ((o.reps ? o.reps * 3 * (o.side ? 2 : 1) : o.sec * (o.side ? 2 : 1)) + (w.rest || 60)) : o.sec;
  return Math.round(sec / 60);
}
function weekSchedule(prog) { // pon..ned → naziv treninga ili null
  const out = Array(7).fill(null); let k = 0;
  for (let i = 0; i < 7; i++) { const d = (i + 1) % 7; if (prog.days.includes(d)) out[i] = prog.workouts[k++ % prog.workouts.length].name; }
  return out;
}
function progCard(t, sel) {
  return `<button class="pcard ${sel ? 'on' : ''}" data-h="prog-open" data-v="${t.id}"><div class="pc-top" style="${pgrad(t)}"><span>${t.icon}</span>${sel ? '<em>✓ Tvoj program</em>' : ''}</div>
    <div class="pc-body"><b>${esc(t.name)}</b><small>${esc(t.goal || t.desc)}</small>
    <div class="pc-chips"><span>${esc(t.level)}</span><span>${t.days.length}× ned.</span><span>~${Math.max(...t.workouts.map(workoutMinutes))} min</span>${t.weeks ? `<span>${t.weeks} ned.</span>` : ''}<span>${t.equipment.length ? '🏋️ oprema' : '🏠 bez opreme'}</span></div></div></button>`;
}
function hTrain() {
  const h = H(), prog = TRAININGS.find((t) => t.id === h.program);
  if (!prog || h.showProgs) {
    return `<div class="r-search"><div class="grow"></div><button class="btn" data-h="exlib">📖 Biblioteka vežbi</button></div>
      <div class="chips">${Object.entries(TRAIN_CATS).map(([k, v]) => `<button class="chip ${k === tCat ? 'on' : ''}" data-h="tcat" data-v="${k}">${v}</button>`).join('')}</div>
      ${prog ? `<button class="btn small" data-h="hide-progs" style="margin-bottom:8px">← Nazad na moj program</button>` : '<p class="meta" style="margin:0 2px 8px">Izaberi program – dodirni karticu za detalje.</p>'}
      <div class="pgrid">${TRAININGS.filter((t) => tCat === 'sve' || t.cat === tCat).map((t) => progCard(t, t.id === h.program)).join('')}</div>`;
  }
  // izabran program
  const log = h.log.filter((l) => l.prog === prog.id);
  const weekStartT = weekStart(weekAbs()).getTime();
  const thisWeek = log.filter((l) => l.t >= weekStartT);
  const started = h.progStart || (log[0] && log[0].t) || Date.now();
  const weekNo = Math.floor((Date.now() - started) / (7 * DAY)) + 1;
  const sched = weekSchedule(prog), todayIdx = planDayIdx();
  const doneDays = new Set(thisWeek.map((l) => planDayIdx(new Date(l.t))));
  const next = nextWorkout(prog), ni = prog.workouts.indexOf(next);
  const todayDone = log.some((l) => dayDiff(new Date(l.t)) === 0);
  // poslednjih 8 nedelja
  const wk = Array.from({ length: 8 }, (_, i) => { const ws = weekStart(weekAbs() - 7 + i).getTime(); return h.log.filter((l) => l.t >= ws && l.t < ws + 7 * DAY).length; });
  const maxW = Math.max(prog.days.length, ...wk);
  const totMin = h.log.reduce((s, l) => s + (l.dur || 0), 0), totVol = h.log.reduce((s, l) => s + (l.vol || 0), 0);
  let streak = 0; for (let i = wk[7] ? 7 : 6; i >= 0 && wk[i] >= 1; i--) streak++; // uzastopne nedelje sa bar jednim treningom
  const hasRem = S.reminders.some((r) => r.src === 'trening' && !r.done);
  return `<div class="p-hero" style="${pgrad(prog)}"><div><small>MOJ PROGRAM</small><b>${prog.icon} ${esc(prog.name)}</b><span>${esc(prog.goal || '')}</span></div>
      ${prog.weeks ? `<div class="p-prog"><div><b>Nedelja ${Math.min(weekNo, prog.weeks)}</b> od ${prog.weeks}</div><div class="progress"><div style="width:${Math.min(100, Math.round((weekNo / prog.weeks) * 100))}%"></div></div></div>` : ''}</div>
    <div class="wk-strip">${sched.map((name, i) => `<div class="${i === todayIdx ? 'today' : ''} ${name ? 'train' : ''} ${doneDays.has(i) ? 'done' : ''}"><small>${WD_SHORT[(i + 1) % 7]}</small><span>${doneDays.has(i) ? '✓' : name ? '🏋️' : '·'}</span></div>`).join('')}</div>
    <div class="next-card"><div><small>${todayDone ? 'DANAS URAĐENO ✅' : sched[todayIdx] ? 'DANAS' : 'SLEDEĆI TRENING'}</small><b>${esc(next.name)}</b><span>~${workoutMinutes(next)} min · ${(next.items || []).filter(([, o]) => o.sets).length || '⏱'} ${next.items ? 'vežbi' : 'intervalni'}</span></div>
      <button class="btn primary" data-h="start" data-p="${prog.id}" data-w="${ni}">▶ Počni</button></div>
    <div class="stat-row"><div><b>${thisWeek.length}/${prog.days.length}</b><small>ove nedelje</small></div><div><b>${streak}</b><small>nedelja u nizu</small></div><div><b>${Math.round(totMin / 60 * 10) / 10} h</b><small>ukupno</small></div>${totVol ? `<div><b>${totVol >= 1000 ? fmtNum(Math.round(totVol / 100) / 10) + ' t' : totVol + ' kg'}</b><small>podignuto</small></div>` : ''}</div>
    ${whoCard(h)}
    <div class="grp-h">📊 Treninzi po nedeljama</div>
    <div class="bars">${wk.map((n, i) => `<div><span style="height:${Math.round((n / maxW) * 100)}%">${n || ''}</span><small>${i === 7 ? 'ova' : '-' + (7 - i)}</small></div>`).join('')}</div>
    ${prog.note ? `<div class="banner" style="margin-top:12px"><span>🧑‍🏫 <b>Saveti trenera:</b> ${esc(prog.note)}</span></div>` : ''}
    <div class="grp-h">📋 Treninzi u programu</div>
    ${prog.workouts.map((w, i) => `<details class="wcard" ${i === ni ? 'open' : ''}><summary><b>${esc(w.name)}</b><span>~${workoutMinutes(w)} min</span></summary>
      <div class="h-ex">${(w.items || w.intervals.filter((x, k, a) => k === 0 || x[0] !== a[k - 1][0]).slice(0, 8)).map(([e, o]) => {
        const ex = EXERCISES[e];
        const t = w.items ? (o.sets ? `${o.sets}× ${o.reps ? o.reps + (o.side ? '/str.' : '') : fmtSec(o.sec)}` : fmtSec(o.sec)) : fmtSec(o);
        return `<div data-h="ex" data-v="${e}"><span>${ex.icon} ${esc(ex.name)} <i>ⓘ</i></span><b>${t}</b></div>`; }).join('')}</div>
      <button class="btn block" data-h="start" data-p="${prog.id}" data-w="${i}" style="margin-top:8px">▶ Počni ${esc(w.name)}</button></details>`).join('')}
    <div class="row" style="margin-top:12px"><button class="btn grow" data-h="train-rem">⏰ ${hasRem ? 'Promeni podsetnik' : 'Podsetnik'}</button><button class="btn grow" data-h="exlib">📖 Vežbe</button><button class="btn grow" data-h="show-progs">↔ Programi</button></div>
    ${log.length ? `<div class="grp-h">📈 Istorija</div><div class="grp">${log.slice(-6).reverse().map((l) => `<div class="item-row"><span class="tick" style="background:var(--ok);border-color:var(--ok)">✓</span><span class="nm">${esc(prog.workouts[l.w] ? prog.workouts[l.w].name : '')}<small class="meta" style="display:block">${l.dur ? l.dur + ' min' : ''}${l.sets ? ' · ' + l.sets + ' serija' : ''}${l.vol ? ' · ' + l.vol + ' kg' : ''}</small></span><span class="meta">${fmtWhen(new Date(l.t))}</span></div>`).join('')}</div>` : ''}`;
}
function openProgram(id) {
  const t = TRAININGS.find((x) => x.id === id), h = H(), sel = h.program === id, sched = weekSchedule(t);
  openSheet(`<div id="pgWrap"><div class="rec-hero" style="${pgrad(t)}"><span class="rec-hero-ic">${t.icon}</span><button class="iconbtn rec-x" data-g="x">✕</button></div>
    <h3 class="rec-title">${esc(t.name)}</h3><p class="meta" style="margin:-4px 0 10px">${esc(t.desc)}</p>
    <div class="rec-stats"><div><b>${esc(t.level.split('–')[0])}</b><small>nivo</small></div><div><b>${t.days.length}×</b><small>nedeljno</small></div><div><b>~${Math.max(...t.workouts.map(workoutMinutes))}</b><small>min</small></div><div><b>${t.weeks || '∞'}</b><small>nedelja</small></div></div>
    ${t.goal ? `<div class="rec-badges"><span>🎯 ${esc(t.goal)}</span></div>` : ''}
    <h2>Nedeljni raspored</h2><div class="wk-strip big">${sched.map((n, i) => `<div class="${n ? 'train' : ''}"><small>${WD_SHORT[(i + 1) % 7]}</small><span>${n ? esc(n.replace(/^Trening /, '')) : 'odmor'}</span></div>`).join('')}</div>
    <h2>Oprema</h2><p style="margin:0">${t.equipment.length ? esc(t.equipment.join(', ')) : '🏠 Nije potrebna – samo prostor i podloga'}</p>
    ${t.note ? `<div class="rec-tip">🧑‍🏫 <b>Kako napredovati:</b> ${esc(t.note)}</div>` : ''}
    ${safetyTrainBlock()}
    ${reviewBadge('programs', t.id)}
    <button class="btn block small" data-g="report" style="margin-top:6px">🚩 Prijavi grešku u programu</button>
    <h2>Treninzi</h2>${t.workouts.map((w) => `<div class="wcard-s"><b>${esc(w.name)}</b> <span class="meta">~${workoutMinutes(w)} min</span><div class="h-ex">${(w.items || w.intervals.filter((x, k, a) => k === 0 || x[0] !== a[k - 1][0]).slice(0, 6)).map(([e, o]) => `<div data-g="ex" data-v="${e}"><span>${EXERCISES[e].icon} ${esc(EXERCISES[e].name)} <i>ⓘ</i></span><b>${w.items ? (o.sets ? `${o.sets}× ${o.reps || fmtSec(o.sec)}` : fmtSec(o.sec)) : fmtSec(o)}</b></div>`).join('')}</div></div>`).join('')}
    <div class="foot"><button class="btn" data-g="x">Zatvori</button>${sel ? '<button class="btn danger" data-g="leave">Napusti program</button>' : '<button class="btn primary" data-g="pick">✓ Izaberi program</button>'}</div></div>`, () => {
    $('#pgWrap').addEventListener('click', (e) => {
      const b = e.target.closest('[data-g]'); if (!b) return;
      const a = b.dataset.g;
      if (a === 'x') return closeSheet();
      if (a === 'ex') return openExercise(b.dataset.v, () => openProgram(id));
      if (a === 'parq') return parqSheet(() => openProgram(id));
      if (a === 'report') return reportProblem('programs', t.id, t.name, () => openProgram(id));
      if (a === 'pick') { h.program = id; h.progStart = Date.now(); h.showProgs = false; save(false); closeSheet(); render(); toast(`Program „${t.name}“ izabran 💪`); }
      if (a === 'leave') { if (!confirm('Napustiti program? Istorija ostaje sačuvana.')) return; h.program = null; save(false); closeSheet(); render(); }
    });
  });
}
function openExercise(key, back) {
  const ex = EXERCISES[key];
  openSheet(`<div id="exWrap"><div class="ex-hero"><span>${ex.icon}</span></div><h3 class="rec-title">${esc(ex.name)}</h3>
    <div class="rec-badges">${ex.kind ? `<span>${KIND[ex.kind] || ex.kind}</span>` : ''}${ex.equip ? `<span>🧰 ${esc(ex.equip)}</span>` : ''}</div>
    ${ex.prim ? `<div class="muscles"><div><small>GLAVNI MIŠIĆI</small><b>${esc(ex.prim)}</b></div>${ex.sec ? `<div><small>POMOĆNI</small><b>${esc(ex.sec)}</b></div>` : ''}</div>` : ''}
    <h2>Kako se radi</h2><p style="margin:0 0 6px;line-height:1.5">${esc(ex.how)}</p>
    ${ex.cues && ex.cues.length ? `<h2>✅ Tehnika</h2><ol class="cues">${ex.cues.map((c) => `<li>${esc(c)}</li>`).join('')}</ol>` : ''}
    ${ex.mistakes && ex.mistakes.length ? `<h2>⚠️ Česte greške</h2><ul class="mist">${ex.mistakes.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
    ${ex.easier || ex.harder ? `<div class="var-row">${ex.easier ? `<div><small>⬇ LAKŠE</small>${esc(ex.easier)}</div>` : ''}${ex.harder ? `<div><small>⬆ TEŽE</small>${esc(ex.harder)}</div>` : ''}</div>` : ''}
    <div class="foot">${back ? '<button class="btn" data-x="back">← Nazad</button>' : ''}<button class="btn primary" data-x="close">U redu</button></div></div>`, () => {
    $('#exWrap').addEventListener('click', (e) => { const b = e.target.closest('[data-x]'); if (!b) return; if (b.dataset.x === 'back' && back) back(); else closeSheet(); });
  });
}
let exKind = 'sve', exQ = '';
function exerciseLibrary() {
  const keys = Object.keys(EXERCISES).filter((k) => k !== 'odmor');
  const draw = () => {
    const f = fold(exQ);
    const list = keys.filter((k) => { const e = EXERCISES[k]; return (exKind === 'sve' || e.kind === exKind) && (!f || fold(e.name).includes(f) || fold(e.prim || '').includes(f)); });
    return `<div id="elWrap"><h3>📖 Biblioteka vežbi <span class="meta">(${keys.length})</span></h3>
      <input class="input" id="elQ" placeholder="🔎 Vežba ili mišić (npr. zadnjica, leđa)" value="${esc(exQ)}" autocomplete="off">
      <div class="chips" style="margin-top:8px">${Object.entries({ sve: 'Sve', snaga: KIND.snaga, core: KIND.core, kardio: KIND.kardio, mobilnost: KIND.mobilnost }).map(([k, v]) => `<button class="chip ${k === exKind ? 'on' : ''}" data-l="k" data-v="${k}">${v}</button>`).join('')}</div>
      <div class="grp">${list.map((k) => { const e = EXERCISES[k]; return `<div class="item-row" data-l="ex" data-v="${k}"><span class="h-ic" style="font-size:24px">${e.icon}</span><span class="nm">${esc(e.name)}<small class="meta" style="display:block">${esc(e.prim || '')}${e.equip && e.equip !== 'bez opreme' ? ' · ' + esc(e.equip) : ''}</small></span><span class="meta">›</span></div>`; }).join('') || '<div class="empty" style="padding:20px">Nema vežbi</div>'}</div>
      <div class="foot"><button class="btn" onclick="closeSheet()">Zatvori</button></div></div>`;
  };
  const mount = () => {
    const q = $('#elQ');
    q.addEventListener('input', () => { exQ = q.value; const pos = q.value.length; setTimeout(() => { $('#sheet').innerHTML = draw(); mount(); const n = $('#elQ'); n.focus(); n.setSelectionRange(pos, pos); }, 0); });
    $('#elWrap').addEventListener('click', (e) => {
      const b = e.target.closest('[data-l]'); if (!b) return;
      if (b.dataset.l === 'k') { exKind = b.dataset.v; $('#sheet').innerHTML = draw(); mount(); }
      if (b.dataset.l === 'ex') openExercise(b.dataset.v, exerciseLibrary);
    });
  };
  openSheet(draw(), mount);
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

// ---------------------------------------------------------------- KUHINJSKI TAJMER I KUVANJE KORAK PO KORAK
// tajmeri se čuvaju u S.ktimers da prežive zatvaranje aplikacije i mogu da se ugase
const KT = () => (S.ktimers = S.ktimers || []);
const webTimeouts = {};
function armWebTimer(t) {
  clearTimeout(webTimeouts[t.id]);
  const left = t.end - Date.now(); if (left <= 0 || IS_NATIVE) return;
  webTimeouts[t.id] = setTimeout(() => { showWebNotification({ key: 'tm' + t.id, title: '⏱ Tajmer je istekao', body: t.label, tab }); try { navigator.vibrate && navigator.vibrate([400, 150, 400]); } catch { /* */ } }, left);
}
async function startKitchenTimer(min, label) {
  const end = Date.now() + min * MIN, id = 7000 + Math.floor(Math.random() * 900);
  const t = { id, end, label, min };
  KT().push(t); save(false);
  if (IS_NATIVE) { // stiže i kad je aplikacija zatvorena
    try { await LN.schedule({ notifications: [{ id, title: '⏱ Tajmer je istekao', body: label, schedule: { at: new Date(end), allowWhileIdle: true }, channelId: 'podsetnici', smallIcon: 'ic_stat_notify' }] }); } catch { /* */ }
  } else armWebTimer(t);
  toast(`⏱ Tajmer ${min} min pokrenut – dodirni ga gore desno da ga ugasiš`, 3500);
  drawTimerBar();
}
async function cancelKitchenTimer(id) {
  S.ktimers = KT().filter((t) => t.id !== id); save(false);
  clearTimeout(webTimeouts[id]);
  if (IS_NATIVE) { try { await LN.cancel({ notifications: [{ id }] }); } catch { /* */ } }
  drawTimerBar();
}
function timerMenu(id) {
  const t = KT().find((x) => x.id === id); if (!t) return;
  const left = Math.max(0, Math.round((t.end - Date.now()) / 1000));
  openSheet(`<h3>⏱ Tajmer</h3><p class="meta" style="margin:0">${esc(t.label)}</p>
    <div class="pl-time" style="text-align:center">${left ? mmss(left) : 'Gotovo!'}</div>
    <div class="row"><button class="btn danger grow" id="tmOff">✕ Ugasi tajmer</button>
      ${KT().length > 1 ? '<button class="btn grow" id="tmAll">Ugasi sve</button>' : ''}</div>
    <div class="foot"><button class="btn" onclick="closeSheet()">Zatvori</button></div>`, () => {
    $('#tmOff').onclick = () => { cancelKitchenTimer(id); closeSheet(); toast('Tajmer ugašen'); };
    if ($('#tmAll')) $('#tmAll').onclick = () => { KT().slice().forEach((x) => cancelKitchenTimer(x.id)); closeSheet(); toast('Svi tajmeri ugašeni'); };
  });
}
function drawTimerBar() {
  const now = Date.now();
  // istekli se sami sklone posle 60 s
  const before = KT().length;
  S.ktimers = KT().filter((t) => t.end > now - 60000);
  if (S.ktimers.length !== before) save(false);
  let bar = $('#ktbar');
  if (!S.ktimers.length) { if (bar) bar.remove(); clearInterval(drawTimerBar.iv); drawTimerBar.iv = null; return; }
  if (!bar) {
    bar = document.createElement('div'); bar.id = 'ktbar'; document.body.appendChild(bar);
    bar.addEventListener('click', (e) => {
      const x = e.target.closest('[data-kx]'); if (x) { e.stopPropagation(); cancelKitchenTimer(+x.dataset.kx); return toast('Tajmer ugašen'); }
      const c = e.target.closest('[data-kt]'); if (c) timerMenu(+c.dataset.kt);
    });
  }
  bar.innerHTML = S.ktimers.map((t) => { const l = Math.max(0, Math.round((t.end - now) / 1000));
    return `<span class="kt ${l ? '' : 'done'}" data-kt="${t.id}">⏱ ${l ? mmss(l) : 'Gotovo!'}<button class="kx" data-kx="${t.id}" aria-label="Ugasi">✕</button></span>`; }).join('');
  if (!drawTimerBar.iv) drawTimerBar.iv = setInterval(drawTimerBar, 1000);
}
// posle ponovnog otvaranja aplikacije vrati tajmere koji još traju
document.addEventListener('DOMContentLoaded', () => setTimeout(() => { KT().forEach(armWebTimer); drawTimerBar(); }, 500));
function cookMode(r) {
  let i = 0, wake = null;
  try { navigator.wakeLock && navigator.wakeLock.request('screen').then((l) => (wake = l)).catch(() => {}); } catch { /* */ }
  const draw = () => {
    const st = r.steps[i], m = stepMinutes(st), last = i === r.steps.length - 1;
    return `<div id="ck"><div class="pl-top"><button class="iconbtn" data-c="x">✕</button><div class="progress grow"><div style="width:${Math.round(((i + 1) / r.steps.length) * 100)}%"></div></div><span class="meta">${i + 1}/${r.steps.length}</span></div>
      <div class="ck-main"><div class="ck-title">${r.icon} ${esc(r.name)}</div><div class="ck-n">Korak ${i + 1}</div><p class="ck-step">${esc(st)}</p>
      ${m ? `<button class="btn primary" data-c="t" data-m="${m}">⏱ Pokreni tajmer ${m >= 60 ? fmtNum(Math.round(m / 6) / 10) + ' h' : m + ' min'}</button>` : ''}
      ${last && r.tip ? `<div class="rec-tip" style="margin-top:16px">💡 ${esc(r.tip)}</div>` : ''}</div>
      <div class="pl-btns"><button class="btn" data-c="p" ${i ? '' : 'disabled'}>◀ Nazad</button><button class="btn ${last ? 'ok' : 'primary'} grow" data-c="n">${last ? '✓ Prijatno!' : 'Sledeći korak ▶'}</button></div></div>`;
  };
  const close = () => { try { wake && wake.release(); } catch { /* */ } $('#sheet').classList.remove('full'); closeSheet(); };
  const mount = () => $('#ck').addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]'); if (!b) return;
    const c = b.dataset.c;
    if (c === 'x') return close();
    if (c === 't') return startKitchenTimer(+b.dataset.m, `${r.name} – korak ${i + 1}`);
    if (c === 'p' && i > 0) i--;
    if (c === 'n') { if (i === r.steps.length - 1) return close(); i++; }
    $('#sheet').innerHTML = draw(); mount();
  });
  openSheet(draw(), mount);
  $('#sheet').classList.add('full');
}

// ---------------------------------------------------------------- VOĐENI TRENING
let player = null, actx = null;
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
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); } catch { /* */ }
  player = { prog, wi, w, steps, i: 0, left: 0, total: 0, running: false, timer: null, wake: null, t0: Date.now(), done: [], reps: null };
  try { navigator.wakeLock && navigator.wakeLock.request('screen').then((l) => (player && (player.wake = l))).catch(() => {}); } catch { /* */ }
  openSheet('<div id="pl"></div>', () => { $('#pl').addEventListener('click', onPlayer); });
  $('#sheet').classList.add('full');
  enterStep();
}
function enterStep() {
  const st = player.steps[player.i];
  clearInterval(player.timer); player.running = false;
  player.left = player.total = st.rest || st.sec || 0;
  player.reps = st.reps || null;
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
    const ring = $('#plRing'); if (ring) ring.style.strokeDashoffset = String(301.6 * (1 - player.left / player.total));
  }, 1000);
  drawPlayer();
}
const mmss = (s) => `${Math.floor(s / 60)}:${pad(s % 60)}`;
function beep(long) {
  try { navigator.vibrate && navigator.vibrate(long ? [300, 100, 300] : 80); } catch { /* */ }
  try {
    if (!actx) return;
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.value = long ? 880 : 660; g.gain.value = 0.15;
    o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + (long ? 0.45 : 0.12));
  } catch { /* */ }
}
function nextStep() {
  if (!player) return;
  const st = player.steps[player.i];
  if (!st.rest && st.set) player.done.push({ e: st.e, reps: player.reps || 0, kg: EXERCISES[st.e].gym ? (H().weights[st.e] || 0) : 0 });
  if (player.i < player.steps.length - 1) { player.i++; enterStep(); }
  else finishWorkout();
}
function finishWorkout() {
  clearInterval(player.timer);
  const h = H(), dur = Math.max(1, Math.round((Date.now() - player.t0) / MIN));
  const vol = Math.round(player.done.reduce((s, d) => s + d.reps * d.kg, 0));
  h.best = h.best || {};
  const prs = [];
  for (const d of player.done) if (d.kg && d.kg > (h.best[d.e] || 0)) { h.best[d.e] = d.kg; if (!prs.includes(d.e)) prs.push(d.e); }
  h.log.push({ t: Date.now(), prog: player.prog.id, w: player.wi, dur, sets: player.done.length, vol });
  h.log = h.log.slice(-300);
  save(false);
  const wk = h.log.filter((l) => l.t >= weekStart(weekAbs()).getTime()).length;
  $('#pl').innerHTML = `<div class="pl-done"><div style="font-size:72px">🎉</div><h3>Bravo, trening je gotov!</h3><p class="meta">${esc(player.w.name)}</p>
    <div class="stat-row"><div><b>${dur}</b><small>minuta</small></div><div><b>${player.done.length || player.steps.length}</b><small>${player.done.length ? 'serija' : 'intervala'}</small></div>${vol ? `<div><b>${vol}</b><small>kg ukupno</small></div>` : ''}<div><b>${wk}</b><small>ove nedelje</small></div></div>
    ${prs.length ? `<div class="rec-tip">🏆 <b>Novi lični rekord:</b> ${prs.map((e) => `${esc(EXERCISES[e].name)} – ${fmtNum(h.best[e])} kg`).join(', ')}</div>` : ''}
    <p class="meta">Popij vode, istegni se i odmori. Sledeći trening: ${esc(nextWorkout(player.prog).name)}.</p>
    <button class="btn primary block" data-p="close">Super 💪</button></div>`;
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
  if (a === 'info') { const st = player.steps[player.i]; player.showInfo = !player.showInfo; void st; return drawPlayer(); }
  if (a === 'r+' || a === 'r-') { player.reps = Math.max(0, (player.reps || 0) + (a === 'r+' ? 1 : -1)); return drawPlayer(); }
  if (a === 'plus15') { player.left += 15; player.total += 15; return drawPlayer(); }
  if (a === 'w+' || a === 'w-') {
    const st = player.steps[player.i], w = H().weights;
    const cur = w[st.e] != null ? w[st.e] : 20;
    w[st.e] = Math.max(0, (w[st.e] == null && a === 'w+') ? 20 : cur + (a === 'w+' ? 2.5 : -2.5));
    save(false); return drawPlayer();
  }
  if (a === 'back' && player.i > 0) { player.i--; return enterStep(); }
  if (a === 'play') { if (player.running) { clearInterval(player.timer); player.running = false; drawPlayer(); } else startTimer(); }
}
function ring(left, total, label) {
  const off = total ? 301.6 * (1 - left / total) : 0;
  return `<div class="ring"><svg viewBox="0 0 110 110"><circle cx="55" cy="55" r="48" class="ring-bg"/><circle id="plRing" cx="55" cy="55" r="48" class="ring-fg" style="stroke-dashoffset:${off}"/></svg>
    <div><div class="pl-time" id="plTime">${mmss(left)}</div>${label ? `<small>${label}</small>` : ''}</div></div>`;
}
function drawPlayer() {
  const el = $('#pl'); if (!el || !player) return;
  const st = player.steps[player.i], total = player.steps.length;
  const nxt = player.steps.slice(player.i + 1).find((s) => !s.rest);
  const pct = Math.round((player.i / total) * 100);
  const top = `<div class="pl-top"><button class="iconbtn" data-p="quit">✕</button><div class="progress grow"><div style="width:${pct}%"></div></div><span class="meta">${mmss(Math.round((Date.now() - player.t0) / 1000))}</span></div>`;
  const nextLine = nxt ? `<div class="pl-next">Sledeće: ${EXERCISES[nxt.e].icon} <b>${esc(EXERCISES[nxt.e].name)}</b>${nxt.set ? ` · ${nxt.set}/${nxt.sets}` : ''}${nxt.reps ? ` · ${nxt.reps} pon.` : nxt.sec ? ` · ${fmtSec(nxt.sec)}` : ''}</div>` : '<div class="pl-next">Poslednja vežba 💪</div>';
  if (st.rest) {
    el.innerHTML = `${top}<div class="pl-main"><h3>Odmor</h3>${ring(player.left, player.total, 'diši duboko')}</div>${nextLine}
      <div class="pl-btns"><button class="btn" data-p="plus15">+15 s</button><button class="btn primary grow" data-p="skip">Preskoči odmor ▶</button></div>`;
    return;
  }
  const ex = EXERCISES[st.e];
  const wt = H().weights[st.e], best = (H().best || {})[st.e];
  const target = st.reps
    ? `<div class="pl-reps-row"><button class="q-btn" data-p="r-">−</button><div class="pl-reps">${player.reps}<small>${st.side ? ' po strani' : ' pon.'}</small></div><button class="q-btn" data-p="r+">+</button></div><div class="meta">cilj: ${st.reps}${st.reps !== player.reps ? ' · upisaćeš ' + player.reps : ''}</div>`
    : ring(player.left, player.total || 1, st.side ? 'po strani' : (player.running ? '' : 'dodirni Start'));
  const weight = ex.gym ? `<div class="pl-w"><span>Težina</span><div class="stepper"><button data-p="w-">−</button><span>${wt != null ? fmtNum(wt) + ' kg' : '–'}</span><button data-p="w+">+</button></div>${best ? `<small>rekord ${fmtNum(best)} kg</small>` : ''}</div>` : '';
  const info = player.showInfo && ex.cues ? `<div class="pl-info">${ex.cues.map((c) => `<div>✅ ${esc(c)}</div>`).join('')}${(ex.mistakes || []).map((c) => `<div>⚠️ ${esc(c)}</div>`).join('')}</div>` : `<p class="pl-how">${esc(ex.how)}</p>`;
  el.innerHTML = `${top}
    <div class="pl-main"><div class="pl-ic">${ex.icon}</div><h3>${esc(ex.name)}</h3>${st.set ? `<div class="pl-set">Serija <b>${st.set}</b> od ${st.sets}</div>` : ''}
      ${target}${weight}${info}<button class="btn small" data-p="info">${player.showInfo ? 'Sakrij tehniku' : 'ℹ️ Tehnika i greške'}</button></div>
    ${nextLine}
    <div class="pl-btns"><button class="btn" data-p="back">◀</button>
      ${st.reps ? '<button class="btn ok grow" data-p="done">✓ Serija urađena</button>'
        : `<button class="btn primary grow" data-p="play">${player.running ? '⏸ Pauza' : '▶ Start'}</button><button class="btn" data-p="skip">⏭</button>`}</div>`;
}

// ---------------------------------------------------------------- klikovi
document.addEventListener('DOMContentLoaded', () => $('#view').addEventListener('click', (e) => {
  const b = e.target.closest('[data-h]'); if (!b || tab !== 'zdravlje') return;
  const a = b.dataset.h, h = H();
  if (a === 'sub') { hsub = b.dataset.v; render(); window.scrollTo(0, 0); }
  if (a === 'rfilter') { rFilter = b.dataset.v; render(); }
  if (a === 'rtype') { rType = b.dataset.v; render(); window.scrollTo(0, 0); }
  if (a === 'fridge') fridgeFinder();
  if (a === 'dcat') { dCat = b.dataset.v; render(); }
  if (a === 'tcat') { tCat = b.dataset.v; render(); }
  if (a === 'recipe') openRecipe(b.dataset.id);
  if (a === 'plan') { h.plan = h.plan === b.dataset.v && !h.showPlans ? null : b.dataset.v; h.planWeek = weekAbs(); h.showPlans = false; dWeek = 0; save(false); render(); }
  if (a === 'show-plans') { h.showPlans = true; render(); }
  if (a === 'show-progs') { h.showProgs = true; render(); window.scrollTo(0, 0); }
  if (a === 'hide-progs') { h.showProgs = false; render(); }
  if (a === 'prog-open') openProgram(b.dataset.v);
  if (a === 'exlib') exerciseLibrary();
  if (a === 'ex') openExercise(b.dataset.v);
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
