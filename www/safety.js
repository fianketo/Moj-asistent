// Alergeni (EU Uredba 1169/2011, Prilog II – 14 alergena), bezbednost hrane (USDA FSIS / FDA),
// smernice za fizičku aktivnost (SZO 2020) i upitnik pre početka vežbanja (po uzoru na PAR-Q+).
// Sve se računa iz sastojaka recepta – nije zamena za čitanje deklaracije proizvoda.

const ALLERGENS = {
  gluten: { ic: '🌾', name: 'Gluten', ing: [...ING_GLUTEN].filter((n) => n !== 'Kvasac') },
  rakovi: { ic: '🦐', name: 'Rakovi', ing: ['Škampi'] },
  jaja: { ic: '🥚', name: 'Jaja', ing: ['Jaja', 'Majonez', 'Rezanci za supu', 'Piškote', 'Njoke'] },
  riba: { ic: '🐟', name: 'Riba', ing: ['Losos', 'Oslić', 'Pastrmka', 'Šaran', 'Tunjevina (konzerva)', 'Sardine (konzerva)', 'Skuša', 'Bakalar', 'Riba (sveža)', 'Som', 'Riblji štapići'] },
  kikiriki: { ic: '🥜', name: 'Kikiriki', ing: ['Kikiriki puter'] },
  soja: { ic: '🫘', name: 'Soja', ing: ['Soja sos'] },
  mleko: { ic: '🥛', name: 'Mleko (laktoza)', ing: [...ING_LACTOSE, 'Puter', 'Eurokrem / namaz', 'Petit beurre keks', 'Čokolada za kuvanje'] },
  orasasti: { ic: '🌰', name: 'Orašasti plodovi', ing: ['Orasi', 'Bademi', 'Lešnici', 'Eurokrem / namaz'] },
  celer: { ic: '🥬', name: 'Celer', ing: ['Celer'] },
  senf: { ic: '🟡', name: 'Slačica (senf)', ing: ['Senf', 'Senf (dižon)', 'Majonez'] },
  susam: { ic: '⚪', name: 'Susam', ing: ['Susam'] },
  sulfiti: { ic: '🍇', name: 'Sulfiti', ing: ['Suvo grožđe', 'Sirće', 'Kiseli krastavčići'] },
  lupina: { ic: '🌼', name: 'Lupina', ing: [] },
  mekusci: { ic: '🦑', name: 'Mekušci', ing: ['Lignje', 'Dagnje'] },
};
const ALLERGEN_BY_ING = new Map();
for (const [k, a] of Object.entries(ALLERGENS)) for (const n of a.ing) ALLERGEN_BY_ING.set(n, [...(ALLERGEN_BY_ING.get(n) || []), k]);
function recipeAllergens(r) {
  const out = new Set();
  for (const [n] of r.ing) for (const k of ALLERGEN_BY_ING.get(n) || []) out.add(k);
  return [...out];
}

