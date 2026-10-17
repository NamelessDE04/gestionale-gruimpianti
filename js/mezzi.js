// ===== MODULO: ANAGRAFICA MEZZI AZIENDALI =====
// Marca, modello, targa, immatricolazione e le 3 scadenze (bollo, revisione, assicurazione) con avviso in home.
// Documenti: foto/PDF di bollettino assicurazione, bollettino revisione, libretto.
// I mezzi sono gli stessi che si scelgono sulla Lavagna.
window.MEZ = (function () {
  const { esc, uid, info, fmt, giorniDa } = UI;
  const SCADENZE = [['bollo', 'Bollo'], ['revisione', 'Revisione'], ['assicurazione', 'Assicurazione']];
  const DOCUMENTI = ['Bollettino assicurazione', 'Bollettino revisione', 'Libretto'];
  // piattaforme aeree: matricola e scadenza del controllo periodico al posto di targa, bollo, revisione e assicurazione
  const SCADENZE_P = [['controllo', 'Controllo periodico']];
  const DOCUMENTI_P = ['Verbale controllo periodico', 'Libretto / manuale', 'Dichiarazione CE'];
  const TIPI_P = ['MOBILE CON STABILIZZATORI', 'SEMOVENTE A FORBICE', 'SEMOVENTE ARTICOLATA', 'CINGOLATA (RAGNO)', 'SU AUTOCARRO'];
  const isPiatt = (m) => m?.categoria === 'piattaforma';
  const scadenzeDi = (m) => (isPiatt(m) ? SCADENZE_P : SCADENZE);
  const ico = (m) => ILL[isPiatt(m) ? 'piattaforma' : 'furgone'];
  const sigla = (m) => (isPiatt(m) ? (m.matricola ? 'MATR. ' + m.matricola : '') : m.targa || '');
  const tipoP = (m) => m.tipoPiattaforma || TIPI_P[0];
  const piattaforme = (S) => (S.mezzi || []).filter((m) => isPiatt(m) && !m.dismesso);
  const PREAVVISO = 30; // giorni

  const nome = (m) => [m.marca, m.modello].filter(Boolean).join(' ') || 'Mezzo';
  const corto = (m) => [m.modello || m.marca, isPiatt(m) ? m.matricola : m.targa].filter(Boolean).join(' · ') || 'Mezzo';
  const statoData = (d) => {
    if (!d) return { k: 'mai', label: 'da inserire' };
    const g = giorniDa(d);
    if (g < 0) return { k: 'scaduto', label: `scaduta da ${-g} gg` };
    if (g <= PREAVVISO) return { k: 'scadenza', label: g === 0 ? 'scade oggi' : `scade tra ${g} gg` };
    return { k: 'ok', label: 'in regola' };
  };
  // avvisi per la home: scadenze passate o entro 30 giorni
  function avvisi(S) {
    const out = [];
    (S.mezzi || []).filter((m) => !m.dismesso).forEach((m) => scadenzeDi(m).forEach(([k, l]) => {
      const st = statoData(m[k]);
      if (st.k === 'scaduto' || st.k === 'scadenza') out.push({ m, k, l, st, d: m[k] });
    }));
    return out.sort((a, b) => a.d.localeCompare(b.d));
  }

  // ---------- ELENCO ----------
  function lista(el, S) {
    const ord = (arr) => arr.sort((a, b) => (!!a.dismesso - !!b.dismesso) || nome(a).localeCompare(nome(b)));
    const tutti = S.mezzi || [];
    const carta = (m) => `
            <a class="card mezzo ${m.dismesso ? 'dismesso' : ''}" href="#/mezzi/${m.id}">
              <div class="mezzo-ico">${ico(m)}</div>
              <div class="grow">
                <h2>${esc(nome(m))}</h2>
                ${isPiatt(m) ? `<p class="muted small">${esc(tipoP(m))}${m.matricola ? ' · MATR. ' + esc(m.matricola) : ''}</p>` : `<p class="targa">${esc(m.targa || '—')}</p>`}
                <div class="scad-mini">${scadenzeDi(m).map(([k, l]) => { const st = statoData(m[k]); return `<span class="pill st-${st.k}" title="${l}: ${st.label}">${l} ${m[k] ? fmt(m[k]) : '—'}</span>`; }).join('')}</div>
              </div>
            </a>`;
    const veicoli = ord(tutti.filter((m) => !isPiatt(m))), piatt = ord(tutti.filter(isPiatt));
    el.innerHTML = `
      <section class="cli">
        <div class="sez-head">
          <h1>Anagrafica mezzi ${info('I mezzi aziendali con le loro scadenze: per furgoni e auto bollo, revisione e assicurazione; per le piattaforme aeree il controllo periodico. Se una scadenza arriva entro 30 giorni (o è già passata) compare un avviso in home. Gli stessi mezzi si scelgono sulla Lavagna, le piattaforme anche nei rapportini.')}</h1>
          <button class="btn" id="btnNuovo">+ Nuovo mezzo</button>
        </div>
        <h2 class="mese-rap">Furgoni e auto</h2>
        <div class="mezzi">${veicoli.map(carta).join('') || '<p class="nessuno">Nessun mezzo. Aggiungi il primo con «+ Nuovo mezzo».</p>'}</div>
        <div class="sez-head sez-piatt"><h2 class="mese-rap">Piattaforme aeree</h2><button class="btn ghost" id="btnNuovoP">+ Nuova piattaforma</button></div>
        <div class="mezzi">${piatt.map(carta).join('') || '<p class="nessuno">Nessuna piattaforma. Aggiungila con «+ Nuova piattaforma».</p>'}</div>
      </section>`;
    el.querySelector('#btnNuovo').onclick = () => modale(null);
    el.querySelector('#btnNuovoP').onclick = () => modaleP(null);
    return { titolo: 'Anagrafica mezzi', indietro: '#/', live: true };
  }

  // ---------- SCHEDA MEZZO ----------
  function scheda(el, S, id) {
    const m = (S.mezzi || []).find((x) => x.id === id);
    if (!m) { el.innerHTML = '<p class="nessuno">Mezzo non trovato.</p>'; return { titolo: 'Mezzo', indietro: '#/mezzi' }; }
    const campo = (l, v) => `<div class="campo"><span>${l}</span><b>${v || '<i class="muted">—</i>'}</b></div>`;
    const docs = m.documenti || [];
    el.innerHTML = `
      <section class="cli">
        <div class="card cli-head">
          <div class="mezzo-ico big">${ico(m)}</div>
          <div class="grow"><h1>${esc(nome(m))}</h1>${isPiatt(m) ? `<p class="muted">${esc(tipoP(m))}${m.matricola ? ' · MATR. ' + esc(m.matricola) : ''}</p>` : `<p class="targa">${esc(m.targa || '')}</p>`}</div>
          <button class="btn ghost" id="btnDati">✏️ Modifica</button>
        </div>
        <div class="card">
          <h2>${isPiatt(m) ? 'Dati della piattaforma' : 'Dati del mezzo'}</h2>
          <div class="griglia-campi">
            ${isPiatt(m)
              ? campo('Tipo', esc(tipoP(m))) + campo('Marca', esc(m.marca)) + campo('Modello', esc(m.modello)) + campo('Matricola', esc(m.matricola)) + campo('Anno', esc(m.anno)) + campo('Altezza di lavoro', m.altezza ? esc(m.altezza) + ' m' : '') + campo('Portata cesta', m.portata ? esc(m.portata) + ' kg' : '')
              : campo('Marca', esc(m.marca)) + campo('Modello', esc(m.modello)) + campo('Targa', esc(m.targa)) + campo('Immatricolazione', m.immatricolazione ? fmt(m.immatricolazione) : '')}
          </div>
          ${m.note ? `<p class="cli-note">${esc(m.note)}</p>` : ''}
        </div>
        <div class="card">
          <h2>Scadenze ${info('Avviso in home 30 giorni prima della scadenza. Quando rinnovi, cambia la data con «Modifica» e allega il nuovo documento qui sotto.')}</h2>
          <div class="scadenze">
            ${scadenzeDi(m).map(([k, l]) => { const st = statoData(m[k]); return `
              <div class="scad st-b-${st.k}"><span>${l}</span><b>${m[k] ? fmt(m[k]) : '—'}</b><em class="pill st-${st.k}">${st.label}</em></div>`; }).join('')}
          </div>
        </div>
        <div class="card">
          <h2>Documenti ${info('Foto o PDF dei documenti del mezzo. Per ora restano sul dispositivo dove li carichi.')}</h2>
          <div class="allega-btns">${(isPiatt(m) ? DOCUMENTI_P : DOCUMENTI).map((t) => `<button class="btn ghost" data-allega="${t}">📷 ${t}</button>`).join('')}</div>
          <input type="file" id="inDoc" accept="image/*,application/pdf" hidden>
          <div class="elenco-file">
            ${docs.slice().sort((a, b) => (b.data || '').localeCompare(a.data || '')).map((a) => `
              <div class="file-riga">
                <span class="file-ico">${/pdf/.test(a.mime) ? '📄' : '🖼️'}</span>
                <div class="grow"><b>${esc(a.tipo)}</b><div class="muted small">${esc(a.nome)} · ${ALLEGATI.dimensione(a.size)} · ${fmt(a.data)}</div></div>
                <button class="btn small" data-apri="${a.id}">Apri</button>
                <button class="btn ghost small danger" data-rmfile="${a.id}" aria-label="Elimina">×</button>
              </div>`).join('') || '<p class="muted vuoto-dati">Nessun documento allegato.</p>'}
          </div>
        </div>
      </section>`;
    el.querySelector('#btnDati').onclick = () => (isPiatt(m) ? modaleP(m) : modale(m));
    const inp = el.querySelector('#inDoc'); let tipo = '';
    el.querySelectorAll('[data-allega]').forEach((b) => (b.onclick = () => { tipo = b.dataset.allega; inp.click(); }));
    inp.onchange = async () => {
      const f = inp.files[0]; inp.value = ''; if (!f) return;
      if (f.size > ALLEGATI.MAX) return UI.toast('File troppo grande (massimo 25 MB)', 'err');
      // le foto vengono ridotte per occupare meno spazio
      let blob = f;
      if (/image/.test(f.type)) { try { const d = await UI.comprimiFoto(f, 1800, 0.75); blob = await (await fetch(d)).blob(); } catch (e) {} }
      const meta = { id: uid(), tipo, nome: f.name, mime: blob.type || f.type, size: blob.size, data: UI.oggi() };
      try { await ALLEGATI.salva(meta.id, blob); } catch (e) { return UI.toast('Impossibile salvare il file sul dispositivo', 'err'); }
      await UI.salva('mezzi', { ...m, documenti: [...docs, meta] }); UI.toast('Documento allegato', 'ok');
    };
    el.querySelectorAll('[data-apri]').forEach((b) => (b.onclick = () => { const a = docs.find((x) => x.id === b.dataset.apri); ALLEGATI.apri(a.id, a.nome); }));
    el.querySelectorAll('[data-rmfile]').forEach((b) => (b.onclick = async () => {
      const a = docs.find((x) => x.id === b.dataset.rmfile);
      if (!UI.conferma(`Eliminare «${a.tipo}» (${a.nome})?`)) return;
      await ALLEGATI.elimina(a.id).catch(() => {});
      await UI.salva('mezzi', { ...m, documenti: docs.filter((x) => x.id !== a.id) });
    }));
    return { titolo: nome(m) + (sigla(m) ? ' · ' + sigla(m) : ''), indietro: '#/mezzi', live: true };
  }

  function modale(m) {
    UI.modal({
      titolo: m ? 'Modifica mezzo' : 'Nuovo mezzo', valori: m || {},
      campi: [
        { k: 'marca', label: 'Marca', req: true, mezza: true },
        { k: 'modello', label: 'Modello', mezza: true },
        { k: 'targa', label: 'Targa', mezza: true, maiuscolo: true, placeholder: 'es. AB123CD' },
        { k: 'immatricolazione', label: 'Immatricolazione', tipo: 'date', mezza: true },
        { tipo: 'titolo', label: 'Scadenze' },
        { k: 'bollo', label: 'Scadenza bollo', tipo: 'date', mezza: true },
        { k: 'revisione', label: 'Scadenza revisione', tipo: 'date', mezza: true },
        { k: 'assicurazione', label: 'Scadenza assicurazione', tipo: 'date', mezza: true },
        { tipo: 'titolo', label: 'Altro' },
        { k: 'note', label: 'Note', tipo: 'textarea' },
        ...(m ? [{ k: 'dismesso', label: 'Mezzo non più in uso (non compare più sulla lavagna e negli avvisi)', tipo: 'sino' }] : [])
      ],
      onSalva: async (v) => {
        const d = { ...(m || { id: uid(), documenti: [] }), ...v };
        await UI.salva('mezzi', d); UI.toast('Mezzo salvato', 'ok');
        if (!m) location.hash = '#/mezzi/' + d.id;
      },
      onElimina: m ? async () => {
        if (!UI.conferma(`Eliminare ${nome(m)} ${m.targa || ''} con i suoi documenti?`)) return false;
        for (const a of m.documenti || []) await ALLEGATI.elimina(a.id).catch(() => {});
        await Backend.remove('mezzi', m.id); location.hash = '#/mezzi';
      } : null,
      testoElimina: 'Elimina mezzo'
    });
  }

  function modaleP(m) {
    UI.modal({
      titolo: m ? 'Modifica piattaforma' : 'Nuova piattaforma aerea', valori: m ? { ...m, tipoPiattaforma: tipoP(m) } : { tipoPiattaforma: TIPI_P[0] },
      campi: [
        { k: 'tipoPiattaforma', label: 'Tipo di piattaforma', lista: TIPI_P, aiuto: 'Compare sul rapportino quando la usate' },
        { k: 'marca', label: 'Marca', req: true, mezza: true },
        { k: 'modello', label: 'Modello', mezza: true },
        { k: 'matricola', label: 'Matricola', mezza: true },
        { k: 'anno', label: 'Anno di costruzione', tipo: 'number', mezza: true },
        { k: 'altezza', label: 'Altezza di lavoro', u: 'm', tipo: 'number', mezza: true },
        { k: 'portata', label: 'Portata cesta', u: 'kg', tipo: 'number', mezza: true },
        { tipo: 'titolo', label: 'Scadenze' },
        { k: 'controllo', label: 'Scadenza controllo periodico', tipo: 'date', mezza: true, aiuto: 'Avviso in home 30 giorni prima' },
        { tipo: 'titolo', label: 'Altro' },
        { k: 'note', label: 'Note', tipo: 'textarea' },
        ...(m ? [{ k: 'dismesso', label: 'Piattaforma non più in uso (non compare più nei rapportini, sulla lavagna e negli avvisi)', tipo: 'sino' }] : [])
      ],
      onSalva: async (v) => {
        const d = { ...(m || { id: uid(), documenti: [] }), ...v, categoria: 'piattaforma', tipoPiattaforma: (v.tipoPiattaforma || TIPI_P[0]).toUpperCase() };
        await UI.salva('mezzi', d); UI.toast('Piattaforma salvata', 'ok');
        if (!m) location.hash = '#/mezzi/' + d.id;
      },
      onElimina: m ? async () => {
        if (!UI.conferma(`Eliminare la piattaforma ${nome(m)} ${m.matricola || ''} con i suoi documenti?`)) return false;
        for (const a of m.documenti || []) await ALLEGATI.elimina(a.id).catch(() => {});
        await Backend.remove('mezzi', m.id); location.hash = '#/mezzi';
      } : null,
      testoElimina: 'Elimina piattaforma'
    });
  }

  function route(el, S, parti) { return parti[1] ? scheda(el, S, parti[1]) : lista(el, S); }
  return { route, avvisi, nome, corto, piattaforme, tipoP, isPiatt };
})();
