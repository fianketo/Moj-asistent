/* Početni ekran „Danas“ – bento pločice: parking, sledeći podsetnik, kupovina, obrok, trening. */
'use strict';

let homeTimer = null;
function haptic(ms = 8) { try { navigator.vibrate && navigator.vibrate(ms); } catch { /* */ } }
function greeting(d = new Date()) { const h = d.getHours(); return h < 5 ? 'Laku noć' : h < 12 ? 'Dobro jutro' : h < 18 ? 'Dobar dan' : 'Dobro veče'; }
const ico = (id) => `<svg viewBox="0 0 24 24" class="ti"><use href="#i-${id}"/></svg>`;

function homeMealKey(d = new Date()) { const h = d.getHours(); return h < 10 ? 'dorucak' : h < 15 ? 'rucak' : h < 18 ? 'uzina' : 'vecera'; }
function homeMeal() {
  const h = H(), plan = DIET_PLANS.find((p) => p.id === h.plan), mk = homeMealKey(), mi = MEAL_KEYS.indexOf(mk);
  if (plan) {
    const day = planWeek(plan, weekAbs())[planDayIdx()];
    let i = mi; while (i < 4 && !day[i]) i++;
    const r = recipeById(day[i] || day.find(Boolean));
    if (r) return { r, label: MEALS[MEAL_KEYS[i]] || 'Obrok', from: plan.name };
  }
  const pool = RECIPES.filter((r) => r.meal.includes(mk) && r.type !== 'desert');
  const t = new Date(), rnd = seeded(`dan:${t.getFullYear()}-${t.getMonth()}-${t.getDate()}:${mk}`);
  return { r: pool[Math.floor(rnd() * pool.length)] || RECIPES[0], label: 'Predlog za ' + (MEALS[mk] || '').toLowerCase(), from: '' };
}
function parkLeftTxt(ms) {
  if (ms <= 0) return 'ISTEKLO';
  const h = Math.floor(ms / HOUR), m = Math.floor((ms % HOUR) / MIN), s = Math.floor((ms % MIN) / 1000);
  return h ? `${h}:${pad(m)}` : `${pad(m)}:${pad(s)}`;
}

