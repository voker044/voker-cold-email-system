/**
 * =====================================================================
 *  VOKER OUTREACH — sistem za personalizovani cold email (mail merge)
 * =====================================================================
 *  Autor: Lazar (VOKER, Pirot) + Claude
 *
 *  ŠTA RADI:
 *  - Šalje personalizovane ponude iz Gmail naloga na osnovu Google Sheet-a
 *  - Dva tržišta / dva seta šablona: DIJASPORA i SRBIJA (kolona "Šablon")
 *  - Šalje ISKLJUČIVO redove sa statusom SPREMNO
 *  - Automatski follow-up: 3+ dana → FOLLOWUP1, pa još 7 dana → FOLLOWUP2
 *  - Pre svakog follow-upa proverava Gmail da li je gazda odgovorio
 *  - Max 25 mejlova dnevno, raspoređeno kroz dan (trigger na 30 min,
 *    šalje 1–2 mejla po talasu), samo radnim danima 9–17h
 *  - TEST MODE: svi mejlovi idu na tvoju adresu umesto gazdama
 *
 *  TABOVI KOJE SKRIPTA KORISTI (pravi ih meni "Inicijalizuj tabele"):
 *  - "Prospekti"   — lista gazdi
 *  - "Šabloni"     — tekstovi mejlova (menjaš bez diranja koda)
 *  - "Podešavanja" — test mode, limit, radno vreme...
 *  - "Log"         — evidencija svakog poslatog mejla (za izveštaj i limit)
 * =====================================================================
 */

// ============================ KONSTANTE ==============================

var TAB_PROSPEKTI   = 'Prospekti';
var TAB_SABLONI     = 'Šabloni';
var TAB_PODESAVANJA = 'Podešavanja';
var TAB_LOG         = 'Log';

// Vremenska zona za radno vreme i datume (CET/CEST)
var VREMENSKA_ZONA = 'Europe/Belgrade';

// Ime pošiljaoca koje gazda vidi u inboxu
var IME_POSILJAOCA = 'Lazar — VOKER';

// P.S. koji se lepi na dno SVAKOG mejla (opt-out)
var PS_TEKST = "P.S. Ako ne želite ovakve poruke, samo odgovorite 'ne' i brišem vas sa liste.";

// Redni brojevi kolona u tabu "Prospekti" (1 = kolona A)
var KOL = {
  ID: 1,
  IME_LOKALA: 2,
  GRAD: 3,
  ZEMLJA: 4,
  PREZIME: 5,
  EMAIL: 6,
  TELEFON: 7,
  INSTAGRAM: 8,
  SAJT: 9,
  OCENA: 10,
  INFO_MAPS: 11,
  LICNA_RECENICA: 12,
  SABLON: 13,
  STATUS: 14,
  DATUM_PRVOG: 15,
  DATUM_POSLEDNJEG: 16,
  NAPOMENA: 17
};

// Statusi kroz koje red prolazi
var STATUS = {
  NOVO: 'NOVO',
  SPREMNO: 'SPREMNO',
  POSLATO: 'POSLATO',
  FOLLOWUP1: 'FOLLOWUP1',
  FOLLOWUP2: 'FOLLOWUP2',
  ODGOVORIO: 'ODGOVORIO',
  NE_KONTAKTIRATI: 'NE_KONTAKTIRATI'
};

// ============================== MENI =================================

/**
 * Pravi custom meni "VOKER Outreach" svaki put kad otvoriš Sheet.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('VOKER Outreach')
    .addItem('📤 Pošalji talas sada', 'posaljiTalasRucno')
    .addItem('📥 Proveri odgovore', 'proveriOdgovoreRucno')
    .addItem('🧪 Test mode ON/OFF', 'prebaciTestMode')
    .addItem('📊 Dnevni izveštaj', 'dnevniIzvestaj')
    .addSeparator()
    .addItem('⏰ Instaliraj trigere (automatsko slanje)', 'instalirajTrigere')
    .addItem('🛑 Ukloni trigere (stopiraj sve)', 'ukloniTrigere')
    .addSeparator()
    .addItem('🛠️ Inicijalizuj tabele (prvi put)', 'inicijalizujTabele')
    .addToUi();
}

// ========================== PODEŠAVANJA ==============================

/**
 * Čita tab "Podešavanja" (kolona A = naziv, kolona B = vrednost)
 * i vraća objekat sa svim podešavanjima. Ako nešto fali, koristi default.
 */
