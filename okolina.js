/* Vazduh (SEPA, satno) i polen (SEPA Polen API) za Novi Sad – GitHub Actions sprema okolina.json svakog sata. */
'use strict';
const ENV_URL = 'https://raw.githubusercontent.com/fianketo/Moj-asistent/okolina-data/okolina.json';
const ENV_TTL = 30 * 60e3;
let ENV = null, envLoading = null;
const ES = () => (S.env = Object.assign({ allergens: [], airAlert: 3, pollenAlert: true, notified: {} }, S.env || {}));

async function loadEnv(force = false) {
  if (ENV && !force && Date.now() - ENV.loadedAt < ENV_TTL) return ENV;
  if (envLoading) return envLoading;
  envLoading = (async () => {
    let cache = null; try { cache = await caches.open('asistent-okolina'); } catch { /* */ }
    let d = null;
    try {
      const r = await fetch(ENV_URL, { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      if (cache) await cache.put(ENV_URL, r.clone());
      d = await r.json();
    } catch (e) {
      if (cache) { const r = await cache.match(ENV_URL); if (r) d = await r.json().catch(() => null); }
      if (!d) throw e;
    }
    d.loadedAt = Date.now(); ENV = d; return d;
  })().finally(() => { envLoading = null; });
  return envLoading;
}

// Evropski indeks kvaliteta vazduha: boje i saveti (EEA)
const AQ = [
  { l: 'Dobar', c: 'aq0', tip: 'Odlični uslovi za aktivnosti napolju.' },
  { l: 'Prihvatljiv', c: 'aq1', tip: 'Uživaj u aktivnostima napolju.' },
  { l: 'Umeren', c: 'aq2', tip: 'Osetljive osobe (astma, srce, deca, stariji) neka smanje naporne aktivnosti napolju.' },
  { l: 'Loš', c: 'aq3', tip: 'Smanji naporne aktivnosti napolju, trening radi u zatvorenom. Osetljive osobe neka izbegavaju boravak napolju.' },
  { l: 'Veoma loš', c: 'aq4', tip: 'Izbegavaj naporne aktivnosti napolju. Osetljive osobe neka ostanu u zatvorenom.' },
  { l: 'Izuzetno loš', c: 'aq5', tip: 'Izbegavaj boravak napolju. Prozore drži zatvorene.' },
];
const PCODE = { 'PM10': 'PM10', 'PM2.5': 'PM2,5', NO2: 'NO₂', O3: 'O₃', SO2: 'SO₂' };
const PL = ['nizak', 'umeren', 'visok'];
const hAgo = (iso) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60e3); return m < 90 ? `pre ${Math.max(1, m)} min` : `pre ${Math.round(m / 60)} h`; };
const timeOf = (iso) => { const d = new Date(iso); return `${pad(d.getHours())}:00`; };

function airTileHtml() {
  const A = ENV && ENV.air;
  if (!A || A.level == null) return `<button class="tile t-air" data-home="air"><small>💨 Vazduh</small><b class="t-title">${ENV ? 'Nema svežih merenja' : 'Učitavam…'}</b></button>`;
  const worst = A.stations.filter((s) => s.level === A.level)[0] || A.stations[0], v = worst.values[worst.main] || {};
  return `<button class="tile t-air ${AQ[A.level].c}" data-home="air"><small>💨 Vazduh · ${timeOf(worst.time)}</small>
    <div class="t-big">${AQ[A.level].l}</div>
    <small class="t-foot">${esc(PCODE[worst.main] || worst.main || '')} ${v.avg24 != null && /PM/.test(worst.main) ? Math.round(v.avg24) : Math.round(v.now || 0)} µg/m³ · ${esc(worst.name.replace('Novi Sad ', ''))}</small></button>`;
}
function pollenTileHtml() {
  const P = ENV && ENV.pollen, mine = new Set(ES().allergens);
  if (!P) return `<button class="tile t-pollen" data-home="pollen"><small>🌼 Polen</small><b class="t-title">${ENV ? 'Nema podataka' : 'Učitavam…'}</b></button>`;
  if (!P.season) return `<button class="tile t-pollen off" data-home="pollen"><small>🌼 Polen</small><b class="t-title">Van sezone</b><small class="t-foot">poslednje merenje ${esc(P.date ? P.date.split('-').reverse().join('.') : '–')}</small></button>`;
  const items = P.items.filter((i) => i.value > 0);
  const top = items.filter((i) => mine.has(i.key)).sort((a, b) => b.level - a.level || b.value - a.value)[0] || items[0];
  if (!top) return `<button class="tile t-pollen pl0" data-home="pollen"><small>🌼 Polen</small><b class="t-title">Nizak</b><small class="t-foot">${esc(P.location)}</small></button>`;
  return `<button class="tile t-pollen pl${top.level}" data-home="pollen"><small>🌼 Polen${mine.has(top.key) ? ' · tvoj alergen' : ''}</small>
    <div class="t-big">${esc(top.name)}</div><small class="t-foot">${PL[top.level]} · ${top.value} zrna/m³${top.trend === 'raste' ? ' ↑' : top.trend === 'opada' ? ' ↓' : ''}</small></button>`;
}

