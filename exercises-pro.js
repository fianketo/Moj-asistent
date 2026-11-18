/* Biblioteka vežbi – stručni opis: mišići, oprema, tehnika, česte greške, lakša/teža varijanta.
 * [primarni mišići, sekundarni, oprema, vrsta, 'tehnika|…', 'greške|…', lakše, teže] */
'use strict';
const EX_PRO = {
  zagrevanje: ['celo telo', '', 'bez opreme', 'zagrevanje', 'Kreni lagano pa ubrzavaj|Pokreni sve zglobove: vrat, ramena, kukove, kolena, članke|Na kraju 3–4 brža skoka da podigneš puls', 'Preskakanje zagrevanja – najčešći uzrok povreda|Statičko istezanje pre treninga (ostavi ga za kraj)', 'Samo hodanje u mestu', 'Dodaj skokove i iskorake'],
  cucanj: ['butine (kvadriceps), zadnjica', 'zadnja loža, trup', 'bez opreme', 'snaga', 'Stopala u širini ramena, prsti blago ka spolja|Kukovi idu unazad i dole, kao da sedaš|Kolena prate pravac prstiju, pete ostaju na podu', 'Kolena padaju ka unutra|Podizanje peta|Savijanje leđa napred', 'Čučanj na stolicu (sedni i ustani)', 'Čučanj sa pauzom 2 s dole ili sa skokom'],
  cucanjSkok: ['butine, zadnjica', 'listovi, srce i pluća', 'bez opreme', 'snaga', 'Spusti se u pun čučanj|Eksplozivno se odrazi, ruke zamahuju nagore|Doskoči mekano na prste i odmah u sledeći čučanj', 'Tvrdi doskok na pete|Kolena ka unutra pri doskoku', 'Običan čučanj sa podizanjem na prste', 'Skok sa privlačenjem kolena'],
  sklekKolena: ['grudi, triceps', 'ramena, trup', 'bez opreme', 'snaga', 'Kolena na podu, telo pravo od kolena do glave|Šake malo šire od ramena, laktovi pod ~45°|Spusti grudi skoro do poda, pa se odgurni', 'Ulegnuta leđa|Laktovi rašireni u stranu (opterećuje ramena)', 'Sklek uz zid', 'Pravi sklek'],
  sklek: ['grudi, triceps', 'prednja ramena, trup', 'bez opreme', 'snaga', 'Telo pravo kao daska, zategni stomak i zadnjicu|Laktovi ~45° od tela|Grudi do 2–3 cm od poda, pa potisni', 'Kukovi propadaju ili štrče|Pola pokreta', 'Sklek sa kolena ili uz klupu', 'Sklek sa nogama na stolici ili sa pauzom dole'],
  iskorak: ['butine, zadnjica', 'zadnja loža, ravnoteža', 'bez opreme', 'snaga', 'Veliki korak, trup uspravan|Zadnje koleno se spušta skoro do poda|Odgurni se prednjom petom nazad', 'Prednje koleno ide daleko preko prstiju|Uzak korak (gubi se ravnoteža)', 'Statički iskorak u mestu uz oslonac', 'Iskorak sa bučicama ili hodajući iskorak'],
  bugarski: ['butine, zadnjica', 'ravnoteža, trup', 'stolica ili klupa', 'snaga', 'Zadnje stopalo na stolici, prednja noga dovoljno napred|Spuštaj se pravo dole, trup blago nagnut|Odgurni se kroz prednju petu', 'Previše blizu stolici – koleno ide daleko napred|Gubljenje ravnoteže (počni uz zid)', 'Obični iskorak', 'Sa bučicama u rukama'],
  plank: ['trup (stomak)', 'ramena, zadnjica', 'bez opreme', 'core', 'Laktovi ispod ramena|Telo pravo od glave do peta, zategni zadnjicu|Diši normalno, ne zadržavaj dah', 'Kukovi visoko ili propadaju|Gledanje napred (opterećuje vrat)', 'Plank sa kolena', 'Plank sa podizanjem jedne noge'],
  plankRamena: ['trup, ramena', 'grudi', 'bez opreme', 'core', 'Položaj za sklek, stopala malo raširena|Naizmenično dodirni suprotno rame|Kukovi ostaju mirni, bez ljuljanja', 'Ljuljanje kukova levo-desno|Prebrzo izvođenje', 'Sa kolena', 'Stopala skupljena zajedno'],
  most: ['zadnjica', 'zadnja loža, donja leđa', 'bez opreme', 'snaga', 'Pete blizu zadnjice, stopala u širini kukova|Podigni kukove stežući zadnjicu, zadrži 1–2 s|Telo pravo od kolena do ramena na vrhu', 'Izvijanje donjih leđa umesto stezanja zadnjice|Guranje kroz prste umesto kroz pete', 'Manji opseg pokreta', 'Jednonožni most ili hip thrust na klupi'],
  propadanja: ['triceps', 'grudi, prednja ramena', 'stolica', 'snaga', 'Šake na ivici stolice, prsti napred|Spuštaj se dok laktovi ne budu pod 90°|Leđa blizu stolice', 'Previše duboko (opterećuje ramena)|Laktovi u stranu', 'Kolena savijena, stopala bliže', 'Noge opružene ili podignute'],
  superman: ['donja leđa', 'zadnjica, zadnja ramena', 'bez opreme', 'core', 'Na stomaku, ruke ispružene napred|Istovremeno podigni ruke, grudi i noge|Zadrži 2 s, pogled u pod', 'Zabacivanje glave|Trzaji umesto kontrole', 'Podizanje samo ruku ili samo nogu', 'Zadrži 5 s ili „plivanje“ rukama i nogama'],
  trbusnjaci: ['stomak (prednji)', '', 'bez opreme', 'core', 'Kolena savijena, šake na slepoočnicama|Podigni ramena 10–15 cm od poda|Izdahni dok se podižeš', 'Vučenje glave rukama|Podizanje celog trupa (radi kuk, ne stomak)', 'Ruke ispružene ka kolenima', 'Sa nogama u vazduhu ili sa tegom'],
  penjac: ['trup, srce i pluća', 'ramena, butine', 'bez opreme', 'kardio', 'Položaj za sklek, šake ispod ramena|Brzo naizmenično privlači kolena ka grudima|Kukovi nisko i mirni', 'Kukovi visoko u vazduhu|Prespora izvođenja (gubi se efekat)', 'Sporo, naizmenično koračanje', 'Ukršteno – koleno ka suprotnom laktu'],
  istezanje: ['celo telo', '', 'bez opreme', 'mobilnost', 'Svaki položaj zadrži 20–30 s|Diši duboko i opuštaj se u istezanje|Butine, zadnja loža, listovi, grudi, ramena, leđa', 'Cimanje (balistika)|Istezanje do bola'],
  hod: ['srce i pluća', 'noge', 'patike', 'kardio', 'Brz korak, ruke rade savijene u laktovima|Uspravno držanje, pogled napred|Tempo u kome možeš da pričaš uz malo zadihanosti', 'Previše spor tempo|Pogrbljeno držanje'],
  trk: ['srce i pluća', 'noge', 'patike', 'kardio', 'Kratak korak, doskok ispod tela|Ramena opuštena, ruke pod 90°|Tempo u kome možeš da pričaš', 'Predug korak sa doskokom na petu|Prebrz početak'],
  odmor: ['', '', '', 'odmor', 'Hodaj lagano ili stoj|Diši duboko kroz nos|Popij gutljaj vode', ''],
  cucanjSipka: ['butine, zadnjica', 'zadnja loža, leđa, trup', 'šipka, stalak', 'snaga', 'Šipka na gornjem delu trapeza, lopatice skupljene|Udahni, zategni stomak i spuštaj se do paralele ili niže|Kolena prate prste, pa se odgurni kroz sredinu stopala', 'Zaokruživanje leđa na dnu|Kolena ka unutra|Podizanje peta', 'Goblet čučanj sa bučicom', 'Pauza 2 s na dnu ili prednji čučanj'],
  benc: ['grudi', 'triceps, prednja ramena', 'klupa, šipka', 'snaga', 'Lopatice skupljene i spuštene, blagi luk u leđima|Šipka se spušta do donjeg dela grudi, laktovi ~45°|Stopala čvrsto na podu, potisni gore i blago ka licu', 'Odbijanje šipke od grudi|Laktovi pod 90° (rizik za ramena)|Podizanje zadnjice sa klupe', 'Potisak bučica ili sklekovi', 'Pauza na grudima 1 s'],
  veslanje: ['leđa (široki leđni, romboidni)', 'zadnja ramena, biceps', 'šipka', 'snaga', 'Pretklon ~45°, leđa ravna, kolena blago savijena|Povuci šipku ka pupku, laktovi uz telo|Stisni lopatice na vrhu, spusti kontrolisano', 'Trzanje trupom|Okrugla leđa|Povlačenje ka grudima umesto ka stomaku', 'Jednoručno veslanje uz oslonac', 'Pauza 1 s na vrhu'],
  vojnicki: ['ramena', 'triceps, gornji grudi, trup', 'šipka', 'snaga', 'Šipka na ključnim kostima, hvat malo širi od ramena|Zategni stomak i zadnjicu|Potisni pravo gore, glava ide „kroz prozor“ na vrhu', 'Preterano zabacivanje leđa|Potisak ispred lica umesto iznad glave', 'Potisak bučica sedeći', 'Sa pauzom kod brade'],
  mrtvo: ['zadnja loža, zadnjica, leđa', 'trapez, podlaktice, trup', 'šipka', 'snaga', 'Šipka iznad sredine stopala, potkolenice skoro dodiruju šipku|Leđa ravna, grudi gore, ramena iznad šipke|Guraj pod nogama i podigni se, šipka klizi uz noge', 'Okrugla leđa (najopasnija greška!)|Šipka daleko od tela|Zabacivanje na vrhu', 'Rumunsko mrtvo sa bučicama', 'Sa pauzom ispod kolena'],
  rumunsko: ['zadnja loža, zadnjica', 'donja leđa', 'šipka ili bučice', 'snaga', 'Kolena blago savijena i fiksna|Kukovi idu unazad, leđa ravna|Spuštaj se do osećaja istezanja zadnje lože, pa nazad', 'Savijanje kolena kao u čučnju|Okrugla leđa', 'Sa lakšim bučicama', 'Na jednoj nozi'],
  lat: ['leđa (široki leđni)', 'biceps, zadnja ramena', 'sprava za povlačenje', 'snaga', 'Hvat malo širi od ramena|Prvo spusti lopatice, pa povuci šipku do gornjeg dela grudi|Laktovi idu ka dole i nazad', 'Zabacivanje tela unazad|Povlačenje iza vrata', 'Lakša težina, sporiji pokret', 'Zgibovi'],
  zgib: ['leđa', 'biceps, podlaktice, trup', 'šipka za zgibove', 'snaga', 'Pun visak na početku|Spusti lopatice, pa se povuci dok brada ne pređe šipku|Kontrolisano spuštanje do kraja', 'Ljuljanje i trzaji|Pola pokreta', 'Sa gumom za pomoć ili negativni zgib (samo spuštanje)', 'Sa tegom ili sporim spuštanjem 3 s'],
  kosiBucice: ['gornji deo grudi', 'prednja ramena, triceps', 'kosa klupa, bučice', 'snaga', 'Klupa na 30°|Bučice se spuštaju do visine grudi, laktovi ~45°|Potisni gore i blago ka unutra', 'Previše strma klupa (radi ramena)|Udaranje bučica na vrhu', 'Lakše bučice', 'Pauza dole'],
  bocno: ['srednja ramena', 'trapez', 'bučice', 'snaga', 'Blago savijeni laktovi|Podigni ruke u stranu do visine ramena|Spusti polako, 2–3 s', 'Zamah telom|Previše teške bučice'],
  biceps: ['biceps', 'podlaktice', 'bučice ili šipka', 'snaga', 'Laktovi uz telo i mirni|Podigni do ramena, stisni|Spuštaj kontrolisano do kraja', 'Zamah leđima|Laktovi idu napred'],
  triceps: ['triceps', '', 'sajla ili bučica', 'snaga', 'Nadlaktice mirne|Opruži ruke potpuno|Vrati sporo', 'Pomeranje laktova|Previše teško – pokret postaje potisak'],
  presa: ['butine, zadnjica', 'zadnja loža', 'nožna presa', 'snaga', 'Stopala u širini ramena na sredini platforme|Spuštaj dok kolena ne budu pod ~90°|Ne zaključavaj kolena na vrhu', 'Odvajanje donjeg dela leđa od naslona|Previše duboko'],
  pregibNoge: ['zadnja loža', 'listovi', 'sprava', 'snaga', 'Kolena u liniji sa osom sprave|Savij do kraja, stisni|Vrati sporo', 'Podizanje kukova|Trzaji'],
  listovi: ['listovi', '', 'stepenik ili sprava', 'snaga', 'Pete ispod nivoa stepenika na početku|Podigni se na prste što više, zadrži 1 s|Spusti sporo', 'Prebrzo „poskakivanje“|Mali opseg pokreta'],
  facePull: ['zadnja ramena, gornja leđa', 'rotatori ramena', 'sajla i uže', 'snaga', 'Sajla u visini očiju|Povuci uže ka licu razdvajajući krajeve|Laktovi visoko, stisni lopatice', 'Previše teško – vuče se telom|Laktovi nisko'],
  goblet: ['butine, zadnjica', 'trup, gornja leđa', 'bučica ili girja', 'snaga', 'Bučica uz grudi, laktovi ka dole|Spusti se duboko između kolena|Grudi gore', 'Okrugla leđa|Pete se odvajaju'],
  veslanjeBucica: ['leđa', 'biceps, zadnja ramena', 'bučica, klupa', 'snaga', 'Koleno i ruka na klupi, leđa ravna|Povuci bučicu ka kuku|Lakat uz telo', 'Rotiranje trupa|Povlačenje ka ramenu'],
  potisakBucice: ['grudi', 'triceps, ramena', 'bučice, klupa ili pod', 'snaga', 'Bučice iznad grudi|Spusti do nivoa grudi, laktovi ~45°|Potisni gore', 'Laktovi pod 90°|Udaranje bučica'],
  rumunskoBucice: ['zadnja loža, zadnjica', 'donja leđa', 'bučice', 'snaga', 'Bučice ispred butina|Kukovi unazad, leđa ravna|Bučice klize niz noge', 'Okrugla leđa|Savijanje kolena'],
  iskorakBucice: ['butine, zadnjica', 'ravnoteža, podlaktice', 'bučice', 'snaga', 'Bučice uz telo|Veliki korak, zadnje koleno skoro do poda|Odgurni se nazad kroz petu', 'Kratak korak|Nagib napred'],
  burpee: ['celo telo', 'srce i pluća', 'bez opreme', 'kardio', 'Čučni, šake na pod|Skoči nogama u položaj za sklek|Vrati noge i skoči uvis', 'Ulegnuta leđa u planku|Tvrdi doskok', 'Bez skoka i bez skleka', 'Sa sklekom i skokom sa kolenima'],
  jumpingJack: ['srce i pluća', 'listovi, ramena', 'bez opreme', 'kardio', 'Skok u raskorak, ruke iznad glave|Skok nazad, ruke uz telo|Doskok na prste', 'Doskok na pete'],
  visokaKolena: ['srce i pluća', 'pregibači kuka, trup', 'bez opreme', 'kardio', 'Kolena do visine kukova|Ruke rade kao u trčanju|Na prstima', 'Zabacivanje trupa unazad'],
  macka: ['kičma', '', 'bez opreme', 'mobilnost', 'Na sve četiri, šake ispod ramena|Izdah – izvij leđa nagore (mačka)|Udah – ulegni leđa, pogled gore (krava)', 'Prebrzo|Pokret samo u vratu'],
  birdDog: ['trup, donja leđa', 'zadnjica, ramena', 'bez opreme', 'core', 'Na sve četiri, leđa ravna|Opruži suprotnu ruku i nogu do horizontale|Zadrži 2 s, kukovi mirni', 'Rotacija kukova|Izvijanje leđa'],
  deadBug: ['dubok stomak', 'pregibači kuka', 'bez opreme', 'core', 'Na leđima, kolena pod 90° iznad kukova, ruke gore|Donji deo leđa pritisnut uz pod|Spuštaj suprotnu ruku i nogu ka podu', 'Odvajanje leđa od poda|Zadržavanje daha'],
  bocniPlank: ['kosi stomak', 'ramena, zadnjica', 'bez opreme', 'core', 'Lakat ispod ramena|Telo pravo, kukovi gore|Zadrži, pa promeni stranu', 'Kukovi propadaju|Telo nagnuto napred'],
  dete: ['leđa, kukovi', '', 'bez opreme', 'mobilnost', 'Kleči, kolena raširena|Sedni na pete i ispruži ruke napred|Čelo na pod, diši duboko u leđa', ''],
  kukovi: ['kukovi', 'zadnjica', 'bez opreme', 'mobilnost', 'Obe noge savijene pod 90° (90/90)|Uspravi trup, pa se nagni preko prednje noge|Promeni stranu', 'Guranje u bol'],
  ramena: ['ramena', 'gornja leđa', 'bez opreme', 'mobilnost', 'Veliki krugovi rukama napred|Pa nazad|Polako i kontrolisano', ''],
  sklekZid: ['grudi, triceps', 'ramena', 'zid', 'snaga', 'Šake na zid u visini ramena|Telo pravo, korak od zida|Približi grudi zidu, odgurni se', 'Ulegnuta leđa'],
  stolica: ['butine, zadnjica', 'ravnoteža', 'stolica', 'snaga', 'Sedi na ivicu stolice|Ustani bez pomoći ruku|Sedi polako, kontrolisano', 'Padanje na stolicu|Pomaganje rukama'],
  trkBrzo: ['srce i pluća', 'noge', 'patike', 'kardio', 'Tempo „teško, ali održivo“|Brži ritam koraka, ne duži korak|Opuštena ramena', 'Prebrz početak intervala'],
  // nove vežbe
  hipThrust: ['zadnjica', 'zadnja loža', 'klupa ili kauč', 'snaga', 'Lopatice naslonjene na ivicu klupe|Stopala u širini kukova, potkolenice uspravne na vrhu|Podigni kukove do pravog tela, stisni zadnjicu 2 s', 'Izvijanje donjih leđa|Brada gore (gledaj napred, ne u plafon)', 'Most na podu', 'Sa tegom ili bučicom na kukovima'],
  abdukcija: ['spoljna zadnjica (srednji gluteus)', '', 'bez opreme ili guma', 'snaga', 'Leži na boku, donja noga savijena|Gornju opruženu nogu podigni do 45°|Prsti blago ka dole, spusti polako', 'Rotacija kuka nazad|Zamah'],
  sumo: ['unutrašnje butine, zadnjica', 'kvadriceps', 'bez opreme ili bučica', 'snaga', 'Širok stav, prsti ka spolja|Spusti se pravo dole, kolena prate prste|Odgurni se kroz pete', 'Kolena ka unutra|Nagib trupa napred'],
  magarac: ['zadnjica', 'donja leđa', 'bez opreme', 'snaga', 'Na sve četiri|Savijenu nogu podigni ka plafonu dok butina ne bude vodoravna|Stisni zadnjicu, ne izvijaj leđa', 'Izvijanje leđa|Rotacija kuka'],
  stepUp: ['butine, zadnjica', 'ravnoteža', 'stepenik ili klupa', 'snaga', 'Celo stopalo na stepeniku|Popni se odgurivanjem prednjom nogom|Spuštaj se sporo', 'Odgurivanje zadnjom nogom|Koleno ka unutra'],
  bicikl: ['srce i pluća', 'noge', 'sobni bicikl', 'kardio', 'Sedište u visini kuka|Kadenca 70–90 obrtaja u minuti|Umeren otpor – možeš da pričaš', 'Previše nisko sedište (opterećuje kolena)'],
  ledjaRotacija: ['kičma, kukovi', '', 'bez opreme', 'mobilnost', 'Na leđima, kolena savijena|Spusti kolena u stranu, ramena na podu|Zadrži 30 s, promeni stranu', ''],
  zadnjaLoza: ['zadnja loža', 'listovi', 'bez opreme', 'mobilnost', 'Sedi, jedna noga opružena|Nagni se iz kukova ka stopalu, leđa ravna|Zadrži 30 s', 'Okrugla leđa'],
  golub: ['kukovi, zadnjica', '', 'bez opreme', 'mobilnost', 'Prednja noga savijena ispred tela, zadnja opružena nazad|Spusti kukove ka podu|Diši i opuštaj se 45–60 s', 'Bol u kolenu – podmetni jastuk'],
  leptir: ['unutrašnje butine, kukovi', '', 'bez opreme', 'mobilnost', 'Sedi, tabani zajedno|Kolena padaju ka podu|Uspravna leđa, blago se nagni napred', 'Pritiskanje kolena rukama'],
  disanje: ['opuštanje', '', 'bez opreme', 'mobilnost', 'Udah kroz nos 4 s|Zadrži 4 s|Izdah kroz usta 6–8 s', ''],
};
for (const [k, v] of Object.entries(EX_PRO)) {
  const [prim, sec, equip, kind, cues, mist, easier, harder] = v;
  EXERCISES[k] = Object.assign(EXERCISES[k] || {}, { prim, sec, equip, kind, cues: cues ? cues.split('|') : [], mistakes: mist ? mist.split('|') : [], easier: easier || '', harder: harder || '' });
}
Object.assign(EXERCISES, {
  hipThrust: Object.assign(EXERCISES.hipThrust, { name: 'Hip thrust (most na klupi)', icon: '🍑', gym: true, how: 'Lopatice na klupi, podigni kukove stežući zadnjicu, zadrži 2 s.' }),
  abdukcija: Object.assign(EXERCISES.abdukcija, { name: 'Podizanje noge u stranu (ležeći)', icon: '🦵', how: 'Leži na boku i podiži opruženu gornju nogu do 45°.' }),
  sumo: Object.assign(EXERCISES.sumo, { name: 'Sumo čučanj', icon: '🤼', how: 'Širok stav, prsti ka spolja, spusti se pravo dole.' }),
  magarac: Object.assign(EXERCISES.magarac, { name: 'Magareći udarci', icon: '🐴', how: 'Na sve četiri, savijenu nogu podiži ka plafonu stežući zadnjicu.' }),
  stepUp: Object.assign(EXERCISES.stepUp, { name: 'Penjanje na stepenik (step-up)', icon: '🪜', how: 'Popni se na stepenik odgurivanjem prednjom nogom, siđi sporo.' }),
  bicikl: Object.assign(EXERCISES.bicikl, { name: 'Sobni bicikl', icon: '🚴', how: 'Umeren otpor, ravnomerna kadenca.' }),
  ledjaRotacija: Object.assign(EXERCISES.ledjaRotacija, { name: 'Rotacija kičme na leđima', icon: '🌀', how: 'Na leđima, spuštaj savijena kolena u stranu.' }),
  zadnjaLoza: Object.assign(EXERCISES.zadnjaLoza, { name: 'Istezanje zadnje lože', icon: '🧘', how: 'Sedi i nagni se ka opruženoj nozi, leđa ravna.' }),
  golub: Object.assign(EXERCISES.golub, { name: 'Golub (istezanje kukova)', icon: '🕊️', how: 'Prednja noga savijena ispred, zadnja opružena, spusti kukove.' }),
  leptir: Object.assign(EXERCISES.leptir, { name: 'Leptir', icon: '🦋', how: 'Sedi sa tabanima zajedno i pusti kolena ka podu.' }),
  disanje: Object.assign(EXERCISES.disanje, { name: 'Duboko disanje', icon: '🌬️', how: 'Udah 4 s, zadrži 4 s, izdah 6–8 s.' }),
});

