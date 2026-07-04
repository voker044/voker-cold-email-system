# VOKER Cold Email System

Google Apps Script sistem za personalizovani cold email outreach (mail merge)
iz Gmail naloga + Google Sheet-a. Ponude za izradu sajtova ugostiteljima na dva
tržišta: balkanska dijaspora (Austrija/Nemačka/Švajcarska) i Srbija.

## Fajlovi

- **`Code.gs`** — kompletna skripta, copy-paste u Apps Script editor (Extensions → Apps Script)
- **`UPUTSTVO.md`** — postavljanje korak po korak + prompt za batch generisanje "Lične rečenice"

## Ukratko

- Šalje samo redove sa statusom `SPREMNO` (ručna kontrola), max 25/dan, pon–pet 9–17h CET
- Trigger na 30 min šalje 1–2 mejla po talasu (Apps Script-safe, ispod 6 min limita)
- Automatski follow-up posle 3 i još 7 dana; pre svakog slanja proverava Gmail za odgovor
- Dva seta šablona (DIJASPORA / SRBIJA) u tabu "Šabloni" — menjaju se bez diranja koda
- TEST MODE, custom meni "VOKER Outreach", dnevni izveštaj po tržištu
