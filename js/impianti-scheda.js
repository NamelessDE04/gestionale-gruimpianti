// ===== SCHEDA IMPIANTO A TAB =====
// Dati impianto · Sollevamento · Carrello · Ponte · Impianto elettrico · Documenti · Storico
// Ogni riquadro si modifica con la sua finestra; fune e motori hanno anche "Sostituisci", che salva lo storico.
window.IMPS = (function () {
  const { esc, uid, info, fmt, oggi } = UI;

  // ---------- campi (una sola definizione, usata sia per la finestra di modifica sia per la vista) ----------
  const F_MOTORE = [
    { k: 'marca', label: 'Marca', mezza: true },
    { k: 'modello', label: 'Tipo / modello', mezza: true },
    { k: 'potenza', label: 'Potenza', u: 'kW', mezza: true, placeholder: 'es. 9/2,2' },
    { k: 'tensione', label: 'Tensione', u: 'V', mezza: true, placeholder: 'es. 400' },
    { k: 'corrente', label: 'Corrente', u: 'A', mezza: true, placeholder: 'es. 20/8' },
    { k: 'giri', label: 'Giri', u: 'giri/min', mezza: true },
    { k: 'frequenza', label: 'Frequenza', u: 'Hz', mezza: true, placeholder: '50' },
    { k: 'servizio', label: 'Servizio / ED', u: '%', mezza: true, placeholder: 'es. 40/20' },
    { k: 'matricola', label: 'N° di serie motore', mezza: true },
    { k: 'ip', label: 'Grado di protezione', mezza: true, placeholder: 'es. IP55' },
    { tipo: 'titolo', label: 'Freno' },
    { k: 'frenoPresente', label: 'Freno presente', tipo: 'sino' },
    { k: 'frenoTipo', label: 'Tipo di freno', mezza: true, lista: ['Elettromagnetico a disco', 'Conico', 'A ceppi', 'Elettroidraulico'] },
    { k: 'frenoTensione', label: 'Tensione freno', u: 'V', mezza: true },
    { k: 'frenoCoppia', label: 'Coppia frenante', u: 'Nm', mezza: true },
    { k: 'frenoNote', label: 'Note freno', mezza: true }
  ];
  const F_SOLL = [
    { k: 'tipo', label: 'Tipologia', tipo: 'select', opzioni: ['Paranco', 'Argano'], mezza: true },
    { k: 'marcaModello', label: 'Marca e modello', mezza: true },
    { k: 'portata', label: 'Portata', u: 'kg', num: true, mezza: true },
    { k: 'velocita', label: 'Velocità di sollevamento', u: 'm/min', mezza: true, placeholder: 'es. 5/0,8' },
    { k: 'classeFem', label: 'Classe FEM', mezza: true, lista: ['1Cm', '1Bm', '1Am', '2m', '3m', '4m', '5m'] },
    { k: 'classeIso', label: 'Classe ISO', mezza: true, lista: ['M3', 'M4', 'M5', 'M6', 'M7', 'M8'] },
    { k: 'corsa', label: 'Corsa del gancio', u: 'm', num: true, mezza: true },
    { tipo: 'titolo', label: 'Bozzello' },
    { k: 'bozzello', label: 'Descrizione bozzello', placeholder: 'es. bozzello a 2 pulegge, gancio n° 10' },
    { k: 'pulegge', label: 'N° pulegge', num: true, mezza: true }
  ];
  const F_FUNE = [
    { k: 'conformazione', label: 'Conformazione', mezza: true, lista: ['6x19', '6x36 WS + IWRC', '8x19', '8x36 WS + IWRC', 'Antigirevole 18x7', 'Antigirevole 35x7'] },
    { k: 'diametro', label: 'Diametro', u: 'mm', num: true, mezza: true },
    { k: 'caricoRottura', label: 'Carico di rottura', u: 'kN', num: true, mezza: true },
    { k: 'tratti', label: 'Tratti di fune', num: true, mezza: true },
    { k: 'lunghezza', label: 'Lunghezza', u: 'm', num: true, mezza: true },
    { k: 'dataInstallazione', label: 'Data di installazione', tipo: 'date', mezza: true }
  ];
  const TRASM = ['Motoriduttore diretto', 'Albero di trasmissione', 'Catena', 'Ingranaggi'];
  const F_CARR = [
    { k: 'tipologia', label: 'Tipologia di carrello', mezza: true, lista: ['Birotaia', 'Monorotaia', 'Monorotaia a ingombri ridotti', 'Carrello argano'] },
    { k: 'trasmissione', label: 'Tipo di trasmissione', mezza: true, lista: TRASM },
    { k: 'ruoteMotrici', label: 'Ruote motrici', num: true, mezza: true },
    { k: 'ruoteFolli', label: 'Ruote folli', num: true, mezza: true },
    { k: 'scartamento', label: 'Scartamento carrello', u: 'mm', num: true, mezza: true },
    { k: 'velocita', label: 'Velocità di traslazione', u: 'm/min', mezza: true, placeholder: 'es. 20/5' }
  ];
  const F_PONTE = [
    { k: 'numeroMotori', label: 'N° motori di traslazione', num: true, mezza: true },
    { k: 'trasmissione', label: 'Tipo di trasmissione', mezza: true, lista: TRASM },
    { k: 'ruoteMotrici', label: 'Ruote motrici', num: true, mezza: true },
    { k: 'ruoteFolli', label: 'Ruote folli', num: true, mezza: true },
    { k: 'diametroRuote', label: 'Diametro ruote', u: 'mm', num: true, mezza: true },
    { k: 'velocita', label: 'Velocità di traslazione', u: 'm/min', mezza: true, placeholder: 'es. 40/10' }
  ];
  const F_ELE = [
    { k: 'tensionePrimaria', label: 'Tensione di alimentazione primaria', mezza: true, placeholder: 'es. 400 V 50 Hz trifase' },
    { k: 'tensioniSecondarie', label: 'Tensioni secondarie / ausiliarie', tipo: 'multi', aggiungi: 'Aggiungi tensione', placeholder: 'es. 48 V ca', lista: ['24 V cc', '24 V ca', '48 V ca', '110 V ca', '230 V ca'] },
    { tipo: 'titolo', label: 'Linea di alimentazione' },
    { k: 'alimTipo', label: 'Tipologia carrellino di alimentazione', mezza: true, lista: ['Linea a festone', 'Blindosbarra', 'Sbarre in rame', 'Avvolgicavo'] },
    { k: 'alimMarca', label: 'Marca carrellino di alimentazione', mezza: true },
    { k: 'alimAmpere', label: 'Portata carrellino', u: 'A', num: true, mezza: true },
    { tipo: 'titolo', label: 'Comando' },
    { k: 'comando', label: 'Tipo di comando', tipo: 'select', opzioni: ['Pulsantiera', 'Radiocomando', 'Pulsantiera + radiocomando', 'Cabina'] },
    { k: 'pulsConformazione', label: 'Pulsantiera: conformazione', placeholder: 'es. 8 pulsanti 2 velocità + fungo + marcia' },
    { k: 'pulsMarca', label: 'Pulsantiera: marca', mezza: true },
    { k: 'pulsModello', label: 'Pulsantiera: modello', mezza: true },
    { k: 'radioMarca', label: 'Radiocomando: marca', mezza: true },
    { k: 'radioModello', label: 'Radiocomando: modello', mezza: true },
    { k: 'radioMatricola', label: 'Radiocomando: matricola', mezza: true }
  ];
  const SCHEMI = { motore: F_MOTORE, fune: F_FUNE, soll: F_SOLL, carrello: F_CARR, ponte: F_PONTE, elettrico: F_ELE };
  const COMPONENTI = ['Fune', 'Gancio', 'Bozzello', 'Motore sollevamento', 'Freno sollevamento', 'Motore carrello', 'Freno carrello',
    'Motore ponte', 'Freno ponte', 'Ruote carrello', 'Ruote ponte', 'Finecorsa', 'Pulsantiera', 'Radiocomando', 'Contattori', 'Linea di alimentazione', 'Altro'];
  const RUOLO = (p, n) => 'Paranco ' + (p.ruolo || ['primario', 'secondario', 'ausiliario'][n] || n + 1).toLowerCase();

  // ---------- piccoli aiuti ----------
  const kg = (n) => { n = +n; if (!n) return ''; return n >= 1000 ? (n / 1000).toLocaleString('it-IT') + ' t' : n + ' kg'; };
  const valore = (c, v) => (Array.isArray(v) ? v.map(esc).join(' · ') : c.tipo === 'date' ? fmt(v) : c.k === 'portata' ? kg(v) : esc(v) + (c.u ? ' ' + esc(c.u) : ''));
  const pieno = (v) => v !== undefined && v !== null && v !== '' && v !== false && !(Array.isArray(v) && !v.length);
  function vista(schema, obj, esclusi = []) {
    const righe = schema.filter((c) => c.k && c.tipo !== 'sino' && !c.k.startsWith('freno') && !esclusi.includes(c.k) && pieno(obj?.[c.k]))
      .map((c) => `<div class="campo"><span>${esc(c.label)}</span><b>${valore(c, obj[c.k])}</b></div>`);
    return righe.length ? `<div class="griglia-campi">${righe.join('')}</div>` : '<p class="muted vuoto-dati">Nessun dato inserito. Tocca «Modifica».</p>';
  }
  function vistaMotore(m) {
    if (!m || !Object.values(m).some(pieno)) return '<p class="muted vuoto-dati">Nessun dato inserito. Tocca «Modifica».</p>';
    const freno = m.frenoPresente
      ? `<div class="freno"><b>Freno</b> ${[m.frenoTipo, m.frenoTensione && m.frenoTensione + ' V', m.frenoCoppia && m.frenoCoppia + ' Nm', m.frenoNote].filter(Boolean).map(esc).join(' · ') || 'presente'}</div>`
      : `<div class="freno muted">Freno: ${m.frenoPresente === false && Object.keys(m).length > 1 ? 'non presente' : '—'}</div>`;
    return vista(F_MOTORE, m) + freno;
  }
  const card = (titolo, corpo, azioni, extra = '') => `
    <div class="card scheda-card">
      <div class="card-head"><h2>${titolo}</h2><div class="card-azioni">${azioni}</div></div>
      ${extra}${corpo}
    </div>`;
  const btn = (azione, testo, cls = 'ghost') => `<button class="btn ${cls} small" data-az="${esc(JSON.stringify(azione))}">${testo}</button>`;

  // accesso ai dati annidati: es. ['paranchi', 0, 'fune']
  const prendi = (o, path) => path.reduce((x, k) => (x == null ? undefined : x[k]), o);
  function metti(o, path, v) { let x = o; path.slice(0, -1).forEach((k) => { if (x[k] == null) x[k] = {}; x = x[k]; }); x[path[path.length - 1]] = v; }
  const salva = (d) => UI.salva('impianti', d);
  const copia = (i) => JSON.parse(JSON.stringify(i));

  // ---------- TAB ----------
  function render(el, S, id, query) {
    const i = S.impianti.find((x) => x.id === id);
    if (!i) { el.innerHTML = '<p class="nessuno">Impianto non trovato.</p>'; return { titolo: 'Impianto', indietro: '#/impianti' }; }
    // le tab dipendono dal tipo di impianto (gru a ponte, bandiera, seghetto, …)
    const M = MIMP.di(S, i);
    const TABS = [
      { k: 'dati', l: 'Dati impianto' }, ...(M.gru ? [{ k: 'soll', l: 'Sollevamento' }, { k: 'carrello', l: 'Carrello' }] : []),
      ...(M.ponte ? [{ k: 'ponte', l: 'Ponte' }] : []),
      ...M.sezioni.map((x) => ({ k: 'x_' + x.id, l: x.titolo })),
      ...(M.elettrico ? [{ k: 'elettrico', l: 'Impianto elettrico' }] : []),
      { k: 'documenti', l: 'Documenti', n: (i.allegati || []).length }, { k: 'storico', l: 'Storico', n: (i.storico || []).length }
    ];
    let tab = query.get('tab') || 'dati'; if (!TABS.some((t) => t.k === tab)) tab = 'dati';
    const c = S.clienti.find((x) => x.id === i.clienteId), s = (c?.sedi || []).find((x) => x.id === i.sedeId);
    const paranchi = i.paranchi?.length ? i.paranchi : [{ ruolo: 'Primario' }];

    let corpo = '';
    if (tab === 'dati') {
      corpo = card('Dati dell\'impianto', `
        <div class="griglia-campi">
          ${[['Tipo di impianto', M.nome], ['Tipologia', i.tipologia], ['Marca', i.marca], ['Anno di costruzione', i.annoCostruzione], ['Matricola', i.matricola],
            ['Numero di serie', i.numeroSerie], ['Numero interno', i.numeroInterno], ...(M.scartamento ? [['Scartamento (luce)', i.scartamento && i.scartamento + ' mm']] : [])]
            .map(([l, v]) => `<div class="campo"><span>${l}</span><b>${v ? esc(v) : '<i class="muted">—</i>'}</b></div>`).join('')}
        </div>
        ${M.gru ? `<h3 class="sotto-tit">Portata</h3>
        <div class="paranchi-vista">${paranchi.map((p, n) => `<div class="paranco-v"><span>${esc(RUOLO(p, n))}</span><b>${kg(p.portata) || '—'}</b></div>`).join('')}</div>` : ''}`,
        `<a class="btn ghost small" href="#/impianti/i/${i.id}/modifica">✏️ Modifica</a>`);
    }
    if (tab === 'soll') {
      corpo = paranchi.map((p, n) => `
        ${paranchi.length > 1 ? `<h2 class="sez sez-paranco">${esc(RUOLO(p, n))} · ${kg(p.portata) || '—'}</h2>` : ''}
        ${card('Sollevamento', vista(F_SOLL, p), btn({ a: 'mod', path: ['paranchi', n], s: 'soll', t: 'Sollevamento – ' + RUOLO(p, n) }, '✏️ Modifica'))}
        ${card('Fune', vista(F_FUNE, p.fune),
          btn({ a: 'mod', path: ['paranchi', n, 'fune'], s: 'fune', t: 'Fune – ' + RUOLO(p, n) }, '✏️ Modifica') +
          btn({ a: 'sost', path: ['paranchi', n, 'fune'], s: 'fune', comp: 'Fune', t: 'Sostituzione fune – ' + RUOLO(p, n) }, '🔁 Sostituisci'))}
        ${card('Motore di sollevamento', vistaMotore(p.motore),
          btn({ a: 'mod', path: ['paranchi', n, 'motore'], s: 'motore', t: 'Motore sollevamento – ' + RUOLO(p, n) }, '✏️ Modifica') +
          btn({ a: 'sost', path: ['paranchi', n, 'motore'], s: 'motore', comp: 'Motore sollevamento', t: 'Sostituzione motore – ' + RUOLO(p, n) }, '🔁 Sostituisci'))}
        ${p.motoreAux ? card('Motore di sollevamento ausiliario', vistaMotore(p.motoreAux),
          btn({ a: 'mod', path: ['paranchi', n, 'motoreAux'], s: 'motore', t: 'Motore ausiliario – ' + RUOLO(p, n) }, '✏️ Modifica') +
          btn({ a: 'sost', path: ['paranchi', n, 'motoreAux'], s: 'motore', comp: 'Motore sollevamento ausiliario', t: 'Sostituzione motore ausiliario' }, '🔁 Sostituisci') +
          btn({ a: 'togliAux', n }, '×', 'ghost danger'))
          : `<div class="aggiungi-riga">${btn({ a: 'mod', path: ['paranchi', n, 'motoreAux'], s: 'motore', t: 'Motore ausiliario – ' + RUOLO(p, n) }, '+ Aggiungi motore di sollevamento ausiliario')}</div>`}
      `).join('');
    }
    if (tab === 'carrello') {
      corpo = paranchi.map((p, n) => `
        ${paranchi.length > 1 ? `<h2 class="sez sez-paranco">Carrello ${esc(RUOLO(p, n))}</h2>` : ''}
        ${card('Carrello', vista(F_CARR, p.carrello), btn({ a: 'mod', path: ['paranchi', n, 'carrello'], s: 'carrello', t: 'Carrello – ' + RUOLO(p, n) }, '✏️ Modifica'))}
        ${card('Motore di traslazione carrello', vistaMotore(p.carrello?.motore),
          btn({ a: 'mod', path: ['paranchi', n, 'carrello', 'motore'], s: 'motore', t: 'Motore carrello – ' + RUOLO(p, n) }, '✏️ Modifica') +
          btn({ a: 'sost', path: ['paranchi', n, 'carrello', 'motore'], s: 'motore', comp: 'Motore carrello', t: 'Sostituzione motore carrello' }, '🔁 Sostituisci'))}
      `).join('');
    }
    if (tab === 'ponte') {
      corpo = card('Ponte', vista(F_PONTE, i.ponte), btn({ a: 'mod', path: ['ponte'], s: 'ponte', t: 'Ponte' }, '✏️ Modifica')) +
        card('Motore di traslazione ponte', vistaMotore(i.ponte?.motore),
          btn({ a: 'mod', path: ['ponte', 'motore'], s: 'motore', t: 'Motore ponte' }, '✏️ Modifica') +
          btn({ a: 'sost', path: ['ponte', 'motore'], s: 'motore', comp: 'Motore ponte', t: 'Sostituzione motore ponte' }, '🔁 Sostituisci'),
          i.ponte?.numeroMotori > 1 ? `<p class="muted small">Dati di targa di un motore (sono ${esc(i.ponte.numeroMotori)} uguali).</p>` : '');
    }
    if (tab === 'elettrico') {
      corpo = card('Impianto elettrico e bordo gru', vista(F_ELE, i.elettrico), btn({ a: 'mod', path: ['elettrico'], s: 'elettrico', t: 'Impianto elettrico e bordo gru' }, '✏️ Modifica')) +
        `<p class="muted small rimando">Schema elettrico e schema del radiocomando si allegano nella tab <a class="link" href="#/impianti/i/${i.id}?tab=documenti">Documenti</a>.</p>`;
    }
    if (tab.startsWith('x_')) {
      const sez = M.sezioni.find((x) => 'x_' + x.id === tab), r = MIMP.righe(sez, i.dati?.[sez.id]);
      corpo = card(esc(sez.titolo), r.length ? `<div class="griglia-campi">${r.map(([l, v]) => `<div class="campo"><span>${esc(l)}</span><b>${v}</b></div>`).join('')}</div>`
        : `<p class="muted vuoto-dati">${sez.campi.length ? 'Nessun dato inserito. Tocca «Modifica».' : 'Questa sezione non ha ancora voci.'}</p>`,
        sez.campi.length ? btn({ a: 'mod', path: ['dati', sez.id], s: 'x:' + sez.id, t: sez.titolo }, '✏️ Modifica') : '');
    }
    if (tab === 'documenti') {
      const al = (i.allegati || []).slice().sort((a, b) => (b.data || '').localeCompare(a.data || ''));
      corpo = card(`Documenti ${info('Puoi allegare PDF o foto: schema elettrico, schema del radiocomando, manuali, dichiarazioni… I file restano su questo dispositivo (con il cloud saranno condivisi).')}`, `
        <div class="allega-btns">
          ${['Schema elettrico gru', 'Schema radiocomando', 'Altro documento'].map((t) => `<button class="btn ghost" data-allega="${t}">📎 ${t}</button>`).join('')}
        </div>
        <input type="file" id="inAllegato" accept="application/pdf,image/*" hidden>
        <div class="elenco-file">
          ${al.map((a) => `
            <div class="file-riga">
              <span class="file-ico">${/pdf/.test(a.mime) ? '📄' : /image/.test(a.mime) ? '🖼️' : '📎'}</span>
              <div class="grow"><b>${esc(a.tipo)}</b><div class="muted small">${esc(a.nome)} · ${ALLEGATI.dimensione(a.size)} · ${fmt(a.data)}</div></div>
              <button class="btn small" data-apri="${a.id}">Apri</button>
              <button class="btn ghost small danger" data-rmfile="${a.id}" aria-label="Elimina">×</button>
            </div>`).join('') || '<p class="muted vuoto-dati">Nessun documento allegato.</p>'}
        </div>`, '');
    }
    if (tab === 'storico') {
      const st = (i.storico || []).slice().sort((a, b) => (b.data || '').localeCompare(a.data || ''));
      corpo = card(`Storico sostituzioni e interventi ${info('Qui restano tutte le sostituzioni. Quelle fatte con «Sostituisci» (fune, motori) conservano anche i dati del pezzo vecchio. Per altri componenti usa «+ Registra sostituzione».')}`, `
        <div class="timeline">
          ${st.map((e) => `
            <div class="tl-voce" data-storico="${e.id}" role="button" tabindex="0">
              <div class="tl-data">${fmt(e.data)}</div>
              <div class="tl-corpo"><b>${esc(e.componente)}</b>${e.tecnico ? ` <span class="muted small">· ${esc(e.tecnico)}</span>` : ''}
                ${e.note ? `<p>${esc(e.note)}</p>` : ''}
                ${diff(e)}
              </div>
            </div>`).join('') || '<p class="muted vuoto-dati">Nessuna sostituzione registrata.</p>'}
        </div>`, btn({ a: 'storicoNuovo' }, '+ Registra sostituzione', ''));
    }

    el.innerHTML = `
      <section class="cli imp-scheda">
        <div class="card cli-head">
          <span class="imp-ico big">${IMP.icona(i)}</span>
          <div class="grow">
            <h1>${i.numeroInterno ? `N° ${esc(i.numeroInterno)} · ` : ''}${esc(IMP.titolo(i))}</h1>
            <p class="muted">${s ? UI.magnete(s) : ''} <a class="link-anag" href="#/clienti/${i.clienteId}">${esc(c ? CLI.nome(c) : '(cliente)')}</a> · ${esc(s ? s.nome || s.citta : '')}
              ${i.matricola ? ' · Matr. ' + esc(i.matricola) : ''}${M.gru ? ` · <b>${paranchi.map((p) => kg(p.portata)).filter(Boolean).join(' + ') || '—'}</b>` : ''}${IMP.pillStato(i)}${i.fsDal && IMP.statoImp(i) ? ' <span class="muted small">dal ' + UI.fmt(i.fsDal) + '</span>' : ''}</p>
          </div>
          <a class="btn ghost" href="#/impianti/i/${i.id}/stampa" title="Riepilogo di tutti i dati in PDF">🖨️ Stampa</a>
        </div>
        <nav class="tabs tabs-scheda">${TABS.map((t) => `<a class="tab ${t.k === tab ? 'on' : ''}" href="#/impianti/i/${i.id}?tab=${t.k}"><b>${t.l}${t.n ? ` <span class="tab-n">${t.n}</span>` : ''}</b></a>`).join('')}</nav>
        ${corpo}
      </section>`;

    collega(el, S, i, M);
    el.querySelector('.tab.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
    return { titolo: IMP.titolo(i), indietro: '#/impianti/c/' + i.clienteId, live: true };
  }

  // differenze tra pezzo vecchio e nuovo (per lo storico)
  function diff(e) {
    if (!e.prima || !e.dopo || !SCHEMI[e.schema]) return '';
    const righe = SCHEMI[e.schema].filter((c) => c.k && c.k !== 'dataInstallazione' && String(e.prima[c.k] ?? '') !== String(e.dopo[c.k] ?? ''))
      .map((c) => `<li>${esc(c.label)}: <s>${c.tipo === 'sino' ? (e.prima[c.k] ? 'sì' : 'no') : esc(e.prima[c.k] || '—')}</s> → <b>${c.tipo === 'sino' ? (e.dopo[c.k] ? 'sì' : 'no') : esc(e.dopo[c.k] || '—')}</b>${c.u && c.tipo !== 'sino' ? ' ' + esc(c.u) : ''}</li>`);
    return righe.length ? `<ul class="diff">${righe.join('')}</ul>` : '<p class="muted small">Stesso modello e stessi dati del precedente.</p>';
  }

  // ---------- azioni dei pulsanti ----------
  function collega(el, S, i, M) {
    // senza il permesso di modificare le anagrafiche i pulsanti di modifica, sostituzione e documenti avvisano e basta
    if (!UT.puo('anag.modifica')) el.querySelectorAll('[data-az], [data-allega], [data-rmfile]').forEach((b) => (b.hidden = true));
    el.querySelectorAll('[data-az]').forEach((b) => (b.onclick = () => {
      const az = JSON.parse(b.dataset.az);
      if (az.a === 'mod') modifica(i, az, M);
      if (az.a === 'sost') sostituisci(i, az);
      if (az.a === 'togliAux') {
        if (!UI.conferma('Togliere il motore ausiliario da questo paranco?')) return;
        const d = copia(i); delete d.paranchi[az.n].motoreAux; salva(d);
      }
      if (az.a === 'storicoNuovo') voceStorico(i, null);
    }));
    el.querySelectorAll('[data-storico]').forEach((v) => (v.onclick = () => voceStorico(i, (i.storico || []).find((e) => e.id === v.dataset.storico))));
    // documenti
    const inp = el.querySelector('#inAllegato'); let tipoAll = '';
    el.querySelectorAll('[data-allega]').forEach((b) => (b.onclick = () => { tipoAll = b.dataset.allega; inp.click(); }));
    if (inp) inp.onchange = async () => {
      const f = inp.files[0]; inp.value = ''; if (!f) return;
      if (f.size > ALLEGATI.MAX) return UI.toast('File troppo grande (massimo 25 MB)', 'err');
      const meta = { id: uid(), tipo: tipoAll, nome: f.name, mime: f.type, size: f.size, data: oggi() };
      try { await ALLEGATI.salva(meta.id, f); } catch (e) { return UI.toast('Impossibile salvare il file sul dispositivo', 'err'); }
      const d = copia(i); (d.allegati = d.allegati || []).push(meta); await salva(d);
      UI.toast('Documento allegato', 'ok');
    };
    el.querySelectorAll('[data-apri]').forEach((b) => (b.onclick = () => { const a = i.allegati.find((x) => x.id === b.dataset.apri); ALLEGATI.apri(a.id, a.nome); }));
    el.querySelectorAll('[data-rmfile]').forEach((b) => (b.onclick = async () => {
      const a = i.allegati.find((x) => x.id === b.dataset.rmfile);
      if (!UI.conferma(`Eliminare «${a.tipo}» (${a.nome})?`)) return;
      await ALLEGATI.elimina(a.id).catch(() => {});
      const d = copia(i); d.allegati = d.allegati.filter((x) => x.id !== a.id); await salva(d);
    }));
  }

  // finestra di modifica di un riquadro
  function modifica(i, az, M) {
    const sez = az.s.startsWith('x:') && M ? M.sezioni.find((x) => x.id === az.s.slice(2)) : null;
    const schema = sez ? MIMP.campiModal(sez) : SCHEMI[az.s];
    const cur = prendi(i, az.path) || {};
    UI.modal({
      titolo: az.t, campi: schema, valori: { ...cur }, largo: true,
      onSalva: async (v) => {
        const d = copia(i);
        metti(d, az.path, { ...(prendi(d, az.path) || {}), ...v });
        await salva(d); UI.toast('Salvato', 'ok');
      }
    });
  }

  // sostituzione: i dati vecchi vanno nello storico, i nuovi diventano quelli attuali
  function sostituisci(i, az) {
    const schema = SCHEMI[az.s].filter((c) => c.k !== 'dataInstallazione');
    const cur = prendi(i, az.path) || {};
    UI.modal({
      titolo: az.t, largo: true, testoSalva: 'Registra sostituzione',
      infoTxt: 'Scrivi i dati del pezzo NUOVO (partono da quelli del vecchio: cambia solo ciò che è diverso). Il pezzo vecchio resta nello storico.',
      valori: { ...cur, _data: oggi(), _note: '' },
      campi: [{ k: '_data', label: 'Data della sostituzione', tipo: 'date', req: true, mezza: true }, { tipo: 'titolo', label: 'Dati del nuovo componente' }, ...schema,
        { tipo: 'titolo', label: 'Note' }, { k: '_note', label: 'Note sulla sostituzione', tipo: 'textarea', placeholder: 'es. fune con 12 fili rotti, sostituita' }],
      onSalva: async (v) => {
        const { _data, _note, ...nuovo } = v;
        const d = copia(i);
        const prima = copia(cur);
        const dopo = { ...cur, ...nuovo };
        if (az.s === 'fune') dopo.dataInstallazione = _data;
        metti(d, az.path, dopo);
        (d.storico = d.storico || []).push({ id: uid(), data: _data, componente: az.comp + (d.paranchi?.length > 1 && az.path[0] === 'paranchi' ? ' – ' + RUOLO(d.paranchi[az.path[1]], az.path[1]) : ''),
          schema: az.s, prima, dopo: copia(dopo), note: _note, tecnico: App.tecnicoPredefinito() });
        await salva(d); UI.toast('Sostituzione registrata nello storico', 'ok');
      }
    });
  }

  // voce di storico manuale (qualsiasi componente)
  function voceStorico(i, e) {
    UI.modal({
      titolo: e ? 'Voce di storico' : 'Registra sostituzione',
      valori: e ? { ...e } : { data: oggi(), tecnico: App.tecnicoPredefinito() },
      campi: [
        { k: 'componente', label: 'Componente', req: true, lista: COMPONENTI, mezza: true },
        { k: 'data', label: 'Data', tipo: 'date', req: true, mezza: true },
        { k: 'tecnico', label: 'Tecnico', mezza: true, lista: App.tecnici },
        { k: 'note', label: 'Descrizione', tipo: 'textarea', placeholder: 'es. sostituito gancio n° 10 con nuovo certificato' }
      ],
      onSalva: async (v) => {
        const d = copia(i); d.storico = d.storico || [];
        if (e) Object.assign(d.storico.find((x) => x.id === e.id), v);
        else d.storico.push({ id: uid(), ...v });
        await salva(d); UI.toast('Storico aggiornato', 'ok');
      },
      onElimina: e ? async () => {
        if (!UI.conferma('Eliminare questa voce dallo storico?')) return false;
        const d = copia(i); d.storico = d.storico.filter((x) => x.id !== e.id); await salva(d);
      } : null,
      testoElimina: 'Elimina voce'
    });
  }

  // ---------- STAMPA: riepilogo di tutto l'impianto (A4 verticale) ----------
  function stampa(el, S, id) {
    const i = S.impianti.find((x) => x.id === id);
    if (!i) { el.innerHTML = '<p class="nessuno">Impianto non trovato.</p>'; return { titolo: 'Stampa', indietro: '#/impianti' }; }
    const c = S.clienti.find((x) => x.id === i.clienteId), s = (c?.sedi || []).find((x) => x.id === i.sedeId);
    const paranchi = i.paranchi?.length ? i.paranchi : [{ ruolo: 'Primario' }];
    const M = MIMP.di(S, i);
    const nessuno = '<p class="r-vuoto">Dati non inseriti</p>';
    // tabella etichetta/valore su 3 colonne, solo campi compilati
    const tab = (schema, o) => {
      const r = schema.filter((f) => f.k && f.tipo !== 'sino' && !f.k.startsWith('freno') && pieno(o?.[f.k]))
        .map((f) => `<div class="r-c"><span>${esc(f.label)}</span><b>${valore(f, o[f.k])}</b></div>`);
      return r.length ? `<div class="r-griglia">${r.join('')}</div>` : nessuno;
    };
    const motore = (m) => {
      if (!m || !Object.values(m).some(pieno)) return nessuno;
      const fr = m.frenoPresente ? [m.frenoTipo, m.frenoTensione && m.frenoTensione + ' V', m.frenoCoppia && m.frenoCoppia + ' Nm', m.frenoNote].filter(Boolean).map(esc).join(' · ') || 'presente' : 'non indicato';
      return tab(F_MOTORE, m) + `<div class="r-freno"><span>Freno</span> ${fr}</div>`;
    };
    const blocco = (titolo, corpo) => `<div class="r-blocco"><h3>${titolo}</h3>${corpo}</div>`;
    const sezione = (titolo, corpo) => `<section class="r-sez"><h2>${titolo}</h2>${corpo}</section>`;
    const piu = paranchi.length > 1;
    const storico = (i.storico || []).slice().sort((a, b) => (b.data || '').localeCompare(a.data || ''));

    const doc = `
      <article class="recap">
        <header class="r-head">
          <img src="img/logo-grande.png" alt="">
          <div class="grow">
            <h1>Scheda impianto</h1>
            <p>${i.numeroInterno ? `N° ${esc(i.numeroInterno)} · ` : ''}${esc(IMP.titolo(i))}${i.matricola ? ' · Matr. ' + esc(i.matricola) : ''}</p>
          </div>
          <div class="r-cli"><b>${esc(c ? CLI.nomeAl(c, UI.oggi(), s) : '')}</b><span>${esc(IMP.nomeSede(s))}</span>
            <span>${esc(s ? CLI.indirizzo(s) : '')}</span><small>Stampato il ${fmt(oggi())}</small></div>
        </header>

        ${sezione('Dati dell\'impianto', `
          <div class="r-griglia">
            ${[['Tipo di impianto', M.nome], ['Tipologia', i.tipologia], ['Marca', i.marca], ['Anno di costruzione', i.annoCostruzione], ['Matricola', i.matricola],
              ['Numero di serie', i.numeroSerie], ['Numero interno', i.numeroInterno], ...(M.scartamento ? [['Scartamento (luce)', i.scartamento && i.scartamento + ' mm']] : []),
              ...(M.gru ? paranchi.map((p, n) => ['Portata ' + RUOLO(p, n).replace('Paranco ', 'paranco '), kg(p.portata)]) : [])]
              .map(([l, v]) => `<div class="r-c"><span>${l}</span><b>${v ? esc(v) : '—'}</b></div>`).join('')}
          </div>`)}

        ${!M.gru ? '' : paranchi.map((p, n) => sezione('Sollevamento' + (piu ? ' – ' + esc(RUOLO(p, n)) : ''),
          blocco('Dati di sollevamento', tab(F_SOLL, p)) + blocco('Fune', tab(F_FUNE, p.fune)) +
          blocco('Motore di sollevamento', motore(p.motore)) +
          (p.motoreAux ? blocco('Motore di sollevamento ausiliario', motore(p.motoreAux)) : ''))).join('')}

        ${!M.gru ? '' : paranchi.map((p, n) => sezione('Carrello' + (piu ? ' – ' + esc(RUOLO(p, n)) : ''),
          blocco('Dati del carrello', tab(F_CARR, p.carrello)) + blocco('Motore di traslazione carrello', motore(p.carrello?.motore)))).join('')}

        ${!M.ponte ? '' : sezione('Ponte', blocco('Dati del ponte', tab(F_PONTE, i.ponte)) +
          blocco('Motore di traslazione ponte' + (i.ponte?.numeroMotori > 1 ? ` (${esc(i.ponte.numeroMotori)} uguali)` : ''), motore(i.ponte?.motore)))}

        ${M.sezioni.map((x) => { const r = MIMP.righe(x, i.dati?.[x.id]);
          return sezione(esc(x.titolo), r.length ? `<div class="r-griglia">${r.map(([l, v]) => `<div class="r-c"><span>${esc(l)}</span><b>${v}</b></div>`).join('')}</div>` : nessuno); }).join('')}

        ${M.elettrico ? sezione('Impianto elettrico e bordo gru', tab(F_ELE, i.elettrico)) : ''}

        ${sezione('Documenti allegati', (i.allegati || []).length
          ? `<ul class="r-lista">${i.allegati.map((a) => `<li><b>${esc(a.tipo)}</b> – ${esc(a.nome)} (${fmt(a.data)})</li>`).join('')}</ul>` : '<p class="r-vuoto">Nessun documento</p>')}

        ${sezione('Storico sostituzioni e interventi', storico.length ? `
          <table class="r-tab"><thead><tr><th>Data</th><th>Componente</th><th>Descrizione</th><th>Tecnico</th></tr></thead>
            <tbody>${storico.map((e) => `<tr><td>${fmt(e.data)}</td><td><b>${esc(e.componente)}</b></td>
              <td>${esc(e.note || '')}${diff(e).replace('<ul class="diff">', '<ul class="r-diff">')}</td><td>${esc(e.tecnico || '')}</td></tr>`).join('')}</tbody></table>`
          : '<p class="r-vuoto">Nessuna sostituzione registrata</p>')}
      </article>`;

    el.innerHTML = `
      <section class="stampa-recap">
        <div class="azioni-lista no-print">
          <button class="btn" id="btnStampa">🖨️ Stampa / salva PDF</button>
          <a class="btn ghost" href="#/impianti/i/${i.id}">Torna alla scheda</a>
          ${info('Nella finestra di stampa scegli la stampante oppure «Salva come PDF», formato A4 verticale. Vengono stampati solo i dati compilati.')}
        </div>
        <div class="recap-wrap">${doc}</div>
      </section>`;
    el.querySelector('#btnStampa').onclick = () => {
      const t = document.title;
      document.title = `Scheda_impianto_${(c ? CLI.nome(c) : '')}_${i.numeroInterno || i.matricola || ''}_${IMP.titolo(i)}`.replace(/[^\w\-]+/g, '_').replace(/_+/g, '_');
      window.print(); setTimeout(() => (document.title = t), 1000);
    };
    return { titolo: 'Stampa · ' + IMP.titolo(i), indietro: '#/impianti/i/' + i.id, live: true };
  }

  return { render, stampa };
})();