function ucitajPodesavanja() {
  var sheet = SpreadsheetApp.getActive().getSheetByName(TAB_PODESAVANJA);
  var mapa = {};
  if (sheet) {
    var podaci = sheet.getDataRange().getValues();
    for (var i = 0; i < podaci.length; i++) {
      var kljuc = String(podaci[i][0]).trim();
      if (kljuc) mapa[kljuc] = podaci[i][1];
    }
  }
  return {
    testMode:      String(mapa['TEST_MODE'] || 'DA').trim().toUpperCase() === 'DA',
    testEmail:     String(mapa['TEST_EMAIL'] || Session.getActiveUser().getEmail()).trim(),
    dnevniLimit:   Number(mapa['DNEVNI_LIMIT']) || 25,
    maxPoTalasu:   Number(mapa['MAX_PO_TALASU']) || 2,
    radnoOd:       Number(mapa['RADNO_VREME_OD']) || 9,
    radnoDo:       Number(mapa['RADNO_VREME_DO']) || 17,
    danaFollowup1: Number(mapa['DANA_DO_FOLLOWUP1']) || 3,
    danaFollowup2: Number(mapa['DANA_DO_FOLLOWUP2']) || 7
  };
}

/**
 * Meni: uključuje/isključuje TEST MODE u tabu "Podešavanja".
 */
function prebaciTestMode() {
  var sheet = SpreadsheetApp.getActive().getSheetByName(TAB_PODESAVANJA);
  var ui = SpreadsheetApp.getUi();
  if (!sheet) {
    ui.alert('Nema taba "Podešavanja". Prvo pokreni "Inicijalizuj tabele".');
    return;
  }
  var podaci = sheet.getDataRange().getValues();
  for (var i = 0; i < podaci.length; i++) {
    if (String(podaci[i][0]).trim() === 'TEST_MODE') {
      var trenutno = String(podaci[i][1]).trim().toUpperCase() === 'DA';
      var novo = trenutno ? 'NE' : 'DA';
      sheet.getRange(i + 1, 2).setValue(novo);
      ui.alert(novo === 'DA'
        ? '🧪 TEST MODE je UKLJUČEN — svi mejlovi idu na TVOJU adresu.'
        : '🔴 TEST MODE je ISKLJUČEN — mejlovi idu GAZDAMA! Proveri sve pre slanja.');
      return;
    }
  }
  ui.alert('Nisam našao red "TEST_MODE" u tabu "Podešavanja".');
}

// ===================== GLAVNA LOGIKA SLANJA ==========================

/**
 * Funkcija koju poziva time-based trigger (na svakih 30 min).
 * Lock sprečava da se dva izvršavanja preklope.
 */
function posaljiTalas() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return; // već radi drugo izvršavanje — preskoči
  try {
    posaljiTalasInterno(false);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Meni: "Pošalji talas sada" — isto kao trigger, ali:
 * - preskače proveru radnog vremena (ti si kliknuo, ti znaš)
 * - na kraju prikaže poruku šta je urađeno
 */
function posaljiTalasRucno() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    SpreadsheetApp.getUi().alert('Slanje je već u toku, sačekaj minut.');
    return;
  }
  var poruka;
  try {
    poruka = posaljiTalasInterno(true);
  } finally {
    lock.releaseLock();
  }
  SpreadsheetApp.getUi().alert(poruka);
}

/**
 * Srce sistema: bira koga treba kontaktirati i šalje 1–2 mejla po talasu.
 *
 * Redosled prioriteta u talasu:
 *   1. FOLLOWUP2 koji su dospeli (da se niz ne prekine)
 *   2. FOLLOWUP1 koji su dospeli
 *   3. Novi mejlovi (status SPREMNO)
 *
 * @param {boolean} rucno - true kad je pokrenuto iz menija (preskače radno vreme)
 * @return {string} poruka za korisnika šta je urađeno
 */
