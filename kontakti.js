/* Brzo biranje: omiljeni brojevi na ekranu „Danas“ – dodir zove, dugi pritisak nudi poruku, Viber, WhatsApp, izmenu. */
'use strict';
const DIAL_COLORS = ['#6750a4', '#b3261e', '#146c2e', '#a15c00', '#0061a4', '#7d2949', '#006a6a', '#5d5f00'];
const DL = () => (S.dial = S.dial || []);
const initials = (n) => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '☎';
const cleanNum = (n) => String(n || '').replace(/[^\d+*#]/g, '');
// za Viber/WhatsApp: međunarodni oblik (0641234567 → 381641234567)
const intlNum = (n) => { let x = cleanNum(n).replace(/^\+/, ''); if (x.startsWith('00')) x = x.slice(2); else if (x.startsWith('0')) x = '381' + x.slice(1); return x; };

function dialTileHtml() {
  const list = DL();
  if (!list.length) return `<button class="tile t-dial empty" data-home="dial-add"><small>📞 Brzo biranje</small><b class="t-title">Dodaj brojeve koje često zoveš</b><small class="t-foot">Jedan dodir – i već zvoni</small></button>`;
  return `<div class="tile t-dial" id="dialTile"><div class="rl-head"><small>📞 Brzo biranje</small><span class="grow"></span><button class="rl-add" data-home="dial-add" aria-label="Dodaj broj">+</button></div>
    <div class="dial-row">${list.map((c) => `<button class="dial" data-dial="${c.id}" aria-label="Pozovi ${esc(c.name)}"><span class="dial-av" style="--c:${c.color}">${c.emoji ? esc(c.emoji) : esc(initials(c.name))}</span><span class="dial-nm">${esc(c.name.split(' ')[0])}</span></button>`).join('')}</div>
    <small class="t-foot">Dodir – poziv · zadrži prst – poruka, Viber, WhatsApp, izmena</small></div>`;
}

async function callNumber(c) {
  haptic(15);
  if (IS_NATIVE && Geo && Geo.call) {
    try { const r = await Geo.call({ number: c.num }); if (!r.direct) toast('Dozvoli pozive da bi zvalo jednim dodirom', 3500); }
    catch { location.href = 'tel:' + cleanNum(c.num); }
  } else location.href = 'tel:' + cleanNum(c.num);
  c.used = (c.used || 0) + 1; save(false);
}
function dialMenu(c) {
  const n = cleanNum(c.num), i = intlNum(c.num);
  openSheet(`<div id="dmWrap"><div class="dm-head"><span class="dial-av big" style="--c:${c.color}">${c.emoji ? esc(c.emoji) : esc(initials(c.name))}</span><div><h3>${esc(c.name)}</h3><p class="meta" style="margin:0">${esc(c.num)}</p></div></div>
    <div class="dm-grid">
      <button class="dm-b call" data-dm="call"><span>📞</span>Pozovi</button>
      <button class="dm-b" data-dm="sms"><span>💬</span>SMS</button>
      <button class="dm-b" data-dm="viber"><span>🟣</span>Viber</button>
      <button class="dm-b" data-dm="wa"><span>🟢</span>WhatsApp</button>
    </div>
    <div class="foot"><button class="btn" data-dm="edit">✏️ Izmeni</button><button class="btn" data-dm="close">Zatvori</button></div></div>`, () => {
    $('#dmWrap').addEventListener('click', (e) => {
      const b = e.target.closest('[data-dm]'); if (!b) return;
      const a = b.dataset.dm;
      if (a === 'close') return closeSheet();
      if (a === 'edit') return dialEdit(c);
      closeSheet();
      if (a === 'call') return callNumber(c);
      if (a === 'sms') return openExternal(smsUrl(n, ''));
      if (a === 'viber') return openExternal('viber://chat?number=%2B' + i);
      if (a === 'wa') return openExternal('https://wa.me/' + i);
    });
  });
}
function dialEdit(c) {
  const isNew = !c;
  const d = c ? { ...c } : { id: uid(), name: '', num: '', color: DIAL_COLORS[DL().length % DIAL_COLORS.length], emoji: '' };
  const draw = () => `<div id="deWrap"><h3>${isNew ? 'Novi broj za brzo biranje' : 'Izmeni broj'}</h3>
    ${IS_NATIVE ? '<button class="btn block" data-de="pick" style="margin:6px 0 4px">📒 Izaberi iz imenika</button>' : ''}
    <label class="field">Ime<input class="input" id="deName" value="${esc(d.name)}" placeholder="npr. Mama" autocomplete="off"></label>
    <label class="field">Broj telefona<input class="input" id="deNum" value="${esc(d.num)}" placeholder="npr. 064 123 4567" inputmode="tel" autocomplete="off"></label>
    <div class="field">Boja i znak</div>
    <div class="chips" style="flex-wrap:wrap">${DIAL_COLORS.map((col) => `<button class="dial-col ${col === d.color ? 'on' : ''}" data-de="col" data-v="${col}" style="--c:${col}" aria-label="boja"></button>`).join('')}</div>
    <div class="chips" style="flex-wrap:wrap">${['', '👩', '👨', '👵', '👴', '❤️', '👶', '🏠', '🏥', '🚕', '🔧', '💼', '⭐'].map((em) => `<button class="chip ${em === d.emoji ? 'on' : ''}" data-de="em" data-v="${em}">${em || 'Inicijali'}</button>`).join('')}</div>
    ${!isNew ? `<div class="row" style="margin-top:12px"><button class="btn small" data-de="left">◀ Pomeri levo</button><button class="btn small" data-de="right">Pomeri desno ▶</button></div>` : ''}
    <div class="foot">${!isNew ? '<button class="btn danger" data-de="del">🗑 Obriši</button>' : ''}<button class="btn" data-de="close">Otkaži</button><button class="btn primary" data-de="save">Sačuvaj</button></div></div>`;
  const read = () => { d.name = $('#deName').value.trim(); d.num = $('#deNum').value.trim(); };
  const mount = () => $('#deWrap').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-de]'); if (!b) return;
    const a = b.dataset.de; read();
    if (a === 'close') return closeSheet();
    if (a === 'pick') {
      try { const r = await Geo.pickContact(); d.name = d.name || r.name || ''; d.num = r.number || d.num; } catch (err) { if (!/otkazano/.test(err.message || '')) toast('Imenik: ' + (err.message || 'greška')); }
    }
    if (a === 'col') d.color = b.dataset.v;
    if (a === 'em') d.emoji = b.dataset.v;
    if (a === 'left' || a === 'right') {
      const L = DL(), k = L.findIndex((x) => x.id === d.id), j = k + (a === 'left' ? -1 : 1);
      if (k >= 0 && j >= 0 && j < L.length) { [L[k], L[j]] = [L[j], L[k]]; save(false); toast('Pomereno'); }
    }
    if (a === 'del') {
      if (!confirm(`Obrisati „${d.name}“ iz brzog biranja?`)) return;
      S.dial = DL().filter((x) => x.id !== d.id); save(false); closeSheet(); return render();
    }
    if (a === 'save') {
      if (!d.name) { $('#deName').focus(); return toast('Upiši ime'); }
      if (cleanNum(d.num).replace(/\D/g, '').length < 3) { $('#deNum').focus(); return toast('Upiši broj telefona'); }
      const L = DL(), k = L.findIndex((x) => x.id === d.id);
      if (k >= 0) L[k] = { ...L[k], ...d }; else L.push(d);
      save(false); closeSheet(); toast(isNew ? `Dodato: ${d.name} 📞` : 'Sačuvano'); return render();
    }
    $('#sheet').innerHTML = draw(); mount();
  });
  openSheet(draw(), mount);
}