function airSheet() {
  const A = ENV && ENV.air; if (!A) return;
  openSheet(`<div id="aqWrap"><h3>💨 Kvalitet vazduha – Novi Sad</h3>
    ${A.level != null ? `<div class="aq-hero ${AQ[A.level].c}"><b>${AQ[A.level].l}</b><span>${esc(AQ[A.level].tip)}</span></div>` : ''}
    ${A.stations.map((s) => `<div class="grp-h">📍 ${esc(s.name)} <span class="grow"></span><span>${s.time ? hAgo(s.time) : ''}</span></div>
      <div class="grp">${['PM10', 'PM2.5', 'NO2', 'O3', 'SO2'].filter((k) => s.values[k]).map((k) => { const v = s.values[k], lv = v.level;
        return `<div class="item-row"><span class="nm">${PCODE[k]}<small class="meta" style="display:block">${/PM/.test(k) ? `24 h prosek ${v.avg24 != null ? Math.round(v.avg24) : '–'} · sada ${Math.round(v.now)}` : `sada ${Math.round(v.now)}`} µg/m³</small></span>
          ${lv != null ? `<span class="aq-chip ${AQ[lv].c}">${AQ[lv].l}</span>` : ''}</div>`; }).join('')}</div>`).join('')}
    <div class="safe" style="margin-top:12px"><div class="nut-h">🔔 Upozorenje</div>
      <p style="margin:6px 0">Javi mi kad vazduh postane:</p>
      <div class="chips" style="flex-wrap:wrap">${[[2, 'Umeren'], [3, 'Loš'], [4, 'Veoma loš'], [99, 'Ne javljaj']].map(([v, l]) => `<button class="chip ${ES().airAlert === v ? 'on' : ''}" data-aq="${v}">${l}</button>`).join('')}</div></div>
    <p class="nut-src">${esc(A.src)}. Čestice (PM) se ocenjuju po proseku poslednja 24 h, gasovi po poslednjem satu. Podaci su preliminarni (neverifikovani).</p>
    <div class="foot"><button class="btn" data-aq="close">Zatvori</button></div></div>`, () => {
    $('#aqWrap').addEventListener('click', (e) => {
      const b = e.target.closest('[data-aq]'); if (!b) return;
      if (b.dataset.aq === 'close') { closeSheet(); return render(); }
      ES().airAlert = +b.dataset.aq; save(false); envConfigureNative(); airSheet();
    });
  });
}
function pollenSheet() {
  const P = ENV && ENV.pollen; if (!P) return;
  const mine = new Set(ES().allergens);
  const byKey = Object.fromEntries(P.items.map((i) => [i.key, i]));
  const groups = {}; for (const a of P.allergens) (groups[a.type] = groups[a.type] || []).push(a);
  openSheet(`<div id="plWrap"><h3>🌼 Polen</h3>
    <p class="meta" style="margin:0 2px 8px">Merna stanica: <b>${esc(P.location)}</b> (najbliža Novom Sadu) · merenje ${esc(P.date ? P.date.split('-').reverse().join('.') : '–')}${P.season ? '' : ' · van sezone'}</p>
    <div class="grp">${P.items.filter((i) => i.value > 0).slice(0, 12).map((i) => `<div class="item-row"><span class="nm">${esc(i.name)}${mine.has(i.key) ? ' ⭐' : ''}<small class="meta" style="display:block">${esc(i.type)} · ${i.value} zrna/m³ (visoko od ${i.hi})${i.trend && i.trend !== 'stabilno' ? ' · ' + i.trend : ''}</small></span><span class="aq-chip pl${i.level}">${PL[i.level]}</span></div>`).join('') || '<div class="item-row"><span class="nm">Trenutno nema polena u vazduhu</span></div>'}</div>
    <div class="grp-h">⭐ Na šta si alergičan?</div>
    <p class="meta" style="margin:0 2px 6px">Izabrani alergeni se prikazuju na početnom ekranu i za njih stiže upozorenje kad koncentracija postane visoka.</p>
    ${Object.entries(groups).map(([t, list]) => `<div class="fx-row"><small>${esc(t)}</small><div class="chips" style="flex-wrap:wrap">${list.map((a) => `<button class="chip ${mine.has(a.key) ? 'on' : ''}" data-pa="${esc(a.key)}">${esc(a.name)}${byKey[a.key] && byKey[a.key].level ? ' •' : ''}</button>`).join('')}</div></div>`).join('')}
    <p class="nut-src">${esc(P.src)}. Pragovi „umereno“ i „visoko“ su pragovi Agencije za svaku biljnu vrstu.</p>
    <div class="foot"><button class="btn" data-pa="close">Zatvori</button></div></div>`, () => {
    $('#plWrap').addEventListener('click', (e) => {
      const b = e.target.closest('[data-pa]'); if (!b) return;
      if (b.dataset.pa === 'close') { closeSheet(); return render(); }
      const k = b.dataset.pa, s = new Set(ES().allergens); s.has(k) ? s.delete(k) : s.add(k);
      ES().allergens = [...s]; save(false); envConfigureNative(); haptic(); pollenSheet();
    });
  });
}

