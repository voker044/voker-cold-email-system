# VOKER Outreach — Uputstvo za postavljanje

Kompletan sistem za personalizovani cold email (mail merge) iz tvog Gmail naloga,
kontrolisan iz Google Sheet-a. Sve podešavaš iz tabele — kod ne diraš.

---

## 1. Napravi Google Sheet

1. Idi na [sheets.google.com](https://sheets.google.com) i napravi **novu praznu tabelu**.
2. Nazovi je npr. **"VOKER Outreach"**.

> Ne moraš ručno da praviš tabove i kolone — skripta ima dugme **"Inicijalizuj tabele"**
> koje sve napravi za tebe (tabovi *Prospekti*, *Šabloni*, *Podešavanja*, *Log*,
> sa svim kolonama, padajućim listama za Status i Šablon, i svih 6 početnih šablona).

Za referencu, tab **Prospekti** ima ove kolone (A–Q):

| Kolona | Šta ide unutra |
|---|---|
| ID | Redni broj (za tvoju evidenciju) |
| Ime lokala | npr. "Kafana Zlatibor" |
| Grad | npr. "Beč" |
| Zemlja | Austrija / Nemačka / Švajcarska / Srbija |
| Prezime gazde | Samo prezime, npr. "Petrović". Ako ne znaš — ostavi prazno, pozdrav će biti samo "Poštovani," |
| Email | Adresa gazde |
| Telefon | Za tvoju evidenciju |
| Instagram | Za tvoju evidenciju |
| Sajt (nema/loš/ima) | Tvoja procena |
| Google ocena | npr. 4.7 |
| Info sa Maps | Beleške sa Google Maps (specijaliteti, recenzije...) |
| Lična rečenica | **Ključna kolona** — kratka personalizovana rečenica (vidi prompt na dnu) |
| Šablon | `DIJASPORA` ili `SRBIJA` (prazno = DIJASPORA) |
| Status | `NOVO` → `SPREMNO` → `POSLATO` → `FOLLOWUP1` → `FOLLOWUP2` → `ODGOVORIO` / `NE_KONTAKTIRATI` |
| Datum prvog mejla | Skripta upisuje sama |
| Datum poslednjeg kontakta | Skripta upisuje sama |
| Napomena | Skripta ovde upisuje greške i "Odgovorio!"; možeš i ti da pišeš |

**Zlatno pravilo:** skripta šalje **isključivo** redove sa statusom `SPREMNO`.
Ti status `SPREMNO` stavljaš **ručno**, tek kad upišeš Ličnu rečenicu. Bez toga — ništa ne ide.

---

## 2. Ubaci kod (Extensions → Apps Script)

1. U tabeli otvori meni **Extensions → Apps Script** (srp. *Proširenja → Apps Script*).
2. Otvara se editor sa praznim fajlom `Code.gs` (funkcija `myFunction`).
3. **Obriši sve** iz tog fajla i **nalepi ceo sadržaj** fajla `Code.gs` iz ovog foldera.
4. Klikni na ikonicu 💾 (**Save project**) ili `Ctrl+S`.
5. Nazovi projekat npr. "VOKER Outreach".

### Podesi vremensku zonu (važno za radno vreme!)

1. U Apps Script editoru klikni na **⚙️ Project Settings** (levo).
2. Pod **Time zone** izaberi **(GMT+01:00) Belgrade** (Europe/Belgrade).
   - Ako ne vidiš opciju: štikliraj *"Show appsscript.json manifest file"*, otvori
     `appsscript.json` i postavi `"timeZone": "Europe/Belgrade"`.

---

## 3. Autorizacija (prvi put)

1. Vrati se u tabelu i **osveži stranicu** (F5). Posle par sekundi pojavljuje se meni **"VOKER Outreach"** pored menija Help.
2. Klikni **VOKER Outreach → 🛠️ Inicijalizuj tabele**.
3. Google traži dozvole: klikni **Continue** → izaberi svoj nalog → pojaviće se upozorenje
   *"Google hasn't verified this app"* (normalno, jer je skripta tvoja, a ne iz prodavnice):
   klikni **Advanced → Go to VOKER Outreach (unsafe)** → **Allow**.
4. Ponovo klikni **Inicijalizuj tabele** — sada pravi sva 4 taba i ubacuje 6 šablona.

Skripta traži pristup Gmail-u (slanje + pretraga odgovora) i ovoj tabeli — ništa drugo.

---

## 4. Prvo testiranje (TEST MODE)

TEST MODE je **uključen po defaultu** (`TEST_MODE = DA` u tabu *Podešavanja*) —
svi mejlovi idu na **tvoju** adresu, sa oznakom `[TEST → prava@adresa]` u subject-u.

1. U tabu **Podešavanja** proveri da je `TEST_EMAIL` tvoja adresa.
2. U tab **Prospekti** ubaci probni red: izmišljen lokal, u Email stavi
   bilo koju adresu (npr. svoju drugu), upiši **Ličnu rečenicu**, Šablon `DIJASPORA`,
   Status **`SPREMNO`**.
3. Meni → **📤 Pošalji talas sada**.
4. Proveri svoj inbox: stigao ti je mejl, pozdrav i placeholderi su popunjeni,
   na dnu je P.S. za odjavu. U tabeli je Status prešao u `POSLATO` i upisani su datumi.
5. Testiraj i red **bez prezimena** — pozdrav mora da bude samo "Poštovani,".
6. Pogledaj **📊 Dnevni izveštaj** i tab **Log**.

> Test mejlovi se računaju u dnevni limit (štite i Gmail kvotu), pa nemoj da
> testiraš sa 50 redova.

---

## 5. Instalacija trigera (automatsko slanje)

Kad si zadovoljan testom:

1. Meni → **⏰ Instaliraj trigere**. Ovo pravi:
   - trigger koji na **svakih 30 minuta** pokreće slanje (Apps Script dozvoljava
     intervale 1/5/10/15/30 min, pa je 30 min izbor iz traženog opsega 20–30);
   - dnevni trigger u **8h ujutru** koji proverava odgovore.
2. Trigger sam pazi na sve: šalje **samo pon–pet 9–17h**, po **1–2 mejla po talasu**,
   **max 25 dnevno** — van toga se tiho ugasi. Svaki talas traje par sekundi,
   daleko ispod Apps Script limita od 6 minuta.
3. Za potpuni stop: meni → **🛑 Ukloni trigere**.

## 6. Prelazak na pravo slanje

1. Meni → **🧪 Test mode ON/OFF** (ili u *Podešavanja* stavi `TEST_MODE = NE`).
2. Od tog trenutka mejlovi idu **gazdama**. Proveri još jednom šablone i redove `SPREMNO`.

---

## Kako sistem radi iz dana u dan (tvoja rutina)

1. **Ubaciš nove gazde** u *Prospekti* (status ostaje `NOVO`).
2. **Generišeš Lične rečenice** (prompt ispod), nalepiš ih u kolonu L.
3. Redovima koje si pregledao staviš **`SPREMNO`** — skripta ih šalje kroz dan.
4. Follow-up ide **sam**: 3+ dana bez odgovora → `FOLLOWUP1`; posle još 7 dana → `FOLLOWUP2` (poslednji).
5. **Pre svakog follow-upa** skripta pretraži Gmail — ako je gazda odgovorio,
   status postaje `ODGOVORIO` i toj adresi se **više ništa ne šalje**. Ti samo odgovaraš iz Gmail-a.
6. Ako neko odgovori **"ne"** — ti ručno staviš **`NE_KONTAKTIRATI`** i skripta ga zauvek preskače.
7. S vremena na vreme klikni **📊 Dnevni izveštaj**.

### Menjanje tekstova mejlova

Sve je u tabu **Šabloni** — menjaš Subject i Telo direktno u ćeliji, bez diranja koda.
Placeholderi: `{{ime_lokala}}`, `{{grad}}`, `{{prezime}}`, `{{licna_recenica}}`.
Nazivi šablona moraju ostati isti: `GLAVNI_DIJASPORA`, `FOLLOWUP1_DIJASPORA`,
`FOLLOWUP2_DIJASPORA`, `GLAVNI_SRBIJA`, `FOLLOWUP1_SRBIJA`, `FOLLOWUP2_SRBIJA`.

### Podešavanja koja menjaš bez koda (tab "Podešavanja")

`TEST_MODE`, `TEST_EMAIL`, `DNEVNI_LIMIT`, `MAX_PO_TALASU`, `RADNO_VREME_OD`,
`RADNO_VREME_DO`, `DANA_DO_FOLLOWUP1`, `DANA_DO_FOLLOWUP2`.

---

## Rešavanje problema

- **Ne vidim meni "VOKER Outreach"** → osveži tabelu (F5); ako i dalje ne radi, proveri da je kod sačuvan u Apps Script editoru.
- **Mejl nije poslat, u Napomeni piše greška** → pročitaj napomenu: najčešće fali Lična rečenica ili je izmenjen naziv šablona.
- **Ništa se ne šalje automatski** → proveri: da li su trigeri instalirani (u Apps Script editoru: ⏰ Triggers levo), da li je radno vreme, da li ima redova `SPREMNO`, da li je limit potrošen (vidi Dnevni izveštaj).
- **Gmail limit** → običan Gmail nalog ima kvotu ~100–500 mejlova dnevno; naših 25 je duboko ispod, namerno, zbog reputacije i spam filtera. Ne dižite limit preko ~30.

---

## Prompt za batch generisanje "Lične rečenice" (Claude chat)

Kopiraj ovo u običan Claude chat, na kraj nalepi listu do 20 lokala:

```
Ti si moj copywriter za personalizaciju cold mejlova. Ja sam Lazar, vodim web
agenciju VOKER iz Pirota i šaljem ponude za izradu sajtova vlasnicima restorana,
kafana i kafića (balkanska dijaspora u Austriji/Nemačkoj/Švajcarskoj i gazde u Srbiji).

U mom mejlu rečenica ide TAČNO na ovo mesto:
"Našao sam {{ime_lokala}} na Google mapi - [TVOJA REČENICA] Ali primetio sam da
nemate sajt ili se loše otvara na telefonu..."

Za svaki lokal iz liste ispod napiši JEDNU ličnu rečenicu koja se uklapa na to
mesto. Pravila:
1. Srpski jezik, prirodan govorni ton (kao da pišem ja lično, ne marketing).
2. 10–20 reči, počinje malim slovom (nastavlja se posle crtice), završava tačkom.
3. Mora da pomene NEŠTO KONKRETNO za taj lokal: ocenu ako je visoka (4.5+),
   specijalitet, atmosferu ili nešto iz recenzija/info sa Maps.
4. Iskren kompliment, bez preterivanja i bez uzvičnika. Ako nema ničeg posebnog
   u podacima, iskoristi grad ili tip lokala, nemoj da izmišljaš činjenice.
5. Bez ponavljanja iste formulacije — svaka rečenica različita konstrukcija.
6. STROGO ZABRANJENA duga crta "—" bilo gde u rečenici (deluje veštački,
   kao da je pisao AI). Koristi zarez ili tačku umesto nje.

Primer dobre rečenice:
"svaka čast na oceni 4,8, gosti u recenzijama posebno hvale vaše ćevape i domaću atmosferu."

Format odgovora: samo lista, jedan red po lokalu, format
ID | rečenica
bez ikakvog dodatnog teksta, da mogu direktno da nalepim u Google Sheet.

Evo liste (ID | ime lokala | grad | Google ocena | info sa Maps):
[OVDE NALEPI SVOJU LISTU]
```

Rezultat lepiš u kolonu **Lična rečenica**, pregledaš svaku (obavezno!),
pa tek onda staviš status `SPREMNO`.

---

*VOKER — Pirot. Srećan lov! 🎯*
