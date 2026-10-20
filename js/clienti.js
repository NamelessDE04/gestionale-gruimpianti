// ===== MODULO: ANAGRAFICA CLIENTI =====
// Un cliente = una ditta (ragione sociale) con una o più sedi e i suoi referenti.
// Tutti gli altri moduli (es. sottoganci) leggono nomi e sedi da qui: si modifica in un solo posto.
window.CLI = (function () {
  const { esc, uid, info } = UI;

  const nome = (c) => c.ragioneSociale || '';   // il nome breve ora c'è solo sede per sede (sigla)
  // N° ordine del contratto annuale di verifica periodica: uno per sede e per anno (sede.ordini = { 2026: 'ABR...' })
  const annoOggi = () => +UI.oggi().slice(0, 4);
  const ordineDi = (s, anno = annoOggi()) => (s?.ordini || {})[anno] || '';
  const ultimoOrdine = (s) => { const k = Object.keys(s?.ordini || {}).map(Number).filter((a) => s.ordini[a]).sort((a, b) => b - a)[0]; return k ? { anno: k, numero: s.ordini[k] } : null; };
  // sedi a cui va aggiornato il n° d'ordine: hanno i controlli periodici, di solito ce lo danno, quest'anno manca e l'avviso non è rimandato
  const ordiniDaAggiornare = (S) => S.clienti.flatMap((c) => (c.sedi || []).map((s) => ({ c, s }))).filter(({ s }) => {
    if (!s.pianoControlli || s.ordineNonDato || ordineDi(s)) return false;
    if (s.ordineRimanda && s.ordineRimanda > UI.oggi()) return false;
    const u = ultimoOrdine(s); return !!u && u.anno < annoOggi();
  });
  const indirizzo = (sd) => [sd.indirizzo, [sd.cap, sd.citta].filter(Boolean).join(' ') + (sd.provincia ? ` (${sd.provincia})` : '')]
    .filter((x) => x && x.trim()).join(', ');
  const mappa = (sd) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(indirizzo(sd));
  const tel = (n) => (n ? `<a class="azione" href="tel:${esc(n.replace(/[^\d+]/g, ''))}">📞 ${esc(n)}</a>` : '');
  const mail = (m) => (m ? `<a class="azione" href="mailto:${esc(m)}">✉️ ${esc(m)}</a>` : '');

  // cerchio con il logo del cliente, oppure le iniziali del nome breve
  const avatar = (c, big) => c.logo
    ? `<span class="avatar logo ${big ? 'big' : ''}"><img src="${c.logo}" alt=""></span>`
    : `<span class="avatar ${big ? 'big' : ''}">${esc(nome(c).slice(0, 2).toUpperCase())}</span>`;
  const etichettaSede = (s) => UI.magnete(s) + ' ' + esc(s.nome || s.citta);
  const salva = (c) => UI.salva('clienti', JSON.parse(JSON.stringify(c)));
  // quanti dati (sottoganci, impianti) sono collegati a una sede: se ce ne sono non si può togliere
  const usaSede = (S, sedeId) => S.sottoganci.filter((x) => x.sedeId === sedeId).length + S.impianti.filter((x) => x.sedeId === sedeId).length;

  // ---------- ELENCO CLIENTI ----------
  let cerca = '';
  function lista(el, S) {
    const t = cerca.trim().toLowerCase();
    const vis = [...S.clienti]
      .filter((c) => !t || [c.ragioneSociale, c.piva, ...(c.sedi || []).flatMap((s) => [s.nome, s.citta, s.sigla]), ...(c.referenti || []).flatMap((r) => [r.nome, r.cognome])]
        .join(' ').toLowerCase().includes(t))
      .sort((a, b) => nome(a).localeCompare(nome(b)));
    el.innerHTML = `
      <section class="cli">
        <div class="sez-head">
          <h1>Anagrafica clienti ${info('Tocca un cliente per vedere e modificare i suoi dati, le sedi e i referenti. Quello che cambi qui si aggiorna in tutto il programma (cartelle sottoganci, stampe…).')}</h1>
          <button class="btn fab" id="btnNuovo"><span class="fab-piu">+</span><span class="fab-txt"> Nuovo cliente</span></button>
        </div>
        <input type="search" id="fCerca" class="cerca" placeholder="Cerca cliente, sede, referente, P.IVA…" value="${esc(cerca)}">
        <div class="elenco">
          ${vis.length ? vis.map((c) => `
            <a class="riga cli-riga" href="#/clienti/${c.id}">
              ${avatar(c)}
              <div class="riga-main">
                <div class="riga-top"><b>${esc(nome(c))}</b></div>
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
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2>Dati generali ${info('La sigla veloce (es. ABT, FEC V) si mette sede per sede: tocca una sede qui sotto.')}</h2>
            <button class="btn ghost small" id="btnDati">✏️ Modifica</button></div>
          <div class="griglia-campi">
            ${campo('Ragione sociale', esc(c.ragioneSociale))}
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
                ${(s.km !== undefined && s.km !== '') || s.viaggio ? `<p class="km">🚚 ${[s.km !== undefined && s.km !== '' ? esc(s.km) + ' km' : '', s.viaggio ? esc(s.viaggio) + ' min' : ''].filter(Boolean).join(' · ')} dalla nostra sede</p>` : ''}
                ${s.note ? `<p class="muted small">${esc(s.note)}</p>` : ''}
                ${s.pianoControlli ? `<p class="ordine-sede">${ordineDi(s) ? `🧾 N° ordine ${annoOggi()}: <b>${esc(ordineDi(s))}</b>` : s.ordineNonDato ? '<span class="muted">🧾 Il cliente non dà il n° d\'ordine</span>' : `<span class="txt-ko">🧾 N° ordine ${annoOggi()} da inserire</span>${ultimoOrdine(s) ? ` <span class="muted">(${ultimoOrdine(s).anno}: ${esc(ultimoOrdine(s).numero)})</span>` : ''}`}</p>` : ''}
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
        { k: 'logo', label: 'Logo del cliente', tipo: 'immagine', vuoto: 'Nessun logo: si vedono le iniziali' },
        { k: 'ragioneSociale', label: 'Ragione sociale', req: true, maiuscolo: true },
        { k: 'piva', label: 'Partita IVA', mezza: true, placeholder: '11 cifre' },
        { k: 'cf', label: 'Codice fiscale', mezza: true },
        { k: 'sdi', label: 'Codice SDI', mezza: true, placeholder: '7 caratteri', maiuscolo: true },
        { k: 'telefono', label: 'Telefono fisso', tipo: 'tel', mezza: true },
        { k: 'email', label: 'Email generale', tipo: 'email', mezza: true },
        { k: 'pec', label: 'PEC', tipo: 'email' },
        { k: 'note', label: 'Note', tipo: 'textarea', placeholder: 'es. orari di accesso, chi avvisare…' }
      ],
      onSalva: async (v) => {
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
      infoTxt: 'Il nome della sede compare sotto il nome del cliente nelle cartelle e sugli elenchi (es. STABILIMENTO 2). Il nome breve (es. ST2) è la sigla veloce che usate in officina: compare nelle tab, nelle cartelle e sulla lavagna. Il colore (giallo, verde, rosso) indica in che mese del trimestre si fanno i controlli ed è lo stesso dei magneti della lavagna.',
      valori: sd ? { ...sd, ordine: ordineDi(sd), trimestre: sd.pianoControlli ? ['1° mese – giallo', '2° mese – verde', '3° mese – rosso'][sd.pianoControlli.mese1 - 1] : '' } : {},
      campi: [
        { k: 'nome', label: 'Nome sede', req: true, placeholder: 'es. STABILIMENTO 2', maiuscolo: true, mezza: true },
        { k: 'sigla', label: 'Nome breve sede', placeholder: 'es. ST2', maiuscolo: true, mezza: true, aiuto: 'La sigla che usate in officina' },
        { k: 'indirizzo', label: 'Indirizzo', placeholder: 'es. Via Roma 10' },
        { k: 'cap', label: 'CAP', mezza: true, tipo: 'text' },
        { k: 'citta', label: 'Città', mezza: true },
        { k: 'provincia', label: 'Provincia', mezza: true, placeholder: 'es. TO', maiuscolo: true },
        { k: 'trimestre', label: 'Controlli nel trimestre (colore)', tipo: 'select', mezza: true, opzioni: ['1° mese – giallo', '2° mese – verde', '3° mese – rosso'], aiuto: 'Gen/Apr/Lug/Ott = giallo · Feb/Mag/Ago/Nov = verde · Mar/Giu/Set/Dic = rosso' },
        { k: 'ordine', label: `N° ordine ${annoOggi()}`, mezza: true, maiuscolo: true, placeholder: 'es. ABR2500013',
          aiuto: (sd && ultimoOrdine(sd) && ultimoOrdine(sd).anno !== annoOggi() ? `${ultimoOrdine(sd).anno}: ${ultimoOrdine(sd).numero} · ` : '') + 'Codice del cliente per il contratto annuale di verifica: si cambia ogni anno' },
        { k: 'ordineNonDato', label: 'Il cliente non ci dà il n° d\'ordine', tipo: 'sino', mezza: true },
        { k: 'km', label: 'Km dalla nostra sede', tipo: 'number', mezza: true, placeholder: 'es. 25', aiuto: 'Solo andata: si cambia quando serve' },
        { k: 'viaggio', label: 'Viaggio', u: 'minuti', tipo: 'number', mezza: true, placeholder: 'es. 30', aiuto: 'Tempo di viaggio solo andata: lo propone il rapportino' },
        { k: 'note', label: 'Note sulla sede', tipo: 'textarea', placeholder: 'es. ingresso carraio, orari, chiave in portineria…' }
      ],
      onSalva: async (v) => {
        const doc = JSON.parse(JSON.stringify(c));
        doc.sedi = doc.sedi || [];
        const { trimestre, ordine, ...dati } = v;
        const m = ['1° mese – giallo', '2° mese – verde', '3° mese – rosso'].indexOf(trimestre) + 1;
        const target = sd ? doc.sedi.find((x) => x.id === sd.id) : { id: uid() };
        Object.assign(target, dati);
        // n° d'ordine dell'anno in corso (gli anni precedenti restano nello storico)
        target.ordini = { ...(target.ordini || {}) };
        if (ordine) { target.ordini[annoOggi()] = ordine; delete target.ordineRimanda; } else delete target.ordini[annoOggi()];
        // il colore è lo stesso dato del "piano controlli": mese del 1° controllo dell'anno
        if (m) target.pianoControlli = { annuale: 1, ...(target.pianoControlli || {}), mese1: m };
        else delete target.pianoControlli;
        if (!sd) doc.sedi.push(target);
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
  // pagina «N° d'ordine da aggiornare» (Master e Risorse Umane): si scrive il nuovo numero oppure si rimanda l'avviso
  function paginaOrdini(el, S) {
    const lista = ordiniDaAggiornare(S), anno = annoOggi();
    el.innerHTML = `
      <section class="cli">
        <div class="sez-head"><h1>N° d'ordine ${anno} ${info('Il n° d\'ordine è il codice che il cliente dà ogni anno per il contratto di verifica periodica e va sui rapportini dei controlli. Qui compaiono le sedi che l\'anno scorso l\'avevano e quest\'anno non ancora. Se il cliente è in ritardo, rimanda l\'avviso.')}</h1></div>
        ${lista.length ? lista.map(({ c, s }) => { const u = ultimoOrdine(s); return `
          <div class="card ord-riga" data-s="${s.id}" data-c="${c.id}">
            <div class="ord-testa"><b>${esc(nome(c))}</b> <span class="muted">· ${UI.magnete(s)} ${esc(s.nome || s.citta || '')}</span>
              <div class="muted small">${u ? `${u.anno}: <b>${esc(u.numero)}</b>` : ''}</div></div>
            <div class="ord-azioni">
              <input class="ord-in" placeholder="N° ordine ${anno}" autocomplete="off">
              <button type="button" class="btn small" data-salva>Salva</button>
              ${UI.menu([{ t: '⏰ Rimanda di una settimana', id: 'r7-' + s.id }, { t: '⏰ Rimanda di un mese', id: 'r30-' + s.id }, { t: '🚫 Il cliente non lo dà più', id: 'nd-' + s.id }], 'Rimanda')}
            </div>
          </div>`; }).join('') : `<p class="nessuno">Tutti i n° d'ordine del ${anno} sono a posto ✓</p>`}
      </section>`;
    const aggiorna = async (cId, sId, f) => { const c = S.clienti.find((x) => x.id === cId); const doc = JSON.parse(JSON.stringify(c)); f(doc.sedi.find((x) => x.id === sId)); await salva(doc); };
    el.querySelectorAll('.ord-riga').forEach((r) => {
      const cId = r.dataset.c, sId = r.dataset.s, inp = r.querySelector('.ord-in');
      r.querySelector('[data-salva]').onclick = async () => {
        const v = inp.value.trim().toUpperCase(); if (!v) { inp.focus(); return UI.toast('Scrivi il n° d\'ordine', 'err'); }
        await aggiorna(cId, sId, (s) => { s.ordini = { ...(s.ordini || {}), [anno]: v }; delete s.ordineRimanda; }); UI.toast('N° d\'ordine salvato', 'ok');
      };
      const rimanda = (g) => aggiorna(cId, sId, (s) => { s.ordineRimanda = UI.addGiorni(UI.oggi(), g); }).then(() => UI.toast(`Ti ricordo di nuovo tra ${g === 7 ? 'una settimana' : 'un mese'}`, 'ok'));
      el.querySelector('#r7-' + sId).onclick = () => rimanda(7);
      el.querySelector('#r30-' + sId).onclick = () => rimanda(30);
      el.querySelector('#nd-' + sId).onclick = () => aggiorna(cId, sId, (s) => { s.ordineNonDato = true; }).then(() => UI.toast('Ok: per questa sede non lo chiederò più', 'ok'));
    });
    return { titolo: 'N° d\'ordine da aggiornare', indietro: '#/', live: true };
  }

  return { route, nome, indirizzo, avatar, ordineDi, ordiniDaAggiornare, paginaOrdini };
})();
