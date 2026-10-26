// ===== RAPPORTINI DI INTERVENTO =====
// Un rapportino = un cliente/sede, uno o più giorni di lavoro (ognuno è una riga nel PDF),
// lavori eseguiti, lavori da eseguire, data di consegna e firma del referente.
window.RAP = (function () {
  const { esc, uid, oggi, fmt, info } = UI;
  const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const TRATTE = { AR: 'A/R', A: 'Andata', R: 'Ritorno' };
  const FATTORE = { AR: 2, A: 1, R: 1 };

  // ---------- frase del controllo periodico (l'unica frase pronta del rapportino) ----------
  // CONTROLLO PERIODICO <periodicità> <cosa> CON SCADENZA <mese> COME DA CONTRATTO
  const PERIODICITA = ['TRIMESTRALE', 'SEMESTRALE', 'ANNUALE'];
  const OGGETTI = [
    { k: 'cp', t: 'Carriponte', x: 'DEI VOSTRI CARRIPONTE' },
    { k: 'gb', t: 'Gru a bandiera', x: 'DELLE VOSTRE GRU A BANDIERA' },
    { k: 'sg', t: 'Accessori sottogancio', x: 'DEI VOSTRI ACCESSORI SOTTOGANCIO' },
    { k: 'pm', t: 'Pinze motorizzate', x: 'DELLE VOSTRE PINZE MOTORIZZATE' }
  ];
  const elenca = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' E ' + a[a.length - 1]);
  const fraseControllo = (per, cosa, mese) => `CONTROLLO PERIODICO ${per}${cosa.length ? ' ' + elenca(cosa) : ''}${mese ? ' CON SCADENZA ' + mese : ''} COME DA CONTRATTO.`;

  // ---------- calcoli ----------
  const minuti = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
  const durata = (da, a) => { const x = minuti(da), y = minuti(a); return x != null && y != null && y > x ? y - x : 0; };
  // orari scritti a mano: "1000" o "10" -> 10:00, "830" -> 08:30, "8.30" -> 08:30; sempre a quarti d'ora
  function ora15(txt) {
    const t = String(txt || '').trim(); if (!t) return '';
    let h, m;
    const sep = t.match(/^(\d{1,2})\s*[:.,;\s]\s*(\d{0,2})$/);
    if (sep) { h = +sep[1]; m = +(sep[2] || 0); }
    else if (/^\d{1,4}$/.test(t)) { if (t.length <= 2) { h = +t; m = 0; } else { h = +t.slice(0, t.length - 2); m = +t.slice(-2); } }
    else return null;
    if (h > 24 || m > 59) return null;
    m = Math.round(m / 15) * 15; if (m === 60) { h++; m = 0; }
    if (h >= 24) { h = 23; m = 45; }
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
  // riga dei riferimenti (ordine, offerta, DDT) per l'app e per la stampa
  const rifLista = (r) => [r.ordine && ['ORDINE N°', r.ordine], r.offerta && ['OFFERTA RIF.', r.offerta],
    (r.ddtNumero || r.ddtData) && ['DDT N°', [r.ddtNumero, r.ddtData && 'DEL ' + UI.fmt(r.ddtData)].filter(Boolean).join(' ')]].filter(Boolean);
  const sintesiRif = (r) => rifLista(r).map(([a, b]) => a + ' ' + b).join(' · ');
  const oreLavoro = (g) => durata(g.mattDa, g.mattA) + durata(g.pomDa, g.pomA);
  const hhmm = (m) => (m ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` : '');
  const testoOre = (m) => (m ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') + '\'' : ''}` : '');
  const trova = (S, sedeId) => { for (const c of S.clienti) { const s = (c.sedi || []).find((x) => x.id === sedeId); if (s) return { c, s }; } return { c: null, s: null }; };
  const nomeSede = (c, s) => (s ? (s.sigla || `${CLI.nome(c)} ${s.nome || ''}`.trim()) : '');
  const dateDi = (r) => (r.giorni || []).map((g) => g.data).filter(Boolean).sort();
  const primaData = (r) => dateDi(r)[0] || r.dataConsegna || (r.creato || '').slice(0, 10);
  const numeroDi = (r) => (r.numero ? `${r.numero}/${r.anno}` : 'in arrivo');
  const tecniciDi = (r) => [...new Set((r.giorni || []).flatMap((g) => g.tecnici || []))];
  const breveId = (S, id) => { const u = S.utenti.find((x) => x.id === id); return u ? UT.breve(u) : ''; };     // nell'app: il nome (es. LUCA)
  const siglaId = (S, id) => { const u = S.utenti.find((x) => x.id === id); return u ? UT.sigla(u) : ''; };     // sul foglio stampato: la sigla (es. VL)
  const firmato = (r) => !!r.firmaReferente;
  // sul PDF solo quante piattaforme (nessuna descrizione)
  const nPiatt = (g) => (g.piattaformeTipi || g.piattaforme || []).length || (g.piattaforma ? 1 : "");
  const testoPiatt = (g) => {
    const t = g.piattaformeTipi || [];
    if (!t.length) return g.piattaforma ? 'SÌ' : 'NO';   // vecchi rapportini con la sola spunta
    return `${t.length} – ${[...new Set(t)].join(' / ')}`;
  };
  // aperto = non ancora firmato dal referente (lavoro non chiuso)
  const giorniAperto = (r) => Math.max(0, -UI.giorniDa(primaData(r)));
  const aperti = (S) => S.rapportini.filter((r) => !firmato(r)).sort((a, b) => primaData(a).localeCompare(primaData(b)));
  const badge = (S) => { const a = aperti(S), vecchi = a.filter((r) => giorniAperto(r) > 30).length; return a.length ? `${a.length} da firmare${vecchi ? ` · ${vecchi} da più di un mese` : ''}` : ''; };

  // ---------- 1. ELENCO DIVISO PER MESE ----------
  let filtro = { anno: String(new Date().getFullYear()), mese: '', cli: '', tec: '', stato: '', q: '' };
  let filtriAperti = false;
  function lista(el, S) {
    const anni = [...new Set([String(new Date().getFullYear()), ...S.rapportini.map((r) => primaData(r).slice(0, 4))])].filter(Boolean).sort().reverse();
    const clienti = [...S.clienti].sort((a, b) => CLI.nome(a).localeCompare(CLI.nome(b)));
    const tec = UT.attivi().filter((u) => UT.ruoloDi(u) !== 'ru');
    const q = filtro.q.trim().toLowerCase();
    const nAttivi = ['mese', 'cli', 'tec', 'stato'].filter((k) => filtro[k]).length + (filtro.anno !== String(new Date().getFullYear()) ? 1 : 0);
    const elenco = S.rapportini.filter((r) => {
      const d = primaData(r);
      if (filtro.anno && d.slice(0, 4) !== filtro.anno) return false;
      if (filtro.mese && +d.slice(5, 7) !== +filtro.mese) return false;
      if (filtro.cli && r.clienteId !== filtro.cli) return false;
      if (filtro.tec && !tecniciDi(r).includes(filtro.tec)) return false;
      if (filtro.stato === 'aperti' && firmato(r)) return false;
      if (filtro.stato === 'firmati' && !firmato(r)) return false;
      if (q) { const { c, s } = trova(S, r.sedeId); if (![numeroDi(r), c && CLI.nome(c), c?.ragioneSociale, s?.nome, s?.sigla, r.eseguiti, r.daEseguire, r.ordine, r.offerta, r.ddtNumero].join(' ').toLowerCase().includes(q)) return false; }
      return true;
    }).sort((a, b) => primaData(b).localeCompare(primaData(a)) || b.numero - a.numero);
    const gruppi = [];
    elenco.forEach((r) => { const k = primaData(r).slice(0, 7); let g = gruppi.find((x) => x.k === k); if (!g) gruppi.push((g = { k, r: [] })); g.r.push(r); });
    el.innerHTML = `
      <section class="cli">
        <div class="sez-head"><h1>Rapportini ${info('I rapportini sono divisi per mese (il mese del primo giorno di lavoro). In cima, con 📌, quelli ancora da firmare: restano lì finché non li chiudi. Il simbolo accanto alla ricerca apre i filtri (anno, mese, cliente, tecnico, stato).')}</h1>
          <a class="btn fab" href="#/rapportini/nuovo" id="btnNuovo"><span class="fab-piu">+</span><span class="fab-txt"> Nuovo rapportino</span></a></div>
        <div class="barra-cerca">
          <input type="search" class="cerca" data-f="q" placeholder="Cerca numero, cliente, lavori, ordine, DDT…" value="${esc(filtro.q)}">
          <button type="button" class="btn-filtri ${filtriAperti ? 'on' : ''}" id="btnFiltri" aria-label="Filtri" title="Filtri">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M3 5h18l-7 8v6l-4-2v-4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
            ${nAttivi ? `<span class="n-filtri">${nAttivi}</span>` : ''}
          </button>
        </div>
        <div class="card form filtri-rap" ${filtriAperti ? '' : 'hidden'}>
          <div class="filtri-griglia">
            <label>Anno<select data-f="anno"><option value="">Tutti</option>${anni.map((a) => `<option ${a === filtro.anno ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
            <label>Mese<select data-f="mese"><option value="">Tutti</option>${MESI.map((m, i) => `<option value="${i + 1}" ${String(i + 1) === filtro.mese ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
            <label>Cliente<select data-f="cli"><option value="">Tutti</option>${clienti.map((c) => `<option value="${c.id}" ${c.id === filtro.cli ? 'selected' : ''}>${esc(CLI.nome(c))}</option>`).join('')}</select></label>
            <label>Tecnico<select data-f="tec"><option value="">Tutti</option>${tec.map((u) => `<option value="${u.id}" ${u.id === filtro.tec ? 'selected' : ''}>${esc(UT.breve(u))}</option>`).join('')}</select></label>
            <label>Stato<select data-f="stato">${[['', 'Tutti'], ['aperti', 'Da firmare'], ['firmati', 'Firmati']].map(([k, l]) => `<option value="${k}" ${k === filtro.stato ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          </div>
          ${nAttivi ? '<button type="button" class="link" id="btnAzzera">Togli i filtri</button>' : ''}
        </div>
        ${aperti(S).length ? `<div class="promemoria">${aperti(S).map((r) => { const { c, s } = trova(S, r.sedeId), g = giorniAperto(r);
          return `<a class="prom ${g > 30 ? 'vecchio' : ''}" href="#/rapportini/r/${r.id}"><span class="prom-ico">📌</span><b>N° ${esc(numeroDi(r))}</b><span class="prom-cli">${esc(c ? CLI.nome(c) : '')}${s?.sigla ? ' ' + esc(s.sigla) : ''}</span><span class="prom-gg">da firmare · ${g} gg</span></a>`; }).join('')}</div>` : ''}
        ${gruppi.length ? gruppi.map((g) => `
          <h2 class="mese-rap">${MESI[+g.k.slice(5) - 1]} ${g.k.slice(0, 4)} <span class="muted">· ${g.r.length} ${g.r.length === 1 ? 'rapportino' : 'rapportini'}</span></h2>
          <div class="elenco">${g.r.map((r) => riga(S, r)).join('')}</div>`).join('')
        : `<p class="nessuno">${S.rapportini.length ? 'Nessun rapportino con questi filtri.' : 'Ancora nessun rapportino. Crea il primo con «+ Nuovo rapportino».'}</p>`}
      </section>`;
    el.querySelector('#btnFiltri').onclick = () => { filtriAperti = !filtriAperti; App.ridisegna(); };
    el.querySelector('#btnAzzera')?.addEventListener('click', () => { Object.assign(filtro, { anno: String(new Date().getFullYear()), mese: '', cli: '', tec: '', stato: '' }); App.ridisegna(); });
    el.querySelectorAll('[data-f]').forEach((x) => {
      const ev = x.tagName === 'INPUT' ? 'input' : 'change';
      x.addEventListener(ev, () => {
        filtro[x.dataset.f] = x.value;
        if (x.tagName === 'INPUT') { clearTimeout(lista.t); lista.t = setTimeout(() => { App.ridisegna(); const c = document.querySelector('[data-f="q"]'); if (c) { c.focus(); c.setSelectionRange(c.value.length, c.value.length); } }, 350); }
        else App.ridisegna();
      });
    });
    return { titolo: 'Rapportini di intervento', indietro: '#/', live: true };
  }
  function riga(S, r) {
    const { c, s } = trova(S, r.sedeId);
    const d = dateDi(r), ore = (r.giorni || []).reduce((t, g) => t + oreLavoro(g), 0);
    const periodo = d.length > 1 && d[0] !== d[d.length - 1] ? `${fmt(d[0])} – ${fmt(d[d.length - 1])}` : fmt(d[0] || r.dataConsegna);
    return `<a class="riga cli-riga" href="#/rapportini/r/${r.id}">
      ${c ? CLI.avatar(c) : '<span class="avatar">?</span>'}
      <div class="riga-main">
        <div class="riga-top"><b>N° ${esc(numeroDi(r))}</b> · ${esc(c ? CLI.nome(c) : 'cliente eliminato')}${s ? ` <span class="muted">${esc(nomeSede(c, s))}</span>` : ''}
          <span class="pill ${firmato(r) ? 'st-ok' : 'st-ko'}">${firmato(r) ? 'Firmato' : 'Da firmare'}</span>${r.inviatoIl ? '<span class="pill st-inv">✉️ Inviato</span>' : ''}</div>
        <div class="muted small">${periodo}${d.length > 1 ? ` · ${new Set(d).size} giorni` : ''}${ore ? ` · ${testoOre(ore)} di lavoro` : ''} · ${esc(tecniciDi(r).map((id) => breveId(S, id)).filter(Boolean).join(', ') || '—')}</div>
      </div>›</a>`;
  }

  // ---------- 2. NUOVO / MODIFICA ----------
  const giornoVuoto = (s, prima) => {
    const g = { id: uid(), data: prima ? UI.addGiorni(prima.data || oggi(), 1) : oggi(), mattDa: '', mattA: '', pomDa: '', pomA: '',
      tratta: prima?.tratta || 'AR', viaggio: '', km: '', auto: true, persone: '', personeAuto: true,
      tecnici: prima ? [...prima.tecnici] : [UT.attuale()?.id].filter(Boolean), piattaforme: prima ? [...(prima.piattaforme || [])] : [], note: '' };
    suggerisci(g, s); g.persone = g.tecnici.length || ''; return g;
  };
  // km e minuti di viaggio dall'anagrafica della sede (solo andata) × tratta
  function suggerisci(g, s) {
    if (!s) return;
    const f = FATTORE[g.tratta] || 1;
    g.km = s.km !== undefined && s.km !== '' ? String(Math.round(+s.km * f)) : '';
    g.viaggio = s.viaggio ? String(Math.round(+s.viaggio * f)) : '';
  }

  function form(el, S, r, query) {
    const nuovo = !r;
    const anno = new Date().getFullYear();
    r = r ? JSON.parse(JSON.stringify(r)) : { id: uid(), clienteId: '', sedeId: query.get('sede') || '', giorni: [], eseguiti: '', daEseguire: '', dataConsegna: oggi(), referenteId: '', referenteNome: '', firmaReferente: null, firmaDi: UT.attuale()?.id || '' };
    if (r.sedeId && !r.clienteId) r.clienteId = trova(S, r.sedeId).c?.id || '';
    if (!r.giorni.length) r.giorni.push(giornoVuoto(trova(S, r.sedeId).s));
    const conGiorno = !nuovo && query.get('giorno') === '1';
    if (conGiorno) {
      const ult = r.giorni[r.giorni.length - 1], g = giornoVuoto(trova(S, r.sedeId).s, ult);
      if (oggi() > (ult?.data || '')) g.data = oggi();
      r.giorni.push(g);
    }
    let rifaiFirma = false, pad = null;   // il riquadro della firma si apre solo col tasto (niente firme per sbaglio)
    const tecUtenti = UT.attivi().filter((u) => UT.ruoloDi(u) !== 'ru');

    el.innerHTML = `
      <section class="cli rap-form">
        <form id="fRap" novalidate class="form">
          <div class="card">
            <h2>${nuovo ? 'Nuovo rapportino' : 'Rapportino N° ' + esc(numeroDi(r))}</h2>
            <div class="due">
              <label>Cliente *<select name="clienteId"><option value="">— scegli —</option>${[...S.clienti].sort((a, b) => CLI.nome(a).localeCompare(CLI.nome(b))).map((c) => `<option value="${c.id}" ${c.id === r.clienteId ? 'selected' : ''}>${esc(CLI.nome(c))}</option>`).join('')}</select></label>
              <label>Sede *<select name="sedeId"></select></label>
            </div>
            <details class="rif-rap" ${r.ordine || r.offerta || r.ddtNumero ? 'open' : ''}>
              <summary>📎 Ordine, offerta e DDT <span class="muted small" id="rifSint">${esc(sintesiRif(r))}</span></summary>
              <div class="due">
                <label>N° ordine del cliente<input name="ordine" value="${esc(r.ordine || '')}" autocomplete="off"><small class="ord-sugg" id="ordSugg"></small></label>
                <label>Offerta di riferimento<input name="offerta" value="${esc(r.offerta || '')}" autocomplete="off" placeholder="es. OFF. 125/2026"></label>
              </div>
              <div class="due">
                <label>N° DDT<input name="ddtNumero" value="${esc(r.ddtNumero || '')}" autocomplete="off"></label>
                <label>Data DDT<input type="date" name="ddtData" value="${esc(r.ddtData || '')}"></label>
              </div>
            </details>
            <div id="aperti"></div>
          </div>
          <div class="card">
            <div class="card-head"><h2>Giorni di lavoro ${info('Un rapportino può avere più giorni: ognuno diventa una riga nel PDF. Se arrivate al pomeriggio compila solo il pomeriggio. Km e viaggio vengono proposti dall\'anagrafica della sede (solo andata) e raddoppiano con A/R: puoi sempre cambiarli a mano.')}</h2></div>
            <div id="giorni"></div>
            <button type="button" class="btn ghost aggiungi-riga" id="btnGiorno">+ Aggiungi giorno</button>
          </div>
          <div class="card">
            <div class="card-head"><h2>Lavori eseguiti</h2></div>
            <details class="frasi frase-cp" ${innerWidth > 760 ? 'open' : ''}><summary>＋ Frase del controllo periodico</summary>
              <div class="cp-box">
                <div class="cp-riga"><span class="cp-lab">Controllo</span><div class="cp-scelte">${PERIODICITA.map((x) => `<button type="button" class="chip-s" data-cp-per="${x}">${x.charAt(0) + x.slice(1).toLowerCase()}</button>`).join('')}</div></div>
                <div class="cp-riga"><span class="cp-lab">Di cosa</span><div class="cp-scelte">${OGGETTI.map((o) => `<button type="button" class="chip-s" data-cp-cosa="${o.k}">${o.t}</button>`).join('')}</div></div>
                <div class="cp-riga"><span class="cp-lab">Scadenza</span><select data-cp-mese>${CTR.MESI.map((m) => `<option value="${m.toUpperCase()}">${m.charAt(0).toUpperCase() + m.slice(1)}</option>`).join('')}</select></div>
                <p class="cp-anteprima" id="cpAnteprima"></p>
                <button type="button" class="btn" id="cpInserisci">+ Inserisci nel rapportino</button>
              </div>
            </details>
            <textarea name="eseguiti" rows="6" placeholder="Descrivi i lavori eseguiti (per i controlli usa la frase qui sopra)">${esc(r.eseguiti)}</textarea>
          </div>
          <div class="card">
            <div class="card-head"><h2>Lavori da eseguire</h2></div>
            <div class="frasi-rapide"><button type="button" class="chip-s" data-frase-da="COME DA SCHEDE DI CONTROLLO.">＋ Come da schede di controllo</button></div>
            <textarea name="daEseguire" rows="4" placeholder="Lavori da fare in seguito (se ce ne sono)">${esc(r.daEseguire)}</textarea>
          </div>
          <div class="card memo-rap">
            <div class="card-head"><h2>📌 Promemoria per l'ufficio ${info('Per le cose che il cliente vi chiede di ricordare: un\'offerta per pezzi di ricambio, funi, un preventivo… Il promemoria non va sul rapportino del cliente: compare nella home di chi stampa e invia i documenti (Master, Risorse Umane, Developer) e resta lì finché qualcuno non lo segna come fatto.')}</h2></div>
            <div id="memoLista"></div>
            <button type="button" class="btn ghost" id="btnMemo">+ Nuovo promemoria</button>
          </div>
          <div class="card">
            <h2>Consegna e firme</h2>
            <div class="tre">
              <label>Data di consegna<input type="date" name="dataConsegna" value="${esc(r.dataConsegna || oggi())}"></label>
              <label>Referente che firma<select name="referenteId"></select></label>
              <label data-refnome>Nome del referente<input name="referenteNome" value="${esc(r.referenteNome)}"></label>
            </div>
            <label>Firma del tecnico sul rapportino<select name="firmaDi"></select></label>
            <div id="boxFirma"></div>
          </div>
          <div class="azioni-form barra-salva">
            ${nuovo ? '' : '<button type="button" class="btn danger ghost" id="btnElimina">Elimina</button>'}
            <span class="grow"></span>
            <a class="btn ghost" href="${nuovo ? '#/rapportini' : '#/rapportini/r/' + r.id}">Annulla</a>
            <button class="btn big" type="submit">Salva</button>
          </div>
        </form>
      </section>`;
    const f = el.querySelector('#fRap');
    // --- promemoria per l'ufficio (si salvano subito, a parte dal rapportino)
    const memoLista = () => {
      const lista = (S.promemoria || []).filter((m) => m.rapportinoId === r.id).sort((a, b) => (a.creato || '').localeCompare(b.creato || ''));
      el.querySelector('#memoLista').innerHTML = lista.map((m) => `<div class="memo-riga ${m.fatto ? 'fatto' : ''}"><span>📌</span><div class="grow"><b>${esc(m.testo)}</b><small>${m.fatto ? `✓ fatto il ${fmt((m.fattoIl || '').slice(0, 10))}${m.fattoNome ? ' da ' + esc(m.fattoNome) : ''}` : `scritto da ${esc(m.daNome || '—')} il ${fmt((m.creato || '').slice(0, 10))} · in attesa`}</small></div></div>`).join('') || '<p class="muted small">Nessun promemoria.</p>';
    };
    memoLista();
    el.querySelector('#btnMemo').onclick = () => {
      if (!f.clienteId.value) return UI.toast('Prima scegli il cliente', 'err');
      UI.modal({
        titolo: '📌 Nuovo promemoria per l\'ufficio',
        infoTxt: 'Scrivi cosa va fatto (es. «FARE OFFERTA PER 2 FUNI PARANCO N° 3»). Compare nella home di Master, Risorse Umane e Developer finché non viene segnato come fatto.',
        campi: [{ k: 'testo', label: 'Cosa ricordare', tipo: 'textarea', req: true, maiuscolo: true }],
        testoSalva: 'Salva promemoria',
        onSalva: async (v) => {
          const io = UT.attuale();
          const m = { id: uid(), testo: String(v.testo || '').trim().toUpperCase(), rapportinoId: r.id, clienteId: f.clienteId.value, sedeId: f.sedeId.value || '', creato: new Date().toISOString(), da: io?.id || '', daNome: io ? UT.breve(io) : '', fatto: false };
          await UI.salva('promemoria', m);
          if (!(S.promemoria || []).some((x) => x.id === m.id)) (S.promemoria = S.promemoria || []).push(m);
          memoLista(); UI.toast('Promemoria salvato: lo vedrà l\'ufficio', 'ok');
        }
      });
    };
    el.querySelector('.rif-rap').addEventListener('input', () => (el.querySelector('#rifSint').textContent = sintesiRif({ ordine: f.ordine.value.trim(), offerta: f.offerta.value.trim(), ddtNumero: f.ddtNumero.value.trim(), ddtData: f.ddtData.value })));
    const sedeAttuale = () => trova(S, f.sedeId.value).s;
    const cliente = () => S.clienti.find((c) => c.id === f.clienteId.value);

    // --- cliente / sede / referenti
    const disegnaSedi = () => {
      const ss = cliente()?.sedi || [];
      f.sedeId.innerHTML = ss.length ? (ss.length > 1 ? '<option value="">— scegli —</option>' : '') + ss.map((s) => `<option value="${s.id}" ${s.id === r.sedeId ? 'selected' : ''}>${esc(s.sigla ? s.sigla + ' – ' + (s.nome || '') : s.nome || 'Sede')}</option>`).join('') : '<option value="">(il cliente non ha sedi)</option>';
      const refs = cliente()?.referenti || [];
      f.referenteId.innerHTML = '<option value="">— nessuno / scrivo il nome —</option>' + refs.map((x) => `<option value="${x.id}" ${x.id === r.referenteId ? 'selected' : ''}>${esc([x.nome, x.cognome].filter(Boolean).join(' '))}</option>`).join('');
      mostraRefNome();
    };
    const mostraRefNome = () => (el.querySelector('[data-refnome]').hidden = !!f.referenteId.value);
    f.referenteId.onchange = mostraRefNome;
    f.clienteId.onchange = () => { r.sedeId = ''; disegnaSedi(); aggiornaSede(); };
    f.sedeId.onchange = () => { r.sedeId = f.sedeId.value; aggiornaSede(); };
    const aggiornaSede = () => { leggiGiorni(); const s = sedeAttuale(); r.giorni.forEach((g) => { if (g.auto) suggerisci(g, s); }); disegnaGiorni(); mostraAperti(); propostaCp(); suggOrdine(); };
    // nuovo rapportino per una sede che ne ha già uno aperto: propongo di continuare quello
    const mostraAperti = () => {
      const box = el.querySelector('#aperti'); if (!box) return;
      const lista = nuovo && f.sedeId.value ? aperti(S).filter((x) => x.sedeId === f.sedeId.value) : [];
      box.innerHTML = lista.length ? `<div class="avviso-altro">📌 Per questa sede c'è già ${lista.length === 1 ? 'un rapportino aperto' : lista.length + ' rapportini aperti'}: se il lavoro è lo stesso, continua quello.
        ${lista.map((x) => `<div class="aperto-prop"><span><b>N° ${esc(numeroDi(x))}</b> · ${fmt(primaData(x))} · ${esc((x.eseguiti || '').slice(0, 60))}${(x.eseguiti || '').length > 60 ? '…' : ''}</span><a class="btn small" href="#/rapportini/r/${x.id}/modifica?giorno=1">+ Aggiungi un giorno</a></div>`).join('')}</div>` : '';
    };

    // --- giorni
    // piattaforme dell'anagrafica mezzi (più quelle già scelte, anche se nel frattempo dismesse)
    const chipPiatt = (g) => {
      g.piattaforme = g.piattaforme || [];
      const ps = [...MEZ.piattaforme(S), ...S.mezzi.filter((m) => g.piattaforme.includes(m.id) && m.dismesso)];
      if (!ps.length) return '<p class="muted gr-piatt-vuoto">Nessuna piattaforma: aggiungile in <a href="#/mezzi">Anagrafica mezzi</a>.</p>';
      return `<div class="chip-tecnici piatt">${ps.map((p) => `<button type="button" class="chip-t ${g.piattaforme.includes(p.id) ? 'on' : ''}" data-pt="${p.id}" title="${esc(MEZ.tipoP(p))}">${esc(MEZ.corto(p))}</button>`).join('')}</div>`;
    };
    const chipTec = (g) => tecUtenti.map((u) => `<button type="button" class="chip-t ${g.tecnici.includes(u.id) ? 'on' : ''}" data-tec="${u.id}">${esc(UT.breve(u))}</button>`).join('');
    function disegnaGiorni() {
      const s = sedeAttuale();
      el.querySelector('#giorni').innerHTML = r.giorni.map((g, i) => `
        <div class="giorno-rap" data-g="${i}">
          <div class="gr-head"><b>Giorno ${i + 1}</b><span class="muted small" data-tot></span>${r.giorni.length > 1 ? `<button type="button" class="link txt-ko" data-togli="${i}">Togli</button>` : ''}</div>
          <div class="gr-riga gr-orari">
            <label class="gr-data">Data<input type="date" data-k="data" value="${esc(g.data)}"></label>
            <fieldset class="gr-fascia"><legend>Mattina</legend><input type="text" inputmode="numeric" data-k="mattDa" data-ora data-libero maxlength="5" placeholder="--:--" autocomplete="off" value="${esc(g.mattDa)}" aria-label="Mattina dalle"><span>–</span><input type="text" inputmode="numeric" data-k="mattA" data-ora data-libero maxlength="5" placeholder="--:--" autocomplete="off" value="${esc(g.mattA)}" aria-label="Mattina alle"></fieldset>
            <fieldset class="gr-fascia"><legend>Pomeriggio</legend><input type="text" inputmode="numeric" data-k="pomDa" data-ora data-libero maxlength="5" placeholder="--:--" autocomplete="off" value="${esc(g.pomDa)}" aria-label="Pomeriggio dalle"><span>–</span><input type="text" inputmode="numeric" data-k="pomA" data-ora data-libero maxlength="5" placeholder="--:--" autocomplete="off" value="${esc(g.pomA)}" aria-label="Pomeriggio alle"></fieldset>
          </div>
          <div class="gr-riga">
            <label>Tratta<select data-k="tratta">${Object.entries(TRATTE).map(([k, l]) => `<option value="${k}" ${k === g.tratta ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
            <label>Viaggio <span class="unita">(minuti)</span><input type="number" inputmode="numeric" min="0" data-k="viaggio" value="${esc(g.viaggio)}"></label>
            <label>Km<input type="number" inputmode="numeric" min="0" data-k="km" value="${esc(g.km)}"></label>
            <label>Persone<input type="number" inputmode="numeric" min="1" data-k="persone" value="${esc(g.persone)}"></label>
          </div>
          ${s && (s.km || s.viaggio) ? `<p class="muted small gr-sugg">Dall'anagrafica (solo andata): ${[s.km ? s.km + ' km' : '', s.viaggio ? s.viaggio + ' min' : ''].filter(Boolean).join(' · ')} <button type="button" class="link" data-sugg="${i}">↺ usa questi</button></p>` : ''}
          <div class="gr-riga gr-tec">
            <div class="grow"><span class="lab">Chi è andato</span><div class="chip-tecnici">${chipTec(g)}</div></div>
            <div class="grow"><span class="lab">Piattaforme usate</span>${chipPiatt(g)}</div>
          </div>
          <label>Note<input data-k="note" value="${esc(g.note)}" placeholder="breve nota per questo giorno"></label>
        </div>`).join('');
      el.querySelectorAll('.giorno-rap').forEach((box) => {
        const g = r.giorni[+box.dataset.g];
        const tot = () => { leggiUno(box, g); box.querySelector('[data-tot]').textContent = [oreLavoro(g) ? 'lavoro ' + testoOre(oreLavoro(g)) : '', g.viaggio ? 'viaggio ' + testoOre(+g.viaggio) : ''].filter(Boolean).join(' · '); };
        box.querySelectorAll('[data-k]').forEach((x) => x.addEventListener('input', () => {
          if (x.dataset.k === 'km' || x.dataset.k === 'viaggio') g.auto = false;
          if (x.dataset.k === 'persone') g.personeAuto = false;
          tot();
        }));
        // orari: si scrivono con la tastiera numerica; a 4 cifre si passa da soli al campo dopo
        const ore = [...box.querySelectorAll('[data-ora]')];
        const sistema = (x) => {
          const v = ora15(x.value);
          if (v === null) { x.classList.add('ora-ko'); UI.toast('Orario non valido: scrivi ad esempio 0800 o 8', 'err'); return false; }
          x.classList.remove('ora-ko'); x.value = v; tot(); return true;
        };
        ore.forEach((x, k) => {
          // entrando in un orario già scritto, la prima cifra lo sostituisce (non serve cancellare)
          x.addEventListener('focus', () => (x.dataset.nuovo = '1'));
          x.addEventListener('beforeinput', (e) => { if (x.dataset.nuovo && /^insert/.test(e.inputType)) x.value = ''; delete x.dataset.nuovo; });
          x.addEventListener('change', () => sistema(x));
          x.addEventListener('input', () => {
            x.classList.remove('ora-ko');
            if (/^\d{4}$/.test(x.value) || /^\d{1,2}[:.]\d{2}$/.test(x.value)) { if (sistema(x)) { if (ore[k + 1]) ore[k + 1].focus(); else x.blur(); } }
          });
        });
        box.querySelector('[data-k="tratta"]').addEventListener('change', () => { leggiUno(box, g); suggerisci(g, sedeAttuale()); g.auto = true; box.querySelector('[data-k="km"]').value = g.km; box.querySelector('[data-k="viaggio"]').value = g.viaggio; tot(); });
        box.querySelectorAll('[data-pt]').forEach((b) => (b.onclick = () => { b.classList.toggle('on'); leggiUno(box, g); }));
        box.querySelectorAll('[data-tec]').forEach((b) => (b.onclick = () => {
          b.classList.toggle('on'); leggiUno(box, g);
          if (g.personeAuto) { g.persone = g.tecnici.length || ''; box.querySelector('[data-k="persone"]').value = g.persone; }
          disegnaFirmaDi();
        }));
        tot();
      });
      el.querySelectorAll('[data-togli]').forEach((b) => (b.onclick = () => { leggiGiorni(); r.giorni.splice(+b.dataset.togli, 1); disegnaGiorni(); disegnaFirmaDi(); }));
      el.querySelectorAll('[data-sugg]').forEach((b) => (b.onclick = () => { leggiGiorni(); const g = r.giorni[+b.dataset.sugg]; suggerisci(g, sedeAttuale()); g.auto = true; disegnaGiorni(); }));
    }
    function leggiUno(box, g) {
      box.querySelectorAll('[data-k]').forEach((x) => (g[x.dataset.k] = x.type === 'checkbox' ? x.checked : 'ora' in x.dataset ? (ora15(x.value) || '') : x.value.trim().toUpperCase()));
      g.tecnici = [...box.querySelectorAll('[data-tec].on')].map((b) => b.dataset.tec);
      g.piattaforme = [...box.querySelectorAll('[data-pt].on')].map((b) => b.dataset.pt);
      delete g.piattaforma;
    }
    const leggiGiorni = () => el.querySelectorAll('.giorno-rap').forEach((box) => leggiUno(box, r.giorni[+box.dataset.g]));
    el.querySelector('#btnGiorno').onclick = () => { leggiGiorni(); r.giorni.push(giornoVuoto(sedeAttuale(), r.giorni[r.giorni.length - 1])); disegnaGiorni(); el.querySelector('.giorno-rap:last-child').scrollIntoView({ behavior: 'smooth', block: 'center' }); };

    // --- frasi pronte dei lavori da eseguire: si aggiungono in fondo (una volta sola)
    el.querySelectorAll('[data-frase-da]').forEach((b) => (b.onclick = () => {
      const t = el.querySelector('textarea[name="daEseguire"]'), fr = b.dataset.fraseDa;
      if (t.value.toUpperCase().includes(fr.replace(/\.$/, ''))) return UI.toast('La frase c\'è già', '');
      t.value = (t.value.trim() ? t.value.trim() + '\n' : '') + fr; t.dispatchEvent(new Event('input', { bubbles: true })); t.focus();
    }));
    // --- frase del controllo periodico
    // periodicità e mese di scadenza proposti dal piano controlli della sede (in base alla data del rapportino),
    // "di cosa" in base a cosa c'è nella sede; tutto si può cambiare a mano
    const cp = { per: 'TRIMESTRALE', cosa: [], mese: '', toccato: false };
    function propostaCp() {
      if (cp.toccato) return;
      const s = sedeAttuale(), data = (r.giorni[0]?.data || oggi()), m = +data.slice(5, 7);
      const p = CTR.piano(s);
      // controllo del piano più vicino alla data (quello del mese o, se manca, l'ultimo prima)
      let n = 1, dist = 99;
      for (let k = 1; k <= 4; k++) { const d = (m - CTR.meseVisita(p, k) + 12) % 12; if (d < dist) { dist = d; n = k; } }
      cp.per = { T: 'TRIMESTRALE', S: 'SEMESTRALE', A: 'ANNUALE' }[CTR.tipoVisita(p, n)];
      cp.mese = CTR.MESI[CTR.meseVisita(p, n) - 1].toUpperCase();
      const imp = s ? S.impianti.filter((i) => i.sedeId === s.id && !i.dismesso) : [];
      const band = imp.filter((i) => /bandiera/i.test(i.tipologia || ''));
      cp.cosa = [imp.length > band.length && 'cp', band.length && 'gb', s && S.sottoganci.some((x) => x.sedeId === s.id && !x.dismesso) && 'sg'].filter(Boolean);
      if (!cp.cosa.length) cp.cosa = ['cp'];
      mostraCp();
    }
    function mostraCp() {
      el.querySelectorAll('[data-cp-per]').forEach((b) => b.classList.toggle('on', b.dataset.cpPer === cp.per));
      el.querySelectorAll('[data-cp-cosa]').forEach((b) => b.classList.toggle('on', cp.cosa.includes(b.dataset.cpCosa)));
      el.querySelector('[data-cp-mese]').value = cp.mese || CTR.MESI[new Date().getMonth()].toUpperCase();
      el.querySelector('#cpAnteprima').textContent = fraseControllo(cp.per, OGGETTI.filter((o) => cp.cosa.includes(o.k)).map((o) => o.x), el.querySelector('[data-cp-mese]').value);
    }
    el.querySelectorAll('[data-cp-per]').forEach((b) => (b.onclick = () => { cp.toccato = true; cp.per = b.dataset.cpPer; mostraCp(); }));
    el.querySelectorAll('[data-cp-cosa]').forEach((b) => (b.onclick = () => {
      cp.toccato = true; const k = b.dataset.cpCosa;
      cp.cosa = cp.cosa.includes(k) ? cp.cosa.filter((x) => x !== k) : OGGETTI.map((o) => o.k).filter((x) => x === k || cp.cosa.includes(x));
      mostraCp();
    }));
    el.querySelector('[data-cp-mese]').onchange = (e) => { cp.toccato = true; cp.mese = e.target.value; mostraCp(); };
    el.querySelector('#cpInserisci').onclick = () => {
      if (!cp.cosa.length) return UI.toast('Scegli almeno una voce in «Di cosa»', 'err');
      const ta = f.eseguiti, testo = el.querySelector('#cpAnteprima').textContent;
      ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '') + testo; ta.focus(); ta.scrollTop = ta.scrollHeight;
      // verifica periodica: il n° d'ordine del contratto dell'anno va sul rapportino
      const n = ordineContratto();
      if (n && !f.ordine.value.trim()) { f.ordine.value = n; el.querySelector('.rif-rap').open = true; el.querySelector('.rif-rap').dispatchEvent(new Event('input')); suggOrdine(); UI.toast('Aggiunto il n° d\'ordine del contratto ' + annoRap(), 'ok'); }
    };
    // n° d'ordine del contratto di verifica periodica della sede, per l'anno del rapportino
    const annoRap = () => +((r.giorni[0]?.data || oggi()).slice(0, 4));
    const ordineContratto = () => CLI.ordineDi(sedeAttuale(), annoRap());
    const suggOrdine = () => {
      const n = ordineContratto(), box = el.querySelector('#ordSugg'); if (!box) return;
      box.innerHTML = n && f.ordine.value.trim() !== n ? `Contratto ${annoRap()}: <button type="button" class="link" id="usaOrd">${esc(n)} · usa</button>` : '';
      box.querySelector('#usaOrd')?.addEventListener('click', () => { f.ordine.value = n; suggOrdine(); el.querySelector('.rif-rap').dispatchEvent(new Event('input')); });
    };
    f.ordine.addEventListener('input', suggOrdine);

    // --- firme
    function disegnaFirmaDi() {
      const ids = [...new Set(r.giorni.flatMap((g) => g.tecnici))];
      if (!ids.includes(r.firmaDi)) r.firmaDi = f.firmaDi.value && ids.includes(f.firmaDi.value) ? f.firmaDi.value : ids[0] || '';
      f.firmaDi.innerHTML = ids.map((id) => { const u = S.utenti.find((x) => x.id === id); return u ? `<option value="${id}" ${id === r.firmaDi ? 'selected' : ''}>${esc(UT.breve(u))}${u.firma ? '' : ' (senza firma nel profilo)'}</option>` : ''; }).join('') || '<option value="">— scegli prima chi è andato —</option>';
    }
    f.firmaDi.onchange = () => (r.firmaDi = f.firmaDi.value);
    function disegnaFirma() {
      const b = el.querySelector('#boxFirma');
      if (!rifaiFirma) {
        b.innerHTML = r.firmaReferente
          ? `<div class="firma-salvata grande"><img src="${r.firmaReferente}" alt="Firma del referente"></div><button type="button" class="btn ghost" id="btnRifai">✍️ Rifai la firma del referente</button>`
          : `<button type="button" class="btn big btn-firma" id="btnRifai">✍️ Fai firmare il referente</button><p class="muted small">Puoi salvare anche senza firma e farla firmare dopo.</p>`;
        b.querySelector('#btnRifai').onclick = () => { rifaiFirma = true; disegnaFirma(); };
        pad = null; return;
      }
      b.innerHTML = `<div class="firma firma-grande"><div class="firma-head"><b>Firma del referente</b><button type="button" class="link" id="btnPulisci">Cancella</button></div>
        <canvas id="cvRef"></canvas><span class="firma-hint">Firma qui col dito</span></div>
        <div class="azioni-form"><button type="button" class="btn ghost small" id="btnChiudiFirma">Annulla firma</button></div>`;
      pad = UI.firmaPad(b.querySelector('#cvRef'));
      b.querySelector('#btnPulisci').onclick = () => pad.pulisci();
      b.querySelector('#btnChiudiFirma').onclick = () => { rifaiFirma = false; disegnaFirma(); };
      b.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    disegnaSedi(); disegnaGiorni(); disegnaFirmaDi(); disegnaFirma(); mostraAperti(); propostaCp(); suggOrdine();
    if (conGiorno) setTimeout(() => { el.querySelector('.giorno-rap:last-child')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); UI.toast('Aggiunto il giorno di oggi: compila gli orari', ''); }, 200);

    el.querySelector('#btnElimina')?.addEventListener('click', async () => {
      if (!UI.conferma(`Eliminare il rapportino N° ${numeroDi(r)}?`)) return;
      await Backend.remove('rapportini', r.id); UI.toast('Rapportino eliminato', 'ok'); location.hash = '#/rapportini';
    });
    f.onsubmit = async (e) => {
      e.preventDefault();
      const oraKo = [...el.querySelectorAll('[data-ora]')].find((x) => ora15(x.value) === null);
      if (oraKo) { oraKo.classList.add('ora-ko'); oraKo.focus(); return UI.toast('Controlla gli orari: scrivi ad esempio 0800 o 8', 'err'); }
      leggiGiorni();
      if (!f.clienteId.value) return UI.toast('Scegli il cliente', 'err');
      if (!f.sedeId.value) return UI.toast('Scegli la sede', 'err');
      if (r.giorni.some((g) => !g.data)) return UI.toast('Ogni giorno deve avere la data', 'err');
      if (r.giorni.some((g) => (g.mattDa && g.mattA && minuti(g.mattA) <= minuti(g.mattDa)) || (g.pomDa && g.pomA && minuti(g.pomA) <= minuti(g.pomDa)))) return UI.toast('Controlla gli orari: la fine deve essere dopo l\'inizio', 'err');
      if (!r.giorni.some((g) => g.tecnici.length)) return UI.toast('Scegli chi è andato', 'err');
      const ref = (cliente()?.referenti || []).find((x) => x.id === f.referenteId.value);
      Object.assign(r, {
        clienteId: f.clienteId.value, sedeId: f.sedeId.value,
        eseguiti: f.eseguiti.value.trim().toUpperCase(), daEseguire: f.daEseguire.value.trim().toUpperCase(),
        dataConsegna: f.dataConsegna.value, referenteId: f.referenteId.value,
        referenteNome: ref ? [ref.nome, ref.cognome].filter(Boolean).join(' ').toUpperCase() : f.referenteNome.value.trim().toUpperCase(),
        firmaDi: f.firmaDi.value || '',
        ordine: f.ordine.value.trim().toUpperCase(), offerta: f.offerta.value.trim().toUpperCase(),
        ddtNumero: f.ddtNumero.value.trim().toUpperCase(), ddtData: f.ddtData.value || ''
      });
      r.giorni.sort((a, b) => a.data.localeCompare(b.data));
      // sul rapportino va solo quante piattaforme e di che tipo: lo fisso al salvataggio
      r.giorni.forEach((g) => (g.piattaformeTipi = g.piattaforme.map((id) => { const m = S.mezzi.find((x) => x.id === id); return m ? MEZ.tipoP(m) : ''; }).filter(Boolean)));
      if (pad && !pad.vuota()) { r.firmaReferente = pad.immagine(); r.firmatoIl = new Date().toISOString(); }
      // la firma del tecnico è quella del suo profilo, fissata al momento del salvataggio
      const ft = S.utenti.find((u) => u.id === r.firmaDi);
      r.firmaTecnico = ft?.firma || r.firmaTecnico || null; r.firmatarioTecnico = ft ? UT.breve(ft) : r.firmatarioTecnico || '';
      if (!r.numero) r.numero = S.rapportini.find((x) => x.id === r.id)?.numero || null;   // assegnato nel frattempo da un altro dispositivo
      if (nuovo) {
        const a = (r.giorni[0]?.data || oggi()).slice(0, 4);
        r.anno = +a;
        // con il cloud il numero lo dà il contatore unico (anche se più tablet lavorano offline); senza cloud, il prossimo libero
        if (Backend.mode === 'cloud') { r.numero = null; r.numeroInAttesa = true; }
        else r.numero = Math.max(0, ...S.rapportini.filter((x) => +x.anno === +a).map((x) => +x.numero || 0)) + 1;
        r.creato = new Date().toISOString(); r.creatoDa = UT.attuale()?.id || '';
      }
      await UI.salva('rapportini', r);
      assegnaNumeri(S);
      UI.toast(r.firmaReferente ? 'Rapportino salvato e firmato' : 'Rapportino salvato (da firmare)', 'ok');
      location.hash = '#/rapportini/r/' + r.id;
    };
    return { titolo: nuovo ? 'Nuovo rapportino' : 'Modifica rapportino', indietro: nuovo ? '#/rapportini' : '#/rapportini/r/' + r.id, live: false };
  }

  // ---------- 3. RAPPORTINO (anteprima di stampa / PDF) ----------
  function stampa(el, S, r) {
    const { c, s } = trova(S, r.sedeId);
    const giorni = r.giorni || [];
    const tot = giorni.reduce((t, g) => ({ lav: t.lav + oreLavoro(g), via: t.via + (+g.viaggio || 0), km: t.km + (+g.km || 0) }), { lav: 0, via: 0, km: 0 });
    const fascia = (da, a) => (da || a ? `${esc(da || '…')}–${esc(a || '…')}` : '');
    const indirizzo = s ? [s.indirizzo, [s.cap, s.citta].filter(Boolean).join(' ') + (s.provincia ? ` (${s.provincia})` : '')].filter((x) => x && x.trim()) : [];
    el.innerHTML = `
      <section class="stampa-recap">
        <div class="azioni-lista no-print">
          ${!UT.puoInviare() ? '' : r.numero ? '<button class="btn" id="btnStampa">🖨️ Stampa / salva PDF</button>' : `<span class="pill st-ko">⏳ Numero in arrivo</span><button type="button" class="btn ghost small" id="btnNumero">↻ Assegna adesso</button>${info('Il numero lo dà il contatore unico del cloud, così due tablet non danno mai lo stesso numero. Si assegna da solo appena il rapportino è arrivato al cloud; se resta «in arrivo», tocca «Assegna adesso». Senza internet bisogna aspettare che torni la rete.')}`}
          <a class="btn ghost" href="#/rapportini/r/${r.id}/modifica">${firmato(r) ? '✏️ Modifica' : '✍️ Completa e firma'}</a>
          <a class="btn ghost" href="#/rapportini">Elenco</a>
          ${r.inviatoIl ? `<span class="muted small">✉️ inviato il ${fmt(r.inviatoIl.slice(0, 10))}</span>` : ''}
          ${firmato(r) ? '' : '<span class="pill st-ko">Da firmare</span>'}
          ${info('Scegli «Salva come PDF» nella finestra di stampa, formato A4 verticale, margini «Nessuno».')}
        </div>
        <div class="recap-wrap"><article class="recap rap2">
          ${(() => {
            // ---- RAPPORTO INTERVENTO: stessa impaginazione del modulo cartaceo (misure in mm su A4) ----
            const X = [5.1, 25.2, 35.6, 45.5, 56.1, 66.3, 80.6, 95.6, 110.4, 124.2, 205];   // bordi delle colonne
            const box = (x0, y0, x1, y1, cls = '') => `<div class="r2-b ${cls}" style="left:${x0}mm;top:${y0}mm;width:${(x1 - x0).toFixed(2)}mm;height:${(y1 - y0).toFixed(2)}mm"></div>`;
            // testo dentro una casella: si rimpicciolisce (o va su 2 righe) per non uscire mai dai bordi
            const cella = (x0, y0, x1, y1, txt, cls = '', righe) => `<div class="r2-t ${cls}" data-adatta="0.45"${righe ? ' data-righe="2"' : ''} style="left:${x0}mm;top:${y0}mm;width:${(x1 - x0).toFixed(2)}mm;height:${(y1 - y0).toFixed(2)}mm">${txt}</div>`;
            const ore = (m) => (m ? `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}` : '');
            const oreViaggio = (m) => (m ? String(Math.round(m / 60 * 100) / 100).replace('.', ',') : '0');
            const NR = Math.max(9, giorni.length), Y0 = 47.3, YF = 99.5, RH = (YF - Y0) / NR;
            let h = '';
            // intestazione: logo e destinatario
            h += `<img class="r2-logo" src="img/logo-grande.png" alt="Gru Impianti">`;
            h += box(85, 9.7, 205, 28.4) + `<div class="r2-t r2-spett" style="left:85.6mm;top:10mm">Spett.</div>`;
            h += cella(86, 12.8, 204.3, 17.4, `<b>${esc(CLI.nomeAl(c, primaData(r), s))}</b>`, 'c');
            h += `<div class="r2-riga" style="left:85.7mm;top:17.6mm;width:118.6mm"></div>`;
            h += cella(86, 18.6, 204.3, 23, esc(indirizzo.join(' - ')), 'c');
            h += `<div class="r2-riga" style="left:85.7mm;top:23.1mm;width:118.6mm"></div>`;
            h += cella(86, 23.6, 204.3, 28, (c?.sedi || []).length > 1 && s ? esc(s.nome || '') : '', 'c piccolo');
            // tabella delle ore
            h += box(X[0], 30.2, X[5], 36) + box(X[5], 30.2, X[9], 36) + box(X[9], 30.2, X[10], 36);
            h += cella(X[0] + 0.6, 30.2, X[5] - 0.4, 36, `<b>RAPPORTO INTERVENTO</b> &nbsp;N° ${esc(numeroDi(r))}`);
            h += cella(X[5] + 0.6, 30.2, X[9] - 0.4, 36, `<b>N° ORDINE</b> &nbsp;${esc(r.ordine || '')}`);
            h += cella(X[9] + 0.6, 30.2, X[10] - 0.4, 36, `<b>RIF.PREV.</b> &nbsp;${esc(r.offerta || '')}`);
            h += box(X[0], 36, X[1], 41.1) + box(X[1], 36, X[3], 41.1) + box(X[3], 36, X[5], 41.1) + box(X[5], 36, X[9], 41.1) + box(X[9], 36, X[10], 47.3);
            h += cella(X[1], 36, X[3], 41.1, 'Mattino', 'c') + cella(X[3], 36, X[5], 41.1, 'Pomeriggio', 'c') + cella(X[5], 36, X[9], 41.1, 'Ore impiegate', 'c');
            ['Data', 'dalle', 'alle', 'dalle', 'alle', 'Viaggio', 'Persone', 'Km', 'Ore'].forEach((t, k) => (h += box(X[k], 41.1, X[k + 1], 47.3) + cella(X[k], 41.1, X[k + 1], 47.3, t, 'c')));
            h += cella(X[9], 41.1, X[10], 47.3, '<b>NOTE</b>', 'c');
            for (let k = 0; k < NR; k++) {
              const y = Y0 + k * RH, g = giorni[k];
              for (let q = 0; q < 10; q++) h += box(X[q], y, X[q + 1], y + RH);
              if (!g) continue;
              const pers = +g.persone || (g.tecnici || []).length || 0;
              const tot = (oreLavoro(g) + (+g.viaggio || 0)) * pers;   // ore = (lavorate + viaggio) × persone
              const np = nPiatt(g);
              const nota = [(g.tecnici || []).map((id) => siglaId(S, id)).filter(Boolean).join(' - '), np ? (np > 1 ? np + ' PIATTAFORME' : 'PIATTAFORMA') : '', g.note || ''].filter(Boolean).join(' - ');
              [fmt(g.data), g.mattDa, g.mattA, g.pomDa, g.pomA, oreViaggio(+g.viaggio), pers || '', g.km || 0, ore(tot)].forEach((v, q) => (h += cella(X[q], y, X[q + 1], y + RH, esc(v ?? ''), 'c')));
              h += cella(X[9] + 0.6, y, X[10] - 0.4, y + RH, esc(nota), 'nota', true);
            }
            h += box(X[0], YF, X[10], 105.3) + cella(X[0] + 0.6, YF, X[10] - 0.4, 105.3, `Consegnato D.d.T n° ${esc(r.ddtNumero || '')}${r.ddtData ? ' del ' + fmt(r.ddtData) : ''}`);
            // lavori eseguiti / da eseguire: una riga vuota tra il titolo e il testo
            h += box(X[0], 105.3, X[10], 209) + `<div class="r2-tit" style="left:${X[0] + 0.6}mm;top:106.2mm">LAVORI ESEGUITI :</div>`;
            h += `<div class="r2-testo" data-adatta="0.4" data-blocco style="left:${X[0] + 0.6}mm;top:113.2mm;width:${(X[10] - X[0] - 1.2).toFixed(2)}mm;height:94.8mm">${esc(r.eseguiti || '')}</div>`;
            h += box(X[0], 209, X[10], 249) + `<div class="r2-tit" style="left:${X[0] + 0.6}mm;top:209.9mm">LAVORI DA ESEGUIRE :</div>`;
            h += `<div class="r2-testo" data-adatta="0.4" data-blocco style="left:${X[0] + 0.6}mm;top:216.9mm;width:${(X[10] - X[0] - 1.2).toFixed(2)}mm;height:31.2mm">${esc(r.daEseguire || '')}</div>`;
            // data, firme
            const F = [5.1, 45.7, 124.2, 205];
            h += box(F[0], 251, F[1], 255.9) + box(F[1], 251, F[2], 255.9) + box(F[2], 251, F[3], 255.9);
            h += cella(F[0], 251, F[1], 255.9, '<b>DATA</b>', 'c') + cella(F[1], 251, F[2], 255.9, '<b>FIRMA INCARICATO</b>', 'c') + cella(F[2], 251, F[3], 255.9, '<b>FIRMA CLIENTE</b>', 'c');
            h += box(F[0], 255.9, F[1], 282.3) + box(F[1], 255.9, F[2], 282.3) + box(F[2], 255.9, F[3], 282.3);
            const quando = r.firmatoIl ? new Date(r.firmatoIl) : null;
            const dataOra = quando ? `${fmt(UI.iso(quando))} ${String(quando.getHours()).padStart(2, '0')}:${String(quando.getMinutes()).padStart(2, '0')}` : fmt(r.dataConsegna);
            h += cella(F[0], 259, F[1], 265, esc(dataOra), 'c');
            if (r.firmaTecnico) h += `<img class="r2-firma" src="${r.firmaTecnico}" alt="" style="left:${F[1] + 3}mm;top:257mm;width:${F[2] - F[1] - 6}mm;height:24mm">`;
            if (r.referenteNome) h += cella(F[2] + 1, 256.3, F[3] - 1, 260.3, esc(r.referenteNome), 'c ref');
            if (r.firmaReferente) h += `<img class="r2-firma" src="${r.firmaReferente}" alt="" style="left:${F[2] + 3}mm;top:260.5mm;width:${F[3] - F[2] - 6}mm;height:21mm">`;
            // piè di pagina
            h += `<div class="r2-t r2-piede" style="left:5.1mm;top:283.6mm;width:170mm">Gru impianti S.a.s di Cau Alessandro &amp; C. Sede operativa : Via Avigliana 4/H - 10057 S.Ambrogio(TO)</div>`;
            h += `<div class="r2-t r2-piede" style="left:180mm;top:283.6mm;width:25mm;text-align:right">Pag. 1/ 1</div>`;
            return h;
          })()}
        </article></div>
      </section>`;
    // nessun testo deve uscire dalle caselle del modulo: misuro a grandezza reale, poi rimpicciolisco l'anteprima per lo schermo
    const foglio = el.querySelector('.recap.rap2');
    if (foglio) {
      foglio.style.zoom = 1; UI.adattaTesti(foglio);
      const scala = () => { const w = foglio.parentElement.clientWidth; if (w < 50) return; foglio.style.zoom = Math.min(1, (w - 4) / foglio.offsetWidth).toFixed(3); };
      scala(); window.addEventListener('resize', scala);
    }
    el.querySelector('#btnNumero')?.addEventListener('click', async (e) => {
      if (!navigator.onLine) return UI.toast('Serve internet per avere il numero', 'err');
      e.currentTarget.disabled = true; e.currentTarget.textContent = 'Assegno…';
      await assegnaNumeri(S);
      if (!S.rapportini.find((x) => x.id === r.id)?.numero) { UI.toast('Numero non assegnato: ' + (motivi[r.id] || 'il cloud non ha risposto') + '. Riprovo da solo tra un minuto.', 'err'); App.ridisegna(); }
    });
    if (el.querySelector('#btnStampa')) el.querySelector('#btnStampa').onclick = () => {
      const t = document.title;
      document.title = `Rapportino_${r.numero}-${r.anno}_${c ? CLI.nome(c) : ''}`.replace(/[^\w\-]+/g, '_');
      window.print(); setTimeout(() => (document.title = t), 1000);
    };
    return { titolo: 'Rapportino N° ' + numeroDi(r), indietro: '#/rapportini', live: true };
  }

  // assegna il numero ai rapportini creati senza rete (uno alla volta, in ordine di creazione)
  let assegnando = false;
  // Numero progressivo dal contatore unico del cloud. Si riprova da solo finché tutti i rapportini hanno il numero:
  // appena c'è rete, quando l'app torna in primo piano e ogni minuto (se ce n'è ancora qualcuno in attesa).
  // Lo fa qualsiasi dispositivo collegato (anche Risorse Umane, se le regole del cloud sono quelle aggiornate).
  let ancora = false, tRiprova = null, tAvvio = 0;
  const motivi = {};   // perché un rapportino non ha ancora il numero (per spiegarlo a chi tocca «Assegna adesso»)
  const spiega = (e) => {
    const t = String(e?.code || '') + ' ' + String(e?.message || e || '');
    if (/resource-exhausted|quota/i.test(t)) return 'è finito il limite giornaliero gratuito di Firebase (letture/scritture): riparte da solo dopo le 9:00 di mattina';
    if (/permission/i.test(t)) return 'il cloud non dà il permesso a questo account: pubblica le regole nuove (Firebase › Firestore › Regole)';
    if (/offline|unavailable|network|deadline|tempo/i.test(t)) return 'il cloud non risponde (rete assente o lenta)';
    if (/non-sul-server/.test(t)) return 'il rapportino non è ancora arrivato al cloud (aspetto che parta dalla coda di questo dispositivo)';
    return 'errore del cloud: ' + t.trim().slice(0, 120);
  };
  async function assegnaNumeri(S) {
    if (Backend.mode !== 'cloud' || !Backend.assegnaNumero || !UT.attuale()) return;
    // un tentativo rimasto appeso da più di 40 secondi non blocca i successivi
    if (assegnando && Date.now() - tAvvio < 40000) { ancora = true; return; }
    tAvvio = Date.now();
    const attesa = () => S.rapportini.filter((r) => !r.numero).sort((a, b) => (a.creato || '').localeCompare(b.creato || ''));
    if (!attesa().length) return;
    if (!navigator.onLine) return riprova(S);
    assegnando = true; ancora = false;
    try {
      for (const r of attesa()) {
        const max = Math.max(0, ...S.rapportini.filter((x) => +x.anno === +r.anno).map((x) => +x.numero || 0));
        let n = null;
        try {
          n = await Promise.race([Backend.assegnaNumero(r.anno, r.id, max), new Promise((ok, ko) => setTimeout(() => ko(new Error('tempo scaduto')), 30000))]);
          if (!n) motivi[r.id] = spiega('non-sul-server');
        } catch (e) { console.warn('numero rapportino', e); motivi[r.id] = spiega(e); }
        if (n) { delete motivi[r.id]; r.numero = n; UT.registra('modifica', `Rapportino ${n}/${r.anno}: numero assegnato`, { col: 'rapportini', docId: r.id }); }
      }
    } finally { assegnando = false; }
    if (ancora) setTimeout(() => assegnaNumeri(S), 1500);
    else if (attesa().length) riprova(S);
  }
  function riprova(S) { clearTimeout(tRiprova); tRiprova = setTimeout(() => assegnaNumeri(S), 60000); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && window.App?.dati) assegnaNumeri(App.dati()); });

  function route(el, S, parti, query) {
    if (parti[1] === 'nuovo') return form(el, S, null, query);
    if (parti[1] === 'r') {
      const r = S.rapportini.find((x) => x.id === parti[2]);
      if (!r) { el.innerHTML = '<p class="nessuno">Rapportino non trovato.</p>'; return { titolo: 'Rapportini', indietro: '#/rapportini' }; }
      if (parti[3] === 'modifica') return form(el, S, r, query);
      return stampa(el, S, r);
    }
    return lista(el, S);
  }
  // ---------- promemoria nella home (Master, Risorse Umane, Developer): restano finché non sono fatti ----------
  function memoHome(S) {
    if (!UT.puoInviare()) return '';
    const lista = (S.promemoria || []).filter((m) => !m.fatto).sort((a, b) => (a.creato || '').localeCompare(b.creato || ''));
    if (!lista.length) return '';
    return `<div class="card memo-home"><div class="card-head"><h2>📌 Promemoria da fare <span class="pill st-scadenza">${lista.length}</span> ${info('Li scrivono i tecnici dal rapportino quando il cliente chiede qualcosa (offerte, ricambi, funi…). Restano qui finché qualcuno non tocca «✓ Fatto».')}</h2></div>
      ${lista.map((m) => { const { c, s } = trova(S, m.sedeId), cl = c || S.clienti.find((x) => x.id === m.clienteId), rp = S.rapportini.find((x) => x.id === m.rapportinoId);
        return `<div class="memo-riga"><span>📌</span><div class="grow"><b>${esc(m.testo)}</b>
          <small>${esc(cl ? CLI.nome(cl) : '—')}${s ? ' · ' + esc(s.sigla || s.nome || '') : ''} · ${rp ? `<a href="#/rapportini/r/${rp.id}">rapportino N° ${esc(numeroDi(rp))}</a>` : 'rapportino'} · ${esc(m.daNome || '—')}, ${fmt((m.creato || '').slice(0, 10))}</small></div>
          <button type="button" class="btn ghost small" data-memofatto="${m.id}">✓ Fatto</button></div>`; }).join('')}</div>`;
  }
  function collegaMemo(el, S) {
    el.querySelectorAll('[data-memofatto]').forEach((b) => (b.onclick = async () => {
      const m = (S.promemoria || []).find((x) => x.id === b.dataset.memofatto); if (!m) return;
      if (!UI.conferma(`Segnare come FATTO?\n\n«${m.testo}»\n\nSparisce dalla home di tutti.`)) return;
      const io = UT.attuale();
      await UI.salva('promemoria', { ...m, fatto: true, fattoIl: new Date().toISOString(), fattoDa: io?.id || '', fattoNome: io ? UT.breve(io) : '' });
      UI.toast('Promemoria fatto', 'ok');
    }));
  }

  return { route, badge, oreLavoro, assegnaNumeri, ora15, memoHome, collegaMemo };
})();