// Bezbednost hrane – minimalne unutrašnje temperature (USDA FSIS „Safe Minimum Internal Temperature Chart“)
const SAFETY_RULES = [
  { ic: '🐔', re: /^(Pileć|Piletina|Ćuretina)/, t: 'Živina (piletina, ćuretina, džigerica): unutrašnja temperatura najmanje 74 °C – sok mora biti bistar, meso bez ružičastog dela.' },
  { ic: '🥩', re: /^(Mleveno|Ćevapi|Pljeskavica|Kobasice)/, t: 'Mleveno meso, ćevapi, pljeskavice, kobasice: najmanje 71 °C u sredini (bez ružičaste boje).' },
  { ic: '🍖', re: /^(Svinjsk|Junetina|Teletina|Jagnjetina|Suva rebra)/, t: 'Celi komadi svinjetine, junetine, teletine i jagnjetine: najmanje 63 °C u sredini, pa 3 minuta odmora pre sečenja.' },
  { ic: '🐟', re: /^(Losos|Oslić|Pastrmka|Šaran|Skuša|Bakalar|Riba|Som)/, t: 'Riba: najmanje 63 °C – meso postaje neprozirno i lako se odvaja viljuškom.' },
  { ic: '🦐', re: /^(Škampi|Lignje)/, t: 'Škampi i lignje: kuvati dok meso ne postane čvrsto i neprozirno (škampi ružičasti).' },
  { ic: '🦪', re: /^Dagnje/, t: 'Dagnje: pre kuvanja baciti napukle i otvorene koje se ne zatvore na lupkanje; posle kuvanja baciti one koje se nisu otvorile.' },
  { ic: '🥚', re: /^Jaja$/, t: 'Jaja: za trudnice, malu decu, starije i osobe slabijeg imuniteta kuvati dok se i belance i žumance ne stegnu (71 °C). Ne jesti sirovo testo/fil sa sirovim jajima.' },
  { ic: '🍚', re: /^Pirinač$/, t: 'Kuvani pirinač ohladiti i staviti u frižider što pre (najkasnije za 2 sata) – na sobnoj temperaturi se razvija Bacillus cereus.' },
  { ic: '🫘', re: /^Pasulj$/, t: 'Suvi pasulj potopiti bar 5 sati, vodu baciti i kuvati u svežoj vodi da ključa najmanje 30 minuta (sirov crveni pasulj sadrži toksični lektin).' },
  { ic: '🥬', re: /^(Zelena salata|Rukola|Spanać|Čeri paradajz|Krastavac|Rotkvice)/, t: 'Sveže povrće koje se jede sirovo dobro oprati pod mlazom vode neposredno pre pripreme.' },
];
const SAFETY_ALWAYS = 'Ostatke ohladiti i staviti u frižider (do 4 °C) u roku od 2 sata; potrošiti za 3–4 dana. Podgrevati do vrenja / 74 °C.';
function recipeSafety(r) {
  const out = [];
  for (const rule of SAFETY_RULES) if (r.ing.some(([n]) => rule.re.test(n))) out.push(rule);
  return out;
}

// Pregled stručnjaka: popunjava se SAMO kada stvarno lice pregleda sadržaj (www/reviews.js).
const reviewOf = (kind, id) => (typeof REVIEWS !== 'undefined' && REVIEWS[kind] && REVIEWS[kind][id]) || null;
function reviewBadge(kind, id) {
  const rv = reviewOf(kind, id);
  if (rv) return `<div class="rv ok"><span>✔ <b>Stručno pregledano</b></span><span>${esc(rv.by)}${rv.title ? ', ' + esc(rv.title) : ''}${rv.date ? ' · ' + esc(rv.date) : ''}</span></div>`;
  return `<div class="rv"><span>ℹ️ <b>Nije stručno pregledano.</b></span><span>${kind === 'recipes' ? 'Nutritivne vrednosti su izračunate iz USDA baze, a alergeni iz sastojaka – proverite deklaracije proizvoda.' : 'Program je sastavljen po opštim smernicama SZO/ACSM – nije individualni plan.'}</span></div>`;
}

function nutritionBlock(r) {
  const n = r.nut; if (!n) return '';
  const salt = Math.round((n.na * 2.5) / 100) / 10; // natrijum → so (g)
  const row = (l, v, u) => `<div><span>${l}</span><b>${fmtNum(Math.round(v * 10) / 10)} ${u}</b></div>`;
  return `<div class="nut"><div class="nut-h">📊 Nutritivne vrednosti <small>po porciji</small></div>
    <div class="nut-kcal"><b>${Math.round(n.kcal)}</b> kcal</div>
    <div class="nut-bar"><span style="flex:${n.p * 4}" class="p"></span><span style="flex:${n.c * 4}" class="c"></span><span style="flex:${n.f * 9}" class="f"></span></div>
    <div class="nut-grid">${row('🟢 Proteini', n.p, 'g')}${row('🟡 Ugljeni hidrati', n.c, 'g')}${row('   od toga šećeri', n.sug, 'g')}${row('🟠 Masti', n.f, 'g')}${row('Vlakna', n.fib, 'g')}${row('So (iz sastojaka)', salt, 'g')}</div>
    <p class="nut-src">Izračunato iz USDA FoodData Central (SR Legacy) na osnovu sastojaka – približno. Ne uključuje so i ulje koje dodaješ „po ukusu“.</p></div>`;
}
function allergenBlock(r) {
  const a = recipeAllergens(r);
  return `<div class="alg"><div class="nut-h">⚠️ Alergeni <small>EU lista 14</small></div>
    ${a.length ? `<div class="alg-chips">${a.map((k) => `<span>${ALLERGENS[k].ic} ${ALLERGENS[k].name}</span>`).join('')}</div>` : '<p class="meta" style="margin:4px 0">Nijedan od 14 glavnih alergena nije u sastojcima.</p>'}
    <p class="nut-src">Gotovi proizvodi (hleb, kobasice, čokolada, začinske mešavine…) mogu sadržati tragove drugih alergena – pročitaj deklaraciju.</p></div>`;
}
function safetyBlock(r) {
  const s = recipeSafety(r);
  return `<div class="safe"><div class="nut-h">🌡️ Bezbednost hrane</div><ul>${s.map((x) => `<li><span>${x.ic}</span>${esc(x.t)}</li>`).join('')}<li><span>🧊</span>${SAFETY_ALWAYS}</li></ul>
    <p class="nut-src">Izvor: USDA FSIS – Safe Minimum Internal Temperatures; FDA.</p></div>`;
}

