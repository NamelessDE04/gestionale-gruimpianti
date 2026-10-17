// ===== MODULO: ANAGRAFICA MEZZI AZIENDALI =====
// Marca, modello, targa, immatricolazione e le 3 scadenze (bollo, revisione, assicurazione) con avviso in home.
// Documenti: foto/PDF di bollettino assicurazione, bollettino revisione, libretto.
// I mezzi sono gli stessi che si scelgono sulla Lavagna.
window.MEZ = (function () {
  const { esc, uid, info, fmt, giorniDa } = UI;
  const SCADENZE = [['bollo', 'Bollo'], ['revisione', 'Revisione'], ['assicurazione', 'Assicurazione']];
  const DOCUMENTI = ['Bollettino assicurazione', 'Bollettino revisione', 'Libretto'];
  const PREAVVISO = 30; // giorni

  const nome = (m) => [m.marca, m.modello].filter(Boolean).join(' ') || 'Mezzo';
  const corto = (m) => [m.modello || m.marca, m.targa].filter(Boolean).join(' · ') || 'Mezzo';
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
    (S.mezzi || []).filter((m) => !m.dismesso).forEach((m) => SCADENZE.forEach(([k, l]) => {
      const st = statoData(m[k]);
      if (st.k === 'scaduto' || st.k === 'scadenza') out.push({ m, k, l, st, d: m[k] });
    }));
    return out.sort((a, b) => a.d.localeCompare(b.d));
  }

  // ---------- ELENCO ----------
  function lista(el, S) {
    const ms = [...(S.mezzi || [])].sort((a, b) => (!!a.dismesso - !!b.dismesso) || nome(a).localeCompare(nome(b)));
    el.innerHTML = `
      <section class="cli">
        <div class="sez-head">
          <h1>Anagrafica mezzi ${info('I mezzi aziendali con targa e scadenze. Se bollo, revisione o assicurazione scadono entro 30 giorni (o sono già scaduti) compare un avviso in home. Gli stessi mezzi si scelgono sulla Lavagna.')}</h1>
          <button class="btn" id="btnNuovo">+ Nuovo mezzo</button>
        </div>
        <div class="mezzi">
          ${ms.map((m) => `
            <a class="card mezzo ${m.dismesso ? 'dismesso' : ''}" href="#/mezzi/${m.id}">
              <div class="mezzo-ico">${ILL.furgone}</div>
              <div class="grow">
                <h2>${esc(nome(m))}</h2>
                <p class="targa">${esc(m.targa || '—')}</p>
                <div class="scad-mini">${SCADENZE.map(([k, l]) => { const st = statoData(m[k]); return `<span class="pill st-${st.k}" title="${l}: ${st.label}">${l} ${m[k] ? fmt(m[k]) : '—'}</span>`; }).join('')}</div>
              </div>
            </a>`).join('') || '<p class="nessuno">Nessun mezzo. Aggiungi il primo con «+ Nuovo mezzo».</p>'}
        </div>
      </section>`;
    el.querySelector('#btnNuovo').onclick = () => modale(null);
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
          <div class="mezzo-ico big">${ILL.furgone}</div>
          <div class="grow"><h1>${esc(nome(m))}</h1><p class="targa">${esc(m.targa || '')}</p></div>
          <button class="btn ghost" id="btnDati">✏️ Modifica</button>
        </div>
        <div class="card">
          <h2>Dati del mezzo</h2>
          <div class="griglia-campi">
            ${campo('Marca', esc(m.marca))}${campo('Modello', esc(m.modello))}${campo('Targa', esc(m.targa))}
            ${campo('Immatricolazione', m.immatricolazione ? fmt(m.immatricolazione) : '')}
          </div>
          ${m.note ? `<p class="cli-note">${esc(m.note)}</p>` : ''}
        </div>
        <div class="card">
          <h2>Scadenze ${info('Avviso in home 30 giorni prima della scadenza. Quando rinnovi, cambia la data con «Modifica» e allega il nuovo bollettino qui sotto.')}</h2>
          <div class="scadenze">
            ${SCADENZE.map(([k, l]) => { const st = statoData(m[k]); return `
              <div class="scad st-b-${st.k}"><span>${l}</span><b>${m[k] ? fmt(m[k]) : '—'}</b><em class="pill st-${st.k}">${st.label}</em></div>`; }).join('')}
          </div>
        </div>
        <div class="card">
          <h2>Documenti ${info('Foto o PDF del bollettino dell\'assicurazione, del bollettino della revisione e del libretto. Restano su questo dispositivo finché non colleghiamo il cloud.')}</h2>
          <div class="allega-btns">${DOCUMENTI.map((t) => `<button class="btn ghost" data-allega="${t}">📷 ${t}</button>`).join('')}</div>
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
    el.querySelector('#btnDati').onclick = () => modale(m);
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
    return { titolo: nome(m) + (m.targa ? ' · ' + m.targa : ''), indietro: '#/mezzi', live: true };
  }

  function modale(m) {
    UI.modal({
      titolo: m ? 'Modifica mezzo' : 'Nuovo mezzo', valori: m || {},
      campi: [
        { k: 'marca', label: 'Marca', req: true, mezza: true, placeholder: 'es. Fiat' },
        { k: 'modello', label: 'Modello', mezza: true, placeholder: 'es. Ducato' },
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

  function route(el, S, parti) { return parti[1] ? scheda(el, S, parti[1]) : lista(el, S); }
  return { route, avvisi, nome, corto };
})();
