// ===== MODULO: ANAGRAFICA FORNITORI =====
// Ditte a cui mandiamo merce con il DDT (es. una riparazione o un conto lavorazione). Servono solo per compilare i DDT:
// niente km, minuti di viaggio, n° d'ordine o impianti.
// Un fornitore ha la sede legale (va come DESTINATARIO sul DDT) e, se servono, una o più destinazioni (dove va la merce).
// Senza destinazioni la merce va alla sede legale: destinatario e destinazione coincidono.
window.FORN = (function () {
  const { esc, uid, info } = UI;
  const nome = (f) => f?.ragioneSociale || '';
  const salva = (f) => UI.salva('fornitori', JSON.parse(JSON.stringify(f)));
  const puoMod = () => UT.puo('forn.modifica') && !UT.solaLettura();
  const pieno = (s) => !!(s && (s.indirizzo || s.citta));
  // le «sedi» che si possono scegliere sul DDT: le destinazioni più la sede legale (destinatario e destinazione uguali).
  // La sede legale ha come codice l'id del fornitore stesso.
  const sediDi = (f) => [...(f.sedi || []), ...(pieno(f.sedeLegale) || !(f.sedi || []).length ? [{ ...(f.sedeLegale || {}), id: f.id, nome: '', legale: true }] : [])];
  const trovaSede = (S, sedeId) => {
    for (const f of S.fornitori || []) { const s = sediDi(f).find((x) => x.id === sedeId); if (s) return { c: f, s }; }
    return { c: null, s: null };
  };

  // ---------- ELENCO ----------
  let cerca = '';
  function lista(el, S) {
    const t = cerca.trim().toLowerCase();
    const tutti = S.fornitori || [];
    const vis = tutti.filter((f) => !t || [f.ragioneSociale, f.piva, f.sedeLegale?.citta, ...(f.sedi || []).flatMap((s) => [s.nome, s.citta])].join(' ').toLowerCase().includes(t))
      .sort((a, b) => nome(a).localeCompare(nome(b)));
    el.innerHTML = `
      <section class="cli">
        <div class="sez-head">
          <h1>Anagrafica fornitori ${info('Le ditte a cui mandiamo merce con il DDT. Servono solo per compilare i DDT: sul DDT scegli il fornitore come faresti con un cliente e destinatario e destinazione si scrivono da soli.')}</h1>
          ${puoMod() ? '<button class="btn fab" id="btnNuovo"><span class="fab-piu">+</span><span class="fab-txt"> Nuovo fornitore</span></button>' : ''}
        </div>
        <input type="search" id="fCerca" class="cerca" placeholder="Cerca fornitore, città, P.IVA…" value="${esc(cerca)}">
        <div class="elenco">
          ${vis.map((f) => `
            <a class="riga cli-riga" href="#/fornitori/${f.id}">
              ${CLI.avatar(f)}
              <div class="riga-main">
                <div class="riga-top"><b>${esc(nome(f))}</b></div>
                <small class="muted">${esc(CLI.indirizzo(f.sedeLegale || {}) || 'Sede legale da inserire')}</small>
              </div>
              <div class="riga-dx muted small">${(f.sedi || []).length ? `${f.sedi.length} ${f.sedi.length === 1 ? 'destinazione' : 'destinazioni'}` : 'merce alla sede legale'}</div>
            </a>`).join('') || `<p class="nessuno">${tutti.length ? 'Nessun fornitore trovato.' : 'Nessun fornitore ancora.' + (puoMod() ? ' Inizia con «+ Nuovo fornitore».' : '')}</p>`}
        </div>
      </section>`;
    const fc = el.querySelector('#fCerca');
    fc.oninput = () => { cerca = fc.value; const p = fc.selectionStart; App.ridisegna(); const n = document.getElementById('fCerca'); n.focus(); n.setSelectionRange(p, p); };
    el.querySelector('#btnNuovo')?.addEventListener('click', () => modaleDati(S, null));
    return { titolo: 'Anagrafica fornitori', indietro: '#/anagrafiche', live: true };
  }

  // ---------- SCHEDA ----------
  function scheda(el, S, id) {
    const f = (S.fornitori || []).find((x) => x.id === id);
    if (!f) { el.innerHTML = '<p class="nessuno">Fornitore non trovato.</p>'; return { titolo: 'Fornitore', indietro: '#/fornitori' }; }
    const campo = (l, v) => `<div class="campo"><span>${l}</span><b>${v || '<i class="muted">—</i>'}</b></div>`;
    const ddt = (S.ddt || []).filter((d) => d.fornitoreId === f.id).sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    el.innerHTML = `
      <section class="cli">
        <div class="card cli-head">${CLI.avatar(f, true)}<div class="grow"><h1>${esc(nome(f))}</h1><p class="muted small">🏭 Fornitore</p></div></div>
        <div class="card">
          <div class="card-head"><h2>Dati e sede legale ${info('La sede legale va come DESTINATARIO sul DDT. Se la merce va in un altro posto, aggiungi una destinazione qui sotto.')}</h2>
            ${puoMod() ? '<button class="btn ghost small" id="btnDati">✏️ Modifica</button>' : ''}</div>
          <div class="griglia-campi">
            ${campo('Ragione sociale', esc(f.ragioneSociale))}
            ${campo('Partita IVA', esc(f.piva))}
            ${campo('Codice fiscale', esc(f.cf))}
            ${campo('Telefono', esc(f.telefono))}
            ${campo('Email', esc(f.email))}
            ${campo('PEC', esc(f.pec))}
            ${campo('Sede legale (destinatario)', esc(CLI.indirizzo(f.sedeLegale || {})))}
          </div>
          ${f.note ? `<p class="cli-note">${esc(f.note)}</p>` : ''}
        </div>
        <div class="card">
          <div class="card-head"><h2>Destinazioni <span class="conta">${(f.sedi || []).length}</span> ${info('Dove va la merce, se non è la sede legale (es. lo stabilimento o il magazzino). Sul DDT puoi scegliere una destinazione oppure la sede legale (destinatario e destinazione uguali).')}</h2>
            ${puoMod() ? '<button class="btn ghost small" id="btnSede">+ Aggiungi</button>' : ''}</div>
          <div class="schede-mini">
            ${(f.sedi || []).map((s) => `
              <div class="mini" data-sede="${s.id}" role="button" tabindex="0">
                <div class="mini-top"><b>📍 ${esc(s.nome || s.citta || 'Destinazione')}</b></div>
                <p>${esc(CLI.indirizzo(s)) || '<span class="muted">Indirizzo da inserire</span>'}</p>
              </div>`).join('') || '<p class="muted">Nessuna destinazione: la merce va alla sede legale.</p>'}
          </div>
        </div>
        ${ddt.length ? `<div class="card"><div class="card-head"><h2>DDT <span class="conta">${ddt.length}</span></h2></div>
          <div class="elenco">${ddt.slice(0, 30).map((d) => `<a class="riga" href="#/rapportini/ddt/${d.id}"><div class="riga-main"><b>N° ${esc(DDT.numeroDi(d))}</b><small class="muted">${esc(UI.fmt(d.data))}</small></div></a>`).join('')}</div></div>` : ''}
      </section>`;
    el.querySelector('#btnDati')?.addEventListener('click', () => modaleDati(S, f));
    el.querySelector('#btnSede')?.addEventListener('click', () => modaleSede(f, null));
    if (puoMod()) el.querySelectorAll('[data-sede]').forEach((n) => (n.onclick = () => modaleSede(f, f.sedi.find((s) => s.id === n.dataset.sede))));
    return { titolo: nome(f), indietro: '#/fornitori', live: true };
  }

  // ---------- FINESTRE ----------
  function modaleDati(S, f) {
    if (!UT.serve('forn.modifica')) return;
    const nuovo = !f;
    const sl = f?.sedeLegale || {};
    UI.modal({
      titolo: nuovo ? 'Nuovo fornitore' : 'Dati del fornitore',
      infoTxt: 'La sede legale va come destinatario sul DDT. Dopo il salvataggio puoi aggiungere le destinazioni, se la merce va in un altro posto.',
      valori: f ? { ...f, slIndirizzo: sl.indirizzo || '', slCap: sl.cap || '', slCitta: sl.citta || '', slProvincia: sl.provincia || '' } : {},
      campi: [
        { k: 'ragioneSociale', label: 'Ragione sociale', req: true, maiuscolo: true },
        { k: 'piva', label: 'Partita IVA', mezza: true, placeholder: '11 cifre' },
        { k: 'cf', label: 'Codice fiscale', mezza: true },
        { k: 'telefono', label: 'Telefono', tipo: 'tel', mezza: true },
        { k: 'email', label: 'Email', tipo: 'email', mezza: true },
        { k: 'pec', label: 'PEC', tipo: 'email' },
        { tipo: 'titolo', label: 'Sede legale (destinatario dei DDT)' },
        { k: 'slIndirizzo', label: 'Indirizzo', placeholder: 'es. VIA ROMA 10', maiuscolo: true },
        { k: 'slCap', label: 'CAP', mezza: true },
        { k: 'slCitta', label: 'Città', mezza: true, maiuscolo: true },
        { k: 'slProvincia', label: 'Provincia', mezza: true, maiuscolo: true, placeholder: 'es. TO' },
        { k: 'note', label: 'Note', tipo: 'textarea' }
      ],
      onSalva: async (v) => {
        v.sedeLegale = { indirizzo: v.slIndirizzo || '', cap: v.slCap || '', citta: v.slCitta || '', provincia: v.slProvincia || '' };
        ['slIndirizzo', 'slCap', 'slCitta', 'slProvincia'].forEach((k) => delete v[k]);
        const doc = nuovo ? { id: uid(), sedi: [], ...v } : { ...f, ...v };
        await salva(doc);
        UI.toast(nuovo ? 'Fornitore creato' : 'Dati salvati', 'ok');
        if (nuovo) location.hash = '#/fornitori/' + doc.id;
      },
      onElimina: nuovo ? null : async () => {
        const n = (S.ddt || []).filter((d) => d.fornitoreId === f.id).length;
        if (!UI.conferma(`Eliminare il fornitore ${nome(f)}?${n ? `\n\nI ${n} DDT già fatti restano come sono (destinatario e destinazione sono scritti sul documento).` : ''}`)) return false;
        await Backend.remove('fornitori', f.id); location.hash = '#/fornitori';
      },
      testoElimina: 'Elimina fornitore'
    });
  }

  function modaleSede(f, sd) {
    if (!UT.serve('forn.modifica')) return;
    UI.modal({
      titolo: sd ? 'Modifica destinazione' : 'Nuova destinazione',
      infoTxt: 'Dove va la merce. Sul DDT diventa la destinazione; il destinatario resta la sede legale.',
      valori: sd ? { ...sd } : {},
      campi: [
        { k: 'nome', label: 'Nome', placeholder: 'es. STABILIMENTO 2', maiuscolo: true },
        { k: 'indirizzo', label: 'Indirizzo', req: true, placeholder: 'es. VIA ROMA 10', maiuscolo: true },
        { k: 'cap', label: 'CAP', mezza: true },
        { k: 'citta', label: 'Città', mezza: true, maiuscolo: true },
        { k: 'provincia', label: 'Provincia', mezza: true, maiuscolo: true, placeholder: 'es. TO' }
      ],
      onSalva: async (v) => {
        const doc = JSON.parse(JSON.stringify(f)); doc.sedi = doc.sedi || [];
        if (sd) Object.assign(doc.sedi.find((x) => x.id === sd.id), v); else doc.sedi.push({ id: uid(), ...v });
        await salva(doc); UI.toast('Destinazione salvata', 'ok');
      },
      onElimina: sd ? async () => {
        if (!UI.conferma('Togliere questa destinazione?')) return false;
        const doc = JSON.parse(JSON.stringify(f)); doc.sedi = doc.sedi.filter((x) => x.id !== sd.id);
        await salva(doc);
      } : null,
      testoElimina: 'Togli destinazione'
    });
  }

  function route(el, S, parti) {
    return parti[1] ? scheda(el, S, parti[1]) : lista(el, S);
  }
  return { route, nome, sediDi, trovaSede, pieno };
})();
