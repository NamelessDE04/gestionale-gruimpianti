// ===== MODULO: CONTROLLO CARRIPONTE E GRU A BANDIERA =====
// - Modelli di scheda: un elenco di voci, ognuna con la sua periodicità (TRIM / SEME / ANN).
// - Piano controlli per SEDE: mese del 1° controllo e quale dei 4 è l'annuale.
//   Annuale = tutte le voci · Semestrale (2 controlli dopo l'annuale) = TRIM + SEME · gli altri = solo TRIM.
// - Una scheda per impianto e per anno, con 4 visite; ogni voce ha un esito per ogni paranco (P1, P2).
// - Le osservazioni (A, B, C…) restano tutto l'anno finché non vengono segnate come sistemate.
window.CTR = (function () {
  const { esc, uid, info, fmt, oggi, iso } = UI;

  const PER = { T: 'TRIM', S: 'SEME', A: 'ANN' };
  const PER_NOME = { T: 'Trimestrale', S: 'Semestrale', A: 'Annuale' };
  const CODICI = [['X', 'esame visivo funzionale'], ['R', 'ripristinato'], ['P', 'pulito'], ['L', 'lubrificato'], ['S', 'sostituito']];
  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

  const V = (per, testo, unita) => ({ id: uid(), per, testo, tipo: 'codice', ...(unita != null ? { valore: true, unita } : {}) });
  // CAMPO VALORE: oltre al codice (X, R, P…) la voce ha una casella per scrivere un valore (es. diametro in mm).
  // Il valore è facoltativo: se non lo prendi, basta il codice. Le voci "misura" delle versioni vecchie valgono come valore in mm.
  const UNITA = ['mm', 'cm', 'kg', 't', '%', 'bar', '°C', 'V', 'A', 'nessuna'];
  const haValore = (v) => !!(v && (v.valore || v.tipo === 'misura'));
  const unitaDi = (v) => { const u = v?.unita != null ? v.unita : (v?.tipo === 'misura' ? 'mm' : ''); return u === 'nessuna' ? '' : u; };
  const isCodice = (x) => CODICI.some(([k]) => k === x);
  const isLett = (x) => /^[A-Z]{1,2}$/.test(x || '') && !isCodice(x);
  // schede salvate con la vecchia "misura": il numero era nell'esito -> lo sposto nei valori e l'esito diventa X
  function leggiVisita(vis, voci) {
    if (!vis) return vis;
    vis.valori = vis.valori || {};
    voci.forEach((v) => {
      const es = vis.esiti?.[v.id]; if (!es || !haValore(v)) return;
      es.forEach((x, k) => { if (x && !isCodice(x) && !isLett(x)) { (vis.valori[v.id] = vis.valori[v.id] || [])[k] = x; es[k] = 'X'; } });
    });
    return vis;
  }
  const VOCI_CARROPONTE = () => [
    V('T', 'FUNE DI SOLLEVAMENTO'), V('T', 'ESITO ELASTICITÀ'), V('T', 'MISURA DIAMETRO', 'mm'), V('T', 'INTEGRITÀ GANCIO SICUREZZA'),
    V('T', 'FRENO SOLLEVAMENTO'), V('T', 'FRENO SOLLEVAMENTO AUX'), V('T', 'FRENO PONTE'), V('T', 'FRENO CARRO'),
    V('T', 'FINECORSA SOLLEVAMENTO'), V('T', 'FINECORSA PONTE'), V('T', 'FINECORSA CARRO'), V('T', 'PULSANTIERA DI COMANDO'),
    V('T', 'SEGNALAZIONE ACUSTICO - LUMINOSO'),
    V('S', 'CARRUCOLE DI RINVIO E TAMBURO'), V('S', 'CAPOFISSO'), V('S', 'COMPONENTI QUADRO ELETTRICO'), V('S', 'IMPIANTO ELETTRICO BORDO GRU'), V('S', 'ANTINGOMBRO'),
    V('A', 'LIMITATORE DI CARICO'), V('A', 'RESPINGENTI'), V('A', 'ELEMENTI STRUTTURALI E GIUNZIONI'), V('A', 'RUOTE - ROTAIE E VIE DI CORSA'),
    V('A', 'CARTELLONISTICA'), V('A', 'LIVELLO - PERDITE OLIO'), V('A', "MOTORI - GIUNTI - RUMOROSITA'"), V('A', 'CARRELLINO ALIMENTAZIONE')
  ];
  const MODELLI_BASE = () => [
    { id: 'carroponte', nome: 'Carroponte', voci: VOCI_CARROPONTE() },
    { id: 'bandiera', nome: 'Gru a bandiera', voci: VOCI_CARROPONTE().filter((v) => !/PONTE/.test(v.testo)) }
  ];

  // ---------- dati ----------
  const modelli = (S) => (S.impostazioni.find((x) => x.id === 'modelliScheda') || {}).modelli || null;
  async function assicuraModelli(S) {
    if (modelli(S)) return modelli(S);
    const m = MODELLI_BASE();
    await UI.salva('impostazioni', { id: 'modelliScheda', modelli: m });
    S.impostazioni = [...S.impostazioni.filter((x) => x.id !== 'modelliScheda'), { id: 'modelliScheda', modelli: m }];
    return m;
  }
  // nuovo modello di scheda dalle voci date (es. quelle di una scheda importata); stesso nome = non si duplica
  async function aggiungiModello(S, nome, voci) {
    const ms = JSON.parse(JSON.stringify(await assicuraModelli(S)));
    nome = String(nome || '').trim(); if (!nome) return null;
    if (ms.some((m) => m.nome.toLowerCase() === nome.toLowerCase())) return false;
    const m = { id: uid(), nome, voci: voci.map((v) => ({ id: uid(), per: v.per || 'T', testo: String(v.testo || '').toUpperCase(), tipo: 'codice', ...(v.valore || v.tipo === 'misura' ? { valore: true, unita: v.unita || 'mm' } : {}) })) };
    ms.push(m); await UI.salva('impostazioni', { id: 'modelliScheda', modelli: ms });
    S.impostazioni = [...S.impostazioni.filter((x) => x.id !== 'modelliScheda'), { id: 'modelliScheda', modelli: ms }];
    return m;
  }
  const modelloDi = (S, imp) => {
    const ms = modelli(S) || MODELLI_BASE();
    return ms.find((m) => m.id === imp.controllo?.modelloId) || ms.find((m) => m.id === (/bandiera/i.test(imp.tipologia || '') ? 'bandiera' : 'carroponte')) || ms[0];
  };
  const vociPerImpianto = (S, imp) => modelloDi(S, imp).voci.filter((v) => !(imp.controllo?.escluse || []).includes(v.id));

  const trovaSede = (S, sedeId) => { for (const c of S.clienti) { const s = (c.sedi || []).find((x) => x.id === sedeId); if (s) return { c, s }; } return {}; };
  const piano = (sede) => ({ mese1: 1, annuale: 1, impostato: false, ...(sede?.pianoControlli || {}), ...(sede?.pianoControlli ? { impostato: true } : {}) });
  const meseVisita = (p, n) => ((p.mese1 - 1 + 3 * (n - 1)) % 12) + 1;           // 1..12
  const tipoVisita = (p, n) => (n === p.annuale ? 'A' : n === ((p.annuale + 1) % 4) + 1 ? 'S' : 'T');
  const periodiDi = (t) => ({ A: ['T', 'S', 'A'], S: ['T', 'S'], T: ['T'] }[t]);
  const nomeTipo = (t) => ({ A: 'Annuale', S: 'Semestrale', T: 'Trimestrale' }[t]);
  const fineMese = (anno, m) => iso(new Date(anno, m, 0));

  // gli impianti fuori servizio definitivo (dismesso) non si controllano più: restano solo negli anni in cui hanno una scheda
  const impiantiSede = (S, sedeId, anno) => S.impianti.filter((i) => i.sedeId === sedeId && (!i.dismesso || (anno && schedaDi(S, i.id, anno))))
    .sort((a, b) => (a.numeroInterno || '~').localeCompare(b.numeroInterno || '~', 'it', { numeric: true }));
  const schedaDi = (S, impId, anno) => S.schedeControllo.find((x) => x.impiantoId === impId && x.anno === anno);
  const nParanchi = (imp) => Math.max(1, (imp.paranchi || []).length);
  // scheda nuova di un anno: dall'anno prima si portano le osservazioni NON chiuse (stessa lettera) e le note Gru Impianti
  function nuovaScheda(S, i, anno) {
    const voci = vociPerImpianto(S, i).map((v) => ({ ...v }));
    const prima = schedaDi(S, i.id, anno - 1);
    const nv = (t) => String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    // voce dell'osservazione nella scheda nuova; se nel modello non c'è (es. NOTE GENERALI) la porto con me
    const vocDi = (id) => {
      if (!id) return ''; if (voci.some((v) => v.id === id)) return id;
      const pv = (prima.voci || []).find((v) => v.id === id); if (!pv) return '';
      const m = voci.find((v) => nv(v.testo) === nv(pv.testo)); if (m) return m.id;
      if (nv(pv.testo) === 'NOTEGENERALI') voci.unshift({ ...pv }); else voci.push({ ...pv });
      return pv.id;
    };
    const osservazioni = prima ? (prima.osservazioni || []).filter((o) => !o.risoltaIl).map((o) => ({ ...o, vocId: vocDi(o.vocId), visita: 0, daAnno: o.daAnno || anno - 1 })) : [];
    return { id: i.id + '-' + anno, impiantoId: i.id, sedeId: i.sedeId, clienteId: i.clienteId, anno, voci, visite: {}, osservazioni, ...(prima?.noteInterne ? { noteInterne: prima.noteInterne } : {}) };
  }

  // un controllo salvato da solo (uscendo a metà) resta «in corso» finché non lo salvi tu
  const fatta = (v) => !!v && !v.inCorso;
  // stato di una visita per la sede: fatta se tutti gli impianti l'hanno
  function statoVisite(S, sedeId, anno) {
    const imp = impiantiSede(S, sedeId, anno).filter((i) => !i.dismesso);   // i fuori servizio definitivo non contano più
    return [1, 2, 3, 4].map((n) => {
      const fatti = imp.filter((i) => fatta(schedaDi(S, i.id, anno)?.visite?.[n])).length;
      return { n, fatti, tot: imp.length, completa: imp.length > 0 && fatti === imp.length };
    });
  }
  function prossima(S, sedeId, anno) {
    const { s } = trovaSede(S, sedeId); const p = piano(s);
    const st = statoVisite(S, sedeId, anno);
    const v = st.find((x) => !x.completa);
    if (!v) return null;
    const m = meseVisita(p, v.n), fine = fineMese(anno, m), oggiS = oggi();
    const k = oggiS > fine ? 'scaduto' : oggiS.slice(0, 7) === fine.slice(0, 7) ? 'scadenza' : 'ok';
    return { ...v, mese: m, tipo: tipoVisita(p, v.n), k, label: k === 'scaduto' ? `${v.n}° controllo in ritardo (${MESI[m - 1]})` : k === 'scadenza' ? `${v.n}° controllo da fare in ${MESI[m - 1]}` : `Prossimo: ${v.n}° a ${MESI[m - 1]}` };
  }
  const sediConImpianti = (S) => S.clienti.flatMap((c) => (c.sedi || []).filter((s) => S.impianti.some((i) => i.sedeId === s.id && !i.dismesso)).map((s) => ({ c, s })))
    .sort((a, b) => (CLI.nome(a.c) + a.s.nome).localeCompare(CLI.nome(b.c) + b.s.nome));
  const nomeSede = (c, s) => `${CLI.nome(c)} · ${s.sigla ? s.sigla + ' · ' : ''}${s.nome || s.citta}`;
  const annoOggi = () => +oggi().slice(0, 4);
  let annoScelto = annoOggi();

  const slotHtml = (p, n, st, anno, href) => {
    const t = tipoVisita(p, n);
    return `<a class="slot-c ${st.completa ? 'fatto' : ''} t-${t}" href="${href || 'javascript:void(0)'}">
      <span class="sc-n">${n}° · ${MESI[meseVisita(p, n) - 1]}</span><b>${nomeTipo(t)}</b>
      <span class="sc-st">${st.tot ? (st.completa ? '✓ completato' : `${st.fatti}/${st.tot} impianti`) : ''}</span></a>`;
  };

  // ---------- 1. ELENCO SEDI ----------
  const FILTRO = { q: '' };
  const testoSede = (c, s) => [CLI.nome(c), ...(CLI.exNomi ? CLI.exNomi(c) : []), s.nome, s.citta, s.sigla, s.indirizzo].join(' ').toLowerCase();
  function sedi(el, S) {
    const tutte = sediConImpianti(S); const anno = annoOggi();
    const q = FILTRO.q.trim().toLowerCase();
    const lista = tutte.filter(({ c, s }) => !q || testoSede(c, s).includes(q));
    el.innerHTML = `
      <section class="sg">
        <div class="sez-head">
          <h1>Controllo carriponte e gru a bandiera ${info('Qui trovi le sedi che hanno impianti. Ogni sede ha il suo piano dei controlli (in che mese si parte e quale controllo è l\'annuale). Le voci da controllare stanno nei «Modelli di scheda», uguali per tutti gli impianti dello stesso tipo.')}</h1>
          ${UT.solaLettura() ? '' : '<a class="btn ghost small" href="#/controlli/modelli">⚙ Modelli di scheda</a>'}
        </div>
        ${tutte.length ? `<input type="search" id="fCerca" class="cerca" placeholder="Cerca cliente, sede, città o sigla…" value="${esc(FILTRO.q)}" autocomplete="off">` : ''}
        ${tutte.length ? (lista.length ? '' : '<p class="nessuno">Nessuna sede trovata.</p>') : `<p class="nessuno">Nessun impianto inserito. Aggiungi prima gli impianti in <a class="link" href="#/impianti">Anagrafica impianti</a>.</p>`}
        <div class="cartelle">
          ${lista.map(({ c, s }) => {
            const p = piano(s), st = statoVisite(S, s.id, anno), pr = prossima(S, s.id, anno);
            return `<a class="cartella" href="#/controlli/s/${s.id}">
              <div class="cartella-ico">${CLI.avatar(c, true)}</div>
              <div class="cartella-txt">
                <h2>${UI.magnete(s)} ${esc(CLI.nome(c))}</h2>
                <p class="loc">${esc(s.nome || s.citta)}</p>
                <p class="muted small">${impiantiSede(S, s.id).length} impianti · ${p.impostato ? `annuale a ${MESI[meseVisita(p, p.annuale) - 1]}` : 'piano da impostare'}</p>
                <div class="fascette">${st.map((x) => `<span class="fasc ${x.completa ? 'fatto' : ''} t-${tipoVisita(p, x.n)}" title="${nomeTipo(tipoVisita(p, x.n))}">${MESI[meseVisita(p, x.n) - 1].slice(0, 3)}</span>`).join('')}</div>
                <div class="cartella-st">${pr ? `<span class="pill st-${pr.k}">${esc(pr.label)}</span>` : '<span class="pill st-ok">Anno completato</span>'}</div>
              </div></a>`;
          }).join('')}
        </div>
      </section>`;
    const ft = el.querySelector('#fCerca');
    ft && (ft.oninput = () => { FILTRO.q = ft.value; const pos = ft.selectionStart; App.ridisegna(); const n = document.getElementById('fCerca'); n.focus(); n.setSelectionRange(pos, pos); });
    return { titolo: 'Controllo carriponte e gru a bandiera', indietro: '#/schede', live: true };
  }

  // ---------- 2. SEDE: piano, visite, impianti ----------
  function sede(el, S, sedeId, query) {
    const { c, s } = trovaSede(S, sedeId);
    if (!s) { el.innerHTML = '<p class="nessuno">Sede non trovata.</p>'; return { titolo: 'Controlli', indietro: '#/controlli' }; }
    if (query.get('anno')) annoScelto = +query.get('anno');
    const anno = annoScelto, p = piano(s), st = statoVisite(S, sedeId, anno), imp = impiantiSede(S, sedeId, anno);
    const pr = prossima(S, sedeId, anno);
    const corr = pr && pr.n;   // il prossimo controllo da fare
    el.innerHTML = `
      <section class="sg ctr">
        <div class="card ctr-testa">
          <div class="grow">
            <h1><a class="link-anag" href="#/clienti/${c.id}">${esc(CLI.nome(c))} <span class="loc">${esc(s.nome || '')}</span></a> ${UI.magnete(s)}</h1>
            <p class="muted small">${imp.filter((i) => !i.dismesso).length} impianti · ${pr ? `<span class="pill st-${pr.k}">${esc(pr.label)}</span>` : '<span class="pill st-ok">Anno completato</span>'}</p>
          </div>
          <div class="anno anno-mini"><a href="#/controlli/s/${sedeId}?anno=${anno - 1}" aria-label="Anno prima">‹</a><b>${anno}</b><a href="#/controlli/s/${sedeId}?anno=${anno + 1}" aria-label="Anno dopo">›</a></div>
          ${UI.menu([
            { t: '📅 Piano controlli', id: 'btnPiano' },
            imp.length && UT.puoInviare() && { t: `🖨️ Stampa tutte le schede ${anno}`, href: `#/controlli/s/${sedeId}/${anno}/stampa` },
            { t: '🏢 Anagrafica cliente', href: `#/clienti/${c.id}` }
          ])}
        </div>
        ${p.impostato ? '' : `<div class="avviso avviso-mini">Piano dei controlli non impostato (ora: 1° a gennaio, annuale il 1°). <button class="link" id="btnPiano2">Imposta</button></div>`}
        <div class="striscia">${st.map((x) => { const t = tipoVisita(p, x.n);
          return `<a class="st-v t-${t} ${x.completa ? 'fatto' : ''} ${x.n === corr ? 'corrente' : ''}" title="${nomeTipo(t)}" href="#/controlli/s/${sedeId}/giro/${anno}/${x.n}"><b>${x.n}° ${MESI[meseVisita(p, x.n) - 1].slice(0, 3)}</b><span>${t === 'T' ? 'TRIM' : t === 'S' ? 'SEME' : 'ANN'} · ${x.completa ? '✓' : `${x.fatti}/${x.tot}`}</span></a>`; }).join('')}</div>
        ${corr && imp.length && !UT.solaLettura() ? (() => { const x = st[corr - 1], t = tipoVisita(p, corr), via = x.fatti || imp.some((i) => schedaDi(S, i.id, anno)?.visite?.[corr]);
          return `<a class="ctr-inizia t-${t}" href="#/controlli/s/${sedeId}/giro/${anno}/${corr}">▶ ${via ? 'Continua' : 'Inizia'} il ${corr}° controllo<small>${nomeTipo(t)} · ${MESI[meseVisita(p, corr) - 1]} ${anno}${via ? ` · ${x.fatti}/${x.tot} gru fatte` : ` · ${x.tot} gru`}</small></a>`; })() : ''}
        <div class="elenco">
          ${imp.map((i) => {
            const sc = schedaDi(S, i.id, anno), aperteN = (sc?.osservazioni || []).filter((o) => !o.risoltaIl).length;
            return `<div class="riga imp-riga ${i.dismesso ? 'dismesso' : ''}">
              <a class="imp-link" href="#/controlli/i/${i.id}?anno=${anno}">
                <span class="imp-ico">${IMP.icona(i.tipologia)}</span>
                <div class="riga-main">
                  <div class="riga-top">${i.numeroInterno ? `<b>N° ${esc(i.numeroInterno)}</b> · ` : ''}${esc(IMP.titolo(i))}</div>
                  <div class="muted small">${i.matricola ? 'Matr. ' + esc(i.matricola) : ''}${aperteN ? ` · <b class="txt-ko">${aperteN} oss. aperte</b>` : ''}${IMP.pillStato(i)}</div>
                </div>
              </a>
              <div class="visite-mini">${[1, 2, 3, 4].map((n) => i.dismesso && !sc?.visite?.[n] ? '<span class="vm vm-vuoto">–</span>' : `<a class="vm ${fatta(sc?.visite?.[n]) ? 'fatto' : sc?.visite?.[n] ? 'incorso' : ''} ${n === corr && !fatta(sc?.visite?.[n]) ? 'corrente' : ''} t-${tipoVisita(p, n)}" href="#/controlli/i/${i.id}/${anno}/${n}" title="${n}° controllo${sc?.visite?.[n]?.inCorso ? ' (in corso)' : ''}">${fatta(sc?.visite?.[n]) ? '✓' : sc?.visite?.[n] ? '⏸' : n}</a>`).join('')}</div>
            </div>`;
          }).join('')}
        </div>
        <p class="muted small centro">Con «Inizia» vedi solo le gru da controllare, con la ricerca. Puoi anche toccare il numero del controllo di una gru, oppure l'impianto per la sua scheda dell'anno.</p>
      </section>`;
    const apriPiano = () => modalePiano(S, c, s);
    el.querySelector('#btnPiano').onclick = apriPiano;
    el.querySelector('#btnPiano2')?.addEventListener('click', apriPiano);
    return { titolo: 'Controlli · ' + nomeSede(c, s), indietro: '#/controlli', live: true };
  }

  // ---------- 2b. GIRO: le gru di un controllo, da fare sopra e fatte sotto, con ricerca ----------
  let cercaGiro = { k: '', q: '' };
  function giroSede(el, S, sedeId, anno, n) {
    const { c, s } = trovaSede(S, sedeId);
    if (!s || !(n >= 1 && n <= 4)) { el.innerHTML = '<p class="nessuno">Controllo non trovato.</p>'; return { titolo: 'Controlli', indietro: '#/controlli' }; }
    const p = piano(s), t = tipoVisita(p, n);
    const chiave = `${sedeId}|${anno}|${n}`; if (cercaGiro.k !== chiave) cercaGiro = { k: chiave, q: '' };
    const imp = impiantiSede(S, sedeId, anno).filter((i) => !i.dismesso);
    const vis = (i) => schedaDi(S, i.id, anno)?.visite?.[n];
    const daFare = imp.filter((i) => !fatta(vis(i))), fatte = imp.filter((i) => fatta(vis(i)));
    const qui = `#/controlli/s/${sedeId}/giro/${anno}/${n}`;
    const testo = (i) => [i.numeroInterno, IMP.titolo(i), i.tipologia, i.matricola, i.ubicazione, i.reparto, i.costruttore].filter(Boolean).join(' ').toLowerCase();
    const riga = (i) => {
      const sc = schedaDi(S, i.id, anno), v = vis(i), aperteN = (sc?.osservazioni || []).filter((o) => !o.risoltaIl).length;
      return `<a class="riga imp-riga giro-gru ${fatta(v) ? 'fatta' : ''}" href="#/controlli/i/${i.id}/${anno}/${n}?torna=${encodeURIComponent(qui)}" data-t="${esc(testo(i))}">
        <span class="imp-ico">${IMP.icona(i.tipologia)}</span>
        <div class="riga-main">
          <div class="riga-top">${i.numeroInterno ? `<b>N° ${esc(i.numeroInterno)}</b> · ` : ''}${esc(IMP.titolo(i))}</div>
          <div class="muted small">${[i.matricola && 'Matr. ' + esc(i.matricola), aperteN && `<b class="txt-ko">${aperteN} oss. aperte</b>`].filter(Boolean).join(' · ')}${IMP.pillStato(i)}</div>
        </div>
        ${fatta(v) ? `<span class="giro-st ok">✓ ${esc(fmt(v.dataScheda).replace(/\/\d+$/, ''))}</span>` : v ? '<span class="giro-st incorso">⏸ in corso</span>' : '<span class="giro-st">›</span>'}
      </a>`;
    };
    el.innerHTML = `
      <section class="sg ctr ctr-giro">
        <div class="card vis-testa t-${t}">
          <div class="grow"><b>${n}° controllo ${anno} · ${nomeTipo(t)}</b> <span>${MESI[meseVisita(p, n) - 1]}</span>
            <div class="vis-imp">${esc(nomeSede(c, s))}</div></div>
          ${info('Qui ci sono solo le gru di questo controllo. Cerca per numero interno, nome, tipo o matricola e tocca la gru per compilarla. Quando torni indietro o passi alla gru dopo, quello che hai fatto si salva da solo: se mancano voci la gru resta qui sopra «⏸ in corso». Con «Salva» nella gru la chiudi e va in fondo, tra quelle già controllate.')}
        </div>
        <div class="sg2-barra"><input type="search" id="gCercaGru" class="cerca" placeholder="🔍 Cerca n° interno o nome" autocomplete="off" value="${esc(cercaGiro.q)}"></div>
        <div class="elenco" id="gruDaFare">${daFare.map(riga).join('') || '<p class="sg2-finito">✓ Tutte le gru di questo controllo sono fatte</p>'}</div>
        <p class="nessuno" id="gruNessuna" hidden>Nessuna gru trovata.</p>
        ${fatte.length ? `<div class="sg2-tit" id="gruTitFatte">✓ Già controllate (${fatte.length})</div><div class="elenco" id="gruFatte">${fatte.map(riga).join('')}</div>` : ''}
        <div class="sg2-azz"><a class="link" href="#/controlli/s/${sedeId}?anno=${anno}">📋 Tutta la sede</a></div>
        <div class="sg2-piede">
          <b>${fatte.length}/${imp.length}</b><div class="bar"><i style="width:${imp.length ? fatte.length / imp.length * 100 : 0}%"></i></div>
          <span class="muted small">gru fatte</span>
        </div>
      </section>`;
    const cerca = el.querySelector('#gCercaGru');
    const filtra = () => {
      const q = cerca.value.trim().toLowerCase(); cercaGiro.q = cerca.value; let k = 0;
      el.querySelectorAll('.giro-gru').forEach((r) => { const ok = !q || r.dataset.t.includes(q) || r.dataset.t.split(' ').some((w) => w.replace(/^0+/, '') === q.replace(/^0+/, '')); r.hidden = !ok; if (ok) k++; });
      el.querySelector('#gruNessuna').hidden = !!k || !q;
      const tf = el.querySelector('#gruTitFatte'); if (tf) tf.hidden = !el.querySelector('#gruFatte .giro-gru:not([hidden])');
    };
    // aprendo una gru la ricerca si svuota: al ritorno scrivi subito il numero della prossima
    el.querySelectorAll('.giro-gru').forEach((r) => r.addEventListener('click', () => (cercaGiro.q = '')));
    cerca.oninput = filtra; cerca.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); const r = el.querySelector('.giro-gru:not([hidden])'); if (r) { cercaGiro.q = ''; location.hash = r.getAttribute('href'); } } };
    filtra();
    return { titolo: `${n}° controllo · ${nomeSede(c, s)}`, indietro: '#/controlli/s/' + sedeId + '?anno=' + anno, live: true };
  }

  function modalePiano(S, c, s) {
    const p = piano(s);
    UI.modal({
      titolo: 'Piano controlli · ' + (s.nome || ''),
      infoTxt: 'I 4 controlli sono a 3 mesi di distanza. L\'annuale comprende tutte le voci; due controlli dopo c\'è il semestrale (voci TRIM + SEME); gli altri due sono solo trimestrali.',
      valori: { mese1: MESI[p.mese1 - 1], annuale: p.annuale + '°', tutte: false },
      campi: [
        { k: 'mese1', label: 'Mese del 1° controllo dell\'anno', tipo: 'select', opzioni: MESI.slice(0, 3), mezza: true },
        { k: 'annuale', label: 'Il controllo annuale è il', tipo: 'select', opzioni: ['1°', '2°', '3°', '4°'], mezza: true },
        ...((c.sedi || []).length > 1 ? [{ k: 'tutte', label: `Applica lo stesso piano a tutte le sedi di ${CLI.nome(c)}`, tipo: 'sino' }] : [])
      ],
      onSalva: async (v) => {
        const pc = { mese1: Math.max(1, MESI.indexOf(v.mese1) + 1), annuale: parseInt(v.annuale, 10) || 1 };
        const d = JSON.parse(JSON.stringify(c));
        d.sedi.forEach((x) => { if (x.id === s.id || v.tutte) x.pianoControlli = pc; });
        await UI.salva('clienti', d); UI.toast('Piano salvato', 'ok');
      }
    });
  }

  // ---------- 3. SCHEDA ANNUALE DI UN IMPIANTO ----------
  function impianto(el, S, impId, query) {
    const i = S.impianti.find((x) => x.id === impId);
    if (!i) { el.innerHTML = '<p class="nessuno">Impianto non trovato.</p>'; return { titolo: 'Controlli', indietro: '#/controlli' }; }
    if (query.get('anno')) annoScelto = +query.get('anno');
    const anno = annoScelto;
    const { c, s } = trovaSede(S, i.sedeId); const p = piano(s);
    const sc = schedaDi(S, impId, anno);
    const scV = sc || nuovaScheda(S, i, anno);   // anno senza controlli: si vedono già le osservazioni e le note portate dall'anno prima
    const voci = scV.voci;
    const np = nParanchi(i);
    const oss = scV.osservazioni || [];
    // voci dovute e lasciate vuote (in app restano vuote; sulla scheda del cliente escono con X)
    const nonFatte = (n) => { const vis = sc?.visite?.[n]; if (!vis) return 0; const per = periodiDi(tipoVisita(p, n));
      return voci.filter((v) => per.includes(v.per) && !noteGen(v)).reduce((t, v) => t + Array.from({ length: np }, (_, k) => (vis.esiti?.[v.id] || [])[k]).filter((x) => !x).length, 0); };
    el.innerHTML = `
      <section class="sg ctr">
        <div class="card ctr-testa">
          <span class="imp-ico">${IMP.icona(i.tipologia)}</span>
          <div class="grow">
            <h1>${i.numeroInterno ? `N° ${esc(i.numeroInterno)} · ` : ''}${esc(IMP.titolo(i))}</h1>
            <p class="muted small"><a class="link-anag" href="#/controlli/s/${i.sedeId}?anno=${anno}">${esc(c ? nomeSede(c, s) : '')}</a>${i.matricola ? ' · matr. ' + esc(i.matricola) : ''}</p>
          </div>
          <div class="anno anno-mini"><a href="#/controlli/i/${impId}?anno=${anno - 1}" aria-label="Anno prima">‹</a><b>${anno}</b><a href="#/controlli/i/${impId}?anno=${anno + 1}" aria-label="Anno dopo">›</a></div>
          ${UI.menu([
            UT.puoInviare() && { t: `🖨️ Stampa scheda ${anno}`, href: `#/controlli/i/${impId}/${anno}/stampa` },
            !UT.solaLettura() && { t: '⚙ Voci di questo impianto', id: 'btnVoci' },
            UT.isMaster() && sc && { t: '💾 Salva queste voci come modello', id: 'btnComeModello' },
            { t: '🏗️ Anagrafica impianto', href: `#/impianti/i/${impId}` }
          ])}
        </div>
        <div class="striscia">${[1, 2, 3, 4].map((n) => { const vis = sc?.visite?.[n], t = tipoVisita(p, n), nf = nonFatte(n);
          return `<a class="st-v t-${t} ${vis ? 'fatto' : ''}" href="#/controlli/i/${impId}/${anno}/${n}" title="${nomeTipo(t)}${vis?.tecnico ? ' · ' + esc(vis.tecnico) : ''}"><b>${n}° ${MESI[meseVisita(p, n) - 1].slice(0, 3)}</b><span>${vis ? '✓ ' + fmt(vis.dataScheda).slice(0, 5) : (t === 'T' ? 'TRIM' : t === 'S' ? 'SEME' : 'ANN')}${nf ? ` · <b class="txt-ko">${nf}✗</b>` : ''}</span></a>`; }).join('')}</div>
        <div class="card">
          <div class="card-head"><h2>Osservazioni ${anno} ${info('Le osservazioni restano sulla scheda per tutto l\'anno. Quando un problema viene risolto, segnalo come sistemato: sulla scheda comparirà con [OK e la data].')}</h2></div>
          ${oss.length ? oss.map((o) => `<div class="oss-riga ${o.risoltaIl ? 'risolta' : ''}"><b class="oss-l">${esc(o.lettera)}</b>
              <div class="grow">${esc(o.testo)}<div class="muted small">${esc(vocNome(voci, o.vocId))}${np > 1 && o.p ? ' · P' + o.p : ''} · ${o.visita ? o.visita + '° controllo' : 'dal ' + (o.daAnno || anno - 1)}${o.risoltaIl ? ` · <b class="txt-ok">[OK ${fmt(o.risoltaIl)}]</b>` : ''}</div></div>
              ${UT.solaLettura() ? '' : `<div class="oss-bt"><button class="btn ghost small" data-modoss="${o.lettera}" aria-label="Modifica il testo">✏️</button><button class="btn ghost small" data-oss="${o.lettera}">${o.risoltaIl ? 'Riapri' : '✓ Sistemata'}</button></div>`}</div>`).join('')
            : '<p class="muted">Nessuna osservazione.</p>'}
        </div>
        ${!UT.solaLettura() || scV.noteInterne ? `<div class="card"><div class="card-head"><h2>📝 Note Gru Impianti ${anno} ${info('Appunti nostri: NON compaiono sulla scheda stampata o inviata al cliente.')}</h2></div>
          <textarea id="noteInt" rows="3" data-libero placeholder="appunti per noi…" ${UT.solaLettura() ? 'readonly' : ''}>${esc(scV.noteInterne || '')}</textarea>
          ${UT.solaLettura() ? '' : '<div class="azioni-form"><span class="grow"></span><button type="button" class="btn ghost small" id="btnNoteInt">Salva note</button></div>'}</div>` : ''}
        ${sc?.noteVecchie ? `<div class="card"><div class="card-head"><h2>Note dal programma vecchio ${info('Note interne scritte sul programma vecchio per questo impianto in quest\'anno. Non compaiono sulla scheda del cliente. Se servono, spostale nelle note Gru Impianti; altrimenti eliminale.')}</h2></div><p class="note-vecchie">${esc(sc.noteVecchie)}</p>
          ${UT.solaLettura() ? '' : '<div class="azioni-form"><button type="button" class="btn ghost small danger" id="btnVecchieVia">🗑 Elimina</button><span class="grow"></span><button type="button" class="btn ghost small" id="btnVecchieSposta">↧ Sposta nelle note Gru Impianti</button></div>'}</div>` : ''}
      </section>`;
    el.querySelector('#btnVoci')?.addEventListener('click', () => modaleVoci(S, i));
    el.querySelector('#btnComeModello')?.addEventListener('click', () => UI.modal({
      titolo: 'Salva le voci come modello',
      infoTxt: `Le ${sc.voci.length} voci di questa scheda, così come sono, diventano un nuovo modello nella lista «Modelli di scheda». Poi lo puoi scegliere per gli altri impianti.`,
      campi: [{ k: 'nome', label: 'Nome del modello', req: true, maiuscolo: true, placeholder: 'es. CLN' }],
      onSalva: async (v) => {
        const m = await aggiungiModello(S, v.nome, sc.voci);
        if (m === false) { UI.toast('C\'è già un modello con questo nome', 'err'); return false; }
        UI.toast(`Modello «${m.nome}» salvato (${m.voci.length} voci)`, 'ok');
      }
    }));
    const togliVecchie = async (sposta) => {
      const d = JSON.parse(JSON.stringify(sc));
      if (sposta) { const ora = (el.querySelector('#noteInt')?.value || d.noteInterne || '').trim(); d.noteInterne = [ora, d.noteVecchie.trim()].filter(Boolean).join('\n'); }
      delete d.noteVecchie; await UI.salva('schedeControllo', d); UI.toast(sposta ? 'Note spostate nelle note Gru Impianti' : 'Note del programma vecchio eliminate', 'ok');
    };
    el.querySelector('#btnVecchieVia')?.addEventListener('click', () => { if (UI.conferma('Eliminare definitivamente le note del programma vecchio di questo impianto (anno ' + anno + ')?')) togliVecchie(false); });
    el.querySelector('#btnVecchieSposta')?.addEventListener('click', () => togliVecchie(true));
    el.querySelector('#btnNoteInt')?.addEventListener('click', async () => {
      const t = el.querySelector('#noteInt').value.trim();
      const d = JSON.parse(JSON.stringify(scV));
      d.noteInterne = t; await UI.salva('schedeControllo', d); UI.toast('Note salvate', 'ok');
    });
    el.querySelectorAll('[data-oss]').forEach((b) => (b.onclick = () => toggleOss(S, scV, b.dataset.oss)));
    // correggere a mano il testo (anche di un'osservazione già sistemata) e la data dell'OK
    el.querySelectorAll('[data-modoss]').forEach((b) => (b.onclick = () => {
      const o = scV.osservazioni.find((x) => x.lettera === b.dataset.modoss); if (!o) return;
      UI.modal({
        titolo: `Osservazione ${o.lettera}`, valori: { testo: o.testo, data: o.risoltaIl || '' },
        infoTxt: 'Il testo è quello che compare sulla scheda del cliente.' + (o.risoltaIl ? ' La data è quella dell\'[OK].' : ''),
        campi: [{ k: 'testo', label: 'Testo', tipo: 'textarea', req: true, maiuscolo: true }, ...(o.risoltaIl ? [{ k: 'data', label: 'Data dell\'OK', tipo: 'date', req: true }] : [])],
        onSalva: async (v) => {
          const d = JSON.parse(JSON.stringify(scV)), x = d.osservazioni.find((y) => y.lettera === o.lettera);
          x.testo = String(v.testo || '').trim().toUpperCase(); if (o.risoltaIl && v.data) x.risoltaIl = v.data;
          await UI.salva('schedeControllo', d); UI.toast('Osservazione corretta', 'ok');
        }
      });
    }));
    return { titolo: 'Scheda ' + anno + ' · ' + IMP.titolo(i), indietro: '#/controlli/s/' + i.sedeId + '?anno=' + anno, live: true };
  }
  const noteGen = (v) => /^NOTE\s*GENERALI$/i.test(String(v?.testo || '').trim());   // voce per le annotazioni generali: vuota va bene
  const vocNome = (voci, id) => voci.find((v) => v.id === id)?.testo || '';

  function toggleOss(S, sc, lettera) {
    const o = sc.osservazioni.find((x) => x.lettera === lettera);
    if (o.risoltaIl) {
      if (!UI.conferma(`Riaprire l'osservazione ${lettera}?`)) return;
      const d = JSON.parse(JSON.stringify(sc)); delete d.osservazioni.find((x) => x.lettera === lettera).risoltaIl; return UI.salva('schedeControllo', d);
    }
    UI.modal({
      titolo: `Osservazione ${lettera} sistemata`, valori: { data: oggi() },
      campi: [{ k: 'data', label: 'Data della sistemazione', tipo: 'date', req: true }],
      onSalva: async (v) => { const d = JSON.parse(JSON.stringify(sc)); d.osservazioni.find((x) => x.lettera === lettera).risoltaIl = v.data; await UI.salva('schedeControllo', d); UI.toast('Segnata come sistemata', 'ok'); }
    });
  }

  function modaleVoci(S, i) {
    const ms = modelli(S) || MODELLI_BASE(); const m = modelloDi(S, i);
    const escl = i.controllo?.escluse || [];
    UI.modal({
      titolo: 'Voci di questo impianto', largo: true,
      infoTxt: 'Togli la spunta alle voci che su questo impianto non si fanno (es. freno ausiliario se non c\'è il motore ausiliario). Per cambiare le voci di tutti gli impianti usa «Modelli di scheda».',
      valori: { modello: m.nome, ...Object.fromEntries(m.voci.map((v) => ['v_' + v.id, !escl.includes(v.id)])) },
      campi: [{ k: 'modello', label: 'Modello di scheda', tipo: 'select', opzioni: ms.map((x) => x.nome) },
        ...['T', 'S', 'A'].flatMap((pp) => [{ tipo: 'titolo', label: PER_NOME[pp] }, ...m.voci.filter((v) => v.per === pp).map((v) => ({ k: 'v_' + v.id, label: v.testo, tipo: 'sino', mezza: true }))])],
      onSalva: async (v) => {
        const nuovo = ms.find((x) => x.nome === v.modello) || m;
        const d = JSON.parse(JSON.stringify(i));
        d.controllo = { modelloId: nuovo.id, escluse: nuovo.id === m.id ? m.voci.filter((x) => !v['v_' + x.id]).map((x) => x.id) : [] };
        await UI.salva('impianti', d);
        UI.toast(nuovo.id === m.id ? 'Voci aggiornate' : 'Modello cambiato: riapri per scegliere le voci', 'ok');
      }
    });
  }

  // ---------- 4. COMPILAZIONE DI UN CONTROLLO ----------
  async function visita(el, S, impId, anno, n, torna = '') {
    const i = S.impianti.find((x) => x.id === impId);
    if (!i) { el.innerHTML = '<p class="nessuno">Impianto non trovato.</p>'; return { titolo: 'Controllo' }; }
    const { c, s } = trovaSede(S, i.sedeId); const p = piano(s);
    const tipo = tipoVisita(p, n), periodi = periodiDi(tipo), mese = meseVisita(p, n);
    const esistente = schedaDi(S, impId, anno);
    const sc = esistente ? JSON.parse(JSON.stringify(esistente)) : nuovaScheda(S, i, anno);
    const np = nParanchi(i);
    const prima = sc.visite[n];
    const fine = fineMese(anno, mese);
    const vis = prima ? JSON.parse(JSON.stringify(prima)) : {
      dataScheda: oggi() > fine ? fine : oggi(), // in ritardo: propongo l'ultimo giorno del mese di scadenza
      dataEsecuzione: oggi(), tecnici: [], tecnico: '', firma: null, esiti: {}
    };
    const voci = sc.voci.filter((v) => periodi.includes(v.per));
    const osservazioni = sc.osservazioni;
    const aperte = (vocId, pi) => osservazioni.filter((o) => o.vocId === vocId && (o.p || 1) === pi && !o.risoltaIl && o.visita < n);
    // valori iniziali: per le anomalie ancora aperte riporto la lettera
    leggiVisita(vis, voci);
    voci.forEach((v) => {
      if (haValore(v)) vis.valori[v.id] = vis.valori[v.id] || Array(np).fill('');
      vis.esiti[v.id] = vis.esiti[v.id] || Array(np).fill('');
      for (let pi = 1; pi <= np; pi++) if (!vis.esiti[v.id][pi - 1]) { const a = aperte(v.id, pi)[0]; if (a && !prima) vis.esiti[v.id][pi - 1] = a.lettera; }
    });
    // ultimo valore preso (questo anno nei controlli prima, altrimenti gli anni prima): voce uguale per id o per nome
    const ultimoValore = (v, pi) => {
      const nv = (t) => String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      for (let a = anno; a >= anno - 3; a--) {
        const sch = a === anno ? sc : schedaDi(S, impId, a); if (!sch) continue;
        const vid = (sch.voci || []).find((x) => x.id === v.id || nv(x.testo) === nv(v.testo))?.id; if (!vid) continue;
        const nn = Object.keys(sch.visite || {}).map(Number).filter((k) => a < anno || k < n).sort((x, y) => y - x);
        for (const k of nn) { const val = sch.visite[k]?.valori?.[vid]?.[pi - 1]; if (val) return { val, data: sch.visite[k].dataScheda }; }
      }
      return null;
    };
    const nominale = (v, pi) => (/DIAMETRO/i.test(v.testo) ? i.paranchi?.[pi - 1]?.fune?.diametro : '');
    // per lavorare in fila: il prossimo impianto della sede che non ha ancora questo controllo
    const fila = impiantiSede(S, i.sedeId), pos = fila.findIndex((x) => x.id === i.id);
    const prossimoImp = [...fila.slice(pos + 1), ...fila.slice(0, pos)].find((x) => !x.dismesso && !fatta(schedaDi(S, x.id, anno)?.visite?.[n])) || null;
    // annotazione di fuori servizio provvisorio ancora aperta (nata in un controllo prima di questo)
    const fsAperta = osservazioni.find((o) => !o.risoltaIl && /FUORI SERVIZIO PROVVISORIO/.test(o.testo) && o.visita < n) || null;
    const prossimaLettera = () => { const usate = osservazioni.map((o) => o.lettera); let k = 0; let l; do { l = k < 26 ? String.fromCharCode(65 + k) : 'A' + String.fromCharCode(65 + k - 26); k++; } while (usate.includes(l)); return l; };

    el.innerHTML = `
      <form class="sg form" id="fVis" novalidate>
        ${CONF.avvisoAltro(prima, `Il ${n}° controllo ${anno} di questo impianto`)}
        <div class="vis-testa t-${tipo}">
          <div class="grow"><b>${n}° controllo ${anno} · ${nomeTipo(tipo)}</b> <span>${MESI[mese - 1]}</span>
            <div class="vis-imp">${i.numeroInterno ? `N° ${esc(i.numeroInterno)} · ` : ''}${esc(IMP.titolo(i))} · ${esc(c ? nomeSede(c, s) : '')}</div></div>
          ${UI.menu([prima && !UT.solaLettura() && { t: '🗑 Elimina questo controllo', id: 'btnElimina', cls: 'txt-ko' }, { t: '📋 Scheda dell\'anno', href: `#/controlli/i/${impId}?anno=${anno}` }, { t: '🏗️ Anagrafica impianto', href: `#/impianti/i/${impId}` }])}
        </div>
        ${fsAperta && !UT.solaLettura() ? `<div class="card vis-fs vis-fs-on" id="boxFsOn">
          <b>⏸ Impianto fuori servizio provvisorio</b> <span class="muted small">(annotazione ${esc(fsAperta.lettera)} dal ${fmt(fsAperta.data)})</span>
          <div class="azioni-form"><button type="button" class="btn ghost" id="btnFsp">⛔ Ancora fuori servizio: salva così</button><button type="button" class="btn" id="btnFsVia">✅ Rimetti in servizio</button></div>
          <p class="muted small">«Rimetti in servizio» chiude l'annotazione con [OK] alla data di questo controllo: poi compili il controllo normalmente e salvi.</p>
        </div>` : ''}
        <details class="card dati-vis" ${prima ? '' : ''}>
          <summary><span>📅 <b id="sDat">${fmt(vis.dataScheda)}</b></span><span>👷 <b id="sTec">${esc(vis.tecnico || UT.breve(UT.attuale()))}</b></span><span class="link">modifica</span></summary>
          <div class="due giro-dati">
            <label>Data sulla scheda ${info('È la data che compare sulla scheda del cliente. Se siete in ritardo (es. scadenza a ottobre, controllo fatto a novembre) puoi mettere una data del mese di scadenza.')}<input type="date" name="dataScheda" value="${vis.dataScheda}"></label>
            <label>Eseguito il<input type="date" name="dataEsecuzione" value="${vis.dataEsecuzione}"></label>
          </div>
          ${UT.campoTecnici((vis.tecnici || []).map((t) => t.id), vis.firmaDi)}
        </details>
        <div class="giro-tools vis-tools">
          ${['T', 'S', 'A'].filter((pp) => periodi.includes(pp)).map((pp) => `<a class="salta" href="javascript:void(0)" data-salta="${pp}">${pp === 'T' ? 'TRIM' : pp === 'S' ? 'SEME' : 'ANN'}</a>`).join('')}
          <span class="grow"></span>
          <span class="progress"><b id="nFatti">0</b>/${voci.length * np}</span>
          ${info('Per ogni voce tocca l\'esito: X esame visivo funzionale · R ripristinato · P pulito · L lubrificato · S sostituito. Per un problema tocca ⚠: scrivi la nota e l\'app le dà una lettera (A, B, C…) che compare nelle osservazioni. Le anomalie ancora aperte dei controlli precedenti sono già riportate. Le voci che non riesci a fare lasciale vuote: nell\'app risultano non eseguite, sulla scheda del cliente escono con la X.')}
        </div>
        ${['T', 'S', 'A'].filter((pp) => periodi.includes(pp)).map((pp) => `
          <h2 class="sez sez-paranco" id="sez-${pp}">${PER_NOME[pp]}</h2>
          <div class="giro-lista">
            ${voci.filter((v) => v.per === pp).map((v) => `
              <div class="giro-item cv-item" data-v="${v.id}">
                <div class="gi-head"><b>${esc(v.testo)}</b></div>
                ${Array.from({ length: np }, (_, k) => k + 1).map((pi) => `
                  <div class="gi-parte" data-p="${pi}">
                    ${np > 1 ? `<div class="gi-comp">P${pi} · paranco ${esc((i.paranchi[pi - 1]?.ruolo || '').toLowerCase())}</div>` : ''}
                    ${aperte(v.id, pi).map((o) => `<div class="oss-aperta" data-l="${esc(o.lettera)}">⚠ ancora aperta · <b>${esc(o.lettera)}</b> ${esc(o.testo)}</div>`).join('')}
                    <div class="gi-row">
                      <div class="codici codici-c">${CODICI.map(([k, l]) => `<button type="button" class="cod-btn c-cv" data-c="${k}" title="${l}">${k}</button>`).join('')}</div>
                      ${haValore(v) ? `<label class="valore"><input type="text" ${unitaDi(v) ? 'inputmode="decimal"' : ''} data-val placeholder="valore" aria-label="Valore${unitaDi(v) ? ' in ' + esc(unitaDi(v)) : ''}">${unitaDi(v) ? `<span>${esc(unitaDi(v))}</span>` : ''}</label>${nominale(v, pi) ? `<span class="prima">nom. ${esc(nominale(v, pi))}</span>` : ''}${(() => { const u = ultimoValore(v, pi); return u ? `<span class="prima ult-val">ultimo: <b>${esc(u.val)}${unitaDi(v) ? ' ' + esc(unitaDi(v)) : ''}</b> · ${esc(fmt(u.data))}</span>` : ''; })()}` : ''}
                      <button type="button" class="btn ghost small anom-btn" data-anom aria-label="Anomalia">⚠<span class="anom-txt"> Anomalia</span></button>
                      <span class="val-lettera"></span>
                    </div>
                  </div>`).join('')}
              </div>`).join('')}
          </div>`).join('')}
        <div class="card">
          <h2>Osservazioni dell'anno ${info('Con 🗑 togli un\'osservazione del tutto, senza scrivere [OK]: sparisce dalla scheda e la sua lettera viene tolta dalle caselle, anche dei controlli già fatti quest\'anno. Vale quando salvi il controllo. Se invece il problema è stato risolto, scrivi [OK e la data] dalla pagina dell\'impianto con ✏️.')}</h2>
          <div id="ossLista"></div>
          <button type="button" class="btn ghost small" id="btnOssLibera">+ Osservazione non legata a una voce</button>
        </div>
        <div class="card">
          <h2>📝 Note Gru Impianti ${info('Appunti nostri su questo impianto per quest\'anno: NON compaiono sulla scheda stampata o inviata al cliente.')}</h2>
          <textarea name="noteInterne" rows="3" data-libero placeholder="es. portare ricambio freno, chiedere chiavi al capoturno…">${esc(sc.noteInterne || '')}</textarea>
        </div>
        ${UT.solaLettura() || fsAperta ? '' : `<div class="card vis-fs">
          <button type="button" class="btn ghost" id="btnFsp">⛔ Impianto fuori servizio provvisorio</button>
          <p class="muted small">Salva il controllo con le voci vuote (restano solo le lettere delle osservazioni ancora aperte) e su «NOTE GENERALI» l'annotazione «FUORI SERVIZIO PROVVISORIO».</p>
        </div>`}
        <div class="azioni-form sticky vis-salva">
          <button class="btn ghost big" type="submit" data-dopo="sede">Salva</button>
          ${prossimoImp ? `<button class="btn big" type="submit" data-dopo="prossimo">Salva e prossimo ›<small>N° ${esc(prossimoImp.numeroInterno || '')} ${esc(IMP.titolo(prossimoImp))}</small></button>` : ''}
        </div>
      </form>`;

    const f = el.querySelector('#fVis');
    const box = (vid, pi) => el.querySelector(`.cv-item[data-v="${vid}"] .gi-parte[data-p="${pi}"]`);
    const isLettera = (x) => /^[A-Z]{1,2}$/.test(x) && !CODICI.some(([k]) => k === x);
    const mostra = (v, pi) => {
      const b = box(v.id, pi), val = vis.esiti[v.id][pi - 1] || '';
      b.querySelectorAll('.cod-btn').forEach((x) => x.classList.toggle('on', x.dataset.c === val));
      const vv = b.querySelector('[data-val]'); if (vv && document.activeElement !== vv) vv.value = vis.valori[v.id]?.[pi - 1] || '';
      b.querySelector('.val-lettera').innerHTML = isLettera(val) ? `<span class="lettera-on">${esc(val)}</span>` : '';
      b.classList.toggle('fatto', !!val); b.classList.remove('manca');
      el.querySelector('#nFatti').textContent = voci.reduce((t, x) => t + vis.esiti[x.id].filter(Boolean).length, 0);
    };
    const disegnaOss = () => {
      el.querySelector('#ossLista').innerHTML = osservazioni.length ? osservazioni.map((o) => `
        <div class="oss-riga ${o.risoltaIl ? 'risolta' : ''}"><b class="oss-l">${esc(o.lettera)}</b><div class="grow">${esc(o.testo)}
          <div class="muted small">${esc(vocNome(sc.voci, o.vocId) || 'osservazione generale')}${np > 1 && o.p ? ' · P' + o.p : ''} · ${o.visita ? o.visita + '° controllo' : 'dal ' + (o.daAnno || anno - 1)}${o.risoltaIl ? ' · [OK ' + fmt(o.risoltaIl) + ']' : ''}</div></div>
          ${UT.solaLettura() ? '' : `<button type="button" class="btn ghost small danger" data-togli="${o.lettera}" aria-label="Elimina l'osservazione" title="Elimina l'osservazione">🗑</button>`}</div>`).join('') : '<p class="muted">Nessuna osservazione.</p>';
      el.querySelectorAll('[data-togli]').forEach((b) => (b.onclick = () => {
        const o = osservazioni.find((x) => x.lettera === b.dataset.togli);
        // quelle nate adesso si tolgono e basta; le altre (controlli prima o anno prima) chiedono conferma
        if (o.visita !== n && !UI.conferma(`Eliminare l'osservazione ${o.lettera}?\n\n«${o.testo}»\n\nSparisce del tutto dalla scheda (anche dai controlli già fatti quest'anno), senza [OK]. Diventa definitivo quando salvi il controllo.`)) return;
        osservazioni.splice(osservazioni.indexOf(o), 1);
        // la lettera sparisce dalle caselle: in questo controllo e in quelli già fatti
        for (const x of [vis, ...Object.values(sc.visite || {})]) {
          const es = x?.esiti?.[o.vocId]; if (es && es[(o.p || 1) - 1] === o.lettera) es[(o.p || 1) - 1] = '';
        }
        el.querySelectorAll('.oss-aperta').forEach((d) => { if (d.dataset.l === o.lettera) d.remove(); });
        const v = voci.find((x) => x.id === o.vocId); if (v) mostra(v, o.p || 1);
        disegnaOss(); UI.toast(`Osservazione ${o.lettera} tolta${o.visita !== n ? ': salva il controllo per confermare' : ''}`, 'ok');
      }));
    };
    const nuovaOss = (v, pi) => UI.modal({
      titolo: v ? `Anomalia · ${v.testo}${np > 1 ? ' · P' + pi : ''}` : 'Osservazione',
      infoTxt: 'Scrivi il problema come vuoi che compaia sulla scheda (es. «RIVEDERE SALDATURE SU STAFFA SOSTEGNO MOTORE CARRO»).',
      campi: [{ k: 'testo', label: 'Descrizione', tipo: 'textarea', req: true, maiuscolo: true }],
      testoSalva: 'Aggiungi',
      onSalva: (x) => {
        const lettera = prossimaLettera();
        osservazioni.push({ lettera, testo: x.testo, vocId: v?.id || '', p: v ? pi : null, visita: n, data: f.dataScheda.value || oggi() });
        if (v) { vis.esiti[v.id][pi - 1] = lettera; mostra(v, pi); }
        disegnaOss();
      }
    });
    voci.forEach((v) => { for (let pi = 1; pi <= np; pi++) {
      const b = box(v.id, pi);
      b.querySelectorAll('.cod-btn').forEach((x) => (x.onclick = () => { vis.esiti[v.id][pi - 1] = vis.esiti[v.id][pi - 1] === x.dataset.c ? '' : x.dataset.c; mostra(v, pi); }));
      // scrivere un valore vuol dire che la voce è stata controllata: se manca il codice metto X
      const vv = b.querySelector('[data-val]'); if (vv) vv.oninput = () => { vis.valori[v.id][pi - 1] = vv.value.trim(); if (vv.value.trim() && !vis.esiti[v.id][pi - 1]) vis.esiti[v.id][pi - 1] = 'X'; mostra(v, pi); };
      b.querySelector('[data-anom]').onclick = () => nuovaOss(v, pi);
      b.querySelectorAll('[data-sistema]').forEach((x) => (x.onclick = () => {
        const o = osservazioni.find((y) => y.lettera === x.dataset.sistema);
        o.risoltaIl = f.dataScheda.value || oggi();
        if (vis.esiti[v.id][pi - 1] === o.lettera) vis.esiti[v.id][pi - 1] = 'R';
        x.closest('.oss-aperta').innerHTML = `✓ <b>${esc(o.lettera)}</b> [OK ${fmt(o.risoltaIl)}]`;
        mostra(v, pi); disegnaOss();
      }));
      mostra(v, pi);
    } });
    disegnaOss();
    el.querySelector('#btnOssLibera').onclick = () => nuovaOss(null, null);
    // fuori servizio provvisorio: tutte le caselle vuote; sulla voce NOTE GENERALI (la prima, aggiunta se manca)
    // va l'annotazione FUORI SERVIZIO PROVVISORIO. Le osservazioni aperte restano nell'elenco dell'anno.
    el.querySelector('#btnFsp')?.addEventListener('click', async () => {
      if (!UI.conferma(`Segnare ${i.numeroInterno ? 'N° ' + i.numeroInterno : IMP.titolo(i)} FUORI SERVIZIO PROVVISORIO in questo controllo?\n\nLe voci restano vuote (con le lettere delle osservazioni ancora aperte) e su «NOTE GENERALI» ${fsAperta ? 'resta' : 'si aggiunge'} l'annotazione «FUORI SERVIZIO PROVVISORIO».`)) return;
      const nvt = (t) => String(t || '').toUpperCase().replace(/[^A-Z]/g, '');
      let ng = sc.voci[0] && nvt(sc.voci[0].testo) === 'NOTEGENERALI' ? sc.voci[0] : null;
      if (!ng) { ng = { id: uid(), per: 'T', testo: 'NOTE GENERALI', tipo: 'codice' }; sc.voci.unshift(ng); }
      // caselle vuote: restano solo le lettere delle osservazioni ancora aperte
      voci.forEach((v) => (vis.esiti[v.id] = Array.from({ length: np }, (_, k) => aperte(v.id, k + 1).filter((o) => !/FUORI SERVIZIO PROVVISORIO/.test(o.testo))[0]?.lettera || '')));
      Object.keys(vis.valori || {}).forEach((k) => (vis.valori[k] = Array(np).fill('')));
      const d = f.dataScheda.value || oggi();
      let o = fsAperta || osservazioni.find((x) => !x.risoltaIl && x.vocId === ng.id && /FUORI SERVIZIO PROVVISORIO/.test(x.testo));
      if (o) o.vocId = ng.id;
      if (!o) { o = { lettera: prossimaLettera(), testo: 'FUORI SERVIZIO PROVVISORIO', vocId: ng.id, p: 1, visita: n, data: d }; osservazioni.push(o); }
      vis.esiti[ng.id] = Array(np).fill(''); vis.esiti[ng.id][0] = o.lettera;
      vis.fs = true;
      if (i.stato !== 'fsp') { try { await UI.salva('impianti', { ...i, stato: 'fsp', fsDal: d, dismesso: false }); } catch (e) {} }
      // salvo subito: la voce NOTE GENERALI nuova va disegnata nella pagina
      Object.assign(vis, { dataScheda: d, dataEsecuzione: f.dataEsecuzione.value || oggi() });
      const t = leggiTecnici(); if (t.tecnici.length) Object.assign(vis, { tecnici: t.tecnici, tecnico: t.tecnico, firmaDi: t.firmaDi, firma: t.firmaDi === vis.firmaDi && vis.firma ? vis.firma : t.firma });
      sc.visite[n] = vis; sc.osservazioni = osservazioni; sc.noteInterne = f.noteInterne.value.trim();
      try { await UI.salva('schedeControllo', sc); } catch (er) { return; }
      sporco = false; UI.toast('Controllo salvato: impianto fuori servizio provvisorio', 'ok');
      location.hash = torna || '#/controlli/s/' + i.sedeId + '?anno=' + anno;
    });
    // rimetti in servizio: l'annotazione si chiude con [OK] alla data di questo controllo (resta fino al controllo prima)
    el.querySelector('#btnFsVia')?.addEventListener('click', async () => {
      const d = f.dataScheda.value || oggi();
      if (!UI.conferma(`Rimettere in servizio l'impianto?\n\nL'annotazione ${fsAperta.lettera} «FUORI SERVIZIO PROVVISORIO» si chiude con [OK ${fmt(d)}]. Poi compila il controllo e salva.`)) return;
      fsAperta.risoltaIl = d;
      Object.keys(vis.esiti).forEach((k) => (vis.esiti[k] = vis.esiti[k].map((x) => (x === fsAperta.lettera ? '' : x))));
      try { await UI.salva('impianti', { ...i, stato: '', fsDal: '' }); } catch (e) {}
      el.querySelector('#boxFsOn').innerHTML = `<b>✅ Rimesso in servizio</b> <span class="muted small">l'annotazione ${esc(fsAperta.lettera)} si chiude con [OK ${esc(fmt(d))}] quando salvi il controllo</span>`;
      sporco = true; disegnaOss(); UI.toast('Impianto in servizio: compila il controllo e salva', 'ok');
    });
    const leggiTecnici = UT.collegaTecnici(el, vis.firmaDi);
    // riga riassuntiva di data e tecnici, salti rapidi tra le sezioni
    const riassunto = () => { const t = leggiTecnici(); el.querySelector('#sDat').textContent = fmt(f.dataScheda.value); el.querySelector('#sTec').textContent = t.tecnico || '— scegli —'; };
    el.querySelector('.dati-vis').addEventListener('change', riassunto); el.querySelector('.dati-vis').addEventListener('click', () => setTimeout(riassunto, 0));
    el.querySelectorAll('[data-salta]').forEach((a) => (a.onclick = () => { const h = el.querySelector('#sez-' + a.dataset.salta); if (h) window.scrollTo({ top: h.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' }); }));

    f.onsubmit = async (e) => {
      e.preventDefault();
      const manc = [];
      voci.forEach((v) => { if (!noteGen(v)) for (let pi = 1; pi <= np; pi++) if (!vis.esiti[v.id][pi - 1]) manc.push(box(v.id, pi)); });
      if (manc.length) {
        manc.forEach((b) => b.classList.add('manca')); manc[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (!UI.conferma(`${manc.length} voci non eseguite. Nell'app resteranno segnate come non eseguite; sulla scheda del cliente compariranno con la X. Salvare?`)) return;
      }
      const t = leggiTecnici();
      if (!t.tecnici.length) return UI.toast('Scegli almeno un tecnico', 'err');
      // la firma del profilo viene copiata nel controllo: se poi il tecnico la rifà, i controlli vecchi non cambiano
      const firma = t.firmaDi === vis.firmaDi && vis.firma && prima ? vis.firma : t.firma;
      if (!firma && !UI.conferma(`${t.firmatario} non ha ancora salvato la firma nel profilo: sulla scheda non comparirà. Salvare lo stesso?`)) return;
      Object.assign(vis, { dataScheda: f.dataScheda.value || oggi(), dataEsecuzione: f.dataEsecuzione.value || oggi(), tecnici: t.tecnici, tecnico: t.tecnico, firmaDi: t.firmaDi, firma,
        _da: UT.breve(UT.attuale()), _disp: CONF.nomeDisp(), _quando: new Date().toISOString() });
      delete vis.inCorso;
      sc.visite[n] = vis; sc.osservazioni = osservazioni; sc.noteInterne = f.noteInterne.value.trim();
      try { await UI.salva('schedeControllo', sc); } catch (er) { return; }
      sporco = false;
      App.ricordaTecnico(vis.tecnico); UI.toast('Controllo salvato', 'ok');
      // aperto dal layout: si torna alla pianta (anche con «Salva e prossimo» si resta nel giro del layout)
      location.hash = (e.submitter?.dataset.dopo === 'prossimo' && prossimoImp) ? `#/controlli/i/${prossimoImp.id}/${anno}/${n}${torna ? '?torna=' + encodeURIComponent(torna) : ''}` : torna || '#/controlli/s/' + i.sedeId + '?anno=' + anno;
    };
    // ---- salvataggio automatico: se esci (freccia, gesto indietro, altra gru) quello che hai fatto si salva da solo.
    // Se mancano voci il controllo resta «⏸ in corso» e la gru resta tra quelle da fare; lo chiudi tu con «Salva».
    let sporco = false;
    f.addEventListener('input', () => (sporco = true)); f.addEventListener('change', () => (sporco = true));
    f.addEventListener('click', (e) => { if (e.target.closest('.cod-btn, [data-togli], [data-anom], .chip-t')) sporco = true; });
    App.allUscita(() => {
      if (!sporco || UT.solaLettura()) return true;
      const t = leggiTecnici(); if (!t.tecnici.length) return false;   // senza tecnico non posso salvare: l'app chiede conferma
      const manc = voci.reduce((k, v) => k + (noteGen(v) ? 0 : vis.esiti[v.id].filter((x, ix) => ix < np && !x).length), 0);
      Object.assign(vis, { dataScheda: f.dataScheda.value || oggi(), dataEsecuzione: f.dataEsecuzione.value || oggi(), tecnici: t.tecnici, tecnico: t.tecnico, firmaDi: t.firmaDi,
        firma: t.firmaDi === vis.firmaDi && vis.firma && prima ? vis.firma : t.firma, _da: UT.breve(UT.attuale()), _disp: CONF.nomeDisp(), _quando: new Date().toISOString() });
      if (manc) vis.inCorso = true; else delete vis.inCorso;
      const d = JSON.parse(JSON.stringify(sc)); d.visite[n] = vis; d.osservazioni = osservazioni; d.noteInterne = f.noteInterne.value.trim();
      UI.salva('schedeControllo', d).then(() => UI.toast(manc ? `💾 Salvato da solo · ${IMP.titolo(i)} in corso (${manc} voci da fare)` : `💾 Salvato da solo · ${IMP.titolo(i)}`, 'ok')).catch(() => {});
      sporco = false; return true;
    });
    App.proteggi(() => sporco && !UT.solaLettura());
    el.querySelector('#btnElimina')?.addEventListener('click', async () => {
      if (!UI.conferma(`Eliminare il ${n}° controllo ${anno} di questo impianto? Le osservazioni nate in questo controllo verranno tolte.`)) return;
      sporco = false;
      delete sc.visite[n]; sc.osservazioni = sc.osservazioni.filter((o) => o.visita !== n);
      if (!Object.keys(sc.visite).length) await Backend.remove('schedeControllo', sc.id); else await UI.salva('schedeControllo', sc);
      location.hash = '#/controlli/i/' + impId + '?anno=' + anno;
    });
    return { titolo: `${n}° controllo · ${IMP.titolo(i)}`, indietro: '#/controlli/i/' + impId + '?anno=' + anno, live: false };
  }

  // ---------- 5. MODELLI DI SCHEDA ----------
  let modelloAperto = null;
  async function pagModelli(el, S) {
    const ms = await assicuraModelli(S);
    const m = ms.find((x) => x.id === modelloAperto) || ms[0]; modelloAperto = m.id;
    const uso = S.impianti.filter((i) => modelloDi(S, i).id === m.id).length;
    el.innerHTML = `
      <section class="sg">
        <div class="sez-head"><h1>Modelli di scheda ${info('Un modello è l\'elenco delle voci di controllo, ognuna con la sua periodicità (TRIM, SEME, ANN). Vale per tutti gli impianti che lo usano: le gru a bandiera usano «Gru a bandiera», le altre «Carroponte». Le modifiche valgono per le schede nuove; quelle già iniziate restano come sono.')}</h1>
          <button class="btn ghost" id="btnNuovoMod">+ Nuovo modello</button></div>
        <nav class="tabs">${ms.map((x) => `<a class="tab ${x.id === m.id ? 'on' : ''}" href="javascript:void(0)" data-mod="${x.id}"><b>${esc(x.nome)}</b><span>${x.voci.length} voci</span></a>`).join('')}</nav>
        <div class="card">
          <div class="card-head"><h2>${esc(m.nome)} <span class="conta">${uso} impianti</span></h2>
            <div class="card-azioni"><button class="btn ghost small" id="btnRinomina">Rinomina</button>${ms.length > 1 && !['carroponte', 'bandiera'].includes(m.id) ? '<button class="btn ghost small danger" id="btnEliminaMod">Elimina</button>' : ''}</div></div>
          ${['T', 'S', 'A'].map((pp) => `
            <h3 class="sotto-tit">${PER_NOME[pp]} (${PER[pp]})</h3>
            <div class="mod-voci">
              ${m.voci.filter((v) => v.per === pp).map((v) => `
                <div class="mod-voce" data-id="${v.id}">
                  <span class="grow">${esc(v.testo)}${haValore(v) ? ` <span class="pill st-mai">valore${unitaDi(v) ? ' ' + esc(unitaDi(v)) : ''}</span>` : ''}</span>
                  <button class="btn ghost small" data-su="${v.id}" aria-label="Su">↑</button>
                  <button class="btn ghost small" data-giu="${v.id}" aria-label="Giù">↓</button>
                  <button class="btn ghost small" data-mod-voce="${v.id}">✏️</button>
                </div>`).join('') || '<p class="muted small">Nessuna voce.</p>'}
            </div>
            <button class="btn ghost small" data-add="${pp}">+ Aggiungi voce ${PER[pp]}</button>`).join('')}
        </div>
      </section>`;
    const salvaM = async (nuovi) => {
      await UI.salva('impostazioni', { id: 'modelliScheda', modelli: nuovi });
      S.impostazioni = [...S.impostazioni.filter((x) => x.id !== 'modelliScheda'), { id: 'modelliScheda', modelli: nuovi }];
      App.ridisegna();
    };
    const copiaM = () => JSON.parse(JSON.stringify(ms));
    el.querySelectorAll('[data-mod]').forEach((b) => (b.onclick = () => { modelloAperto = b.dataset.mod; App.ridisegna(); }));
    const modVoce = (v, per) => UI.modal({
      titolo: v ? 'Modifica voce' : 'Nuova voce ' + PER[per], valori: v ? { ...v, valore: haValore(v), unita: v.unita || (haValore(v) ? 'mm' : 'mm'), per: PER_NOME[v.per] } : { per: PER_NOME[per], unita: 'mm' },
      infoTxt: 'Ogni voce si segna con il codice (X, R, P, L, S). Se attivi «Campo valore» accanto ai codici compare anche una casella per scrivere un valore (es. il diametro della fune): è facoltativa, la compili solo quando la prendi. Sulla scheda del cliente, se c\'è, esce il valore al posto della X.',
      campi: [{ k: 'testo', label: 'Testo della voce', req: true, maiuscolo: true }, { k: 'per', label: 'Periodicità', tipo: 'select', opzioni: Object.values(PER_NOME), mezza: true },
        { k: 'valore', label: 'Campo valore (oltre al codice)', tipo: 'sino', mezza: true },
        { k: 'unita', label: 'Unità del valore', tipo: 'select', opzioni: UNITA, mezza: true }],
      onSalva: async (x) => {
        const n = copiaM(), mm = n.find((y) => y.id === m.id);
        const dati = { testo: x.testo, per: Object.keys(PER_NOME).find((k) => PER_NOME[k] === x.per) || per || 'T', tipo: 'codice', valore: !!x.valore, unita: x.valore ? (x.unita || 'mm') : null };
        if (v) Object.assign(mm.voci.find((y) => y.id === v.id), dati); else mm.voci.push({ id: uid(), ...dati });
        await salvaM(n);
      },
      onElimina: v ? async () => { if (!UI.conferma(`Togliere la voce «${v.testo}» dal modello?`)) return false; const n = copiaM(); const mm = n.find((y) => y.id === m.id); mm.voci = mm.voci.filter((y) => y.id !== v.id); await salvaM(n); } : null,
      testoElimina: 'Togli voce'
    });
    el.querySelectorAll('[data-add]').forEach((b) => (b.onclick = () => modVoce(null, b.dataset.add)));
    el.querySelectorAll('[data-mod-voce]').forEach((b) => (b.onclick = () => modVoce(m.voci.find((v) => v.id === b.dataset.modVoce))));
    const sposta = async (id, d) => {
      const n = copiaM(), mm = n.find((y) => y.id === m.id), v = mm.voci.find((y) => y.id === id);
      const stesso = mm.voci.filter((y) => y.per === v.per), k = stesso.indexOf(v), alt = stesso[k + d]; if (!alt) return;
      const a = mm.voci.indexOf(v), b = mm.voci.indexOf(alt); [mm.voci[a], mm.voci[b]] = [mm.voci[b], mm.voci[a]];
      await salvaM(n);
    };
    el.querySelectorAll('[data-su]').forEach((b) => (b.onclick = () => sposta(b.dataset.su, -1)));
    el.querySelectorAll('[data-giu]').forEach((b) => (b.onclick = () => sposta(b.dataset.giu, 1)));
    el.querySelector('#btnRinomina').onclick = () => UI.modal({ titolo: 'Rinomina modello', valori: { nome: m.nome }, campi: [{ k: 'nome', label: 'Nome', req: true }],
      onSalva: async (x) => { const n = copiaM(); n.find((y) => y.id === m.id).nome = x.nome; await salvaM(n); } });
    el.querySelector('#btnEliminaMod')?.addEventListener('click', async () => {
      if (uso) return UI.toast(`Lo usano ${uso} impianti: cambia prima il loro modello`, 'err');
      if (!UI.conferma(`Eliminare il modello ${m.nome}?`)) return;
      modelloAperto = null; await salvaM(copiaM().filter((y) => y.id !== m.id));
    });
    el.querySelector('#btnNuovoMod').onclick = () => UI.modal({
      titolo: 'Nuovo modello', infoTxt: 'Il nuovo modello parte come copia di quello scelto: poi togli o aggiungi le voci.',
      valori: { da: m.nome }, campi: [{ k: 'nome', label: 'Nome del modello', req: true, placeholder: 'es. Gru a portale' }, { k: 'da', label: 'Copia le voci da', tipo: 'select', opzioni: ms.map((x) => x.nome) }],
      onSalva: async (x) => { const n = copiaM(); const da = n.find((y) => y.nome === x.da) || m; const nuovo = { id: uid(), nome: x.nome, voci: da.voci.map((v) => ({ ...v, id: uid() })) }; n.push(nuovo); modelloAperto = nuovo.id; await salvaM(n); }
    });
    return { titolo: 'Modelli di scheda', indietro: '#/controlli', live: true };
  }

  function route(el, S, parti, query) {
    const [, a, b, x, y] = parti;
    if (a === 'modelli') { pagModelli(el, S); return { titolo: 'Modelli di scheda', indietro: '#/controlli', live: true }; }
    if (a === 's' && x === 'giro') return giroSede(el, S, b, +y, +parti[5]);
    if (a === 's' && y === 'stampa') return CTRS.render(el, S, impiantiSede(S, b, +x).map((i) => i.id), +x, '#/controlli/s/' + b + '?anno=' + x);
    if (a === 's') return sede(el, S, b, query);
    if (a === 'i' && y === 'stampa') return CTRS.render(el, S, [b], +x, '#/controlli/i/' + b + '?anno=' + x);
    if (a === 'i' && x && y) { const torna = query?.get('torna') || ''; assicuraModelli(S).then(() => visita(el, S, b, +x, +y, torna)); return { titolo: `${y}° controllo`, indietro: torna || '#/controlli/i/' + b + '?anno=' + x, live: false }; }
    if (a === 'i') return impianto(el, S, b, query);
    return sedi(el, S);
  }

  return { route, aggiungiModello, piano, vociPerImpianto, tipoVisita, periodiDi, meseVisita, schedaDi, trovaSede, PER, CODICI, MESI, sediConImpianti, nomeSede, prossima, statoVisite, haValore, unitaDi, leggiVisita, riepilogo: (S) => sediConImpianti(S).filter(({ s }) => prossima(S, s.id, annoOggi())?.k === 'scaduto').length };
})();