// poslednje parkiranje koje je telefon sam prepoznao (Bluetooth / kretanje), dok ponovo ne kreneš autom
let geoHome = null;
function homePark() {
  const g = geoHome; if (!g || !g.lastParkAt) return null;
  if (g.driving || (g.lastVehicle && g.lastVehicle > g.lastParkAt + 60e3)) return null; // ponovo vozi
  if (Date.now() - g.lastParkAt > 18 * HOUR) return null;
  return { at: g.lastParkAt, zone: g.lastParkZone, loc: g.lastParkLoc };
}
function refreshGeoHome() {
  if (typeof Geo === 'undefined' || !Geo || !S.parking.auto) return;
  Geo.status().then((st) => {
    const key = (x) => x && [x.lastParkAt, x.lastParkZone, x.driving, x.lastVehicle].join('|');
    const changed = key(st) !== key(geoHome); geoHome = st;
    if (changed && tab === 'danas' && $('#sheetBg').hidden) renderHome();
  }).catch(() => {});
}
function renderHome() {
  refreshGeoHome();
  const now = Date.now(), P = S.parking, A = P.active;
  // podsetnici
  const open = S.reminders.filter((r) => !r.done && r.at).map((r) => ({ r, d: parseLocal(r.at) })).filter((x) => x.d).sort((a, b) => a.d - b.d);
  const late = open.filter((x) => x.d.getTime() < now);
  const upcoming = open.filter((x) => x.d.getTime() >= now);
  const next = upcoming[0];
  const todayCnt = upcoming.filter((x) => dayDiff(x.d) === 0).length;
  // kupovina
  const L = curList(), tot = L.items.length, got = L.items.filter((i) => i.done).length;
  const missing = L.items.filter((i) => !i.done).slice(0, 3).map((i) => i.name);
  // zdravlje
  const h = H(), ws = weekStart(weekAbs()).getTime();
  const min = h.log.filter((l) => l.t >= ws).reduce((s, l) => s + (l.dur || 0), 0);
  const prog = TRAININGS.find((t) => t.id === h.program);
  const meal = homeMeal(), r = meal.r, n = r.nut || {};

  let parkTile;
  if (A) {
    const z = zoneById(A.zone) || { name: A.zoneName || 'Parking' }, left = A.end - now;
    parkTile = `<button class="tile t-park ${left < P.warnMin * MIN ? 'urgent' : ''}" data-home="parking">
      <small>${ico('park')} ${esc(z.name)}${A.plate ? ' · ' + esc(A.plate) : ''}</small>
      <div class="t-count" id="homePark">${parkLeftTxt(left)}</div>
      <div class="t-row"><span>ističe u <b>${hm(new Date(A.end))}</b></span><span class="t-cta" data-home="park-extend">Produži</span></div></button>`;
  } else if (homePark()) {
    const lp = homePark(), lat = lp.loc && lp.loc.split(',');
    parkTile = lp.zone
      ? `<button class="tile t-park idle warn" data-home="parking">
          <small>${ico('park')} Parkirani ste od ${hm(new Date(lp.at))}</small>
          <div class="t-big">${esc(lp.zone)}</div>
          <div class="t-row"><span>Parking još nije plaćen</span><span class="t-cta" data-home="park-start">Plati parking</span></div></button>`
      : `<button class="tile t-park idle free" data-home="parking">
          <small>${ico('park')} Parkirani ste od ${hm(new Date(lp.at))}</small>
          <div class="t-big">Van zone naplate parkinga</div>
          <div class="t-row"><span>Ne treba da plaćate parking</span>${lat ? `<span class="t-cta" data-home="park-map" data-ll="${esc(lp.loc)}">Gde je auto?</span>` : ''}</div></button>`;
  } else {
    const dz = detect.ns ? zoneById('ns-' + detect.ns.zone) : detect.spot ? zoneById(detect.spot.zone) : null;
    parkTile = `<button class="tile t-park idle" data-home="parking">
      <small>${ico('park')} Parking</small>
      <div class="t-big">${dz ? `Ovde je ${esc(dz.name)}` : 'Nema plaćenog parkinga'}</div>
      <div class="t-row"><span>${dz ? 'Nemaš plaćen parking u ovoj zoni' : P.auto ? 'Javiću ti kad parkiraš u zoni naplate' : 'Dodirni kad parkiraš u zoni naplate'}</span><span class="t-cta" data-home="park-start">Plati parking</span></div></button>`;
  }

  // podsetnici: sve što kasni + svi za danas; ako danas nema ničeg, prvi sledeći dan sa podsetnicima
  const todayUp = upcoming.filter((x) => dayDiff(x.d) === 0);
  const dayUp = todayUp.length || late.length ? todayUp : next ? upcoming.filter((x) => dayDiff(x.d) === dayDiff(next.d)) : [];
  const dd = dayUp.length ? dayDiff(dayUp[0].d) : 0;
  const dayLbl = late.length || dd === 0 ? 'Danas' : dd === 1 ? 'Sutra' : `${WD[dayUp[0].d.getDay()]}, ${dayUp[0].d.getDate()}. ${MONTHS[dayUp[0].d.getMonth()]}`;
  const items = [...late, ...dayUp], MAXR = 6;
  const remRow = (x, isLate) => `<div class="rl-row ${isLate ? 'late' : ''}" data-home="rem-edit" data-id="${x.r.id}">
      <button class="rl-check" data-home="rem-done" data-id="${x.r.id}" aria-label="Završeno"></button>
      <span class="rl-time">${isLate && dayDiff(x.d) !== 0 ? esc(fmtWhen(x.d).replace(/ u /, ' ')) : hm(x.d)}</span>
      <span class="rl-title">${esc(x.r.title)}${x.r.repeat ? ' <i>🔁</i>' : ''}</span></div>`;
  const remTile = items.length
    ? `<div class="tile t-rem-list ${late.length ? 'has-late' : ''}">
        <div class="rl-head"><small>${ico('alarm')} ${dayLbl}${late.length ? ` · <b class="rl-late">${late.length} kasni</b>` : ''}</small>
          <span class="rl-count">${items.length}</span><button class="rl-add" data-home="new-rem" aria-label="Dodaj podsetnik">+</button></div>
        ${late.slice(0, MAXR).map((x) => remRow(x, true)).join('')}${dayUp.slice(0, Math.max(0, MAXR - late.length)).map((x) => remRow(x, false)).join('')}
        ${items.length > MAXR ? `<button class="rl-more" data-home="podsetnici">+${items.length - MAXR} još · svi podsetnici ›</button>` : ''}</div>`
    : `<button class="tile t-rem empty" data-home="new-rem"><small>${ico('alarm')} Podsetnici</small><b class="t-title">Nema zakazanih obaveza</b><small class="t-foot">+ Dodaj podsetnik</small></button>`;

  const shopTile = `<button class="tile t-shop" data-home="kupovina"><small>${ico('cart')} ${esc(L.name)}</small>
      <div class="t-num">${tot ? `${got}<span>/${tot}</span>` : '0'}</div>
      <div class="t-prog"><div style="width:${tot ? Math.round((got / tot) * 100) : 0}%"></div></div>
      <small class="t-foot">${tot - got ? esc(missing.join(', ')) + (tot - got > 3 ? '…' : '') : tot ? 'Sve kupljeno ✓' : 'Lista je prazna'}</small></button>`;

  const pct = Math.min(1, min / WHO_MIN), R = 26, C = 2 * Math.PI * R;
  const whoTile = `<button class="tile t-who" data-home="treninzi">
      <svg viewBox="0 0 64 64" class="t-ring"><circle cx="32" cy="32" r="${R}"/><circle cx="32" cy="32" r="${R}" class="v" style="stroke-dasharray:${(C * pct).toFixed(1)} ${C.toFixed(1)}"/></svg>
      <div><div class="t-num">${min}<span>′</span></div><small>od ${WHO_MIN} min SZO</small></div></button>`;

  const mealTile = `<button class="tile t-meal" data-home="recipe" data-id="${r.id}">
      <div class="t-pic" style="${grad(r)}">${r.icon}</div>
      <div class="t-mbody"><small>${esc(meal.label)}</small><b>${esc(r.name)}</b>
        <div class="t-chips"><span>${r.kcal} kcal</span>${n.p != null ? `<span>${Math.round(n.p)} g proteina</span>` : ''}<span>${fmtMin(r.min)}</span></div></div></button>`;

  let trainTile;
  if (prog) {
    const w = nextWorkout(prog), isDay = prog.days.includes(new Date().getDay());
    const doneToday = h.log.some((l) => l.prog === prog.id && dayDiff(new Date(l.t)) === 0);
    trainTile = `<button class="tile t-train" data-home="treninzi"><small>${prog.icon} ${esc(prog.name)}</small>
      <b class="t-title">${doneToday ? 'Današnji trening je urađen' : isDay ? esc(w.name) : 'Danas je odmor'}</b>
      <div class="t-row"><span>${doneToday ? 'Bravo! ✅' : isDay ? `~${workoutMinutes(w)} min` : `Sledeći: ${nextDayName(prog)}`}</span>${isDay && !doneToday ? `<span class="t-cta" data-home="start" data-p="${prog.id}" data-w="${prog.workouts.indexOf(w)}">▶ Počni</span>` : ''}</div></button>`;
  } else {
    trainTile = `<button class="tile t-train" data-home="treninzi"><small>🏋️ Trening</small><b class="t-title">Izaberi program</b><div class="t-row"><span>18 programa, kod kuće i u teretani</span><span class="t-cta">Pogledaj</span></div></button>`;
  }

  const envTiles = airTileHtml().replace('<button', '<button id="envAir"') + pollenTileHtml().replace('<button', '<button id="envPollen"');
  $('#view').innerHTML = notifBanner() + `<div class="bento">${parkTile}${remTile}${subvTileHtml().replace('<button', '<button id="subvTile"')}${shopTile}${whoTile}${envTiles}${mealTile}${trainTile}</div>`;
  refreshEnvHome(); refreshSubvHome();
  clearInterval(homeTimer);
  if (A) homeTimer = setInterval(() => { const el = $('#homePark'); if (!el || tab !== 'danas') return clearInterval(homeTimer); el.textContent = parkLeftTxt(A.end - Date.now()); }, 1000);
}

