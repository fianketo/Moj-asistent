/* Moj Asistent – podsetnici, liste za kupovinu i parking.
 * Radi kao web aplikacija (PWA) i kao Android aplikacija (Capacitor).
 * Na Androidu obaveštenja zakazuje sam sistem, pa stižu i kad je aplikacija ugašena.
 * U pregledaču obaveštenja stižu dok je aplikacija otvorena / u pozadini. */
'use strict';

// ---------------------------------------------------------------- platforma
const Cap = window.Capacitor;
const IS_NATIVE = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
const LN = IS_NATIVE ? Cap.registerPlugin('LocalNotifications') : null;
const Battery = IS_NATIVE ? Cap.registerPlugin('Battery') : null;
const Geo = IS_NATIVE ? Cap.registerPlugin('ParkingGeofence') : null;
const AppP = IS_NATIVE ? Cap.registerPlugin('App') : null;
const BUILD = '__BUILD__'; // CI upisuje broj verzije
const APK_URL = 'https://github.com/fianketo/Moj-asistent/releases/latest/download/moj-asistent.apk';
const WEB_URL = 'https://fianketo.github.io/Moj-asistent/';

// ---------------------------------------------------------------- pomoćne
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = (n) => String(n).padStart(2, '0');
const DAYS = ['ned', 'pon', 'uto', 'sre', 'čet', 'pet', 'sub'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'];
const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;

const toLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const parseLocal = (s) => (s ? new Date(s) : null);
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayDiff = (d) => Math.round((startOfDay(d) - startOfDay(new Date())) / DAY);

function fmtWhen(d) {
  const diff = dayDiff(d);
  if (diff === 0) return `danas ${hm(d)}`;
  if (diff === 1) return `sutra ${hm(d)}`;
  if (diff === -1) return `juče ${hm(d)}`;
  const y = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}.` : '';
  return `${DAYS[d.getDay()]} ${d.getDate()}. ${MONTHS[d.getMonth()]}${y} ${hm(d)}`;
}
function fmtDur(ms) {
  const m = Math.max(0, Math.round(ms / MIN));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}
function hashId(str) { // stabilan pozitivan int32 za ID obaveštenja
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return (Math.abs(h) % 2000000000) + 1;
}

// ---------------------------------------------------------------- podaci
const KEY = 'asistent.v1';
const GARAZA = { id: 'garaza', name: 'Garaža / ostalo', color: '#64748b', sms: '', maxMin: 0 };
// SMS brojevi i ograničenja – proveri na tabli zone, gradovi ih menjaju.
const CITIES = {
  beograd: { name: 'Beograd', hours: { wd: [7, 21], sat: [7, 21] }, zones: [
    { id: 'bg-crvena', name: 'Crvena zona', color: '#dc2626', sms: '9111', maxMin: 60 },
    { id: 'bg-zuta', name: 'Žuta zona', color: '#eab308', sms: '9112', maxMin: 120 },
    { id: 'bg-zelena', name: 'Zelena zona', color: '#16a34a', sms: '9113', maxMin: 180 },
    { id: 'bg-plava', name: 'Plava zona', color: '#2563eb', sms: '9114', maxMin: 120 }, GARAZA] },
  // Cene i vreme naplate: parkingns.rs (2026). Zone po ulicama: www/zones-ns.json (katastar 26.06.2026).
  novisad: { name: 'Novi Sad', hours: { wd: [7, 21], sat: [7, 14] }, zones: [
    { id: 'ns-ekstra', name: 'Ekstra zona', color: '#a16207', sms: '8210', maxMin: 60, price: 100 },
    { id: 'ns-crvena', name: 'Crvena zona', color: '#dc2626', sms: '8211', maxMin: 120, price: 60 },
    { id: 'ns-plava', name: 'Plava zona', color: '#2563eb', sms: '8212', maxMin: 0, price: 50 },
    { id: 'ns-bela', name: 'Bela zona', color: '#94a3b8', sms: '8218', maxMin: 0, price: 30 }, GARAZA] },
};
const cityZones = (c) => CITIES[c].zones.map((z) => ({ ...z }));
const DEFAULT_ZONES = CITIES.beograd.zones;

function defaults() {
  return {
    reminders: [],
    lists: [{ id: uid(), name: 'Prodavnica', items: [] }],
    activeList: null,
    history: [],
    parking: { plate: '', warnMin: 10, zones: DEFAULT_ZONES.map((z) => ({ ...z })), lastZone: 'bg-zelena', lastDur: 60, active: null,
      city: 'beograd', hours: { ...CITIES.beograd.hours }, spots: [], auto: false },
    fired: {},
  };
}
let S;
try { S = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { S = defaults(); }
if (!S.lists.length) S.lists = defaults().lists;
S.parking = Object.assign({ city: 'beograd', hours: { ...CITIES.beograd.hours }, spots: [], auto: false }, S.parking);
for (const z of S.parking.zones) { const pz = Object.values(CITIES).flatMap((c) => c.zones).find((x) => x.id === z.id); if (pz && pz.price && !z.price) z.price = pz.price; }
for (const l of S.lists) for (const i of l.items) if (typeof i.qty === 'string') { // stara verzija: količina kao tekst
  const m = i.qty.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|kom|pak)?/i);
  i.qty = m ? parseFloat(m[1].replace(',', '.')) : null; i.unit = m && m[2] ? m[2].toLowerCase() : 'kom';
}
if (!S.activeList || !S.lists.find((l) => l.id === S.activeList)) S.activeList = S.lists[0].id;

function save(resync = true) {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Greška pri čuvanju: ' + e.message); }
  if (resync) scheduleSync();
}

// ---------------------------------------------------------------- UI osnova
let tab = 'podsetnici';
const TITLES = { podsetnici: 'Podsetnici', kupovina: 'Kupovina', parking: 'Parking', podesavanja: 'Podešavanja' };

function toast(msg, ms = 2600, action) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button class="toast-act">${esc(action.label)}</button>` : ''}`;
  t.hidden = false;
  if (action) t.querySelector('.toast-act').onclick = () => { t.hidden = true; action.fn(); };
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), action ? Math.max(ms, 4000) : ms);
}
function openSheet(html, onMount) {
  $('#toast').hidden = true;
  const sh = $('#sheet');
  sh.innerHTML = html;
  $('#sheetBg').hidden = false;
  onMount && onMount(sh);
}
function closeSheet() { $('#sheetBg').hidden = true; $('#sheet').innerHTML = ''; }
$('#sheetBg').addEventListener('click', (e) => { if (e.target.id === 'sheetBg') closeSheet(); });

function openExternal(url) {
  if (IS_NATIVE || !/^https?:/.test(url)) location.href = url; // Android otvara SMS/mape/pregledač
  else window.open(url, '_blank', 'noopener');
}
function smsUrl(number, body) {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return `sms:${number}${ios ? '&' : '?'}body=${encodeURIComponent(body)}`;
}

function setTab(t) {
  tab = t;
  $$('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
  $('#title').textContent = TITLES[t];
  $('#fab').hidden = !(t === 'podsetnici');
  document.body.dataset.tab = t;
  render();
  window.scrollTo(0, 0);
}
$('#nav').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setTab(b.dataset.tab); });
$('#fab').addEventListener('click', () => { if (tab === 'podsetnici') editReminder(); });

function render() {
  const d = new Date();
  $('#today').textContent = `${DAYS[d.getDay()]} ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
  ({ podsetnici: renderReminders, kupovina: renderShopping, parking: renderParking, podesavanja: renderSettings })[tab]();
}

// ================================================================ PODSETNICI
const REPEAT = { '': 'Ne ponavlja se', daily: 'Svaki dan', weekdays: 'Radnim danima', weekly: 'Svake nedelje', monthly: 'Svakog meseca', yearly: 'Svake godine' };
const BEFORE = { 0: 'U tom trenutku', 5: '5 min ranije', 15: '15 min ranije', 30: '30 min ranije', 60: '1 sat ranije', 120: '2 sata ranije', 1440: '1 dan ranije' };

function addRepeat(d, rep) {
  const n = new Date(d);
  if (rep === 'daily') n.setDate(n.getDate() + 1);
  else if (rep === 'weekdays') { do n.setDate(n.getDate() + 1); while (n.getDay() === 0 || n.getDay() === 6); }
  else if (rep === 'weekly') n.setDate(n.getDate() + 7);
  else if (rep === 'monthly') {
    const day = d.getDate();
    n.setDate(1); n.setMonth(n.getMonth() + 1);
    n.setDate(Math.min(day, new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate()));
  } else if (rep === 'yearly') n.setFullYear(n.getFullYear() + 1);
  else return null;
  return n;
}

function renderReminders() {
  const now = Date.now();
  const groups = { late: [], today: [], tomorrow: [], later: [], nodate: [], done: [] };
  for (const r of S.reminders) {
    if (r.done) { groups.done.push(r); continue; }
    const d = parseLocal(r.at);
    if (!d) groups.nodate.push(r);
    else if (d.getTime() < now) groups.late.push(r);
    else if (dayDiff(d) === 0) groups.today.push(r);
    else if (dayDiff(d) === 1) groups.tomorrow.push(r);
    else groups.later.push(r);
  }
  const byDate = (a, b) => (a.at || '').localeCompare(b.at || '');
  Object.values(groups).forEach((g) => g.sort(byDate));
  groups.done.reverse();

  let html = notifBanner();
  const sec = (key, label, cls = '') => groups[key].length
    ? `<h2 class="${cls}">${label}</h2>` + groups[key].map((r) => reminderCard(r, key === 'late')).join('') : '';
  html += sec('late', 'Kasni', 'red') + sec('today', 'Danas') + sec('tomorrow', 'Sutra') + sec('later', 'Kasnije') + sec('nodate', 'Bez datuma');
  if (groups.done.length) {
    html += `<h2>Završeno (${groups.done.length})</h2>` + groups.done.slice(0, 15).map((r) => reminderCard(r)).join('');
    html += `<button class="btn small" data-act="clear-done">Obriši završene</button>`;
  }
  if (!S.reminders.length) {
    html += `<div class="empty"><div class="big">⏰</div>Nemaš podsetnika.<br>Dodaj prvi na dugme <b>+</b> dole desno.</div>`;
  }
  $('#view').innerHTML = html;
}

