# Moj Asistent

Besplatni lični asistent: **podsetnici**, **liste za kupovinu** i **parking** – sa obaveštenjima.

## Instalacija

| Telefon | Kako | Obaveštenja |
|---|---|---|
| **Android** (preporučeno) | Preuzmi [moj-asistent.apk](https://github.com/fianketo/Moj-asistent/releases/latest/download/moj-asistent.apk), otvori ga i dozvoli „instalaciju iz nepoznatih izvora“. | Stižu i kad je aplikacija ugašena i posle restarta telefona. |
| **iPhone / računar** | Otvori <https://fianketo.github.io/Moj-asistent/> → Safari: Podeli → *Dodaj na početni ekran*. | Samo dok je aplikacija otvorena ili u pozadini. |

Za nekog drugog: pošalji mu jedan od ova dva linka (ili u aplikaciji *Podešavanja → Pošalji link*). Svako ima svoje podatke na svom telefonu.

## Šta zna

- **Podsetnici** – naziv, datum/vreme, „podseti me“ (u trenutku … 1 dan ranije), ponavljanje (dnevno, radnim danima, nedeljno, mesečno, godišnje), napomena. Brzi izbor: *za 1 sat, večeras, sutra 9h*.
- **Kupovina** – više lista, količina i jedinica (kom, kg, g, l, ml, pak) sa +/− dugmićima, katalog od preko 330 artikala po kategorijama, online pretraga proizvoda iz Srbije (Open Food Facts), lista grupisana po odeljenjima prodavnice, štikliranje, slanje liste preko Vibera/WhatsApp-a/SMS-a. 💰 otvara pretragu cena tog proizvoda na Cenoteci.
- **Parking** – Novi Sad: zona se sama prepoznaje po lokaciji na svakoj ulici (mapa zona iz katastra Parking servisa, 26.06.2026), a kad izađeš iz auta u zoni naplate stiže obaveštenje sa dugmetom za SMS. Ostali gradovi: aplikacija pamti mesta na kojima si platio. Izbor zone, plaćanje SMS-om (otvara poruku sa tablicom), odbrojavanje, obaveštenje *X min pre isteka* i *po isteku*, produžavanje, pamćenje lokacije auta. SMS brojevi su podešeni za Beograd i mogu se menjati u Podešavanjima.
- **Zdravlje** – 42 recepta (i posna), 11 nedeljnih planova ishrane (mediteranska, DASH, posna, vegetarijanska, mišićna masa, post 16:8, niski GI…) sa kupovinom za celu nedelju, 14 programa treninga (teretana: celo telo, 5×5, gornji/donji, PPL; kod kuće: bučice, HIIT, Tabata; trčanje; mobilnost i leđa) sa pamćenjem težina sa vođenim treningom (tajmer, serije, odmor) i podsetnicima.
- **Podešavanja** – status obaveštenja, probno obaveštenje, parking zone, izvoz/uvoz rezervne kopije.

## Tehnički

- `www/` – cela aplikacija (HTML/CSS/JS, bez build koraka). Lokalno: `npm run serve` → <http://localhost:8080>.
- `android/` – Capacitor omotač; obaveštenja zakazuje Android (`@capacitor/local-notifications`, tačni alarmi).
- GitHub Actions:
  - `android.yml` – na svaki push pravi APK; sa `main` grane ga objavljuje kao *Release* (link gore uvek vodi na najnoviji).
  - `pages.yml` – sa `main` grane objavljuje `www/` na `gh-pages` granu (Settings → Pages → *Deploy from a branch* → `gh-pages` / root).
- APK je potpisan ključem `android/app/asistent.keystore` (u repozitorijumu, da bi se nove verzije instalirale preko starih).
- Podaci su samo na uređaju (`localStorage`), nema servera ni naloga.

## Zone Novog Sada (`www/zones-ns.json`)

Napravljeno iz PDF-a „Tehnička baza sistema naplate – Parkirališta i parkomati“ (JKP Parking servis, 26.06.2026):
obojeni oblici parkirališta (boja = zona) izvučeni su iz PDF-a, poravnati sa OpenStreetMap ulicama
(šifre parkirališta ↔ zvanični spiskovi ulica po zonama, pa ICP; srednje odstupanje ~11 m od ose ulice)
i sačuvani kao tačke na ~8 m. Skripta: `data/novisad/build_zones.py`. Kad Parking servis objavi novi katastar,
treba ponovo izvući oblike i pokrenuti skriptu.