document.addEventListener('DOMContentLoaded', () => $('#view').addEventListener('click', (e) => {
  const b = e.target.closest('[data-home]'); if (!b || tab !== 'danas') return;
  e.stopPropagation(); haptic();
  const a = b.dataset.home;
  if (a === 'parking' || a === 'podsetnici' || a === 'kupovina') return setTab(a);
  if (a === 'new-rem') return editReminder();
  if (a === 'air') return loadEnv().then(airSheet).catch(() => toast('Podaci o vazduhu trenutno nisu dostupni'));
  if (a === 'subv') return subvSheet();
  if (a === 'pollen') return loadEnv().then(pollenSheet).catch(() => toast('Podaci o polenu trenutno nisu dostupni'));
  if (a === 'rem-edit') return editReminder(S.reminders.find((r) => r.id === b.dataset.id));
  if (a === 'rem-done') {
    const r = S.reminders.find((x) => x.id === b.dataset.id); if (!r) return;
    const row = b.closest('.rl-row'); if (row) row.classList.add('rl-done');
    completeReminder(r); save(); haptic(15);
    return setTimeout(renderHome, 260);
  }
  if (a === 'park-start') return setTab('parking');
  if (a === 'park-map') return openExternal(`https://www.google.com/maps/search/?api=1&query=${b.dataset.ll}`); // korisnik bira zonu i trajanje na ekranu Parking
  if (a === 'park-extend') { setTab('parking'); return extendParking(); }
  if (a === 'recipe') return openRecipe(b.dataset.id);
  if (a === 'treninzi') { hsub = 'treninzi'; return setTab('zdravlje'); }
  if (a === 'start') return startWorkout(b.dataset.p, +b.dataset.w);
}, true));
