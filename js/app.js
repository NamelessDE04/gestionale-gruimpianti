// ===== AVVIO E NAVIGAZIONE =====
window.App = (function () {
  const VERSIONE = '0.42.26';
  const COLLEZIONI = ['conflitti', 'invii', 'collaudi', 'rapportini', 'utenti', 'clienti', 'sottoganci', 'giriSottoganci', 'impianti', 'impostazioni', 'schedeControllo', 'mezzi', 'layouts', 'attrezzi', 'controlliAttrezzi', 'schedeApprofondite', 'oreGho'];
  const S = { conflitti: [], invii: [], collaudi: [], rapportini: [], utenti: [], clienti: [], sottoganci: [], giriSottoganci: [], impianti: [], impostazioni: [], schedeControllo: [], mezzi: [] };
  const VERSIONE_AZZERAMENTO = '7'; // dalla 0.6.0 si parte da zero: niente più dati di esempio
  const el = document.getElementById('app');
  let vistaLive = true, pronti = 0;

  // i tecnici sono gli utenti dell'app
  const tecnicoPredefinito = () => UT.attuale()?.nome || '';
  const ricordaTecnico = () => {};

  function ridisegna() {
    const [path, qs] = (location.hash.replace(/^#\/?/, '') || '').split('?');
    const parti = path.split('/').filter(Boolean);
    const query = new URLSearchParams(qs || '');
    let info = { titolo: '', indietro: null, live: true };
    const y = window.scrollY;
    UT.imposta(S);
    // senza accesso si vede solo la schermata di login (o di primo avvio)
    const io = UT.attuale();
    document.body.classList.toggle('master', UT.isMaster());
    document.body.classList.toggle('developer', UT.isDev());
    document.body.classList.toggle('sola-lettura', !!io && UT.solaLettura());
    const chip = document.getElementById('btnUtente');
    if (!io) {
      UT.schermata(el, S); vistaLive = Backend.mode === 'cloud' && !S.utenti.length; // in cloud aspetto che arrivino gli utenti
      document.getElementById('pageTitle').textContent = ''; document.getElementById('btnBack').hidden = true; chip.hidden = true;
      return y;
    }
    document.body.classList.remove('fuori');
    chip.hidden = false; chip.textContent = UT.iniziali(io.nome); chip.title = io.nome + ' – profilo';
    if (!parti.length) HOME.render(el, S);
    else if (parti[0] === 'profilo') info = UT.profilo(el, S) || info;
    else if (UT.vietato(parti)) { el.innerHTML = `<section class="vuoto"><h1>🔒 Accesso limitato</h1><p>${UT.vietato(parti)}</p><button class="btn" onclick="history.back()">Indietro</button></section>`; info = { titolo: '', indietro: '#/' }; }
    else if (parti[0] === 'utenti') info = UT.gestione(el, S) || info;
    else if (parti[0] === 'registro') { UT.registro(el, S, parti); info = { titolo: parti[1] ? 'Registro attività · PDF' : 'Registro attività', indietro: parti[1] ? '#/registro' : '#/profilo', live: false }; }
    else if (parti[0] === 'conflitti') info = CONF.pagina(el, S) || info;
    else if (parti[0] === 'azzera') info = AZZ.pagina(el, S) || info;
    else if (parti[0] === 'importa') info = IMPORTA.pagina(el, S) || info;
    else if (parti[0] === 'invio') info = INVIO.route(el, S, parti, query) || info;
    else if (parti[0] === 'cablaggio') info = CAB.route(el, S, parti) || info;
    else if (parti[0] === 'rapportini') info = RAP.route(el, S, parti, query) || info;
    else if (parti[0] === 'sottoganci') info = SG.route(el, S, parti, query) || info;
    else if (parti[0] === 'sviluppo') info = DEV.pagina(el, S) || info;
    else if (parti[0] === 'gho') info = GHO.route(el, S, parti, query) || info;
    else if (parti[0] === 'approfonditi') info = APR.route(el, S, parti, query) || info;
    else if (parti[0] === 'clienti') info = CLI.route(el, S, parti, query) || info;
    else if (parti[0] === 'impianti') info = IMP.route(el, S, parti, query) || info;
    else if (parti[0] === 'mezzi') info = MEZ.route(el, S, parti) || info;
    else if (parti[0] === 'controlli') info = CTR.route(el, S, parti, query) || info;
    else if (parti[0] === 'layout') info = LAY.route(el, S, parti, query) || info;
    else if (parti[0] === 'schede') info = HOME.renderSchede(el, S, parti) || info;
    else if (parti[0] === 'altro') info = HOME.renderAltro(el, S) || info;
    else if (parti[0] === 'ordini') info = CLI.paginaOrdini(el, S) || info;
    else if (HOME.caselle.some((c) => c.k === parti[0])) { HOME.prossimamente(el, parti[0]); info = { titolo: '', indietro: '#/' }; }
    else { location.hash = '#/'; return; }
    // il tecnico arriva a clienti, impianti, layout e mezzi da «Anagrafiche e altro»: «indietro» lo riporta lì
    if (UT.ruolo() === 'tecnico' && info.indietro === '#/' && ['clienti', 'impianti', 'layout', 'mezzi', 'magazzino'].includes(parti[0])) info.indietro = '#/altro';
    vistaLive = info.live !== false;
    const tit = document.getElementById('pageTitle');
    if (!parti.length) {
      // in home: la data di oggi e un saluto a chi è entrato
      const ora = new Date(), h = ora.getHours();
      const data = ora.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
      tit.innerHTML = `<span class="tb-data">${UI.esc(data.charAt(0).toUpperCase() + data.slice(1))}</span><span class="tb-saluto">${h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera'}, ${UI.esc(UT.breve(io) || io.nome)}</span>`;
    } else tit.textContent = info.titolo || '';
    const back = document.getElementById('btnBack');
    back.hidden = !info.indietro; back.onclick = () => (location.hash = info.indietro);
    document.body.classList.toggle('in-home', !parti.length);
    return y;
  }

  // quando cambiano i dati ridisegno, ma non se sto compilando un modulo
  let ruoliFatti = false;
  const PER_LAVAGNA = { clienti: (c) => ({ ...c, logo: null }), utenti: (u) => ({ id: u.id, nome: u.nome, nomeBreve: u.nomeBreve || '', ruolo: u.ruolo, attivo: u.attivo }), mezzi: (m) => m };
  const aggiornaDati = (col) => (dati) => {
    const prima = S[col];
    S[col] = dati;
    CONF.verifica(col, prima, dati);   // due dispositivi hanno lavorato in parallelo sullo stesso documento?
    if (col === 'rapportini') RAP.assegnaNumeri(S);
    if (Backend.mode === 'cloud') {
      // la Lavagna legge le anagrafiche dalla copia sul dispositivo
      if (PER_LAVAGNA[col]) try { localStorage.setItem('gid_demo_' + col, JSON.stringify(dati.map(PER_LAVAGNA[col]))); } catch (e) {}
      if (col === 'utenti' && dati.length && !ruoliFatti) { ruoliFatti = true; setTimeout(() => UT.sincronizzaRuoli(), 3000); }
    }
    if (pronti < COLLEZIONI.length) return;
    if (vistaLive) { const y = window.scrollY; ridisegna(); window.scrollTo(0, y); }
  };


  async function avvio() {
    document.getElementById('appVersion').textContent = VERSIONE;
    const info = document.getElementById('modeInfo');
    const rete = () => (document.getElementById('reteOff').hidden = Backend.mode !== 'cloud' || navigator.onLine, info.textContent = Backend.mode !== 'cloud' ? '📱 Solo su questo dispositivo' : navigator.onLine ? '☁️ Cloud sincronizzato' : '📴 Senza rete: si sincronizza al ritorno');
    rete(); window.addEventListener('online', rete);
    window.addEventListener('online', () => setTimeout(() => RAP.assegnaNumeri(S), 2000)); window.addEventListener('offline', rete);
    try { await Backend.init(); }
    catch (e) { el.innerHTML = '<section class="vuoto"><h1>Cloud non raggiungibile</h1><p>Il primo avvio ha bisogno di internet. Controlla la connessione e riprova.</p><button class="btn" onclick="location.reload()">Riprova</button></section>'; return; }
    UT.installa();
    if (Backend.mode === 'cloud') await UT.accessoCloud(el, COLLEZIONI);
    // dalla versione 0.6.0 si parte da zero: al primo avvio si cancellano tutti i dati di esempio e le prove
    if (Backend.mode === 'locale' && localStorage.getItem('gid_demo__dativer') !== VERSIONE_AZZERAMENTO) {
      Backend.wipe();
      ['gid_tecnici', 'gid_tecnico'].forEach((k) => localStorage.removeItem(k));
      try { indexedDB.deleteDatabase('gid_allegati'); } catch (e) {}
      localStorage.setItem('gid_demo__dativer', VERSIONE_AZZERAMENTO);
    }
    let avvisato = false;
    const erroreDati = () => { if (!avvisato) { avvisato = true; UI.toast('Il cloud ha rifiutato la lettura: controlla le regole di Firebase', 'err'); } };
    COLLEZIONI.forEach((c) => { Backend.subscribe(c, aggiornaDati(c), erroreDati); pronti++; });
    window.addEventListener('hashchange', () => { document.querySelectorAll('.modal-ov').forEach((m) => m.remove()); document.body.classList.remove('modal-aperto'); ridisegna(); window.scrollTo(0, 0); });
    ridisegna();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }


  function esporta() {
    const dati = { app: 'gestionale-gruimpianti-demo', versione: VERSIONE, esportato: new Date().toISOString(), ...Object.fromEntries(COLLEZIONI.map((c) => [c, S[c]])) };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(dati, null, 1)], { type: 'application/json' }));
    a.download = `backup-demo-gruimpianti-${UI.oggi()}.json`;
    a.click();
    UI.toast('Backup scaricato', 'ok');
  }

  document.addEventListener('DOMContentLoaded', avvio);
  const api = { ridisegna, esporta, tecnicoPredefinito, ricordaTecnico, VERSIONE, dati: () => S };
  Object.defineProperty(api, 'tecnici', { get: () => UT.nomi() });
  return api;
})();