function reminderCard(r, late) {
  const d = parseLocal(r.at);
  const meta = [];
  if (d) meta.push(late && !r.done ? `<span class="lateTxt">${fmtWhen(d)}</span>` : fmtWhen(d));
  if (r.repeat) meta.push('🔁 ' + REPEAT[r.repeat]);
  if (d && r.before) meta.push('🔔 ' + BEFORE[r.before]);
  return `<div class="card ${late && !r.done ? 'late' : ''} ${r.done ? 'done' : ''}" data-id="${r.id}">
    <button class="check ${r.done ? 'on' : ''}" data-act="toggle" aria-label="Završeno">${r.done ? '✓' : ''}</button>
    <div class="body" data-act="edit">
      <div class="title">${esc(r.title)}</div>
      ${meta.length ? `<div class="meta">${meta.map((m) => `<span>${m}</span>`).join('')}</div>` : ''}
      ${r.note ? `<div class="note">${esc(r.note)}</div>` : ''}
    </div></div>`;
}

function completeReminder(r) {
  if (r.done) { r.done = false; return; }
  const d = parseLocal(r.at);
  if (r.repeat && d) {
    let n = addRepeat(d, r.repeat);
    while (n && n.getTime() < Date.now()) n = addRepeat(n, r.repeat);
    r.at = toLocal(n);
    toast('Sledeći put: ' + fmtWhen(n));
  } else {
    r.done = true; r.doneAt = Date.now();
  }
}

function editReminder(r) {
  const isNew = !r;
  r = r || { id: uid(), title: '', at: '', repeat: '', before: 0, note: '' };
  const d = parseLocal(r.at);
  const opt = (obj, cur) => Object.entries(obj).map(([v, l]) => `<option value="${v}" ${String(cur) === v ? 'selected' : ''}>${l}</option>`).join('');
  openSheet(`
    <h3>${isNew ? 'Novi podsetnik' : 'Izmeni podsetnik'}</h3>
    <label class="field">Šta treba da uradiš?
      <input class="input" id="rTitle" value="${esc(r.title)}" placeholder="npr. Platiti račun za struju" autocomplete="off"></label>
    <div class="chips" style="margin-top:10px">
      <button class="chip" data-q="1h">Za 1 sat</button>
      <button class="chip" data-q="eve">Večeras 20h</button>
      <button class="chip" data-q="tom">Sutra 9h</button>
      <button class="chip" data-q="week">Za nedelju dana</button>
      <button class="chip" data-q="none">Bez datuma</button>
    </div>
    <div class="two">
      <label class="field" style="margin:0">Datum<input class="input" type="date" id="rDate" value="${d ? r.at.slice(0, 10) : ''}"></label>
      <label class="field" style="margin:0">Vreme<input class="input" type="time" id="rTime" value="${d ? r.at.slice(11, 16) : ''}"></label>
    </div>
    <div class="two">
      <label class="field">Podseti me<select class="input" id="rBefore">${opt(BEFORE, r.before || 0)}</select></label>
      <label class="field">Ponavljanje<select class="input" id="rRepeat">${opt(REPEAT, r.repeat || '')}</select></label>
    </div>
    <label class="field">Napomena<textarea class="input" id="rNote" placeholder="(nije obavezno)">${esc(r.note)}</textarea></label>
    <div class="foot">
      ${isNew ? '' : '<button class="btn danger" id="rDel">Obriši</button>'}
      <button class="btn" id="rCancel">Otkaži</button>
      <button class="btn primary" id="rSave">Sačuvaj</button>
    </div>`, (sh) => {
    if (isNew) setTimeout(() => $('#rTitle').focus(), 50);
    $('.chips', sh).addEventListener('click', (e) => {
      const q = e.target.closest('[data-q]')?.dataset.q; if (!q) return;
      const n = new Date(); n.setSeconds(0, 0);
      if (q === '1h') n.setTime(n.getTime() + HOUR);
      if (q === 'eve') { n.setHours(20, 0); if (n < new Date()) n.setDate(n.getDate() + 1); }
      if (q === 'tom') { n.setDate(n.getDate() + 1); n.setHours(9, 0); }
      if (q === 'week') { n.setDate(n.getDate() + 7); n.setHours(9, 0); }
      const v = q === 'none' ? '' : toLocal(n);
      $('#rDate').value = v.slice(0, 10); $('#rTime').value = v.slice(11, 16);
    });
    $('#rCancel').onclick = closeSheet;
    if (!isNew) $('#rDel').onclick = () => {
      if (!confirm('Obrisati podsetnik?')) return;
      S.reminders = S.reminders.filter((x) => x.id !== r.id); save(); closeSheet(); render();
    };
    $('#rSave').onclick = () => {
      const title = $('#rTitle').value.trim();
      if (!title) { $('#rTitle').focus(); return toast('Upiši naziv podsetnika'); }
      let date = $('#rDate').value, time = $('#rTime').value;
      if (!date && time) { // samo vreme → danas (ili sutra ako je prošlo)
        const n = new Date(); const [h, m] = time.split(':');
        n.setHours(+h, +m, 0, 0); if (n < new Date()) n.setDate(n.getDate() + 1);
        date = toLocal(n).slice(0, 10);
      }
      if (date && !time) time = '09:00';
      Object.assign(r, {
        title, at: date ? `${date}T${time}` : '', before: +$('#rBefore').value,
        repeat: $('#rRepeat').value, note: $('#rNote').value.trim(), done: false,
      });
      if (r.repeat && !r.at) return toast('Za ponavljanje izaberi datum');
      if (isNew) S.reminders.push(r);
      save(); closeSheet(); render();
      if (r.at) ensurePermission();
      toast(r.at ? 'Podsetnik: ' + fmtWhen(parseLocal(r.at)) : 'Sačuvano');
    };
  });
}

// ================================================================ KUPOVINA
// Artikli dolaze iz catalog.js (CATALOG, CATALOG_INDEX, UNITS) + istorija + online pretraga (Open Food Facts).
const curList = () => S.lists.find((l) => l.id === S.activeList) || S.lists[0];
const STEP = { kg: 0.5, g: 100, ml: 250 };
const stepOf = (u) => STEP[u] || 1;
const defaultQty = (u) => ({ g: 200, ml: 500 }[u] || 1);
const fmtNum = (n) => String(Math.round(n * 1000) / 1000).replace('.', ',');
const fmtQty = (i) => (i.qty ? `${fmtNum(i.qty)} ${i.unit || 'kom'}` : '');
const catOf = (name) => {
  const n = name.toLowerCase().trim();
  if (CATALOG_INDEX.has(n)) return CATALOG_INDEX.get(n);
  for (const [k, v] of CATALOG_INDEX) if (k.startsWith(n + ' (')) return v; // „kafa“ → „Kafa (mlevena)“
  return undefined;
};
const unitRe = '(kg|g|l|ml|kom|pak)';

