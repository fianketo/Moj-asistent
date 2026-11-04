/* Zdravlje – ekrani: Danas, Recepti, Ishrana, Treninzi i vođeni trening. */
'use strict';

const H = () => (S.health = Object.assign({ plan: null, program: null, favs: [], log: [], persons: 1, weights: {}, recent: [] }, S.health || {}));
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
  html += `<p class="h-note">ℹ️ Opšti predlozi za zdrave odrasle osobe – nisu zamena za savet lekara ili nutricioniste. Kalorije su približne.</p>`;
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
      <input class="input" id="frIn" list="frList" placeholder="npr. jaja, krompir, piletina…" autocomplete="off"><datalist id="frList">${all.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
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
    inp.addEventListener('change', () => inp.value.trim() && add(inp.value.trim()));
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && inp.value.trim()) add(inp.value.trim()); });
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
        <button class="btn block" data-r="tab" data-v="priprema" style="margin-top:8px">Dalje: priprema →</button>`
      : `<button class="btn primary block" data-r="cook" style="margin:10px 0">👨‍🍳 Kuvaj korak po korak</button>
        <ol class="rec-steps2">${r.steps.map((st, i) => { const m = stepMinutes(st); return `<li><span class="sn">${i + 1}</span><div>${esc(st)}${m ? ` <button class="tmr" data-r="timer" data-m="${m}" data-l="${esc(r.name)} – korak ${i + 1}">⏱ ${fmtMin(m)}</button>` : ''}</div></li>`; }).join('')}</ol>
        ${r.tip ? `<div class="rec-tip">💡 <b>Savet:</b> ${esc(r.tip)}</div>` : ''}`}
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
  if (a === 'rtype') { rType = b.dataset.v; render(); window.scrollTo(0, 0); }
  if (a === 'fridge') fridgeFinder();
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
