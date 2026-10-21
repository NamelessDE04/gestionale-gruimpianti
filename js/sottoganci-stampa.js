// ===== STAMPA "ELENCO SOTTOGANCI" PER IL CLIENTE =====
// Riproduce l'impaginazione dell'elenco Excel attuale: A4 orizzontale, misure in millimetri
// prese dal PDF originale. Pagina 1 con intestazione, pagine successive con la sola riga titoli,
// ultima pagina con NOTE, legenda e timbro/firma.
window.SGStampa = (function () {
  const { esc } = UI;

  // larghezze colonne (mm) – totale 243,8 mm, margine sinistro 25 mm
  const COL = [12.1, 36.5, 21.9, 15.0, 14.9, 19.7, 4.7, 14.3, 14.3, 14.3, 14.3, 4.7, 57.1];
  const SX = 25.0, LARG = 243.8;
  const H_TH = 5.47, H_R = 5.43;           // altezza riga titoli / riga dati
  const TOP1 = 41.0, TOP2 = 16.2;          // inizio tabella: pagina 1 / pagine seguenti
  const CAP1 = 27, CAP = 28, CAP_ULTIMA = 14; // righe per pagina
  const H_PIEDE = 76.2;                    // spazio occupato da NOTE + legenda

  const LEGENDA = 'LEGENDA: S = SCORTA ; \\ = ELIMINATE ; B= BUONA ; D= DISCRETA &nbsp;; E= DA ELIMINARE ; SU= SCORTA UTILIZZATA ; NC=NON CONTROLLATA ; FS= FUORI SERVIZIO';
  const RIGHE_PIEDE = [
    'N° STAMPIGLIATO<span class="gap"></span>C= CAMPANELLA<span class="gap"></span>P= PIASTRINA<span class="gap"></span>M= MANICOTTO',
    "LE QUOTE SONO INDICATIVE ED UTILIZZATE PER L'IDENTIFICAZIONE",
    'PER CONOSCERE LE PORTATE CONSULTARE LA TABELLA (PORTATA DELLE BRACHE) ESPOSTA IN REPARTO',
    'LE FUNI SOTTOGANCIO INUTILIZZATE VANNO DEPOSITATE SU APPOSITO SCAFFALE <span class="norm">(non si danneggiano e aiuta il controllo)</span>'
  ];
  const IMPORTANTE = 'IMPORTANTE - DEPOSITARE LE FUNI DA ELIMINARE IN APPOSITO CASSONE CHIUSO A CHIAVE - PROVVEDE GRU IMPIANTI AD ELIMINARLE';

  const colgroup = `<colgroup>${COL.map((w) => `<col style="width:${w}mm">`).join('')}</colgroup>`;

  function intestazioneTabella(giri) {
    return `<tr class="p-th" style="height:${H_TH}mm">
      <th>N°</th><th>DENOMINAZIONE</th><th>DIMENS.</th><th>PORTATA</th><th class="p-ubic">UBICAZIONE</th><th>N° CERTIF.</th>
      <th class="p-sp1"></th>
      ${SG.SLOT.map((s, i) => `<th class="p-data" style="background:${s.col}">${giri[i] ? SG.dataBreve(giri[i].data) : ''}</th>`).join('')}
      <th class="p-sp1"></th><th class="p-noteh">NOTE</th></tr>`;
  }

  function righeSottogancio(S, sg, giri, anno) {
    const note = SG.noteDi(S, sg, anno);
    const n = sg.parti.length;
    return sg.parti.map((p, i) => {
      const rs = i === 0 && n > 1 ? ` rowspan="${n}"` : '';
      const fisse = i === 0 ? `<td${rs} data-adatta="0.4" data-righe="2">${esc(sg.numero)}</td>` : '';
      const fisse2 = i === 0 ? `<td${rs} data-adatta="0.4" data-righe="2">${esc(sg.portata)}</td><td${rs} data-adatta="0.4" data-righe="2">${esc(sg.ubicazione)}</td><td${rs} data-adatta="0.4" data-righe="2">${esc(sg.certificato)}</td>` : '';
      const cod = giri.map((g) => {
        const c = g?.righe[sg.id]?.codici[i] || '';
        return `<td class="${({ D: 'p-esD', DE: 'p-esDE', E: 'p-esE' })[c] || ''}">${esc(c)}</td>`;
      }).join('');
      return `<tr style="height:${H_R}mm" class="${i < n - 1 ? 'p-sub' : ''}">${fisse}<td data-adatta="0.4" data-righe="2">${esc(p.denominazione)}</td><td data-adatta="0.4" data-righe="2">${esc(p.dimensioni)}</td>${fisse2}
        <td class="p-sp"></td>${cod}<td class="p-sp"></td><td class="p-nota" data-adatta="0.4" data-righe="2">${esc(note[i] || '')}</td></tr>`;
    }).join('');
  }
  const rigaVuota = () => `<tr style="height:${H_R}mm"><td></td><td></td><td></td><td></td><td></td><td></td><td class="p-sp"></td><td></td><td></td><td></td><td></td><td class="p-sp"></td><td></td></tr>`;

  // divide i sottoganci in pagine senza spezzare i gruppi (es. tirante + campanella + ganci)
  function impagina(items) {
    const pagine = []; let cur = [], usate = 0, cap = CAP1;
    items.forEach((it) => {
      const n = it.parti.length;
      if (usate + n > cap && cur.length) { pagine.push({ items: cur, cap }); cur = []; usate = 0; cap = CAP; }
      cur.push(it); usate += n;
    });
    // ultima pagina: deve lasciare spazio a NOTE e legenda
    const capUltima = pagine.length === 0 ? CAP1 - CAP_ULTIMA : CAP_ULTIMA;
    if (usate <= capUltima) pagine.push({ items: cur, cap: capUltima, piede: true });
    else { pagine.push({ items: cur, cap }); pagine.push({ items: [], cap: CAP_ULTIMA, piede: true }); }
    return pagine;
  }

  function piede(top, giri, noteGenerali, firma) {
    const righeNote = (noteGenerali || '').split('\n').slice(0, 7);
    while (righeNote.length < 7) righeNote.push('');
    const y = (d) => `top:${(top + d).toFixed(2)}mm`;
    return `
      <table class="p-tab p-notetab" style="left:${SX}mm;top:${top}mm;width:${LARG}mm">
        <colgroup><col style="width:${COL[0]}mm"><col></colgroup>
        <tr style="height:5.3mm"><td colspan="2" class="p-notetit">NOTE</td></tr>
        ${righeNote.map((t) => `<tr style="height:${H_R}mm"><td></td><td class="p-nota" data-adatta="0.4" data-righe="2">${esc(t)}</td></tr>`).join('')}
      </table>
      <div class="p-banda" style="${y(43.4)};left:${SX}mm;width:${LARG}mm;background:#92d050">${LEGENDA}</div>
      ${RIGHE_PIEDE.map((t, i) => `<div class="p-riga" style="${y([49.3, 54.7, 60.4, 66.1][i])};left:${SX}mm;width:${LARG}mm">${t}</div>`).join('')}
      <div class="p-banda" style="${y(70.7)};left:${SX}mm;width:${LARG}mm;background:#ffff00">${IMPORTANTE}</div>
      <div class="p-timbro" style="${y(49.6)}">
        <img src="img/timbro.png" alt="" onerror="this.remove()">
        ${firma ? `<img src="${firma}" alt="" class="p-firma">` : ''}
      </div>`;
  }

  function documento(S, cliId, anno) {
    const c = SG.cliente(S, cliId);
    const items = SG.elenco(S, cliId, anno);
    const giri = SG.slotGiri(S, cliId, anno);
    const ultimo = giri.filter(Boolean).pop();
    const pagine = impagina(items);
    return pagine.map((pg, pi) => {
      const top = pi === 0 ? TOP1 : TOP2;
      const usate = pg.items.reduce((n, it) => n + it.parti.length, 0);
      const vuote = Math.max(0, pg.cap - usate);
      const fine = top + H_TH + (usate + vuote) * H_R;
      return `
      <div class="foglio">
        ${pi === 0 ? `
          <img class="p-logo" src="img/logo-grande.png" alt="">
          <div class="p-box"></div><div class="p-box-fondo"></div><div class="p-box-tick"></div>
          <img class="p-logo30" src="img/logo-30.png" alt="" onerror="this.remove()">
          <div class="p-titolo" data-adatta="0.4">${esc(c.titoloElenco || 'ELENCO SOTTOGANCI')}&nbsp; ${anno}</div>
          <div class="p-cliente" data-adatta="0.4" data-righe="2">${esc(CLI.nomeAl(c.anagrafica, ultimo?.data || `${anno}-12-31`, c.sede))}</div>
          <div class="p-loc" data-adatta="0.4">${esc(c.localita || '')}</div>
          <div class="p-colfasc">colore fascette</div>
          ${SG.SLOT.map((s, i) => `<div class="p-nomefasc" style="left:${(SX + 124.8 + i * 14.3).toFixed(2)}mm">${s.nome}</div>`).join('')}
        ` : ''}
        <table class="p-tab" style="left:${SX}mm;top:${top}mm;width:${LARG}mm">
          ${colgroup}
          ${intestazioneTabella(giri)}
          ${pg.items.map((it) => righeSottogancio(S, it, giri, anno)).join('')}
          ${Array.from({ length: vuote }, rigaVuota).join('')}
        </table>
        ${pg.piede ? piede(fine, giri, ultimo?.noteGenerali, ultimo?.firmaTecnico) : ''}
      </div>`;
    }).join('');
  }

  function adatta() {
    const w = document.querySelector('.fogli'); if (!w) return;
    const disp = w.parentElement.clientWidth;
    const mm = 297 * 96 / 25.4; // larghezza del foglio in pixel
    w.style.zoom = Math.min(1, disp / mm).toFixed(3);
  }
  window.addEventListener('resize', adatta);

  function render(el, S, cliId, anno) {
    const c = SG.cliente(S, cliId);
    if (!c) { el.innerHTML = '<p class="nessuno">Cliente non trovato.</p>'; return { titolo: 'Stampa' }; }
    el.innerHTML = `
      <section class="sg stampa">
        <div class="azioni-lista no-print">
          <button class="btn" id="btnStampa">🖨️ Stampa / salva PDF</button>
          <a class="btn ghost" href="#/sottoganci/c/${cliId}/stampa/${anno - 1}">‹ ${anno - 1}</a>
          <a class="btn ghost" href="#/sottoganci/c/${cliId}/stampa/${anno + 1}">${anno + 1} ›</a>
          ${UI.info('Nella finestra di stampa scegli la stampante oppure «Salva come PDF». Formato A4 orizzontale, margini «Nessuno». Il PDF salvato si può inviare al cliente.')}
        </div>
        <div class="fogli-wrap"><div class="fogli">${documento(S, cliId, anno)}</div></div>
      </section>`;
    el.querySelector('#btnStampa').onclick = () => {
      const t = document.title;
      document.title = `${(c.titoloElenco || 'ELENCO').replace(/\s+/g, '_')}_${c.nome}_${c.localita || ''}_${anno}`.replace(/_+$/, '');
      window.print(); setTimeout(() => (document.title = t), 1000);
    };
    UI.adattaTesti(el);   // titolo, cliente e località sempre dentro i loro riquadri
    requestAnimationFrame(adatta);
    return { titolo: `${c.titoloElenco} ${anno} · ${SG.nomeCliente(c)}`, indietro: '#/sottoganci/c/' + cliId, live: true };
  }

  return { render };
})();