function parseItem(text) { // "2 mleko", "mleko x2", "mleko 1,5 kg", "500g sira"
  let t = text.trim(), qty = null, unit = null, m;
  if ((m = t.match(new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(?:${unitRe}\\b|x)?\\s+(.+)$`, 'i')))) { qty = m[1]; unit = m[2]; t = m[3]; }
  else if ((m = t.match(new RegExp(`^(.+?)\\s+[x×]?\\s*(\\d+(?:[.,]\\d+)?)\\s*${unitRe}?$`, 'i')))) { t = m[1]; qty = m[2]; unit = m[3]; }
  const name = t.charAt(0).toUpperCase() + t.slice(1);
  return { name, qty: qty ? parseFloat(qty.replace(',', '.')) : null, unit: unit ? unit.toLowerCase() : null };
}

let lastAdd = null;
function addToList(name, qty, unit, silent) {
  const L = curList(), c = catOf(name);
  unit = unit || (c && c.unit) || 'kom';
  qty = qty || defaultQty(unit);
  const ex = L.items.find((i) => !i.done && i.name.toLowerCase() === name.toLowerCase() && (i.unit || 'kom') === unit);
  if (ex) { ex.qty = (ex.qty || 0) + qty; if (!silent) toast(`${ex.name}: ${fmtQty(ex)}`); }
  else L.items.unshift({ id: uid(), name, qty, unit, cat: c ? c.cat : '', done: false });
  lastAdd = { item: ex || L.items[0], qty, wasNew: !ex };
  S.history = [name, ...S.history.filter((h) => h.toLowerCase() !== name.toLowerCase())].slice(0, 200);
  save(false);
  return ex || L.items[0];
}

let showBought = false;
// Pretraga bez obzira na kvačice: „cokolada“ = „čokolada“, „dj“ = „đ“
const fold = (t) => t.toLowerCase().replace(/[čć]/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z').replace(/đ/g, 'dj');
let searchIdx = null;
function searchItems(q) {
  const f = fold(q.trim()); if (!f) return [];
  if (!searchIdx) searchIdx = [...CATALOG_INDEX.values()].map((x) => ({ n: x.name, f: fold(x.name) }));
  const hist = S.history.map((n) => ({ n, f: fold(n), h: 1 }));
  const seen = new Set(), out = [];
  for (const it of [...hist, ...searchIdx]) {
    const key = it.n.toLowerCase(); if (seen.has(key)) continue;
    const words = it.f.split(/[\s()]+/);
    const sc = it.f === f ? 0 : words.includes(f) ? 1 : it.f.startsWith(f) ? 2 : words.some((w) => w.startsWith(f)) ? 3 : it.f.includes(f) ? 4 : -1;
    if (sc < 0) continue;
    seen.add(key); out.push({ n: it.n, sc: sc - (it.h ? 0.5 : 0) });
  }
  return out.sort((a, b) => a.sc - b.sc || a.n.length - b.n.length).map((x) => x.n);
}
function hilite(name, q) {
  const t = q.trim(), i = fold(name).indexOf(fold(t));
  if (i < 0 || !t) return esc(name);
  // fold može da promeni dužinu (đ→dj), pa za isticanje koristi dužinu iz originala približno
  const L = t.length;
  return esc(name.slice(0, i)) + '<b>' + esc(name.slice(i, i + L)) + '</b>' + esc(name.slice(i + L));
}
const POPULAR = ['Hleb', 'Mleko', 'Jaja', 'Jogurt', 'Banane', 'Jabuke', 'Krompir', 'Paradajz', 'Beli sir', 'Kafa (mlevena)', 'Voda (negazirana)', 'Toalet papir'];
const catIcon = (cat) => (CATALOG.find((g) => g.cat === cat) || {}).icon || '🛍️';

function renderShopping() {
  const L = curList();
  const open = L.items.filter((i) => !i.done), bought = L.items.filter((i) => i.done);
  const total = L.items.length, pct = total ? Math.round((bought.length / total) * 100) : 0;
  let html = `<div class="shop-head">
      <button class="list-switch" data-act="list-switch"><span>${esc(L.name)}</span><span class="caret">▾</span></button>
      <div class="grow"></div>
      ${total ? '<button class="iconbtn" data-act="share" title="Pošalji listu">📤</button>' : ''}
      <button class="iconbtn" data-act="list-menu" title="Još">⋯</button>
    </div>
    ${total ? `<div class="progress-row"><span>${open.length ? `Ostalo <b>${open.length}</b> · u korpi ${bought.length} od ${total}` : '🎉 Sve je u korpi!'}</span></div>
    <div class="progress"><div style="width:${pct}%"></div></div>` : ''}`;

  if (!total) {
    html += `<div class="empty shop-empty"><div class="big">🛒</div><b>Lista je prazna</b><br>Upiši šta treba da kupiš dole, ili izaberi:
      <div class="pop">${POPULAR.map((n) => `<button class="sugg" data-add="${esc(n)}">${catIcon((catOf(n) || {}).cat)} ${esc(n)}</button>`).join('')}</div>
      <button class="btn" data-act="catalog">📋 Ceo katalog artikala</button>
      <button class="btn" data-act="paste-import" style="margin-left:6px">📥 Primi listu</button></div>`;
  }
  // grupisano po odeljenjima, redosledom kao u prodavnici
  const order = CATALOG.map((g) => g.cat);
  const groups = new Map();
  for (const i of open) { const k = i.cat || 'Ostalo'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); }
  const keys = [...groups.keys()].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
  for (const k of keys) {
    html += `<div class="grp-h">${catIcon(k)} ${esc(k)} <span>${groups.get(k).length}</span></div><div class="grp">${groups.get(k).map(itemRow).join('')}</div>`;
  }
  if (bought.length) {
    html += `<div class="grp-h bought-h" data-act="toggle-bought">✓ U korpi <span>${bought.length}</span><span class="grow"></span>
        <span class="link">${showBought ? 'Sakrij' : 'Prikaži'}</span></div>
      ${showBought ? `<div class="grp">${bought.map(itemRow).join('')}</div>
        <button class="btn small" data-act="clear-bought" style="margin-top:8px">🧹 Ukloni kupljeno sa liste</button>` : ''}`;
  }
  html += `<div class="shopbar" id="shopbar">
      <div class="search-res" id="searchRes"></div>
      <div class="sugg-row" id="suggRow"></div>
      <form class="addrow" id="addForm" autocomplete="off">
        <input class="input" id="itemIn" placeholder="🔎 Traži ili dodaj (npr. 2 mleko)" enterkeyhint="done" autocomplete="off" autocorrect="off" spellcheck="false">
        <button type="button" class="iconbtn clr-btn" id="itemClr" title="Obriši" hidden>✕</button>
        <button type="button" class="iconbtn cat-btn" data-act="catalog" title="Katalog">📋</button>
      </form>
    </div>`;
  $('#view').innerHTML = html;

  const itemIn = $('#itemIn');
  const drawSugg = () => {
    const raw = itemIn.value.trim();
    const inList = new Map(curList().items.filter((i) => !i.done).map((i) => [i.name.toLowerCase(), i]));
    if (!raw) {
      $('#searchRes').innerHTML = '';
      const names = [...new Set([...S.history, ...POPULAR])].filter((n) => !inList.has(n.toLowerCase())).slice(0, 12);
      $('#suggRow').innerHTML = curList().items.length ? names.map((n) => `<button type="button" class="sugg" data-add="${esc(n)}">${esc(n)}</button>`).join('') : '';
      return;
    }
    $('#suggRow').innerHTML = '';
    const p = parseItem(raw);
    const res = searchItems(p.name).slice(0, 6);
    const exact = res.some((r) => fold(r) === fold(p.name));
    const rows = (exact ? res : [p.name, ...res.slice(0, 5)]).map((n) => {
      const c = catOf(n), have = inList.get(n.toLowerCase());
      const q = p.qty ? `${fmtNum(p.qty)} ${p.unit || (c ? c.unit : 'kom')}` : '';
      return `<button type="button" class="res" data-add="${esc(n)}" data-q="${p.qty || ''}" data-u="${esc(p.unit || '')}">
        <span class="res-ic">${catIcon(c ? c.cat : '')}</span><span class="res-nm">${hilite(n, p.name)}</span>
        ${have ? `<span class="res-have">na listi ${esc(fmtQty(have))}</span>` : ''}${q ? `<span class="res-q">${esc(q)}</span>` : ''}<span class="res-add">＋</span></button>`;
    }).join('');
    $('#searchRes').innerHTML = rows;
  };
  itemIn.addEventListener('input', () => { $('#itemClr').hidden = !itemIn.value; $('#toast').hidden = true; drawSugg(); });
  // predlozi samo dok se kuca – lista ima više mesta
  itemIn.addEventListener('focus', () => $('#shopbar').classList.add('focus'));
  itemIn.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== itemIn && $('#shopbar')) $('#shopbar').classList.remove('focus'); }, 250));
  $('#itemClr').onclick = () => { itemIn.value = ''; $('#itemClr').hidden = true; drawSugg(); itemIn.focus(); };
  drawSugg();
  $('#addForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = itemIn.value.trim(); if (!v) return;
    const it = parseItem(v);
    const best = searchItems(it.name)[0];
    if (best && fold(best) === fold(it.name)) it.name = best; // „cokolada“ → „Čokolada“
    const cu = catOf(it.name);
    const added = addToList(it.name, it.qty, it.unit || (cu ? cu.unit : null), true);
    afterAdd(added);
  });
}

function afterAdd(item) {
  render();
  const inp = $('#itemIn'); if (inp) inp.focus();
  const row = $(`[data-item="${item.id}"]`);
  if (row) { row.classList.add('flash'); row.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  const la = lastAdd, L = curList();
  toast(la && !la.wasNew ? `${item.name}: sada ${fmtQty(item)}` : `Dodato: ${item.name} · ${fmtQty(item)}`, 2600, { label: 'Poništi', fn: () => {
    if (la && !la.wasNew) item.qty = Math.max(0, (item.qty || 0) - la.qty) || null;
    else L.items = L.items.filter((x) => x !== item);
    save(false); render();
  } });
}

function itemRow(i) {
  const q = fmtQty(i);
  return `<div class="item-row ${i.done ? 'done' : ''}" data-item="${i.id}" data-act="item-toggle">
    <span class="tick">${i.done ? '✓' : ''}</span>
    <span class="nm">${esc(i.name)}</span>
    ${q ? `<button class="qty-pill" data-act="item-edit">${esc(q)}</button>` : `<button class="qty-pill empty" data-act="item-edit">＋</button>`}
  </div>`;
}

function editItem(item) {
  const draw = () => `<div id="qWrap"><div class="q-title"><input class="input q-name" id="eName" value="${esc(item.name)}"></div>
    <div class="q-step">
      <button class="q-btn" data-q="-1" aria-label="Manje">−</button>
      <div class="q-val"><input id="eQty" inputmode="decimal" value="${item.qty ? fmtNum(item.qty) : ''}" placeholder="–"><span>${esc(item.unit || 'kom')}</span></div>
      <button class="q-btn" data-q="1" aria-label="Više">+</button>
    </div>
    <div class="q-units">${UNITS.map((u) => `<button class="chip ${u === (item.unit || 'kom') ? 'on' : ''}" data-u="${u}">${u}</button>`).join('')}</div>
    <div class="row" style="margin-top:14px">
      <button class="btn grow" id="ePrice">💰 Cene (Cenoteka)</button>
      <button class="btn danger grow" id="eDel">🗑 Obriši</button>
    </div>
    <div class="foot"><button class="btn primary" id="eSave">Gotovo</button></div></div>`;
  const commit = () => {
    item.name = $('#eName').value.trim() || item.name;
    const v = parseFloat($('#eQty').value.replace(',', '.'));
    item.qty = v > 0 ? v : null;
    const c = catOf(item.name); if (c) item.cat = c.cat;
    save(false);
  };
  const mount = () => {
    $('#qWrap').addEventListener('click', (e) => {
      const b = e.target.closest('[data-q],[data-u]'); if (!b) return;
      commit();
      if (b.dataset.q) { const s = stepOf(item.unit); item.qty = Math.max(s, (item.qty || 0) + +b.dataset.q * s); }
      if (b.dataset.u) { item.unit = b.dataset.u; item.qty = defaultQty(item.unit); }
      save(false); $('#sheet').innerHTML = draw(); mount(); render();
    });
    $('#ePrice').onclick = () => openExternal(cenotekaUrl(item.name));
    $('#eDel').onclick = () => { closeSheet(); deleteItem(item); };
    $('#eSave').onclick = () => { commit(); closeSheet(); render(); };
  };
  openSheet(draw(), mount);
}

function deleteItem(item) {
  const L = curList(), idx = L.items.indexOf(item);
  L.items = L.items.filter((x) => x !== item); save(false); render();
  toast(`Obrisano: ${item.name}`, 4000, { label: 'Poništi', fn: () => { L.items.splice(idx, 0, item); save(false); render(); } });
}

function listSwitcher() {
  openSheet(`<h3>Moje liste</h3>
    <div class="lists">${S.lists.map((l) => { const o = l.items.filter((i) => !i.done).length; return `<button class="list-pick ${l.id === S.activeList ? 'on' : ''}" data-pick="${l.id}">
      <span class="grow">${esc(l.name)}</span><span class="cnt">${o ? o + ' za kupovinu' : 'prazna'}</span></button>`; }).join('')}</div>
    <div class="row" style="margin-top:12px"><button class="btn grow" id="lsNew">＋ Nova lista</button><button class="btn grow" id="lsRecv">📥 Primi listu</button></div>
    <div class="foot"><button class="btn" onclick="closeSheet()">Zatvori</button></div>`, (sh) => {
    $('.lists', sh).addEventListener('click', (e) => { const b = e.target.closest('[data-pick]'); if (!b) return; S.activeList = b.dataset.pick; save(false); closeSheet(); render(); });
    $('#lsNew').onclick = () => {
      const n = prompt('Naziv nove liste (npr. Pijaca, Apoteka):'); if (!n || !n.trim()) return;
      const L = { id: uid(), name: n.trim(), items: [] }; S.lists.push(L); S.activeList = L.id; save(false); closeSheet(); render();
    };
    $('#lsRecv').onclick = pasteImport;
  });
}

// ---- katalog artikala
let catSel = CATALOG[0].cat;
function openCatalog() {
  openSheet(`<div id="catWrap"><h3>Katalog artikala</h3>
    <p style="margin:0;color:var(--muted);font-size:13px">Dodirni artikal da ga dodaš (ponovni dodir povećava količinu).</p>
    <input class="input" id="cSearch" placeholder="🔎 Pretraži (npr. sir, pivo…)" autocomplete="off" style="margin:10px 0 8px">
    <div class="chips" id="cCats">${CATALOG.map((g) => `<button class="chip ${g.cat === catSel ? 'on' : ''}" data-cat="${esc(g.cat)}">${g.icon} ${esc(g.cat)}</button>`).join('')}</div>
    <div id="cItems" class="cat-grid"></div>
    <div id="cOnline"></div>
    <div class="foot"><button class="btn primary" onclick="closeSheet();render()">Gotovo</button></div></div>`, () => {
    const draw = () => {
      const q = $('#cSearch').value.trim().toLowerCase();
      const inList = new Map(curList().items.filter((i) => !i.done).map((i) => [i.name.toLowerCase(), i]));
      let items = q
        ? CATALOG.flatMap((g) => g.items.filter(([n]) => n.toLowerCase().includes(q)))
        : CATALOG.find((g) => g.cat === catSel).items;
      $('#cCats').style.display = q ? 'none' : '';
      $('#cItems').innerHTML = items.length ? items.map(([n, u]) => {
        const it = inList.get(n.toLowerCase());
        return `<button class="cat-item ${it ? 'on' : ''}" data-name="${esc(n)}" data-unit="${u}">${esc(n)}${it ? `<b>${esc(fmtQty(it))}</b>` : ''}</button>`;
      }).join('') : '<p style="color:var(--muted);font-size:14px">Nema u katalogu.</p>';
      $('#cOnline').innerHTML = q.length >= 3
        ? `<button class="btn block small" id="cOnBtn" style="margin-top:10px">🌐 Traži „${esc(q)}“ u bazi proizvoda (internet)</button><div id="cOnRes"></div>` : '';
      if ($('#cOnBtn')) $('#cOnBtn').onclick = () => onlineSearch(q);
    };
    $('#cSearch').addEventListener('input', draw);
    $('#cCats').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (!b) return; catSel = b.dataset.cat; $$('#cCats .chip').forEach((x) => x.classList.toggle('on', x === b)); draw(); });
    $('#catWrap').addEventListener('click', (e) => {
      const b = e.target.closest('[data-name]'); if (!b) return;
      addToList(b.dataset.name, null, b.dataset.unit || null, true);
      if (b.classList.contains('cat-item')) draw(); else { b.classList.add('on'); toast('Dodato: ' + b.dataset.name); }
    });
    draw();
  });
}

async function onlineSearch(q) {
  const box = $('#cOnRes'); if (!box) return;
  box.innerHTML = '<p style="color:var(--muted);font-size:14px">Tražim…</p>';
  const url = 'https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=30'
    + '&fields=product_name,product_name_sr,brands,quantity&tagtype_0=countries&tag_contains_0=contains&tag_0=serbia'
    + '&search_terms=' + encodeURIComponent(q);
  try {
    const res = await fetch(url);
    const data = await res.json();
    const seen = new Set();
    const prods = (data.products || []).map((p) => {
      const n = (p.product_name_sr || p.product_name || '').trim(); if (!n) return null;
      const label = [n, p.brands && !n.toLowerCase().includes(p.brands.split(',')[0].toLowerCase()) ? p.brands.split(',')[0].trim() : '', p.quantity || ''].filter(Boolean).join(' ');
      if (seen.has(label.toLowerCase())) return null; seen.add(label.toLowerCase());
      return label;
    }).filter(Boolean);
    box.innerHTML = prods.length
      ? `<div class="cat-grid" style="margin-top:8px">${prods.map((p) => `<button class="cat-item online" data-name="${esc(p)}">${esc(p)}</button>`).join('')}</div>
         <p style="color:var(--muted);font-size:12px">Izvor: Open Food Facts (otvorena baza proizvoda).</p>`
      : '<p style="color:var(--muted);font-size:14px">Nema proizvoda iz Srbije za tu pretragu.</p>';
  } catch {
    box.innerHTML = '<p style="color:var(--danger);font-size:14px">Pretraga nije uspela – proveri internet.</p>';
  }
}

function cenotekaUrl(name) {
  return 'https://www.google.com/search?q=' + encodeURIComponent('site:cenoteka.rs ' + name);
}
function listText(L) {
  const open = L.items.filter((i) => !i.done);
  return `🛒 ${L.name}\n` + (open.length ? open : L.items).map((i) => `• ${i.name}${i.qty ? ' – ' + fmtQty(i) : ''}`).join('\n');
}

// ---- deljenje liste linkom (bez servera: cela lista je u linku)
function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str); let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
function encodeList(L) {
  const items = L.items.filter((i) => !i.done);
  return b64urlEncode(JSON.stringify([1, L.name, (items.length ? items : L.items).map((i) => [i.name, i.qty || 0, i.unit || 'kom'])]));
}
function decodeList(d) {
  const [v, name, items] = JSON.parse(b64urlDecode(d));
  if (v !== 1 || !Array.isArray(items)) throw new Error('nepoznat format');
  return { name: String(name || 'Lista'), items: items.map(([n, q, u]) => ({ name: String(n), qty: +q || null, unit: UNITS.includes(u) ? u : 'kom' })) };
}
const listLink = (L) => `${WEB_URL}?lista=${encodeList(L)}`;
function shareText(L) {
  return `${listText(L)}\n\n📲 Dodaj u Moj Asistent jednim dodirom:\n${listLink(L)}`;
}
// Tekst iz poruke → lista (link iz aplikacije ili obične linije „• mleko – 2 l“)
function parseShared(text) {
  const m = text.match(/[?&]lista=([A-Za-z0-9_-]+)/) || text.match(/[?&]d=([A-Za-z0-9_-]+)/);
  if (m) return decodeList(m[1]);
  let name = 'Lista';
  const items = [];
  for (let line of text.split('\n')) {
    line = line.trim(); if (!line) continue;
    if (/^🛒/.test(line)) { name = line.replace(/^🛒\s*/, '') || name; continue; }
    if (/^(📲|https?:)/.test(line)) continue;
    line = line.replace(/^[•\-*–·\d.)\s]+(?=\D)/, '').trim();
    const [n, q] = line.split(/\s+[–-]\s+/);
    if (!n) continue;
    const it = parseItem(q ? `${q} ${n}` : n);
    items.push({ name: it.name, qty: it.qty, unit: it.unit || 'kom' });
  }
  if (!items.length) throw new Error('nema artikala u tekstu');
  return { name, items };
}

async function shareList() {
  const L = curList(), text = shareText(L);
  if (navigator.share && !IS_NATIVE) { try { await navigator.share({ title: L.name, text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  openSheet(`<h3>Pošalji listu „${esc(L.name)}“</h3>
    <p style="margin:0;color:var(--muted);font-size:13px">Ko ima Moj Asistent, dodirne link u poruci i lista mu se doda u aplikaciju.</p>
    <textarea class="input" readonly style="min-height:150px">${esc(text)}</textarea>
    <div class="row" style="margin-top:12px">
      <button class="btn" data-to="viber">Viber</button><button class="btn" data-to="wa">WhatsApp</button>
      <button class="btn" data-to="sms">SMS</button><button class="btn" data-to="copy">Kopiraj</button>
    </div><div class="foot"><button class="btn" onclick="closeSheet()">Zatvori</button></div>`, (sh) => {
    $('.row', sh).addEventListener('click', async (e) => {
      const to = e.target.dataset.to; if (!to) return;
      if (to === 'viber') openExternal('viber://forward?text=' + encodeURIComponent(text));
      if (to === 'wa') openExternal('https://wa.me/?text=' + encodeURIComponent(text));
      if (to === 'sms') openExternal(smsUrl('', text));
      if (to === 'copy') {
        try { await navigator.clipboard.writeText(text); } catch { $('textarea', sh).select(); document.execCommand('copy'); }
        toast('Kopirano – nalepi u poruku');
      }
    });
  });
}

// Prijem liste: pregled, izbor liste u koju se dodaje
const artikala = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'artikal' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'artikla' : 'artikala');
function showImport(data) {
  const isAndroidWeb = !IS_NATIVE && /Android/i.test(navigator.userAgent);
  const intentUrl = `intent://lista?d=${encodeList(data)}#Intent;scheme=mojasistent;package=com.fianketo.mojasistent;S.browser_fallback_url=${encodeURIComponent(APK_URL)};end`;
  openSheet(`<h3>📥 Primljena lista „${esc(data.name)}“</h3>
    <div class="card block" style="max-height:38vh;overflow:auto;margin-top:8px">${data.items.map((i) => `<div>• ${esc(i.name)}${i.qty ? ` <span style="color:var(--muted)">– ${esc(fmtQty(i))}</span>` : ''}</div>`).join('')}</div>
    ${isAndroidWeb ? `<a class="btn primary block" style="text-align:center;text-decoration:none;margin-top:8px" href="${esc(intentUrl)}">📱 Otvori u Android aplikaciji</a>
      <p style="font-size:12px;color:var(--muted);margin:6px 0">Nemaš aplikaciju? Dugme je preuzima. Ili dodaj listu ovde, u web verziji:</p>` : ''}
    <label class="field">Dodaj u
      <select class="input" id="impTo"><option value="__new">Novu listu „${esc(data.name)}“</option>${S.lists.map((l) => `<option value="${l.id}" ${l.name.toLowerCase() === data.name.toLowerCase() ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></label>
    <div class="foot"><button class="btn" onclick="closeSheet()">Otkaži</button><button class="btn primary" id="impOk">Dodaj ${data.items.length} ${artikala(data.items.length)}</button></div>`, () => {
    $('#impOk').onclick = () => {
      const to = $('#impTo').value;
      if (to === '__new') { const L = { id: uid(), name: data.name, items: [] }; S.lists.push(L); S.activeList = L.id; }
      else S.activeList = to;
      for (const it of data.items) addToList(it.name, it.qty, it.unit, true);
      save(false); closeSheet(); setTab('kupovina'); toast(`Dodato ${data.items.length} u „${curList().name}“`);
    };
  });
}
function importFromUrl(url) {
  try {
    const m = String(url).match(/[?&](?:lista|d)=([A-Za-z0-9_-]+)/);
    if (m) showImport(decodeList(m[1]));
  } catch (e) { toast('Link liste nije ispravan'); }
}
function pasteImport() {
  openSheet(`<h3>📋 Uvezi listu iz poruke</h3>
    <p style="margin:0;color:var(--muted);font-size:13px">Nalepi poruku sa listom (link iz aplikacije ili običan spisak, svaki artikal u svom redu).</p>
    <textarea class="input" id="pasteTxt" style="min-height:160px" placeholder="🛒 Prodavnica&#10;• Mleko – 2 l&#10;• Hleb"></textarea>
    <div class="foot"><button class="btn" onclick="closeSheet()">Otkaži</button><button class="btn primary" id="pasteOk">Dalje</button></div>`, () => {
    navigator.clipboard?.readText?.().then((t) => { if (t && !$('#pasteTxt').value) $('#pasteTxt').value = t; }).catch(() => {});
    $('#pasteOk').onclick = () => { try { showImport(parseShared($('#pasteTxt').value)); } catch (e) { toast('Ne mogu da pročitam listu: ' + e.message); } };
  });
}

function listMenu() {
  const L = curList();
  openSheet(`<h3>Lista „${esc(L.name)}“</h3>
    <label class="field">Naziv<input class="input" id="lName" value="${esc(L.name)}"></label>
    <div class="menu-list">
      <button class="btn block" id="lPaste">📥 Primi listu iz poruke</button>
      <button class="btn block" id="lCat">📋 Katalog artikala</button>
    </div>
    <div class="foot">
      ${S.lists.length > 1 ? '<button class="btn danger" id="lDel">Obriši listu</button>' : ''}
      <button class="btn" id="lClear">Isprazni</button>
      <button class="btn primary" id="lSave">Sačuvaj</button>
    </div>`, () => {
    $('#lPaste').onclick = pasteImport;
    $('#lCat').onclick = () => { closeSheet(); openCatalog(); };
    $('#lSave').onclick = () => { L.name = $('#lName').value.trim() || L.name; save(false); closeSheet(); render(); };
    $('#lClear').onclick = () => { if (confirm('Obrisati sve stavke?')) { L.items = []; save(false); closeSheet(); render(); } };
    if ($('#lDel')) $('#lDel').onclick = () => {
      if (!confirm(`Obrisati listu „${L.name}“?`)) return;
      S.lists = S.lists.filter((x) => x.id !== L.id); S.activeList = S.lists[0].id; save(false); closeSheet(); render();
    };
  });
}

// ================================================================ PARKING
let parkTimer = null;
const zoneById = (id) => S.parking.zones.find((z) => z.id === id);

// ---- prepoznavanje zone po zapamćenim mestima
let detect = { at: 0, spot: null, dist: 0 };
function distM(a, b) {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
function nearestSpot(loc, maxM) {
  let best = null, bd = Infinity;
  for (const sp of S.parking.spots) { const d = distM(loc, sp); if (d < bd) { bd = d; best = sp; } }
  return best && bd <= maxM ? { spot: best, dist: Math.round(bd) } : null;
}
// Katastar Parking servisa Novi Sad: tačke duž svih parkirališta sa zonom i šifrom.
let nsData = null;
async function loadNs() {
  if (nsData) return nsData;
  try {
    const d = await (await fetch('zones-ns.json')).json();
    const n = d.pts.length / 4, lat = new Float64Array(n), lng = new Float64Array(n);
    for (let i = 0; i < n; i++) { lat[i] = d.base[0] + d.pts[i * 4] * d.scale; lng[i] = d.base[1] + d.pts[i * 4 + 1] * d.scale; }
    nsData = { ...d, lat, lng, n };
  } catch (e) { console.warn('zones-ns', e); }
  return nsData;
}
async function nsZoneAt(loc, maxM = 30) {
  const d = await loadNs(); if (!d) return null;
  const kx = Math.cos(loc.lat * Math.PI / 180) * 111320, ky = 110574;
  let best = maxM * maxM, bi = -1;
  for (let i = 0; i < d.n; i++) {
    const dy = (d.lat[i] - loc.lat) * ky; if (Math.abs(dy) > maxM) continue;
    const dx = (d.lng[i] - loc.lng) * kx, dd = dx * dx + dy * dy;
    if (dd < best) { best = dd; bi = i; }
  }
  if (bi < 0) return null;
  const ci = d.pts[bi * 4 + 3];
  return { zone: d.zones[d.pts[bi * 4 + 2]], code: ci >= 0 ? d.codes[ci][0] : '', text: ci >= 0 ? d.codes[ci][1] : '', dist: Math.round(Math.sqrt(best)) };
}
async function detectZone() {
  detect.at = Date.now();
  const P = S.parking;
  if (!P.spots.length && P.city !== 'novisad') return;
  const loc = await getLocation(); if (!loc) return;
  detect = { at: Date.now(), spot: null, dist: 0, ns: null, none: false };
  if (P.city === 'novisad') {
    const h = await nsZoneAt(loc);
    if (h && zoneById('ns-' + h.zone)) { detect.ns = h; P.lastZone = 'ns-' + h.zone; }
    else detect.none = true;
  }
  if (!detect.ns) {
    const n = nearestSpot(loc, 150);
    if (n && zoneById(n.spot.zone)) { detect.spot = n.spot; detect.dist = n.dist; P.lastZone = n.spot.zone; detect.none = false; }
  }
  if (tab === 'parking' && !P.active) render();
}
function learnSpot(loc, zoneId) {
  if (zoneId === 'garaza') return;
  const n = nearestSpot(loc, 80);
  if (n) Object.assign(n.spot, { zone: zoneId, lat: (n.spot.lat + loc.lat) / 2, lng: (n.spot.lng + loc.lng) / 2 });
  else S.parking.spots.push({ id: uid(), lat: loc.lat, lng: loc.lng, zone: zoneId });
  save(false); pushGeofences();
}
async function pushGeofences() {
  if (!Geo) return;
  const P = S.parking;
  try {
    await Geo.configure({
      enabled: !!P.auto, plate: P.plate || '', dwellMin: 3, city: P.city,
      cityZones: Object.fromEntries(P.zones.filter((z) => z.id.startsWith('ns-')).map((z) => [z.id.slice(3), { name: z.name, sms: z.sms }])),
      hours: { wd: P.hours.wd, sat: P.hours.sat },
      spots: P.spots.map((sp) => { const z = zoneById(sp.zone) || {}; return { id: sp.id, lat: sp.lat, lng: sp.lng, radius: 100, zone: z.name || 'Parking', sms: z.sms || '' }; }),
    });
  } catch (e) { console.warn('geo', e); }
}

function renderParking() {
  const P = S.parking, A = P.active;
  clearInterval(parkTimer);
  if (!A && Date.now() - detect.at > 30e3) detectZone();
  if (A) {
    const z = zoneById(A.zone) || { name: A.zoneName || 'Parking', color: '#64748b', sms: A.sms };
    const update = () => {
      const left = A.end - Date.now();
      const el = $('#parkLeft'); if (!el) return clearInterval(parkTimer);
      if (left <= 0) { el.textContent = 'ISTEKLO'; el.classList.add('red'); return; }
      const h = Math.floor(left / HOUR), m = Math.floor((left % HOUR) / MIN), s = Math.floor((left % MIN) / 1000);
      el.textContent = (h ? h + ':' + pad(m) : m) + ':' + pad(s);
      el.classList.toggle('red', left < P.warnMin * MIN);
    };
    $('#view').innerHTML = notifBanner() + `<div class="card block park-hero">
        <span class="zone" style="background:${esc(z.color)}">${esc(z.name)}</span>
        <div class="left" id="parkLeft"></div>
        <div class="sub">ističe u <b>${hm(new Date(A.end))}</b> · <span class="plate">${esc(A.plate || '')}</span></div>
        <div class="sub">upozorenje ${P.warnMin} min pre isteka</div>
      </div>
      <div class="row" style="margin-top:8px">
        <button class="btn primary grow" data-act="park-extend">⏱ Produži</button>
        <button class="btn ok grow" data-act="park-end">✓ Otišao sam</button>
      </div>
      ${A.lat ? `<button class="btn block" style="margin-top:8px" data-act="park-map">📍 Gde mi je auto?</button>` : ''}
      ${A.note ? `<div class="card block" style="margin-top:8px"><div class="note">📝 ${esc(A.note)}</div></div>` : ''}`;
    update(); parkTimer = setInterval(update, 1000);
    return;
  }
  const zone = zoneById(P.lastZone) || P.zones[0];
  const durs = [15, 30, 60, 90, 120, 180, 240];
  $('#view').innerHTML = notifBanner() + `<div class="card block">
      <label class="field" style="margin-top:0">Registarska oznaka
        <input class="input plate" id="pPlate" value="${esc(P.plate)}" placeholder="${P.city === 'novisad' ? 'NS123AB' : 'BG123AB'}" autocapitalize="characters"></label>
      <div class="field">Zona</div>
      ${detect.ns && 'ns-' + detect.ns.zone === zone.id ? `<div class="banner" style="margin:6px 0 0"><span>📍 Ovde je <b>${esc(zone.name)}</b>${detect.ns.code ? ` – parkiralište ${esc(detect.ns.code)}${detect.ns.text ? ' (' + esc(detect.ns.text) + ')' : ''}` : ''}</span></div>`
        : detect.spot && detect.spot.zone === zone.id ? `<div class="banner" style="margin:6px 0 0"><span>📍 Prepoznata zona: <b>${esc(zone.name)}</b> (zapamćeno mesto, ${detect.dist} m od tebe)</span></div>`
        : detect.none ? `<div class="banner" style="margin:6px 0 0"><span>📍 Ovde nema naplate parkinga (po mapi Parking servisa) – ili izaberi zonu ručno.</span></div>` : ''}
      <div class="zones" id="pZones">${P.zones.map((z) => `<button class="zone-btn ${z.id === zone.id ? 'on' : ''}" data-zone="${z.id}">
          <span class="dot" style="background:${esc(z.color)}"></span>${esc(z.name)}
          <small>${z.sms ? 'SMS ' + esc(z.sms) : 'bez SMS-a'}${z.maxMin ? ' · max ' + fmtDur(z.maxMin * MIN) : ''}${z.price ? ' · ' + z.price + ' din/h' : ''}</small></button>`).join('')}</div>
      <label class="field">Koliko ostaješ?
        <select class="input" id="pDur">${durs.map((m) => `<option value="${m}" ${m === P.lastDur ? 'selected' : ''}>${fmtDur(m * MIN)}</option>`).join('')}</select></label>
      <label class="field">Napomena (sprat, ulica…)<input class="input" id="pNote" placeholder="(nije obavezno)"></label>
      <label class="switch"><input type="checkbox" id="pSms" ${zone.sms ? 'checked' : ''}> Otvori SMS za plaćanje</label>
      <label class="switch"><input type="checkbox" id="pLoc" checked> Zapamti gde sam parkirao</label>
      <button class="btn primary block" style="margin-top:16px" data-act="park-start">🅿️ Parkirao sam</button>
    </div>
    <p style="font-size:13px;color:var(--muted)">Zone: ${esc(CITIES[P.city] ? CITIES[P.city].name : '')} – proveri SMS broj na tabli zone. Kad platiš ovde sa uključenom lokacijom, aplikacija zapamti zonu za ovo mesto i sledeći put je sama prepozna${P.auto ? ' i podseti te da platiš' : ''}. Grad i automatski podsetnik menjaš u Podešavanjima.</p>`;
  $('#pZones').addEventListener('click', (e) => {
    const b = e.target.closest('[data-zone]'); if (!b) return;
    P.lastZone = b.dataset.zone; const z = zoneById(P.lastZone);
    $$('.zone-btn').forEach((x) => x.classList.toggle('on', x === b));
    $('#pSms').checked = !!z.sms;
    if (z.maxMin && +$('#pDur').value > z.maxMin) $('#pDur').value = String(durs.filter((d) => d <= z.maxMin).pop() || durs[0]);
  });
}

function getLocation() {
  return new Promise((res) => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => res(null), { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  });
}
async function startParking() {
  const P = S.parking, z = zoneById(P.lastZone) || P.zones[0];
  const plate = $('#pPlate').value.trim().toUpperCase().replace(/[\s-]/g, '');
  const dur = +$('#pDur').value, wantSms = $('#pSms').checked, wantLoc = $('#pLoc').checked;
  if (wantSms && z.sms && !plate) { $('#pPlate').focus(); return toast('Upiši registarsku oznaku'); }
  P.plate = plate; P.lastDur = dur;
  P.active = { zone: z.id, zoneName: z.name, sms: z.sms, plate, start: Date.now(), end: Date.now() + dur * MIN, note: $('#pNote').value.trim() };
  save(); ensurePermission();
  if (wantSms && z.sms) openExternal(smsUrl(z.sms, plate));
  render();
  if (wantLoc) {
    const loc = await getLocation();
    if (loc && S.parking.active) { Object.assign(S.parking.active, loc); learnSpot(loc, z.id); render(); }
    else if (!loc) toast('Lokacija nije dostupna');
  }
}
function extendParking() {
  const A = S.parking.active, z = zoneById(A.zone);
  const sms = (z && z.sms) || A.sms;
  openSheet(`<h3>Produži parking</h3>
    <p style="color:var(--muted);font-size:14px">${sms ? `Otvoriće se SMS na <b>${esc(sms)}</b> sa tablicom <b>${esc(A.plate)}</b>. U Beogradu ponovna poruka produžava kartu (proveri pravila zone).` : 'Samo pomera vreme isteka i podsetnike.'}</p>
    <div class="row" id="extBtns">${[15, 30, 60, 120].map((m) => `<button class="btn" data-m="${m}">+${fmtDur(m * MIN)}</button>`).join('')}</div>
    <div class="foot"><button class="btn" onclick="closeSheet()">Otkaži</button></div>`, (sh) => {
    $('#extBtns', sh).addEventListener('click', (e) => {
      const m = +e.target.dataset.m; if (!m) return;
      A.end = Math.max(A.end, Date.now()) + m * MIN;
      save(); closeSheet(); render();
      if (sms) openExternal(smsUrl(sms, A.plate));
      toast('Novo vreme isteka: ' + hm(new Date(A.end)));
    });
  });
}

// ================================================================ PODEŠAVANJA
function renderSettings() {
  const P = S.parking;
  $('#view').innerHTML = `<div class="settings">
    <h2>Obaveštenja</h2>
    <div class="card"><p id="nStatus">Proveravam…</p>
      <div class="row" style="margin-top:8px"><button class="btn small" data-act="perm">Uključi obaveštenja</button>
      <button class="btn small" data-act="test">Probno (za 10 s)</button></div>
      ${IS_NATIVE ? '' : `<p style="margin-top:10px">ℹ️ U pregledaču obaveštenja stižu samo dok je aplikacija otvorena ili u pozadini. Za pouzdane podsetnike i kad je ugašena, instaliraj Android aplikaciju (dole).</p>`}
    </div>

    <h2>Parking</h2>
    <div class="card">
      <label class="field" style="margin-top:0">Upozori me pre isteka (minuta)
        <input class="input" type="number" min="1" max="60" id="sWarn" value="${P.warnMin}"></label>
      <div class="field">Zone (naziv · SMS broj · max minuta)</div>
      <div id="zoneEdit">${P.zones.map((z) => `<div class="zone-edit" data-z="${z.id}">
        <input class="input" data-f="name" value="${esc(z.name)}"><input class="input" data-f="sms" value="${esc(z.sms)}" inputmode="numeric" placeholder="SMS">
        <input class="input" data-f="maxMin" value="${z.maxMin || ''}" inputmode="numeric" placeholder="∞">
        <button class="iconbtn" data-act="zone-del">✕</button></div>`).join('')}</div>
      <div class="row" style="margin-top:10px"><button class="btn small" data-act="zone-add">+ Dodaj zonu</button>
        <button class="btn small" data-act="zone-save">Sačuvaj zone</button></div>
      <label class="field">Grad (postavlja zone i SMS brojeve)
        <select class="input" id="sCity">${Object.entries(CITIES).map(([k, c]) => `<option value="${k}" ${k === P.city ? 'selected' : ''}>${c.name}</option>`).join('')}</select></label>
      <div class="two">
        <label class="field">Naplata radnim danima<input class="input" id="sHwd" value="${P.hours.wd ? P.hours.wd.join('-') : ''}" placeholder="7-21"></label>
        <label class="field">Subotom<input class="input" id="sHsat" value="${P.hours.sat ? P.hours.sat.join('-') : ''}" placeholder="7-14"></label>
      </div>
    </div>

    <h2>Podsetnik da platiš parking</h2>
    <div class="card">
      <label class="switch" style="margin-top:0"><input type="checkbox" id="sAuto" ${P.auto ? 'checked' : ''} ${IS_NATIVE ? '' : 'disabled'}> Kad parkiram u zoni naplate, podseti me da platim</label>
      <p>${P.city === 'novisad'
        ? 'Novi Sad: kad telefon primeti da si izašao iz auta, proveri lokaciju na mapi zona Parking servisa. Ako si u zoni naplate (radnim danima 7–21, subotom 7–14), stiže obaveštenje sa zonom i dugmetom za SMS – i kad je aplikacija zatvorena.'
        : 'Mesto se zapamti kad platiš parking u aplikaciji sa uključenom lokacijom. Kad se sledeći put zadržiš tamo ~3 minuta u vreme naplate, stiže obaveštenje sa dugmetom za SMS – i kad je aplikacija zatvorena.'}
        Potrebno: lokacija „Dozvoli uvek“ i „Fizička aktivnost“.</p>
      ${IS_NATIVE ? '<div class="row" style="margin-top:6px"><button class="btn small" data-act="geo-test-exit">🔔 Probaj: „upravo sam parkirao ovde“</button></div>' : ''}
      ${IS_NATIVE ? '<p id="geoStatus">Proveravam…</p>' : '<p>⚠️ Radi samo u Android aplikaciji.</p>'}
      <p>📍 Zapamćena mesta: <b>${P.spots.length}</b></p>
      ${P.spots.map((sp) => { const z = zoneById(sp.zone); return `<div class="row" data-spot="${sp.id}" style="font-size:14px;margin-top:4px">
        <span class="dot" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${esc(z ? z.color : '#64748b')}"></span>
        <span class="grow">${esc(z ? z.name : '?')} · ${sp.lat.toFixed(4)}, ${sp.lng.toFixed(4)}</span>
        <button class="iconbtn" data-act="spot-map" title="Mapa">🗺️</button><button class="iconbtn" data-act="spot-test" title="Probaj">🔔</button><button class="iconbtn" data-act="spot-del">✕</button></div>`; }).join('')}
      <div class="row" style="margin-top:8px"><button class="btn small" data-act="spot-here">📍 Zapamti ovo mesto</button></div>
    </div>

    <h2>Instalacija i deljenje</h2>
    <div class="card">
      ${IS_NATIVE ? `<p>Instalirana Android aplikacija ✔︎</p>` : `<p><b>Android:</b> preuzmi aplikaciju (APK) – pouzdana obaveštenja i kad je ugašena.</p>
      <button class="btn small primary" data-act="apk">⬇️ Preuzmi Android aplikaciju</button>
      <p style="margin-top:10px"><b>iPhone:</b> u Safariju Podeli → <i>Dodaj na početni ekran</i>.</p>`}
      <p style="margin-top:10px">Pošalji nekome link da i on instalira:</p>
      <button class="btn small" data-act="share-app">📤 Pošalji link</button>
    </div>

    <h2>Rezervna kopija</h2>
    <div class="card"><p>Podaci se čuvaju samo na ovom telefonu.</p>
      <div class="row" style="margin-top:8px"><button class="btn small" data-act="export">Izvezi</button>
      <button class="btn small" data-act="import">Uvezi</button></div>
      <input type="file" id="importFile" accept="application/json,.json" hidden>
    </div>
    <p style="text-align:center;font-size:12px;color:var(--muted);margin-top:24px">Moj Asistent · ${IS_NATIVE ? 'Android' : 'web'} verzija${BUILD.startsWith('__') ? '' : ' · proba ' + BUILD}</p>
  </div>`;
  notifStatus().then((s) => { const el = $('#nStatus'); if (el) el.innerHTML = s; });
  if (Geo) geoStatus().then((s) => { const el = $('#geoStatus'); if (el) el.innerHTML = s; });
  $('#importFile').addEventListener('change', importData);
}

function exportData() {
  const text = JSON.stringify(S, null, 1);
  if (IS_NATIVE) { // WebView ne preuzima fajlove: kopiraj u clipboard
    navigator.clipboard.writeText(text).then(() => toast('Kopirano – nalepi u Viber/mejl sebi'), () => toast('Kopiranje nije uspelo'));
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = `moj-asistent-${toLocal(new Date()).slice(0, 10)}.json`;
  a.click();
}
function importData(e) {
  const f = e.target.files[0]; if (!f) return;
  f.text().then((t) => {
    const data = JSON.parse(t);
    if (!data.reminders || !data.lists) throw new Error('nije rezervna kopija');
    if (!confirm('Zameniti sve trenutne podatke uvezenim?')) return;
    S = Object.assign(defaults(), data); save(); render(); toast('Uvezeno');
  }).catch((err) => toast('Greška: ' + err.message));
}

// ================================================================ klikovi
$('#view').addEventListener('click', async (e) => {
  const addB = e.target.closest('[data-add]');
  if (addB) { const it = addToList(addB.dataset.add, +addB.dataset.q || null, addB.dataset.u || null, true); return afterAdd(it); }
  const el = e.target.closest('[data-act],[data-list]'); if (!el) return;
  if (el.dataset.list) { S.activeList = el.dataset.list; save(false); return render(); }
  const act = el.dataset.act;
  const rId = el.closest('[data-id]')?.dataset.id, r = rId && S.reminders.find((x) => x.id === rId);
  const iId = el.closest('[data-item]')?.dataset.item, item = iId && curList().items.find((x) => x.id === iId);
  switch (act) {
    case 'toggle': completeReminder(r); save(); return render();
    case 'edit': return editReminder(r);
    case 'clear-done': S.reminders = S.reminders.filter((x) => !x.done); save(); return render();
    case 'item-toggle': {
      item.done = !item.done; save(false);
      const row = el.closest('.item-row'); if (row) { row.classList.add(item.done ? 'checking' : 'unchecking'); setTimeout(render, 220); } else render();
      return;
    }
    case 'toggle-bought': showBought = !showBought; return render();
    case 'list-switch': return listSwitcher();
    case 'item-del': return deleteItem(item);
    case 'item-edit': return editItem(item);
    case 'qty-inc': case 'qty-dec': {
      const s = stepOf(item.unit), d = act === 'qty-inc' ? s : -s;
      item.qty = Math.max(s, (item.qty || 0) + d); item.unit = item.unit || 'kom';
      save(false); return render();
    }
    case 'catalog': return openCatalog();
    case 'price': return openExternal(cenotekaUrl(item.name));
    case 'new-list': {
      const n = prompt('Naziv nove liste (npr. Pijaca, Apoteka):'); if (!n || !n.trim()) return;
      const L = { id: uid(), name: n.trim(), items: [] }; S.lists.push(L); S.activeList = L.id; save(false); return render();
    }
    case 'share': return shareList();
    case 'paste-import': return pasteImport();
    case 'clear-bought': {
      const L = curList(), prev = L.items.slice();
      L.items = L.items.filter((x) => !x.done); save(false); render();
      return toast('Kupljeno uklonjeno sa liste', 4000, { label: 'Poništi', fn: () => { L.items = prev; save(false); render(); } });
    }
    case 'list-menu': return listMenu();
    case 'park-start': return startParking();
    case 'park-extend': return extendParking();
    case 'park-end': if (confirm('Završiti parking?')) { S.parking.active = null; save(); render(); } return;
    case 'park-map': { const A = S.parking.active; return openExternal(`https://www.google.com/maps/search/?api=1&query=${A.lat},${A.lng}`); }
    case 'perm': await ensurePermission(true); return render();
    case 'test': return testNotification();
    case 'battery': await Battery.request(); return;
    case 'geo-perm': await toggleAuto(true); return;
    case 'geo-test-exit': if (Geo) { if (!S.parking.auto) return toast('Prvo uključi podsetnik iznad'); await pushGeofences(); await Geo.testVehicleExit(); toast('Proveravam lokaciju… obaveštenje stiže ako si u zoni'); setTimeout(render, 6000); } return;
    case 'exact': try { await LN.changeExactNotificationSetting(); } catch { /* */ } scheduleSync(); return render();
    case 'zone-add': S.parking.zones.push({ id: uid(), name: 'Nova zona', color: '#7c3aed', sms: '', maxMin: 0 }); save(false); return render();
    case 'zone-del': S.parking.zones = S.parking.zones.filter((z) => z.id !== el.closest('[data-z]').dataset.z);
      if (!S.parking.zones.length) S.parking.zones = DEFAULT_ZONES.map((z) => ({ ...z })); save(false); return render();
    case 'zone-save':
      $$('#zoneEdit [data-z]').forEach((row) => {
        const z = zoneById(row.dataset.z);
        z.name = $('[data-f=name]', row).value.trim() || z.name;
        z.sms = $('[data-f=sms]', row).value.replace(/\D/g, '');
        z.maxMin = +$('[data-f=maxMin]', row).value || 0;
      });
      S.parking.warnMin = Math.min(60, Math.max(1, +$('#sWarn').value || 10));
      save(); toast('Sačuvano'); return render();
    case 'spot-del': S.parking.spots = S.parking.spots.filter((x) => x.id !== el.closest('[data-spot]').dataset.spot); save(false); pushGeofences(); return render();
    case 'spot-map': { const sp = S.parking.spots.find((x) => x.id === el.closest('[data-spot]').dataset.spot); return openExternal(`https://www.google.com/maps/search/?api=1&query=${sp.lat},${sp.lng}`); }
    case 'spot-test': if (Geo) { await pushGeofences(); await Geo.testDwell({ id: el.closest('[data-spot]').dataset.spot }); toast('Probni podsetnik je poslat'); } return;
    case 'spot-here': return rememberHere();
    case 'apk': return openExternal(APK_URL);
    case 'share-app': {
      const text = `Moj Asistent – podsetnici, kupovina i parking.\nAndroid aplikacija: ${APK_URL}\nWeb (iPhone/računar): ${WEB_URL}`;
      if (navigator.share && !IS_NATIVE) { try { await navigator.share({ title: 'Moj Asistent', text }); return; } catch { /* nastavi */ } }
      try { await navigator.clipboard.writeText(text); toast('Link kopiran – nalepi ga u poruku'); } catch { prompt('Kopiraj:', text); }
      return;
    }
    case 'export': return exportData();
    case 'import': return $('#importFile').click();
  }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'sWarn') { S.parking.warnMin = Math.min(60, Math.max(1, +e.target.value || 10)); save(); }
  if (e.target.id === 'pPlate') { S.parking.plate = e.target.value.trim().toUpperCase().replace(/[\s-]/g, ''); save(false); pushGeofences(); }
  if (e.target.id === 'sCity') {
    const c = e.target.value;
    if (!confirm(`Postaviti zone za ${CITIES[c].name}? Tvoje izmene zona biće zamenjene.`)) { e.target.value = S.parking.city; return; }
    S.parking.city = c; S.parking.zones = cityZones(c); S.parking.hours = { ...CITIES[c].hours };
    S.parking.lastZone = S.parking.zones[1] ? S.parking.zones[1].id : S.parking.zones[0].id;
    save(false); pushGeofences(); render(); toast('Zone: ' + CITIES[c].name);
  }
  if (e.target.id === 'sHwd' || e.target.id === 'sHsat') {
    const parse = (v) => { const m = v.match(/(\d{1,2})\D+(\d{1,2})/); return m ? [+m[1], +m[2]] : null; };
    S.parking.hours = { wd: parse($('#sHwd').value), sat: parse($('#sHsat').value) };
    save(false); pushGeofences();
  }
  if (e.target.id === 'sAuto') toggleAuto(e.target.checked);
});

// ================================================================ OBAVEŠTENJA
function notifBanner() {
  if (IS_NATIVE) return ''; // native: status se proverava asinhrono, vidi checkNativeBanner
  if (!('Notification' in window)) return '';
  if (Notification.permission === 'granted') return '';
  return `<div class="banner"><span>🔔</span><span class="grow">Uključi obaveštenja da bi ti stizali podsetnici.</span>
    <button class="btn small primary" data-act="perm">Uključi</button></div>`;
}

// Svi podsetnici koje treba prikazati u budućnosti.
function desiredNotifications() {
  const out = [], now = Date.now(), horizon = now + 60 * DAY;
  for (const r of S.reminders) {
    if (r.done || !r.at) continue;
    let d = parseLocal(r.at), n = 0;
    while (d && n < 12) {
      const fire = d.getTime() - (r.before || 0) * MIN;
      if (fire > horizon) break;
      if (fire > now - 5 * MIN) {
        out.push({ key: `r:${r.id}:${d.getTime()}`, at: fire, title: '⏰ ' + r.title,
          body: (r.before ? `${BEFORE[r.before]} · ` : '') + fmtWhen(d) + (r.note ? '\n' + r.note : ''), tab: 'podsetnici', channel: 'podsetnici' });
        n++;
      }
      if (!r.repeat) break;
      d = addRepeat(d, r.repeat);
    }
  }
  const A = S.parking.active;
  if (A) {
    const warnAt = A.end - S.parking.warnMin * MIN;
    if (warnAt > now) out.push({ key: `p:warn:${A.end}`, at: warnAt, title: '🅿️ Parking ističe za ' + S.parking.warnMin + ' min',
      body: `${A.zoneName} · ističe u ${hm(new Date(A.end))}. Otvori aplikaciju da produžiš.`, tab: 'parking', channel: 'parking' });
    if (A.end > now - 5 * MIN) out.push({ key: `p:end:${A.end}`, at: A.end, title: '🅿️ Parking je istekao!',
      body: `${A.zoneName} – plati ponovo ili pomeri auto.`, tab: 'parking', channel: 'parking' });
  }
  return out.sort((a, b) => a.at - b.at).slice(0, 60);
}

let syncTimer = null;
function scheduleSync() { clearTimeout(syncTimer); syncTimer = setTimeout(syncNotifications, 300); }

const TEST_IDS = [998, 999];
let diag = { lastSync: null, lastError: '', scheduled: 0 };

async function exactAllowed() {
  try { const r = await LN.checkExactNotificationSetting(); return !r || r.exact_alarm !== 'denied'; } catch { return true; }
}

async function syncNotifications() {
  if (!IS_NATIVE) return; // web: proverava webTick
  try { await Geo.setActiveUntil({ until: S.parking.active ? S.parking.active.end : 0 }); } catch { /* */ }
  try {
    const perm = await LN.checkPermissions();
    if (perm.display !== 'granted') { diag.lastError = 'Nema dozvole za obaveštenja'; return; }
    const exact = await exactAllowed();
    const list = desiredNotifications().filter((n) => n.at > Date.now() + 1000);
    const want = new Set(list.map((n) => hashId(n.key)));
    // otkaži samo ono što više ne treba (probna obaveštenja se ne diraju)
    const pending = (await LN.getPending()).notifications || [];
    const stale = pending.filter((n) => !want.has(+n.id) && !TEST_IDS.includes(+n.id));
    if (stale.length) await LN.cancel({ notifications: stale.map((n) => ({ id: +n.id })) });
    if (list.length) {
      await LN.schedule({
        notifications: list.map((n) => ({
          id: hashId(n.key), title: n.title, body: n.body, largeBody: n.body,
          schedule: { at: new Date(n.at), allowWhileIdle: true },
          isExactNotification: exact,
          channelId: n.channel, smallIcon: 'ic_stat_notify', extra: { tab: n.tab },
        })),
      });
    }
    diag = { lastSync: Date.now(), lastError: '', scheduled: list.length, exact };
  } catch (e) {
    diag.lastError = (e && (e.message || e.code)) || String(e);
    console.warn('sync', e);
  }
}

async function ensurePermission(explicit) {
  if (IS_NATIVE) {
    let p = await LN.checkPermissions();
    if (p.display !== 'granted') p = await LN.requestPermissions();
    if (p.display !== 'granted') { if (explicit) toast('Obaveštenja su isključena – uključi ih u podešavanjima telefona'); return false; }
    try {
      const ex = LN.checkExactNotificationSetting && await LN.checkExactNotificationSetting();
      if (ex && ex.exact_alarm && ex.exact_alarm !== 'granted' && explicit) await LN.changeExactNotificationSetting();
    } catch { /* starije verzije Androida */ }
    scheduleSync();
    return true;
  }
  if (!('Notification' in window)) { if (explicit) toast('Ovaj pregledač ne podržava obaveštenja'); return false; }
  if (Notification.permission === 'default') await Notification.requestPermission();
  if (Notification.permission !== 'granted' && explicit) toast('Obaveštenja su blokirana u pregledaču');
  if (tab !== 'podesavanja') render();
  return Notification.permission === 'granted';
}

async function notifStatus() {
  if (IS_NATIVE) {
    const ok = '<span class="status-ok">✔︎</span>', bad = '<span class="status-bad">✖</span>';
    const lines = [];
    const p = await LN.checkPermissions().catch((e) => ({ display: 'greška: ' + e.message }));
    lines.push(p.display === 'granted' ? `${ok} Obaveštenja dozvoljena`
      : `${bad} Obaveštenja nisu dozvoljena (${esc(p.display)}) <button class="btn small" data-act="perm">Dozvoli</button>`);
    try {
      const ex = await LN.checkExactNotificationSetting();
      lines.push(ex.exact_alarm !== 'denied' ? `${ok} Tačni alarmi dozvoljeni`
        : `${bad} Tačni alarmi nisu dozvoljeni – podsetnici mogu da kasne <button class="btn small" data-act="exact">Dozvoli</button>`);
    } catch { /* */ }
    try {
      lines.push((await Battery.status()).unrestricted ? `${ok} Štednja baterije isključena`
        : `⚠️ Štednja baterije uključena <button class="btn small" data-act="battery">Isključi</button>`);
    } catch { /* */ }
    try {
      const pend = ((await LN.getPending()).notifications || []).filter((n) => n.schedule && n.schedule.at);
      const next = pend.map((n) => new Date(n.schedule.at)).filter((d) => !isNaN(d)).sort((a, b) => a - b)[0];
      lines.push(`📅 Zakazano: ${pend.length}${next ? ' · sledeće ' + fmtWhen(next) : ''}`);
    } catch (e) { lines.push(`${bad} Ne mogu da pročitam zakazana: ${esc(e.message)}`); }
    if (diag.lastError) lines.push(`${bad} Poslednja greška: ${esc(diag.lastError)}`);
    return lines.join('<br>');
  }
  if (!('Notification' in window)) return '<span class="status-bad">Pregledač ne podržava obaveštenja</span>';
  return { granted: '<span class="status-ok">✔︎ Uključena</span>', denied: '<span class="status-bad">✖ Blokirana u pregledaču</span>', default: 'Nisu uključena' }[Notification.permission];
}

async function testNotification() {
  if (!(await ensurePermission(true))) return;
  const at = Date.now() + 10e3;
  if (IS_NATIVE) {
    try {
      const exact = await exactAllowed();
      // 1) odmah – proverava da li telefon uopšte prikazuje obaveštenja
      await LN.schedule({ notifications: [{ id: 998, title: '🔔 Obaveštenja rade', body: 'Za 10 sekundi stiže i zakazano probno obaveštenje.', channelId: 'podsetnici', smallIcon: 'ic_stat_notify' }] });
      // 2) zakazano – proverava da li alarmi rade i kad je aplikacija zatvorena
      await LN.schedule({ notifications: [{ id: 999, title: '✅ Zakazano obaveštenje radi', body: 'Podsetnici će ti stizati i kad je aplikacija zatvorena.', schedule: { at: new Date(at), allowWhileIdle: true }, isExactNotification: exact, channelId: 'podsetnici', smallIcon: 'ic_stat_notify' }] });
      toast('Prvo stiže odmah, drugo za 10 s – zatvori aplikaciju i sačekaj', 5000);
    } catch (e) {
      diag.lastError = (e && (e.message || e.code)) || String(e);
      toast('Greška: ' + diag.lastError, 6000);
      if (tab === 'podesavanja') render();
    }
  } else {
    setTimeout(() => showWebNotification({ key: 'test', title: '✅ Probno obaveštenje', body: 'Obaveštenja rade!', tab }), 10e3);
    toast('Stiže za 10 sekundi (ostavi pregledač otvoren)');
  }
}

async function showWebNotification(n) {
  toast(n.title, 5000);
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body: n.body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: n.key, data: { tab: n.tab }, requireInteraction: true, vibrate: [200, 100, 200] };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return reg.showNotification(n.title, opts);
  } catch { /* fallback */ }
  try { new Notification(n.title, opts); } catch { /* */ }
}

