// ===== HOME A CASELLE =====
window.HOME = (function () {
  const caselle = [
    { k: 'rapportini', titolo: 'Rapportini di intervento', sotto: 'Interventi firmati dal cliente', ill: 'rapportini', attiva: true },
    { k: 'schede', titolo: 'Schede di controllo', sotto: 'Carriponte, sottoganci e controlli approfonditi', ill: 'schede', attiva: true },
    { k: 'clienti', titolo: 'Anagrafica Clienti', sotto: 'Ditte, sedi e referenti', ill: 'clienti', attiva: true },
    { k: 'impianti', titolo: 'Anagrafica Impianti', sotto: 'Gru, paranchi e carriponte', ill: 'impianti', attiva: true },
    { k: 'layout', titolo: 'Layout delle sedi', sotto: 'Piante dei capannoni con le gru', ill: 'layout', attiva: true },
    { k: 'mezzi', titolo: 'Anagrafica mezzi', sotto: 'Furgoni, scadenze e documenti', ill: 'furgone', attiva: true },
    { k: 'magazzino', titolo: 'Magazzino ricambi', sotto: 'Ricambi, giacenze e ordini', ill: 'magazzino' },
    { k: 'lavagna', titolo: 'Lavagna', sotto: 'Calendario dell\'officina', ill: 'lavagna', attiva: true, href: (window.LAVAGNA_URL || 'lavagna/index.html') },
    { k: 'invio', titolo: 'Invia ai clienti', sotto: 'Schede, rapportini ed elenchi sottoganci nella stessa email', ill: 'invio', attiva: true, href: '#/invio', soloInvio: true },
    { k: 'gho', titolo: 'GHO ELIGIO', sotto: 'Registro ore e configuratore cablaggio', ill: 'gho', attiva: true, href: '#/gho' }
  ];
  // sotto-voci di "Schede di controllo"
  const schede = [
    { k: 'carriponte', titolo: 'Controllo carriponte e gru a bandiera', sotto: 'Schede di controllo D.Lgs. 81/08', ill: 'impianti', href: '#/controlli', attiva: true },
    { k: 'sottoganci', titolo: 'Controllo sottoganci e accessori di sollevamento', sotto: 'Funi, catene, brache: elenchi per cliente', ill: 'sottoganci', href: '#/sottoganci', attiva: true },
    { k: 'approfonditi', titolo: 'Altri controlli approfonditi', sotto: 'Pinze e ganci a C, magneti, funi e carrucole, bozzello, indagine', ill: 'approfonditi', href: '#/approfonditi', attiva: true }
  ];

  const tile = (c, badge) => `
    <a class="tile ${c.attiva ? 'attiva' : 'presto'}" href="${c.href || '#/' + c.k}" data-k="${c.k}">
      <div class="tile-ill">${ILL[c.ill]}</div>
      <div class="tile-txt"><h2>${c.titolo}</h2><p>${c.sotto}</p>${badge ? `<span class="tile-badge">${badge}</span>` : ''}</div>
      ${c.attiva ? '' : '<span class="tile-presto">Prossimamente</span>'}
    </a>`;

  // casella divisa in due: si sceglie come lavorare (elenco classico o pianta della sede)
  const tileDoppia = (c, badge) => `
    <div class="tile attiva tile-doppia" data-k="${c.k}">
      <a class="tile-sopra" href="#/controlli">
        <div class="tile-ill">${ILL[c.ill]}</div>
        <div class="tile-txt"><h2>${c.titolo}</h2><p>${c.sotto}</p>${badge ? `<span class="tile-badge">${badge}</span>` : ''}</div>
      </a>
      <div class="tile-vista">
        <a href="#/controlli"><span class="tv-ico">☰</span><span>Elenco</span></a>
        <a href="#/layout?ctr=1"><span class="tv-ico">🗺️</span><span>Layout</span></a>
      </div>
    </div>`;

  const badgeSottoganci = (S) => {
    const n = SG.riepilogo(S).scaduti;
    return n ? `${n} ${n === 1 ? 'cartella' : 'cartelle'} sottoganci da controllare` : '';
  };

  const badgeCtr = (S) => { const n = CTR.riepilogo(S); return n ? `${n} ${n === 1 ? 'sede' : 'sedi'} con controlli in ritardo` : ''; };

  // avvisi in alto: bollo, revisione o assicurazione scaduti o in scadenza entro 30 giorni
  const avvisiMezzi = (S) => {
    const a = MEZ.avvisi(S); if (!a.length) return '';
    return `<div class="avvisi-mezzi">${a.map((x) => `<a class="avviso-m st-b-${x.st.k}" href="#/mezzi/${x.m.id}">
      <span class="av-ico">${x.st.k === 'scaduto' ? '⛔' : '⚠️'}</span>
      <span class="grow"><b>${UI.esc(x.l)} ${UI.esc(MEZ.corto(x.m))}</b><span>${x.st.k === 'scaduto' ? 'scaduto il' : 'scade il'} ${UI.fmt(x.d)} · ${UI.esc(x.st.label)}</span></span>›</a>`).join('')}</div>`;
  };

  // il tecnico vede solo il lavoro di tutti i giorni; il resto sta in «Anagrafiche e altro»
  const PRINCIPALI = ['schede', 'rapportini', 'lavagna', 'gho'];
  const ALTRO = { k: 'altro', titolo: 'Anagrafiche e altro', sotto: 'Clienti, impianti, layout, mezzi…', ill: 'altro', attiva: true, href: '#/altro' };
  const ridotta = () => UT.ruolo() === 'tecnico';
  const vociHome = () => (ridotta() ? [...PRINCIPALI.map((k) => caselle.find((c) => c.k === k)), ALTRO] : caselle.filter((c) => !c.soloInvio || UT.puoInviare()));
  const nScad = (S) => MEZ.avvisi(S).length;
  const badge = (S, c) => c.k === 'rapportini' ? RAP.badge(S)
    : c.k === 'gho' ? GHO.badge(S)
    : (c.k === 'mezzi' || c.k === 'altro') && nScad(S) ? `${nScad(S)} ${nScad(S) === 1 ? 'scadenza mezzi' : 'scadenze mezzi'}`
    : c.k === 'schede' ? [badgeCtr(S), badgeSottoganci(S)].filter(Boolean).join(' · ') : '';

  // pagina «Anagrafiche e altro»: tutte le caselle che non stanno nella home del tecnico
  function renderAltro(el, S) {
    const resto = caselle.filter((c) => !PRINCIPALI.includes(c.k) && !c.soloInvio);
    el.innerHTML = `<section class="home"><div class="tiles">${resto.map((c) => tile(c, badge(S, c))).join('')}</div></section>`;
    return { titolo: 'Anagrafiche e altro', indietro: '#/', live: true };
  }

  function render(el, S) {
    const ora = new Date().getHours();
    el.innerHTML = `
      <section class="home">
        <!-- data e saluto ora stanno nella barra in alto -->
        ${UT.isMaster() && CONF.conta(S) ? `<a class="avviso-m st-b-scaduto" href="#/conflitti"><span class="av-ico">⚠️</span><span class="grow"><b>${CONF.conta(S)} ${CONF.conta(S) === 1 ? 'conflitto' : 'conflitti'} tra dispositivi</b><span>Due dispositivi offline hanno lavorato sugli stessi documenti: scegli cosa tenere</span></span>›</a>` : ''}
        ${avvisiMezzi(S)}
        ${UT.puoInviare() && CLI.ordiniDaAggiornare(S).length ? `<a class="avviso-m st-b-scadenza" href="#/ordini"><span class="av-ico">🧾</span><span class="grow"><b>N° d'ordine ${UI.oggi().slice(0, 4)} da aggiornare: ${CLI.ordiniDaAggiornare(S).length} ${CLI.ordiniDaAggiornare(S).length === 1 ? 'sede' : 'sedi'}</b><span>Il codice del contratto di verifica cambia ogni anno: scrivilo o rimanda l'avviso</span></span>›</a>` : ''}
        <div class="tiles">${vociHome().map((c) => tile(c, badge(S, c))).join('')}</div>
        <p class="in-arrivo">In arrivo: ${caselle.filter((c) => !c.attiva).map((c) => c.titolo).join(' · ')}</p>
      </section>`;
  }

  // pagina "Schede di controllo": sceglie il tipo di controllo
  function renderSchede(el, S, parti) {
    el.innerHTML = `
      <section class="home">
        <div class="home-head"><h1>Schede di controllo</h1><p>Che controllo devi fare?</p></div>
        <div class="tiles due-tiles">${schede.map((c) => (c.k === 'carriponte' ? tileDoppia(c, badgeCtr(S)) : tile(c, c.k === 'sottoganci' ? badgeSottoganci(S) : c.k === 'approfonditi' ? '🧪 BETA · in prova' : ''))).join('')}</div>
      </section>`;
    return { titolo: 'Schede di controllo', indietro: '#/', live: true };
  }

  // pagina per i moduli non ancora pronti
  function prossimamente(el, kOCasella) {
    const c = typeof kOCasella === 'string' ? caselle.find((x) => x.k === kOCasella) : kOCasella;
    el.innerHTML = `
      <section class="vuoto">
        <div class="vuoto-ill">${ILL[c.ill]}</div>
        <h1>${c.titolo}</h1>
        <p>Questa sezione sarà disponibile nei prossimi passi della demo.</p>
        <a class="btn" href="#/">Torna alla home</a>
      </section>`;
  }

  return { render, renderSchede, renderAltro, prossimamente, caselle };
})();