// ---- dodatni programi
const W2 = ['zagrevanje', { sec: 300 }], C2 = ['istezanje', { sec: 300 }];
TRAININGS.push(
  { id: 'gluteus', cat: 'kuca', name: 'Gluteus i noge', icon: '🍑', level: 'Početni–srednji', days: [1, 3, 5], perWeek: '3× nedeljno · ~35 min', weeks: 8, goal: 'Jača i oblikovana zadnjica i noge',
    desc: 'Program za zadnjicu i butine – kod kuće sa bučicom ili bez opreme.', note: 'Svake nedelje dodaj 1–2 ponavljanja ili teži teg. Fokus je na stezanju zadnjice na vrhu svakog pokreta.',
    workouts: [
      { name: 'Zadnjica A', rest: 60, items: [W2, ['hipThrust', { sets: 4, reps: 12 }], ['sumo', { sets: 3, reps: 15 }], ['bugarski', { sets: 3, reps: 10, side: true }], ['abdukcija', { sets: 3, reps: 15, side: true }], ['magarac', { sets: 3, reps: 15, side: true }], C2] },
      { name: 'Zadnjica B', rest: 60, items: [W2, ['rumunskoBucice', { sets: 4, reps: 12 }], ['stepUp', { sets: 3, reps: 12, side: true }], ['most', { sets: 3, reps: 20 }], ['iskorak', { sets: 3, reps: 12, side: true }], ['bocniPlank', { sets: 2, sec: 30, side: true }], C2] },
    ] },
  { id: 'brzi15', cat: 'kuca', name: '15 minuta za zauzete', icon: '⏰', level: 'Svi', days: [1, 2, 3, 4, 5], perWeek: '5× nedeljno · 15 min', weeks: 4, goal: 'Kondicija kad nemaš vremena',
    desc: 'Kratak trening celog tela – tajmer vodi sve, bez opreme.', note: 'Bolje 15 minuta svaki dan nego sat vremena jednom nedeljno. Radi umerenim intenzitetom.',
    workouts: [
      { name: 'Celo telo 15', intervals: [['zagrevanje', 120], ...Array(3).fill([['cucanj', 40], ['odmor', 15], ['sklekKolena', 40], ['odmor', 15], ['iskorak', 40], ['odmor', 15], ['plank', 40], ['odmor', 15], ['jumpingJack', 40], ['odmor', 30]]).flat(), ['istezanje', 60]] },
    ] },
  { id: 'vece', cat: 'mobilnost', name: 'Istezanje pred spavanje', icon: '🌙', level: 'Svi', days: [0, 1, 2, 3, 4, 5, 6], perWeek: 'Svako veče · 10 min', weeks: 0, goal: 'Opuštanje i bolji san',
    desc: 'Nežno istezanje i disanje za smirivanje pre sna.', note: 'Radi u krevetu ili na podlozi, uz prigušeno svetlo. Bez telefona posle ovoga 😉',
    workouts: [
      { name: 'Večernja rutina', intervals: [['disanje', 60], ['macka', 60], ['dete', 60], ['golub', 60], ['golub', 60], ['zadnjaLoza', 60], ['leptir', 60], ['ledjaRotacija', 60], ['disanje', 90]] },
    ] },
  { id: 'kardio-pocetnik', cat: 'trcanje', name: 'Kardio za početnike (bicikl ili hod)', icon: '🚴', level: 'Početni', days: [1, 3, 5], perWeek: '3× nedeljno · 25–40 min', weeks: 6, goal: 'Bolja kondicija i srce, bez opterećenja zglobova',
    desc: 'Sobni bicikl ili brz hod – intervali za početnike.', note: 'Puls: tempo u kome možeš da pričaš, ali ne i da pevaš. Svake nedelje produži glavni deo za 5 min.',
    workouts: [
      { name: 'Nedelja 1–2', intervals: [['hod', 300], ...Array(5).fill([['bicikl', 120], ['hod', 60]]).flat(), ['hod', 300]] },
      { name: 'Nedelja 3–4', intervals: [['hod', 300], ...Array(5).fill([['bicikl', 240], ['hod', 60]]).flat(), ['hod', 300]] },
      { name: 'Nedelja 5–6', intervals: [['hod', 300], ['bicikl', 1500], ['hod', 300]] },
    ] },
);
// ciljevi i trajanje za postojeće programe
Object.entries({
  pocetnik: [8, 'Osnovna snaga i navika vežbanja'], snaga: [8, 'Snaga celog tela bez opreme'], trcanje: [6, '20 min trčanja bez pauze'],
  'teretana-fb': [12, 'Osnovna snaga i tehnika sa šipkom'], '5x5': [12, 'Maksimalna snaga'], 'upper-lower': [12, 'Snaga i mišićna masa'], ppl: [12, 'Mišićna masa (hipertrofija)'],
  bucice: [8, 'Snaga i oblik kod kuće'], hiit: [6, 'Sagorevanje i kondicija'], tabata: [6, 'Kondicija i izdržljivost'], mobilnost: [0, 'Pokretljivost i manje ukočenosti'],
  ledja: [8, 'Jak trup i zdrava leđa'], trcanje10: [8, 'Trčanje 10 km'], povratak: [8, 'Bezbedan povratak u formu'],
}).forEach(([id, [w, g]]) => { const t = TRAININGS.find((x) => x.id === id); if (t) { t.weeks = t.weeks ?? w; t.goal = t.goal || g; } });

// oprema po programu (iz vežbi)
for (const t of TRAININGS) {
  const eq = new Set();
  for (const w of t.workouts) for (const [e] of (w.items || w.intervals)) { const q = (EXERCISES[e] || {}).equip; if (q && !/bez opreme|^$/.test(q)) q.split(/, | ili /).forEach((x) => eq.add(x)); }
  const NORM = { 'bučica': 'bučice', 'sajla i uže': 'sajla', 'kosa klupa': 'klupa', 'sprava': 'sprave', 'sprava za povlačenje': 'sprave', 'nožna presa': 'sprave', 'šipka za zgibove': 'šipka za zgibove', 'kauč': '', 'pod': '', 'zid': '', 'girja': '', 'stepenik': t.cat === 'teretana' ? '' : 'stepenik', 'šipka': t.cat === 'kuca' ? '' : 'šipka' };
  t.equipment = [...new Set([...eq].map((x) => (x in NORM ? NORM[x] : x)).filter(Boolean))];
}