function webTick() { // web verzija: proveri da li je nešto dospelo
  const now = Date.now();
  let changed = false;
  for (const n of desiredNotifications()) {
    if (n.at <= now && !S.fired[n.key]) { S.fired[n.key] = now; changed = true; showWebNotification(n); }
  }
  for (const k in S.fired) if (S.fired[k] < now - 3 * DAY) { delete S.fired[k]; changed = true; }
  if (changed) { save(false); if (tab === 'podsetnici') render(); }
}

// ================================================================ automatski parking podsetnik
async function toggleAuto(on) {
  if (!Geo) return;
  if (on) {
    toast('Dozvoli lokaciju, pa izaberi „Dozvoli uvek“', 5000);
    const r = await Geo.requestLocation().catch(() => ({}));
    if (!r.location) { toast('Bez dozvole za lokaciju ne mogu da prepoznam mesto'); S.parking.auto = false; save(false); return render(); }
    if (!r.background) toast('Izaberi „Dozvoli uvek“ za lokaciju, inače podsetnik ne radi kad je aplikacija zatvorena', 6000);
    else if (r.activity === false) toast('Dozvoli „Fizička aktivnost“ da bi aplikacija znala kad si izašao iz auta', 6000);
  }
  S.parking.auto = on; save(false); await pushGeofences(); render();
}
async function geoStatus() {
  const ok = '<span class="status-ok">✔︎</span>', bad = '<span class="status-bad">✖</span>';
  try {
    const st = await Geo.status();
    const lines = [st.location ? `${ok} Lokacija dozvoljena` : `${bad} Lokacija nije dozvoljena`,
      st.background ? `${ok} Lokacija „uvek“ (i kad je aplikacija zatvorena)` : `${bad} Lokacija nije „Dozvoli uvek“ <button class="btn small" data-act="geo-perm">Dozvoli</button>`,
      st.activity ? `${ok} Prepoznavanje vožnje (fizička aktivnost)` : `${bad} Nije dozvoljena „Fizička aktivnost“ <button class="btn small" data-act="geo-perm">Dozvoli</button>`];
    if (st.lastEvent) lines.push(`ℹ️ Poslednji događaj: ${esc(st.lastEvent.replace(/@(\d+)$/, (m, t) => ' · ' + fmtWhen(new Date(+t))))}`);
    if (st.lastRegister && st.lastRegister.startsWith('error')) lines.push(`${bad} ${esc(st.lastRegister)}`);
    return lines.join('<br>');
  } catch (e) { return `${bad} ${esc(e.message)}`; }
}
async function rememberHere() {
  const loc = await getLocation();
  if (!loc) return toast('Lokacija nije dostupna – uključi lokaciju');
  const zoneId = prompt(`Koja zona je ovde?\n${S.parking.zones.filter((x) => x.id !== 'garaza').map((x, i) => `${i + 1} = ${x.name}`).join('\n')}`, '1');
  const list = S.parking.zones.filter((x) => x.id !== 'garaza');
  const pick = list[(+zoneId || 0) - 1];
  if (!pick) return;
  learnSpot(loc, pick.id); render(); toast('Zapamćeno: ' + pick.name);
}

