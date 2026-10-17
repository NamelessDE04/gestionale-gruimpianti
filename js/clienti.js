// ===== MODULO: ANAGRAFICA CLIENTI =====
// Un cliente = una ditta (ragione sociale) con una o più sedi e i suoi referenti.
// Tutti gli altri moduli (es. sottoganci) leggono nomi e sedi da qui: si modifica in un solo posto.
window.CLI = (function () {
  const { esc, uid, info } = UI;

  const nome = (c) => c.nomeBreve || c.ragioneSociale;
  const indirizzo = (sd) => [sd.indirizzo, [sd.cap, sd.citta].filter(Boolean).join(' ') + (sd.provincia ? ` (${sd.provincia})` : '')]
    .filter((x) => x && x.trim()).join(', ');
  const mappa = (sd) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(indirizzo(sd));
  const tel = (n) => (n ? `<a class="azione" href="tel:${esc(n.replace(/[^\d+]/g, ''))}">📞 ${esc(n)}</a>` : '');
  const mail = (m) => (m ? `<a class="azione" href="mailto:${esc(m)}">✉️ ${esc(m)}</a>` : '');

  // cerchio con il logo del cliente, oppure le iniziali del nome breve
  const avatar = (c, big) => c.logo
    ? `<span class="avatar logo ${big ? 'big' : ''}"><img src="${c.logo}" alt=""></span>`
    : `<span class="avatar ${big ? 'big' : ''}">${esc(nome(c).slice(0, 2).toUpperCase())}</span>`;
  const etichettaSede = (s) => (s.sigla ? `<b class="sigla-sede">${esc(s.sigla)}</b> ` : '') + esc(s.nome || s.citta);
  const salva = (c) => UI.salva('clienti', JSON.parse(JSON.stringify(c)));
  // quanti dati (sottoganci, impianti) sono collegati a una sede: se ce ne sono non si può togliere
  const usaSede = (S, sedeId) => S.sottoganci.filter((x) => x.sedeId === sedeId).length + S.impianti.filter((x) => x.sedeId === sedeId).length;

  // ---------- ELENCO CLIENTI ----------
  let cerca = '';
  function lista(el, S) {
    const t = cerca.trim().toLowerCase();
    const vis = [...S.clienti]
      .filter((c) => !t || [c.ragioneSociale, c.nomeBreve, c.piva, ...(c.sedi || []).flatMap((s) => [s.nome, s.citta, s.sigla]), ...(c.referenti || []).flatMap((r) => [r.nome, r.cognome])]
        .join(' ').toLowerCase().includes(t))
      .sort((a, b) => nome(a).localeCompare(nome(b)));
    el.innerHTML = `
      <section class="cli">
        <div class="sez-head">
          <h1>Anagrafica clienti ${info('Tocca un cliente per vedere e modificare i suoi dati, le sedi e i referenti. Quello che cambi qui si aggiorna in tutto il programma (cartelle sottoganci, stampe…).')}</h1>
          <button class="btn" id="btnNuovo">+ Nuovo cliente</button>
        </div>
        <input type="search" id="fCerca" class="cerca" placeholder="Cerca cliente, sede, referente, P.IVA…" value="${esc(cerca)}">
        <div class="elenco">
          ${vis.length ? vis.map((c) => `
            <a class="riga cli-riga" href="#/clienti/${c.id}">
              ${avatar(c)}
              <div class="riga-main">
                <div class="riga-top"><b>${esc(nome(c))}</b>${c.nomeBreve && c.nomeBreve !== c.ragioneSociale ? ` <span class="muted">· ${esc(c.ragioneSociale)}</span>` : ''}</div>
                <div class="chips-sedi">${(c.sedi || []).map((s) => `<span class="chip-sede">${etichettaSede(s)}</span>`).join('') || '<span class="muted small">Nessuna sede</span>'}</div>
              </div>
              <div class="riga-dx muted small">${(c.sedi || []).length} ${(c.sedi || []).length === 1 ? 'sede' : 'sedi'}<br>${(c.referenti || []).length} ${(c.referenti || []).length === 1 ? 'referente' : 'referenti'}</div>
            </a>`).join('') : (S.clienti.length ? '<p class="nessuno">Nessun cliente trovato.</p>' : '<p class="nessuno">Nessun cliente ancora. Inizia con «+ Nuovo cliente».</p>')}
        </div>
      </section>`;
    const fc = el.querySelector('#fCerca');
    fc.oninput = () => { cerca = fc.value; const p = fc.selectionStart; App.ridisegna(); const n = document.getElementById('fCerca'); n.focus(); n.setSelectionRange(p, p); };
    el.querySelector('#btnNuovo').onclick = () => modaleDati(S, null);
    return { titolo: 'Anagrafica clienti', indietro: '#/', live: true };
  }

  // ---------- SCHEDA CLIENTE ----------
  function scheda(el, S, id) {
    const c = S.clienti.find((x) => x.id === id);
    if (!c) { el.innerHTML = '<p class="nessuno">Cliente non trovato.</p>'; return { titolo: 'Cliente', indietro: '#/clienti' }; }
    const campo = (l, v) => `<div class="campo"><span>${l}</span><b>${v || '<i class="muted">—</i>'}</b></div>`;
        el.innerHTML = `
      <section class="cli">
        <div class="card cli-head">
          ${avatar(c, true)}
          <div class="grow">
            <h1>${esc(c.ragioneSociale)}</h1>
            ${c.nomeBreve && c.nomeBreve !== c.ragioneSociale ? `<p class="muted">Nome breve: <b>${esc(c.nomeBreve)}</b></p>` : ''}
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2>Dati generali ${info('Nome breve: è il nome che compare su cartelle ed elenchi stampati (es. CELLINO). La ragione sociale completa va sui documenti ufficiali.')}</h2>
            <button class="btn ghost small" id="btnDati">✏️ Modifica</button></div>
          <div class="griglia-campi">
            ${campo('Ragione sociale', esc(c.ragioneSociale))}
            ${campo('Nome breve', esc(c.nomeBreve))}
            ${campo('Partita IVA', esc(c.piva))}
            ${campo('Codice fiscale', esc(c.cf))}
            ${campo('Codice SDI', esc(c.sdi))}
            ${campo('Telefono', tel(c.telefono))}
            ${campo('Email', mail(c.email))}
            ${campo('PEC', mail(c.pec))}
          </div>
          ${c.note ? `<p class="cli-note">${esc(c.note)}</p>` : ''}
        </div>

        <div class="card">
          <div class="card-head"><h2>Sedi <span class="conta">${(c.sedi || []).length}</span> ${info('Un cliente può avere più sedi (stabilimenti, cantieri). Impianti e sottoganci sono collegati alla sede. Tocca una sede per modificarla.')}</h2>
            <button class="btn ghost small" id="btnSede">+ Aggiungi sede</button></div>
          <div class="schede-mini">
            ${(c.sedi || []).map((s) => `
              <div class="mini" data-sede="${s.id}" role="button" tabindex="0">
                <div class="mini-top"><b>${etichettaSede(s)}</b>
</div>
                <p>${esc(indirizzo(s)) || '<span class="muted">Indirizzo da inserire</span>'}</p>
                ${s.km !== undefined && s.km !== '' ? `<p class="km">🚚 ${esc(s.km)} km dalla nostra sede</p>` : ''}
                ${s.note ? `<p class="muted small">${esc(s.note)}</p>` : ''}
                ${indirizzo(s) ? `<a class="azione" href="${mappa(s)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">📍 Apri mappa</a>` : ''}
              </div>`).join('') || '<p class="muted">Nessuna sede. Aggiungi la prima.</p>'}
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2>Referenti <span class="conta">${(c.referenti || []).length}</span> ${info('Le persone da contattare. Tocca il numero per chiamare o l\'email per scrivere. Tocca il nome per modificare o togliere il referente.')}</h2>
            <button class="btn ghost small" id="btnRef">+ Aggiungi referente</button></div>
          <div class="schede-mini">
            ${(c.referenti || []).map((r) => `
              <div class="mini" data-ref="${r.id}" role="button" tabindex="0">
                <div class="mini-top"><b>👤 ${esc([r.nome, r.cognome].filter(Boolean).join(' '))}</b></div>
                ${tel(r.telefono)}${mail(r.email)}
              </div>`).join('') || '<p class="muted">Nessun referente.</p>'}
          </div>
        </div>
      </section>`;

    el.querySelector('#btnDati').onclick = () => modaleDati(S, c);
    el.querySelector('#btnSede').onclick = () => modaleSede(S, c, null);
    el.querySelector('#btnRef').onclick = () => modaleRef(c, null);
    el.querySelectorAll('[data-sede]').forEach((n) => (n.onclick = () => modaleSede(S, c, c.sedi.find((s) => s.id === n.dataset.sede))));
    el.querySelectorAll('[data-ref]').forEach((n) => (n.onclick = (e) => {
      if (e.target.closest('a')) return; // tocco su telefono / email: lascia chiamare o scrivere
      modaleRef(c, c.referenti.find((r) => r.id === n.dataset.ref));
    }));
    return { titolo: nome(c), indietro: '#/clienti', live: true };
  }

  // ---------- FINESTRE DI MODIFICA ----------
  function modaleDati(S, c) {
    const nuovo = !c;
    UI.modal({
      titolo: nuovo ? 'Nuovo cliente' : 'Dati generali',
      infoTxt: nuovo ? 'Dopo il salvataggio potrai aggiungere sedi e referenti.' : null,
      valori: c || {},
      campi: [
        { k: 'logo', label: 'Logo del cliente', tipo: 'immagine', vuoto: 'Nessun logo: si vedono le iniziali del nome breve' },
        { k: 'ragioneSociale', label: 'Ragione sociale', req: true, placeholder: 'es. CELLINO S.R.L.', maiuscolo: true },
        { k: 'nomeBreve', label: 'Nome breve', placeholder: 'es. CELLINO', aiuto: 'Compare su cartelle ed elenchi', maiuscolo: true, mezza: true },
        { k: 'piva', label: 'Partita IVA', mezza: true, placeholder: '11 cifre' },
        { k: 'cf', label: 'Codice fiscale', mezza: true },
        { k: 'sdi', label: 'Codice SDI', mezza: true, placeholder: '7 caratteri', maiuscolo: true },
        { k: 'telefono', label: 'Telefono fisso', tipo: 'tel', mezza: true },
        { k: 'email', label: 'Email generale', tipo: 'email', mezza: true },
        { k: 'pec', label: 'PEC', tipo: 'email' },
        { k: 'note', label: 'Note', tipo: 'textarea', placeholder: 'es. orari di accesso, chi avvisare…' }
      ],
      onSalva: async (v) => {
        if (!v.nomeBreve) v.nomeBreve = v.ragioneSociale.replace(/\s+(S\.?R\.?L\.?S?|S\.?P\.?A\.?|S\.?A\.?S\.?|S\.?N\.?C\.?)\.?$/i, '').trim();
        const doc = nuovo ? { id: uid(), sedi: [], referenti: [], ...v } : { ...c, ...v };
        await salva(doc);
        UI.toast(nuovo ? 'Cliente creato' : 'Dati salvati', 'ok');
        if (nuovo) location.hash = '#/clienti/' + doc.id;
      },
      onElimina: nuovo ? null : async () => {
        const n = (c.sedi || []).reduce((t, s) => t + usaSede(S, s.id), 0);
        if (n) { UI.toast(`Non si può eliminare: ha impianti o sottoganci collegati (${n})`, 'err'); return false; }
        if (!UI.conferma(`Eliminare ${nome(c)} con tutte le sue sedi e referenti?`)) return false;
        for (const g of S.giriSottoganci.filter((g) => (c.sedi || []).some((s) => s.id === g.sedeId))) await Backend.remove('giriSottoganci', g.id);
        await Backend.remove('clienti', c.id); location.hash = '#/clienti';
      },
      testoElimina: 'Elimina cliente'
    });
  }

  function modaleSede(S, c, sd) {
    UI.modal({
      titolo: sd ? 'Modifica sede' : 'Nuova sede',
      infoTxt: 'Il nome della sede compare sotto il nome del cliente nelle cartelle e sugli elenchi (es. VINOVO). Il nome breve (es. GCV) è la sigla veloce che usate in officina: compare nelle tab e nelle cartelle.',
      valori: sd || {},
      campi: [
        { k: 'nome', label: 'Nome sede', req: true, placeholder: 'es. VINOVO o STABILIMENTO 2', maiuscolo: true, mezza: true },
        { k: 'sigla', label: 'Nome breve sede', placeholder: 'es. GCV', maiuscolo: true, mezza: true, aiuto: 'La sigla che usate in officina' },
        { k: 'indirizzo', label: 'Indirizzo', placeholder: 'es. Via Roma 10' },
        { k: 'cap', label: 'CAP', mezza: true, tipo: 'text' },
        { k: 'citta', label: 'Città', mezza: true },
        { k: 'provincia', label: 'Provincia', mezza: true, placeholder: 'es. TO', maiuscolo: true },
        { k: 'km', label: 'Km dalla nostra sede', tipo: 'number', mezza: true, placeholder: 'es. 25', aiuto: 'Lo decidete voi, si cambia quando serve' },
        { k: 'note', label: 'Note sulla sede', tipo: 'textarea', placeholder: 'es. ingresso carraio, orari, chiave in portineria…' }
      ],
      onSalva: async (v) => {
        const doc = JSON.parse(JSON.stringify(c));
        doc.sedi = doc.sedi || [];
        if (sd) Object.assign(doc.sedi.find((x) => x.id === sd.id), v);
        else doc.sedi.push({ id: uid(), ...v });
        await salva(doc); UI.toast('Sede salvata', 'ok');
      },
      onElimina: sd ? async () => {
        const n = usaSede(S, sd.id);
        if (n) { UI.toast(`Non si può togliere: la sede ha impianti o sottoganci collegati (${n})`, 'err'); return false; }
        if (!UI.conferma(`Togliere la sede ${sd.nome}?`)) return false;
        const doc = JSON.parse(JSON.stringify(c)); doc.sedi = doc.sedi.filter((x) => x.id !== sd.id);
        await salva(doc);
      } : null,
      testoElimina: 'Togli sede'
    });
  }

  function modaleRef(c, r) {
    UI.modal({
      titolo: r ? 'Modifica referente' : 'Nuovo referente',
      valori: r || {},
      campi: [
        { k: 'nome', label: 'Nome', req: true, mezza: true },
        { k: 'cognome', label: 'Cognome', mezza: true },
        { k: 'telefono', label: 'Telefono', tipo: 'tel', mezza: true },
        { k: 'email', label: 'Email', tipo: 'email', mezza: true }
      ],
      onSalva: async (v) => {
        const doc = JSON.parse(JSON.stringify(c));
        doc.referenti = doc.referenti || [];
        if (r) Object.assign(doc.referenti.find((x) => x.id === r.id), v);
        else doc.referenti.push({ id: uid(), ...v });
        await salva(doc); UI.toast('Referente salvato', 'ok');
      },
      onElimina: r ? async () => {
        if (!UI.conferma(`Togliere ${r.nome} ${r.cognome || ''}?`)) return false;
        const doc = JSON.parse(JSON.stringify(c)); doc.referenti = doc.referenti.filter((x) => x.id !== r.id);
        await salva(doc);
      } : null,
      testoElimina: 'Togli referente'
    });
  }

  function route(el, S, parti) {
    return parti[1] ? scheda(el, S, parti[1]) : lista(el, S);
  }
  return { route, nome, indirizzo, avatar };
})();