// Prijava greške – tekst se šalje preko Viber/WhatsApp/SMS ili kopira
function reportProblem(kind, id, name, back) {
  const text = `🚩 Prijava greške – Moj Asistent\n${kind === 'recipes' ? 'Recept' : 'Program treninga'}: ${name} (${id})\nŠta nije u redu: `;
  openSheet(`<div id="rpWrap"><h3>🚩 Prijavi grešku</h3>
    <p class="meta" style="margin:0 0 8px">Primetio si pogrešnu količinu, korak, vrednost ili nebezbedan savet? Opiši ukratko i pošalji autoru aplikacije.</p>
    <textarea class="input" id="rpText" style="min-height:130px">${esc(text)}</textarea>
    <div class="row" style="margin-top:12px"><button class="btn" data-to="viber">Viber</button><button class="btn" data-to="wa">WhatsApp</button><button class="btn" data-to="sms">SMS</button><button class="btn" data-to="copy">Kopiraj</button></div>
    <div class="foot">${back ? '<button class="btn" data-to="back">← Nazad</button>' : ''}<button class="btn" data-to="close">Zatvori</button></div></div>`, (sh) => {
    $('#rpWrap').addEventListener('click', async (e) => {
      const to = e.target.dataset.to; if (!to) return;
      const t = $('#rpText').value;
      if (to === 'back') return back();
      if (to === 'close') return closeSheet();
      if (to === 'viber') openExternal('viber://forward?text=' + encodeURIComponent(t));
      if (to === 'wa') openExternal('https://wa.me/?text=' + encodeURIComponent(t));
      if (to === 'sms') openExternal(smsUrl('', t));
      if (to === 'copy') { try { await navigator.clipboard.writeText(t); } catch { $('#rpText').select(); document.execCommand('copy'); } toast('Kopirano'); }
    });
  });
}