// ================================================================ start
async function initNative() {
  try {
    await LN.createChannel({ id: 'podsetnici', name: 'Podsetnici', description: 'Tvoji podsetnici', importance: 5, visibility: 1, vibration: true });
    await LN.createChannel({ id: 'parking', name: 'Parking', description: 'Istek parkinga', importance: 5, visibility: 1, vibration: true });
    LN.addListener('localNotificationActionPerformed', (ev) => {
      const t = ev.notification?.extra?.tab; if (t && TITLES[t]) setTab(t);
    });
    const p = await LN.checkPermissions();
    if (p.display === 'prompt' || p.display === 'prompt-with-rationale') await ensurePermission();
  } catch (e) { console.warn('init', e); }
  syncNotifications();
  pushGeofences();
  try {
    AppP.addListener('appUrlOpen', (e) => importFromUrl(e.url));
    const l = await AppP.getLaunchUrl(); if (l && l.url) setTimeout(() => importFromUrl(l.url), 300);
  } catch (e) { console.warn('app url', e); }
}

if (IS_NATIVE) initNative();
else {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker?.addEventListener('message', (e) => { if (e.data?.tab && TITLES[e.data.tab]) setTab(e.data.tab); });
  const t = new URLSearchParams(location.search).get('tab'); if (t && TITLES[t]) tab = t;
  if (/[?&]lista=/.test(location.search)) { const q = location.search; setTimeout(() => importFromUrl(q), 300); history.replaceState(null, '', location.pathname); }
  webTick(); setInterval(webTick, 15e3);
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (IS_NATIVE) syncNotifications(); else webTick();
  if (!$('#sheetBg').hidden) return; render();
});
window.closeSheet = closeSheet;
setTab(tab);
