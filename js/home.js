// ===== HOME A CASELLE =====
window.HOME = (function () {
  const caselle = [
    { k: 'rapportini', titolo: 'Rapportini di intervento', sotto: 'Interventi firmati dal cliente', ill: 'rapportini' },
    { k: 'schede', titolo: 'Schede di controllo', sotto: 'Carriponte, gru a bandiera, sottoganci', ill: 'schede', attiva: true },
    { k: 'clienti', titolo: 'Anagrafica Clienti', sotto: 'Ditte, sedi e referenti', ill: 'clienti', attiva: true },
    { k: 'impianti', titolo: 'Anagrafica Impianti', sotto: 'Gru, paranchi e carriponte', ill: 'impianti', attiva: true },
    { k: 'mezzi', titolo: 'Anagrafica mezzi', sotto: 'Furgoni, scadenze e documenti', ill: 'furgone', attiva: true },
    { k: 'magazzino', titolo: 'Magazzino ricambi', sotto: 'Ricambi, giacenze e ordini', ill: 'magazzino' },
    { k: 'lavagna', titolo: 'Lavagna', sotto: 'Calendario dell\'officina', ill: 'lavagna', attiva: true, href: (window.LAVAGNA_URL || 'lavagna/index.html') },
    { k: 'cablaggio', titolo: 'Configuratore cablaggio gru', sotto: 'Schemi di cablaggio guidati', ill: 'cablaggio' }
  ];
  // sotto-voci di "Schede di controllo"
  const schede = [
    { k: 'carriponte', titolo: 'Controllo carriponte e gru a bandiera', sotto: 'Schede di controllo D.Lgs. 81/08', ill: 'impianti', href: '#/controlli', attiva: true },
    { k: 'sottoganci', titolo: 'Controllo sottoganci e accessori di sollevamento', sotto: 'Funi, catene, brache: elenchi per cliente', ill: 'sottoganci', href: '#/sottoganci', attiva: true }
  ];

  const tile = (c, badge) => `
    <a class="tile ${c.attiva ? 'attiva' : 'presto'}" href="${c.href || '#/' + c.k}" data-k="${c.k}">
      <div class="tile-ill">${ILL[c.ill]}</div>
      <div class="tile-txt"><h2>${c.titolo}</h2><p>${c.sotto}</p></div>
      ${badge ? `<span class="tile-badge">${badge}</span>` : ''}
      ${c.attiva ? '' : '<span class="tile-presto">Prossimamente</span>'}
    </a>`;

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

  function render(el, S) {
    const ora = new Date().getHours();
    el.innerHTML = `
      <section class="home">
        <div class="home-head">
          <h1>${ora < 13 ? 'Buongiorno' : ora < 18 ? 'Buon pomeriggio' : 'Buonasera'}</h1>
          <p>Scegli cosa vuoi fare.</p>
        </div>
        ${avvisiMezzi(S)}
        <div class="tiles">${caselle.map((c) => tile(c, c.k === 'mezzi' && MEZ.avvisi(S).length ? `${MEZ.avvisi(S).length} ${MEZ.avvisi(S).length === 1 ? 'scadenza' : 'scadenze'}` : c.k === 'schede' ? [badgeCtr(S), badgeSottoganci(S)].filter(Boolean).join(' · ') : '')).join('')}</div>
        <div class="home-tools">
          <button class="btn ghost small" id="btnExport">Esporta dati (backup)</button>
          ${UT.isMaster() ? '<a class="btn ghost small" href="#/utenti">👥 Utenti</a><a class="btn ghost small" href="#/registro">📋 Registro attività</a>' : ''}
          ${UI.info('«Esporta dati» scarica una copia di tutto quello che hai inserito (clienti, impianti, controlli). Tienila al sicuro: per ora i dati sono solo su questo dispositivo. I documenti allegati non sono compresi.')}
        </div>
      </section>`;
    el.querySelector('#btnExport').onclick = () => App.esporta();
  }

  // pagina "Schede di controllo": sceglie il tipo di controllo
  function renderSchede(el, S, parti) {
    el.innerHTML = `
      <section class="home">
        <div class="home-head"><h1>Schede di controllo</h1><p>Che controllo devi fare?</p></div>
        <div class="tiles due-tiles">${schede.map((c) => tile(c, c.k === 'sottoganci' ? badgeSottoganci(S) : c.k === 'carriponte' ? badgeCtr(S) : '')).join('')}</div>
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

  return { render, renderSchede, prossimamente, caselle };
})();