function posaljiTalasInterno(rucno) {
  var pod = ucitajPodesavanja();

  // 1) Radno vreme: samo radnim danima, 9–17h (trigger poštuje, ručno ne)
  if (!rucno && !jeRadnoVreme(pod)) {
    return 'Van radnog vremena (pon–pet ' + pod.radnoOd + '–' + pod.radnoDo + 'h) — ništa nije poslato.';
  }

  // 2) Dnevni limit
  var poslatoDanas = brojPoslatihDanas();
  var preostalo = pod.dnevniLimit - poslatoDanas;
  if (preostalo <= 0) {
    return 'Dnevni limit od ' + pod.dnevniLimit + ' mejlova je dostignut — ništa nije poslato.';
  }
  var zaOvajTalas = Math.min(pod.maxPoTalasu, preostalo);

  var sheet = SpreadsheetApp.getActive().getSheetByName(TAB_PROSPEKTI);
  if (!sheet) return 'Nema taba "Prospekti". Pokreni "Inicijalizuj tabele".';
  var podaci = sheet.getDataRange().getValues();

  // 3) Skupi kandidate za slanje
  var followupi2 = [];
  var followupi1 = [];
  var novi = [];
  var danas = new Date();

  for (var i = 1; i < podaci.length; i++) { // preskačemo red 1 (zaglavlje)
    var red = podaci[i];
    var status = String(red[KOL.STATUS - 1]).trim().toUpperCase();
    var email = String(red[KOL.EMAIL - 1]).trim();

    // Bez validnog mejla nema slanja; ODGOVORIO i NE_KONTAKTIRATI se ZAUVEK preskaču
    if (!email || email.indexOf('@') === -1) continue;
    if (status === STATUS.ODGOVORIO || status === STATUS.NE_KONTAKTIRATI) continue;

    if (status === STATUS.SPREMNO) {
      novi.push({ brojReda: i + 1, tip: 'GLAVNI' });

    } else if (status === STATUS.POSLATO) {
      // FOLLOWUP1: 3+ dana od PRVOG mejla
      var datumPrvog = kaoDatum(red[KOL.DATUM_PRVOG - 1]);
      if (datumPrvog && danaIzmedju(datumPrvog, danas) >= pod.danaFollowup1) {
        followupi1.push({ brojReda: i + 1, tip: 'FOLLOWUP1' });
      }

    } else if (status === STATUS.FOLLOWUP1) {
      // FOLLOWUP2: još 7 dana od POSLEDNJEG kontakta (tj. od follow-upa 1)
      var datumPoslednjeg = kaoDatum(red[KOL.DATUM_POSLEDNJEG - 1]);
      if (datumPoslednjeg && danaIzmedju(datumPoslednjeg, danas) >= pod.danaFollowup2) {
        followupi2.push({ brojReda: i + 1, tip: 'FOLLOWUP2' });
      }
    }
    // Status NOVO se ne dira — čeka da ti upišeš Ličnu rečenicu i staviš SPREMNO
  }

  var kandidati = followupi2.concat(followupi1).concat(novi);
  if (kandidati.length === 0) {
    return 'Nema nikog za slanje (nema SPREMNO redova ni dospelih follow-upova).';
  }

  // 4) Šalji jedan po jedan dok ne potrošimo talas
  var poslato = 0;
  var oznacenoOdgovorio = 0;
  var greske = [];

  for (var k = 0; k < kandidati.length && poslato < zaOvajTalas; k++) {
    var kandidat = kandidati[k];
    var r = kandidat.brojReda;
    var vrednosti = sheet.getRange(r, 1, 1, KOL.NAPOMENA).getValues()[0];
    var emailGazde = String(vrednosti[KOL.EMAIL - 1]).trim();

    // 4a) PRE svakog follow-upa: da li je gazda odgovorio?
    if (kandidat.tip !== 'GLAVNI') {
      var datumPrvogMejla = kaoDatum(vrednosti[KOL.DATUM_PRVOG - 1]);
      if (imaOdgovor(emailGazde, datumPrvogMejla)) {
        sheet.getRange(r, KOL.STATUS).setValue(STATUS.ODGOVORIO);
        dopisiNapomenu(sheet, r, 'Odgovorio — proveri inbox!');
        oznacenoOdgovorio++;
        continue; // ovoj adresi se više ništa ne šalje
      }
    }

    // 4b) Sigurnosna provera za prvi mejl: mora postojati Lična rečenica
    if (kandidat.tip === 'GLAVNI' && !String(vrednosti[KOL.LICNA_RECENICA - 1]).trim()) {
      dopisiNapomenu(sheet, r, 'PRESKOČENO: nema Lične rečenice iako je status SPREMNO.');
      greske.push('Red ' + r + ': nema Lične rečenice');
      continue;
    }

    // 4c) Izbor šablona: GLAVNI/FOLLOWUP1/FOLLOWUP2 + _DIJASPORA ili _SRBIJA
    var trziste = String(vrednosti[KOL.SABLON - 1]).trim().toUpperCase();
    if (trziste !== 'SRBIJA') trziste = 'DIJASPORA'; // prazno ili bilo šta drugo → DIJASPORA
    var nazivSablona = kandidat.tip + '_' + trziste;
    var sablon = nadjiSablon(nazivSablona);
    if (!sablon) {
      dopisiNapomenu(sheet, r, 'GREŠKA: nema šablona "' + nazivSablona + '" u tabu Šabloni.');
      greske.push('Red ' + r + ': fali šablon ' + nazivSablona);
      continue;
    }

    // 4d) Popuni placeholdere i zalepi P.S.
    var subject = popuniPlaceholdere(sablon.subject, vrednosti);
    var telo = popuniPlaceholdere(sablon.telo, vrednosti) + '\n\n' + PS_TEKST;

    // 4e) TEST MODE: sve ide na tvoju adresu, subject dobija oznaku
    var primalac = emailGazde;
    if (pod.testMode) {
      primalac = pod.testEmail;
      subject = '[TEST → ' + emailGazde + '] ' + subject;
    }

    // 4f) Slanje — plain text, bez priloga
    try {
      GmailApp.sendMail(primalac, subject, telo, { name: IME_POSILJAOCA });
    } catch (e) {
      dopisiNapomenu(sheet, r, 'GREŠKA pri slanju: ' + e.message);
      greske.push('Red ' + r + ': ' + e.message);
      continue;
    }

    // 4g) Upis statusa i datuma
    var sada = new Date();
    if (kandidat.tip === 'GLAVNI') {
      sheet.getRange(r, KOL.STATUS).setValue(STATUS.POSLATO);
      sheet.getRange(r, KOL.DATUM_PRVOG).setValue(sada);
    } else {
      sheet.getRange(r, KOL.STATUS).setValue(kandidat.tip); // FOLLOWUP1 ili FOLLOWUP2
    }
    sheet.getRange(r, KOL.DATUM_POSLEDNJEG).setValue(sada);

    upisiULog(sada, emailGazde, String(vrednosti[KOL.IME_LOKALA - 1]), trziste, kandidat.tip, pod.testMode);
    poslato++;
  }

  // 5) Rezime
  var poruka = 'Poslato u ovom talasu: ' + poslato + ' (danas ukupno: ' + (poslatoDanas + poslato) + '/' + pod.dnevniLimit + ').';
  if (pod.testMode) poruka += '\n🧪 TEST MODE — sve je otišlo na ' + pod.testEmail;
  if (oznacenoOdgovorio > 0) poruka += '\n📥 Označeno ODGOVORIO: ' + oznacenoOdgovorio;
  if (greske.length > 0) poruka += '\n⚠️ Greške:\n' + greske.join('\n');
  Logger.log(poruka);
  return poruka;
}

