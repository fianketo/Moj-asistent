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
function productCard(p, linked) {
  const ps = Object.entries(p[5]).sort((a, b) => pNow(a[1]) - pNow(b[1]));
  const min = pNow(ps[0][1]);
  return `<div class="pr-card ${linked ? 'on' : ''}" data-pk="${esc(p.k)}">
    <div class="pr-top"><b>${esc(p[0])}</b>${p[1] && !/nije defin|^ostalo$|^brend$/i.test(p[1]) ? `<small>${esc(p[1])}</small>` : ''}</div>
    <div class="pr-chips">${ps.map(([c, v]) => `<span class="${pNow(v) === min ? 'min' : ''} ${v[1] ? 'sale' : ''}">${esc(chainName(c))} <b>${fmtDin(pNow(v))}</b>${v[1] ? `<i>akcija${v[2] ? ' do ' + esc(v[2]) : ''}</i>` : ''}</span>`).join('')}</div>
    <button class="btn small ${linked ? 'ok' : 'primary'}" data-pr="pick">${linked ? '✓ Izabrano' : 'Ovo kupujem'}</button></div>`;
}
const priceNote = () => `<p class="nut-src">Izvor: zvanični cenovnici trgovaca (data.gov.rs), cene od ${PR ? esc(PR.date.split('-').reverse().join('.')) : '–'}. Cene su za ceo lanac; u pojedinoj prodavnici mogu malo da se razlikuju.</p>`;

// cene za jednu stavku: pretraga + izbor tačnog proizvoda
async function priceSheet(item, back) {
  openSheet('<div class="pr-wrap"><h3>💰 Cene u prodavnicama</h3><p class="meta">Učitavam cene…</p></div>');
  try { await loadPrices(); } catch (e) { return openSheet(`<div class="pr-wrap"><h3>💰 Cene</h3><p>Cene trenutno nisu dostupne (${esc(e.message)}). Proveri internet i pokušaj ponovo.</p><div class="foot"><button class="btn" onclick="closeSheet()">Zatvori</button></div></div>`); }
  let q = item.pq || item.name;
  const draw = () => {
    const linked = item.pk && PR.byKey.get(item.pk);
    const res = searchProducts(q).filter((p) => !linked || p.k !== linked.k);
    return `<div class="pr-wrap" id="prWrap"><h3>💰 ${esc(item.name)}</h3>
      <input class="input" id="prQ" value="${esc(q)}" placeholder="🔎 Npr. mleko 2,8% 1l" autocomplete="off" autocorrect="off" spellcheck="false">
      <p class="meta" style="margin:6px 2px">Izaberi tačan proizvod koji kupuješ – aplikacija će ga zapamtiti i porediti cene po lancima.</p>
      ${linked ? `<div class="grp-h">Izabrano</div>${productCard(linked, true)}<button class="linkbtn" data-pr="unlink">Ukloni izbor</button>` : ''}
      <div class="grp-h">${res.length ? `Rezultati (${res.length}${res.length === 40 ? '+' : ''})` : 'Nema rezultata – probaj kraći naziv'}</div>
      ${res.map((p) => productCard(p, false)).join('')}
      ${priceNote()}
      <div class="foot">${back ? '<button class="btn" data-pr="back">← Nazad</button>' : ''}<button class="btn" data-pr="close">Zatvori</button></div></div>`;
  };
  const mount = () => {
    const inp = $('#prQ');
    inp.addEventListener('input', () => { q = inp.value; clearTimeout(mount.t); mount.t = setTimeout(() => { const pos = inp.selectionStart; $('#sheet').innerHTML = draw(); mount(); const n = $('#prQ'); n.focus(); n.setSelectionRange(pos, pos); }, 250); });
    $('#prWrap').addEventListener('click', (e) => {
      const b = e.target.closest('[data-pr]'); if (!b) return;
      const a = b.dataset.pr;
      if (a === 'close') { closeSheet(); return render(); }
      if (a === 'back') return back();
      if (a === 'unlink') { delete item.pk; delete item.pn; save(false); }
      if (a === 'pick') { const p = PR.byKey.get(b.closest('[data-pk]').dataset.pk); item.pk = p.k; item.pn = p[0]; item.pq = q; save(false); haptic(); toast('Zapamćeno ✓'); if (back) return back(); }
      $('#sheet').innerHTML = draw(); mount();
    });
  };
  openSheet(draw(), mount);
}

// poređenje cele liste po lancima
async function compareSheet() {
  openSheet('<div class="pr-wrap"><h3>💰 Gde je najjeftinije?</h3><p class="meta">Učitavam cene…</p></div>');
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
    return `<div class="pr-wrap" id="cmpWrap"><h3>💰 Gde je najjeftinije?</h3>
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
