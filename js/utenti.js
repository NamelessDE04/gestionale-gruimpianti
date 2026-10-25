// ===== UTENTI, ACCESSO CON PIN, LIVELLI E REGISTRO ATTIVITÀ =====
// Livelli:
//  - Master: fa tutto, gestisce gli utenti e vede il registro delle attività (solo come PDF).
//  - Tecnico: fa tutto tranne vedere il registro e gestire gli utenti.
//  - Risorse Umane: sola lettura di anagrafiche, sottoganci e controlli; può stampare tutto, non può modificare.
// Accesso veloce con PIN. Con il cloud si potrà entrare anche con l'account Google associato all'utente.
// NOTA: in questa demo i dati sono solo sul tablet; con il cloud l'accesso passerà a Firebase.
window.UT = (function () {
  const { esc, uid, info, fmt } = UI;
  const RUOLI = { developer: 'Developer', master: 'Master', tecnico: 'Tecnico', ru: 'Risorse Umane' };
  // il Developer ha tutto quello del Master e in più: azzera dati, importa dati, registro attività e monitoraggio consumi
  const ALTI = ['developer', 'master'];
  const CHIAVE = 'gid_sessione';
  // Sessione: resta valida 5 minuti dall'ultimo uso, anche se il telefono spegne lo schermo o chiude l'app.
  // Oltre i 5 minuti si rimette il PIN, ma si resta sulla pagina dove si era (niente ritorno alla home).
  const BLOCCO_MIN = 5, CHIAVE_5 = 'gid_sess5';
  const SESS = {
    m: null,
    get: () => SESS.m,
    set: (id) => { SESS.m = id; SESS.tocca(true); try { sessionStorage.setItem(CHIAVE, id); } catch (e) {} },
    del: () => { SESS.m = null; try { sessionStorage.removeItem(CHIAVE); localStorage.removeItem(CHIAVE_5); } catch (e) {} },
    ultimo: 0,
    // segna "adesso lo sto usando" (al massimo ogni 20 secondi, o subito se forza)
    tocca: (forza) => { const t = Date.now(); if (!SESS.m || (!forza && t - SESS.ultimo < 20000)) return; SESS.ultimo = t; try { localStorage.setItem(CHIAVE_5, JSON.stringify({ id: SESS.m, t })); } catch (e) {} }
  };
  try { localStorage.removeItem(CHIAVE); } catch (e) {}   // le vecchie sessioni "per sempre" non valgono più
  // all'apertura: se l'ultimo uso è di meno di 5 minuti fa si rientra senza PIN
  try {
    const x = JSON.parse(localStorage.getItem(CHIAVE_5) || 'null');
    if (x?.id && Date.now() - x.t < BLOCCO_MIN * 60000) { SESS.m = x.id; try { sessionStorage.setItem(CHIAVE, x.id); } catch (e) {} } else localStorage.removeItem(CHIAVE_5);
  } catch (e) {}
  ['pointerdown', 'keydown', 'scroll'].forEach((t) => window.addEventListener(t, () => SESS.tocca(), { passive: true, capture: true }));
  window.addEventListener('pagehide', () => SESS.tocca(true));
  let nascostaDa = 0, bloccatoDa = null;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { nascostaDa = Date.now(); SESS.tocca(true); return; }
    if (nascostaDa && SESS.get() && !bloccatoDa && Date.now() - nascostaDa > BLOCCO_MIN * 60000) blocca();
    nascostaDa = 0;
  });
  // blocco: il PIN si chiede sopra la pagina, che resta com'era (anche un controllo a metà)
  function blocca() {
    bloccatoDa = SESS.get(); registra('uscita', 'Blocco automatico (app in sottofondo)');
    try { localStorage.removeItem(CHIAVE_5); } catch (e) {}
    const ov = document.createElement('div'); ov.className = 'blocco-ov'; ov.id = 'bloccoOv';
    document.body.appendChild(ov); schermata(ov, S);
  }
  let S = null;

  const hash = async (salt, x) => {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + '|' + x));
    return [...new Uint8Array(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
  };
  const ruoloDi = (u) => (u?.ruolo === 'admin' ? 'master' : u?.ruolo || 'tecnico');   // gli "admin" della v0.8 diventano Master
  const attivi = () => (S?.utenti || []).filter((u) => u.attivo !== false);
  // ACCESSO DEVELOPER SEPARATO: la stessa persona ha due PIN. Con quello normale è il livello che vedono tutti
  // (es. Tecnico); con il PIN Developer (accessoDev) diventa Developer, ma solo per quella sessione e lo vede solo lui.
  const sessId = () => String(SESS.get() || '').split('|')[0];
  const elevato = () => String(SESS.get() || '').endsWith('|dev');
  const attuale = () => { const id = sessId(); return attivi().find((u) => u.id === id) || null; };
  const ruoloSess = () => { const u = attuale(); return u && elevato() && u.accessoDev ? 'developer' : ruoloDi(u); };
  // tasto 🧪: modalità test (i dati veri non vengono toccati, le prove restano su questo dispositivo)
  function cambiaTest() {
    let on = false; try { on = localStorage.getItem('gid_test') === '1'; } catch (e) {}
    if (!on) {
      if (!UI.conferma('Entrare in MODALITÀ TEST?\n\nVedi i dati veri, ma tutto quello che salvi, modifichi o cancelli resta solo su questo dispositivo: il cloud e gli altri non vedono niente. Le email ai clienti non partono davvero.')) return;
      try { localStorage.setItem('gid_test', '1'); } catch (e) { return UI.toast('Non riesco su questo dispositivo', 'err'); }
    } else {
      const n = Backend.modificheTest ? Backend.modificheTest() : 0;
      if (!UI.conferma('Uscire dalla modalità test e tornare ai dati veri?')) return;
      if (n && UI.conferma(`Cancellare le ${n} modifiche di prova?\n\nOK = le cancello · Annulla = le tengo per la prossima volta che entri in test.`)) Backend.svuotaTest?.();
      try { localStorage.removeItem('gid_test'); } catch (e) {}
      try { localStorage.removeItem('gid_test_lav'); } catch (e) {}
    }
    location.reload();
  }
  // tasto ⇄ in alto: chi ha l'accesso Developer separato passa da Developer al suo livello normale e viceversa, senza PIN
  async function cambiaModo() {
    const u = attuale(); if (!u?.accessoDev) return;
    const dev = !elevato();
    SESS.set(u.id + (dev ? '|dev' : ''));
    registra('cambio modo', dev ? 'Passato a Developer' : 'Tornato a ' + RUOLI[ruoloDi(u)]);
    if (u.accessoDev.pinHash) { try { await UI.salva('utenti', { ...u, accessoDev: { tasto: true } }); } catch (e) {} }   // il vecchio PIN Developer non serve più
    UI.toast(dev ? '⇄ Modalità Developer' : '⇄ Modalità ' + RUOLI[ruoloDi(u)], 'ok');
    if (!dev && vietato((location.hash.replace(/^#\/?/, '') || '').split('?')[0].split('/').filter(Boolean))) location.hash = '#/';
    App.ridisegna();
  }
  const isMaster = () => ALTI.includes(ruoloSess());
  const isDev = () => ruoloSess() === 'developer';
  const solaLettura = () => ruoloSess() === 'ru';
  // stampare e inviare ai clienti rapportini, schede di controllo e sottoganci: solo Master e Risorse Umane
  const puoInviare = () => ['developer', 'master', 'ru'].includes(ruoloSess());
  const breve = (u) => (u?.nome || '');   // il nome della persona: lavagna, controlli, sottoganci e tutto il resto
  const sigla = (u) => (u?.nomeBreve || u?.nome || '');   // sigla (es. VL): solo nei rapportini di intervento
  const iniziali = (n = '') => n.trim().split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase() || '?';
  const pinValido = (p) => /^\d{4,6}$/.test(p);
  const pinDevValido = (p) => /^\d{4,10}$/.test(p);   // il PIN Developer può essere più lungo (fino a 10 cifre)
  async function pinGiaUsato(pin, trannId) {
    for (const u of S.utenti) {
      if (u.id !== trannId && u.pinHash && (await hash(u.pinSalt, pin)) === u.pinHash) return true;
      if (u.accessoDev?.pinHash && (await hash(u.accessoDev.pinSalt, pin)) === u.accessoDev.pinHash) return true;
    }
    return false;
  }

  // ---------- REGISTRO ATTIVITÀ ----------
  const NOMI_COL = { invii: 'Invio email', collaudi: 'Rapporto di collaudo', rapportini: 'Rapportino', clienti: 'Cliente', impianti: 'Impianto', sottoganci: 'Sottogancio', giriSottoganci: 'Controllo sottoganci', schedeControllo: 'Scheda di controllo', impostazioni: 'Impostazioni', utenti: 'Utente', mezzi: 'Mezzo', attrezzi: 'Attrezzo sottogancio', controlliAttrezzi: 'Controllo attrezzo', schedeApprofondite: 'Controllo approfondito', oreGho: 'Registro ore GHO', promemoria: 'Promemoria' };
  function descrivi(col, d) {
    if (!d) return NOMI_COL[col] || col;
    const cli = (id) => { const c = S.clienti.find((x) => x.id === id); return c ? CLI.nome(c) : ''; };
    const imp = (id) => { const i = S.impianti.find((x) => x.id === id); return i ? `${i.numeroInterno ? 'N° ' + i.numeroInterno + ' ' : ''}${IMP.titolo(i)}${i.matricola ? ' (matr. ' + i.matricola + ')' : ''}` : ''; };
    const sede = (id) => { for (const c of S.clienti) { const s = (c.sedi || []).find((x) => x.id === id); if (s) return `${CLI.nome(c)} ${s.nome || ''}`; } return ''; };
    switch (col) {
      case 'clienti': return `Cliente ${d.ragioneSociale || ''}`;
      case 'impianti': return `Impianto ${d.numeroInterno ? 'N° ' + d.numeroInterno + ' ' : ''}${IMP.titolo(d)} – ${cli(d.clienteId)}`;
      case 'sottoganci': return `Sottogancio ${d.numero} – ${sede(d.sedeId)}`;
      case 'giriSottoganci': return `Controllo sottoganci ${d.slot}° ${d.anno} – ${sede(d.sedeId)}`;
      case 'schedeControllo': return `Scheda di controllo ${d.anno} – ${imp(d.impiantoId)} – ${cli(d.clienteId)}`;
      case 'utenti': return `Utente ${d.nome}`;
      case 'invii': return `Invio email «${d.oggetto || ''}» a ${(d.a || []).join(', ')}`;
      case 'collaudi': return `Rapporto di collaudo ${d.cliente || ''} ${d.matricola ? 'matr. ' + d.matricola : ''}`;
      case 'rapportini': return `Rapportino ${d.numero || ''}/${d.anno || ''} – ${sede(d.sedeId)}`;
      case 'mezzi': return `Mezzo ${MEZ.nome(d)} ${d.targa || ''}`;
      case 'oreGho': return `Registro ore GHO ${d.data || ''} – ${d.cliente || ''}`;
      case 'attrezzi': return `${d.tipo === 'magnete' ? 'Magnete' : 'Pinza / gancio a C'} ${d.nInterno ? 'n° ' + d.nInterno + ' ' : ''}– ${sede(d.sedeId)}`;
      case 'controlliAttrezzi': { const a = S.attrezzi?.find((x) => x.id === d.attrezzoId); return `Controllo ${d.slot}° ${d.anno} ${a ? (a.tipoDesc || '') + (a.nInterno ? ' n° ' + a.nInterno : '') : ''} – ${sede(d.sedeId)}`; }
      case 'schedeApprofondite': return `${({ fune: 'Scheda fune e carrucole', bozzello: 'Scheda controllo gancio', indagine: 'Indagine approfondita' })[d.tipo] || 'Controllo approfondito'} ${d.data || ''} – ${sede(d.sedeId)}`;
      case 'impostazioni': return d.id === 'modelliScheda' ? 'Modelli di scheda' : d.id === 'modificheCablaggio' ? 'Valori del configuratore cablaggio' : d.id === 'modelliImpianto' ? 'Tipi di impianto' : d.id === 'tipologieGru' ? 'Tipologie di gru' : 'Impostazioni';
      default: return NOMI_COL[col] || col;
    }
  }
  // ---- dispositivo da cui si lavora: un codice fisso salvato sul dispositivo + che tipo di dispositivo è ----
  const idDisp = () => { try { let k = localStorage.getItem('gid_disp_id'); if (!k) { k = uid(); localStorage.setItem('gid_disp_id', k); } return k; } catch (e) { return ''; } };
  function descDisp() {
    const ua = navigator.userAgent || '';
    const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPhone/iPad' : /Windows/i.test(ua) ? 'Windows' : /Mac OS/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : 'sistema sconosciuto';
    const br = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'browser';
    const tipo = /Mobi|iPhone/i.test(ua) ? 'Telefono' : /iPad|Tablet|Android/i.test(ua) || (os === 'Windows' && navigator.maxTouchPoints > 1) ? 'Tablet' : 'PC';
    let app = false; try { app = matchMedia('(display-mode: standalone)').matches; } catch (e) {}
    return `${tipo} ${os} · ${br}${app ? ' · app installata' : ''}`;
  }
  const dispOra = () => ({ id: idDisp(), desc: descDisp(), nome: (() => { try { return CONF.nomeDisp(); } catch (e) { return ''; } })(), account: (() => { try { return Backend.account?.() || ''; } catch (e) { return ''; } })() });
  function registra(azione, testo, extra = {}) {
    const u = attuale() || extra.utente;
    const voce = { id: uid(), t: new Date().toISOString(), uid: u?.id || '', nome: u?.nome || extra.nome || '—', azione, testo, ...(extra.col ? { col: extra.col, docId: extra.docId } : {}), ...(/^accesso/.test(azione) ? { disp: dispOra() } : {}) };
    try { Backend.append('log', voce, 10000); } catch (e) { /* registro pieno: non blocco il lavoro */ }
  }

  // controlla i permessi e registra ogni salvataggio / eliminazione
  let installato = false;
  function installa() {
    if (installato) return; installato = true;
    const o = { save: Backend.save, saveMany: Backend.saveMany, remove: Backend.remove };
    const permesso = (col, doc) => {
      if (!solaLettura()) return true;
      if (col === 'utenti') return doc?.id === attuale()?.id; // RU può solo aggiornare il proprio profilo (PIN, firma)
      if (col === 'invii') return true;                         // RU invia i documenti ai clienti
      if (col === 'promemoria') {                               // RU segna come fatto un promemoria, nient'altro
        const prima = (S?.promemoria || []).find((x) => x.id === doc?.id); if (!prima) return false;
        const libere = ['fatto', 'fattoIl', 'fattoDa', 'fattoNome', 'aggiornato', '_rev', '_base', '_storia', '_da', '_disp', '_quando'];
        return [...new Set([...Object.keys(prima), ...Object.keys(doc)])].every((k) => libere.includes(k) || JSON.stringify(prima[k]) === JSON.stringify(doc[k]));
      }
      if (col === 'rapportini') {                               // ... e segna il rapportino come inviato, nient'altro
        const prima = (S?.rapportini || []).find((x) => x.id === doc?.id); if (!prima) return false;
        const libere = ['inviatoIl', 'inviatoA', 'aggiornato', '_rev', '_base', '_storia', '_da', '_disp', '_quando'];
        return [...new Set([...Object.keys(prima), ...Object.keys(doc)])].every((k) => libere.includes(k) || JSON.stringify(prima[k]) === JSON.stringify(doc[k]));
      }
      return false;
    };
    Backend.save = async (col, doc) => {
      if (!permesso(col, doc)) { UI.toast('Accesso in sola lettura: non puoi modificare', 'err'); throw new Error('sola lettura'); }
      const nuovo = !(S?.[col] || []).some((x) => x.id === doc.id);
      CONF.marca(col, doc);   // nuova versione (serve a riconoscere i conflitti tra dispositivi offline)
      const r = await o.save(col, doc);
      registra(nuovo ? 'creazione' : 'modifica', descrivi(col, doc), { col, docId: doc.id });
      return r;
    };
    Backend.saveMany = async (col, docs) => {
      if (solaLettura()) { UI.toast('Accesso in sola lettura', 'err'); throw new Error('sola lettura'); }
      const r = await o.saveMany(col, docs); registra('modifica', `${docs.length} × ${NOMI_COL[col] || col}`, { col }); return r;
    };
    Backend.remove = async (col, id) => {
      if (solaLettura()) { UI.toast('Accesso in sola lettura: non puoi eliminare', 'err'); throw new Error('sola lettura'); }
      const d = (S?.[col] || []).find((x) => x.id === id);
      const testo = descrivi(col, d);
      const r = await o.remove(col, id); registra('eliminazione', testo, { col, docId: id }); return r;
    };
    window.addEventListener('beforeprint', () => { if (attuale()) registra('stampa', document.title.replace(/_/g, ' ')); });
  }

  // ---------- schermata di accesso con PIN ----------
  let tentativi = 0, bloccoFino = 0;
  function schermata(el, dati) {
    S = dati;
    const primo = !S.utenti.length;
    const senzaPin = attivi().some((u) => !u.pinHash);
    document.body.classList.add('fuori');
    if (primo && Backend.mode === 'cloud') { el.innerHTML = '<section class="login"><div class="login-box card"><h1>Caricamento…</h1><p class="muted">Sto scaricando i dati dal cloud.</p></div></section>'; return; }
    if (primo) return primoAvvio(el);
    el.innerHTML = `
      <section class="login">
        <div class="login-box card">
          <img src="img/logo-grande.png" alt="Gru Impianti" class="login-logo" onerror="this.remove()">
          <h1>Inserisci il PIN</h1>
          <div class="pin-punti" id="punti"></div>
          <div class="tastierino">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-n="${n}">${n}</button>`).join('')}
            <button type="button" data-canc aria-label="Cancella">⌫</button><button type="button" data-n="0">0</button><button type="button" data-ok aria-label="Entra">✓</button>
          </div>
          ${Backend.loginGoogle && !Backend.isDispositivo() ? '<button class="btn ghost google" id="btnGoogle"><b>G</b> Accedi con Google</button>' : ''}
          ${senzaPin && Backend.mode !== 'cloud' ? '<button class="link" id="btnVecchio">Non hai ancora il PIN? Entra con nome utente e password</button>' : ''}
        </div>
      </section>`;
    let pin = '';
    const lunghezze = [...new Set([...attivi().filter((u) => u.pinHash).map((u) => u.pinLen || 4), ...attivi().filter((u) => u.accessoDev?.pinHash).map((u) => u.accessoDev.pinLen || 4)])];
    const max = Math.max(4, ...lunghezze);
    const punti = () => (el.querySelector('#punti').innerHTML = Array.from({ length: Math.max(4, pin.length) }, (_, k) => `<span class="${k < pin.length ? 'on' : ''}"></span>`).join(''));
    const errore = () => {
      tentativi++; if (tentativi >= 5) { bloccoFino = Date.now() + 30000; tentativi = 0; }
      registra('accesso negato', 'PIN errato', { nome: '(sconosciuto)' });
      const b = el.querySelector('.login-box'); b.classList.remove('scuoti'); void b.offsetWidth; b.classList.add('scuoti');
      UI.toast(bloccoFino > Date.now() ? 'Troppi tentativi: riprova tra 30 secondi' : 'PIN non corretto', 'err');
      pin = ''; punti();
    };
    const prova = async (forza) => {
      if (Date.now() < bloccoFino) { pin = ''; punti(); return UI.toast('Troppi tentativi: aspetta qualche secondo', 'err'); }
      for (const u of attivi()) if (u.pinHash && (u.pinLen || 4) === pin.length && (await hash(u.pinSalt, pin)) === u.pinHash) return entra(u, 'PIN');
      for (const u of attivi()) { const d = u.accessoDev; if (d?.pinHash && (d.pinLen || 4) === pin.length && (await hash(d.pinSalt, pin)) === d.pinHash) return entra(u, 'PIN Developer', true); }
      if (forza || pin.length >= max) errore();
    };
    // se c'è un PIN Developer più lungo, il PIN corto si prova dopo una piccola pausa (così si può continuare a scrivere)
    const lungo = Math.max(...attivi().map((u) => u.accessoDev?.pinLen || 0), 0);
    let attesa = null;
    el.querySelectorAll('[data-n]').forEach((b) => (b.onclick = () => {
      if (pin.length >= Math.max(6, lungo)) return;
      pin += b.dataset.n; punti(); clearTimeout(attesa);
      if (!lunghezze.includes(pin.length)) return;
      if (pin.length < lungo) attesa = setTimeout(() => prova(false), 1300); else prova(false);
    }));
    el.querySelector('[data-canc]').onclick = () => { pin = pin.slice(0, -1); punti(); };
    el.querySelector('[data-ok]').onclick = () => pin && prova(true);
    // anche con la tastiera del PC
    document.onkeydown = (e) => { if (!document.body.classList.contains('fuori') || document.querySelector('.modal-ov')) return;
      if (/^\d$/.test(e.key)) el.querySelector(`[data-n="${e.key}"]`)?.click(); else if (e.key === 'Backspace') el.querySelector('[data-canc]')?.click(); else if (e.key === 'Enter') el.querySelector('[data-ok]')?.click(); };
    el.querySelector('#btnGoogle')?.addEventListener('click', async () => {
      try {
        const email = (await Backend.loginGoogle()).toLowerCase();
        if (!(await ruoloAccount(email))) { await Backend.esciGoogle(); UI.toast(`L'account ${email} non è autorizzato`, 'err'); setTimeout(() => location.reload(), 1500); return; }
        const u = attivi().find((x) => (x.google || '').toLowerCase() === email);
        if (!u) return UI.toast(`L'account ${email} non è associato a nessun utente`, 'err');
        entra(u, 'Google');
      } catch (e) { UI.toast('Accesso con Google non riuscito', 'err'); }
    });
    el.querySelector('#btnVecchio')?.addEventListener('click', () => vecchioAccesso(el));
    punti();
  }

  function primoAvvio(el) {
    el.innerHTML = `
      <section class="login">
        <div class="login-box card">
          <img src="img/logo-grande.png" alt="Gru Impianti" class="login-logo" onerror="this.remove()">
          <h1>Benvenuto</h1>
          <p class="muted">Crea il primo accesso: sarai il <b>Master</b>. Poi potrai aggiungere i colleghi con il loro livello.</p>
          <form id="fPrimo" novalidate>
            <label>Nome e cognome<input name="nome" value="Luca" autocomplete="name"></label>
            <label>Scegli un PIN (da 4 a 6 cifre)<input name="pin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></label>
            <label>Ripeti il PIN<input name="pin2" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></label>
            <button class="btn big" type="submit">Crea e entra</button>
          </form>
        </div>
      </section>`;
    const f = el.querySelector('#fPrimo');
    f.onsubmit = async (e) => {
      e.preventDefault();
      if (!f.nome.value.trim()) return UI.toast('Scrivi il tuo nome', 'err');
      if (!pinValido(f.pin.value)) return UI.toast('Il PIN deve avere da 4 a 6 cifre', 'err');
      if (f.pin.value !== f.pin2.value) return UI.toast('I due PIN non coincidono', 'err');
      const pinSalt = uid();
      const u = { id: uid(), nome: f.nome.value.trim(), ruolo: 'developer', pinSalt, pinHash: await hash(pinSalt, f.pin.value), pinLen: f.pin.value.length, google: '', firma: null, attivo: true };
      SESS.set(u.id);
      await Backend.save('utenti', u); entra(u, 'primo accesso');
    };
  }

  // per chi aveva creato l'accesso con nome utente e password (v0.8): entra e imposta il PIN
  function vecchioAccesso(el) {
    el.innerHTML = `
      <section class="login"><div class="login-box card">
        <h1>Accesso con password</h1><p class="muted">Solo per questa volta: poi ti chiederò di scegliere il PIN.</p>
        <form id="fOld" novalidate>
          <label>Nome utente<input name="user" autocapitalize="none" autocomplete="username"></label>
          <label>Password<input name="pw" type="password" autocomplete="current-password"></label>
          <button class="btn big" type="submit">Entra</button>
        </form>
        <button class="link" id="btnIndietro">← Torna al PIN</button>
      </div></section>`;
    const f = el.querySelector('#fOld');
    f.onsubmit = async (e) => {
      e.preventDefault();
      const u = attivi().find((x) => x.username === f.user.value.trim().toLowerCase());
      if (!u || !u.hash || (await hash(u.salt, f.pw.value)) !== u.hash) return UI.toast('Nome utente o password non corretti', 'err');
      entra(u, 'password'); setTimeout(() => (location.hash = '#/profilo'), 50);
    };
    el.querySelector('#btnIndietro').onclick = () => schermata(el, S);
  }

  function entra(u, metodo, dev) {
    // sblocco dopo i 5 minuti: la stessa persona torna esattamente dov'era; un'altra persona riparte dalla home
    if (bloccatoDa) {
      const prima = bloccatoDa; bloccatoDa = null;
      document.getElementById('bloccoOv')?.remove(); document.body.classList.remove('fuori'); document.onkeydown = null; tentativi = 0;
      if (prima.split('|')[0] === u.id) { SESS.set(dev ? u.id + '|dev' : prima); registra('accesso', `Sblocco con ${metodo}`); UI.toast('Bentornato ' + u.nome.split(' ')[0], 'ok'); App.ridisegnaSeServe?.(); return; }
      SESS.set(u.id + (dev ? '|dev' : '')); registra('accesso', `Accesso con ${metodo}`); UI.toast('Ciao ' + u.nome.split(' ')[0], 'ok');
      location.hash = '#/'; App.ridisegna(); return;
    }
    SESS.set(u.id + (dev ? '|dev' : ''));
    document.body.classList.remove('fuori'); document.onkeydown = null; tentativi = 0;
    registra('accesso', `Accesso con ${metodo}`);
    UI.toast('Ciao ' + u.nome.split(' ')[0], 'ok');
    // promemoria firma: al massimo una volta al giorno
    const kf = 'gid_promemoria_firma_' + u.id;
    let giaDetto = false; try { giaDetto = localStorage.getItem(kf) === UI.oggi(); localStorage.setItem(kf, UI.oggi()); } catch (e) {}
    if (!u.firma && ruoloDi(u) !== 'ru' && !giaDetto) setTimeout(() => UI.toast('Ricordati di salvare la tua firma nel profilo', ''), 2700);
    if (!u.pinHash) setTimeout(() => UI.toast('Scegli il tuo PIN nel profilo', ''), 2700);
    // si resta sulla pagina dove si era (es. app riaperta dopo più di 5 minuti)
    if (!u.pinHash) location.hash = '#/profilo';
    App.ridisegna();
  }
  function esci() { registra('uscita', 'Uscita dall\'app'); SESS.del(); location.hash = '#/'; App.ridisegna(); }

  // ---------- profilo personale: firma, PIN, account Google ----------
  // indirizzo dell'app (senza #pagina), per il codice QR
  const linkApp = () => location.origin + location.pathname.replace(/index\.html$/, '');
  function mostraQr() {
    const ov = document.createElement('div'); ov.className = 'modal-ov';
    const link = linkApp(), puoCondividere = !!navigator.share;
    ov.innerHTML = `<div class="modal qr-modal"><div class="modal-head"><h2>📱 Condividi l'app</h2><button type="button" class="modal-x" aria-label="Chiudi">×</button></div>
      <div class="modal-body"><div class="qr-grande">${QRGen.svg(link)}</div>
        <p class="qr-link">${esc(link)}</p>
        <p class="muted small">Inquadra con la fotocamera del telefono e tocca il link che compare.</p></div>
      <div class="modal-foot"><span class="grow"></span><button type="button" class="btn" id="btnQrInvia">${puoCondividere ? '📤 Invia il link' : '📋 Copia il link'}</button></div></div>`;
    const chiudi = () => { ov.remove(); document.body.classList.remove('modal-aperto'); };
    ov.onclick = (e) => { if (e.target === ov) chiudi(); };
    ov.querySelector('.modal-x').onclick = chiudi;
    ov.querySelector('#btnQrInvia').onclick = async () => {
      try {
        if (puoCondividere) await navigator.share({ title: 'Gestionale Gru Impianti', url: link });
        else { await navigator.clipboard.writeText(link); UI.toast('Link copiato', 'ok'); }
      } catch (e) { if (e?.name !== 'AbortError') UI.toast('Non riesco: scrivi a mano ' + link, 'err'); }
    };
    document.body.appendChild(ov); document.body.classList.add('modal-aperto');
  }

  function profilo(el, dati) {
    S = dati; const u = attuale(), r = ruoloSess();
    el.innerHTML = `
      <section class="cli">
        <div class="card cli-head">
          <span class="avatar big">${esc(iniziali(u.nome))}</span>
          <div class="grow"><h1>${esc(u.nome)}</h1><p class="muted">${RUOLI[r]}</p></div>
          <button class="btn ghost" id="btnEsci">Esci</button>
        </div>
        <div class="card qr-card">
          <span class="qr-mini" aria-hidden="true">${QRGen.svg(linkApp())}</span>
          <div class="grow"><h2>📱 Condividi l'app ${info('Fai inquadrare questo codice con la fotocamera del telefono di un collega: si apre subito il link dell\'app. Poi ognuno entra con il suo PIN (o con l\'account Google, se gliel\'ha associato il Master). Il codice contiene solo l\'indirizzo dell\'app, nessun dato.')}</h2>
            <p class="muted small">Fallo inquadrare con la fotocamera</p></div>
          <button type="button" class="btn ghost" id="btnQr">Ingrandisci</button>
        </div>
        ${r !== 'ru' ? `
        <div class="card">
          <div class="card-head"><h2>La mia firma ${info('Firma una volta sola: verrà messa in automatico sulle schede dei controlli che fai tu. Se la rifai, vale per i controlli nuovi; quelli già salvati tengono la firma di quel giorno.')}</h2></div>
          ${u.firma ? `<div class="firma-salvata"><img src="${u.firma}" alt="La mia firma"></div>` : '<p class="muted">Non hai ancora salvato la tua firma.</p>'}
          <div class="azioni-form" id="boxApriFirma"><button type="button" class="btn ${u.firma ? 'ghost' : ''}" id="btnApriFirma">✍️ ${u.firma ? 'Rifai la firma' : 'Fai la firma'}</button></div>
          <div id="boxFirmaP" hidden>
            <div class="firma"><div class="firma-head"><b>Firma qui</b><button type="button" class="link" id="btnPulisci">Cancella</button></div>
              <canvas id="cvP"></canvas><span class="firma-hint">Firma col dito</span></div>
            <div class="azioni-form"><button type="button" class="btn ghost" id="btnAnnullaFirma">Annulla</button><span class="grow"></span><button class="btn" id="btnSalvaFirma">Salva firma</button></div>
          </div>
        </div>` : ''}
        <div class="card">
          <h2>${u.pinHash ? 'Cambia PIN' : 'Scegli il tuo PIN'} ${info('Il PIN serve per entrare velocemente: da 4 a 6 cifre, diverso da quello dei colleghi.')}</h2>
          <form id="fPin" class="form" novalidate>
            <div class="tre">
              ${u.pinHash ? '<label>PIN attuale<input name="vecchio" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password"></label>' : ''}
              <label>Nuovo PIN<input name="nuovo" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></label>
              <label>Ripeti nuovo PIN<input name="nuovo2" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></label>
            </div>
            <div class="azioni-form"><span class="grow"></span><button class="btn ${u.pinHash ? 'ghost' : ''}" type="submit">Salva PIN</button></div>
          </form>
        </div>
        ${Backend.mode === 'cloud' ? `
        <div class="card">
          <h2>Account Google ${info('Il tuo account Google lo associa il Master da «Utenti». Ogni dispositivo resta collegato a un account Google: serve una volta sola, poi si entra con il PIN. Su un tablet condiviso basta l\'account di uno di voi.')}</h2>
          <p>Il tuo account: <b>${esc(u.google || 'nessuno')}</b></p>
          <p class="muted small">${Backend.isDispositivo() ? 'Questo è un <b>tablet condiviso</b>: ognuno entra con il suo PIN.' : `Questo dispositivo è collegato a <b>${esc(Backend.account() || '—')}</b> (${esc(RUOLI[ruoloDispositivo] || '—')})`}</p>
          <div class="azioni-form"><span class="grow"></span><button class="btn ghost" id="btnScollega">Scollega questo dispositivo</button></div>
        </div>` : `
        <div class="card">
          <h2>Account Google ${info('Quando l\'app sarà online potrai entrare anche con il tuo account Google, senza PIN. Scrivi qui l\'indirizzo Gmail da associare.')}</h2>
          <form id="fGoogle" class="form" novalidate>
            <div class="due"><label>Indirizzo Google<input name="google" type="email" value="${esc(u.google || '')}" placeholder="nome@gmail.com"></label>
              <div class="azioni-form"><button class="btn ghost" type="submit">Salva</button></div></div>
            <p class="muted small">L'accesso con Google si attiverà con il collegamento al cloud.</p>
          </form>
        </div>`}
        ${r === 'developer' ? Tocchi.card() : ''}
        ${r === 'developer' || u.accessoDev ? `<div class="card">
          <h2>⇄ Accesso Developer separato ${info('Il tuo utente per tutti (e per il Master) resta di un livello normale, per esempio Tecnico. Col tasto ⇄ in alto, accanto al tuo nome, passi a Developer e torni indietro quando vuoi, senza PIN: il tasto lo vedi solo tu.')}</h2>
          ${u.accessoDev ? `<p>Attivo: per tutti sei <b>${esc(RUOLI[ruoloDi(u)])}</b>. Tocca <b>⇄</b> in alto per passare a Developer e tornare indietro.</p>
            <div class="azioni-form"><span class="grow"></span><button type="button" class="btn ghost small" id="btnDevVia">Togli (torno Developer per tutti)</button></div>`
          : `<p class="muted">Ora il tuo utente è Developer per tutti. Puoi farlo diventare <b>Tecnico</b> (come lo vedrà il Master) e passare a Developer col tasto ⇄ in alto.</p>
            <div class="azioni-form"><span class="grow"></span><button type="button" class="btn" id="btnDevSi">Attiva: divento Tecnico + tasto ⇄</button></div>`}
        </div>` : ''}
        ${ALTI.includes(r) ? `<div class="card">
          <h2>Strumenti del ${r === 'developer' ? 'Developer' : 'Master'}</h2>
          <div class="azioni-lista">
            <a class="btn ghost" href="#/utenti">👥 Gestione utenti</a>
            <button class="btn ghost" id="btnExport">💾 Esporta dati (backup)</button>
            ${r === 'developer' ? `<a class="btn ghost" href="#/sviluppo">📊 Consumi e stato dell'app</a><a class="btn ghost" href="#/registro">📋 Registro attività</a>
            <a class="btn ghost" href="#/importa">📥 Importa dati</a>
            <a class="btn ghost danger" href="#/azzera">🧹 Azzera dati</a>` : ''}
            ${info('«Esporta dati» scarica una copia di tutto quello che è stato inserito. Tienila al sicuro. I documenti allegati non sono compresi.')}
          </div></div>` : ''}
      </section>`;
    el.querySelector('#btnEsci').onclick = esci;
    el.querySelector('#btnQr').onclick = mostraQr;
    Tocchi.collega(el);
    el.querySelector('#btnExport')?.addEventListener('click', () => App.esporta());
    if (r !== 'ru') {
      // il riquadro della firma compare solo col tasto: così non si firma per sbaglio scorrendo la pagina
      let pad = null;
      const box = el.querySelector('#boxFirmaP'), apri = el.querySelector('#boxApriFirma');
      el.querySelector('#btnApriFirma').onclick = () => {
        box.hidden = false; apri.hidden = true;
        pad = pad || UI.firmaPad(el.querySelector('#cvP')); pad.pulisci();
        box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
      el.querySelector('#btnAnnullaFirma').onclick = () => { box.hidden = true; apri.hidden = false; };
      el.querySelector('#btnPulisci').onclick = () => pad?.pulisci();
      el.querySelector('#btnSalvaFirma').onclick = async () => {
        if (!pad || pad.vuota()) return UI.toast('Prima firma nel riquadro', 'err');
        await UI.salva('utenti', { ...attuale(), firma: pad.immagine() }); UI.toast('Firma salvata', 'ok');
        setTimeout(() => App.ridisegna(), 50);   // mostro la firma nuova e richiudo il riquadro
      };
    }
    const f = el.querySelector('#fPin');
    f.onsubmit = async (e) => {
      e.preventDefault(); const io = attuale();
      if (io.pinHash && (await hash(io.pinSalt, f.vecchio.value)) !== io.pinHash) return UI.toast('Il PIN attuale non è giusto', 'err');
      if (!pinValido(f.nuovo.value)) return UI.toast('Il PIN deve avere da 4 a 6 cifre', 'err');
      if (f.nuovo.value !== f.nuovo2.value) return UI.toast('I due PIN non coincidono', 'err');
      if (await pinGiaUsato(f.nuovo.value, io.id)) return UI.toast('PIN già usato da un collega: scegline un altro', 'err');
      const pinSalt = uid(); await UI.salva('utenti', { ...io, pinSalt, pinHash: await hash(pinSalt, f.nuovo.value), pinLen: f.nuovo.value.length });
      f.reset(); UI.toast('PIN salvato', 'ok'); App.ridisegna();
    };
    el.querySelector('#btnDevSi')?.addEventListener('click', async () => {
      const io = attuale();
      if (!S.utenti.some((x) => x.id !== io.id && x.attivo !== false && ALTI.includes(ruoloDi(x)))) return UI.toast('Prima serve un altro Master attivo (es. il titolare)', 'err');
      if (!UI.conferma('Da ora il tuo utente sarà TECNICO per tutti (anche per il Master).\n\nCol tasto ⇄ in alto passi a Developer quando vuoi (lo vedi solo tu).\n\nContinuare?')) return;
      const d = { ...io, ruolo: 'tecnico', accessoDev: { tasto: true } };
      await UI.salva('utenti', d); SESS.set(io.id + '|dev');
      registra('modifica', 'Accesso Developer separato attivato (tasto ⇄)');
      sincronizzaRuoli(S.utenti.filter((x) => x.id !== d.id).concat(d));
      UI.toast('Fatto: ora sei Tecnico per tutti, Developer col tasto ⇄', 'ok'); App.ridisegna();
    });
    el.querySelector('#btnDevVia')?.addEventListener('click', async () => {
      if (!UI.conferma('Togliere l\'accesso separato? Il tuo utente torna Developer per tutti e il tasto ⇄ sparisce.')) return;
      const d = { ...attuale(), ruolo: 'developer' }; delete d.accessoDev;
      await UI.salva('utenti', d); SESS.set(d.id); registra('modifica', 'Accesso Developer separato tolto');
      sincronizzaRuoli(S.utenti.filter((x) => x.id !== d.id).concat(d)); UI.toast('Sei di nuovo Developer per tutti', 'ok'); App.ridisegna();
    });
    el.querySelector('#btnScollega')?.addEventListener('click', async () => {
      if (!UI.conferma('Scollegare questo dispositivo dall\'account Google? Per rientrare servirà di nuovo l\'accesso con Google.')) return;
      registra('uscita', 'Dispositivo scollegato dall\'account Google'); SESS.del();
      await Backend.esciGoogle(); location.hash = '#/'; location.reload();
    });
    const g = el.querySelector('#fGoogle');
    if (g) g.onsubmit = async (e) => {
      e.preventDefault(); const v = g.google.value.trim().toLowerCase();
      if (v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return UI.toast('Indirizzo non valido', 'err');
      if (v && S.utenti.some((x) => x.id !== attuale().id && (x.google || '').toLowerCase() === v)) return UI.toast('Questo account è già associato a un collega', 'err');
      await UI.salva('utenti', { ...attuale(), google: v }); UI.toast('Account Google salvato', 'ok');
    };
    return { titolo: 'Il mio profilo', indietro: '#/', live: false };
  }

  // ---------- gestione utenti (solo Master) ----------
  function gestione(el, dati) {
    S = dati;
    if (!isMaster()) { el.innerHTML = '<p class="nessuno">Solo il Master può gestire gli utenti.</p>'; return { titolo: 'Utenti', indietro: '#/' }; }
    const lista = [...S.utenti].sort((a, b) => a.nome.localeCompare(b.nome));
    el.innerHTML = `
      <section class="cli">
        <div class="sez-head"><h1>Utenti ${info('Developer: fa tutto, anche azzerare e importare i dati, vedere il registro attività e i consumi del cloud. Master: fa tutto il resto e gestisce gli utenti. Tecnico: fa tutto tranne registro e gestione utenti. Risorse Umane: vede anagrafiche, sottoganci e controlli e può stampare, ma non può modificare nulla. Ognuno salva firma e PIN dal proprio profilo.')}</h1>
          <button class="btn fab" id="btnNuovo"><span class="fab-piu">+</span><span class="fab-txt"> Nuovo utente</span></button></div>
        ${isDev() ? `<div class="azioni-lista"><button class="btn ghost small" id="btnAccessi">📱 Accessi e dispositivi</button>${info('Solo per te (Developer). Per ogni persona vedi da quali dispositivi è entrata, con che account Google e quando; i dispositivi nuovi degli ultimi 7 giorni sono segnati 🆕. In fondo i PIN sbagliati, dispositivo per dispositivo.')}</div>` : ''}
        <div class="elenco">
          ${lista.map((u) => `
            <a class="riga cli-riga ${u.attivo === false ? 'dismesso' : ''}" href="javascript:void(0)" data-u="${u.id}">
              <span class="avatar">${esc(iniziali(u.nome))}</span>
              <div class="riga-main"><div class="riga-top"><b>${esc(u.nome)}</b>${u.nomeBreve ? ` <span class="muted">(${esc(u.nomeBreve)})</span>` : ''} <span class="pill ruolo-${ruoloDi(u)}">${RUOLI[ruoloDi(u)]}</span></div>
                <div class="muted small">${u.attivo === false ? 'disattivato · ' : ''}${u.pinHash ? 'PIN impostato' : '<b class="txt-ko">PIN da impostare</b>'}${ruoloDi(u) !== 'ru' ? ` · ${u.firma ? 'firma salvata' : '<b class="txt-ko">firma mancante</b>'}` : ''}${u.google ? ' · ' + esc(u.google) : ''}</div></div>
              ${u.firma ? `<img class="firma-mini" src="${u.firma}" alt="">` : ''}
            </a>`).join('')}
        </div>
      </section>`;
    el.querySelector('#btnNuovo').onclick = () => modaleUtente(null);
    el.querySelector('#btnAccessi')?.addEventListener('click', () => accessi());
    el.querySelectorAll('[data-u]').forEach((r) => (r.onclick = () => {
      const u = S.utenti.find((x) => x.id === r.dataset.u);
      if (ruoloDi(u) === 'developer' && !isDev() && u.id !== attuale()?.id) return UI.toast('Il Developer lo può modificare solo un Developer', 'err');
      modaleUtente(u);
    }));
    if (Backend.mode === 'cloud') tablet(el);
    return { titolo: 'Gestione utenti', indietro: '#/', live: true };
  }
  // ---------- tablet condivisi (solo cloud, solo Master) ----------
  async function tablet(el) {
    const sez = document.createElement('div'); sez.className = 'card tablet-sez';
    el.querySelector('section').appendChild(sez);
    const disegna = async () => {
      let lista = [];
      try { lista = (await Backend.elencoRuoli()).filter((r) => r.ruolo === 'dispositivo'); } catch (e) { sez.innerHTML = '<p class="muted small">Per gestire i tablet serve l\'account Google di un Master su questo dispositivo.</p>'; return; }
      sez.innerHTML = `<div class="card-head"><h2>Tablet condivisi ${info('Sui tablet usati da più persone non serve nessun account Google: crei qui un codice di attivazione, lo scrivi una volta sul tablet e da lì in poi ognuno entra con il suo PIN. Se un tablet si perde, toccalo e scollegalo: smette subito di vedere i dati.')}</h2>
        <button class="btn small" id="btnTab">+ Nuovo tablet</button></div>
        ${lista.map((r) => `<div class="riga-tab"><span>📱 <b>${esc(r.nome || 'TABLET')}</b><small>attivato il ${fmt((r.aggiornato || '').slice(0, 10))}</small></span><button class="btn ghost small danger" data-scol="${esc(r.email)}">Scollega</button></div>`).join('') || '<p class="muted small">Nessun tablet condiviso.</p>'}`;
      sez.querySelector('#btnTab').onclick = () => UI.modal({
        titolo: 'Nuovo tablet condiviso', valori: { nome: 'TABLET OFFICINA' },
        campi: [{ k: 'nome', label: 'Nome del tablet', req: true, placeholder: 'es. TABLET OFFICINA' }],
        onSalva: async (v) => {
          try {
            const d = await Backend.creaDispositivo();
            await Backend.impostaRuolo(d.email, 'dispositivo', v.nome);
            registra('creazione', 'Tablet condiviso ' + v.nome);
            setTimeout(() => mostraCodice(v.nome, d.codice), 50); disegna();
          } catch (e) { console.error(e); UI.toast(/operation-not-allowed/.test(e.code || '') ? 'Su Firebase va attivato l\'accesso «Email/password» (vedi istruzioni)' : 'Non riesco a creare il tablet', 'err'); return false; }
        }
      });
      sez.querySelectorAll('[data-scol]').forEach((b) => (b.onclick = async () => {
        if (!UI.conferma('Scollegare questo tablet? Smetterà subito di vedere i dati; per riusarlo servirà un nuovo codice.')) return;
        await Backend.togliRuolo(b.dataset.scol); registra('eliminazione', 'Tablet condiviso scollegato'); disegna();
      }));
    };
    disegna();
  }
  function mostraCodice(nome, codice) {
    const ov = document.createElement('div'); ov.className = 'modal-ov';
    ov.innerHTML = `<div class="modal"><div class="modal-head"><h2>Codice per ${esc(nome)}</h2></div>
      <div class="modal-body" style="display:block"><p>Sul tablet apri l'app e, in «Tablet condiviso», scrivi questo codice:</p>
      <p class="codice-grande">${esc(codice)}</p><p class="muted small">Serve una volta sola. Non lo vedrai più: se lo perdi, crei un nuovo tablet.</p></div>
      <div class="modal-foot"><span class="grow"></span><button class="btn" data-ok>Fatto</button></div></div>`;
    document.body.appendChild(ov); ov.querySelector('[data-ok]').onclick = () => ov.remove();
  }

  const TEMI = ['Classica', 'Tenue (colori leggeri)'];
  function modaleUtente(u) {
    const io = attuale();
    UI.modal({
      titolo: u ? 'Utente ' + u.nome : 'Nuovo utente',
      infoTxt: u ? 'Lascia vuoto il PIN per non cambiarlo.' : 'Scegli un PIN iniziale e comunicalo al collega: potrà cambiarlo dal suo profilo.',
      valori: u ? { ...u, ruolo: RUOLI[ruoloDi(u)], attivo: u.attivo !== false, tema: ['tenue', 'minimal'].includes(u.tema) ? TEMI[1] : TEMI[0] } : { ruolo: RUOLI.tecnico, attivo: true, tema: TEMI[0] },
      campi: [
        { k: 'nome', label: 'Nome e cognome', req: true, mezza: true },
        { k: 'nomeBreve', label: 'Sigla per il rapportino', mezza: true, placeholder: 'es. VL', aiuto: 'Compare solo sul rapportino stampato (PDF). Nell\'app si usa sempre il nome.' },
        { k: 'ruolo', label: 'Livello di accesso', tipo: 'select', opzioni: Object.entries(RUOLI).filter(([k]) => k !== 'developer' || isDev() || ruoloDi(u) === 'developer').map(([, v]) => v), mezza: true },
        { k: 'pin', label: u ? 'Nuovo PIN (4-6 cifre)' : 'PIN (4-6 cifre)', tipo: 'password', mezza: true },
        { k: 'google', label: Backend.mode === 'cloud' ? 'Account Google' : 'Account Google (per quando sarà online)', tipo: 'email', mezza: true, placeholder: 'nome@gmail.com', aiuto: Backend.mode === 'cloud' ? 'Senza account Google la persona entra solo col PIN su un dispositivo già collegato' : '' },
        { k: 'tema', label: 'Interfaccia', tipo: 'select', opzioni: TEMI, mezza: true, aiuto: '«Tenue»: tutti i colori molto più leggeri (per chi è sensibile alla luce), le sigle dei giudizi restano accese; nel controllo sottoganci la pagina resta ferma passando da un componente all\'altro. Vale solo per questo utente, su tutti i dispositivi.' },
        ...(u ? [{ k: 'attivo', label: 'Utente attivo (se lo togli non può più entrare)', tipo: 'sino' }] : [])
      ],
      onSalva: async (v) => {
        const ruolo = Object.keys(RUOLI).find((k) => RUOLI[k] === v.ruolo) || 'tecnico';
        if (ruolo === 'developer' && !isDev() && ruoloDi(u) !== 'developer') { UI.toast('Solo un Developer può creare un Developer', 'err'); return false; }
        const altriMaster = S.utenti.filter((x) => ALTI.includes(ruoloDi(x)) && x.attivo !== false && x.id !== u?.id);
        if (u && ALTI.includes(ruoloDi(u)) && (!ALTI.includes(ruolo) || v.attivo === false) && !altriMaster.length) { UI.toast('Deve restare almeno un Master o Developer attivo', 'err'); return false; }
        if ((!u || v.pin) && !pinValido(v.pin)) { UI.toast('Il PIN deve avere da 4 a 6 cifre', 'err'); return false; }
        if (v.pin && (await pinGiaUsato(v.pin, u?.id))) { UI.toast('PIN già usato da un altro utente', 'err'); return false; }
        if (v.google && S.utenti.some((x) => x.id !== u?.id && (x.google || '').toLowerCase() === v.google.toLowerCase())) { UI.toast('Account Google già associato a un altro utente', 'err'); return false; }
        const d = u ? { ...u } : { id: uid(), firma: null };
        Object.assign(d, { nome: v.nome, nomeBreve: v.nomeBreve || '', ruolo, google: (v.google || '').toLowerCase(), attivo: u ? v.attivo : true });
        if (v.tema === TEMI[1]) d.tema = 'tenue'; else delete d.tema;
        if (v.pin) { d.pinSalt = uid(); d.pinHash = await hash(d.pinSalt, v.pin); d.pinLen = v.pin.length; }
        await UI.salva('utenti', d); UI.toast('Utente salvato', 'ok');
        sincronizzaRuoli(S.utenti.filter((x) => x.id !== d.id).concat(d));
      },
      onElimina: u && u.id !== io?.id ? async () => {
        if (ALTI.includes(ruoloDi(u)) && !S.utenti.some((x) => ALTI.includes(ruoloDi(x)) && x.id !== u.id && x.attivo !== false)) { UI.toast('Deve restare almeno un Master', 'err'); return false; }
        if (!UI.conferma(`Eliminare l'utente ${u.nome}? I controlli già fatti restano con il suo nome. (In alternativa puoi solo disattivarlo.)`)) return false;
        await Backend.remove('utenti', u.id);
        sincronizzaRuoli(S.utenti.filter((x) => x.id !== u.id));
      } : null,
      testoElimina: 'Elimina utente'
    });
  }

  // ---------- Developer: da quali dispositivi entrano le persone ----------
  // «Azzera»: non cancella niente dal registro attività, segna solo da quando ricominciare a contare
  const azzerati = () => (S.impostazioni.find((x) => x.id === 'accessiAzzerati') || {}).da || {};
  async function accessi(logGia, ovGia) {
    let log = logGia || [];
    if (!logGia) try { log = await Backend.leggiTutti('log'); } catch (e) { return UI.toast('Per leggere gli accessi serve l\'account Google del Master su questo dispositivo', 'err'); }
    const da = azzerati();
    const acc = log.filter((x) => x.azione === 'accesso' && (!da[x.uid] || x.t > da[x.uid])), neg = log.filter((x) => x.azione === 'accesso negato' && (!da._neg || x.t > da._neg));
    const recente = (t) => t && (Date.now() - new Date(t).getTime()) < 7 * 864e5;
    const quando = (t) => { if (!t) return '—'; const d = new Date(t); return `${d.toLocaleDateString('it-IT')} ${d.toTimeString().slice(0, 5)}`; };
    const gruppi = (lista) => {
      const m = new Map();
      lista.forEach((x) => { const k = x.disp?.id || '?'; const g = m.get(k) || { disp: x.disp, n: 0, primo: x.t, ultimo: x.t, metodi: new Set() }; g.n++; if (x.t < g.primo) g.primo = x.t; if (x.t > g.ultimo) { g.ultimo = x.t; g.disp = x.disp || g.disp; } g.metodi.add((x.testo || '').replace('Accesso con ', '')); m.set(k, g); });
      return [...m.values()].sort((a, b) => b.ultimo.localeCompare(a.ultimo));
    };
    const rigaDisp = (g) => `<div class="acc-disp ${recente(g.primo) ? 'nuovo' : ''}">
      <div><b>${g.disp ? esc(g.disp.desc) : 'Dispositivo non registrato'}</b>${recente(g.primo) ? ' <span class="pill st-scadenza">🆕 nuovo</span>' : ''}
        <small>${g.disp ? [g.disp.nome, g.disp.account && 'account ' + g.disp.account, 'codice ' + (g.disp.id || '').slice(-6).toUpperCase()].filter(Boolean).map(esc).join(' · ') : 'accessi di prima di questa versione'}</small></div>
      <div class="acc-n"><b>${g.n}</b> ${g.n === 1 ? 'accesso' : 'accessi'}<small>ultimo ${quando(g.ultimo)}<br>primo ${quando(g.primo)}</small></div></div>`;
    const persone = [...new Set(acc.map((x) => x.uid))].map((id) => ({ id, nome: S.utenti.find((u) => u.id === id)?.nome || acc.find((x) => x.uid === id)?.nome || '—', g: gruppi(acc.filter((x) => x.uid === id)) }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    const ov = document.createElement('div'); ov.className = 'modal-ov';
    ov.innerHTML = `<div class="modal largo acc-mod"><div class="modal-head"><h2>📱 Accessi e dispositivi</h2><button type="button" class="modal-x" aria-label="Chiudi">×</button></div>
      <div class="modal-body">
        <p class="muted small">Il codice è fisso per ogni dispositivo (cambia solo se si cancellano i dati del browser). Se vedi un dispositivo che non conosci, cambia il PIN di quella persona.</p>
        ${persone.map((p) => `<h3 class="acc-chi">${esc(p.nome)} <span class="muted small">· ${p.g.length} ${p.g.length === 1 ? 'dispositivo' : 'dispositivi'}</span><button type="button" class="btn ghost small acc-az" data-az="${esc(p.id)}" data-nome="${esc(p.nome)}">Azzera</button></h3>${p.g.map(rigaDisp).join('')}`).join('') || '<p class="muted">Nessun accesso da contare.</p>'}
        ${neg.length ? `<h3 class="acc-chi txt-ko">PIN sbagliati<button type="button" class="btn ghost small acc-az" data-az="_neg" data-nome="PIN sbagliati">Azzera</button></h3>${gruppi(neg).map(rigaDisp).join('')}` : ''}
      </div>
      <div class="modal-foot"><span class="grow"></span><button type="button" class="btn" data-x>Chiudi</button></div></div>`;
    const chiudi = () => { ov.remove(); document.body.classList.remove('modal-aperto'); };
    ov.onclick = (e) => { if (e.target === ov) chiudi(); };
    ov.querySelector('.modal-x').onclick = chiudi; ov.querySelector('[data-x]').onclick = chiudi;
    ov.querySelectorAll('[data-az]').forEach((b) => (b.onclick = async () => {
      if (!UI.conferma(`Azzerare il conteggio di ${b.dataset.nome}?\n\nSi riparte da zero da adesso. Il registro attività resta com'è.`)) return;
      const doc = { id: 'accessiAzzerati', da: { ...azzerati(), [b.dataset.az]: new Date().toISOString() } };
      await UI.salva('impostazioni', doc);
      S.impostazioni = [...S.impostazioni.filter((x) => x.id !== doc.id), doc];
      registra('modifica', `Conteggio accessi azzerato: ${b.dataset.nome}`);
      const y = ov.querySelector('.modal-body').scrollTop; accessi(log, ov); UI.toast('Conteggio azzerato', 'ok');
      requestAnimationFrame(() => { const nb = document.querySelector('.acc-mod .modal-body'); if (nb) nb.scrollTop = y; });
    }));
    if (ovGia) ovGia.replaceWith(ov); else document.body.appendChild(ov);
    document.body.classList.add('modal-aperto');
  }

  // ---------- REGISTRO ATTIVITÀ (solo Master, si consulta in PDF) ----------
  const TIPI_LOG = { tutto: 'Tutte le operazioni', accessi: 'Solo accessi e uscite', modifiche: 'Solo creazioni, modifiche ed eliminazioni', stampe: 'Solo stampe' };
  const filtraLog = (log, q) => log.filter((x) => {
    if (q.u && x.uid !== q.u) return false;
    const g = x.t.slice(0, 10);
    if (q.dal && g < q.dal) return false;
    if (q.al && g > q.al) return false;
    if (q.tipo === 'accessi' && !/^(accesso|uscita|accesso negato)$/.test(x.azione)) return false;
    if (q.tipo === 'modifiche' && !/^(creazione|modifica|eliminazione)$/.test(x.azione)) return false;
    if (q.tipo === 'stampe' && x.azione !== 'stampa') return false;
    return true;
  }).sort((a, b) => b.t.localeCompare(a.t));
  let filtroLog = { u: '', dal: '', al: '', tipo: 'tutto' };

  async function registro(el, dati, parti) {
    S = dati;
    if (!isDev()) { el.innerHTML = '<p class="nessuno">Solo il Developer può vedere il registro attività.</p>'; return; }
    let log;
    try { log = await Backend.leggiTutti('log'); }
    catch (e) { el.innerHTML = '<section class="vuoto"><h1>🔒 Registro non disponibile</h1><p>Per leggere il registro questo dispositivo deve essere collegato a un account Google Master.</p></section>'; return; }
    if (parti[1] === 'stampa') return stampaRegistro(el, log);
    const persone = [...new Map(log.map((x) => [x.uid, x.nome])).entries()].filter(([id]) => id);
    S.utenti.forEach((u) => { if (!persone.some(([id]) => id === u.id)) persone.push([u.id, u.nome]); });
    el.innerHTML = `
      <section class="cli">
        <div class="sez-head"><h1>Registro attività ${info('Qui si ricava l\'elenco di chi ha fatto cosa e quando: accessi, creazioni, modifiche, eliminazioni e stampe. Per non appesantire l\'app il registro non si sfoglia qui: scegli i filtri e crea il PDF.')}</h1></div>
        <form class="card form" id="fLog" novalidate>
          <div class="due">
            <label>Persona<select name="u"><option value="">Tutti</option>${persone.map(([id, n]) => `<option value="${id}" ${filtroLog.u === id ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
            <label>Cosa<select name="tipo">${Object.entries(TIPI_LOG).map(([k, l]) => `<option value="${k}" ${filtroLog.tipo === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          </div>
          <div class="due">
            <label>Dal<input type="date" name="dal" value="${filtroLog.dal}"></label>
            <label>Al<input type="date" name="al" value="${filtroLog.al}"></label>
          </div>
          <p class="conta-log" id="conta"></p>
          <div class="azioni-form"><span class="grow"></span><button class="btn big" type="submit">📄 Crea PDF</button></div>
        </form>
        <p class="muted small">${Backend.mode === 'cloud' ? 'Il registro raccoglie le ultime 10.000 operazioni di tutti i dispositivi.' : 'Il registro conserva le ultime 10.000 operazioni di questo dispositivo.'}</p>
      </section>`;
    const f = el.querySelector('#fLog');
    const leggi = () => ({ u: f.u.value, tipo: f.tipo.value, dal: f.dal.value, al: f.al.value });
    const conta = () => { filtroLog = leggi(); const n = filtraLog(log, filtroLog).length; el.querySelector('#conta').textContent = `${n.toLocaleString('it-IT')} ${n === 1 ? 'operazione trovata' : 'operazioni trovate'}`; };
    f.oninput = conta; conta();
    f.onsubmit = (e) => { e.preventDefault(); filtroLog = leggi(); location.hash = '#/registro/stampa'; };
  }

  function stampaRegistro(el, log) {
    const q = filtroLog, righe = filtraLog(log, q);
    const persona = q.u ? (S.utenti.find((u) => u.id === q.u)?.nome || log.find((x) => x.uid === q.u)?.nome || '') : 'Tutti';
    const quando = (t) => { const d = new Date(t); return `${fmt(t.slice(0, 10))} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
    el.innerHTML = `
      <section class="stampa-recap">
        <div class="azioni-lista no-print">
          <button class="btn" id="btnStampa">🖨️ Stampa / salva PDF</button>
          <a class="btn ghost" href="#/registro">Torna ai filtri</a>
          ${info('Scegli «Salva come PDF» nella finestra di stampa, formato A4 verticale.')}
        </div>
        <div class="recap-wrap"><article class="recap">
          <header class="r-head"><img src="img/logo-grande.png" alt="">
            <div class="grow"><h1>Registro attività</h1><p>${esc(persona)} · ${esc(TIPI_LOG[q.tipo])}</p></div>
            <div class="r-cli"><b>${q.dal || q.al ? `${q.dal ? 'dal ' + fmt(q.dal) : ''} ${q.al ? 'al ' + fmt(q.al) : ''}` : 'Tutto il periodo'}</b><span>${righe.length} operazioni</span><small>Creato il ${fmt(UI.oggi())} · DEMO</small></div>
          </header>
          ${righe.length ? `<table class="r-tab"><thead><tr><th>Data e ora</th><th>Persona</th><th>Operazione</th><th>Cosa</th></tr></thead>
            <tbody>${righe.map((x) => `<tr><td>${quando(x.t)}</td><td>${esc(x.nome)}</td><td><b>${esc(x.azione)}</b></td><td>${esc(x.testo || '')}</td></tr>`).join('')}</tbody></table>`
            : '<p class="r-vuoto">Nessuna operazione con questi filtri.</p>'}
        </article></div>
      </section>`;
    el.querySelector('#btnStampa').onclick = () => {
      const t = document.title; document.title = `Registro_attivita_${persona}_${UI.oggi()}`.replace(/[^\w\-]+/g, '_');
      window.print(); setTimeout(() => (document.title = t), 1000);
    };
  }

  // ---------- CLOUD: accesso con Google, primo avvio, livelli ----------
  let ruoloDispositivo = null;
  const capi = () => (window.UTENTI_INIZIALI || []).filter((x) => ALTI.includes(x.ruolo)).map((x) => x.google.toLowerCase());
  const ruoloIniziale = (email) => (window.UTENTI_INIZIALI || []).find((x) => x.google.toLowerCase() === email)?.ruolo;
  // livello dell'account; senza rete uso l'ultimo noto (così il tablet si apre anche offline)
  const ruoloAccount = async (email) => {
    if (capi().includes(email) && !Backend.isDispositivo(email)) return ruoloIniziale(email);
    const k = 'gid_ruolo_' + email;
    let r = null;
    try { r = await Promise.race([Backend.ruoloAccount(email), new Promise((ok) => setTimeout(() => ok(undefined), navigator.onLine ? 15000 : 2500))]); } catch (e) { r = undefined; }
    try {
      if (r) localStorage.setItem(k, r);
      else if (r === null && navigator.onLine) localStorage.removeItem(k);   // tolto dal Master: niente accesso
      else r = localStorage.getItem(k);                                     // nessuna risposta (offline): ultimo noto
    } catch (e) {}
    return r || null;
  };
  const box = (el, html) => { el.innerHTML = `<section class="login"><div class="login-box card"><img src="img/logo-grande.png" alt="Gru Impianti" class="login-logo" onerror="this.remove()">${html}</div></section>`; };

  function chiediGoogle(el) {
    return new Promise((ok) => {
      box(el, `<h1>Collega il dispositivo</h1>
        <p class="muted">Serve una volta sola. Dopo, a ogni apertura basterà il PIN.</p>
        <button class="btn big google" id="btnG"><b>G</b> Il mio telefono: accedi con Google</button>
        <div class="o-sep"><span>oppure</span></div>
        <form id="fCod" class="form cod-disp" novalidate>
          <label>Tablet condiviso: codice di attivazione<input name="codice" placeholder="XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" maxlength="14"></label>
          <button class="btn ghost" type="submit">Attiva il tablet</button>
          <p class="muted small">Il codice lo crea il Master da «Utenti → Tablet condivisi».</p>
        </form>
        ${navigator.onLine ? '' : '<p class="txt-ko small">Serve la connessione a internet per il primo accesso.</p>'}`);
      el.querySelector('#btnG').onclick = async () => {
        try { ok(await Backend.loginGoogle()); }
        catch (e) { console.error(e); UI.toast(/popup-closed|cancelled/.test(e.code || '') ? 'Accesso annullato' : 'Accesso con Google non riuscito', 'err'); }
      };
      const fc = el.querySelector('#fCod');
      fc.codice.oninput = () => { const v = fc.codice.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12); fc.codice.value = v.match(/.{1,4}/g)?.join('-') || ''; };
      fc.onsubmit = async (e) => {
        e.preventDefault();
        try { ok(await Backend.loginDispositivo(fc.codice.value)); }
        catch (er) { console.error(er); UI.toast(er.message === 'codice' ? 'Il codice ha 12 caratteri (XXXX-XXXX-XXXX)' : /network/i.test(er.code || '') ? 'Serve la connessione a internet' : 'Codice non valido o tablet scollegato dal Master', 'err'); }
      };
    });
  }
  function aspetta(el, titolo, testo) {
    return new Promise((ok) => {
      box(el, `<h1>${titolo}</h1><p class="muted">${testo}</p>
        <button class="btn ghost" id="btnAltro">Usa un altro account Google</button>`);
      el.querySelector('#btnAltro').onclick = async () => { await Backend.esciGoogle(); ok(); };
    });
  }

  function primoAvvioCloud(el, email, collezioni) {
    const NOMI = { clienti: 'clienti', impianti: 'impianti', sottoganci: 'sottoganci', giriSottoganci: 'controlli sottoganci', schedeControllo: 'schede di controllo', mezzi: 'mezzi', utenti: 'utenti', impostazioni: 'impostazioni', log: 'righe di registro' };
    const tutte = collezioni.concat('log');
    const n = DatiLocali.conta(tutte);
    const ci = tutte.filter((c) => n[c] && c !== 'log' && c !== 'impostazioni');
    return new Promise((ok) => {
      box(el, `<h1>Primo avvio nel cloud</h1>
        <p class="muted">Il cloud è ancora vuoto. Lo prepari tu come Master: verranno creati anche gli utenti con il loro account Google.</p>
        ${ci.length ? `<div class="card"><b>Su questo dispositivo ci sono già:</b><p>${ci.map((c) => `${n[c]} ${NOMI[c]}`).join(' · ')}</p></div>
          <button class="btn big" id="btnCarica">☁️ Carica questi dati nel cloud</button>
          <button class="btn ghost" id="btnZero">Parti da zero</button>`
        : '<button class="btn big" id="btnZero">Prepara il cloud</button>'}
        <p class="muted small" id="stato"></p>`);
      const stato = el.querySelector('#stato');
      const vai = async (carica) => {
        if (!carica && ci.length && !UI.conferma('Partire da zero? I dati di questo dispositivo NON verranno caricati nel cloud.')) return;
        el.querySelectorAll('button').forEach((b) => (b.disabled = true));
        try {
          if (carica) for (const c of tutte) {
            if (c === 'utenti') continue;
            const docs = DatiLocali.leggi(c); if (!docs.length) continue;
            stato.textContent = `Carico ${docs.length} ${NOMI[c] || c}…`;
            await Backend.caricaMolti(c, docs);
          }
          stato.textContent = 'Preparo gli utenti…';
          const utenti = carica ? DatiLocali.leggi('utenti').map((u) => ({ ...u, ruolo: ruoloDi(u) })) : [];
          for (const x of window.UTENTI_INIZIALI || []) {
            const g = x.google.toLowerCase();
            let u = utenti.find((y) => (y.google || '').toLowerCase() === g);
            if (!u && g === email) u = utenti.find((y) => !y.google && ALTI.includes(ruoloDi(y)));
            if (u) Object.assign(u, { google: g, ruolo: x.ruolo });
            else utenti.push({ id: uid(), nome: g.split('@')[0].toUpperCase(), ruolo: x.ruolo, google: g, firma: null, attivo: true });
          }
          await Backend.caricaMolti('utenti', utenti);
          for (const u of utenti) if (u.google && u.attivo !== false) await Backend.impostaRuolo(u.google, ruoloDi(u), u.nome);
          registra('creazione', carica ? 'Primo avvio cloud: dati del dispositivo caricati' : 'Primo avvio cloud', { nome: email });
          ok();
        } catch (e) {
          console.error(e); stato.textContent = '';
          UI.toast('Caricamento non riuscito: controlla la connessione e le regole di Firebase', 'err');
          el.querySelectorAll('button').forEach((b) => (b.disabled = false));
        }
      };
      el.querySelector('#btnCarica')?.addEventListener('click', () => vai(true));
      el.querySelector('#btnZero').onclick = () => vai(false);
    });
  }

  // prima di vedere i dati: account Google del dispositivo autorizzato (e, la prima volta, preparazione del cloud)
  async function accessoCloud(el, collezioni) {
    document.body.classList.add('fuori');
    for (;;) {
      let email = Backend.account();
      if (!email) email = await chiediGoogle(el);
      box(el, '<h1>Controllo l\'accesso…</h1>');
      const ruolo = await ruoloAccount(email);
      if (!ruolo && Backend.isDispositivo(email)) { await aspetta(el, 'Tablet scollegato', 'Questo tablet non è più abilitato. Chiedi al Master un nuovo codice di attivazione.'); continue; }
      if (!ruolo) { await aspetta(el, 'Account non autorizzato', `L'account <b>${esc(email)}</b> non è abilitato al gestionale. Chiedi al Master di aggiungerlo da «Utenti».`); continue; }
      let vuoto = false;
      try { vuoto = (await Backend.contaServer('utenti')) === 0; } catch (e) { /* senza rete: uso la copia sul dispositivo */ }
      if (vuoto && !ALTI.includes(ruolo)) { await aspetta(el, 'Cloud non ancora pronto', 'Il primo accesso al cloud lo deve fare un Master. Riprova dopo.'); continue; }
      if (vuoto) await primoAvvioCloud(el, email, collezioni);
      ruoloDispositivo = ruolo;
      // account Developer di partenza (config.js): se la sua scheda utente è ancora «Master» la porto a Developer
      if (ruoloIniziale(email) === 'developer') {
        try {
          const u = (await Backend.leggiTutti('utenti')).find((x) => (x.google || '').toLowerCase() === email);
          if (u && ruoloDi(u) !== 'developer' && !u.accessoDev) { await Backend.save('utenti', { ...u, ruolo: 'developer' }); await Backend.impostaRuolo(email, 'developer', u.nome); }
        } catch (e) { console.error(e); }
      }
      // primo accesso con Google su questo dispositivo: entro subito come la persona di quell'account
      if (Backend.appenaEntrato()) {
        try {
          const u = (await Backend.leggiTutti('utenti')).find((x) => (x.google || '').toLowerCase() === email && x.attivo !== false);
          if (u) {
            SESS.set(u.id); registra('accesso', 'Accesso con Google', { utente: u });
            UI.toast('Ciao ' + u.nome.split(' ')[0], 'ok');
            if (!u.pinHash) { location.hash = '#/profilo'; setTimeout(() => UI.toast('Scegli il tuo PIN: dalla prossima volta entrerai con quello', ''), 2700); }
          }
        } catch (e) {}
      }
      box(el, '<h1>Caricamento…</h1><p class="muted">Sto scaricando i dati dal cloud.</p>');
      return { email, ruolo };
    }
  }

  // i livelli usati dalle regole di Firebase seguono gli utenti dell'app (solo un account Master può scriverli)
  async function sincronizzaRuoli(lista) {
    if (Backend.mode !== 'cloud' || !ALTI.includes(ruoloDispositivo)) return;
    const dev = ruoloDispositivo === 'developer';
    lista = lista || S.utenti;
    try {
      const voluti = new Map(lista.filter((u) => u.google && u.attivo !== false).map((u) => [u.google.toLowerCase(), { ruolo: ruoloDi(u), nome: u.nome }]));
      const ora = await Backend.elencoRuoli();
      // il Master non tocca i livelli Developer (lo impediscono anche le regole di Firebase)
      for (const [g, v] of voluti) { const r = ora.find((x) => x.email === g); if (!dev && (v.ruolo === 'developer' || r?.ruolo === 'developer')) continue; if (!r || r.ruolo !== v.ruolo || r.nome !== v.nome) await Backend.impostaRuolo(g, v.ruolo, v.nome); }
      for (const r of ora) if (!voluti.has(r.email) && r.ruolo !== 'dispositivo' && (dev || r.ruolo !== 'developer')) await Backend.togliRuolo(r.email);
    } catch (e) { console.error(e); UI.toast('Livelli nel cloud non aggiornati: serve un account Google Master su questo dispositivo', 'err'); }
  }

  // ---------- percorsi vietati per livello ----------
  function vietato(parti) {
    const r = ruoloSess(), p = parti.join('/');
    if (['registro', 'azzera', 'importa', 'sviluppo'].includes(parti[0]) && r !== 'developer') return 'Questa sezione è riservata al Developer.';
    if (['utenti', 'conflitti'].includes(parti[0]) && !ALTI.includes(r)) return 'Questa sezione è riservata al Master.';
    // stampa e invio ai clienti: solo Master e Risorse Umane
    const stampa = parti[0] === 'invio' || parti[0] === 'ordini' || (['controlli', 'sottoganci', 'approfonditi', 'gho'].includes(parti[0]) && parti.includes('stampa'));
    if (stampa && !['developer', 'master', 'ru'].includes(r)) return 'Stampa e invio ai clienti sono riservati al Master e a Risorse Umane.';
    if (r !== 'ru') return null;
    const modifica = /(^|\/)(nuovo|modifica|cartella-nuova|cartella|giro|modelli)(\/|$)/.test(p) || /^sottoganci\/s\//.test(p)
      || /^controlli\/i\/[^/]+\/\d{4}\/\d$/.test(p) || /^approfonditi\/[^/]+\/(a\/[^/]+\/controllo|s\/[^/]+$)/.test(p) || /^gho\/ore\/(?!stampa)[^/]+$/.test(p);
    return modifica ? 'Con l\'accesso Risorse Umane puoi consultare e stampare, ma non modificare.' : null;
  }

  // ---------- scelta dei tecnici di un controllo (di solito 2) ----------
  function campoTecnici(selezionati, firmaDi) {
    const sel = selezionati?.length ? selezionati : [attuale()?.id].filter(Boolean);
    return `
      <div class="tecnici" data-tecnici>
        <span class="lab">Tecnici ${info('Tocca i nomi di chi ha fatto il controllo (anche più di uno). Il nome compare solo nell\'app, non sulla scheda del cliente. Sulla scheda va la firma del tecnico scelto in «Firma sulla scheda».')}</span>
        <div class="chip-tecnici">${attivi().filter((u) => ruoloDi(u) !== 'ru' || sel.includes(u.id)).map((u) => `<button type="button" class="chip-t ${sel.includes(u.id) ? 'on' : ''}" data-t="${u.id}">${esc(breve(u))}</button>`).join('')}</div>
        <label class="firma-di">Firma sulla scheda<select data-firmadi></select></label>
      </div>`;
  }
  function collegaTecnici(root, firmaDi) {
    const box = root.querySelector('[data-tecnici]'), sel = box.querySelector('[data-firmadi]');
    const scelti = () => [...box.querySelectorAll('.chip-t.on')].map((b) => b.dataset.t);
    const aggiorna = () => {
      const ids = scelti(), prima = sel.value || firmaDi || attuale()?.id;
      sel.innerHTML = ids.map((id) => { const u = attivi().find((x) => x.id === id); return `<option value="${id}" ${id === prima ? 'selected' : ''}>${esc(breve(u))}${u.firma ? '' : ' (senza firma)'}</option>`; }).join('') || '<option value="">—</option>';
    };
    box.querySelectorAll('.chip-t').forEach((b) => (b.onclick = () => { b.classList.toggle('on'); aggiorna(); }));
    aggiorna();
    return () => {
      const tec = scelti().map((id) => attivi().find((x) => x.id === id));
      const f = tec.find((t) => t.id === sel.value) || tec[0];
      return { tecnici: tec.map((t) => ({ id: t.id, nome: breve(t) })), tecnico: tec.map((t) => breve(t)).join(' e '), firmaDi: f?.id || null, firma: f?.firma || null, firmatario: breve(f) };
    };
  }

  return { cambiaModo, cambiaTest,
    descrivi, attuale, isMaster, isDev, puoInviare, solaLettura, ruolo: () => ruoloSess(), RUOLI, schermata, profilo, gestione, registro, vietato, esci, iniziali,
    campoTecnici, collegaTecnici, installa, registra, accessoCloud, sincronizzaRuoli, ruoloDispositivo: () => ruoloDispositivo, nomi: () => attivi().filter((u) => ruoloDi(u) !== 'ru').map((u) => breve(u)), breve, sigla, attivi, ruoloDi, imposta: (dati) => (S = dati)
  };
})();