// ======================= PROVERA ODGOVORA ============================

/**
 * Da li postoji mejl OD te adrese posle datuma prvog mejla?
 * Gmail search "after:" radi po danima, zato idemo dan unazad da ništa
 * ne promakne (bolje lažni ODGOVORIO nego smaranje gazde koji je odgovorio).
 */
function imaOdgovor(email, datumPrvogMejla) {
  if (!email) return false;
  var upit = 'from:(' + email + ')';
  if (datumPrvogMejla) {
    var danRanije = new Date(datumPrvogMejla.getTime() - 24 * 60 * 60 * 1000);
    upit += ' after:' + Utilities.formatDate(danRanije, VREMENSKA_ZONA, 'yyyy/MM/dd');
  }
  try {
    return GmailApp.search(upit, 0, 1).length > 0;
  } catch (e) {
    Logger.log('Greška pri Gmail pretrazi za ' + email + ': ' + e.message);
    return false; // u sumnji ne menjaj status
  }
}

/**
 * Prolazi kroz sve kontaktirane (POSLATO / FOLLOWUP1 / FOLLOWUP2)
 * i označava ODGOVORIO gde postoji odgovor. Vraća broj novih odgovora.
 */
function proveriOdgovore() {
  var sheet = SpreadsheetApp.getActive().getSheetByName(TAB_PROSPEKTI);
  if (!sheet) return 0;
  var podaci = sheet.getDataRange().getValues();
  var novihOdgovora = 0;

  for (var i = 1; i < podaci.length; i++) {
    var status = String(podaci[i][KOL.STATUS - 1]).trim().toUpperCase();
    if (status !== STATUS.POSLATO && status !== STATUS.FOLLOWUP1 && status !== STATUS.FOLLOWUP2) continue;

    var email = String(podaci[i][KOL.EMAIL - 1]).trim();
    var datumPrvog = kaoDatum(podaci[i][KOL.DATUM_PRVOG - 1]);
    if (imaOdgovor(email, datumPrvog)) {
      sheet.getRange(i + 1, KOL.STATUS).setValue(STATUS.ODGOVORIO);
      dopisiNapomenu(sheet, i + 1, 'Odgovorio — proveri inbox!');
      novihOdgovora++;
    }
  }
  Logger.log('Provera odgovora: ' + novihOdgovora + ' novih.');
  return novihOdgovora;
}

/** Meni: "Proveri odgovore" — isto, ali sa porukom na kraju. */
function proveriOdgovoreRucno() {
  var broj = proveriOdgovore();
  SpreadsheetApp.getUi().alert(broj > 0
    ? '📥 Nađeno ' + broj + ' novih odgovora! Statusi su prebačeni na ODGOVORIO — proveri inbox.'
    : 'Nema novih odgovora.');
}

