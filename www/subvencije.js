/* Subvencije i podsticaji za poljoprivrednike – GitHub Actions prati izvore na svaka 3 sata (grana subvencije-data). */
'use strict';
const SUBV_URL = 'https://raw.githubusercontent.com/fianketo/Moj-asistent/subvencije-data/subvencije.json';
const SUBV_TAGS = ['Stočarstvo', 'Pčelarstvo', 'Biljna proizvodnja', 'Mehanizacija i oprema', 'Navodnjavanje', 'IPARD', 'Krediti', 'Ruralni razvoj', 'Organska proizvodnja', 'Mladi poljoprivrednici'];
let SUBV = null, subvLoading = null;
const SV = () => (S.subv = Object.assign({ on: false, tags: [], seen: '', notifiedSeen: '' }, S.subv || {}));

async function loadSubv(force = false) {
  if (SUBV && !force && Date.now() - SUBV.loadedAt < 30 * 60e3) return SUBV;
  if (subvLoading) return subvLoading;
  subvLoading = (async () => {
    let cache = null; try { cache = await caches.open('asistent-okolina'); } catch { /* */ }
    let d = null;
    try {
      const r = await fetch(SUBV_URL, { cache: 'no-cache' }); if (!r.ok) throw new Error('HTTP ' + r.status);
      if (cache) await cache.put(SUBV_URL, r.clone()); d = await r.json();
    } catch (e) { if (cache) { const r = await cache.match(SUBV_URL); if (r) d = await r.json().catch(() => null); } if (!d) throw e; }
    d.loadedAt = Date.now(); SUBV = d; return d;
  })().finally(() => { subvLoading = null; });
  return subvLoading;
}
const daysTo = (iso) => Math.round((new Date(iso + 'T23:59') - Date.now()) / DAY);
const dmy = (iso) => iso.split('-').reverse().join('.') + '.';
// otvoren poziv: rok još nije prošao, ili (bez roka) objavljen u poslednjih 45 dana
const isOpen = (x) => x.kind === 'poziv' && (x.deadline ? daysTo(x.deadline) >= 0 : (Date.now() - new Date(x.date)) / DAY <= 45);
const mineSubv = (x) => !SV().tags.length || x.tags.some((t) => SV().tags.includes(t));
function subvTileHtml() {
  if (!SV().on) return '';
  if (!SUBV) return `<button class="tile t-subv" data-home="subv"><small>🌾 Subvencije</small><b class="t-title">Učitavam…</b></button>`;
  const open = SUBV.items.filter((x) => isOpen(x) && mineSubv(x)), fresh = SUBV.items.filter((x) => mineSubv(x) && x.first_seen > (SV().seen || ''));
  const soon = open.filter((x) => x.deadline && daysTo(x.deadline) <= 7).sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
  return `<button class="tile t-subv" data-home="subv"><small>🌾 Subvencije za poljoprivrednike${fresh.length ? ` · <b class="rl-late">${fresh.length} novo</b>` : ''}</small>
    <div class="t-row" style="align-items:flex-end"><div><div class="t-num">${open.length}</div><small>${open.length === 1 ? 'otvoren poziv' : 'otvorenih poziva'}</small></div>
    ${soon ? `<span class="subv-soon">⏳ ${esc(soon.title.slice(0, 48))}${soon.title.length > 48 ? '…' : ''} – rok za ${daysTo(soon.deadline)} d</span>` : ''}</div></button>`;
}
function subvItem(x) {
  const d = x.deadline && daysTo(x.deadline), open = isOpen(x);
  const kindLbl = { poziv: open ? '🟢 Otvoren poziv' : '⚪ Poziv', isplata: '💸 Isplata', rezultat: '📋 Rezultati', vest: '📰 Vest' }[x.kind];
  return `<div class="subv-card ${x.first_seen > (SV().seen || '') ? 'new' : ''}">
    <div class="subv-meta"><span>${kindLbl}</span><span>${esc(x.src)} · ${dmy(x.date)}</span></div>
    <b>${esc(x.title)}</b>
    ${x.deadline ? `<span class="subv-dl ${d < 0 ? 'past' : d <= 7 ? 'soon' : ''}">${d < 0 ? 'Rok je istekao ' : 'Rok: '}${dmy(x.deadline)}${d >= 0 ? ` (još ${d} ${d === 1 ? 'dan' : 'dana'})` : ''}</span>` : ''}
    ${x.summary && x.summary !== x.title ? `<p>${esc(x.summary)}</p>` : ''}
    ${x.tags.length ? `<div class="subv-tags">${x.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
    <div class="row"><button class="btn small" data-sv="open" data-u="${esc(x.url)}">Otvori ›</button>${x.deadline && d >= 1 ? `<button class="btn small" data-sv="rem" data-id="${x.id}">⏰ Podseti me na rok</button>` : ''}</div></div>`;
}
async function subvSheet(view = 'open') {
  openSheet('<div class="pr-wrap"><h3>🌾 Subvencije</h3><p class="meta">Učitavam…</p></div>');
  try { await loadSubv(); } catch (e) { return openSheet(`<div class="pr-wrap"><h3>🌾 Subvencije</h3><p>Podaci trenutno nisu dostupni (${esc(e.message)}).</p><div class="foot"><button class="btn" onclick="closeSheet()">Zatvori</button></div></div>`); }
  const draw = () => {
    const all = SUBV.items.filter(mineSubv), list = view === 'open' ? all.filter(isOpen).sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999')) : all;
    return `<div class="pr-wrap" id="svWrap"><h3>🌾 Subvencije i podsticaji</h3>
      <div class="seg seg-in" style="position:static"><button class="${view === 'open' ? 'on' : ''}" data-sv="v" data-v="open">Otvoreni pozivi (${all.filter(isOpen).length})</button><button class="${view === 'all' ? 'on' : ''}" data-sv="v" data-v="all">Sve objave (${all.length})</button></div>
      <div class="fx-row"><small>Šta te zanima${SV().tags.length ? '' : ' (sve)'}</small><div class="chips" style="flex-wrap:wrap">${SUBV_TAGS.map((t) => `<button class="chip ${SV().tags.includes(t) ? 'on' : ''}" data-sv="tag" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>
      ${list.map(subvItem).join('') || '<p class="meta" style="padding:16px 4px">Trenutno nema otvorenih poziva za izabrane oblasti. Javiću ti čim se pojavi novi.</p>'}
      <p class="nut-src">Izvori: ${esc(SUBV.src)}. Ažurirano ${esc(hAgo(SUBV.updated))}. Rok je pročitan iz teksta objave – uvek proveri zvanični tekst poziva.</p>
      <div class="foot"><button class="btn" data-sv="close">Zatvori</button></div></div>`;
  };
  const mount = () => $('#svWrap').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sv]'); if (!b) return;
    const a = b.dataset.sv;
    if (a === 'close') { SV().seen = SUBV.items.reduce((m, x) => (x.first_seen > m ? x.first_seen : m), SV().seen || ''); save(false); closeSheet(); return render(); }
    if (a === 'open') return openExternal(b.dataset.u);
    if (a === 'v') view = b.dataset.v;
    if (a === 'tag') { const t = b.dataset.t, s = new Set(SV().tags); s.has(t) ? s.delete(t) : s.add(t); SV().tags = [...s]; save(false); subvConfigureNative(); haptic(); }
    if (a === 'rem') {
      const x = SUBV.items.find((i) => i.id === b.dataset.id), at = new Date(x.deadline + 'T09:00');
      at.setDate(at.getDate() - Math.min(3, Math.max(0, daysTo(x.deadline) - 1)));
      S.reminders.push({ id: uid(), title: `🌾 Rok: ${x.title.slice(0, 80)}`, at: toLocal(at), repeat: '', before: 0, note: `Rok za prijavu ${dmy(x.deadline)}\n${x.url}` });
      save(); ensurePermission(); toast(`Podsetnik: ${fmtWhen(at)}`); return;
    }
    $('#sheet').innerHTML = draw(); mount();
  });
  openSheet(draw(), mount);
}
// obaveštenja o novim objavama: Android pozadinski posao (EnvWorker), web dok je aplikacija otvorena
function subvConfigureNative() {
  if (typeof Geo === 'undefined' || !Geo || !Geo.subvConfigure) return;
  Geo.subvConfigure({ url: SUBV_URL, on: !!SV().on, tags: SV().tags.join(',') }).catch(() => {});
}
function subvCheckWeb() {
  if (IS_NATIVE || !SUBV || !SV().on) return;
  const last = SV().notifiedSeen || SV().seen || new Date().toISOString();
  const fresh = SUBV.items.filter((x) => x.first_seen > last && mineSubv(x) && x.kind !== 'vest');
  if (fresh.length) showWebNotification({ key: 'subv', title: fresh.length === 1 ? `🌾 ${fresh[0].title}` : `🌾 ${fresh.length} nove objave o subvencijama`, body: fresh.map((x) => x.title).slice(0, 3).join('\n'), tab: 'danas' });
  SV().notifiedSeen = SUBV.items.reduce((m, x) => (x.first_seen > m ? x.first_seen : m), last); save(false);
}
function refreshSubvHome() {
  if (!SV().on) return;
  loadSubv().then(() => { subvCheckWeb(); const t = $('#subvTile'); if (t && tab === 'danas' && $('#sheetBg').hidden) t.outerHTML = subvTileHtml().replace('<button', '<button id="subvTile"'); }).catch(() => {});
}
function subvSettingsCard() {
  return `<h2>Subvencije za poljoprivrednike</h2><div class="card">
    <label class="switch" style="margin-top:0"><input type="checkbox" id="subvOn" ${SV().on ? 'checked' : ''}> Prati javne pozive, konkurse i isplate</label>
    <p>Aplikacija na svaka 3 sata proverava Upravu za agrarna plaćanja, Pokrajinski sekretarijat za poljoprivredu i Grad Novi Sad i javi ti kad se pojavi nov poziv. Rokovi se mogu dodati u podsetnike.</p>
    ${SV().on ? '<button class="btn small" data-act="subv-open">🌾 Otvori pozive i izaberi oblasti</button>' : ''}</div>`;
}
document.addEventListener('DOMContentLoaded', () => { subvConfigureNative(); setInterval(() => tab === 'danas' && refreshSubvHome(), 30 * 60e3); });
document.addEventListener('change', (e) => {
  if (e.target.id === 'subvOn') { SV().on = e.target.checked; if (SV().on && !SV().seen) SV().seen = new Date().toISOString(); save(false); subvConfigureNative(); render(); if (SV().on) toast('Pratim subvencije 🌾 – kartica je na ekranu Danas'); }
});
