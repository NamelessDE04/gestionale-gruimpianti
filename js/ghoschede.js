// ===== SCHEDE DI CONTROLLO PER GHO ELIGIO (modello loro) =====
// Gru dei clienti di GHO da controllare SENZA metterle nella nostra anagrafica, con la SCHEDA DI GHO
// (foglio «GHO ELIGIO – Controllo eseguito presso…»: voci trimestrali, semestrali e annuali, situazione e note).
// - la gru è un impianto con gho: true (dati: cliente di GHO, costruttore, modello, matricola, matricola ISPESL, paranco)
//   e non compare negli elenchi dei nostri clienti/impianti/controlli;
// - ogni controllo è un documento in «ghoControlli» (un foglio per trimestre);
// - stampa A4 uguale al loro foglio, con il logo GHO; invio per email da «Invia e PDF» (voce GHO ELIGIO).
window.GHOS = (function () {
  const { esc, uid, info, fmt } = UI;
  const COL = 'ghoControlli';
  const VOCI = {
    T: ['controllo fune/catena di sollevamento', 'controllo ancoraggio fune/catena e capofisso', 'verifica funzionale fine corsa sollevamento', 'verifica funzionale fine corsa ponte',
      'verifica funzionale fine corsa carrello', 'verifica funzionale freno sollevamento', 'verifica funzionale freno ponte', 'verifica funzionale freno carrello',
      'controllo pulsantiera/radiocomando, emergenza e targhette', 'controllo sistema sospensione paranco', 'controllo perdite olio', 'controllo cartellonistica',
      "controllo rumorosita' anomale", 'controllo usura vie di corsa/trave di scorrimento carrello', 'verifica funzionale sezionatore gru/interruttori emergenza',
      'controllo apparecchiatura-cavi elettrici-cavo tondo pulsantiera', 'controllo condizioni generali bozzello/pulegge di rinvio', 'controllo sicurezza e usura gancio',
      'verifica funzionale anticollisione', 'verifica funzionale fine corsa inibizioni'],
    S: ['controllo capofisso fune/catena', 'controllo guidafune/noce di carico', 'controllo livelli olio riduttori', 'ingrassaggio ingranaggi esterni', 'ingrassaggio fune/lubrificazione catena'],
    A: ['controllo respingenti/tamponi ponte e carrello', 'controllo bulloneria struttura carroponte/fissaggio paranco', 'controllo usura ruote ponte e ruote carrello',
      'controllo usura tamburo', 'verifica funzionale limitatore di carico (in accordo con il cliente)', 'controllo visivo travi del carroponte, carrello e testate']
  };
  const SEZ = [['T', 'trimestrali'], ['S', 'semestrali'], ['A', 'annuali']];
  const TIPI = { T: 'Trimestrale', S: 'Semestrale', A: 'Annuale' };
  // quali gruppi si fanno in quel controllo: il semestrale comprende i trimestrali, l'annuale tutto
  const gruppi = (tipo) => (tipo === 'A' ? ['T', 'S', 'A'] : tipo === 'S' ? ['T', 'S'] : ['T']);
  const SIT = [['OK', 'OK'], ['NO', 'NON OK'], ['NA', 'N.A.']];
  const sitTesto = (v) => (SIT.find((x) => x[0] === v) || [])[1] || '';

  const gru = (S) => (S.impianti || []).filter((i) => i.gho);
  const controlli = (S, gruId) => (S[COL] || []).filter((c) => !gruId || c.gruId === gruId).sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  const puoMod = () => UT.puo('gho.schede') && !UT.solaLettura();
  const puoFare = () => UT.puo('ctr.fare') && !UT.solaLettura();
  const oggi = () => UI.oggi();
  const trimDi = (data) => Math.floor((+String(data || oggi()).slice(5, 7) - 1) / 3) + 1;
  const nomeGru = (i) => [i.marca, i.modelloGru].filter(Boolean).join(' ') || 'Gru';
  const titoloCtr = (c) => `${c.trimestre}° trimestre ${c.anno} · ${TIPI[c.tipo] || ''}`;

  // per le pagine dei controlli nostre (vecchio sistema): cliente e sede «finti» presi dai dati della gru
  function sedeFinta(S, sedeId) {
    const i = gru(S).find((x) => x.sedeId === sedeId); if (!i) return {};
    const g = i.ghoCliente || {};
    const s = { id: i.sedeId, nome: '', indirizzo: g.indirizzo || '', citta: g.citta || '', pianoControlli: i.ghoPiano || { mese1: 1, annuale: 1 } };
    return { c: { id: i.clienteId, ragioneSociale: g.nome || 'CLIENTE GHO', sedi: [s], gho: true }, s };
  }

  // ---------- ELENCO GRU ----------
  let cerca = '';
  function lista(el, S) {
    const t = cerca.trim().toLowerCase();
    const tutte = gru(S).filter((i) => !t || [i.ghoCliente?.nome, i.ghoCliente?.citta, i.marca, i.modelloGru, i.matricola, i.matricolaIspesl].join(' ').toLowerCase().includes(t))
      .sort((x, y) => (x.ghoCliente?.nome || '').localeCompare(y.ghoCliente?.nome || ''));
    el.innerHTML = `
      <section class="cli">
        <div class="sez-head"><h1>Schede di controllo GHO ${info('Gru dei clienti di GHO da controllare con la scheda di GHO, senza metterle nella nostra anagrafica. Aggiungi la gru con i suoi dati, poi tocca «+ Nuovo controllo»: segni la situazione di ogni voce, la stampi o la mandi per email da «Invia e PDF».')}</h1>
          ${puoMod() ? '<button class="btn fab" id="btnNuova"><span class="fab-piu">+</span><span class="fab-txt"> Nuova gru</span></button>' : ''}</div>
        ${gru(S).length > 4 ? `<input type="search" id="gsCerca" class="cerca" placeholder="Cerca cliente, città, matricola…" value="${esc(cerca)}">` : ''}
        <div class="elenco">
          ${tutte.map((i) => { const u = controlli(S, i.id)[0];
            return `<a class="riga" href="#/gho/schede/${i.id}">
              <span class="ghs-ico"><img src="img/gho-logo.png" alt=""></span>
              <div class="riga-main">
                <div class="riga-top"><b>${esc(i.ghoCliente?.nome || '')}</b></div>
                <small class="muted">${esc([nomeGru(i), i.matricola ? 'matr. ' + i.matricola : '', i.ghoCliente?.citta].filter(Boolean).join(' · '))}</small>
                <small class="muted">${u ? `ultimo controllo ${fmt(u.data)} (${esc(titoloCtr(u))})` : 'nessun controllo ancora'}</small>
              </div></a>`; }).join('') || `<p class="nessuno">${gru(S).length ? 'Nessuna gru trovata.' : 'Nessuna gru ancora.' + (puoMod() ? ' Tocca «+ Nuova gru».' : '')}</p>`}
        </div>
      </section>`;
    const fc = el.querySelector('#gsCerca');
    if (fc) fc.oninput = () => { cerca = fc.value; const p = fc.selectionStart; App.ridisegna(); const n = document.getElementById('gsCerca'); n.focus(); n.setSelectionRange(p, p); };
    el.querySelector('#btnNuova')?.addEventListener('click', () => modale(S, null));
    return { titolo: 'Schede di controllo GHO', indietro: '#/gho', live: true };
  }

  // ---------- SCHEDA DELLA GRU ----------
  function schedaGru(el, S, id) {
    const i = gru(S).find((x) => x.id === id);
    if (!i) { el.innerHTML = '<p class="nessuno">Gru non trovata.</p>'; return { titolo: 'Gru GHO', indietro: '#/gho/schede' }; }
    const g = i.ghoCliente || {}, cs = controlli(S, i.id);
    const campo = (l, v) => `<div class="campo"><span>${l}</span><b>${v ? esc(v) : '<i class="muted">—</i>'}</b></div>`;
    el.innerHTML = `
      <section class="cli">
        <div class="card cli-head"><span class="ghs-ico grande"><img src="img/gho-logo.png" alt=""></span><div class="grow"><h1>${esc(g.nome || '')}</h1><p class="muted small">${esc([g.indirizzo, g.citta].filter(Boolean).join(' - '))}</p></div></div>
        <div class="card">
          <div class="card-head"><h2>Dati della gru ${info('Sono i dati che escono in alto sulla scheda di GHO.')}</h2>${puoMod() ? '<button class="btn ghost small" id="btnDati">✏️ Modifica</button>' : ''}</div>
          <div class="griglia-campi">
            ${campo('Costruttore gru', i.marca)}${campo('Modello', i.modelloGru)}${campo('Matricola', i.matricola)}${campo('Matricola ISPESL', i.matricolaIspesl)}
            ${campo('Paranco: tipo', i.parancoTipo)}${campo('Paranco: mt.', i.parancoMt)}${campo('Paranco: anno', i.parancoAnno)}
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h2>Controlli <span class="conta">${cs.length}</span></h2>${puoFare() ? `<a class="btn small" href="#/gho/schede/${i.id}/c/nuovo">+ Nuovo controllo</a>` : ''}</div>
          <div class="elenco">${cs.map((c) => `<a class="riga" href="#/gho/schede/${i.id}/c/${c.id}">
              <div class="riga-main"><div class="riga-top"><b>${fmt(c.data)}</b> <span class="pill ${c.tipo === 'A' ? 'st-scadenza' : c.tipo === 'S' ? 'st-mai' : 'st-ok'}">${TIPI[c.tipo] || ''}</span>
                ${c.firma ? '' : '<span class="pill st-ko">da firmare</span>'}${c.inviatoIl ? '<span class="pill st-inv">✉️ Inviata</span>' : ''}</div>
                <small class="muted">${c.trimestre}° trimestre ${c.anno}${c.tecnico ? ' · ' + esc(c.tecnico) : ''}${nonOk(c) ? ` · <b class="txt-ko">${nonOk(c)} non ok</b>` : ''}</small></div>
              <a class="btn ghost small" href="#/gho/schede/${i.id}/c/${c.id}/stampa" onclick="event.stopPropagation()">🖨️</a></a>`).join('') || '<p class="muted">Nessun controllo ancora.</p>'}</div>
        </div>
      </section>`;
    el.querySelector('#btnDati')?.addEventListener('click', () => modale(S, i));
    return { titolo: 'Gru GHO · ' + (g.nome || ''), indietro: '#/gho/schede', live: true };
  }
  const nonOk = (c) => Object.values(c.voci || {}).filter((v) => v.s === 'NO').length;

  // ---------- NUOVA / MODIFICA GRU ----------
  function modale(S, i) {
    if (!UT.serve('gho.schede')) return;
    const nuovo = !i;
    UI.modal({
      titolo: nuovo ? 'Nuova gru da controllare per GHO' : 'Dati della gru (GHO)',
      infoTxt: 'Sono i dati che escono in alto sulla scheda di controllo di GHO. La gru non va nella nostra anagrafica.',
      valori: i ? { ghoNome: i.ghoCliente?.nome || '', ghoIndirizzo: i.ghoCliente?.indirizzo || '', ghoCitta: i.ghoCliente?.citta || '', marca: i.marca || '', modelloGru: i.modelloGru || '',
        matricola: i.matricola || '', matricolaIspesl: i.matricolaIspesl || '', parancoTipo: i.parancoTipo || '', parancoMt: i.parancoMt || '', parancoAnno: i.parancoAnno || '' } : {},
      campi: [
        { tipo: 'titolo', label: 'Controllo eseguito presso' },
        { k: 'ghoNome', label: 'Cliente di GHO', req: true, maiuscolo: true },
        { k: 'ghoIndirizzo', label: 'Indirizzo', maiuscolo: true, placeholder: 'es. VIA ROMA 10' },
        { k: 'ghoCitta', label: 'Città', maiuscolo: true, mezza: true },
        { tipo: 'titolo', label: 'La gru' },
        { k: 'marca', label: 'Costruttore gru', maiuscolo: true, mezza: true },
        { k: 'modelloGru', label: 'Modello', maiuscolo: true, mezza: true },
        { k: 'matricola', label: 'Matricola', maiuscolo: true, mezza: true },
        { k: 'matricolaIspesl', label: 'Matricola ISPESL', maiuscolo: true, mezza: true },
        { tipo: 'titolo', label: 'Paranco' },
        { k: 'parancoTipo', label: 'Tipo', maiuscolo: true, mezza: true, placeholder: 'es. 44L1N' },
        { k: 'parancoMt', label: 'mt.', mezza: true },
        { k: 'parancoAnno', label: 'Anno', mezza: true }
      ],
      onSalva: async (v) => {
        const id = i?.id || uid();
        const doc = { ...(i || {}), id, gho: true, clienteId: 'gho-' + id, sedeId: 'gho-' + id, modello: i?.modello || 'ponte', tipologia: i?.tipologia || '',
          marca: v.marca || '', modelloGru: v.modelloGru || '', matricola: v.matricola || '', matricolaIspesl: v.matricolaIspesl || '',
          parancoTipo: v.parancoTipo || '', parancoMt: v.parancoMt || '', parancoAnno: v.parancoAnno || '',
          paranchi: i?.paranchi || [{ ruolo: 'Primario', portata: '' }],
          ghoCliente: { nome: v.ghoNome, indirizzo: v.ghoIndirizzo || '', citta: v.ghoCitta || '' } };
        await UI.salva('impianti', doc);
        UT.registra(nuovo ? 'creazione' : 'modifica', `Gru GHO ${v.ghoNome}${v.matricola ? ' matr. ' + v.matricola : ''}`);
        UI.toast(nuovo ? 'Gru aggiunta' : 'Dati salvati', 'ok');
        if (nuovo) location.hash = '#/gho/schede/' + id;
      },
      onElimina: nuovo ? null : async () => {
        const cs = controlli(S, i.id);
        if (!UI.conferma(`Eliminare la gru di ${i.ghoCliente?.nome || ''}${cs.length ? ` e i suoi ${cs.length} controlli` : ''}?`)) return false;
        for (const c of cs) await Backend.remove(COL, c.id);
        await Backend.remove('impianti', i.id);
        UT.registra('eliminazione', `Gru GHO ${i.ghoCliente?.nome || ''} eliminata`);
        location.hash = '#/gho/schede';
      },
      testoElimina: 'Elimina gru'
    });
  }

  // ---------- CONTROLLO (compilazione) ----------
  function controllo(el, S, i, ctrId) {
    const orig = ctrId === 'nuovo' ? null : controlli(S, i.id).find((c) => c.id === ctrId);
    if (ctrId !== 'nuovo' && !orig) { el.innerHTML = '<p class="nessuno">Controllo non trovato.</p>'; return { titolo: 'Controllo GHO', indietro: '#/gho/schede/' + i.id }; }
    const io = UT.attuale();
    const ultimo = controlli(S, i.id)[0];
    const c = orig ? JSON.parse(JSON.stringify(orig)) : { id: uid(), gruId: i.id, data: oggi(), anno: +oggi().slice(0, 4), trimestre: trimDi(oggi()),
      tipo: ultimo ? (ultimo.tipo === 'A' ? 'T' : 'T') : 'A', voci: {}, tecnico: io?.nomeBreve || io?.nome || '', firma: '' };
    const sola = !puoFare();
    let sporco = false;
    const voce = (g, n, txt) => { const k = g + n, v = c.voci[k] || {};
      return `<div class="ghs-v" data-k="${k}"><div class="ghs-vt">${esc(txt)}</div>
        <div class="ghs-sit">${SIT.map(([cod, lab]) => `<button type="button" class="ghs-b ${v.s === cod ? 'on s-' + cod : ''}" data-s="${cod}" ${sola ? 'disabled' : ''}>${lab}</button>`).join('')}</div>
        <input class="ghs-n" placeholder="nota (esce nella colonna NOTE)" value="${esc(v.n || '')}" ${sola ? 'readonly' : ''}></div>`; };
    const disegna = () => {
      el.innerHTML = `
      <section class="cli ghs">
        <div class="card ghs-testa"><b>${esc(i.ghoCliente?.nome || '')}</b><span class="muted small">${esc([nomeGru(i), i.matricola ? 'matr. ' + i.matricola : ''].filter(Boolean).join(' · '))}</span></div>
        <div class="card form">
          <div class="due">
            <label>Controllo effettuato in data<input type="date" id="cData" value="${esc(c.data)}" ${sola ? 'readonly' : ''}></label>
            <label>Trimestre<select id="cTrim" ${sola ? 'disabled' : ''}>${[1, 2, 3, 4].map((n) => `<option value="${n}" ${+c.trimestre === n ? 'selected' : ''}>${n}° trimestre</option>`).join('')}</select></label>
          </div>
          <div class="lab-blocco">Tipo di controllo ${info('Il trimestrale ha solo le voci trimestrali; il semestrale anche le semestrali; l\'annuale tutte.')}</div>
          <div class="chips" id="cTipo">${['T', 'S', 'A'].map((t) => `<button type="button" class="chip ${c.tipo === t ? 'on' : ''}" data-t="${t}" ${sola ? 'disabled' : ''}>${TIPI[t]}</button>`).join('')}</div>
        </div>
        ${SEZ.filter(([g]) => gruppi(c.tipo).includes(g)).map(([g, nome]) => `
          <div class="card"><div class="card-head"><h2>Controlli ${nome}</h2>${sola ? '' : `<button type="button" class="btn ghost small" data-tuttiok="${g}">✓ Tutti OK</button>`}</div>
            ${VOCI[g].map((t, n) => voce(g, n + 1, t)).join('')}</div>`).join('')}
        <div class="card">
          <div class="card-head"><h2>Note generali ${info('Escono su un secondo foglio attaccato alla scheda (anche nel PDF per email). Se le lasci vuote il secondo foglio non c\'è.')}</h2></div>
          <textarea id="cNoteGen" rows="5" data-libero placeholder="note generali sul controllo, lavori consigliati, ricambi da ordinare…" ${sola ? 'readonly' : ''}>${esc(c.noteGenerali || '')}</textarea>
        </div>
        <div class="card">
          <div class="card-head"><h2>Timbro e firma</h2></div>
          <div id="cFirma">${c.firma ? `<img class="ghs-firma" src="${c.firma}" alt="firma">` : '<p class="muted small">La firma arriva dal tuo profilo quando salvi.</p>'}</div>
          ${sola ? '' : `<div class="azioni-form">${io?.firma ? '<button type="button" class="btn ghost small" id="cMia">✍️ Usa la mia firma</button>' : ''}<button type="button" class="btn ghost small" id="cFirmaMano">✍️ Firma a mano</button></div>`}
        </div>
        <div class="azioni-form ghs-az">
          ${orig && UT.puo('gho.schede') && !sola ? '<button type="button" class="btn ghost danger" id="cElimina">🗑 Elimina</button>' : ''}<span class="grow"></span>
          ${orig ? `<a class="btn ghost" href="#/gho/schede/${i.id}/c/${c.id}/stampa">🖨️ Stampa</a>` : ''}
          ${sola ? '' : '<button type="button" class="btn" id="cSalva">💾 Salva</button>'}
        </div>
      </section>`;
      collega();
    };
    const leggi = () => {
      c.noteGenerali = (el.querySelector('#cNoteGen')?.value || '').trim();
      c.data = el.querySelector('#cData').value || c.data; c.anno = +c.data.slice(0, 4); c.trimestre = +el.querySelector('#cTrim').value;
      el.querySelectorAll('.ghs-v').forEach((r) => { const k = r.dataset.k, n = r.querySelector('.ghs-n').value.trim(); c.voci[k] = { ...(c.voci[k] || {}), n }; if (!c.voci[k].s && !n) delete c.voci[k]; });
    };
    function collega() {
      if (sola) return;
      el.querySelector('#cData').onchange = () => { sporco = true; const d = el.querySelector('#cData').value; if (d) el.querySelector('#cTrim').value = trimDi(d); };
      el.querySelector('#cTrim').onchange = () => (sporco = true);
      el.querySelector('#cNoteGen').oninput = () => (sporco = true);
      el.querySelectorAll('#cTipo [data-t]').forEach((b) => (b.onclick = () => { leggi(); c.tipo = b.dataset.t; sporco = true; const y = window.scrollY; disegna(); window.scrollTo(0, y); }));
      el.querySelectorAll('.ghs-v').forEach((r) => {
        r.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => {
          const k = r.dataset.k, v = c.voci[k] || {}; v.s = v.s === b.dataset.s ? '' : b.dataset.s; c.voci[k] = v; sporco = true;
          r.querySelectorAll('[data-s]').forEach((x) => { x.className = 'ghs-b' + (x.dataset.s === v.s ? ' on s-' + v.s : ''); });
          if (v.s === 'NO') r.querySelector('.ghs-n').focus();
        }));
        r.querySelector('.ghs-n').oninput = () => (sporco = true);
      });
      el.querySelectorAll('[data-tuttiok]').forEach((b) => (b.onclick = () => {
        leggi(); const g = b.dataset.tuttiok;
        VOCI[g].forEach((_, n) => { const k = g + (n + 1); if (!c.voci[k]?.s) c.voci[k] = { ...(c.voci[k] || {}), s: 'OK' }; });
        sporco = true; const y = window.scrollY; disegna(); window.scrollTo(0, y);
      }));
      el.querySelector('#cMia')?.addEventListener('click', () => { c.firma = io.firma; sporco = true; el.querySelector('#cFirma').innerHTML = `<img class="ghs-firma" src="${c.firma}" alt="firma">`; });
      el.querySelector('#cFirmaMano').onclick = async () => { const f = await UI.firmaGrande({ titolo: 'Timbro e firma', sotto: i.ghoCliente?.nome || '' }); if (f) { c.firma = f; sporco = true; el.querySelector('#cFirma').innerHTML = `<img class="ghs-firma" src="${f}" alt="firma">`; } };
      el.querySelector('#cSalva').onclick = async () => {
        leggi();
        const manca = gruppi(c.tipo).flatMap((g) => VOCI[g].map((_, n) => g + (n + 1))).filter((k) => !c.voci[k]?.s).length;
        if (manca && !UI.conferma(`Ci sono ${manca} voci senza situazione. Salvare lo stesso?`)) return;
        if (!c.firma && io?.firma) c.firma = io.firma;
        // le voci dei gruppi non previsti (es. annuali in un trimestrale) non vanno sulla scheda
        Object.keys(c.voci).forEach((k) => { if (!gruppi(c.tipo).includes(k[0])) delete c.voci[k]; });
        await UI.salva(COL, c); sporco = false;
        UT.registra(orig ? 'modifica' : 'creazione', `Controllo GHO ${i.ghoCliente?.nome || ''} ${fmt(c.data)} (${TIPI[c.tipo]})`);
        UI.toast('Controllo salvato', 'ok');
        location.hash = `#/gho/schede/${i.id}/c/${c.id}/stampa`;
      };
      el.querySelector('#cElimina')?.addEventListener('click', async () => {
        if (!UI.conferma('Eliminare questo controllo?')) return;
        sporco = false; await Backend.remove(COL, c.id); location.hash = '#/gho/schede/' + i.id;
      });
      App.proteggi?.(() => sporco);
    }
    disegna();
    return { titolo: orig ? 'Controllo GHO · ' + fmt(c.data) : 'Nuovo controllo GHO', indietro: '#/gho/schede/' + i.id, live: false };
  }

  // ---------- FOGLIO A4 (uguale al loro) ----------
  function foglio(S, c) {
    const i = gru(S).find((x) => x.id === c.gruId) || {};
    const g = i.ghoCliente || {};
    const box = (x0, y0, x1, y1, cls = '') => `<div class="r2-b ${cls}" style="left:${x0}mm;top:${y0}mm;width:${(x1 - x0).toFixed(2)}mm;height:${(y1 - y0).toFixed(2)}mm"></div>`;
    const t = (x0, y0, x1, y1, txt, cls = '') => `<div class="r2-t ${cls}" data-adatta="0.5" style="left:${x0}mm;top:${y0}mm;width:${(x1 - x0).toFixed(2)}mm;height:${(y1 - y0).toFixed(2)}mm">${txt}</div>`;
    const L = 12, R = 198, XS = 140, XN = 158;   // colonne: voce | situazione | note
    let h = '<img class="ghs-logo" src="img/gho-logo.png" alt="GHO">';
    h += `<div class="ghs-int"><div class="ghs-int1"><b class="ghs-nome">GHO ELIGIO</b> &nbsp;-&nbsp; <b>Strada Carignano, 37/b - 10040 La Loggia (TO)</b></div>
      <div>GRU A PONTE – COSTRUZIONI IN FERRO</div><div>PIEGATURA E TAGLI LAMIERA SU MISURA</div>
      <div class="ghs-int2"><span>Tel : 011-962.82.44</span><span>Fax : 011-962.72.00</span></div><div class="ghs-int2"><span>www.ghoeligio.it</span><span>Mail: info@ghoeligio.it</span></div></div>`;
    // riquadro dati
    h += box(L, 37, R, 50) + box(L, 37, 62, 50);
    h += t(L, 37, 62, 50, '<b>Controllo eseguito presso:</b>', 'ghs-lab') + t(63, 37, R, 50, `<span class="ghs-pres"><b>${esc(g.nome || '')}</b>${g.indirizzo || g.citta ? '<br>' + esc([g.indirizzo, g.citta].filter(Boolean).join(' - ')) : ''}</span>`, 'ghs-val ghs-wrap');
    const righe = [['Costruttore gru:', i.marca], ['Modello:', i.modelloGru], ['Matricola:', i.matricola], ['Matricola ISPESL:', i.matricolaIspesl]];
    righe.forEach(([l, v], n) => { const y = 50 + n * 4.6; h += box(L, y, 62, y + 4.6) + box(62, y, 113, y + 4.6) + t(L, y, 62, y + 4.6, `<b>${l}</b>`, 'ghs-lab') + t(62, y, 113, y + 4.6, esc(v || ''), 'ghs-val'); });
    h += box(L, 68.4, 113, 76) + t(L, 68.4, 113, 76, `<b>Controllo effettuato in data</b>&nbsp;&nbsp;&nbsp;<span class="ghs-val">${fmt(c.data)}</span>`, 'ghs-lab');
    // paranco
    h += box(113, 50, R, 59.2) + box(113, 59.2, R, 63.8) + box(113, 63.8, R, 72);
    h += t(113, 50, R, 54.6, 'Paranco', 'c ghs-par') + t(113, 54.6, R, 59.2, `Tipo&nbsp;<b>${esc(i.parancoTipo || '')}</b>`, 'c ghs-par') + t(113, 59.2, R, 63.8, `mt.&nbsp;<b>${esc(i.parancoMt || '')}</b>&nbsp;&nbsp;&nbsp;&nbsp;Anno&nbsp;<b>${esc(i.parancoAnno || '')}</b>`, 'c ghs-par');
    h += box(113, 72, R, 76.4) + t(113, 72, XN, 76.4, 'trimestre :', 'ghs-dx') + box(XN, 72, R, 76.4) + t(XN, 72, R, 76.4, `<b>${c.trimestre}° ${c.anno}</b>&nbsp;<span class="ghs-tipo">(${(TIPI[c.tipo] || '').toLowerCase()})</span>`, 'c');
    h += box(XS, 76.4, XN, 80.6) + box(XN, 76.4, R, 80.6) + t(XS, 76.4, XN, 80.6, 'situazione', 'c ghs-pic') + t(XN, 76.4, R, 80.6, 'NOTE', 'c ghs-pic');
    // gruppi di voci
    const RH = 5.15; let y = 80.6;
    const fatti = gruppi(c.tipo);
    SEZ.forEach(([gr, nome], gi) => {
      const n = VOCI[gr].length, y0 = y, y1 = y + n * RH, on = fatti.includes(gr);
      h += box(L, y0, L + 8, y1) + `<div class="ghs-vert" style="left:${L}mm;top:${y0}mm;width:8mm;height:${(y1 - y0).toFixed(2)}mm"><span>${nome}</span></div>`;
      h += box(XN, y0, R, y1);
      VOCI[gr].forEach((txt, k) => {
        const yy = y0 + k * RH, v = c.voci[gr + (k + 1)] || {};
        h += box(L + 8, yy, XS, yy + RH) + box(XS, yy, XN, yy + RH);
        h += t(L + 8.3, yy, XS, yy + RH, esc(txt), 'ghs-voce');
        if (on && v.s) h += t(XS, yy, XN, yy + RH, `<b class="${v.s === 'NO' ? 'ghs-ko' : ''}">${sitTesto(v.s)}</b>`, 'c');
        if (on && v.n) h += `<div class="r2-t ghs-nota" style="left:${XN + .4}mm;top:${yy}mm;width:${(R - XN - .8).toFixed(2)}mm;height:${RH}mm">${esc(v.n)}</div>`;   // va a capo su 2 righe
      });
      y = y1 + (gi < 2 ? 3.4 : 0);
    });
    // timbro e firma
    h += box(108, 270, R, 286) + box(108, 270, 140, 286) + t(108, 270, 140, 286, 'Timbro e firma:', 'c ghs-lab');
    if (c.firma) h += `<img class="ghs-fimg" src="${c.firma}" alt="" style="left:141mm;top:270.6mm;width:56mm;height:12mm">`;
    if (c.tecnico) h += t(140, 282.4, R, 286, `<span class="ghs-tec">${esc(c.tecnico)} – Gru Impianti</span>`, 'c');
    const due = !!(c.noteGenerali || '').trim();
    if (due) h += t(L, 276, 104, 281, '<b>Note generali: vedi foglio 2</b>', 'ghs-lab');
    h += t(150, 288, R, 292, `Foglio 1${due ? ' di 2' : ''}`, 'ghs-pnum');
    return `<article class="recap rap2 ghs-pag">${h}</article>${due ? foglio2(S, c, i, g) : ''}`;
  }
  // 2° foglio: note generali (stessa intestazione GHO)
  function foglio2(S, c, i, g) {
    let h = '<img class="ghs-logo" src="img/gho-logo.png" alt="GHO">';
    h += `<div class="ghs-int"><div class="ghs-int1"><b class="ghs-nome">GHO ELIGIO</b> &nbsp;-&nbsp; <b>Strada Carignano, 37/b - 10040 La Loggia (TO)</b></div>
      <div>GRU A PONTE – COSTRUZIONI IN FERRO</div><div>PIEGATURA E TAGLI LAMIERA SU MISURA</div>
      <div class="ghs-int2"><span>Tel : 011-962.82.44</span><span>Fax : 011-962.72.00</span></div><div class="ghs-int2"><span>www.ghoeligio.it</span><span>Mail: info@ghoeligio.it</span></div></div>`;
    h += `<div class="ghs-f2">
      <div class="ghs-f2-tit">NOTE GENERALI</div>
      <div class="ghs-f2-rif"><b>Controllo eseguito presso:</b> ${esc([g.nome, [g.indirizzo, g.citta].filter(Boolean).join(' - ')].filter(Boolean).join(' – '))}<br>
        <b>Gru:</b> ${esc([nomeGru(i), i.matricola ? 'matricola ' + i.matricola : '', i.matricolaIspesl ? 'ISPESL ' + i.matricolaIspesl : ''].filter(Boolean).join(' · '))}<br>
        <b>Controllo del</b> ${fmt(c.data)} · ${c.trimestre}° trimestre ${c.anno} (${(TIPI[c.tipo] || '').toLowerCase()})</div>
      <div class="ghs-f2-txt">${esc(c.noteGenerali || '')}</div>
    </div>`;
    h += `<div class="r2-b" style="left:108mm;top:270mm;width:90mm;height:16mm"></div><div class="r2-b" style="left:108mm;top:270mm;width:32mm;height:16mm"></div>
      <div class="r2-t c ghs-lab" style="left:108mm;top:270mm;width:32mm;height:16mm">Timbro e firma:</div>`;
    if (c.firma) h += `<img class="ghs-fimg" src="${c.firma}" alt="" style="left:141mm;top:270.6mm;width:56mm;height:12mm">`;
    if (c.tecnico) h += `<div class="r2-t c" style="left:140mm;top:282.4mm;width:58mm;height:3.6mm"><span class="ghs-tec">${esc(c.tecnico)} – Gru Impianti</span></div>`;
    h += '<div class="r2-t ghs-pnum" style="left:150mm;top:288mm;width:48mm;height:4mm">Foglio 2 di 2</div>';
    return `<article class="recap rap2 ghs-pag">${h}</article>`;
  }
  function vista(el, S, i, c) {
    el.innerHTML = `
      <section class="stampa-recap">
        <div class="azioni-lista no-print">
          ${UT.puo('stampa') ? '<button class="btn" id="btnStampa">🖨️ Stampa / salva PDF</button>' : ''}
          ${UT.puo('invio') ? `<a class="btn ghost" href="#/invio?gho=1">📧 Invia per email</a>` : ''}
          ${puoFare() ? `<a class="btn ghost" href="#/gho/schede/${i.id}/c/${c.id}">✏️ Modifica</a>` : ''}
          <a class="btn ghost" href="#/gho/schede/${i.id}">Indietro</a>
          ${info('Scegli «Salva come PDF» nella finestra di stampa, formato A4 verticale, margini «Nessuno».')}
        </div>
        <div class="recap-wrap">${foglio(S, c)}</div>
      </section>`;
    sistema(el);
    el.querySelector('#btnStampa')?.addEventListener('click', () => {
      const t0 = document.title; document.title = nomeFile(i, c).replace(/\.pdf$/, '');
      window.print(); setTimeout(() => (document.title = t0), 1000);
    });
    return { titolo: 'Scheda GHO · ' + fmt(c.data), indietro: '#/gho/schede/' + i.id, live: true };
  }
  const nomeFile = (i, c) => `Scheda_GHO_${String(i.ghoCliente?.nome || '').replace(/[^\w]+/g, '_')}_${i.matricola ? String(i.matricola).replace(/[^\w]+/g, '-') + '_' : ''}${c.data}.pdf`;
  function sistema(el) {
    const fogli = [...el.querySelectorAll('.ghs-pag')];
    fogli.forEach((x) => { x.style.zoom = 1; UI.adattaTesti(x); });
    const scala = () => fogli.forEach((x) => { const w = x.parentElement.clientWidth; if (w < 50) return; x.style.zoom = Math.min(1, (w - 4) / x.offsetWidth).toFixed(3); });
    scala(); window.addEventListener('resize', scala);
  }
  // per il PDF dell'invio: disegna il foglio in un contenitore
  function disegnaFoglio(el, S, ctrId) {
    const c = (S[COL] || []).find((x) => x.id === ctrId); if (!c) return;
    el.innerHTML = `<div class="recap-wrap">${foglio(S, c)}</div>`; sistema(el);
  }

  function route(el, S, parti) {
    if (!parti[2]) return lista(el, S);
    const i = gru(S).find((x) => x.id === parti[2]);
    if (!i) { el.innerHTML = '<p class="nessuno">Gru non trovata.</p>'; return { titolo: 'Gru GHO', indietro: '#/gho/schede' }; }
    if (parti[3] === 'c' && parti[4]) {
      if (parti[5] === 'stampa') { const c = controlli(S, i.id).find((x) => x.id === parti[4]); if (c) return vista(el, S, i, c); }
      return controllo(el, S, i, parti[4]);
    }
    return schedaGru(el, S, parti[2]);
  }

  return { route, lista, modale, sedeFinta, gru, controlli, disegnaFoglio, nomeFile, titoloCtr, nomeGru, COL };
})();