/** Verzija za dnevni trigger (bez alert prozora, trigger ne sme da zove UI). */
function proveriOdgovoreTrigger() {
  proveriOdgovore();
}

// =========================== ŠABLONI =================================

/**
 * Nalazi šablon po nazivu u tabu "Šabloni".
 * @return {{subject: string, telo: string}|null}
 */
function nadjiSablon(naziv) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(TAB_SABLONI);
  if (!sheet) return null;
  var podaci = sheet.getDataRange().getValues();
  for (var i = 1; i < podaci.length; i++) {
    if (String(podaci[i][0]).trim().toUpperCase() === naziv.toUpperCase()) {
      return { subject: String(podaci[i][1]), telo: String(podaci[i][2]) };
    }
  }
  return null;
}

/**
 * Menja placeholdere {{ime_lokala}}, {{grad}}, {{prezime}}, {{licna_recenica}}
 * stvarnim vrednostima iz reda. Ako je Prezime prazno, pozdrav
 * "Poštovani g. {{prezime}}," postaje samo "Poštovani,".
 */
function popuniPlaceholdere(tekst, vrednosti) {
  var prezime = String(vrednosti[KOL.PREZIME - 1]).trim();
  var t = String(tekst);

  if (!prezime) {
    // Ceo pozdrav sa prezimenom → neutralan pozdrav
    t = t.replace(/Poštovani g\. \{\{prezime\}\},/g, 'Poštovani,');
    // Ako se {{prezime}} pojavljuje i van pozdrava, samo ga ukloni
    t = t.replace(/ g\. \{\{prezime\}\}/g, '');
  }

  return t
    .replace(/\{\{ime_lokala\}\}/g, String(vrednosti[KOL.IME_LOKALA - 1]).trim())
    .replace(/\{\{grad\}\}/g, String(vrednosti[KOL.GRAD - 1]).trim())
    .replace(/\{\{prezime\}\}/g, prezime)
    .replace(/\{\{licna_recenica\}\}/g, String(vrednosti[KOL.LICNA_RECENICA - 1]).trim());
}

// ============================ TRIGERI ================================

/**
 * Meni: instalira automatsko slanje.
 * - posaljiTalas na svakih 30 min (Apps Script dozvoljava 1/5/10/15/30 min,
 *   pa je 30 min naš izbor iz opsega 20–30). Skripta sama pazi na radno
 *   vreme i dnevni limit, tako da trigger sme da radi non-stop.
 * - proveriOdgovoreTrigger jednom dnevno ujutru (8h) da pokupi odgovore.
 */
function instalirajTrigere() {
  ukloniTrigereInterno(); // da se ne dupliraju

  ScriptApp.newTrigger('posaljiTalas')
    .timeBased()
    .everyMinutes(30)
    .create();

  ScriptApp.newTrigger('proveriOdgovoreTrigger')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();

  SpreadsheetApp.getUi().alert(
    '⏰ Trigeri instalirani!\n\n' +
    '• Slanje: na svakih 30 min (samo pon–pet, u radno vreme, do dnevnog limita)\n' +
    '• Provera odgovora: svako jutro u 8h\n\n' +
    'Za stop: meni → "Ukloni trigere".');
}

/** Meni: uklanja SVE trigere ovog projekta — sistem potpuno staje. */
function ukloniTrigere() {
  var broj = ukloniTrigereInterno();
  SpreadsheetApp.getUi().alert('🛑 Uklonjeno trigera: ' + broj + '. Automatsko slanje je STOPIRANO.');
}

function ukloniTrigereInterno() {
  var trigeri = ScriptApp.getProjectTriggers();
  for (var i = 0; i < trigeri.length; i++) {
    ScriptApp.deleteTrigger(trigeri[i]);
  }
  return trigeri.length;
}

// ========================= DNEVNI IZVEŠTAJ ===========================

/**
 * Meni: "Dnevni izveštaj" — poslato danas i ukupno, razbijeno po tržištu
 * (DIJASPORA / SRBIJA), broj follow-upova i broj odgovora.
 */
