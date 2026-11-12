// ===== AVVIO E NAVIGAZIONE =====
window.App = (function () {
  const VERSIONE = '0.46.29';
  const COLLEZIONI = ['conflitti', 'invii', 'collaudi', 'rapportini', 'utenti', 'clienti', 'sottoganci', 'giriSottoganci', 'impianti', 'impostazioni', 'schedeControllo', 'mezzi', 'layouts', 'attrezzi', 'controlliAttrezzi', 'schedeApprofondite', 'oreGho', 'promemoria', 'articoli', 'ddt', 'fornitori', 'ghoControlli'];
  const S = { conflitti: [], invii: [], collaudi: [], rapportini: [], utenti: [], clienti: [], sottoganci: [], giriSottoganci: [], impianti: [], impostazioni: [], schedeControllo: [], mezzi: [], promemoria: [], articoli: [], ddt: [], fornitori: [], ghoControlli: [], clientiCongelati: [] };
  // clienti congelati (es. falliti): spariscono da elenchi, ricerche, lavagna e avvisi, ma restano salvati con impianti e controlli.
  // S.clienti = solo quelli attivi; S.clienti.find(...) però li trova tutti, così i documenti vecchi mostrano ancora il nome.
  const TUTTI = {};
  const soloAttivi = (dati) => {
    const a = dati.filter((c) => !c.congelato);
    Object.defineProperty(a, 'find', { value: (fn) => dati.find(fn), enumerable: false });
    S.clientiCongelati = dati.filter((c) => c.congelato);
    return a;
  };
  const VERSIONE_AZZERAMENTO = '7'; // dalla 0.6.0 si parte da zero: niente più dati di esempio
  const el = document.getElementById('app');
  let vistaLive = true, pronti = 0;

  // i tecnici sono gli utenti dell'app
  const tecnicoPredefinito = () => UT.attuale()?.nome || '';
  const ricordaTecnico = () => {};

  // una pagina con modifiche non salvate (es. controllo sottoganci) mette qui una funzione che dice se c'è qualcosa da perdere
  let guardia = null, uscita = null, hashOra = location.hash;
  const percorso = [location.hash], posizioni = {};
  // «indietro» uguale al gesto del telefono: ogni voce della cronologia del browser ha un numero (gi).
  // cur = voce attuale; salta = voci di moduli già chiusi (es. il modulo dopo «Salva»), da saltare tornando indietro.
  // Le pagine con schermate interne (configuratore) aggiungono voci con passoInterno e tornano indietro con indietroInterno.
  let cur = 0, indietroInterno = null;
  const salta = new Set();
  try { if (!(history.state && typeof history.state.gi === 'number')) history.replaceState({ gi: 0 }, ''); cur = history.state.gi; } catch (e) {}
  const passoInterno = () => { cur++; try { history.pushState({ gi: cur, interno: true }, ''); } catch (e) {} };
  const suIndietroInterno = (fn) => { indietroInterno = fn; };
  const tornaIndietro = (alternativa) => { if (cur > 0) history.back(); else if (alternativa) location.hash = alternativa; };
  const proteggi = (fn) => { guardia = fn; };
  // una pagina che si salva da sola quando esci (es. controllo gru): fn salva e restituisce true se ci è riuscita
  const allUscita = (fn) => { uscita = fn; };
  const daSalvare = () => { try { return !!(guardia && guardia()); } catch (e) { return false; } };
  window.addEventListener('beforeunload', (e) => { if (daSalvare()) { e.preventDefault(); e.returnValue = ''; } });

  // Se stai scrivendo in una casella (es. ricerca cliente) e la pagina si ridisegna, la casella NON deve sparire
  // dal documento nemmeno per un attimo: su tablet Windows (e su alcuni Android) la tastiera virtuale si chiude
  // appena la casella perde il fuoco e non si riapre da sola. Allora la pagina, invece di riscrivere tutto,
  // sostituisce tutto TRANNE la casella (e i contenitori che la tengono), che resta al suo posto con il testo e il cursore.
  const chiaveCampo = (x) => (x.id ? '#' + CSS.escape(x.id) : x.dataset.f ? `[data-f="${CSS.escape(x.dataset.f)}"]` : x.name ? `[name="${CSS.escape(x.name)}"]` : '');
  let hashDisegnato = null;
  function innestaHtml(root, html, tieni, k) {
    const tpl = document.createElement('template'); tpl.innerHTML = html;
    const N = tpl.content, nuovo = N.querySelector(k);
    const catena = (x, stop) => { const c = []; while (x && x !== stop) { c.push(x); x = x.parentNode; } return x === stop ? c : null; };
    const ca = catena(tieni, root), cb = nuovo && catena(nuovo, N);
    if (!ca || !cb || ca.length !== cb.length || ca.some((a, i) => a.tagName !== cb[i].tagName) || nuovo.type !== tieni.type) { root.innerHTML = html; return; }
    let pa = root, pb = N;
    for (let i = ca.length - 1; i >= 0; i--) {
      const a = ca[i], b = cb[i];
      [...pa.childNodes].forEach((x) => x !== a && x.remove());
      let prima = true;
      [...pb.childNodes].forEach((x) => { if (x === b) { prima = false; return; } if (prima) pa.insertBefore(x, a); else pa.appendChild(x); });
      // attributi aggiornati (il valore scritto e il cursore della casella restano)
      [...a.attributes].forEach((at) => { if (!b.hasAttribute(at.name) && at.name !== 'value') a.removeAttribute(at.name); });
      [...b.attributes].forEach((at) => { if (at.name !== 'value' && a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value); });
      pa = a; pb = b;
    }
  }
  // ridisegno della STESSA pagina (es. dopo aver salvato una finestra): resto esattamente dove ero, non torno in cima
  function ridisegna() {
    const y = window.scrollY, stessa = location.hash === hashDisegnato;
    const r = ridisegnaDentro();
    if (stessa && y) { window.scrollTo(0, y); requestAnimationFrame(() => { if (Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y); }); }
    return r;
  }
  function ridisegnaDentro() {
    const att = document.activeElement;
    const tieni = att && el.contains(att) && (att.tagName === 'TEXTAREA' || (att.tagName === 'INPUT' && /^(text|search|tel|email|number|url)$/.test(att.type))) ? att : null;
    const k = tieni ? chiaveCampo(tieni) : '';
    const stessaPagina = location.hash === hashDisegnato; hashDisegnato = location.hash;   // cambiando pagina si riparte da zero
    if (!tieni || !k || !stessaPagina) return ridisegnaPagina(el);
    // la pagina riceve il contenitore "vero", solo la scrittura di innerHTML passa da innestaHtml
    const P = new Proxy(el, {
      get: (t, p) => { const v = Reflect.get(t, p); return typeof v === 'function' ? v.bind(t) : v; },
      set: (t, p, v) => { if (p === 'innerHTML' && t.contains(tieni)) innestaHtml(t, String(v), tieni, k); else t[p] = v; return true; }
    });
    return ridisegnaPagina(P);
  }
  function ridisegnaPagina(el) {
    guardia = null; uscita = null;
    const [path, qs] = (location.hash.replace(/^#\/?/, '') || '').split('?');
    const parti = path.split('/').filter(Boolean);
    const query = new URLSearchParams(qs || '');
    let info = { titolo: '', indietro: null, live: true };
    const y = window.scrollY;
    UT.imposta(S);
    // interfaccia «Tenue» (colori leggeri, sigle dei giudizi accese) solo per gli utenti che l'hanno
    document.documentElement.classList.toggle('tema-tenue', ['tenue', 'minimal'].includes(UT.attuale()?.tema));
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
    // tasto ⇄: solo per chi ha l'accesso Developer separato (passa da Developer al suo livello senza PIN)
    const sw = document.getElementById('btnSwitch');
    const tb = document.getElementById('btnTest');
    tb.hidden = !(io.accessoDev || UT.ruolo() === 'developer' || Backend.test); tb.classList.toggle('on', !!Backend.test); tb.title = Backend.test ? 'Sei in modalità test: tocca per uscire' : 'Entra in modalità test'; tb.onclick = UT.cambiaTest;
    sw.hidden = !io.accessoDev; sw.classList.toggle('on', UT.isDev()); sw.title = UT.isDev() ? 'Sei Developer: tocca per tornare normale' : 'Tocca per passare a Developer'; sw.onclick = UT.cambiaModo;
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
    else if (parti[0] === 'fornitori') info = FORN.route(el, S, parti) || info;
    else if (parti[0] === 'controlla') info = AIMP.pagina(el, S) || info;
    else if (parti[0] === 'impianti') info = IMP.route(el, S, parti, query) || info;
    else if (parti[0] === 'mezzi') info = MEZ.route(el, S, parti) || info;
    else if (parti[0] === 'magazzino') info = MAG.route(el, S, parti) || info;
    else if (parti[0] === 'controlli') info = CTR.route(el, S, parti, query) || info;
    else if (parti[0] === 'layout') info = LAY.route(el, S, parti, query) || info;
    else if (parti[0] === 'schede') info = HOME.renderSchede(el, S, parti) || info;
    else if (parti[0] === 'anagrafiche' || parti[0] === 'altro') info = HOME.renderAnagrafiche(el, S) || info;
    else if (parti[0] === 'ordini') info = CLI.paginaOrdini(el, S) || info;
    else if (HOME.caselle.some((c) => c.k === parti[0])) { HOME.prossimamente(el, parti[0]); info = { titolo: '', indietro: '#/' }; }
    else { location.hash = '#/'; return; }
    // clienti, impianti, layout e mezzi stanno dentro «Anagrafiche»: «indietro» riporta lì
    if (info.indietro === '#/' && ['clienti', 'impianti', 'layout', 'mezzi', 'fornitori'].includes(parti[0])) info.indietro = '#/anagrafiche';
    vistaLive = info.live !== false;
    const tit = document.getElementById('pageTitle');
    if (!parti.length) {
      // in home: la data di oggi e un saluto a chi è entrato
      const ora = new Date(), h = ora.getHours();
      const data = ora.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
      tit.innerHTML = `<span class="tb-data">${UI.esc(data.charAt(0).toUpperCase() + data.slice(1))}</span><span class="tb-saluto">${h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera'}, ${UI.esc(UT.breve(io) || io.nome)}</span>`;
    } else tit.textContent = info.titolo || '';
    const back = document.getElementById('btnBack');
    back.hidden = !info.indietro; back.onclick = () => tornaIndietro(info.indietro);   // come il gesto «indietro» del telefono
    document.body.classList.toggle('in-home', !parti.length);
    return y;
  }

  // quando cambiano i dati ridisegno, ma non se sto compilando un modulo
  let ruoliFatti = false;
  const PER_LAVAGNA = { clienti: (c) => ({ ...c, logo: null }), utenti: (u) => ({ id: u.id, nome: u.nome, nomeBreve: u.nomeBreve || '', ruolo: u.ruolo, attivo: u.attivo }), mezzi: (m) => m };
  const aggiornaDati = (col) => (dati) => {
    const prima = TUTTI[col] || S[col];
    TUTTI[col] = dati;
    S[col] = col === 'clienti' ? soloAttivi(dati) : dati;
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
    const fr = document.getElementById('btnRicarica'); if (fr) { fr.textContent = `v${VERSIONE} ↻`; fr.onclick = () => ricarica(); }
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
    const erroreDati = (e) => {
      if (/resource-exhausted|quota/i.test(String(e?.code || e?.message))) return;   // lo dice già l'avviso in alto
      if (!avvisato) { avvisato = true; UI.toast('Il cloud ha rifiutato la lettura: controlla le regole di Firebase', 'err'); }
    };
    // limite giornaliero gratuito di Firebase finito: avviso fisso finché il cloud non torna a rispondere
    window.addEventListener('gid-quota', (ev) => {
      let b = document.getElementById('avvisoQuota');
      if (!ev.detail) { b?.remove(); return; }
      if (!b) { b = document.createElement('div'); b.id = 'avvisoQuota'; b.setAttribute('role', 'alert'); document.body.prepend(b); }
      b.innerHTML = '<b>⚠️ Limite giornaliero gratuito di Firebase finito</b><span>Puoi continuare a lavorare: quello che salvi resta su questo dispositivo e parte da solo quando il limite si azzera (alle 9:00 di mattina). Fino ad allora gli altri dispositivi non vedono le modifiche e i numeri dei rapportini restano «in arrivo».</span>';
    });
    COLLEZIONI.forEach((c) => { Backend.subscribe(c, aggiornaDati(c), erroreDati); pronti++; });
    // voce della stessa pagina (schermata interna): la gestisce la pagina, se non ha più niente da chiudere si va oltre
    window.addEventListener('popstate', () => {
      if (location.hash !== hashOra) return;   // cambio di pagina: ci pensa hashchange
      const st = history.state; if (!st || typeof st.gi !== 'number') return;
      const ind = st.gi < cur; cur = st.gi;
      if (!ind) return;
      let ok = false; try { ok = !!(indietroInterno && indietroInterno()); } catch (e) {}
      if (!ok && st.interno) history.back();
    });
    window.addEventListener('hashchange', () => {
      // dove sono nella cronologia: voce già vista (indietro/avanti) o voce nuova
      const st = history.state, nuova = !(st && typeof st.gi === 'number'), prima = cur, hashPrima = hashOra;
      if (nuova) { cur++; try { history.replaceState({ gi: cur }, ''); } catch (e) {} } else cur = st.gi;
      if (!nuova && cur < prima && salta.has(cur)) { salta.delete(cur); hashOra = location.hash; history.back(); return; }   // modulo già chiuso: si salta
      // uscita da una pagina con modifiche non salvate (freccia dell'app, gesto indietro del telefono, link): chiedo prima
      if (uscita) { let ok = false; try { ok = uscita(); } catch (e) { console.error(e); } uscita = null; if (ok) guardia = null; }
      if (daSalvare() && !UI.conferma('Uscire senza salvare?\n\nTutto quello che non hai salvato con «💾 Salva» andrà perso.')) { cur++; history.pushState({ gi: cur }, '', hashOra); return; }
      // tornando indietro (freccia dell'app o del telefono) ritrovo la pagina dov'era; in una pagina nuova si parte dall'alto
      const indietro = percorso.length > 1 && percorso[percorso.length - 2] === location.hash;
      if (indietro) percorso.pop(); else { percorso.push(location.hash); if (percorso.length > 50) percorso.shift(); }
      // tornato alla pagina di prima con un link (es. dopo «Salva»): la voce della pagina appena chiusa e il doppione si saltano
      if (indietro && nuova) { salta.add(prima); salta.add(prima - 1); }
      // uscito in avanti da un modulo (nuovo/modifica) col «Salva»: tornando indietro il modulo non si riapre
      else if (nuova && /\/(nuov[oa]|modifica|cartella-nuova)(\/|\?|$)/.test(hashPrima)) salta.add(prima);
      indietroInterno = null;
      hashOra = location.hash;
      document.querySelectorAll('.modal-ov').forEach((m) => m.remove()); document.body.classList.remove('modal-aperto'); ridisegna();
      const y = indietro ? posizioni[location.hash] || 0 : 0;
      window.scrollTo(0, y);
      if (y) { requestAnimationFrame(() => window.scrollTo(0, y)); setTimeout(() => { if (Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y); }, 150); }
    });
    // dove sono arrivato in ogni pagina (per ritrovarla tornando indietro)
    window.addEventListener('scroll', () => { if (location.hash === hashOra) posizioni[hashOra] = window.scrollY; }, { passive: true });
    ridisegna();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    controllaVersione();
    setInterval(controllaVersione, 10 * 60 * 1000);
    // quando l'app torna davanti (anche i tablet Windows che la tengono «addormentata» invece di riaprirla)
    document.addEventListener('visibilitychange', () => { if (!document.hidden) controllaVersione(); });
    window.addEventListener('focus', () => controllaVersione());
    window.addEventListener('pageshow', () => controllaVersione());
    window.addEventListener('online', () => controllaVersione(true));
    // tasto «↻» nel piè di pagina: controlla la versione e ricarica (dove non c'è il gesto per aggiornare la pagina)
    // appena aggiornata: lo dico e tolgo «?agg=» dall'indirizzo
    const qa = new URLSearchParams(location.search).get('agg');
    if (qa) { history.replaceState(null, '', location.pathname + location.hash); setTimeout(() => UI.toast(`App aggiornata alla versione ${VERSIONE}`, 'ok'), 600); }
  }

  // ---------- c'è una versione più nuova? ----------
  // Leggo la versione pubblicata (dentro sw.js, sempre dalla rete) e se è più nuova di quella che sto usando
  // mostro a tutti un avviso con il pulsante «Aggiorna».
  const piuNuova = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
  let ultimoControllo = 0;
  // si può aggiornare da soli solo se nessuno sta scrivendo o ha una finestra aperta
  const aggiornabile = () => !daSalvare() && !document.querySelector('.modal-ov, .fg-over') &&
    !(document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName));
  async function versionePubblicata() {
    const r = await fetch('sw.js?c=' + Date.now(), { cache: 'no-store' });
    return ((await r.text()).match(/VERSIONE\s*=\s*'([\d.]+)'/) || [])[1] || '';
  }
  async function controllaVersione(forza) {
    if (!location.protocol.startsWith('http') || (!forza && Date.now() - ultimoControllo < 30000)) return;
    ultimoControllo = Date.now();
    try {
      const v = await versionePubblicata();
      if (!v || !piuNuova(v, VERSIONE)) return;
      // se è un buon momento mi aggiorno da solo, altrimenti avviso con il pulsante «Aggiorna»
      // ma una volta sola per versione: se dopo il ricaricamento sono ancora indietro (file non ancora tutti pubblicati)
      // non ricarico di nuovo (eviterei un giro infinito), mostro solo l'avviso
      let tentata = ''; try { tentata = sessionStorage.getItem('gi-agg-tentata') || ''; } catch (e) {}
      if (aggiornabile() && tentata !== v) { try { sessionStorage.setItem('gi-agg-tentata', v); } catch (e) {} aggiornaOra(v, true); }
      else mostraAggiorna(v);
    } catch (e) { /* senza rete: riprovo dopo */ }
  }
  // tasto ↻: se c'è una versione nuova la prende, altrimenti ricarica la pagina (dati e schermata freschi)
  async function ricarica() {
    const b = document.getElementById('btnRicarica'); if (b) b.textContent = '↻ …';
    let v = '';
    try { if (location.protocol.startsWith('http')) v = await versionePubblicata(); } catch (e) {}
    if (v && piuNuova(v, VERSIONE)) return aggiornaOra(v);
    if (daSalvare() && !UI.conferma('Stai compilando qualcosa che non è ancora salvato. Ricaricare lo stesso?\n\nQuello che non è salvato andrà perso.')) { if (b) b.textContent = `v${VERSIONE} ↻`; return; }
    guardia = null; location.reload();
  }
  function mostraAggiorna(nuova) {
    let b = document.getElementById('avvisoAgg');
    if (!b) { b = document.createElement('div'); b.id = 'avvisoAgg'; b.setAttribute('role', 'status'); document.body.appendChild(b); }
    b.innerHTML = `<span class="agg-ico">⬆️</span><span class="agg-txt"><b>È uscita una versione nuova dell'app</b><small>Tu hai la ${VERSIONE}, la nuova è la ${nuova}</small></span><button type="button" class="btn agg-btn">Aggiorna</button>`;
    b.querySelector('.agg-btn').onclick = () => aggiornaOra(nuova);
  }
  async function aggiornaOra(nuova, daSolo) {
    // prima salvo quello che si sta compilando (come quando si esce da una pagina)
    if (uscita && !daSolo) { try { uscita(); } catch (e) {} }
    if (!daSolo && daSalvare() && !UI.conferma('Stai compilando qualcosa che non è ancora salvato. Aggiornare lo stesso?\n\nQuello che non è salvato andrà perso.')) return;
    const b = document.getElementById('avvisoAgg'); if (b) b.querySelector('.agg-btn').textContent = 'Aggiorno…';
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) await reg.update().catch(() => {});
      if (window.caches) for (const k of await caches.keys()) if (!k.startsWith('lavagna')) await caches.delete(k);
    } catch (e) {}
    guardia = null;
    // ricarico la pagina chiedendo i file nuovi
    location.replace(location.pathname + '?agg=' + encodeURIComponent(nuova) + location.hash);
  }


  function esporta() {
    const dati = { app: 'gestionale-gruimpianti-demo', versione: VERSIONE, esportato: new Date().toISOString(), ...Object.fromEntries(COLLEZIONI.map((c) => [c, TUTTI[c] || S[c]])) };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(dati, null, 1)], { type: 'application/json' }));
    a.download = `backup-demo-gruimpianti-${UI.oggi()}.json`;
    a.click();
    UI.toast('Backup scaricato', 'ok');
  }

  document.addEventListener('DOMContentLoaded', () => { if (Backend.test) { document.body.classList.add('in-test'); document.getElementById('testBar').hidden = false; } });
  document.addEventListener('DOMContentLoaded', avvio);
  // dopo lo sblocco col PIN: se mentre era bloccato sono arrivati dati nuovi ridisegno, altrimenti lascio la pagina com'è
  const ridisegnaSeServe = () => { if (document.body.classList.contains('fuori')) ridisegna(); };
  const api = { passoInterno, suIndietroInterno, tornaIndietro, ridisegnaSeServe, proteggi, allUscita, ridisegna, esporta, tecnicoPredefinito, ricordaTecnico, VERSIONE, dati: () => S };
  Object.defineProperty(api, 'tecnici', { get: () => UT.nomi() });
  return api;
})();
