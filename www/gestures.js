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

  function switchSeg(root, dir) {
    const seg = [...root.querySelectorAll('.seg')].find(visible);
    if (!seg) return false;
    const btns = [...seg.querySelectorAll('button')].filter(visible);
    const i = btns.findIndex((b) => b.classList.contains('on'));
    const n = btns[i + dir];
    if (!n) { nudge(root, dir); return true; }
    try { navigator.vibrate && navigator.vibrate(6); } catch { /* */ }
    n.click(); slideIn(root === document.getElementById('sheet') ? root : document.getElementById('view'), dir);
    return true;
  }
  function switchMain(dir) {
    const i = MAIN_TABS.indexOf(tab);
    if (i < 0) return;
    const n = MAIN_TABS[i + dir];
    if (!n) return nudge(document.getElementById('view'), dir);
    try { navigator.vibrate && navigator.vibrate(6); } catch { /* */ }
    setTab(n); slideIn(document.getElementById('view'), dir);
  }
  function slideIn(el, dir) {
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.animate([{ transform: `translateX(${dir * 36}px)`, opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
  function nudge(el, dir) { // kraj liste tabova – mali „odskok“
    if (!el) return;
    el.animate([{ transform: 'none' }, { transform: `translateX(${-dir * 14}px)` }, { transform: 'none' }], { duration: 220, easing: 'ease-out' });
  }

  // ---------------- vodoravno prevlačenje
  let sx = 0, sy = 0, st = 0, skip = false, inSheet = false;
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { skip = true; return; }
    const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now();
    const sheet = document.getElementById('sheet');
    inSheet = !document.getElementById('sheetBg').hidden;
    skip = hScroller(e.target, inSheet ? sheet : document.body) || (inSheet && !sheet.contains(e.target)) || sx < 18 || sx > innerWidth - 18; // ivice ekrana pripadaju sistemu
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (skip || drag.active) return;
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy, dt = Date.now() - st;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6 || dt > 700) return;
    const dir = dx < 0 ? 1 : -1; // prst ulevo → sledeći tab
    if (inSheet) { switchSeg(document.getElementById('sheet'), dir); return; }
    if (!switchSeg(document.getElementById('view'), dir)) switchMain(dir);
  }, { passive: true });

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