// ---------------------------------------------------------------- TRENING: smernice i bezbednost
// SZO (WHO) 2020 Guidelines on physical activity and sedentary behaviour – odrasli 18–64 i 65+
const WHO_MIN = 150, WHO_MAX = 300;
function whoCard(h) {
  const ws = weekStart(weekAbs()).getTime();
  const wl = h.log.filter((l) => l.t >= ws);
  const min = wl.reduce((s, l) => s + (l.dur || 0), 0);
  const strengthDays = new Set(wl.filter((l) => { const p = TRAININGS.find((t) => t.id === l.prog); return p && p.cat !== 'trcanje' && p.cat !== 'mobilnost'; }).map((l) => new Date(l.t).toDateString())).size;
  const pct = Math.min(100, Math.round((min / WHO_MIN) * 100));
  return `<div class="who"><div class="nut-h">🌍 Preporuka SZO <small>za odrasle</small></div>
    <div class="who-row"><div><b>${min}</b>/${WHO_MIN} min</div><div class="progress"><div style="width:${pct}%"></div></div></div>
    <div class="who-row"><div><b>${strengthDays}</b>/2 dana</div><span class="meta">vežbe snage ove nedelje</span></div>
    <p class="nut-src">SZO 2020: 150–300 min umerene ili 75–150 min intenzivne aktivnosti nedeljno + vežbe snage za sve veće mišićne grupe 2 ili više dana. Osobe 65+: i vežbe ravnoteže 3 dana nedeljno. Brojimo samo treninge iz aplikacije – šetnja, bicikl i posao se takođe računaju.</p></div>`;
}
const PARQ = [
  'Da li ti je lekar rekao da imaš problem sa srcem ili povišen krvni pritisak?',
  'Da li osećaš bol u grudima u mirovanju, pri svakodnevnim aktivnostima ili pri vežbanju?',
  'Da li gubiš ravnotežu zbog vrtoglavice ili si izgubio/la svest u poslednjih 12 meseci?',
  'Da li imaš neku drugu hroničnu bolest (npr. dijabetes, astmu, bolest bubrega)?',
  'Da li redovno piješ lekove za hroničnu bolest?',
  'Da li imaš (ili si u poslednjih 12 meseci imao/la) problem sa kostima, zglobovima ili mišićima koji bi se pogoršao vežbanjem?',
  'Da li si trudna ili si se nedavno porodila?',
  'Da li ti je lekar rekao da smeš da vežbaš samo pod nadzorom?',
];
const STOP_SIGNS = ['bol, pritisak ili stezanje u grudima', 'jak nedostatak vazduha (ne možeš da izgovoriš rečenicu)', 'vrtoglavica, mučnina ili osećaj nesvestice', 'nepravilan ili veoma ubrzan rad srca', 'oštar bol u zglobu ili mišiću (ne običan zamor)'];
function safetyTrainBlock() {
  const h = H(), ok = h.parq && h.parq.ok;
  return `<div class="safe"><div class="nut-h">🩺 Pre početka</div>
    ${ok ? `<p style="margin:4px 0">✅ Upitnik popunjen ${h.parq.date || ''} – ${h.parq.yes ? '<b>preporučeno je da se posavetuješ sa lekarom pre početka.</b>' : 'nema prepreka za umereno vežbanje.'} <button class="linkbtn" data-g="parq">Ponovi</button></p>`
      : `<p style="margin:4px 0">Ako počinješ posle duže pauze, odgovori na 8 kratkih pitanja (po uzoru na PAR-Q+).</p><button class="btn block" data-g="parq">📝 Upitnik o spremnosti</button>`}
    <div class="nut-h" style="margin-top:10px">🛑 Odmah prekini ako osetiš</div><ul>${STOP_SIGNS.map((s) => `<li><span>•</span>${s}</li>`).join('')}</ul>
    <p class="nut-src">Ako simptomi ne prođu za nekoliko minuta odmora – pozovi 194. Zagrevanje 5–10 min pre i hlađenje posle svakog treninga smanjuju rizik od povrede.</p></div>`;
}
function parqSheet(back) {
  const ans = PARQ.map(() => null);
  const draw = () => `<div id="pqWrap"><h3>📝 Spremnost za vežbanje</h3>
    <p class="meta" style="margin:0 0 8px">Odgovori iskreno. Ako je bar jedan odgovor „Da“, posavetuj se sa lekarom pre nego što povećaš intenzitet.</p>
    ${PARQ.map((q, i) => `<div class="pq"><span>${i + 1}. ${q}</span><div class="seg"><button class="${ans[i] === true ? 'on' : ''}" data-q="${i}" data-v="1">Da</button><button class="${ans[i] === false ? 'on' : ''}" data-q="${i}" data-v="0">Ne</button></div></div>`).join('')}
    <div class="foot"><button class="btn" data-q="back">← Nazad</button><button class="btn primary" data-q="save" ${ans.includes(null) ? 'disabled' : ''}>Sačuvaj</button></div></div>`;
  const mount = () => $('#pqWrap').addEventListener('click', (e) => {
    const b = e.target.closest('[data-q]'); if (!b) return;
    if (b.dataset.q === 'back') return back ? back() : closeSheet();
    if (b.dataset.q === 'save') {
      const yes = ans.filter(Boolean).length, d = new Date();
      H().parq = { ok: true, yes, date: `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}.` }; save(false);
      toast(yes ? 'Preporuka: posavetuj se sa lekarom pre početka' : 'Sve u redu – srećno! 💪', 4000);
      return back ? back() : closeSheet();
    }
    ans[+b.dataset.q] = b.dataset.v === '1';
    $('#sheet').innerHTML = draw(); mount();
  });
  openSheet(draw(), mount);
}
