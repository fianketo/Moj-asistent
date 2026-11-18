/* Cene iz zvaničnih cenovnika trgovaca (data.gov.rs) – preuzima ih GitHub Actions svako jutro (grana cene-data).
 * Stavka na listi se jednom poveže sa tačnim proizvodom (item.pk), pa aplikacija poredi cene po lancima. */
'use strict';
const PRICE_URL = 'https://raw.githubusercontent.com/fianketo/Moj-asistent/cene-data/cene.json';
const PRICE_TTL = 10 * 3600e3;
let PR = null, prLoading = null;

async function loadPrices(force = false) {
  if (PR && !force) return PR;
  if (prLoading) return prLoading;
  prLoading = (async () => {
    let data = null, fresh = false;
    let cache = null; try { cache = await caches.open('asistent-cene'); } catch { /* nema Cache API */ }
    let at = 0; try { at = +localStorage.getItem('asistent.cene.at') || 0; } catch { /* */ }
    if (!force && cache && Date.now() - at < PRICE_TTL) { const r = await cache.match(PRICE_URL); if (r) data = await r.json().catch(() => null); }
    if (!data) {
      try {
        const r = await fetch(PRICE_URL, { cache: 'no-cache' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        if (cache) await cache.put(PRICE_URL, r.clone());
        data = await r.json(); fresh = true;
        try { localStorage.setItem('asistent.cene.at', String(Date.now())); } catch { /* */ }
      } catch (e) { // bez mreže – stari podaci iz keša
        if (cache) { const r = await cache.match(PRICE_URL); if (r) data = await r.json().catch(() => null); }
        if (!data) throw e;
      }
    }
    // indeks: ključ proizvoda (barkod ili naziv) i pretraga po rečima
    const byKey = new Map();
    for (const p of data.p) { p.k = p[3] || fold(p[0] + '|' + p[1]); p.f = fold(p[0] + ' ' + p[1]); byKey.set(p.k, p); }
    data.byKey = byKey; data.fresh = fresh;
    PR = data; return data;
  })().finally(() => { prLoading = null; });
  return prLoading;
}
const chainName = (c) => (PR && PR.chains[c]) || c;
const fmtDin = (v) => (v >= 1000 ? fmtNum(Math.round(v)) : fmtNum(Math.round(v * 100) / 100)) + ' din';
// važeća cena u lancu: akcijska ako postoji
const pNow = (v) => (v[1] && v[1] < v[0] ? v[1] : v[0]);
function cheapest(p) {
  let best = null;
  for (const [c, v] of Object.entries(p[5])) if (!best || pNow(v) < pNow(best[1])) best = [c, v];
  return best;
}
// pretraga: sve reči upita moraju biti u nazivu; prednost: naziv počinje upitom, proizvod u više lanaca, kraći naziv
function searchProducts(q, n = 40) {
  const words = fold(q).split(/[^a-z0-9%]+/).filter((w) => w.length > 1);
  if (!words.length || !PR) return [];
  const out = [];
  for (const p of PR.p) {
    if (!words.every((w) => p.f.includes(w))) continue;
    const starts = p.f.startsWith(words[0]) ? 3 : new RegExp('\\b' + words[0]).test(p.f) ? 1 : 0;
    out.push([starts * 10 + Math.min(Object.keys(p[5]).length, 6) * 2 - p[0].length / 25, p]);
  }
  return out.sort((a, b) => b[0] - a[0]).slice(0, n).map((x) => x[1]);
}
function productCard(p, linked, pickLbl = 'Ovo kupujem', unit = false) {
  const ps = Object.entries(p[5]).sort((a, b) => pNow(a[1]) - pNow(b[1]));
  const min = pNow(ps[0][1]);
  return `<div class="pr-card ${linked ? 'on' : ''}" data-pk="${esc(p.k)}">
    <div class="pr-top"><b>${esc(p[0])}</b>${p[1] && !/nije defin|^ostalo$|^brend$/i.test(p[1]) ? `<small>${esc(p[1])}</small>` : ''}</div>
    <div class="pr-chips">${ps.map(([c, v]) => `<span class="${pNow(v) === min ? 'min' : ''} ${v[1] ? 'sale' : ''}">${esc(chainName(c))} <b>${fmtDin(pNow(v))}</b>${unit && v[3] ? `<em>${fmtDin(v[3] * pNow(v) / v[0])}/${esc(p[4] || 'j.m.')}</em>` : ''}${v[1] ? `<i>akcija${v[2] ? ' do ' + esc(v[2]) : ''}</i>` : ''}</span>`).join('')}</div>
    <button class="btn small ${linked ? 'ok' : 'primary'}" data-pr="pick">${linked ? '✓ Izabrano' : esc(pickLbl)}</button></div>`;
}
const priceNote = () => `<p class="nut-src">Izvor: zvanični cenovnici trgovaca (data.gov.rs), cene od ${PR ? esc(PR.date.split('-').reverse().join('.')) : '–'}. Cene su za ceo lanac; u pojedinoj prodavnici mogu malo da se razlikuju.</p>`;

// ---- osobine iz naziva: % masti, pakovanje, proizvođač (za filtere „2,8%“, „1 l“, „Imlek“)
function facetsOf(p) {
  if (p.fx) return p.fx;
  const n = p[0].toLowerCase().replace(/(\d),(\d)/g, '$1.$2'), fx = [];
  const fat = n.match(/(\d+(?:\.\d+)?)\s*%/); if (fat) fx.push('f:' + fat[1].replace('.', ',') + '%');
  const sz = n.match(/(\d+(?:\.\d+)?)\s*(kg|gr|g|ml|lit|l)\b/);
  if (sz) { let v = +sz[1], u = sz[2].replace('gr', 'g').replace('lit', 'l');
    if (u === 'ml' && v >= 1000) { v /= 1000; u = 'l'; } if (u === 'g' && v >= 1000) { v /= 1000; u = 'kg'; }
    if (u === 'ml' && [250, 500, 750].includes(v) === false && v > 100) { /* ostavi ml */ }
    fx.push('s:' + fmtNum(v) + ' ' + u); }
  const b = (p[1] || '').trim(); if (b && !/nije defin|^ostalo$|^brend$|^pl$/i.test(b)) fx.push('b:' + b.toUpperCase());
  return (p.fx = fx);
}
const FX_LBL = { f: 'Masnoća', s: 'Pakovanje', b: 'Proizvođač' };
// pretraga sa filterima i sortiranjem po ceni
function findView(st) {
  const res = searchProducts(st.q, 400);
  const pool = res.filter((p) => [...st.sel].every((f) => facetsOf(p).includes(f)));
  // ponuđeni filteri iz trenutnih rezultata
  const cnt = new Map(); for (const p of pool) for (const f of facetsOf(p)) cnt.set(f, (cnt.get(f) || 0) + 1);
  const groups = { f: [], s: [], b: [] };
  for (const [f, n] of [...cnt].sort((a, b) => b[1] - a[1])) if (!st.sel.has(f) && n < pool.length) groups[f[0]].push([f, n]);
  const unitP = (p) => { const ch = cheapest(p); const v = ch[1]; return v[3] ? v[3] * (pNow(v) / v[0]) : pNow(v); };
  const sorted = pool.slice().sort((a, b) => (st.sort === 'unit' ? unitP(a) - unitP(b) : pNow(cheapest(a)[1]) - pNow(cheapest(b)[1])));
  const chips = `${[...st.sel].map((f) => `<button class="chip on" data-fx="${esc(f)}">${esc(f.slice(2))} ✕</button>`).join('')}`;
  const fx = Object.entries(groups).filter(([, a]) => a.length).map(([k, a]) => `<div class="fx-row"><small>${FX_LBL[k]}</small><div class="chips">${a.slice(0, k === 'b' ? 12 : 10).map(([f, n]) => `<button class="chip" data-fx="${esc(f)}">${esc(f.slice(2))} <span class="count">${n}</span></button>`).join('')}</div></div>`).join('');
  return `${st.sel.size ? `<div class="chips" style="flex-wrap:wrap">${chips}</div>` : ''}${st.q.trim().length > 1 ? fx : ''}
    ${pool.length ? `<div class="fx-sort"><span>${pool.length} proizvoda</span><span class="grow"></span>
      <button class="chip ${st.sort !== 'unit' ? 'on' : ''}" data-sort="price">Najniža cena</button><button class="chip ${st.sort === 'unit' ? 'on' : ''}" data-sort="unit">Po kg / l</button></div>` : st.q.trim().length > 1 ? '<p class="meta">Nema rezultata – probaj kraći naziv.</p>' : ''}
    ${sorted.slice(0, 30).map((p) => productCard(p, st.linked === p.k, st.pickLbl, st.sort === 'unit')).join('')}`;
}
// opšti prozor za pretragu: onPick(p) – šta se radi kad izabereš proizvod
async function findSheet({ title, q = '', hint, onPick, back, pickLbl, linkedKey }) {
  openSheet(`<div class="pr-wrap"><h3>${title}</h3><p class="meta">Učitavam cene…</p></div>`);
  try { await loadPrices(); } catch (e) { return openSheet(`<div class="pr-wrap"><h3>💰 Cene</h3><p>Cene trenutno nisu dostupne (${esc(e.message)}). Proveri internet i pokušaj ponovo.</p><div class="foot"><button class="btn" onclick="closeSheet()">Zatvori</button></div></div>`); }
  const st = { q, sel: new Set(), sort: 'price', pickLbl, linked: linkedKey };
  const draw = () => `<div class="pr-wrap" id="prWrap"><h3>${title}</h3>
      <input class="input" id="prQ" value="${esc(st.q)}" placeholder="🔎 npr. jogurt, mleko, kafa…" autocomplete="off" autocorrect="off" spellcheck="false">
      ${hint ? `<p class="meta" style="margin:6px 2px">${hint}</p>` : ''}
      <div id="prRes">${findView(st)}</div>${priceNote()}
      <div class="foot">${back ? '<button class="btn" data-pr="back">← Nazad</button>' : ''}<button class="btn" data-pr="close">Zatvori</button></div></div>`;
  const redraw = () => { $('#prRes').innerHTML = findView(st); };
  const mount = () => {
    const inp = $('#prQ');
    inp.addEventListener('input', () => { st.q = inp.value; st.sel.clear(); clearTimeout(mount.t); mount.t = setTimeout(redraw, 250); });
    $('#prWrap').addEventListener('click', (e) => {
      const f = e.target.closest('[data-fx]'); if (f) { const v = f.dataset.fx; st.sel.has(v) ? st.sel.delete(v) : st.sel.add(v); haptic(); return redraw(); }
      const so = e.target.closest('[data-sort]'); if (so) { st.sort = so.dataset.sort; return redraw(); }
      const b = e.target.closest('[data-pr]'); if (!b) return;
      if (b.dataset.pr === 'close') { closeSheet(); return render(); }
      if (b.dataset.pr === 'back') return back();
      if (b.dataset.pr === 'pick') { const p = PR.byKey.get(b.closest('[data-pk]').dataset.pk); haptic(); return onPick(p, st); }
    });
  };
  openSheet(draw(), mount);
}
// cene za jednu stavku sa liste: izbor tačnog proizvoda
function priceSheet(item, back) {
  return findSheet({ title: '💰 ' + esc(item.name), q: item.pq || item.name, linkedKey: item.pk, pickLbl: 'Ovo kupujem',
    hint: 'Suzi izbor (npr. masnoća 2,8%, pakovanje 1 l) i izaberi proizvod – aplikacija ga pamti i poredi cene po lancima.',
    back, onPick: (p, st) => { item.pk = p.k; item.pn = p[0]; item.pq = st.q; save(false); toast('Zapamćeno ✓ ' + p[0]); return back ? back() : (closeSheet(), render()); } });
}
// „Gde je najjeftinije?“ – slobodna pretraga, izbor dodaje proizvod na listu
function cheapestSheet(q = '') {
  return findSheet({ title: '🔎 Gde je najjeftinije?', q, pickLbl: '+ Na listu',
    hint: 'Ukucaj proizvod, pa izaberi osobine (npr. jogurt → 2,8% → 1 l) – prikazuje se od najjeftinijeg.',
    onPick: (p) => {
      const L = curList(), name = p[0].replace(/\s+/g, ' ');
      const it = addToList(name, 1, 'kom', true); if (it) { it.pk = p.k; it.pn = p[0]; }
      save(false); const ch = cheapest(p); toast(`Dodato: ${name} – najjeftinije ${fmtDin(pNow(ch[1]))} u ${chainName(ch[0])}`, 4000);
    } });
}

// poređenje cele liste po lancima
async function compareSheet() {
  openSheet('<div class="pr-wrap"><h3>💰 Cene za moju listu</h3><p class="meta">Učitavam cene…</p></div>');
  try { await loadPrices(); } catch (e) { return openSheet(`<div class="pr-wrap"><h3>💰 Cene</h3><p>Cene trenutno nisu dostupne (${esc(e.message)}).</p><div class="foot"><button class="btn" onclick="closeSheet()">Zatvori</button></div></div>`); }
  const draw = () => {
    const L = curList(), items = L.items.filter((i) => !i.done);
    const linked = items.map((i) => [i, i.pk && PR.byKey.get(i.pk)]).filter((x) => x[1]);
    // koliko pakovanja: 10 jaja i proizvod „JAJA 10/1“ = 1 pakovanje
    const mult = (i, p) => {
      if (!i.qty || !/^(kom|pak)$/.test(i.unit || 'kom')) return 1;
      if ((i.unit || 'kom') === 'pak') return i.qty;
      const m = p[0].match(/(\d+)\s*\/\s*1\b/) || p[0].match(/\b(\d+)\s*kom\b/i), pack = m ? +m[1] : 1;
      return pack > 1 ? Math.ceil(i.qty / pack) : i.qty;
    };
    const tot = Object.keys(PR.chains).map((c) => {
      let sum = 0, n = 0; for (const [i, p] of linked) { const v = p[5][c]; if (v) { sum += pNow(v) * mult(i, p); n++; } }
      return { c, sum, n };
    }).filter((t) => t.n).sort((a, b) => b.n - a.n || a.sum - b.sum);
    // „najjeftinija kombinacija“: svaki proizvod tamo gde je najjeftiniji
    let combo = 0; for (const [i, p] of linked) combo += pNow(cheapest(p)[1]) * mult(i, p);
    const best = tot[0];
    return `<div class="pr-wrap" id="cmpWrap"><h3>💰 Cene za moju listu</h3>
      <button class="btn block" data-c="find" style="margin-bottom:10px">🔎 Pronađi najjeftiniji proizvod…</button>
      <p class="meta" style="margin:0 2px 8px">Lista „${esc(L.name)}“: ${linked.length} od ${items.length} stavki ima izabran proizvod.</p>
      ${tot.length ? `<div class="cmp-list">${tot.map((t, k) => `<div class="cmp-row ${k === 0 ? 'best' : ''}"><span class="cmp-n">${k + 1}</span><b>${esc(chainName(t.c))}</b><span class="grow"></span><span class="meta">${t.n}/${linked.length}</span><b class="cmp-sum">${fmtDin(t.sum)}</b></div>`).join('')}</div>
        ${linked.length > 1 ? `<div class="banner" style="margin-top:10px"><span>🧠 Ako svaki proizvod kupiš tamo gde je najjeftiniji: <b>${fmtDin(combo)}</b>${best && best.n === linked.length && best.sum - combo >= 1 ? ` (ušteda ${fmtDin(best.sum - combo)} u odnosu na ${esc(chainName(best.c))})` : ''}</span></div>` : ''}` : '<p>Još nijedna stavka nema izabran proizvod.</p>'}
      <div class="grp-h">Stavke</div>
      <div class="grp">${items.map((i) => { const p = i.pk && PR.byKey.get(i.pk), ch = p && cheapest(p);
        return `<div class="item-row" data-ci="${i.id}"><span class="nm">${esc(i.name)}${p ? `<small class="meta" style="display:block">${esc(p[0])}</small>` : '<small class="meta" style="display:block;color:var(--accent)">Dodirni da izabereš proizvod ›</small>'}</span>
          ${ch ? `<span class="qty-pill">${fmtDin(pNow(ch[1]))} · ${esc(chainName(ch[0]))}</span>` : '<span class="meta">›</span>'}</div>`; }).join('')}</div>
      ${priceNote()}
      <div class="foot"><button class="btn" data-c="close">Zatvori</button></div></div>`;
  };
  const mount = () => $('#cmpWrap').addEventListener('click', (e) => {
    const r = e.target.closest('[data-ci]');
    if (r) { const it = curList().items.find((x) => x.id === r.dataset.ci); return priceSheet(it, () => { openSheet(draw(), mount); }); }
    if (e.target.closest('[data-c="close"]')) { closeSheet(); render(); }
    if (e.target.closest('[data-c="find"]')) cheapestSheet();
  });
  openSheet(draw(), mount);
}
// najniža cena izabranog proizvoda – za red na listi (samo ako su cene već učitane)
function itemPriceTag(i) {
  if (!i.pk || !PR) return '';
  const p = PR.byKey.get(i.pk); if (!p) return '';
  const ch = cheapest(p);
  return `<small class="it-price">od ${fmtDin(pNow(ch[1]))} · ${esc(chainName(ch[0]))}${ch[1][1] ? ' 🏷️' : ''}</small>`;
}
