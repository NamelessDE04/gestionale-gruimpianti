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

  // Una casella può avere più codici insieme (es. visionato X, regolato R): si salvano uniti con «+» («X+R»).
  const codiciDi = (val) => String(val || '').split('+').filter((c) => CODICI.some(([k]) => k === c));
  const uniscCodici = (lista) => CODICI.map(([k]) => k).filter((k) => lista.includes(k)).join('+');
  // sulla scheda del cliente: il codice più significativo (sostituito, ripristinato, pulito, lubrificato, poi visionato)
  // la lettera di un'osservazione (A, B…) resta nella casella anche se ci metti dei codici: «F+X»
  const partiEsito = (val) => String(val || '').split('+').filter(Boolean);
  const letteraDi = (val) => partiEsito(val).find((x) => /^[A-Z]{1,2}$/.test(x) && !CODICI.some(([k]) => k === x)) || '';
  const componiEsito = (lett, codici) => [lett, ...CODICI.map(([k]) => k).filter((k) => codici.includes(k))].filter(Boolean).join('+');
  // toglie la lettera dalla casella (osservazione tolta o sistemata); con «metti» aggiunge un codice (es. R = ripristinato)
  const togliLettera = (val, l, metti) => (letteraDi(val) !== l ? val : componiEsito('', metti ? [...new Set([...codiciDi(val), metti])] : codiciDi(val)));
  const codicePrincipale = (val) => { const c = codiciDi(val); return ['S', 'R', 'P', 'L', 'X'].find((k) => c.includes(k)) || ''; };
  const V = (per, testo, unita) => ({ id: uid(), per, testo, tipo: 'codice', ...(unita != null ? { valore: true, unita } : {}) });
  // CAMPO VALORE: oltre al codice (X, R, P…) la voce ha una casella per scrivere un valore (es. diametro in mm).
  // Il valore è facoltativo: se non lo prendi, basta il codice. Le voci "misura" delle versioni vecchie valgono come valore in mm.
  const UNITA = ['mm', 'cm', 'kg', 't', '%', 'bar', '°C', 'V', 'A', 'nessuna'];
  const haValore = (v) => !!(v && (v.valore || v.tipo === 'misura'));
  const unitaDi = (v) => { const u = v?.unita != null ? v.unita : (v?.tipo === 'misura' ? 'mm' : ''); return u === 'nessuna' ? '' : u; };
  // esito "noto": codici e/o lettera di un'osservazione, anche insieme («X+R», «F+X»)
  const isCodice = (x) => CODICI.some(([k]) => k === x) || (/^[A-Z]{1,2}(\+[A-Z]{1,2})+$/.test(x || '') && String(x).split('+').every((c) => /^[A-Z]{1,2}$/.test(c)));
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
  // La lista dei modelli è UN solo documento: salvarla da un dispositivo che ha una copia vecchia (o vuota,
  // es. appena installato o senza rete) cancellerebbe i modelli fatti dagli altri. Per questo:
  //  - prima di scrivere rileggo la lista dal cloud e tengo i modelli che io non sto toccando;
  //  - la lista di prima resta in una copia di sicurezza (modelliScheda~copia);
  //  - i modelli di base si scrivono SOLO se il cloud conferma che non c'è ancora nessuna lista.
  async function listaCloud() {
    if (Backend.mode !== 'cloud' || !navigator.onLine) return undefined;
    try { const d = (await Backend.leggiTutti('impostazioni')).find((x) => x.id === 'modelliScheda'); return d ? d.modelli || [] : null; } catch (e) { return undefined; }
  }
  async function scriviModelli(S, nuovi, tolti = []) {
    const cloud = await listaCloud(), base = cloud || modelli(S) || [];
    const ids = new Set(nuovi.map((m) => m.id)), via = new Set(tolti);
    const finali = [...nuovi, ...base.filter((m) => !ids.has(m.id) && !via.has(m.id))];
    if (base.length) { try { await UI.salva('impostazioni', { id: 'modelliScheda~copia', modelli: base, copiaDel: new Date().toISOString() }); } catch (e) {} }
    await UI.salva('impostazioni', { id: 'modelliScheda', modelli: finali });
    S.impostazioni = [...S.impostazioni.filter((x) => x.id !== 'modelliScheda'), { id: 'modelliScheda', modelli: finali }];
    return finali;
  }
  async function assicuraModelli(S) {
    if (modelli(S)) return modelli(S);
    const cloud = await listaCloud();
    if (cloud && cloud.length) { S.impostazioni = [...S.impostazioni.filter((x) => x.id !== 'modelliScheda'), { id: 'modelliScheda', modelli: cloud }]; return cloud; }
    // senza la certezza che nel cloud non ci sia niente, i modelli di base restano solo in memoria
    if (Backend.mode === 'cloud' && cloud !== null) return MODELLI_BASE();   // undefined = il cloud non ha risposto
    return scriviModelli(S, MODELLI_BASE());
  }
  // nuovo modello di scheda dalle voci date (es. quelle di una scheda importata); stesso nome = non si duplica
  async function aggiungiModello(S, nome, voci) {
    const ms = JSON.parse(JSON.stringify(await assicuraModelli(S)));
    nome = String(nome || '').trim(); if (!nome) return null;
    if (ms.some((m) => m.nome.toLowerCase() === nome.toLowerCase())) return false;
    const m = { id: uid(), nome, voci: voci.map((v) => ({ id: uid(), per: v.per || 'T', testo: String(v.testo || '').toUpperCase(), tipo: 'codice', ...(v.valore || v.tipo === 'misura' ? { valore: true, unita: v.unita || 'mm' } : {}) })) };
    await scriviModelli(S, [...ms, m]);
    return m;
  }
  const modelloDi = (S, imp) => {
    const ms = modelli(S) || MODELLI_BASE();
    const daTipo = window.MIMP ? MIMP.di(S, imp) : null;   // il tipo di impianto può proporre il suo modello di scheda
    return ms.find((m) => m.id === imp.controllo?.modelloId) || (daTipo?.schedaCtr && ms.find((m) => m.id === daTipo.schedaCtr))
      || ms.find((m) => m.id === (daTipo?.icona === 'bandiera' || /bandiera/i.test(imp.tipologia || '') ? 'bandiera' : 'carroponte')) || ms[0];
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
  const impiantiSede = (S, sedeId, anno) => IMP.ordinaSede(S, sedeId, S.impianti.filter((i) => i.sedeId === sedeId && (!i.dismesso || (anno && schedaDi(S, i.id, anno)))));
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
    const osservazioni = prima ? (prima.osservazioni || []).filter((o) => !o.risoltaIl && !o.tolta).map(({ versioni, ...o }) => ({ ...o, vocId: vocDi(o.vocId), visita: 0, daAnno: o.daAnno || anno - 1 })) : [];
    return { id: i.id + '-' + anno, impiantoId: i.id, sedeId: i.sedeId, clienteId: i.clienteId, anno, voci, visite: {}, osservazioni, ...(prima?.noteInterne ? { noteInterne: prima.noteInterne } : {}) };
  }

  // testo di un'osservazione: se è stato cambiato in un controllo, vale da quel controllo in poi;
  // nei controlli prima resta il testo di prima. o.testo è sempre il più recente (quello della stampa).
  const testoOss = (o, n) => { const V = o.versioni; if (!V || n === undefined) return o.testo; let t = V[0].testo; V.forEach((x) => { if (x.dal <= n) t = x.testo; }); return t; };
  function cambiaTesto(o, n, t) {
    if (!t || t === testoOss(o, n)) return;
    let V = (o.versioni || [{ dal: 0, testo: o.testo }]).filter((x) => x.dal !== n);
    if (!o.daAnno && o.visita && n <= o.visita) V = [{ dal: 0, testo: t }, ...V.filter((x) => x.dal > n)];   // nata in questo controllo: cambia e basta
    else V.push({ dal: n, testo: t });
    V.sort((a, b) => a.dal - b.dal);
    V = V.filter((x, k) => !k || x.testo !== V[k - 1].testo);
    o.testo = V[V.length - 1].testo;
    if (V.length > 1) o.versioni = V; else delete o.versioni;
  }
  // osservazione tolta «da un controllo in poi»: nei controlli prima resta com'era
  const tolta = (o, n) => !!o.tolta && (n === undefined || n >= o.tolta);
  // scelta per eliminare un'osservazione nata in un controllo precedente: 'tutto' | 'dopo' | null
  function sceltaElimina(o) {
    return new Promise((ok) => {
      const ov = document.createElement('div'); ov.className = 'modal-ov';
      ov.innerHTML = `<div class="modal el-oss"><div class="modal-head"><h2>Eliminare l'osservazione ${esc(o.lettera)}?</h2><button type="button" class="modal-x" aria-label="Chiudi">×</button></div>
        <div class="modal-body"><p class="el-testo">«${esc(o.testo)}»</p>
          <p class="muted small">Nata ${o.visita ? 'al ' + o.visita + '° controllo' : 'nell\'anno ' + (o.daAnno || '')}. Vale quando salvi il controllo.</p>
          <button type="button" class="btn ghost el-scelta" data-m="dopo"><b>Togli solo da questo controllo in poi</b><small>Nei controlli già fatti resta com'era (le schede già mandate non cambiano). Da qui in avanti non compare più, senza [OK].</small></button>
          <button type="button" class="btn ghost danger el-scelta" data-m="tutto"><b>Elimina da tutto l'anno</b><small>Sparisce del tutto dalla scheda, anche dalle caselle dei controlli già fatti quest'anno.</small></button>
        </div>
        <div class="modal-foot"><span class="grow"></span><button type="button" class="btn ghost" data-m="">Annulla</button></div></div>`;
      const fine = (m) => { ov.remove(); document.body.classList.remove('modal-aperto'); ok(m || null); };
      ov.onclick = (e) => { if (e.target === ov) fine(null); };
      ov.querySelector('.modal-x').onclick = () => fine(null);
      ov.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => fine(b.dataset.m)));
      document.body.appendChild(ov); document.body.classList.add('modal-aperto');
    });
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
    let v = st.find((x) => !x.completa);
    // anno in corso: conta il controllo del periodo di oggi. Quelli prima rimasti non fatti
    // (es. a ottobre il 1°, 2° e 3°) non vengono più segnalati in ritardo
    if (anno === annoOggi()) {
      const mOggi = +oggi().slice(5, 7), perMese = [...st].sort((a, b) => meseVisita(p, a.n) - meseVisita(p, b.n));
      const ora = perMese.filter((x) => meseVisita(p, x.n) <= mOggi).pop();
      v = ora && !ora.completa ? ora : perMese.find((x) => meseVisita(p, x.n) > mOggi && !x.completa);
    }
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
  const sceltoCtr = {};   // sede|anno -> controllo scelto a mano (1-4), vale finché l'app resta aperta
  const gruAperte = {};   // sede -> elenco gru aperto (resta così finché l'app resta aperta)

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
          ${UT.solaLettura() || !UT.puo('ctr.modelli') ? '' : '<a class="btn ghost small" href="#/controlli/modelli">⚙ Modelli di scheda</a>'}
        </div>
        ${(() => { const ms = modelli(S); if (!ms || !UT.puo('ctr.modelli')) return ''; const n = S.impianti.filter((i) => i.controllo?.modelloId && !ms.some((m) => m.id === i.controllo.modelloId)).length;
          return n ? `<a class="avviso-m st-b-scaduto" href="#/controlli/modelli"><span class="av-ico">⚠️</span><span class="grow"><b>${n} gru usano un modello di scheda che non c'è più</b><span>Tocca per ricrearlo dalle voci delle loro schede</span></span>›</a>` : ''; })()}
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
    // il controllo da fare: quello che hai scelto toccando 1°-4° in alto, altrimenti il prossimo
    const corr = sceltoCtr[sedeId + '|' + anno] || (pr && pr.n);
    el.innerHTML = `
      <section class="sg ctr">
        <div class="card ctr-testa">
          <div class="grow">
            <h1><a class="link-anag" href="#/clienti/${c.id}">${esc(CLI.nome(c))} <span class="loc">${esc(s.nome || '')}</span></a> ${UI.magnete(s)}</h1>
            <p class="muted small">${imp.filter((i) => !i.dismesso).length} impianti · ${pr ? `<span class="pill st-${pr.k}">${esc(pr.label)}</span>` : '<span class="pill st-ok">Anno completato</span>'}</p>
          </div>
          <div class="anno anno-mini"><a href="#/controlli/s/${sedeId}?anno=${anno - 1}" aria-label="Anno prima">‹</a><b>${anno}</b><a href="#/controlli/s/${sedeId}?anno=${anno + 1}" aria-label="Anno dopo">›</a></div>
          ${UI.menu([
            { t: '📅 Piano controlli e ordine gru', id: 'btnPiano' },
            UT.puo('ctr.modelloSede') && imp.length && { t: '📋 Cambia modello scheda', id: 'btnModSede' },
            UT.puo('ctr.modelloSede') && imp.length && { t: '🧹 Azzera controlli', id: 'btnAzzCtr' },
            imp.length && UT.puo('stampa') && { t: `🖨️ Stampa tutte le schede ${anno}`, href: `#/controlli/s/${sedeId}/${anno}/stampa` },
            { t: '🏢 Anagrafica cliente', href: `#/clienti/${c.id}` }
          ])}
        </div>
        ${p.impostato ? '' : `<div class="avviso avviso-mini">Piano dei controlli non impostato (ora: 1° a gennaio, annuale il 1°). <button class="link" id="btnPiano2">Imposta</button></div>`}
        <div class="striscia">${st.map((x) => { const t = tipoVisita(p, x.n);
          return `<button type="button" class="st-v t-${t} ${x.completa ? 'fatto' : ''} ${x.n === corr ? 'corrente' : ''} ${s.coloriFascette ? 'fasc-on' : ''}" ${s.coloriFascette ? `style="--fc:${COL_FASC[t]}"` : ''} title="${nomeTipo(t)}" data-sceglin="${x.n}"><b>${x.n}° ${MESI[meseVisita(p, x.n) - 1].slice(0, 3)}</b><span>${t === 'T' ? 'TRIM' : t === 'S' ? 'SEME' : 'ANN'} · ${x.completa ? '✓' : `${x.fatti}/${x.tot}`}</span></button>`; }).join('')}</div>
        ${corr && imp.length && !UT.solaLettura() && UT.puo('ctr.fare') ? (() => { const x = st[corr - 1], t = tipoVisita(p, corr), via = x.fatti || imp.some((i) => schedaDi(S, i.id, anno)?.visite?.[corr]);
          return `<a class="ctr-inizia t-${t} ${s.coloriFascette ? 'fasc-on' : ''}" ${s.coloriFascette ? `style="--fc:${COL_FASC[t]}"` : ''} href="#/controlli/s/${sedeId}/giro/${anno}/${corr}">▶ ${x.completa ? 'Rivedi' : via ? 'Continua' : 'Inizia'} il ${corr}° controllo<small>${nomeTipo(t)} · ${MESI[meseVisita(p, corr) - 1]} ${anno}${via ? ` · ${x.fatti}/${x.tot} gru fatte` : ` · ${x.tot} gru`}</small></a>`; })() : ''}
        <details class="tendina-gru" id="tendGru" ${gruAperte[sedeId] ? 'open' : ''}>
          <summary><span>🏗️ Elenco gru <b>(${imp.length})</b></span><small>schede dell'anno, osservazioni aperte, fuori servizio</small><span class="tg-freccia">▾</span></summary>
        <div class="elenco">
          ${imp.map((i) => {
            const sc = schedaDi(S, i.id, anno), aperteN = (sc?.osservazioni || []).filter((o) => !o.risoltaIl && !o.tolta).length;
            return `<div class="riga imp-riga ${i.dismesso ? 'dismesso' : ''}">
              <a class="imp-link" href="#/controlli/i/${i.id}?anno=${anno}">
                <span class="imp-ico">${IMP.icona(i)}</span>
                <div class="riga-main">
                  <div class="riga-top">${i.numeroInterno ? `<b>N° ${esc(i.numeroInterno)}</b> · ` : ''}${esc(IMP.titolo(i))}</div>
                  <div class="muted small">${i.matricola ? 'Matr. ' + esc(i.matricola) : ''}${aperteN ? ` · <b class="txt-ko">${aperteN} oss. aperte</b>` : ''}${IMP.pillStato(i)}</div>
                </div>
              </a>
              <div class="visite-mini">${[1, 2, 3, 4].map((n) => i.dismesso && !sc?.visite?.[n] ? '<span class="vm vm-vuoto">–</span>' : `<a class="vm ${fatta(sc?.visite?.[n]) ? 'fatto' : sc?.visite?.[n] ? 'incorso' : ''} ${n === corr && !fatta(sc?.visite?.[n]) ? 'corrente' : ''} t-${tipoVisita(p, n)}" href="#/controlli/i/${i.id}/${anno}/${n}" title="${n}° controllo${sc?.visite?.[n]?.inCorso ? ' (in corso)' : ''}">${fatta(sc?.visite?.[n]) ? '✓' : sc?.visite?.[n] ? '⏸' : n}</a>`).join('')}</div>
            </div>`;
          }).join('')}
        </div>
        <p class="muted small centro">Tocca il numero del controllo di una gru, oppure l'impianto per la sua scheda dell'anno.</p>
        </details>
        <p class="muted small centro">Tocca 1°, 2°, 3° o 4° in alto per scegliere il controllo. Con «Inizia» vedi solo le gru da controllare, con la ricerca.</p>
      </section>`;
    el.querySelector('#tendGru')?.addEventListener('toggle', (e) => { gruAperte[sedeId] = e.target.open; });
    el.querySelector('#btnModSede')?.addEventListener('click', async () => { await assicuraModelli(S); cambiaModelloSede(S, imp, anno); });
    el.querySelector('#btnAzzCtr')?.addEventListener('click', () => azzeraControlli(S, imp, anno, p));
    el.querySelectorAll('[data-sceglin]').forEach((b) => (b.onclick = () => { sceltoCtr[sedeId + '|' + anno] = +b.dataset.sceglin; App.ridisegna(); }));
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
      const sc = schedaDi(S, i.id, anno), v = vis(i), aperteN = (sc?.osservazioni || []).filter((o) => !o.risoltaIl && !o.tolta).length;
      return `<a class="riga imp-riga giro-gru ${fatta(v) ? 'fatta' : ''}" href="#/controlli/i/${i.id}/${anno}/${n}?torna=${encodeURIComponent(qui)}" data-t="${esc(testo(i))}">
        <span class="imp-ico">${IMP.icona(i)}</span>
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
          ${info('Qui ci sono solo le gru di questo controllo. Cerca per numero interno, nome, tipo o matricola e tocca la gru per compilarla. Quando torni indietro o passi alla gru dopo, quello che hai fatto si salva da solo: se mancano voci la gru resta qui sopra «⏸ in corso». Con «✓ Concludi controllo» nella gru la chiudi e va in fondo, tra quelle già controllate.')}
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

  // finestra semplice (titolo, contenuto, piede) per le funzioni del Master
  function finestra(titolo, corpo, piede, cls = '') {
    const ov = document.createElement('div'); ov.className = 'modal-ov';
    ov.innerHTML = `<div class="modal largo ${cls}"><div class="modal-head"><h2>${esc(titolo)}</h2><button type="button" class="modal-x" aria-label="Chiudi">×</button></div>
      <div class="modal-body mb-blocco">${corpo}</div><div class="modal-foot">${piede}</div></div>`;
    const chiudi = () => { ov.remove(); document.body.classList.remove('modal-aperto'); };
    ov.onclick = (e) => { if (e.target === ov) chiudi(); };
    ov.querySelector('.modal-x').onclick = chiudi;
    ov.querySelectorAll('[data-chiudi]').forEach((b) => (b.onclick = chiudi));
    document.body.appendChild(ov); document.body.classList.add('modal-aperto');
    return { ov, chiudi };
  }
  const nvTesto = (t) => String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  // ---------- CAMBIO MODELLO DI SCHEDA PER LA SEDE (Master) ----------
  // le schede dell'anno già iniziate vengono «riformattate»: i giudizi restano sulle voci con lo stesso nome,
  // le osservazioni di voci che nel modello nuovo non ci sono vanno su NOTE GENERALI
  // copia di sicurezza di una scheda prima di cambiarle le voci (raccolta «copie», che l'app non ascolta: non costa letture)
  async function copiaScheda(sc, motivo) {
    if (!sc) return;
    try { await UI.salva('copie', { id: sc.id + '@' + Date.now().toString(36), col: 'schedeControllo', docId: sc.id, quando: new Date().toISOString(), motivo, da: UT.breve(UT.attuale()), doc: JSON.parse(JSON.stringify(sc)) }); } catch (e) { console.warn('copia scheda', e); }
  }
  function rifaiScheda(sc, nuove) {
    const d = JSON.parse(JSON.stringify(sc)), voci = nuove.map((v) => ({ ...v })), perse = []; let aNg = 0;
    let ng = voci.find((v) => nvTesto(v.testo) === 'NOTEGENERALI');
    if (!ng) { const vecchia = (sc.voci || []).find((v) => nvTesto(v.testo) === 'NOTEGENERALI'); if (vecchia) { ng = { ...vecchia }; voci.unshift(ng); } }
    const verso = {};   // id vecchio -> id nuovo
    (sc.voci || []).forEach((v) => { const m = voci.find((x) => nvTesto(x.testo) === nvTesto(v.testo)); if (m) verso[v.id] = m.id; else perse.push(v.testo); });
    const ngId = () => { if (!ng) { ng = { id: uid(), per: 'T', testo: 'NOTE GENERALI', tipo: 'codice' }; voci.unshift(ng); } return ng.id; };
    Object.values(d.visite || {}).forEach((vis) => {
      for (const campo of ['esiti', 'valori']) {
        if (!vis[campo]) continue; const nuovo = {};
        for (const [k, arr] of Object.entries(vis[campo])) if (verso[k]) nuovo[verso[k]] = arr;
        vis[campo] = nuovo;
      }
    });
    (d.osservazioni || []).forEach((o) => {
      if (!o.vocId) return;
      if (verso[o.vocId]) { o.vocId = verso[o.vocId]; return; }
      o.vocId = ngId(); o.p = 1; aNg++;   // la voce non c'è più: l'osservazione resta, su NOTE GENERALI
    });
    d.voci = voci;
    return { d, perse, aNg };
  }
  function cambiaModelloSede(S, imp, anno) {
    const ms = modelli(S) || MODELLI_BASE();
    const famiglia = (i) => (/bandiera/i.test(i.tipologia || '') ? 'bandiera' : 'carroponte');
    const corpo = `
      <label>Modello di scheda<select data-mod>${ms.map((m) => `<option value="${m.id}">${esc(m.nome)} (${m.voci.length} voci)</option>`).join('')}</select></label>
      <label>A quali gru<select data-quali><option value="tutte">Tutte le gru della sede (${imp.length})</option>
        <option value="carroponte">Solo carriponte (${imp.filter((i) => famiglia(i) === 'carroponte').length})</option>
        <option value="bandiera">Solo gru a bandiera (${imp.filter((i) => famiglia(i) === 'bandiera').length})</option></select></label>
      <label class="check"><input type="checkbox" data-anno checked> Aggiorna anche le schede ${anno} già iniziate</label>
      <div class="cm-riep" data-riep></div>`;
    const { ov, chiudi } = finestra('Cambia modello scheda', corpo, '<button type="button" class="btn ghost" data-chiudi>Annulla</button><span class="grow"></span><button type="button" class="btn" data-vai>Cambia modello</button>', 'cm-modal');
    const calcola = () => {
      const m = ms.find((x) => x.id === ov.querySelector('[data-mod]').value), q = ov.querySelector('[data-quali]').value, conAnno = ov.querySelector('[data-anno]').checked;
      const gru = imp.filter((i) => q === 'tutte' || famiglia(i) === q);
      const schede = conAnno ? gru.map((i) => schedaDi(S, i.id, anno)).filter(Boolean) : [];
      const perse = new Set(); let osNg = 0;
      schede.forEach((sc) => { const r = rifaiScheda(sc, m.voci); r.perse.forEach((t) => { if (nvTesto(t) !== 'NOTEGENERALI') perse.add(t); }); osNg += r.aNg; });
      ov.querySelector('[data-riep]').innerHTML = `<b>${gru.length} gru</b> passano al modello «${esc(m.nome)}».<br>${conAnno ? `${schede.length} schede del ${anno} vengono riformattate.` : `Le schede del ${anno} già iniziate restano come sono: il modello nuovo vale dalle schede nuove.`}
        ${perse.size ? `<br><span class="txt-ko">Voci del vecchio modello senza corrispondenza (i loro giudizi si perdono): ${[...perse].map(esc).join(', ')}</span>` : ''}
        ${osNg ? `<br>${osNg} osservazioni passano su NOTE GENERALI (restano tutte).` : ''}`;
      return { m, gru, schede, conAnno };
    };
    ov.querySelectorAll('select, input').forEach((x) => (x.onchange = calcola)); calcola();
    ov.querySelector('[data-vai]').onclick = async () => {
      const { m, gru, schede } = calcola();
      if (!UI.conferma(`Passare ${gru.length} gru al modello «${m.nome}»${schede.length ? ` e riformattare ${schede.length} schede del ${anno}` : ''}?`)) return;
      for (const i of gru) await UI.salva('impianti', { ...JSON.parse(JSON.stringify(i)), controllo: { modelloId: m.id, escluse: [] } });
      for (const sc of schede) { await copiaScheda(sc, `prima del cambio al modello «${m.nome}»`); await UI.salva('schedeControllo', rifaiScheda(sc, m.voci).d); }
      UT.registra('modifica', `Modello scheda «${m.nome}» per ${gru.length} gru${schede.length ? `, ${schede.length} schede ${anno} riformattate` : ''}`);
      chiudi(); UI.toast(`Fatto: ${gru.length} gru col modello «${m.nome}»`, 'ok');
    };
  }

  // ---------- AZZERA CONTROLLI (Master): griglia gru × 1°-4° ----------
  function azzeraControlli(S, imp, anno, p) {
    const vis = (i, n) => schedaDi(S, i.id, anno)?.visite?.[n];
    const corpo = `<p class="muted small">Spunta i controlli da cancellare. Toccando l'intestazione di una colonna selezioni tutto quel controllo. Le annotazioni (osservazioni A, B, C…) restano tutte: rifacendo il controllo le ritrovi aperte e tieni solo quelle che servono.</p>
      <div class="az-wrap"><table class="az-tab"><thead><tr><th>Gru</th>${[1, 2, 3, 4].map((n) => `<th><button type="button" class="link" data-col="${n}">${n}°<small>${MESI[meseVisita(p, n) - 1].slice(0, 3)}</small></button></th>`).join('')}</tr></thead>
      <tbody>${imp.map((i) => `<tr><td>${i.numeroInterno ? `<b>${esc(i.numeroInterno)}</b> ` : ''}${esc(IMP.titolo(i))}</td>${[1, 2, 3, 4].map((n) => `<td>${vis(i, n) ? `<input type="checkbox" data-az="${i.id}|${n}" aria-label="${n}° controllo">` : '<span class="muted">–</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    const { ov, chiudi } = finestra(`Azzera controlli ${anno}`, corpo, '<button type="button" class="btn ghost" data-chiudi>Annulla</button><span class="grow"></span><button type="button" class="btn ghost danger" data-vai disabled>🧹 Azzera (0)</button>', 'az-modal');
    const sel = () => [...ov.querySelectorAll('[data-az]:checked')];
    const agg = () => { const k = sel().length, b = ov.querySelector('[data-vai]'); b.disabled = !k; b.textContent = `🧹 Azzera (${k})`; };
    ov.querySelectorAll('[data-az]').forEach((c) => (c.onchange = agg));
    ov.querySelectorAll('[data-col]').forEach((b) => (b.onclick = () => {
      const cs = [...ov.querySelectorAll(`[data-az$="|${b.dataset.col}"]`)], tutte = cs.every((c) => c.checked);
      cs.forEach((c) => (c.checked = !tutte)); agg();
    }));
    ov.querySelector('[data-vai]').onclick = async () => {
      const lista = sel().map((c) => c.dataset.az.split('|'));
      if (!UI.conferma(`Azzerare ${lista.length} controlli?\n\nSi cancellano giudizi, valori e firme. Le annotazioni restano: rifacendo il controllo le ritrovi aperte. Non si torna indietro.`)) return;
      const per = {}; lista.forEach(([id, n]) => (per[id] = [...(per[id] || []), +n]));
      for (const [id, ns] of Object.entries(per)) {
        const sc = JSON.parse(JSON.stringify(schedaDi(S, id, anno)));
        await copiaScheda(sc, `prima di azzerare il ${ns.join('°, ')}° controllo`);
        // le annotazioni restano tutte (anche quelle nate in questi controlli); torna visibile quella «tolta» da qui
        ns.forEach((n) => { delete sc.visite[n]; (sc.osservazioni || []).forEach((o) => { if (o.tolta === n) delete o.tolta; }); });
        if (!Object.keys(sc.visite).length && !sc.noteInterne && !sc.osservazioni.length) await Backend.remove('schedeControllo', sc.id); else await UI.salva('schedeControllo', sc);
      }
      UT.registra('modifica', `Azzerati ${lista.length} controlli ${anno} (${Object.keys(per).length} gru)`);
      chiudi(); UI.toast(`Azzerati ${lista.length} controlli`, 'ok');
    };
  }

  // colori delle fascette sui riquadri dei controlli gru (per i clienti che le usano, es. Arcelor Mittal):
  // trimestrale verde, semestrale arancione, annuale blu
  const COL_FASC = { T: '#92d050', S: '#f59a23', A: '#00b0f0' };
  const ORDINI = ['Per numero (50/1, 50/2, 51/1)', 'Per campata (1/1, 2/1, 1/2)'];
  function modalePiano(S, c, s) {
    const p = piano(s);
    UI.modal({
      titolo: 'Piano controlli · ' + (s.nome || ''),
      infoTxt: '«Ordine delle gru»: se il numero interno è gru/campata (es. Caselette: 3/11 = gru 3, campata 11) scegli «per campata»: si ordina per il secondo numero; se è già campata/gru (es. 50/1) lascia «per numero». I 4 controlli sono a 3 mesi di distanza. L\'annuale comprende tutte le voci; due controlli dopo c\'è il semestrale (voci TRIM + SEME); gli altri due sono solo trimestrali.',
      valori: { mese1: MESI[p.mese1 - 1], annuale: p.annuale + '°', tutte: false, fascette: !!s.coloriFascette, ordine: s.ordineGru === 'secondo' ? ORDINI[1] : ORDINI[0] },
      campi: [
        { k: 'mese1', label: 'Mese del 1° controllo dell\'anno', tipo: 'select', opzioni: MESI.slice(0, 3), mezza: true },
        { k: 'annuale', label: 'Il controllo annuale è il', tipo: 'select', opzioni: ['1°', '2°', '3°', '4°'], mezza: true },
        { k: 'ordine', label: 'Ordine delle gru (numero interno)', tipo: 'select', opzioni: ORDINI },
        { k: 'fascette', label: 'Colori delle fascette sui controlli (trim. verde, sem. arancione, annuale blu)', tipo: 'sino' },
        ...((c.sedi || []).length > 1 ? [{ k: 'tutte', label: `Applica lo stesso piano a tutte le sedi di ${CLI.nome(c)}`, tipo: 'sino' }] : [])
      ],
      onSalva: async (v) => {
        const pc = { mese1: Math.max(1, MESI.indexOf(v.mese1) + 1), annuale: parseInt(v.annuale, 10) || 1 };
        const d = JSON.parse(JSON.stringify(c));
        d.sedi.forEach((x) => { if (x.id === s.id || v.tutte) x.pianoControlli = pc; });
        d.sedi.forEach((x) => { if (x.id === s.id || (v.tutte && v.fascette)) { if (v.fascette) x.coloriFascette = true; else if (x.id === s.id) delete x.coloriFascette; } });
        d.sedi.forEach((x) => { if (x.id === s.id) { if (v.ordine === ORDINI[1]) x.ordineGru = 'secondo'; else delete x.ordineGru; } });   // l'ordine vale solo per questa sede
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
          <span class="imp-ico">${IMP.icona(i)}</span>
          <div class="grow">
            <h1>${i.numeroInterno ? `N° ${esc(i.numeroInterno)} · ` : ''}${esc(IMP.titolo(i))}</h1>
            <p class="muted small"><a class="link-anag" href="#/controlli/s/${i.sedeId}?anno=${anno}">${esc(c ? nomeSede(c, s) : '')}</a>${i.matricola ? ' · matr. ' + esc(i.matricola) : ''}</p>
          </div>
          <div class="anno anno-mini"><a href="#/controlli/i/${impId}?anno=${anno - 1}" aria-label="Anno prima">‹</a><b>${anno}</b><a href="#/controlli/i/${impId}?anno=${anno + 1}" aria-label="Anno dopo">›</a></div>
          ${UI.menu([
            UT.puo('stampa') && { t: `🖨️ Stampa scheda ${anno}`, href: `#/controlli/i/${impId}/${anno}/stampa` },
            !UT.solaLettura() && UT.puo('ctr.voci') && { t: '⚙ Voci di questo impianto', id: 'btnVoci' },
            UT.puo('ctr.modelloSede') && sc && { t: '💾 Salva queste voci come modello', id: 'btnComeModello' },
            UT.puo('ctr.modelloSede') && sc && { t: '🕘 Versioni di prima della scheda', id: 'btnCopie' },
            { t: '🏗️ Anagrafica impianto', href: `#/impianti/i/${impId}` }
          ])}
        </div>
        <div class="striscia">${[1, 2, 3, 4].map((n) => { const vis = sc?.visite?.[n], t = tipoVisita(p, n), nf = nonFatte(n);
          return `<a class="st-v t-${t} ${vis ? 'fatto' : ''}" href="#/controlli/i/${impId}/${anno}/${n}" title="${nomeTipo(t)}${vis?.tecnico ? ' · ' + esc(vis.tecnico) : ''}"><b>${n}° ${MESI[meseVisita(p, n) - 1].slice(0, 3)}</b><span>${vis ? '✓ ' + fmt(vis.dataScheda).slice(0, 5) : (t === 'T' ? 'TRIM' : t === 'S' ? 'SEME' : 'ANN')}${nf ? ` · <b class="txt-ko">${nf}✗</b>` : ''}</span></a>`; }).join('')}</div>
        <div class="card">
          <div class="card-head"><h2>Osservazioni ${anno} ${info('Le osservazioni restano sulla scheda per tutto l\'anno. Quando un problema viene risolto, segnalo come sistemato: sulla scheda comparirà con [OK e la data].')}</h2></div>
          ${oss.length ? oss.map((o) => `<div class="oss-riga ${o.risoltaIl ? 'risolta' : ''}"><b class="oss-l">${esc(o.lettera)}</b>
              <div class="grow">${esc(o.testo)}${o.versioni ? `<div class="muted small">prima: ${o.versioni.slice(0, -1).map((x) => '«' + esc(x.testo) + '»').join(', ')} · cambiata dal ${o.versioni[o.versioni.length - 1].dal}° controllo</div>` : ''}<div class="muted small">${esc(vocNome(voci, o.vocId))}${np > 1 && o.p ? ' · P' + o.p : ''} · ${o.visita ? o.visita + '° controllo' : 'dal ' + (o.daAnno || anno - 1)}${o.risoltaIl ? ` · <b class="txt-ok">[OK ${fmt(o.risoltaIl)}]</b>` : ''}${o.tolta ? ` · <b class="muted">tolta dal ${o.tolta}° controllo</b>` : ''}</div></div>
              ${UT.solaLettura() ? '' : `<div class="oss-bt"><button class="btn ghost small" data-modoss="${o.lettera}" aria-label="Modifica il testo">✏️</button><button class="btn ghost small" data-oss="${o.lettera}">${o.risoltaIl ? 'Riapri' : '✓ Sistemata'}</button></div>`}</div>`).join('')
            : '<p class="muted">Nessuna osservazione.</p>'}
        </div>
        ${!UT.solaLettura() || scV.noteInterne ? `<div class="card"><div class="card-head"><h2>📝 Note Gru Impianti ${anno} ${info('Appunti nostri: NON compaiono sulla scheda stampata o inviata al cliente.')}</h2></div>
          <textarea id="noteInt" rows="3" data-libero placeholder="appunti per noi…" ${UT.solaLettura() ? 'readonly' : ''}>${esc(scV.noteInterne || '')}</textarea>
          ${UT.solaLettura() ? '' : '<div class="azioni-form"><span class="grow"></span><button type="button" class="btn ghost small" id="btnNoteInt">Salva note</button></div>'}</div>` : ''}
        ${sc?.noteVecchie ? `<div class="card"><div class="card-head"><h2>Note dal programma vecchio ${info('Note interne scritte sul programma vecchio per questo impianto in quest\'anno. Non compaiono sulla scheda del cliente. Se servono, spostale nelle note Gru Impianti; altrimenti eliminale.')}</h2></div><p class="note-vecchie">${esc(sc.noteVecchie)}</p>
          ${UT.solaLettura() ? '' : '<div class="azioni-form"><button type="button" class="btn ghost small danger" id="btnVecchieVia">🗑 Elimina</button><span class="grow"></span><button type="button" class="btn ghost small" id="btnVecchieSposta">↧ Sposta nelle note Gru Impianti</button></div>'}</div>` : ''}
      </section>`;
    el.querySelector('#btnVoci')?.addEventListener('click', () => modaleVoci(S, i, anno));
    el.querySelector('#btnCopie')?.addEventListener('click', async () => {
      let copie = [];
      try { copie = (await Backend.cerca('copie', 'docId', sc.id)).sort((a, b) => (b.quando || '').localeCompare(a.quando || '')); } catch (e) { return UI.toast('Serve internet per leggere le versioni di prima', 'err'); }
      if (!copie.length) return UI.toast('Nessuna versione di prima salvata per questa scheda', 'ok');
      const { ov, chiudi } = finestra(`Versioni di prima · scheda ${anno}`, `<p class="muted small">Prima di cambiare le voci di una scheda (cambio modello, voci tolte) l'app ne salva una copia. Rimettendo una versione, quella di adesso diventa a sua volta una copia.</p>
        ${copie.map((c) => `<div class="rec-riga"><div class="grow"><b>${fmt(c.quando.slice(0, 10))} ${c.quando.slice(11, 16)}</b> · ${esc(c.da || '')}<br><small class="muted">${esc(c.motivo || '')} · ${(c.doc.voci || []).length} voci · ${Object.keys(c.doc.visite || {}).length} controlli</small></div><button class="btn small" data-rimetti="${esc(c.id)}">↺ Rimetti</button></div>`).join('')}`,
        '<span class="grow"></span><button type="button" class="btn ghost" data-chiudi>Chiudi</button>', 'cm-modal');
      ov.querySelectorAll('[data-rimetti]').forEach((b) => (b.onclick = async () => {
        const c = copie.find((x) => x.id === b.dataset.rimetti);
        if (!UI.conferma(`Rimettere la scheda com'era il ${fmt(c.quando.slice(0, 10))} (${(c.doc.voci || []).length} voci)?`)) return;
        const attuale = schedaDi(S, i.id, anno);
        await copiaScheda(attuale, 'prima di rimettere una versione di prima');
        const d = JSON.parse(JSON.stringify(c.doc)); d._rev = attuale?._rev; d._storia = attuale?._storia || [];
        await UI.salva('schedeControllo', d);
        UT.registra('modifica', `Scheda ${anno} di ${IMP.titolo(i)}: rimessa la versione del ${fmt(c.quando.slice(0, 10))}`);
        chiudi(); UI.toast('Versione rimessa', 'ok');
      }));
    });
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
          x.testo = String(v.testo || '').trim().toUpperCase(); if (x.versioni) x.versioni[x.versioni.length - 1].testo = x.testo;   // corregge il testo più recente
          if (o.risoltaIl && v.data) x.risoltaIl = v.data;
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

  // Voci di un impianto. Se la scheda dell'anno esiste, si vedono e si modificano le SUE voci (quelle che usa davvero,
  // anche se arrivano dal programma vecchio); altrimenti quelle del modello assegnato.
  function modaleVoci(S, i, anno) {
    const ms = modelli(S) || MODELLI_BASE(); const m = modelloDi(S, i);
    const sc = anno ? schedaDi(S, i.id, anno) : null;
    const escl = i.controllo?.escluse || [];
    const elenco = sc ? sc.voci : m.voci;
    const spuntata = (v) => (sc ? true : !escl.includes(v.id));
    UI.modal({
      titolo: 'Voci di questo impianto', largo: true,
      infoTxt: (sc ? `Queste sono le voci della scheda ${anno} di questo impianto, quelle che usa davvero nei controlli. Togliendo la spunta la voce sparisce dalla scheda ${anno} (tutti e 4 i controlli). «Modello di scheda» decide invece le voci delle schede nuove (per esempio l\'anno prossimo). ` : 'Togli la spunta alle voci che su questo impianto non si fanno (es. freno ausiliario se non c\'è il motore ausiliario). Per cambiare le voci di tutti gli impianti usa «Modelli di scheda». ')
        + 'Se in fondo scrivi un nome, con le voci spuntate nasce un modello nuovo (che puoi usare anche per altre gru) e questo impianto passa a quel modello.',
      valori: { modello: m.nome, applica: true, ...Object.fromEntries(elenco.map((v) => ['v_' + v.id, spuntata(v)])) },
      campi: [{ k: 'modello', label: sc ? 'Modello di scheda (per le schede nuove)' : 'Modello di scheda', tipo: 'select', opzioni: ms.map((x) => x.nome) },
        ...(sc ? [{ tipo: 'titolo', label: `Voci della scheda ${anno}` }] : []),
        ...['T', 'S', 'A'].flatMap((pp) => { const vv = elenco.filter((v) => v.per === pp); return vv.length ? [{ tipo: 'titolo', label: PER_NOME[pp] }, ...vv.map((v) => ({ k: 'v_' + v.id, label: v.testo, tipo: 'sino', mezza: true }))] : []; }),
        { tipo: 'titolo', label: 'Nuovo modello (facoltativo)' },
        { k: 'nuovoNome', label: 'Crea un modello con le voci spuntate: scrivi il nome', placeholder: 'es. SEGHETTO TRAMET', maiuscolo: true },
        ...(sc ? [{ k: 'applica', label: `Se cambio modello, usa subito le sue voci anche nella scheda ${anno} già iniziata (i giudizi delle voci con lo stesso nome restano)`, tipo: 'sino' }] : [])],
      onSalva: async (v) => {
        const nome = String(v.nuovoNome || '').trim().toUpperCase();
        const tenute = elenco.filter((x) => v['v_' + x.id]), tolte = elenco.filter((x) => !v['v_' + x.id]);
        if (!tenute.length) { UI.toast('Spunta almeno una voce', 'err'); return false; }
        // 1) voci tolte dalla scheda dell'anno
        let scOra = sc;   // la scheda dell'anno com'è dopo le modifiche di questo salvataggio
        // la scheda dell'anno prende le voci del modello nuovo (stesse voci per nome: i giudizi restano)
        const applicaAllaScheda = async (mod) => {
          if (!scOra || !v.applica) return;
          const r = rifaiScheda(scOra, mod.voci), perse = r.perse.filter((t) => nvTesto(t) !== 'NOTEGENERALI');
          if (perse.length && !UI.conferma(`Nella scheda ${anno} queste voci non ci sono nel modello «${mod.nome}» e spariscono (con i loro giudizi):\n\n${perse.map((t) => '• ' + t).join('\n')}\n\nContinuare?`)) return;
          await copiaScheda(scOra, `prima del cambio al modello «${mod.nome}»`);
          await UI.salva('schedeControllo', r.d);
          UT.registra('modifica', `Scheda ${anno} di ${IMP.titolo(i)} passata al modello «${mod.nome}»`);
        };
        if (sc && tolte.length) {
          const usate = tolte.filter((x) => Object.values(sc.visite || {}).some((vis) => (vis.esiti?.[x.id] || []).some(Boolean)));
          if (!UI.conferma(`Togliere ${tolte.length} ${tolte.length === 1 ? 'voce' : 'voci'} dalla scheda ${anno}?\n\n${tolte.map((x) => '• ' + x.testo).join('\n')}${usate.length ? `\n\n${usate.length} ${usate.length === 1 ? 'ha' : 'hanno'} già dei giudizi nei controlli fatti: si perdono.` : ''}`)) return false;
          await copiaScheda(sc, `prima di togliere ${tolte.length} voci`);
          const d = JSON.parse(JSON.stringify(sc)), via = new Set(tolte.map((x) => x.id));
          d.voci = d.voci.filter((x) => !via.has(x.id));
          Object.values(d.visite || {}).forEach((vis) => { via.forEach((id) => { if (vis.esiti) delete vis.esiti[id]; if (vis.valori) delete vis.valori[id]; }); });
          (d.osservazioni || []).forEach((o) => { if (via.has(o.vocId)) { o.vocId = ''; o.p = null; } });
          await UI.salva('schedeControllo', d); scOra = d;
          UT.registra('modifica', `Tolte ${tolte.length} voci dalla scheda ${anno} di ${IMP.titolo(i)}`);
        }
        // 2) modello nuovo con le voci spuntate: l'impianto passa al modello nuovo
        if (nome) {
          const nm = await aggiungiModello(S, nome, tenute);
          if (!nm) { UI.toast('Esiste già un modello con questo nome', 'err'); return false; }
          await UI.salva('impianti', { ...JSON.parse(JSON.stringify(i)), controllo: { modelloId: nm.id, escluse: [] } });
          await applicaAllaScheda(nm);
          UT.registra('modifica', `Modello di scheda «${nome}» creato dalle voci di ${IMP.titolo(i)}`);
          UI.toast(`Modello «${nome}» creato (${tenute.length} voci) e assegnato a questo impianto`, 'ok');
          return;
        }
        // 3) modello per le schede nuove
        const scelto = ms.find((x) => x.nome === v.modello) || m;
        const d = JSON.parse(JSON.stringify(i));
        d.controllo = { modelloId: scelto.id, escluse: !sc && scelto.id === m.id ? m.voci.filter((x) => !v['v_' + x.id]).map((x) => x.id) : (scelto.id === m.id ? escl : []) };
        await UI.salva('impianti', d);
        if (scelto.id !== m.id) await applicaAllaScheda(scelto);
        UI.toast(sc ? (tolte.length ? 'Voci della scheda aggiornate' : scelto.id === m.id ? 'Salvato' : `Modello «${scelto.nome}» per le schede nuove`) : scelto.id === m.id ? 'Voci aggiornate' : 'Modello cambiato: riapri per scegliere le voci', 'ok');
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
    // riquadro rosso sopra la voce: osservazioni ancora aperte (nate prima) e quelle nate in questo controllo
    const etichettaOss = (o) => (o.risoltaIl ? `✓ <b>${esc(o.lettera)}</b> ${esc(testoOss(o, n))} [OK ${fmt(o.risoltaIl)}]` : `⚠ ${o.visita === n ? 'nuova in questo controllo' : 'ancora aperta'} · <b>${esc(o.lettera)}</b> ${esc(testoOss(o, n))}`);
    const rigaOss = (o) => `<div class="oss-aperta" data-l="${esc(o.lettera)}">${etichettaOss(o)}</div>`;
    const sullaVoce = (vocId, pi) => osservazioni.filter((o) => o.vocId === vocId && (o.p || 1) === pi && !o.risoltaIl && !tolta(o, n) && o.visita <= n);
    const aperte = (vocId, pi) => osservazioni.filter((o) => o.vocId === vocId && (o.p || 1) === pi && !o.risoltaIl && !tolta(o, n) && (o.visita < n || (o.visita === n && !prima)));
    // valori iniziali: per le anomalie ancora aperte riporto la lettera
    leggiVisita(vis, voci);
    voci.forEach((v) => {
      if (haValore(v)) vis.valori[v.id] = vis.valori[v.id] || Array(np).fill('');
      vis.esiti[v.id] = vis.esiti[v.id] || Array(np).fill('');
      for (let pi = 1; pi <= np; pi++) if (!vis.esiti[v.id][pi - 1]) { const a = aperte(v.id, pi)[0]; if (a && !prima) vis.esiti[v.id][pi - 1] = a.lettera; }
      // un'anomalia nuova di questo controllo deve avere la sua lettera nella casella (anche se ci sono già X, R, misura…)
      for (let pi = 1; pi <= np; pi++) { const o = sullaVoce(v.id, pi).find((k) => k.visita === n), ora = vis.esiti[v.id][pi - 1] || ''; if (o && !letteraDi(ora)) vis.esiti[v.id][pi - 1] = componiEsito(o.lettera, codiciDi(ora)); }
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
    const fsAperta = osservazioni.find((o) => !o.risoltaIl && !tolta(o, n) && /FUORI SERVIZIO PROVVISORIO/.test(o.testo) && (o.visita < n || (o.visita === n && !prima))) || null;
    const prossimaLettera = () => { const usate = osservazioni.map((o) => o.lettera); let k = 0; let l; do { l = k < 26 ? String.fromCharCode(65 + k) : 'A' + String.fromCharCode(65 + k - 26); k++; } while (usate.includes(l)); return l; };

    el.innerHTML = `
      <form class="sg form" id="fVis" novalidate>
        ${CONF.avvisoAltro(prima, `Il ${n}° controllo ${anno} di questo impianto`)}
        <div class="vis-testa t-${tipo}">
          <div class="grow"><b>${n}° controllo ${anno} · ${nomeTipo(tipo)}</b> <span>${MESI[mese - 1]}</span>
            <div class="vis-imp">${i.numeroInterno ? `N° ${esc(i.numeroInterno)} · ` : ''}${esc(IMP.titolo(i))} · ${esc(c ? nomeSede(c, s) : '')}</div></div>
          ${UI.menu([prima && !UT.solaLettura() && UT.puo('ctr.elimina') && { t: '🗑 Elimina questo controllo', id: 'btnElimina', cls: 'txt-ko' }, { t: '📋 Scheda dell\'anno', href: `#/controlli/i/${impId}?anno=${anno}` }, { t: '🏗️ Anagrafica impianto', href: `#/impianti/i/${impId}` }])}
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
                <div class="gi-head"><b>${esc(v.testo)}</b>${UT.isDev() && !UT.solaLettura() ? `<button type="button" class="voc-via" data-vocvia="${v.id}" title="Togli questa voce dalla scheda" aria-label="Togli questa voce dalla scheda">🗑</button>` : ''}</div>
                ${Array.from({ length: np }, (_, k) => k + 1).map((pi) => `
                  <div class="gi-parte" data-p="${pi}">
                    ${np > 1 ? `<div class="gi-comp">P${pi} · paranco ${esc((i.paranchi[pi - 1]?.ruolo || '').toLowerCase())}</div>` : ''}
                    ${sullaVoce(v.id, pi).map(rigaOss).join('')}
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
          <h2>Osservazioni dell'anno ${info('Tocca un\'osservazione (anche il riquadro rosso sulla voce o la lettera) per correggerla o segnarla [OK]: con «OK» salvi e torni dove eri, con «Indietro» esci senza salvare. Con 🗑 togli un\'osservazione senza scrivere [OK]. Se è nata in un controllo prima puoi scegliere: «solo da questo controllo in poi» (nei controlli già fatti resta com\'era) oppure «da tutto l\'anno» (sparisce anche dalle caselle dei controlli già fatti). Vale quando salvi il controllo. Se invece il problema è stato risolto, scrivi [OK e la data] dalla pagina dell\'impianto con ✏️.')}</h2>
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
          <button class="btn big" type="submit" data-dopo="sede">✓ Concludi controllo<small>Non serve salvare: tornando indietro si salva da solo</small></button>
        </div>
      </form>`;

    const f = el.querySelector('#fVis');
    const box = (vid, pi) => el.querySelector(`.cv-item[data-v="${vid}"] .gi-parte[data-p="${pi}"]`);
    const isLettera = (x) => /^[A-Z]{1,2}$/.test(x) && !CODICI.some(([k]) => k === x);
    const mostra = (v, pi) => {
      const b = box(v.id, pi), val = vis.esiti[v.id][pi - 1] || '';
      const scelti = codiciDi(val);
      b.querySelectorAll('.cod-btn').forEach((x) => x.classList.toggle('on', scelti.includes(x.dataset.c)));
      const vv = b.querySelector('[data-val]'); if (vv && document.activeElement !== vv) vv.value = vis.valori[v.id]?.[pi - 1] || '';
      const lt = letteraDi(val) || sullaVoce(v.id, pi)[0]?.lettera || '';
      b.querySelector('.val-lettera').innerHTML = lt ? `<span class="lettera-on">${esc(lt)}</span>` : '';
      b.classList.toggle('fatto', !!val); b.classList.remove('manca');
      el.querySelector('#nFatti').textContent = voci.reduce((t, x) => t + vis.esiti[x.id].filter(Boolean).length, 0);
    };
    const disegnaOss = () => {
      const visibili = osservazioni.filter((o) => !tolta(o, n));
      el.querySelector('#ossLista').innerHTML = visibili.length ? visibili.map((o) => `
        <div class="oss-riga ${o.risoltaIl ? 'risolta' : ''}"><b class="oss-l">${esc(o.lettera)}</b><div class="grow">${esc(testoOss(o, n))}
          <div class="muted small">${esc(vocNome(sc.voci, o.vocId) || 'osservazione generale')}${np > 1 && o.p ? ' · P' + o.p : ''} · ${o.visita ? o.visita + '° controllo' : 'dal ' + (o.daAnno || anno - 1)}${o.risoltaIl ? ' · [OK ' + fmt(o.risoltaIl) + ']' : ''}</div></div>
          ${UT.solaLettura() ? '' : `<button type="button" class="btn ghost small danger" data-togli="${o.lettera}" aria-label="Elimina l'osservazione" title="Elimina l'osservazione">🗑</button>`}</div>`).join('') : '<p class="muted">Nessuna osservazione.</p>';
      el.querySelectorAll('[data-togli]').forEach((b) => (b.onclick = async () => {
        const o = osservazioni.find((x) => x.lettera === b.dataset.togli);
        // quelle nate in questo controllo si tolgono e basta; per le altre scegli tu come
        const modo = o.visita === n ? 'tutto' : await sceltaElimina(o);
        if (modo) togliOss(o, modo);
      }));
    };
    // toglie un'osservazione: 'tutto' = da tutto l'anno, 'dopo' = da questo controllo in poi
    function togliOss(o, modo) {
        const visita = (x) => (x === vis ? n : +Object.keys(sc.visite || {}).find((k) => sc.visite[k] === x));
        if (modo === 'tutto') osservazioni.splice(osservazioni.indexOf(o), 1);
        else o.tolta = n;   // resta nei controlli prima, da questo in poi non compare più
        // la lettera sparisce dalle caselle: di tutti i controlli dell'anno, oppure solo da questo in poi
        for (const x of [vis, ...Object.values(sc.visite || {})]) {
          if (modo === 'dopo' && visita(x) < n) continue;
          const es = x?.esiti?.[o.vocId], k = (o.p || 1) - 1; if (es && letteraDi(es[k]) === o.lettera) es[k] = togliLettera(es[k], o.lettera);
        }
        el.querySelectorAll('.oss-aperta').forEach((d) => { if (d.dataset.l === o.lettera) d.remove(); });
        const v = voci.find((x) => x.id === o.vocId); if (v) mostra(v, o.p || 1);
        disegnaOss(); sporco = true;
        UI.toast(`Osservazione ${o.lettera} tolta${modo === 'dopo' ? ` dal ${n}° controllo in poi` : ''}${o.visita !== n ? ': salva il controllo per confermare' : ''}`, 'ok');
    }
    // ---- tocco su un'annotazione (riquadro sulla voce, lettera nella casella o riga dell'elenco): si apre la modifica.
    // «OK» salva e torni dove eri; «Indietro» (anche il gesto indietro del telefono) chiude senza salvare.
    const apriOss = (lettera) => {
      const o = osservazioni.find((x) => x.lettera === lettera); if (!o) return;
      const y = window.scrollY, dataOk = o.risoltaIl || f.dataScheda.value || oggi();
      const ov = document.createElement('div'); ov.className = 'modal-ov';
      ov.innerHTML = `<div class="modal oss-mod"><div class="modal-head"><h2><b class="oss-l">${esc(o.lettera)}</b> Osservazione</h2></div>
        <div class="modal-body">
          <p class="muted small">${esc(vocNome(sc.voci, o.vocId) || 'osservazione generale')}${np > 1 && o.p ? ' · P' + o.p : ''} · ${o.visita ? o.visita + '° controllo' : 'dal ' + (o.daAnno || anno - 1)}</p>
          <label>Testo (cambia da questo controllo in poi)<textarea rows="4" data-t>${esc(testoOss(o, n))}</textarea></label>
          ${o.versioni ? `<p class="muted small">Testi precedenti: ${o.versioni.filter((x) => x.dal < n).map((x) => `${x.dal ? 'dal ' + x.dal + '°' : 'all\'inizio'}: «${esc(x.testo)}»`).join(' · ')}</p>` : ''}
          <label class="check oss-ok"><input type="checkbox" data-ok ${o.risoltaIl ? 'checked' : ''}> Sistemata: scrivi [OK e la data]</label>
          <label data-dbox ${o.risoltaIl ? '' : 'hidden'}>Data dell'OK<input type="date" data-d value="${dataOk}"></label>
          ${UT.solaLettura() ? '' : `<button type="button" class="btn ghost danger oss-via" data-via>🗑 ${o.visita === n && !o.daAnno ? 'Elimina questa annotazione' : 'Togli da questo controllo in poi'}<small>${o.visita === n && !o.daAnno ? 'È nata in questo controllo: sparisce del tutto.' : 'Nei controlli già fatti resta com\'era; da qui in avanti non compare più, senza [OK].'}</small></button>`}
        </div>
        <div class="modal-foot"><button type="button" class="btn ghost" data-no>‹ Indietro</button><span class="grow"></span><button type="button" class="btn big oss-si" data-si>OK</button></div></div>`;
      const ok = ov.querySelector('[data-ok]'), dbox = ov.querySelector('[data-dbox]');
      ok.onchange = () => (dbox.hidden = !ok.checked);
      let aperta = true;
      const chiudi = (salva) => {
        if (!aperta) return; aperta = false;
        if (salva) {
          const t = ov.querySelector('[data-t]').value.trim().toUpperCase();
          cambiaTesto(o, n, t);   // nei controlli prima resta il testo di prima
          if (ok.checked) {
            o.risoltaIl = ov.querySelector('[data-d]').value || f.dataScheda.value || oggi();
            if (o.vocId && letteraDi(vis.esiti[o.vocId]?.[(o.p || 1) - 1]) === o.lettera) vis.esiti[o.vocId][(o.p || 1) - 1] = togliLettera(vis.esiti[o.vocId][(o.p || 1) - 1], o.lettera, 'R');   // sistemata in questo controllo
          } else delete o.risoltaIl;
          el.querySelectorAll(`.oss-aperta[data-l="${CSS.escape(o.lettera)}"]`).forEach((d) => (d.innerHTML = etichettaOss(o)));
          const v = voci.find((x) => x.id === o.vocId); if (v) mostra(v, o.p || 1);
          disegnaOss(); sporco = true;
        }
        ov.remove(); document.body.classList.remove('modal-aperto');
        window.removeEventListener('popstate', indietro);
        if (history.state?.ossAperta) history.back();   // tolgo il passo aggiunto per il gesto indietro
        window.scrollTo(0, y);   // riparti esattamente da dove eri
      };
      const indietro = () => { if (aperta) { history.replaceState(null, ''); chiudi(false); } };
      ov.querySelector('[data-no]').onclick = () => chiudi(false);
      ov.querySelector('[data-via]')?.addEventListener('click', () => { chiudi(false); togliOss(o, o.visita === n && !o.daAnno ? 'tutto' : 'dopo'); });
      ov.querySelector('[data-si]').onclick = () => chiudi(true);
      document.body.appendChild(ov); document.body.classList.add('modal-aperto');
      // il gesto indietro del telefono chiude la finestra senza salvare (e non esce dal controllo)
      history.pushState({ ossAperta: true }, ''); window.addEventListener('popstate', indietro);
    };
    // Developer: togli una voce da QUESTA scheda (tutti e 4 i controlli dell'anno), con doppia conferma
    el.querySelectorAll('[data-vocvia]').forEach((b) => (b.onclick = () => {
      const v = voci.find((x) => x.id === b.dataset.vocvia); if (!v) return;
      const usata = Object.values(sc.visite || {}).filter((x) => (x.esiti?.[v.id] || []).some(Boolean)).length;
      const legate = osservazioni.filter((o) => o.vocId === v.id).length;
      if (!UI.conferma(`Togliere la voce «${v.testo}» da questa scheda ${anno}?\n\nVale solo per questo impianto e sparisce da tutti e 4 i controlli dell'anno${usata ? ` (ha giudizi in ${usata} controll${usata === 1 ? 'o' : 'i'} già fatt${usata === 1 ? 'o' : 'i'}: si perdono)` : ''}.${legate ? `\n${legate} osservazion${legate === 1 ? 'e resta' : 'i restano'} come osservazioni generali.` : ''}`)) return;
      if (!UI.conferma(`Sei sicuro? La voce «${v.testo}» viene eliminata dalla scheda. Non si torna indietro dopo il salvataggio.`)) return;
      sc.voci = sc.voci.filter((x) => x.id !== v.id);
      voci.splice(voci.indexOf(v), 1);
      for (const x of [vis, ...Object.values(sc.visite || {})]) { if (x?.esiti) delete x.esiti[v.id]; if (x?.valori) delete x.valori[v.id]; }
      osservazioni.forEach((o) => { if (o.vocId === v.id) { o.vocId = ''; o.p = null; } });
      el.querySelector(`.cv-item[data-v="${CSS.escape(v.id)}"]`)?.remove();
      const tot = el.querySelector('.vis-tools .progress'); if (tot) tot.innerHTML = `<b id="nFatti">${voci.reduce((t, x) => t + vis.esiti[x.id].filter(Boolean).length, 0)}</b>/${voci.length * np}`;
      disegnaOss(); sporco = true;
      UI.toast(`Voce «${v.testo}» tolta: salva il controllo per confermare`, 'ok');
    }));
    f.addEventListener('click', (e) => {
      const t = e.target.closest('.oss-aperta[data-l], .val-lettera .lettera-on, #ossLista .oss-riga .grow');
      if (!t) return;
      const l = t.dataset.l || t.closest('.oss-aperta')?.dataset.l || (t.classList.contains('lettera-on') ? t.textContent.trim() : t.closest('.oss-riga')?.querySelector('[data-togli]')?.dataset.togli || t.closest('.oss-riga')?.querySelector('.oss-l')?.textContent.trim());
      if (l) apriOss(l);
    });
    const nuovaOss = (v, pi) => UI.modal({
      titolo: v ? `Anomalia · ${v.testo}${np > 1 ? ' · P' + pi : ''}` : 'Osservazione',
      infoTxt: 'Scrivi il problema come vuoi che compaia sulla scheda (es. «RIVEDERE SALDATURE SU STAFFA SOSTEGNO MOTORE CARRO»).',
      campi: [{ k: 'testo', label: 'Descrizione', tipo: 'textarea', req: true, maiuscolo: true }],
      testoSalva: 'Aggiungi',
      onSalva: (x) => {
        const lettera = prossimaLettera();
        const o = { lettera, testo: x.testo, vocId: v?.id || '', p: v ? pi : null, visita: n, data: f.dataScheda.value || oggi() };
        osservazioni.push(o);
        if (v) {
          vis.esiti[v.id][pi - 1] = componiEsito(lettera, codiciDi(vis.esiti[v.id][pi - 1])); mostra(v, pi);   // i codici già messi restano
          box(v.id, pi).querySelector('.gi-row').insertAdjacentHTML('beforebegin', rigaOss(o));                 // il riquadro rosso sopra la voce, come per quelle già aperte
        }
        sporco = true;
        disegnaOss();
      }
    });
    voci.forEach((v) => { for (let pi = 1; pi <= np; pi++) {
      const b = box(v.id, pi);
      // tocco su un codice: si accende o si spegne; se ce n'è già un altro restano tutti e due (es. X e R)
      b.querySelectorAll('.cod-btn').forEach((x) => (x.onclick = () => {
        const ora = vis.esiti[v.id][pi - 1] || '', c = codiciDi(ora);
        const nuovi = c.includes(x.dataset.c) ? c.filter((k) => k !== x.dataset.c) : [...c, x.dataset.c];
        vis.esiti[v.id][pi - 1] = componiEsito(letteraDi(ora), nuovi); mostra(v, pi);   // la lettera dell'osservazione resta
      }));
      // scrivere un valore vuol dire che la voce è stata controllata: se manca il codice metto X
      const vv = b.querySelector('[data-val]'); if (vv) vv.oninput = () => { vis.valori[v.id][pi - 1] = vv.value.trim(); if (vv.value.trim() && !vis.esiti[v.id][pi - 1]) vis.esiti[v.id][pi - 1] = 'X'; mostra(v, pi); };
      b.querySelector('[data-anom]').onclick = () => nuovaOss(v, pi);
      b.querySelectorAll('[data-sistema]').forEach((x) => (x.onclick = () => {
        const o = osservazioni.find((y) => y.lettera === x.dataset.sistema);
        o.risoltaIl = f.dataScheda.value || oggi();
        if (letteraDi(vis.esiti[v.id][pi - 1]) === o.lettera) vis.esiti[v.id][pi - 1] = togliLettera(vis.esiti[v.id][pi - 1], o.lettera, 'R');
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
      Object.keys(vis.esiti).forEach((k) => (vis.esiti[k] = vis.esiti[k].map((x) => togliLettera(x, fsAperta.lettera))));
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
        if (!UI.conferma(`${manc.length} voci non eseguite. Nell'app resteranno segnate come non eseguite; sulla scheda del cliente compariranno con la X. Concludere il controllo?`)) return;
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
      App.ricordaTecnico(vis.tecnico); UI.toast('✓ Controllo concluso e salvato', 'ok');
      // aperto dal layout: si torna alla pianta (anche con «Salva e prossimo» si resta nel giro del layout)
      location.hash = (e.submitter?.dataset.dopo === 'prossimo' && prossimoImp) ? `#/controlli/i/${prossimoImp.id}/${anno}/${n}${torna ? '?torna=' + encodeURIComponent(torna) : ''}` : torna || '#/controlli/s/' + i.sedeId + '?anno=' + anno;
    };
    // ---- salvataggio automatico: se esci (freccia, gesto indietro, altra gru) quello che hai fatto si salva da solo.
    // Se mancano voci il controllo resta «⏸ in corso» e la gru resta tra quelle da fare; lo chiudi tu con «Concludi controllo».
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
      if (esistente) await copiaScheda(esistente, `prima di eliminare il ${n}° controllo`);
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
    // ---- recupero: modelli assegnati a delle gru ma spariti dalla lista ----
    const mancanti = [...new Set(S.impianti.map((i) => i.controllo?.modelloId).filter((id) => id && !ms.some((x) => x.id === id)))].map((id) => {
      const gru = S.impianti.filter((i) => i.controllo?.modelloId === id);
      // le voci dalla scheda più recente di quelle gru (le schede tengono una copia delle voci del modello)
      const sc = S.schedeControllo.filter((x) => gru.some((i) => i.id === x.impiantoId) && (x.voci || []).length)
        .sort((a, b) => (b.anno - a.anno) || (Object.keys(b.visite || {}).length - Object.keys(a.visite || {}).length))[0];
      const cli = sc ? trovaSede(S, sc.sedeId).c : null;
      return { id, gru, sc, nome: cli ? CLI.nome(cli).split(/\s+/)[0] : 'RECUPERATO' };
    });
    const copia = (S.impostazioni.find((x) => x.id === 'modelliScheda~copia') || {});
    const inCopia = (copia.modelli || []).filter((x) => !ms.some((y) => y.id === x.id));
    el.innerHTML = `
      <section class="sg">
        ${mancanti.length || inCopia.length ? `<div class="card avviso-rec">
          <h2>⚠️ Modelli da recuperare ${info('Questi modelli sono assegnati a delle gru ma non ci sono più nella lista (per esempio perché un dispositivo con una copia vecchia l\'ha salvata sopra). Si possono ricreare con le voci delle schede di quelle gru, che ne tengono una copia: le gru tornano subito al loro modello.')}</h2>
          ${mancanti.map((x) => `<div class="rec-riga"><div class="grow"><b>${x.gru.length} gru</b> usano un modello che non c'è più <small class="muted">(es. ${x.gru.slice(0, 3).map((i) => esc(i.numeroInterno || IMP.titolo(i))).join(', ')})</small>
            <br>${x.sc ? `si ricrea con le <b>${x.sc.voci.length} voci</b> della scheda ${x.sc.anno} di ${(() => { const g = S.impianti.find((i) => i.id === x.sc.impiantoId) || {}; return (g.numeroInterno ? 'N° ' + esc(g.numeroInterno) + ' ' : '') + esc(IMP.titolo(g)); })()}` : '<span class="txt-ko">nessuna scheda con le voci: va ricreato a mano</span>'}</div>
            ${x.sc ? `<button class="btn small" data-ricrea="${x.id}">↺ Ricrea</button>` : ''}</div>`).join('')}
          ${inCopia.length ? `<div class="rec-riga"><div class="grow">Nella copia di sicurezza del ${fmt((copia.copiaDel || '').slice(0, 10))} ci sono modelli che adesso mancano: <b>${inCopia.map((x) => esc(x.nome)).join(', ')}</b></div><button class="btn small" id="btnRecCopia">↺ Rimetti</button></div>` : ''}
        </div>` : ''}
        <div class="sez-head"><h1>Modelli di scheda ${info('Un modello è l\'elenco delle voci di controllo, ognuna con la sua periodicità (TRIM, SEME, ANN). Vale per tutti gli impianti che lo usano: le gru a bandiera usano «Gru a bandiera», le altre «Carroponte». Le modifiche valgono per le schede nuove; quelle già iniziate restano come sono.')}</h1>
          <button class="btn ghost" id="btnNuovoMod">+ Nuovo modello</button></div>
        <nav class="tabs">${ms.map((x) => `<a class="tab ${x.id === m.id ? 'on' : ''}" href="javascript:void(0)" data-mod="${x.id}"><b>${esc(x.nome)}</b><span>${x.voci.length} voci</span></a>`).join('')}</nav>
        <div class="card">
          <div class="card-head"><h2>${esc(m.nome)} <span class="conta">${uso} impianti</span></h2>
            <div class="card-azioni"><button class="btn ghost small" id="btnRinomina">Rinomina</button>${ms.length > 1 && !['carroponte', 'bandiera'].includes(m.id) ? '<button class="btn ghost small danger" id="btnEliminaMod">Elimina</button>' : ''}</div></div>
          <label class="check mod-piu"><input type="checkbox" id="chkPiu" ${m.stampaPiu ? 'checked' : ''}> <span><b>Sulla scheda del cliente stampa tutti i codici</b> di una casella (es. «X R 25»). Se è spento si stampa solo il più importante (S, R, P, L, poi X) e il valore al posto della X. ${info('Nel controllo si possono sempre segnare più codici sulla stessa voce (es. X visionato, R regolato e la misura). Questa scelta decide solo cosa esce sulla scheda stampata o inviata al cliente per gli impianti con questo modello.')}</span></label>
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
    const salvaM = async (nuovi, tolti) => { await scriviModelli(S, nuovi, tolti); App.ridisegna(); };
    const copiaM = () => JSON.parse(JSON.stringify(ms));
    el.querySelectorAll('[data-mod]').forEach((b) => (b.onclick = () => { modelloAperto = b.dataset.mod; App.ridisegna(); }));
    el.querySelector('#chkPiu')?.addEventListener('change', async (e) => { const n = copiaM(); const mm = n.find((y) => y.id === m.id); if (e.target.checked) mm.stampaPiu = true; else delete mm.stampaPiu; await salvaM(n); UI.toast(e.target.checked ? 'Sulla scheda del cliente escono tutti i codici' : 'Sulla scheda del cliente esce un codice solo', 'ok'); });
    el.querySelectorAll('[data-ricrea]').forEach((b) => (b.onclick = () => {
      const x = mancanti.find((y) => y.id === b.dataset.ricrea);
      UI.modal({ titolo: 'Ricrea il modello', valori: { nome: x.nome },
        infoTxt: `Il modello torna con lo stesso codice di prima: le ${x.gru.length} gru che lo usavano lo ritrovano subito. Le voci sono quelle della scheda ${x.sc.anno} (le schede tengono una copia delle voci del modello).`,
        campi: [{ k: 'nome', label: 'Nome del modello', req: true, maiuscolo: true }],
        onSalva: async (v) => {
          const voci = x.sc.voci.filter((y) => nvTesto(y.testo) !== 'NOTEGENERALI').map((y) => ({ id: y.id, per: y.per || 'T', testo: y.testo, tipo: 'codice', ...(haValore(y) ? { valore: true, unita: unitaDi(y) || 'mm' } : {}) }));
          await scriviModelli(S, [...ms, { id: x.id, nome: String(v.nome).trim(), voci }]);
          modelloAperto = x.id; UT.registra('modifica', `Modello di scheda «${v.nome}» ricreato dalle voci di una scheda (${x.gru.length} gru)`);
          UI.toast(`Modello «${v.nome}» ricreato (${voci.length} voci)`, 'ok'); App.ridisegna();
        } });
    }));
    el.querySelector('#btnRecCopia')?.addEventListener('click', async () => {
      if (!UI.conferma(`Rimettere nella lista ${inCopia.map((x) => x.nome).join(', ')}?`)) return;
      await scriviModelli(S, [...ms, ...inCopia]); UI.toast('Modelli rimessi', 'ok'); App.ridisegna();
    });
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
      modelloAperto = null; await salvaM(copiaM().filter((y) => y.id !== m.id), [m.id]);
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

  return { route, aggiungiModello, modelloDi, codiciDi, codicePrincipale, letteraDi, piano, vociPerImpianto, tipoVisita, periodiDi, meseVisita, schedaDi, trovaSede, PER, CODICI, MESI, sediConImpianti, nomeSede, prossima, statoVisite, haValore, unitaDi, leggiVisita, riepilogo: (S) => sediConImpianti(S).filter(({ s }) => prossima(S, s.id, annoOggi())?.k === 'scaduto').length };
})();
