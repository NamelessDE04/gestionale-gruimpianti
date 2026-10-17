// ===== AVVIO E NAVIGAZIONE =====
window.App = (function () {
  const VERSIONE = '0.11.0';
  const COLLEZIONI = ['utenti', 'clienti', 'sottoganci', 'giriSottoganci', 'impianti', 'impostazioni', 'schedeControllo', 'mezzi'];
  const S = { utenti: [], clienti: [], sottoganci: [], giriSottoganci: [], impianti: [], impostazioni: [], schedeControllo: [], mezzi: [] };
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
    document.body.classList.toggle('master', UT.ruolo() === 'master');
    document.body.classList.toggle('sola-lettura', !!io && UT.solaLettura());
    const chip = document.getElementById('btnUtente');
    if (!io) {
      UT.schermata(el, S); vistaLive = false;
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
    else if (parti[0] === 'sottoganci') info = SG.route(el, S, parti, query) || info;
    else if (parti[0] === 'clienti') info = CLI.route(el, S, parti, query) || info;
    else if (parti[0] === 'impianti') info = IMP.route(el, S, parti, query) || info;
    else if (parti[0] === 'mezzi') info = MEZ.route(el, S, parti) || info;
    else if (parti[0] === 'controlli') info = CTR.route(el, S, parti, query) || info;
    else if (parti[0] === 'schede') info = HOME.renderSchede(el, S, parti) || info;
    else if (HOME.caselle.some((c) => c.k === parti[0])) { HOME.prossimamente(el, parti[0]); info = { titolo: '', indietro: '#/' }; }
    else { location.hash = '#/'; return; }
    vistaLive = info.live !== false;
    document.getElementById('pageTitle').textContent = info.titolo || '';
    const back = document.getElementById('btnBack');
    back.hidden = !info.indietro; back.onclick = () => (location.hash = info.indietro);
    document.body.classList.toggle('in-home', !parti.length);
    return y;
  }

  // quando cambiano i dati ridisegno, ma non se sto compilando un modulo
  const aggiornaDati = (col) => (dati) => {
    S[col] = dati;
    if (pronti < COLLEZIONI.length) return;
    if (vistaLive) { const y = window.scrollY; ridisegna(); window.scrollTo(0, y); }
  };


  async function avvio() {
    document.getElementById('appVersion').textContent = VERSIONE;
    document.getElementById('modeInfo').textContent = Backend.mode === 'cloud' ? '☁️ Sincronizzato' : '📱 Solo su questo dispositivo';
    await Backend.init();
    UT.installa();
    // dalla versione 0.6.0 si parte da zero: al primo avvio si cancellano tutti i dati di esempio e le prove
    if (Backend.mode === 'locale' && localStorage.getItem('gid_demo__dativer') !== VERSIONE_AZZERAMENTO) {
      Backend.wipe();
      ['gid_tecnici', 'gid_tecnico'].forEach((k) => localStorage.removeItem(k));
      try { indexedDB.deleteDatabase('gid_allegati'); } catch (e) {}
      localStorage.setItem('gid_demo__dativer', VERSIONE_AZZERAMENTO);
    }
    COLLEZIONI.forEach((c) => { Backend.subscribe(c, aggiornaDati(c)); pronti++; });
    window.addEventListener('hashchange', () => { document.querySelectorAll('.modal-ov').forEach((m) => m.remove()); document.body.classList.remove('modal-aperto'); ridisegna(); window.scrollTo(0, 0); });
    ridisegna();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }


  function esporta() {
    const dati = { app: 'gestionale-gruimpianti-demo', versione: VERSIONE, esportato: new Date().toISOString(), ...Backend.dumpAll(COLLEZIONI) };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(dati, null, 1)], { type: 'application/json' }));
    a.download = `backup-demo-gruimpianti-${UI.oggi()}.json`;
    a.click();
    UI.toast('Backup scaricato', 'ok');
  }

  document.addEventListener('DOMContentLoaded', avvio);
  const api = { ridisegna, esporta, tecnicoPredefinito, ricordaTecnico, VERSIONE };
  Object.defineProperty(api, 'tecnici', { get: () => UT.nomi() });
  return api;
})();
