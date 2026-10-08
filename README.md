# Moj Asistent

Lični asistent kao web aplikacija (PWA) — jedan HTML fajl, bez servera, potpuno besplatan.

- **Obaveze** – naziv, datum, vreme, podsetnik (u trenutku / 5 min … 1 dan ranije), ponavljanje (dnevno, nedeljno, mesečno, godišnje) i napomena. Grupisano na *Kasni / Danas / Sutra / Kasnije / Bez datuma / Završeno*. Kod ponavljajuće obaveze klik na ✓ je pomera na sledeći termin.
- **Brojevi** – važni brojevi po kategorijama (Parking, Hitno, Porodica…), poziv jednim klikom. Za *Parking* brojeve postoji 💬 dugme koje otvara SMS sa tvojom registarskom tablicom (upiši je u *Podešavanja*).
- **Obaveštenja** – podsetnik stiže kao obaveštenje na telefonu dok je aplikacija otvorena ili u pozadini. Za obaveze koje ne smeš da propustiš: *📅 Dodaj u kalendar* (ili *Google kalendar*) — alarm onda daje kalendar telefona i radi i kad je aplikacija ugašena.
- **Podaci** se čuvaju samo na uređaju (`localStorage`); u *Podešavanja* postoji izvoz/uvoz rezervne kopije (JSON).

Otvara se na `https://fianketo.github.io/moj-asistent/` (kad se uključi GitHub Pages: Settings → Pages → Deploy from branch → main / root). Instalacija: Android Chrome → ⋮ → *Instaliraj aplikaciju*; iPhone Safari → Podeli → *Dodaj na početni ekran* (obaveštenja na iPhone-u rade samo tako, iOS 16.4+).
