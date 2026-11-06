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

function renderHome() {
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
  } else {
    const dz = detect.ns ? zoneById('ns-' + detect.ns.zone) : detect.spot ? zoneById(detect.spot.zone) : null;
    parkTile = `<button class="tile t-park idle" data-home="parking">
      <small>${ico('park')} Parking</small>
      <div class="t-big">${dz ? `Ovde je ${esc(dz.name)}` : 'Nema plaćenog parkinga'}</div>
      <div class="t-row"><span>${dz ? 'Nemaš plaćen parking u ovoj zoni' : P.auto ? 'Javiću ti kad parkiraš u zoni naplate' : 'Dodirni kad parkiraš u zoni naplate'}</span><span class="t-cta" data-home="park-start">Plati parking</span></div></button>`;
  }

  const remTile = late.length || next
    ? `<button class="tile t-rem ${late.length ? 'late' : ''}" data-home="podsetnici">
        <small>${ico('alarm')} ${late.length ? 'Kasni' : dayDiff(next.d) === 0 ? 'Sledeće danas' : 'Sledeće'}</small>
        <div><div class="t-time">${late.length ? hm(late[0].d) : dayDiff(next.d) === 0 ? hm(next.d) : esc(fmtWhen(next.d).split(' ')[0])}</div>
        <b class="t-title">${esc((late[0] || next).r.title)}</b>${!late.length && dayDiff(next.d) !== 0 ? `<small style="margin-top:4px">${esc(fmtWhen(next.d))}</small>` : ''}</div>
        <small class="t-foot">${late.length > 1 ? `+${late.length - 1} kasni` : todayCnt > 1 ? `+${todayCnt - 1} danas` : late.length && todayCnt ? `${todayCnt} danas` : ' '}</small></button>`
    : `<button class="tile t-rem empty" data-home="new-rem"><small>${ico('alarm')} Podsetnici</small><b class="t-title">Danas nema obaveza</b><small class="t-foot">+ Dodaj podsetnik</small></button>`;

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

  $('#view').innerHTML = notifBanner() + `<div class="bento">${parkTile}${remTile}${shopTile}${whoTile}${mealTile}${trainTile}</div>`;
  clearInterval(homeTimer);
  if (A) homeTimer = setInterval(() => { const el = $('#homePark'); if (!el || tab !== 'danas') return clearInterval(homeTimer); el.textContent = parkLeftTxt(A.end - Date.now()); }, 1000);
}

document.addEventListener('DOMContentLoaded', () => $('#view').addEventListener('click', (e) => {
  const b = e.target.closest('[data-home]'); if (!b || tab !== 'danas') return;
  e.stopPropagation(); haptic();
  const a = b.dataset.home;
  if (a === 'parking' || a === 'podsetnici' || a === 'kupovina') return setTab(a);
  if (a === 'new-rem') return editReminder();
  if (a === 'park-start') return setTab('parking'); // korisnik bira zonu i trajanje na ekranu Parking
  if (a === 'park-extend') { setTab('parking'); return extendParking(); }
  if (a === 'recipe') return openRecipe(b.dataset.id);
  if (a === 'treninzi') { hsub = 'treninzi'; return setTab('zdravlje'); }
  if (a === 'start') return startWorkout(b.dataset.p, +b.dataset.w);
}, true));