// dodir = poziv, zadržan prst (0,5 s) = meni
(function () {
  let t = null, fired = false, startX = 0, startY = 0, swallow = 0;
  document.addEventListener('touchstart', (e) => {
    const b = e.target.closest('[data-dial]'); if (!b) return;
    fired = false; startX = e.touches[0].clientX; startY = e.touches[0].clientY;
    b.classList.add('press');
    t = setTimeout(() => { fired = true; swallow = Date.now() + 800; b.classList.remove('press'); haptic(25); const c = DL().find((x) => x.id === b.dataset.dial); if (c) dialMenu(c); }, 500);
  }, { passive: true });
  document.addEventListener('touchmove', (e) => { if (t && (Math.abs(e.touches[0].clientX - startX) > 10 || Math.abs(e.touches[0].clientY - startY) > 10)) { clearTimeout(t); t = null; document.querySelectorAll('.dial.press').forEach((x) => x.classList.remove('press')); } }, { passive: true });
  document.addEventListener('touchend', () => { clearTimeout(t); t = null; document.querySelectorAll('.dial.press').forEach((x) => x.classList.remove('press')); }, { passive: true });
  document.addEventListener('contextmenu', (e) => { const b = e.target.closest('[data-dial]'); if (!b) return; e.preventDefault(); if (!fired) { fired = true; const c = DL().find((x) => x.id === b.dataset.dial); if (c) dialMenu(c); setTimeout(() => { fired = false; }, 400); } });
  document.addEventListener('click', (e) => {
    // dodir koji telefon pošalje kad se prst podigne posle dugog pritiska ne sme da zatvori meni
    if (Date.now() < swallow) { swallow = 0; fired = false; e.stopPropagation(); e.preventDefault(); return; }
    const b = e.target.closest('[data-dial]'); if (!b) return;
    e.stopPropagation();
    if (fired) { fired = false; return; } // posle dugog pritiska ne zovi
    const c = DL().find((x) => x.id === b.dataset.dial); if (c) callNumber(c);
  }, true);
})();