// upozorenja: na Androidu ih šalje pozadinski posao (i kad je aplikacija zatvorena), na webu provera dok je otvorena
function envConfigureNative() {
  if (typeof Geo === 'undefined' || !Geo) return; // isti native dodatak kao parking
  const e = ES();
  Geo.envConfigure({ url: ENV_URL, airAlert: e.airAlert, allergens: e.allergens.join(','), pollenAlert: !!e.pollenAlert }).catch(() => {});
}
function envCheckWeb() {
  if (IS_NATIVE || !ENV) return;
  const e = ES(), now = Date.now(), A = ENV.air, P = ENV.pollen;
  if (A && A.level != null && A.level >= e.airAlert && now - (e.notified.air || 0) > 6 * 3600e3) {
    e.notified.air = now; save(false);
    showWebNotification({ key: 'env-air', title: `💨 Vazduh u Novom Sadu: ${AQ[A.level].l}`, body: AQ[A.level].tip, tab: 'danas' });
  }
  if (P && P.season && e.allergens.length) {
    const hi = P.items.filter((i) => e.allergens.includes(i.key) && i.level === 2);
    const key = 'pollen:' + P.date;
    if (hi.length && !e.notified[key]) {
      e.notified[key] = now; save(false);
      showWebNotification({ key: 'env-pollen', title: `🌼 Visok polen: ${hi.map((i) => i.name).join(', ')}`, body: 'Zatvori prozore, posle boravka napolju operi lice i promeni odeću.', tab: 'danas' });
    }
  }
}
function refreshEnvHome() {
  loadEnv().then(() => { envCheckWeb(); if (tab === 'danas' && $('#sheetBg').hidden) { const a = $('#envAir'), p = $('#envPollen'); if (a) a.outerHTML = airTileHtml().replace('<button', '<button id="envAir"'); if (p) p.outerHTML = pollenTileHtml().replace('<button', '<button id="envPollen"'); } }).catch(() => {});
}
document.addEventListener('DOMContentLoaded', () => { envConfigureNative(); setInterval(() => tab === 'danas' && refreshEnvHome(), 15 * 60e3); });
