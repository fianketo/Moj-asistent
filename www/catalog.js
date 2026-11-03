/* Katalog artikala po kategorijama (redosled ≈ raspored u prodavnici).
 * Svaki artikal: [naziv, podrazumevana jedinica]. */
'use strict';
const UNITS = ['kom', 'kg', 'g', 'l', 'ml', 'pak'];
const CATALOG = [
  { cat: 'Voće i povrće', icon: '🥬', items: [
    ['Krompir', 'kg'], ['Mladi krompir', 'kg'], ['Crni luk', 'kg'], ['Beli luk', 'kom'], ['Mladi luk', 'pak'], ['Praziluk', 'kom'],
    ['Paradajz', 'kg'], ['Čeri paradajz', 'pak'], ['Krastavac', 'kg'], ['Paprika', 'kg'], ['Babura', 'kg'], ['Ljuta paprika', 'kom'],
    ['Šargarepa', 'kg'], ['Peršun (list)', 'pak'], ['Peršun (koren)', 'kom'], ['Celer', 'kom'], ['Mirođija', 'pak'], ['Kupus', 'kom'],
    ['Kelj', 'kom'], ['Karfiol', 'kom'], ['Brokoli', 'kom'], ['Tikvice', 'kg'], ['Plavi patlidžan', 'kg'], ['Zelena salata', 'kom'],
    ['Zelena salata (miks)', 'pak'], ['Rukola', 'pak'], ['Spanać', 'pak'], ['Blitva', 'pak'], ['Cvekla', 'kg'], ['Rotkvice', 'pak'],
    ['Boranija', 'kg'], ['Grašak', 'kg'], ['Kukuruz šećerac', 'kom'], ['Pečurke', 'pak'], ['Bundeva', 'kg'], ['Đumbir', 'g'], ['Rotkvice (veza)', 'pak'], ['Ruzmarin (svež)', 'pak'], ['Kiseli kupus', 'kom'], ['Šampinjoni', 'pak'],
    ['Jabuke', 'kg'], ['Kruške', 'kg'], ['Banane', 'kg'], ['Pomorandže', 'kg'], ['Mandarine', 'kg'], ['Limun', 'kom'], ['Limeta', 'kom'],
    ['Grejpfrut', 'kom'], ['Grožđe', 'kg'], ['Jagode', 'pak'], ['Maline', 'pak'], ['Borovnice', 'pak'], ['Trešnje', 'kg'],
    ['Višnje', 'kg'], ['Kajsije', 'kg'], ['Breskve', 'kg'], ['Nektarine', 'kg'], ['Šljive', 'kg'], ['Lubenica', 'kom'], ['Dinja', 'kom'],
    ['Kivi', 'kom'], ['Ananas', 'kom'], ['Avokado', 'kom'], ['Nar', 'kom'], ['Smokve', 'kg'], ['Dunja', 'kg'],
  ] },
  { cat: 'Pekara', icon: '🍞', items: [
    ['Hleb', 'kom'], ['Beli hleb', 'kom'], ['Polubeli hleb', 'kom'], ['Crni / integralni hleb', 'kom'], ['Raženi hleb', 'kom'],
    ['Tost hleb', 'kom'], ['Kifle', 'kom'], ['Pecivo', 'kom'], ['Lepinje', 'kom'], ['Somun', 'kom'], ['Baguet', 'kom'],
    ['Burek', 'kom'], ['Pita', 'kom'], ['Kroasan', 'kom'], ['Đevrek', 'kom'], ['Tortilje', 'pak'], ['Prezle', 'pak'],
    ['Kore za pitu', 'pak'], ['Lisnato testo', 'pak'], ['Kvasac', 'kom'], ['Kore za lazanje', 'pak'], ['Piškote', 'pak'], ['Hlebne mrvice', 'pak'],
  ] },
  { cat: 'Mlečni proizvodi i jaja', icon: '🥛', items: [
    ['Mleko', 'l'], ['Dugotrajno mleko', 'l'], ['Sveže mleko', 'l'], ['Mleko bez laktoze', 'l'], ['Jogurt', 'kom'], ['Kiselo mleko', 'kom'],
    ['Kefir', 'kom'], ['Grčki jogurt', 'kom'], ['Voćni jogurt', 'kom'], ['Pavlaka (kisela)', 'kom'], ['Slatka pavlaka', 'kom'],
    ['Pavlaka za kuvanje', 'kom'], ['Kajmak', 'g'], ['Mladi sir', 'g'], ['Sitni sir', 'g'], ['Beli sir', 'g'], ['Feta sir', 'kom'],
    ['Krem sir', 'kom'], ['Topljeni sir', 'kom'], ['Trapist', 'g'], ['Gauda', 'g'], ['Edamer', 'g'], ['Kačkavalj', 'g'],
    ['Mocarela', 'kom'], ['Parmezan', 'g'], ['Sir u listićima', 'pak'], ['Puter', 'kom'], ['Margarin', 'kom'], ['Puding', 'kom'],
    ['Jaja', 'kom'], ['Prepeličja jaja', 'pak'],
  ] },
  { cat: 'Meso i riba', icon: '🥩', items: [
    ['Pileći file', 'kg'], ['Piletina (celo pile)', 'kom'], ['Pileći batak', 'kg'], ['Pileća krilca', 'kg'], ['Ćuretina', 'kg'],
    ['Svinjski vrat', 'kg'], ['Svinjski but', 'kg'], ['Svinjska rebra', 'kg'], ['Svinjski kotlet', 'kg'], ['Junetina', 'kg'],
    ['Junetina za supu', 'kg'], ['Biftek', 'kg'], ['Teletina', 'kg'], ['Jagnjetina', 'kg'], ['Mleveno meso (mešano)', 'kg'],
    ['Mleveno junece meso', 'kg'], ['Ćevapi', 'kg'], ['Pljeskavica', 'kom'], ['Kobasice', 'kg'], ['Viršle', 'pak'], ['Slanina', 'g'],
    ['Šunka', 'g'], ['Pileća prsa (narezak)', 'g'], ['Pršuta', 'g'], ['Kulen', 'g'], ['Čajna kobasica', 'g'], ['Salama', 'g'],
    ['Pašteta', 'kom'], ['Riba (sveža)', 'kg'], ['Oslić', 'kg'], ['Losos', 'kg'], ['Pastrmka', 'kg'], ['Šaran', 'kg'],
    ['Lignje', 'kg'], ['Škampi', 'pak'], ['Tunjevina (konzerva)', 'kom'], ['Sardine (konzerva)', 'kom'], ['Riblji štapići', 'pak'], ['Skuša', 'kg'], ['Som', 'kg'], ['Bakalar', 'kg'], ['Dagnje', 'kg'], ['Pileća džigerica', 'kg'], ['Suva rebra', 'kg'], ['Suvi vrat', 'g'],
  ] },
  { cat: 'Smrznuto', icon: '🧊', items: [
    ['Smrznuto povrće', 'pak'], ['Smrznuti grašak', 'pak'], ['Pomfrit', 'pak'], ['Smrznuta pica', 'kom'], ['Smrznute pljeskavice', 'pak'],
    ['Smrznuto voće', 'pak'], ['Sladoled', 'kom'], ['Led', 'pak'], ['Smrznuti burek', 'pak'],
  ] },
  { cat: 'Namirnice', icon: '🥫', items: [
    ['Brašno T-400', 'kg'], ['Brašno T-500', 'kg'], ['Integralno brašno', 'kg'], ['Kukuruzno brašno', 'kg'], ['Griz', 'kg'],
    ['Šećer', 'kg'], ['Šećer u prahu', 'pak'], ['Smeđi šećer', 'kg'], ['So', 'kg'], ['Morska so', 'kg'], ['Suncokretovo ulje', 'l'],
    ['Maslinovo ulje', 'l'], ['Sirće', 'l'], ['Aceto balsamico', 'kom'], ['Pirinač', 'kg'], ['Špagete', 'pak'], ['Testenina (penne)', 'pak'],
    ['Makarone', 'pak'], ['Rezanci za supu', 'pak'], ['Pasulj', 'kg'], ['Sočivo', 'kg'], ['Leblebije', 'kom'], ['Ovsene pahuljice', 'pak'],
    ['Kornfleks / musli', 'pak'], ['Paradajz pire', 'kom'], ['Pasirani paradajz', 'kom'], ['Kečap', 'kom'], ['Majonez', 'kom'],
    ['Senf', 'kom'], ['Ajvar', 'kom'], ['Kiseli krastavčići', 'kom'], ['Kisela paprika', 'kom'], ['Masline', 'kom'], ['Kukuruz (konzerva)', 'kom'],
    ['Pasulj (konzerva)', 'kom'], ['Supa iz kesice', 'kom'], ['Kocka za supu', 'pak'], ['Vegeta', 'kom'], ['Biber', 'kom'],
    ['Aleva paprika', 'kom'], ['Origano', 'kom'], ['Bosiljak', 'kom'], ['Lovorov list', 'kom'], ['Cimet', 'kom'], ['Vanilin šećer', 'pak'],
    ['Prašak za pecivo', 'pak'], ['Soda bikarbona', 'kom'], ['Želatin', 'pak'], ['Med', 'kom'], ['Džem', 'kom'], ['Pekmez', 'kom'],
    ['Eurokrem / namaz', 'kom'], ['Kikiriki puter', 'kom'], ['Orasi', 'g'], ['Lešnici', 'g'], ['Bademi', 'g'], ['Suvo grožđe', 'g'],
    ['Mak', 'g'], ['Kokos', 'g'], ['Kakao', 'kom'], ['Čokolada za kuvanje', 'kom'], ['Kinoa', 'g'], ['Kus-kus', 'g'], ['Heljda', 'g'], ['Ječam', 'g'], ['Bulgur', 'g'], ['Njoke', 'pak'], ['Soja sos', 'kom'], ['Kari', 'kom'], ['Kurkuma', 'kom'], ['Kokosovo mleko', 'kom'], ['Susam', 'g'], ['Čia semenke', 'g'], ['Laneno seme', 'g'], ['Mascarpone', 'kom'], ['Gustin (skrob)', 'pak'], ['Pšenica (žito)', 'g'], ['Suve šljive', 'g'], ['Urme', 'g'], ['Kim', 'kom'], ['Muskatni oraščić', 'kom'], ['Peršun (suvi)', 'kom'], ['Mirođija (suva)', 'kom'], ['Ljuta paprika (mlevena)', 'kom'], ['Ajvar (domaći)', 'kom'], ['Senf (dižon)', 'kom'], ['Pesto', 'kom'], ['Tofu', 'pak'],
  ] },
  { cat: 'Slatkiši i grickalice', icon: '🍫', items: [
    ['Čokolada', 'kom'], ['Keks', 'pak'], ['Petit beurre keks', 'pak'], ['Napolitanke', 'pak'], ['Bombone', 'pak'], ['Žvake', 'kom'],
    ['Smoki', 'kom'], ['Čips', 'kom'], ['Štapići', 'kom'], ['Kokice', 'kom'], ['Kikiriki', 'kom'], ['Semenke', 'kom'],
    ['Krekeri', 'pak'], ['Pločica (bar)', 'kom'], ['Rolat / kolač', 'kom'],
  ] },
  { cat: 'Piće', icon: '🥤', items: [
    ['Voda (negazirana)', 'l'], ['Kisela voda', 'l'], ['Voda 6×1,5 l', 'pak'], ['Sok od pomorandže', 'l'], ['Sok od jabuke', 'l'],
    ['Multivitamin sok', 'l'], ['Gusti sok', 'l'], ['Koka-kola / gazirani sok', 'l'], ['Ledeni čaj', 'l'], ['Energetsko piće', 'kom'],
    ['Pivo', 'kom'], ['Pivo (gajba)', 'pak'], ['Belo vino', 'kom'], ['Crveno vino', 'kom'], ['Rakija', 'kom'], ['Viski', 'kom'],
    ['Kafa (mlevena)', 'g'], ['Kafa u zrnu', 'g'], ['Instant kafa', 'kom'], ['Espreso kapsule', 'pak'], ['Kapućino kesice', 'pak'],
    ['Čaj', 'pak'], ['Kamilica', 'pak'], ['Nana', 'pak'],
  ] },
  { cat: 'Bebe i deca', icon: '🍼', items: [
    ['Pelene', 'pak'], ['Vlažne maramice', 'pak'], ['Adaptirano mleko', 'kom'], ['Dečija kašica', 'kom'], ['Dečiji sok', 'kom'],
    ['Dečiji keks', 'pak'], ['Krema za bebe', 'kom'],
  ] },
  { cat: 'Kućna hemija', icon: '🧽', items: [
    ['Deterdžent za veš', 'kom'], ['Omekšivač', 'kom'], ['Kapsule za veš', 'pak'], ['Odstranjivač fleka', 'kom'],
    ['Deterdžent za sudove', 'kom'], ['Tablete za sudo-mašinu', 'pak'], ['So za sudo-mašinu', 'kom'], ['Sjaj za sudo-mašinu', 'kom'],
    ['Sredstvo za kupatilo', 'kom'], ['Sredstvo za WC', 'kom'], ['Sredstvo za staklo', 'kom'], ['Sredstvo za pod', 'kom'],
    ['Varikina', 'kom'], ['Odmašćivač', 'kom'], ['Osveživač prostora', 'kom'], ['Sunđeri', 'pak'], ['Krpe', 'pak'],
    ['Kese za smeće', 'pak'], ['Gumene rukavice', 'pak'], ['Alu folija', 'kom'], ['Prijanjajuća folija', 'kom'], ['Papir za pečenje', 'kom'],
    ['Kese za zamrzivač', 'pak'], ['Sijalica', 'kom'], ['Baterije', 'pak'], ['Šibice / upaljač', 'kom'],
  ] },
  { cat: 'Lična higijena', icon: '🧴', items: [
    ['Toalet papir', 'pak'], ['Papirni ubrusi', 'pak'], ['Salvete', 'pak'], ['Papirne maramice', 'pak'], ['Sapun', 'kom'],
    ['Tečni sapun', 'kom'], ['Gel za tuširanje', 'kom'], ['Šampon', 'kom'], ['Regenerator', 'kom'], ['Pasta za zube', 'kom'],
    ['Četkica za zube', 'kom'], ['Konac za zube', 'kom'], ['Tečnost za ispiranje usta', 'kom'], ['Dezodorans', 'kom'],
    ['Brijači', 'pak'], ['Pena za brijanje', 'kom'], ['Krema za lice', 'kom'], ['Krema za ruke', 'kom'], ['Losion za telo', 'kom'],
    ['Štapići za uši', 'pak'], ['Vata', 'pak'], ['Higijenski ulošci', 'pak'], ['Tamponi', 'pak'], ['Flasteri', 'pak'],
  ] },
  { cat: 'Ljubimci', icon: '🐾', items: [
    ['Hrana za pse (suva)', 'kg'], ['Hrana za pse (konzerva)', 'kom'], ['Hrana za mačke (suva)', 'kg'], ['Hrana za mačke (kesice)', 'kom'],
    ['Posip za mačke', 'kg'], ['Poslastice za ljubimce', 'pak'],
  ] },
  { cat: 'Apoteka', icon: '💊', items: [
    ['Paracetamol / Febricet', 'pak'], ['Brufen', 'pak'], ['Vitamin C', 'pak'], ['Vitamin D', 'kom'], ['Magnezijum', 'pak'],
    ['Probiotik', 'pak'], ['Kapi za nos', 'kom'], ['Sirup za kašalj', 'kom'], ['Toplomer', 'kom'], ['Zavoj', 'kom'], ['Dezinfekciono sredstvo', 'kom'],
  ] },
];
// Brza pretraga: naziv (mala slova) → {name, unit, cat}
const CATALOG_INDEX = new Map();
for (const g of CATALOG) for (const [name, unit] of g.items) CATALOG_INDEX.set(name.toLowerCase(), { name, unit, cat: g.cat });
