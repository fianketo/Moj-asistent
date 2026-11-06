/* Pokreti prstom:
 *  – prevlačenje levo/desno: sledeći/prethodni tab (segmentni tabovi na ekranu ili u prozoru; bez njih – donji meni)
 *  – povlačenje prozora nadole: zatvaranje */
'use strict';
(function () {
  const MAIN_TABS = ['danas', 'podsetnici', 'kupovina', 'parking', 'zdravlje'];
  // element koji se sam skroluje vodoravno (čipovi, trake) – tu prevlačenje ostaje njegovo
  const hScroller = (el, stop) => {
    for (; el && el !== stop; el = el.parentElement) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2) return true;
      if (el.matches && el.matches('input, textarea, select, .stepper, [data-noswipe]')) return true;
    }
    return false;
  };
  const visible = (el) => el && el.offsetParent !== null;

  // ---------------- PREGLED SUSEDNOG TABA (vidi se dok prevlačiš)
  // ekran se iscrta „van ekrana“: privremeno zameni #view praznim elementom, pozovi crtanje, uzmi HTML
  function offscreen(fn) {
    const real = document.getElementById('view'), tmp = document.createElement('main');
    real.id = 'view-real'; tmp.id = 'view'; tmp.style.cssText = 'position:absolute;left:-200vw;top:0;visibility:hidden';
    document.body.appendChild(tmp); window.PREVIEW = true;
    let html = '';
    try { fn(); html = tmp.innerHTML; } catch (e) { console.warn('pregled', e); } finally { window.PREVIEW = false; tmp.remove(); real.id = 'view'; }
    return html;
  }
  const stripSeg = (html) => { const d = document.createElement('div'); d.innerHTML = html; const s = d.querySelector('.seg'); if (s) s.remove(); d.querySelectorAll('.shopbar').forEach((x) => x.remove()); return d.innerHTML; };
  const partsHtml = (els) => els.map((e) => e.outerHTML).join('');
  const SKELETON = '<div class="sk"><i></i><i></i><i></i></div>';

  // šta se menja prevlačenjem: tabovi u prozoru / na ekranu, ili ekrani donjeg menija
  function target(inSheet) {
    const root = document.getElementById(inSheet ? 'sheet' : 'view');
    const seg = [...root.querySelectorAll('.seg')].find(visible);
    if (seg) {
      const btns = [...seg.querySelectorAll('button')].filter(visible), i = btns.findIndex((b) => b.classList.contains('on'));
      return { root, seg, kind: inSheet ? 'sheet' : 'vseg', has: (d) => !!btns[i + d],
        go: (d) => { // dugmad se ponovo traže – prozor je možda iscrtan iznova dok se pravio pregled
          const now = [...([...root.querySelectorAll('.seg')].find(visible) || seg).querySelectorAll('button')].filter(visible);
          (now[i + d] || btns[i + d]).click(); if (!inSheet) window.scrollTo(0, 0);
        },
        preview: (d) => {
          const n = btns[i + d]; if (!n) return '';
          if (!inSheet && n.dataset.h === 'sub' && typeof hsub !== 'undefined') { // Zdravlje: Danas/Recepti/Ishrana/Treninzi
            const save = hsub; hsub = n.dataset.v;
            const h = offscreen(() => render()); hsub = save; return stripSeg(h);
          }
          if (inSheet) return SHEET_CACHE.get(n.textContent) || '';
          return SKELETON;
        } };
    }
    if (inSheet) return null;
    const i = MAIN_TABS.indexOf(tab);
    if (i < 0) return null;
    return { root, kind: 'main', has: (d) => !!MAIN_TABS[i + d], go: (d) => setTab(MAIN_TABS[i + d]),
      preview: (d) => { const n = MAIN_TABS[i + d]; if (!n) return ''; const save = tab; tab = n; const h = offscreen(() => render()); tab = save; return stripSeg(n === 'zdravlje' ? h : h); } };
  }
  // prozori: izgled susednih tabova se pripremi unapred, dok prst ne dodiruje ekran
  // (privremeni klik na susedni tab i nazad u istom koraku – na ekranu se ništa ne vidi)
  const SHEET_CACHE = new Map(); let probing = false, probeT = 0;
  function probeSheet() {
    const sheet = document.getElementById('sheet');
    if (H.on || H.busy || drag.active || document.getElementById('sheetBg').hidden) return;
    const seg = [...sheet.querySelectorAll('.seg')].find(visible); if (!seg) return;
    const btns = [...seg.querySelectorAll('button')].filter(visible), i = btns.findIndex((b) => b.classList.contains('on'));
    if (i < 0) return;
    probing = true; SHEET_CACHE.clear();
    const top = sheet.scrollTop, curTxt = btns[i].textContent;
    try {
      SHEET_CACHE.set(curTxt, partsHtml(parts(sheet)));
      for (const d of [-1, 1]) {
        const b = btns[i + d]; if (!b) continue;
        const txt = b.textContent;
        const nb = [...sheet.querySelectorAll('.seg button')].filter(visible).find((x) => x.textContent === txt); if (!nb) continue;
        nb.click(); SHEET_CACHE.set(txt, partsHtml(parts(sheet)));
        const back = [...sheet.querySelectorAll('.seg button')].filter(visible).find((x) => x.textContent === curTxt) || [...sheet.querySelectorAll('.seg button')].filter(visible)[i];
        if (back) back.click();
      }
    } catch (e) { console.warn('pregled prozora', e); }
    sheet.scrollTop = top; probing = false;
  }
  document.addEventListener('DOMContentLoaded', () => {
    new MutationObserver(() => { if (probing) return; clearTimeout(probeT); probeT = setTimeout(probeSheet, 350); })
      .observe(document.getElementById('sheet'), { childList: true });
  });
  // delovi koji se pomeraju (naslov, tabovi, dugmad na dnu i fiksirane trake stoje)
  const parts = (root) => {
    if (root.id === 'sheet' && root.children.length === 1) root = root.firstElementChild;
    return [...root.children].filter((c) => { const p = getComputedStyle(c).position; return p !== 'fixed' && p !== 'sticky' && !c.matches('h3, .seg, .foot, .sheet-h, .sk-layer'); });
  };
  // sloj sa pregledom susednog taba, poravnat sa sadržajem
  function makeLayer(tg, html, d) {
    const L = document.createElement('div'); L.className = 'sk-layer';
    if (tg.kind === 'sheet') {
      const wrap = tg.root.firstElementChild, ref = tg.seg || wrap.firstElementChild, wr = wrap.getBoundingClientRect(), rr = ref.getBoundingClientRect();
      L.style.cssText = `position:absolute;left:0;right:0;top:${rr.bottom - wr.top + 10}px;`;
      L.innerHTML = html; wrap.style.position = 'relative'; wrap.appendChild(L);
    } else {
      const hdr = document.querySelector('header').getBoundingClientRect(), segB = tg.seg ? tg.seg.getBoundingClientRect().bottom + 8 : hdr.bottom;
      const nav = document.getElementById('nav').getBoundingClientRect();
      L.style.cssText = `position:fixed;left:0;right:0;top:${tg.kind === 'vseg' ? segB : hdr.bottom}px;bottom:${innerHeight - nav.top}px;overflow:hidden;z-index:3;background:var(--bg);`;
      L.innerHTML = `<main class="sk-main">${html}</main>`; document.body.appendChild(L);
    }
    L.dataset.d = d;
    return L;
  }
  const setX = (els, x, o) => els.forEach((el) => { el.style.transform = x ? `translate3d(${x}px,0,0)` : ''; if (o !== undefined) el.style.opacity = o; el.style.willChange = x ? 'transform' : ''; });
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tween = (ms, step) => new Promise((res) => { // glatka animacija u ritmu ekrana
    const t0 = performance.now(), ease = (t) => 1 - Math.pow(1 - t, 3);
    const f = (now) => { const t = Math.min(1, (now - t0) / ms); step(ease(t)); t < 1 ? requestAnimationFrame(f) : res(); };
    requestAnimationFrame(f);
  });

  // ---------------- vodoravno prevlačenje
  const H = { on: false };
  document.addEventListener('touchstart', (e) => {
    H.on = false; H.lock = null;
    if (e.touches.length !== 1 || H.busy) return;
    const t = e.touches[0], inSheet = !document.getElementById('sheetBg').hidden, sheet = document.getElementById('sheet');
    if (inSheet && !sheet.contains(e.target)) return;
    if (t.clientX < 18 || t.clientX > innerWidth - 18) return; // ivice ekrana: sistemski gest „nazad“
    if (hScroller(e.target, inSheet ? sheet : document.body)) return;
    const tg = target(inSheet); if (!tg) return;
    Object.assign(H, { on: true, inSheet, tg, x0: t.clientX, y0: t.clientY, dx: 0, els: null, layer: null, ld: 0, hist: [] });
  }, { passive: true });
  function ensureLayer(d) {
    if (H.ld === d) return;
    if (H.layer) { H.layer.remove(); H.layer = null; H.ld = 0; }
    if (!H.tg.has(d)) return;
    const html = H.tg.preview(d);
    if (H.inSheet) H.els = parts(H.tg.root); // prozor je možda ponovo iscrtan
    H.layer = makeLayer(H.tg, html || SKELETON, d); H.ld = d;
  }
  function place(dx) {
    const W = H.W, d = dx < 0 ? 1 : -1, hasN = H.tg.has(d);
    const x = hasN ? dx : dx * 0.28; // guma na kraju
    setX(H.els, x);
    H.els.forEach((el) => { el.style.opacity = hasN ? String(1 - Math.min(0.25, Math.abs(x) / W * 0.3)) : ''; });
    if (H.layer) H.layer.style.transform = `translate3d(${x + d * W}px,0,0)`;
    return x;
  }
  document.addEventListener('touchmove', (e) => {
    if (!H.on || drag.active) return;
    const t = e.touches[0], dx = t.clientX - H.x0, dy = t.clientY - H.y0;
    if (!H.lock) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      H.lock = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'x' : 'y';
      if (H.lock === 'y') { H.on = false; return; }
      H.els = parts(H.tg.root); H.W = H.inSheet ? H.tg.root.clientWidth : innerWidth;
    }
    if (e.cancelable) e.preventDefault();
    const d = dx < 0 ? 1 : -1;
    ensureLayer(d);
    H.dx = place(dx);
    H.hist.push([performance.now(), dx]); if (H.hist.length > 6) H.hist.shift();
  }, { passive: false });
  const hEnd = async () => {
    if (!H.on || H.lock !== 'x') { H.on = false; return; }
    H.on = false; H.busy = true;
    const W = H.W, dx = H.dx, d = dx < 0 ? 1 : -1, els = H.els, layer = H.layer;
    const h = H.hist, v = h.length > 1 ? (h[h.length - 1][1] - h[0][1]) / Math.max(1, h[h.length - 1][0] - h[0][0]) : 0; // px/ms
    const commit = H.tg.has(d) && layer && (Math.abs(dx) > W * 0.33 || (Math.abs(v) > 0.35 && Math.sign(v) === Math.sign(dx)));
    const to = commit ? -d * W : 0, from = dx;
    // trajanje prema preostalom putu i brzini prsta
    const ms = reduce() ? 1 : Math.max(160, Math.min(380, Math.abs(to - from) / Math.max(0.9, Math.abs(v) * 1.2)));
    await tween(ms, (k) => {
      const x = from + (to - from) * k;
      setX(els, x); els.forEach((el) => { el.style.opacity = String(1 - Math.min(0.25, Math.abs(x) / W * 0.3)); });
      if (layer) layer.style.transform = `translate3d(${x + d * W}px,0,0)`;
    });
    if (commit) {
      try { navigator.vibrate && navigator.vibrate(6); } catch { /* */ }
      H.tg.go(d); // pravi ekran (izgleda isto kao pregled)
    } else { setX(els, 0, ''); }
    if (layer) layer.remove();
    H.layer = null; H.ld = 0; H.busy = false;
  };
  document.addEventListener('touchend', hEnd, { passive: true });
  document.addEventListener('touchcancel', hEnd, { passive: true });

  // ---------------- povlačenje prozora nadole = zatvaranje
  const drag = { active: false, y0: 0, t0: 0, dy: 0 };
  document.addEventListener('DOMContentLoaded', () => {
    const sheet = document.getElementById('sheet'), bg = document.getElementById('sheetBg');
    sheet.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      const r = sheet.getBoundingClientRect(), y = e.touches[0].clientY;
      // samo kad je prozor skrolovan do vrha, ili kad se uhvati gornja ivica (ručka)
      drag.can = (sheet.scrollTop <= 0 || y - r.top < 44) && !sheet.querySelector('#pl, [data-noclose]'); // trening u toku se ne zatvara slučajno
      drag.active = false; drag.y0 = y; drag.t0 = Date.now(); drag.dy = 0;
    }, { passive: true });
    sheet.addEventListener('touchmove', (e) => {
      if (!drag.can) return;
      const dy = e.touches[0].clientY - drag.y0;
      if (H.lock === 'x') return; // već prevlačiš vodoravno
      if (!drag.active) {
        if (dy < 8) { if (dy < -4) drag.can = false; return; } // gore = obično skrolovanje
        if (hScroller(e.target, sheet) && Math.abs(dy) < 20) return;
        drag.active = true; sheet.style.transition = 'none';
      }
      drag.dy = Math.max(0, dy);
      sheet.style.transform = `translateY(${drag.dy}px)`;
      bg.style.backgroundColor = `rgba(20,18,24,${Math.max(0.05, 0.45 * (1 - drag.dy / 400))})`;
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
    const end = () => {
      if (!drag.active) return;
      const v = drag.dy / Math.max(1, Date.now() - drag.t0); // px/ms
      sheet.style.transition = 'transform .22s cubic-bezier(.2,.8,.2,1)';
      if (drag.dy > Math.min(160, sheet.offsetHeight * 0.3) || (v > 0.6 && drag.dy > 40)) {
        sheet.style.transform = 'translateY(100%)';
        try { navigator.vibrate && navigator.vibrate(8); } catch { /* */ }
        setTimeout(() => {
          sheet.style.transform = ''; sheet.style.transition = ''; bg.style.backgroundColor = '';
          // isto kao dugme Zatvori u prozoru (čuva izmene), inače obično zatvaranje
          const btn = [...sheet.querySelectorAll('.foot .btn, [data-r="close"], [data-g="x"]')].find((b) => /Zatvori|Gotovo|U redu|✕/.test(b.textContent));
          if (btn) btn.click(); else closeSheet();
          if (!bg.hidden) closeSheet();
        }, 200);
      } else {
        sheet.style.transform = ''; bg.style.backgroundColor = '';
        setTimeout(() => { sheet.style.transition = ''; }, 230);
      }
      setTimeout(() => { drag.active = false; }, 50);
    };
    sheet.addEventListener('touchend', end); sheet.addEventListener('touchcancel', end);
  });
})();