function dnevniIzvestaj() {
  var ui = SpreadsheetApp.getUi();
  var logSheet = SpreadsheetApp.getActive().getSheetByName(TAB_LOG);
  var danasStr = Utilities.formatDate(new Date(), VREMENSKA_ZONA, 'yyyy-MM-dd');

  var danas = { DIJASPORA: 0, SRBIJA: 0, GLAVNI: 0, FOLLOWUP1: 0, FOLLOWUP2: 0, ukupno: 0 };
  var ukupno = { DIJASPORA: 0, SRBIJA: 0, GLAVNI: 0, FOLLOWUP1: 0, FOLLOWUP2: 0, ukupno: 0 };

  if (logSheet) {
    var podaci = logSheet.getDataRange().getValues();
    for (var i = 1; i < podaci.length; i++) {
      var datum = kaoDatum(podaci[i][0]);
      if (!datum) continue;
      var trziste = String(podaci[i][3]).trim().toUpperCase();
      var tip = String(podaci[i][4]).trim().toUpperCase();

      ukupno.ukupno++;
      if (ukupno[trziste] !== undefined) ukupno[trziste]++;
      if (ukupno[tip] !== undefined) ukupno[tip]++;

      if (Utilities.formatDate(datum, VREMENSKA_ZONA, 'yyyy-MM-dd') === danasStr) {
        danas.ukupno++;
        if (danas[trziste] !== undefined) danas[trziste]++;
        if (danas[tip] !== undefined) danas[tip]++;
      }
    }
  }

  // Odgovori i stanje liste iz taba "Prospekti"
  var brojOdgovora = 0, brojSpremno = 0, brojNeKontaktirati = 0;
  var prospekti = SpreadsheetApp.getActive().getSheetByName(TAB_PROSPEKTI);
  if (prospekti) {
    var redovi = prospekti.getDataRange().getValues();
    for (var j = 1; j < redovi.length; j++) {
      var status = String(redovi[j][KOL.STATUS - 1]).trim().toUpperCase();
      if (status === STATUS.ODGOVORIO) brojOdgovora++;
      if (status === STATUS.SPREMNO) brojSpremno++;
      if (status === STATUS.NE_KONTAKTIRATI) brojNeKontaktirati++;
    }
  }

  var pod = ucitajPodesavanja();
  ui.alert(
    '📊 VOKER Outreach — dnevni izveštaj\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
    'DANAS poslato: ' + danas.ukupno + ' / ' + pod.dnevniLimit + '\n' +
    '   • DIJASPORA: ' + danas.DIJASPORA + '   • SRBIJA: ' + danas.SRBIJA + '\n' +
    '   • prvi mejl: ' + danas.GLAVNI + '   • FU1: ' + danas.FOLLOWUP1 + '   • FU2: ' + danas.FOLLOWUP2 + '\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
    'UKUPNO poslato: ' + ukupno.ukupno + '\n' +
    '   • DIJASPORA: ' + ukupno.DIJASPORA + '   • SRBIJA: ' + ukupno.SRBIJA + '\n' +
    '   • prvi mejl: ' + ukupno.GLAVNI + '   • FU1: ' + ukupno.FOLLOWUP1 + '   • FU2: ' + ukupno.FOLLOWUP2 + '\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
    '📥 Odgovorilo: ' + brojOdgovora + '\n' +
    '⏳ Čeka slanje (SPREMNO): ' + brojSpremno + '\n' +
    '🚫 Ne kontaktirati: ' + brojNeKontaktirati + '\n' +
    (pod.testMode ? '\n🧪 TEST MODE JE UKLJUČEN' : ''));
}

// ======================== POMOĆNE FUNKCIJE ===========================

/** Da li je sada radno vreme: pon–pet, između RADNO_VREME_OD i RADNO_VREME_DO. */
function jeRadnoVreme(pod) {
  var sada = new Date();
  var dan = Number(Utilities.formatDate(sada, VREMENSKA_ZONA, 'u')); // 1=pon ... 7=ned
  var sat = Number(Utilities.formatDate(sada, VREMENSKA_ZONA, 'H'));
  return dan >= 1 && dan <= 5 && sat >= pod.radnoOd && sat < pod.radnoDo;
}

/** Broj mejlova poslatih danas (iz taba "Log") — za dnevni limit. */
function brojPoslatihDanas() {
  var sheet = SpreadsheetApp.getActive().getSheetByName(TAB_LOG);
  if (!sheet) return 0;
  var danasStr = Utilities.formatDate(new Date(), VREMENSKA_ZONA, 'yyyy-MM-dd');
  var podaci = sheet.getDataRange().getValues();
  var broj = 0;
  for (var i = 1; i < podaci.length; i++) {
    var datum = kaoDatum(podaci[i][0]);
    if (datum && Utilities.formatDate(datum, VREMENSKA_ZONA, 'yyyy-MM-dd') === danasStr) broj++;
  }
  return broj;
}

/** Upisuje jedan poslat mejl u tab "Log". */
function upisiULog(datum, email, lokal, trziste, tip, testMode) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(TAB_LOG);
  if (!sheet) {
    sheet = SpreadsheetApp.getActive().insertSheet(TAB_LOG);
    sheet.appendRow(['Datum i vreme', 'Email', 'Lokal', 'Tržište', 'Tip', 'Test']);
  }
  sheet.appendRow([datum, email, lokal, trziste, tip, testMode ? 'DA' : 'NE']);
}

