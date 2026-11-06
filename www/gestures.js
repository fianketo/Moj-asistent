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

  // šta se menja prevlačenjem: tabovi u prozoru/na ekranu, ili ekrani donjeg menija
  function target(inSheet) {
    const root = document.getElementById(inSheet ? 'sheet' : 'view');
    const seg = [...root.querySelectorAll('.seg')].find(visible);
    if (seg) {
      const btns = [...seg.querySelectorAll('button')].filter(visible), i = btns.findIndex((b) => b.classList.contains('on'));
      return { root, go: (dir) => { const n = btns[i + dir]; if (!n) return false; n.click(); return true; }, has: (dir) => !!btns[i + dir] };
    }
    if (inSheet) return null;
    const i = MAIN_TABS.indexOf(tab);
    if (i < 0) return null;
    return { root, go: (dir) => { const n = MAIN_TABS[i + dir]; if (!n) return false; setTab(n); return true; }, has: (dir) => !!MAIN_TABS[i + dir] };
  }
  // delovi koji se pomeraju (fiksirani elementi – traka za unos u Kupovini – ostaju na mestu)
  const parts = (root) => {
    // u prozoru: pomera se sadržaj ispod naslova i tabova (naslov, tabovi i dugmad na dnu stoje)
    if (root.id === 'sheet' && root.children.length === 1) root = root.firstElementChild;
    return [...root.children].filter((c) => { const p = getComputedStyle(c).position; return p !== 'fixed' && p !== 'sticky' && !c.matches('h3, .seg, .foot, .sheet-h'); });
  };
  const setX = (els, x, o) => els.forEach((el) => { el.style.transform = x ? `translate3d(${x}px,0,0)` : ''; el.style.opacity = o == null ? '' : o; el.style.willChange = x ? 'transform' : ''; });
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = 'cubic-bezier(.22,.9,.24,1)';
  function animate(els, from, to, ms) {
    return Promise.all(els.map((el) => el.animate([from, to], { duration: ms, easing: EASE, fill: 'forwards' }).finished.then((a) => a))).catch(() => {});
  }

  // ---------------- vodoravno prevlačenje: sadržaj prati prst
  const H = { on: false };
  document.addEventListener('touchstart', (e) => {
    H.on = false; H.lock = null;
    if (e.touches.length !== 1 || H.busy) return;
    const t = e.touches[0], inSheet = !document.getElementById('sheetBg').hidden, sheet = document.getElementById('sheet');
    if (inSheet && !sheet.contains(e.target)) return;
    if (t.clientX < 18 || t.clientX > innerWidth - 18) return; // ivice ekrana: sistemski gest „nazad“
    if (hScroller(e.target, inSheet ? sheet : document.body)) return;
    const tg = target(inSheet); if (!tg) return;
    Object.assign(H, { on: true, inSheet, tg, x0: t.clientX, y0: t.clientY, t0: Date.now(), dx: 0, els: null });
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!H.on || drag.active) return;
    const t = e.touches[0], dx = t.clientX - H.x0, dy = t.clientY - H.y0;
    if (!H.lock) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      H.lock = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'x' : 'y';
      if (H.lock === 'y') { H.on = false; return; }
      H.els = parts(H.tg.root);
      H.els.forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    }
    if (e.cancelable) e.preventDefault(); // vodoravno: ne skroluj stranu
    const dir = dx < 0 ? 1 : -1;
    // na kraju liste tabova – otpor (guma)
    H.dx = H.tg.has(dir) ? dx : dx * 0.28;
    setX(H.els, H.dx, 1 - Math.min(0.35, Math.abs(H.dx) / innerWidth * 0.6));
  }, { passive: false });
  const hEnd = async () => {
    if (!H.on || H.lock !== 'x') { H.on = false; return; }
    H.on = false;
    const els = H.els, dx = H.dx, dir = dx < 0 ? 1 : -1, v = Math.abs(dx) / Math.max(1, Date.now() - H.t0);
    const cur = { transform: `translate3d(${dx}px,0,0)`, opacity: els[0] ? els[0].style.opacity || 1 : 1 };
    setX(els, 0);
    if (!H.tg.has(dir) || (Math.abs(dx) < innerWidth * 0.22 && v < 0.45)) { // vrati nazad
      await animate(els, cur, { transform: 'translate3d(0,0,0)', opacity: 1 }, 260);
      els.forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
      return;
    }
    H.busy = true;
    const W = innerWidth;
    await animate(els, cur, { transform: `translate3d(${-dir * W * 0.45}px,0,0)`, opacity: 0 }, reduce() ? 1 : 140);
    try { navigator.vibrate && navigator.vibrate(6); } catch { /* */ }
    H.tg.go(dir);
    const root = H.tg.root, fresh = parts(root);
    fresh.forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    root.style.minHeight = '';
    if (!reduce()) await animate(fresh, { transform: `translate3d(${dir * W * 0.35}px,0,0)`, opacity: 0 }, { transform: 'translate3d(0,0,0)', opacity: 1 }, 260);
    fresh.forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    els.forEach((el) => el.isConnected && el.getAnimations().forEach((a) => a.cancel()));
    H.busy = false;
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
