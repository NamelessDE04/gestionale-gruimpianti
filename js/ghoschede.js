// ===== SCHEDE DI CONTROLLO PER GHO ELIGIO =====
// Gru dei clienti di GHO da controllare SENZA metterle in anagrafica (niente cliente né sede nostri).
// Ogni gru è un impianto con gho: true, con i pochi dati scritti qui (cliente di GHO, indirizzo, dati della gru,
// modello di scheda) e una sede «finta» (sedeId = 'gho-…') che non compare negli elenchi dei nostri clienti.
// Il controllo si fa con le stesse pagine delle nostre gru (CTR): scheda dell'anno, controlli, osservazioni, stampa.
window.GHOS = (function () {
  const { esc, uid, info, fmt } = UI;
  const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const TIPI = [['Annuale', 1], ['Semestrale', 3], ['Trimestrale', 2]];   // tipo del 1° controllo → «annuale» del piano (vedi CTR.tipoVisita)
  const gru = (S) => (S.impianti || []).filter((i) => i.gho);
  const puoMod = () => UT.puo('gho.schede') && !UT.solaLettura();
  const anno = () => +UI.oggi().slice(0, 4);

  // per le pagine dei controlli: cliente e sede «finti» presi dai dati scritti sulla gru
  function sedeFinta(S, sedeId) {
    const i = gru(S).find((x) => x.sedeId === sedeId); if (!i) return {};
    const g = i.ghoCliente || {};
    const s = { id: i.sedeId, nome: '', indirizzo: g.indirizzo || '', citta: g.citta || '', pianoControlli: i.ghoPiano || { mese1: +UI.oggi().slice(5, 7), annuale: 1 } };
    return { c: { id: i.clienteId, ragioneSociale: g.nome || 'CLIENTE GHO', sedi: [s], gho: true }, s };
  }

  // ---------- ELENCO ----------
  let cerca = '';
  function lista(el, S) {
    const t = cerca.trim().toLowerCase(), a = anno();
    const tutte = gru(S).filter((i) => !t || [i.ghoCliente?.nome, i.ghoCliente?.citta, i.tipologia, i.marca, i.matricola, i.numeroInterno].join(' ').toLowerCase().includes(t))
      .sort((x, y) => (x.ghoCliente?.nome || '').localeCompare(y.ghoCliente?.nome || '') || (x.numeroInterno || '').localeCompare(y.numeroInterno || '', 'it', { numeric: true }));
    const ultimo = (i) => { const sc = CTR.schedaDi(S, i.id, a); const v = Object.entries(sc?.visite || {}).filter(([, x]) => !x.inCorso).sort((p, q) => +q[0] - +p[0])[0];
      return v ? `✓ ${v[0]}° controllo ${a} · ${fmt(v[1].dataScheda)}` : `nessun controllo nel ${a}`; };
    el.innerHTML = `
      <section class="cli">
        <div class="sez-head"><h1>Schede di controllo GHO ${info('Gru dei clienti di GHO da controllare senza metterle nella nostra anagrafica. Scrivi i pochi dati della gru e scegli il modello di scheda; poi il controllo si fa come per le nostre gru (osservazioni, firma, stampa). Queste gru non compaiono negli elenchi di clienti e impianti.')}</h1>
          ${puoMod() ? '<button class="btn fab" id="btnNuova"><span class="fab-piu">+</span><span class="fab-txt"> Nuova gru</span></button>' : ''}</div>
        ${gru(S).length > 4 ? `<input type="search" id="gsCerca" class="cerca" placeholder="Cerca cliente, città, matricola…" value="${esc(cerca)}">` : ''}
        <div class="elenco">
          ${tutte.map((i) => `
            <a class="riga" href="#/controlli/i/${i.id}">
              <span class="imp-ico">${IMP.icona(i)}</span>
              <div class="riga-main">
                <div class="riga-top"><b>${esc(i.ghoCliente?.nome || '')}</b></div>
                <small class="muted">${esc([i.numeroInterno ? 'N° ' + i.numeroInterno : '', IMP.titolo(i), i.matricola ? 'matr. ' + i.matricola : '', i.ghoCliente?.citta].filter(Boolean).join(' · '))}</small>
                <small class="muted">${esc(ultimo(i))}</small>
              </div>
              ${puoMod() ? `<button type="button" class="btn ghost small" data-mod="${i.id}" aria-label="Dati della gru">✏️</button>` : ''}
            </a>`).join('') || `<p class="nessuno">${gru(S).length ? 'Nessuna gru trovata.' : 'Nessuna gru ancora.' + (puoMod() ? ' Tocca «+ Nuova gru».' : '')}</p>`}
        </div>
      </section>`;
    const fc = el.querySelector('#gsCerca');
    if (fc) fc.oninput = () => { cerca = fc.value; const p = fc.selectionStart; App.ridisegna(); const n = document.getElementById('gsCerca'); n.focus(); n.setSelectionRange(p, p); };
    el.querySelector('#btnNuova')?.addEventListener('click', () => modale(S, null));
    el.querySelectorAll('[data-mod]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); modale(S, gru(S).find((x) => x.id === b.dataset.mod)); }));
    return { titolo: 'Schede di controllo GHO', indietro: '#/gho', live: true };
  }

  // ---------- NUOVA / MODIFICA GRU ----------
  function modale(S, i) {
    if (!UT.serve('gho.schede')) return;
    const nuovo = !i;
    const ms = CTR.modelliTutti(S);
    const conSchede = !nuovo && S.schedeControllo.some((x) => x.impiantoId === i.id);
    const tipologie = (S.impostazioni.find((x) => x.id === 'tipologieGru') || {}).voci || IMP.TIPOLOGIE_BASE;
    const p = i?.ghoPiano || { mese1: +UI.oggi().slice(5, 7), annuale: 1 };
    const modAtt = i ? CTR.modelloDi(S, i) : ms[0];
    UI.modal({
      titolo: nuovo ? 'Nuova gru da controllare per GHO' : 'Dati della gru (GHO)',
      infoTxt: 'Bastano pochi dati: escono sulla scheda di controllo stampata. La gru non va nella nostra anagrafica.',
      valori: i ? { ghoNome: i.ghoCliente?.nome || '', ghoIndirizzo: i.ghoCliente?.indirizzo || '', ghoCitta: i.ghoCliente?.citta || '', tipologia: i.tipologia || '', marca: i.marca || '',
        matricola: i.matricola || '', numeroSerie: i.numeroSerie || '', annoCostruzione: i.annoCostruzione || '', portata: i.paranchi?.[0]?.portata || '', numeroInterno: i.numeroInterno || '',
        modelloScheda: modAtt?.nome || '', tipo1: (TIPI.find((t) => t[1] === p.annuale) || TIPI[0])[0], mese1: MESI[(p.mese1 || 1) - 1] }
        : { tipo1: 'Annuale', mese1: MESI[+UI.oggi().slice(5, 7) - 1], modelloScheda: ms[0]?.nome || '' },
      campi: [
        { tipo: 'titolo', label: 'Cliente di GHO' },
        { k: 'ghoNome', label: 'Ragione sociale', req: true, maiuscolo: true },
        { k: 'ghoIndirizzo', label: 'Indirizzo (ubicazione della gru)', maiuscolo: true, placeholder: 'es. VIA ROMA 10' },
        { k: 'ghoCitta', label: 'Città', maiuscolo: true, mezza: true },
        { tipo: 'titolo', label: 'La gru' },
        { k: 'tipologia', label: 'Tipologia', tipo: 'select', opzioni: tipologie, mezza: true },
        { k: 'marca', label: 'Marca', maiuscolo: true, mezza: true },
        { k: 'matricola', label: 'Matricola', maiuscolo: true, mezza: true },
        { k: 'numeroSerie', label: 'N° di serie', maiuscolo: true, mezza: true },
        { k: 'annoCostruzione', label: 'Anno', mezza: true, placeholder: 'es. 1998' },
        { k: 'portata', label: 'Portata (kg)', mezza: true, placeholder: 'es. 5000' },
        { k: 'numeroInterno', label: 'N° interno', mezza: true, placeholder: 'es. 3' },
        { tipo: 'titolo', label: 'Controllo' },
        conSchede ? { k: 'modelloScheda', label: 'Modello di scheda', tipo: 'select', opzioni: [modAtt?.nome || ''], aiuto: 'Ci sono già dei controlli: il modello non si cambia più da qui.' }
          : { k: 'modelloScheda', label: 'Modello di scheda', tipo: 'select', opzioni: ms.map((m) => m.nome), req: true },
        { k: 'tipo1', label: 'Il 1° controllo è', tipo: 'select', opzioni: TIPI.map((t) => t[0]), mezza: true, aiuto: 'Poi si va avanti ogni 3 mesi come per le nostre gru.' },
        { k: 'mese1', label: 'Mese del 1° controllo', tipo: 'select', opzioni: MESI, mezza: true }
      ],
      onSalva: async (v) => {
        const m = ms.find((x) => x.nome === v.modelloScheda) || modAtt;
        const id = i?.id || uid();
        const doc = {
          ...(i || {}), id, gho: true, clienteId: 'gho-' + id, sedeId: 'gho-' + id, modello: i?.modello || 'ponte',
          tipologia: v.tipologia || '', marca: v.marca || '', matricola: v.matricola || '', numeroSerie: v.numeroSerie || '', annoCostruzione: v.annoCostruzione || '', numeroInterno: v.numeroInterno || '',
          paranchi: [{ ...(i?.paranchi?.[0] || {}), ruolo: 'Primario', portata: String(v.portata || '').trim() }, ...((i?.paranchi || []).slice(1))],
          controllo: { ...(i?.controllo || {}), modelloId: conSchede ? i.controllo?.modelloId || modAtt?.id : m?.id },
          ghoCliente: { nome: v.ghoNome, indirizzo: v.ghoIndirizzo || '', citta: v.ghoCitta || '' },
          ghoPiano: { mese1: MESI.indexOf(v.mese1) + 1 || 1, annuale: (TIPI.find((t) => t[0] === v.tipo1) || TIPI[0])[1] }
        };
        await UI.salva('impianti', doc);
        UT.registra(nuovo ? 'creazione' : 'modifica', `Gru GHO ${v.ghoNome}${v.matricola ? ' matr. ' + v.matricola : ''}`);
        UI.toast(nuovo ? 'Gru aggiunta: ora puoi fare il controllo' : 'Dati salvati', 'ok');
        if (nuovo) location.hash = '#/controlli/i/' + id;
      },
      onElimina: nuovo ? null : async () => {
        const schede = S.schedeControllo.filter((x) => x.impiantoId === i.id);
        if (!UI.conferma(`Eliminare la gru di ${i.ghoCliente?.nome || ''}${schede.length ? ` e le sue ${schede.length} schede di controllo` : ''}?`)) return false;
        for (const sc of schede) await Backend.remove('schedeControllo', sc.id);
        await Backend.remove('impianti', i.id);
        UT.registra('eliminazione', `Gru GHO ${i.ghoCliente?.nome || ''} eliminata`);
        location.hash = '#/gho/schede';
      },
      testoElimina: 'Elimina gru'
    });
  }

  return { lista, modale, sedeFinta, gru };
})();