/** Dopisuje tekst u kolonu Napomena (ne briše postojeće). */
function dopisiNapomenu(sheet, brojReda, tekst) {
  var celija = sheet.getRange(brojReda, KOL.NAPOMENA);
  var postojece = String(celija.getValue()).trim();
  var vreme = Utilities.formatDate(new Date(), VREMENSKA_ZONA, 'dd.MM.');
  celija.setValue(postojece ? postojece + ' | ' + vreme + ' ' + tekst : vreme + ' ' + tekst);
}

/** Pretvara vrednost iz ćelije u Date (ili null ako nije datum). */
function kaoDatum(vrednost) {
  if (vrednost instanceof Date && !isNaN(vrednost.getTime())) return vrednost;
  if (vrednost && String(vrednost).trim()) {
    var d = new Date(vrednost);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/** Broj punih dana između dva datuma. */
function danaIzmedju(od, dodatuma) {
  return Math.floor((dodatuma.getTime() - od.getTime()) / (24 * 60 * 60 * 1000));
}

// ================== INICIJALIZACIJA TABELA (prvi put) ================

/**
 * Meni: "Inicijalizuj tabele" — pravi sva 4 taba sa zaglavljima,
 * početnim šablonima i podešavanjima. Bezbedno je pokrenuti više puta:
 * ne dira tabove/podatke koji već postoje.
 */
function inicijalizujTabele() {
  var ss = SpreadsheetApp.getActive();

  // --- Tab "Prospekti" ---
  var prospekti = ss.getSheetByName(TAB_PROSPEKTI);
  if (!prospekti) {
    prospekti = ss.insertSheet(TAB_PROSPEKTI);
    prospekti.appendRow([
      'ID', 'Ime lokala', 'Grad', 'Zemlja', 'Prezime gazde', 'Email',
      'Telefon', 'Instagram', 'Sajt (nema/loš/ima)', 'Google ocena',
      'Info sa Maps', 'Lična rečenica', 'Šablon', 'Status',
      'Datum prvog mejla', 'Datum poslednjeg kontakta', 'Napomena'
    ]);
    prospekti.getRange(1, 1, 1, KOL.NAPOMENA).setFontWeight('bold');
    prospekti.setFrozenRows(1);

    // Padajuće liste da ne bude grešaka u kucanju
    var statusValidacija = SpreadsheetApp.newDataValidation()
      .requireValueInList([STATUS.NOVO, STATUS.SPREMNO, STATUS.POSLATO,
        STATUS.FOLLOWUP1, STATUS.FOLLOWUP2, STATUS.ODGOVORIO, STATUS.NE_KONTAKTIRATI], true)
      .setAllowInvalid(false).build();
    prospekti.getRange(2, KOL.STATUS, 998, 1).setDataValidation(statusValidacija);

    var sablonValidacija = SpreadsheetApp.newDataValidation()
      .requireValueInList(['DIJASPORA', 'SRBIJA'], true)
      .setAllowInvalid(false).build();
    prospekti.getRange(2, KOL.SABLON, 998, 1).setDataValidation(sablonValidacija);
  }

  // --- Tab "Šabloni" sa 6 početnih šablona ---
  var sabloni = ss.getSheetByName(TAB_SABLONI);
  if (!sabloni) {
    sabloni = ss.insertSheet(TAB_SABLONI);
    sabloni.appendRow(['Naziv', 'Subject', 'Telo']);
    sabloni.getRange(1, 1, 1, 3).setFontWeight('bold');
    sabloni.setFrozenRows(1);

    var fu1Telo = 'Poštovani g. {{prezime}}, samo proveravam da li ste videli moju poruku za sajt za {{ime_lokala}}. Ponuda i dalje važi — sve napravim unapred, besplatno, platite samo ako vam se svidi.\n\nPozdrav,\nLazar';
    var fu2Telo = 'Poštovani g. {{prezime}}, poslednji put se javljam da ne smaram. Ako vam sajt za {{ime_lokala}} ikad zatreba, sačuvajte moj kontakt. Sve najbolje sa lokalom!\n\nLazar';

    var pocetniSabloni = [
      ['GLAVNI_DIJASPORA',
       'Sajt za {{ime_lokala}} — besplatno da vidite, platite samo ako vam se svidi',
       'Poštovani g. {{prezime}},\n\n' +
       'Našao sam {{ime_lokala}} na Google mapi — {{licna_recenica}} Ali primetio sam da nemate sajt ili se loše otvara na telefonu — a 9 od 10 gostiju danas prvo pogleda telefon.\n\n' +
       'Ja sam Lazar iz Srbije, pravim sajtove za ugostitelje. Primeri: sumski-kutak.com i portacrvenipevac.rs.\n\n' +
       'Ponuda je prosta: napravim vam ceo sajt unapred, besplatno i bez obaveze. Ako vam se svidi — 599€ (agencije u {{grad}} naplaćuju 3.000+). Ako ne, obrišem ga i ništa ne dugujete.\n\n' +
       'Da vam pošaljem predlog već ove nedelje?\n\n' +
       'Pozdrav iz Srbije,\nLazar — VOKER'],
      ['FOLLOWUP1_DIJASPORA', 'Re: Sajt za {{ime_lokala}}', fu1Telo],
      ['FOLLOWUP2_DIJASPORA', 'Re: Sajt za {{ime_lokala}}', fu2Telo],
      ['GLAVNI_SRBIJA',
       'Sajt za {{ime_lokala}} — besplatno da vidite, platite samo ako vam se svidi',
       'Poštovani g. {{prezime}},\n\n' +
       'Našao sam {{ime_lokala}} na Google mapi — {{licna_recenica}} Primetio sam da nemate sajt ili se loše otvara na telefonu — a gosti danas prvo pogledaju telefon pre nego što izaberu gde će sesti.\n\n' +
       'Ja sam Lazar iz Pirota, pravim sajtove za kafane i restorane. Primeri: sumski-kutak.com i portacrvenipevac.rs.\n\n' +
       'Ponuda je prosta: napravim vam ceo sajt unapred, besplatno i bez obaveze. Ako vam se svidi — 299€. Ako ne, obrišem ga i ništa mi ne dugujete.\n\n' +
       'Da vam pošaljem predlog već ove nedelje?\n\n' +
       'Pozdrav,\nLazar — VOKER'],
      ['FOLLOWUP1_SRBIJA', 'Re: Sajt za {{ime_lokala}}', fu1Telo],
      ['FOLLOWUP2_SRBIJA', 'Re: Sajt za {{ime_lokala}}', fu2Telo]
    ];
    sabloni.getRange(2, 1, pocetniSabloni.length, 3).setValues(pocetniSabloni);
    sabloni.setColumnWidth(3, 600);
  }

  // --- Tab "Podešavanja" ---
  var podesavanja = ss.getSheetByName(TAB_PODESAVANJA);
  if (!podesavanja) {
    podesavanja = ss.insertSheet(TAB_PODESAVANJA);
    podesavanja.getRange(1, 1, 9, 3).setValues([
      ['Podešavanje', 'Vrednost', 'Objašnjenje'],
      ['TEST_MODE', 'DA', 'DA = svi mejlovi idu na TEST_EMAIL umesto gazdama. Stavi NE tek kad si 100% siguran.'],
      ['TEST_EMAIL', Session.getActiveUser().getEmail(), 'Tvoja adresa za testiranje.'],
      ['DNEVNI_LIMIT', 25, 'Maksimalan broj mejlova dnevno (ukupno, oba tržišta).'],
      ['MAX_PO_TALASU', 2, 'Koliko mejlova šalje jedan talas (trigger na 30 min). 2 × 16 talasa u radnom vremenu ≈ pokriva limit.'],
      ['RADNO_VREME_OD', 9, 'Od kog sata se šalje (CET).'],
      ['RADNO_VREME_DO', 17, 'Do kog sata se šalje (CET). U 17h više ne šalje.'],
      ['DANA_DO_FOLLOWUP1', 3, 'Koliko dana posle prvog mejla ide follow-up 1.'],
      ['DANA_DO_FOLLOWUP2', 7, 'Koliko dana posle follow-upa 1 ide follow-up 2 (poslednji).']
    ]);
    podesavanja.getRange(1, 1, 1, 3).setFontWeight('bold');
    podesavanja.getRange(1, 1, 9, 1).setFontWeight('bold');
    podesavanja.setColumnWidth(3, 550);
    podesavanja.setFrozenRows(1);
  }

  // --- Tab "Log" ---
  var log = ss.getSheetByName(TAB_LOG);
  if (!log) {
    log = ss.insertSheet(TAB_LOG);
    log.appendRow(['Datum i vreme', 'Email', 'Lokal', 'Tržište', 'Tip', 'Test']);
    log.getRange(1, 1, 1, 6).setFontWeight('bold');
    log.setFrozenRows(1);
  }

  SpreadsheetApp.getUi().alert(
    '🛠️ Tabele su spremne!\n\n' +
    'Sledeći koraci:\n' +
    '1. U tabu "Podešavanja" proveri TEST_EMAIL\n' +
    '2. Ubaci prvog (test) prospekta u "Prospekti" i stavi status SPREMNO\n' +
    '3. Meni → "Pošalji talas sada" — mejl stiže TEBI jer je TEST_MODE = DA\n' +
    '4. Kad sve radi: meni → "Instaliraj trigere"');
}
