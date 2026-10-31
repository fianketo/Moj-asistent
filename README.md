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
- **Kupovina** – više lista (Prodavnica, Pijaca, Apoteka…), predlozi proizvoda, „2 mleko“ upisuje količinu, štikliranje, slanje liste preko Vibera/WhatsApp-a/SMS-a. 💰 otvara pretragu cena tog proizvoda na Cenoteci.
- **Parking** – izbor zone, plaćanje SMS-om (otvara poruku sa tablicom), odbrojavanje, obaveštenje *X min pre isteka* i *po isteku*, produžavanje, pamćenje lokacije auta. SMS brojevi su podešeni za Beograd i mogu se menjati u Podešavanjima.
- **Podešavanja** – status obaveštenja, probno obaveštenje, parking zone, izvoz/uvoz rezervne kopije.

## Tehnički

- `www/` – cela aplikacija (HTML/CSS/JS, bez build koraka). Lokalno: `npm run serve` → <http://localhost:8080>.
- `android/` – Capacitor omotač; obaveštenja zakazuje Android (`@capacitor/local-notifications`, tačni alarmi).
- GitHub Actions:
  - `android.yml` – na svaki push pravi APK; sa `main` grane ga objavljuje kao *Release* (link gore uvek vodi na najnoviji).
  - `pages.yml` – sa `main` grane objavljuje `www/` na `gh-pages` granu (Settings → Pages → *Deploy from a branch* → `gh-pages` / root).
- APK je potpisan ključem `android/app/asistent.keystore` (u repozitorijumu, da bi se nove verzije instalirale preko starih).
- Podaci su samo na uređaju (`localStorage`), nema servera ni naloga.
