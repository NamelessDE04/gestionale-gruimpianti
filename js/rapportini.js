// ===== RAPPORTINI DI INTERVENTO =====
// Un rapportino = un cliente/sede, uno o più giorni di lavoro (ognuno è una riga nel PDF),
// lavori eseguiti, lavori da eseguire, data di consegna e firma del referente.
window.RAP = (function () {
  const { esc, uid, oggi, fmt, info } = UI;
  const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const TRATTE = { AR: 'A/R', A: 'Andata', R: 'Ritorno' };
  const FATTORE = { AR: 2, A: 1, R: 1 };

  // ---------- scorciatoie (modificabili da "Modifica scorciatoie") ----------
  const FRASI = {
    frasiEseguiti: [
      { t: 'Controllo carriponte', x: 'ESEGUITO CONTROLLO PERIODICO DEI CARRIPONTE AI SENSI DEL D.LGS. 81/08, CON VERIFICA DELLO STATO DI CONSERVAZIONE E DI EFFICIENZA DELLE PARTI MECCANICHE, ELETTRICHE E DEI DISPOSITIVI DI SICUREZZA. ESITI RIPORTATI SULLE RELATIVE SCHEDE DI CONTROLLO.' },
      { t: 'Controllo gru a bandiera', x: 'ESEGUITO CONTROLLO PERIODICO DELLE GRU A BANDIERA AI SENSI DEL D.LGS. 81/08, CON VERIFICA DELLO STATO DI CONSERVAZIONE E DI EFFICIENZA DELLE PARTI MECCANICHE, ELETTRICHE E DEI DISPOSITIVI DI SICUREZZA. ESITI RIPORTATI SULLE RELATIVE SCHEDE DI CONTROLLO.' },
      { t: 'Controllo sottoganci', x: 'ESEGUITA VERIFICA TRIMESTRALE DI FUNI, CATENE, BRACHE E ACCESSORI DI SOLLEVAMENTO AI SENSI DEL D.LGS. 81/08, ALLEGATO VI, PUNTO 3.1.2. ESITI RIPORTATI SULL\'ELENCO DEGLI ACCESSORI.' },
      { t: 'Prove di funzionamento', x: 'ESEGUITE PROVE DI FUNZIONAMENTO A VUOTO DI TUTTI I MOVIMENTI E DEI DISPOSITIVI DI SICUREZZA (FINECORSA, ARRESTO DI EMERGENZA, FRENI).' },
      { t: 'Lubrificazione', x: 'ESEGUITA LUBRIFICAZIONE DELLA FUNE E DEGLI ORGANI IN MOVIMENTO.' },
      { t: 'Sopralluogo', x: 'ESEGUITO SOPRALLUOGO TECNICO PER LA VALUTAZIONE DELL\'INTERVENTO RICHIESTO.' }
    ],
    frasiDaEseguire: [
      { t: 'Nessuno', x: 'NESSUN LAVORO DA ESEGUIRE.' },
      { t: 'Vedi schede di controllo', x: 'INTERVENTI DA ESEGUIRE COME DA OSSERVAZIONI RIPORTATE SULLE SCHEDE DI CONTROLLO.' },
      { t: 'Sostituzione fune', x: 'SOSTITUZIONE DELLA FUNE DI SOLLEVAMENTO.' },
      { t: 'Preventivo', x: 'SEGUIRÀ NOSTRA OFFERTA PER GLI INTERVENTI NECESSARI.' }
    ]
  };
  const frasi = (S, k) => S.impostazioni.find((x) => x.id === k)?.voci || FRASI[k];

  // ---------- calcoli ----------
  const minuti = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
  const durata = (da, a) => { const x = minuti(da), y = minuti(a); return x != null && y != null && y > x ? y - x : 0; };
  const oreLavoro = (g) => durata(g.mattDa, g.mattA) + durata(g.pomDa, g.pomA);
  const hhmm = (m) => (m ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` : '');
  const testoOre = (m) => (m ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') + '\'' : ''}` : '');
  const trova = (S, sedeId) => { for (const c of S.clienti) { const s = (c.sedi || []).find((x) => x.id === sedeId); if (s) return { c, s }; } return { c: null, s: null }; };
  const nomeSede = (c, s) => (s ? (s.sigla || `${CLI.nome(c)} ${s.nome || ''}`.trim()) : '');
  const dateDi = (r) => (r.giorni || []).map((g) => g.data).filter(Boolean).sort();
  const primaData = (r) => dateDi(r)[0] || r.dataConsegna || (r.creato || '').slice(0, 10);
  const numeroDi = (r) => (r.numero ? `${r.numero}/${r.anno}` : 'in arrivo');
  const tecniciDi = (r) => [...new Set((r.giorni || []).flatMap((g) => g.tecnici || []))];
  const breveId = (S, id) => { const u = S.utenti.find((x) => x.id === id); return u ? UT.breve(u) : ''; };
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
  function lista(el, S) {
    const anni = [...new Set([String(new Date().getFullYear()), ...S.rapportini.map((r) => primaData(r).slice(0, 4))])].filter(Boolean).sort().reverse();
    const clienti = [...S.clienti].sort((a, b) => CLI.nome(a).localeCompare(CLI.nome(b)));
    const tec = UT.attivi().filter((u) => UT.ruoloDi(u) !== 'ru');
    const q = filtro.q.trim().toLowerCase();
    const elenco = S.rapportini.filter((r) => {
      const d = primaData(r);
      if (filtro.anno && d.slice(0, 4) !== filtro.anno) return false;
      if (filtro.mese && +d.slice(5, 7) !== +filtro.mese) return false;
      if (filtro.cli && r.clienteId !== filtro.cli) return false;
      if (filtro.tec && !tecniciDi(r).includes(filtro.tec)) return false;
      if (filtro.stato === 'aperti' && firmato(r)) return false;
      if (filtro.stato === 'firmati' && !firmato(r)) return false;
      if (q) { const { c, s } = trova(S, r.sedeId); if (![numeroDi(r), c && CLI.nome(c), c?.ragioneSociale, s?.nome, s?.sigla, r.eseguiti, r.daEseguire].join(' ').toLowerCase().includes(q)) return false; }
      return true;
    }).sort((a, b) => primaData(b).localeCompare(primaData(a)) || b.numero - a.numero);
    const gruppi = [];
    elenco.forEach((r) => { const k = primaData(r).slice(0, 7); let g = gruppi.find((x) => x.k === k); if (!g) gruppi.push((g = { k, r: [] })); g.r.push(r); });
    el.innerHTML = `
      <section class="cli">
        <div class="sez-head"><h1>Rapportini ${info('I rapportini sono divisi per mese (il mese del primo giorno di lavoro). Usa i filtri per trovare quelli di un cliente o di un tecnico. Tocca un rapportino per vederlo, stamparlo o completarlo con la firma del referente.')}</h1>
          ${UT.isMaster() ? '<a class="btn ghost small" href="#/invio?tipo=rapportini&da=%23%2Frapportini">📧 Invia ai clienti</a>' : ''}<a class="btn fab" href="#/rapportini/nuovo" id="btnNuovo"><span class="fab-piu">+</span><span class="fab-txt"> Nuovo rapportino</span></a></div>
        <div class="card form filtri-rap">
          <details class="filtri-det" ${innerWidth > 760 || ['mese', 'cli', 'tec', 'stato'].some((k) => filtro[k]) ? 'open' : ''}><summary>🔎 Filtri${['mese', 'cli', 'tec', 'stato'].filter((k) => filtro[k]).length ? ` <span class="pill st-inv">${['mese', 'cli', 'tec', 'stato'].filter((k) => filtro[k]).length} attivi</span>` : ''} <span class="muted small">anno ${esc(filtro.anno || 'tutti')}</span></summary>
          <div class="filtri-griglia">
            <label>Anno<select data-f="anno"><option value="">Tutti</option>${anni.map((a) => `<option ${a === filtro.anno ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
            <label>Mese<select data-f="mese"><option value="">Tutti</option>${MESI.map((m, i) => `<option value="${i + 1}" ${String(i + 1) === filtro.mese ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
            <label>Cliente<select data-f="cli"><option value="">Tutti</option>${clienti.map((c) => `<option value="${c.id}" ${c.id === filtro.cli ? 'selected' : ''}>${esc(CLI.nome(c))}</option>`).join('')}</select></label>
            <label>Tecnico<select data-f="tec"><option value="">Tutti</option>${tec.map((u) => `<option value="${u.id}" ${u.id === filtro.tec ? 'selected' : ''}>${esc(UT.breve(u))}</option>`).join('')}</select></label>
            <label>Stato<select data-f="stato">${[['', 'Tutti'], ['aperti', 'Da firmare'], ['firmati', 'Firmati']].map(([k, l]) => `<option value="${k}" ${k === filtro.stato ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          </div></details>
          <input type="search" class="cerca" data-f="q" placeholder="Cerca numero, cliente, lavori…" value="${esc(filtro.q)}">
        </div>
        ${aperti(S).length && filtro.stato !== 'firmati' ? `<div class="card aperti-rap">
          <h2>📌 Da completare <span class="muted">· ${aperti(S).length} ${aperti(S).length === 1 ? 'rapportino aperto' : 'rapportini aperti'}</span> ${info('Sono i rapportini non ancora firmati dal referente: restano qui, in cima, finché non li chiudi, qualunque mese stai guardando. Per un lavoro che continua tocca «+ giorno» e aggiungi il nuovo giorno allo stesso rapportino.')}</h2>
          <div class="elenco">${aperti(S).map((r) => `<div class="aperto-riga ${giorniAperto(r) > 30 ? 'vecchio' : ''}">${riga(S, r)}<div class="aperto-az"><span class="small ${giorniAperto(r) > 30 ? 'txt-ko' : 'muted'}">aperto da ${giorniAperto(r)} ${giorniAperto(r) === 1 ? 'giorno' : 'giorni'}</span>${UT.solaLettura() ? '' : `<a class="btn ghost small" href="#/rapportini/r/${r.id}/modifica?giorno=1">+ giorno</a><a class="btn small" href="#/rapportini/r/${r.id}/modifica">✍️ Firma</a>`}</div></div>`).join('')}</div>
        </div>` : ''}
        ${gruppi.length ? gruppi.map((g) => `
          <h2 class="mese-rap">${MESI[+g.k.slice(5) - 1]} ${g.k.slice(0, 4)} <span class="muted">· ${g.r.length} ${g.r.length === 1 ? 'rapportino' : 'rapportini'}</span></h2>
          <div class="elenco">${g.r.map((r) => riga(S, r)).join('')}</div>`).join('')
        : `<p class="nessuno">${S.rapportini.length ? 'Nessun rapportino con questi filtri.' : 'Ancora nessun rapportino. Crea il primo con «+ Nuovo rapportino».'}</p>`}
      </section>`;
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
    let rifaiFirma = !r.firmaReferente, pad = null;
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
            <div id="aperti"></div>
          </div>
          <div class="card">
            <div class="card-head"><h2>Giorni di lavoro ${info('Un rapportino può avere più giorni: ognuno diventa una riga nel PDF. Se arrivate al pomeriggio compila solo il pomeriggio. Km e viaggio vengono proposti dall\'anagrafica della sede (solo andata) e raddoppiano con A/R: puoi sempre cambiarli a mano.')}</h2></div>
            <div id="giorni"></div>
            <button type="button" class="btn ghost aggiungi-riga" id="btnGiorno">+ Aggiungi giorno</button>
          </div>
          <div class="card">
            <div class="card-head"><h2>Lavori eseguiti</h2><button type="button" class="link" data-modfrasi="frasiEseguiti">✏️ Modifica frasi</button></div>
            <details class="frasi" ${innerWidth > 760 ? 'open' : ''}><summary>＋ Frasi pronte</summary><div class="scorciatoie" data-per="eseguiti"></div></details>
            <textarea name="eseguiti" rows="6" placeholder="Descrivi i lavori eseguiti o tocca una scorciatoia">${esc(r.eseguiti)}</textarea>
          </div>
          <div class="card">
            <div class="card-head"><h2>Lavori da eseguire</h2><button type="button" class="link" data-modfrasi="frasiDaEseguire">✏️ Modifica frasi</button></div>
            <details class="frasi" ${innerWidth > 760 ? 'open' : ''}><summary>＋ Frasi pronte</summary><div class="scorciatoie" data-per="daEseguire"></div></details>
            <textarea name="daEseguire" rows="4" placeholder="Lavori da fare in seguito (se ce ne sono)">${esc(r.daEseguire)}</textarea>
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
    const aggiornaSede = () => { leggiGiorni(); const s = sedeAttuale(); r.giorni.forEach((g) => { if (g.auto) suggerisci(g, s); }); disegnaGiorni(); mostraAperti(); };
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
            <fieldset class="gr-fascia"><legend>Mattina</legend><input type="time" data-k="mattDa" value="${esc(g.mattDa)}" aria-label="Mattina dalle"><span>–</span><input type="time" data-k="mattA" value="${esc(g.mattA)}" aria-label="Mattina alle"></fieldset>
            <fieldset class="gr-fascia"><legend>Pomeriggio</legend><input type="time" data-k="pomDa" value="${esc(g.pomDa)}" aria-label="Pomeriggio dalle"><span>–</span><input type="time" data-k="pomA" value="${esc(g.pomA)}" aria-label="Pomeriggio alle"></fieldset>
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
      box.querySelectorAll('[data-k]').forEach((x) => (g[x.dataset.k] = x.type === 'checkbox' ? x.checked : x.value.trim().toUpperCase()));
      g.tecnici = [...box.querySelectorAll('[data-tec].on')].map((b) => b.dataset.tec);
      g.piattaforme = [...box.querySelectorAll('[data-pt].on')].map((b) => b.dataset.pt);
      delete g.piattaforma;
    }
    const leggiGiorni = () => el.querySelectorAll('.giorno-rap').forEach((box) => leggiUno(box, r.giorni[+box.dataset.g]));
    el.querySelector('#btnGiorno').onclick = () => { leggiGiorni(); r.giorni.push(giornoVuoto(sedeAttuale(), r.giorni[r.giorni.length - 1])); disegnaGiorni(); el.querySelector('.giorno-rap:last-child').scrollIntoView({ behavior: 'smooth', block: 'center' }); };

    // --- scorciatoie
    function disegnaFrasi() {
      [['eseguiti', 'frasiEseguiti'], ['daEseguire', 'frasiDaEseguire']].forEach(([campo, k]) => {
        const box = el.querySelector(`[data-per="${campo}"]`);
        box.innerHTML = frasi(S, k).map((x, i) => `<button type="button" class="chip-s" data-i="${i}">+ ${esc(x.t)}</button>`).join('') +
          (campo === 'eseguiti' ? '<button type="button" class="chip-s chip-imp" data-imp>+ Elenco impianti della sede</button>' : '');
        const ta = f[campo];
        const aggiungi = (testo) => { ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '') + testo.toUpperCase(); ta.focus(); ta.scrollTop = ta.scrollHeight; };
        box.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => aggiungi(frasi(S, k)[+b.dataset.i].x)));
        box.querySelector('[data-imp]')?.addEventListener('click', () => {
          const imp = S.impianti.filter((i) => i.sedeId === f.sedeId.value && !i.dismesso);
          if (!imp.length) return UI.toast('Nessun impianto registrato per questa sede', 'err');
          aggiungi('IMPIANTI CONTROLLATI:\n' + imp.map((i) => `- ${i.numeroInterno ? 'N° ' + i.numeroInterno + ' ' : ''}${IMP.titolo(i)}${i.matricola ? ' MATR. ' + i.matricola : ''}`).join('\n'));
        });
      });
    }
    el.querySelectorAll('[data-modfrasi]').forEach((b) => (b.onclick = () => {
      const k = b.dataset.modfrasi;
      UI.modal({
        titolo: k === 'frasiEseguiti' ? 'Scorciatoie: lavori eseguiti' : 'Scorciatoie: lavori da eseguire',
        infoTxt: 'Una scorciatoia per riga, nella forma: NOME | TESTO. Il nome è quello del pulsante, il testo è quello che viene scritto nel rapportino.',
        largo: true,
        valori: { voci: frasi(S, k).map((x) => `${x.t} | ${x.x}`).join('\n') },
        campi: [{ k: 'voci', label: 'Scorciatoie', tipo: 'textarea' }],
        onSalva: async (v) => {
          const voci = v.voci.split('\n').map((x) => x.split('|')).filter((p) => p.length >= 2 && p[0].trim() && p.slice(1).join('|').trim()).map((p) => ({ t: p[0].trim(), x: p.slice(1).join('|').trim() }));
          if (!voci.length) { UI.toast('Serve almeno una scorciatoia (NOME | TESTO)', 'err'); return false; }
          await UI.salva('impostazioni', { id: k, voci });
          S.impostazioni = [...S.impostazioni.filter((x) => x.id !== k), { id: k, voci }];
          disegnaFrasi(); UI.toast('Scorciatoie aggiornate', 'ok');
        }
      });
    }));

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
        b.innerHTML = `<div class="firma-salvata grande"><img src="${r.firmaReferente}" alt="Firma del referente"></div><button type="button" class="btn ghost" id="btnRifai">Rifai la firma del referente</button>`;
        b.querySelector('#btnRifai').onclick = () => { rifaiFirma = true; disegnaFirma(); };
        pad = null; return;
      }
      b.innerHTML = `<div class="firma firma-grande"><div class="firma-head"><b>Firma del referente</b><button type="button" class="link" id="btnPulisci">Cancella</button></div>
        <canvas id="cvRef"></canvas><span class="firma-hint">Firma qui col dito</span></div>
        <p class="muted small">Puoi salvare anche senza firma e farla firmare dopo.</p>`;
      pad = UI.firmaPad(b.querySelector('#cvRef'));
      b.querySelector('#btnPulisci').onclick = () => pad.pulisci();
    }

    disegnaSedi(); disegnaGiorni(); disegnaFrasi(); disegnaFirmaDi(); disegnaFirma(); mostraAperti();
    if (conGiorno) setTimeout(() => { el.querySelector('.giorno-rap:last-child')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); UI.toast('Aggiunto il giorno di oggi: compila gli orari', ''); }, 200);

    el.querySelector('#btnElimina')?.addEventListener('click', async () => {
      if (!UI.conferma(`Eliminare il rapportino N° ${numeroDi(r)}?`)) return;
      await Backend.remove('rapportini', r.id); UI.toast('Rapportino eliminato', 'ok'); location.hash = '#/rapportini';
    });
    f.onsubmit = async (e) => {
      e.preventDefault(); leggiGiorni();
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
        firmaDi: f.firmaDi.value || ''
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
          ${r.numero ? '<button class="btn" id="btnStampa">🖨️ Stampa / salva PDF</button>' : '<span class="pill st-ko">⏳ Numero in arrivo: si assegna da solo appena c\'è internet</span>'}
          <a class="btn ghost" href="#/rapportini/r/${r.id}/modifica">${firmato(r) ? '✏️ Modifica' : '✍️ Completa e firma'}</a>
          <a class="btn ghost" href="#/rapportini">Elenco</a>
          ${UT.isMaster() ? `<a class="btn ghost" href="#/invio?tipo=rapportini&sede=${r.sedeId}&ids=${r.id}&da=${encodeURIComponent('#/rapportini/r/' + r.id)}">📧 ${r.inviatoIl ? 'Inviato il ' + fmt(r.inviatoIl.slice(0, 10)) + ' · reinvia' : 'Invia al cliente'}</a>` : ''}
          ${firmato(r) ? '' : '<span class="pill st-ko">Da firmare</span>'}
          ${info('Scegli «Salva come PDF» nella finestra di stampa, formato A4 verticale, margini predefiniti.')}
        </div>
        <div class="recap-wrap"><article class="recap rap-pdf">
          <div class="rap-pagina">
            <header class="rap-testa">
              <img src="img/logo-grande.png" alt="Gru Impianti" class="rap-logo">
              <div class="rap-spett">
                <span>Spett.le</span>
                <b>${esc(c?.ragioneSociale || '')}</b>
                ${s && (c?.sedi || []).length > 1 ? `<span>${esc(s.nome || '')}</span>` : ''}
                ${indirizzo.map((x) => `<span>${esc(x)}</span>`).join('')}
                ${c?.piva ? `<span>P.IVA ${esc(c.piva)}</span>` : ''}
              </div>
            </header>
            <div class="rap-titolo"><h1>RAPPORTINO DI INTERVENTO</h1><span>N° <b>${esc(numeroDi(r))}</b></span></div>
            <table class="rap-ore">
              <thead><tr><th>Data</th><th>Mattina</th><th>Pomeriggio</th><th>Viaggio</th><th>Km</th><th>Pers.</th><th>Tecnici</th><th>Piattaforme</th><th>Note</th></tr></thead>
              <tbody>${giorni.map((g) => `<tr>
                <td>${fmt(g.data)}</td><td>${fascia(g.mattDa, g.mattA)}</td><td>${fascia(g.pomDa, g.pomA)}</td>
                <td class="num">${g.viaggio ? hhmm(+g.viaggio) : ''}</td><td class="num">${esc(g.km)}</td>
                <td class="num">${esc(g.persone)}</td>
                <td>${esc((g.tecnici || []).map((id) => breveId(S, id)).filter(Boolean).join(', '))}</td><td class="num">${nPiatt(g)}</td><td class="rap-nota">${esc(g.note)}</td></tr>`).join('')}
              ${giorni.length > 1 ? `<tr class="rap-tot"><td colspan="3">TOTALE</td><td class="num">${hhmm(tot.via)}</td><td class="num">${tot.km || ''}</td><td colspan="4"></td></tr>` : ''}</tbody>
            </table>
            <div class="rap-box"><h2>LAVORI ESEGUITI</h2><div class="rap-testo">${esc(r.eseguiti) || '&nbsp;'}</div></div>
            <div class="rap-box"><h2>LAVORI DA ESEGUIRE</h2><div class="rap-testo corto">${esc(r.daEseguire) || '&nbsp;'}</div></div>
            <footer class="rap-firme">
              <div class="rap-firma">
                <span class="rap-etich">IL TECNICO</span>
                <b>${esc(r.firmatarioTecnico || breveId(S, r.firmaDi))}</b>
                <div class="rap-img">${r.firmaTecnico ? `<img src="${r.firmaTecnico}" alt="">` : ''}</div>
              </div>
              <div class="rap-firma dx">
                <span class="rap-etich">DATA DI CONSEGNA: <b>${fmt(r.dataConsegna)}</b></span>
                <span class="rap-etich">IL REFERENTE ${r.referenteNome ? `<b>${esc(r.referenteNome)}</b>` : ''}</span>
                <div class="rap-img grande">${r.firmaReferente ? `<img src="${r.firmaReferente}" alt="">` : ''}</div>
              </div>
            </footer>
          </div>
        </article></div>
      </section>`;
    if (el.querySelector('#btnStampa')) el.querySelector('#btnStampa').onclick = () => {
      const t = document.title;
      document.title = `Rapportino_${r.numero}-${r.anno}_${c ? CLI.nome(c) : ''}`.replace(/[^\w\-]+/g, '_');
      window.print(); setTimeout(() => (document.title = t), 1000);
    };
    return { titolo: 'Rapportino N° ' + numeroDi(r), indietro: '#/rapportini', live: true };
  }

  // assegna il numero ai rapportini creati senza rete (uno alla volta, in ordine di creazione)
  let assegnando = false;
  async function assegnaNumeri(S) {
    if (assegnando || Backend.mode !== 'cloud' || !navigator.onLine || !Backend.assegnaNumero) return;
    const attesa = S.rapportini.filter((r) => !r.numero).sort((a, b) => (a.creato || '').localeCompare(b.creato || ''));
    if (!attesa.length) return;
    assegnando = true;
    try {
      for (const r of attesa) {
        const max = Math.max(0, ...S.rapportini.filter((x) => +x.anno === +r.anno).map((x) => +x.numero || 0));
        const n = await Backend.assegnaNumero(r.anno, r.id, max);
        if (n) { r.numero = n; UT.registra('modifica', `Rapportino ${n}/${r.anno}: numero assegnato`, { col: 'rapportini', docId: r.id }); }
      }
    } catch (e) { console.warn('numeri rapportini', e); }
    assegnando = false;
  }

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
  return { route, badge, oreLavoro, assegnaNumeri };
})();
