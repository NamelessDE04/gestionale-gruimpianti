// ===== TEST DELLA GRU (check list di collaudo) per le schede di cablaggio =====
// - nella scheda c'è il blocco «test»: le voci della check list le decide chi modifica la scheda;
//   su ogni voce si può attaccare la linea guida dei parametri inverter GD20 / GD28
// - «▶ Avvia test gru» apre la check list tutta su una pagina; salvata va nella raccolta «collaudi»
// - in GHO ELIGIO c'è la sezione «Collaudi» con tutte le check list compilate (e i rapporti PDF del configuratore vecchio)
window.CABT = (function () {
  const { esc, uid, info, fmt } = UI;

  // voci di partenza: quelle della check list del configuratore vecchio
  const VOCI_DEF = [
    ['COLLEGARE GRU A QUADRO PROVA'], ['COLLEGARE SPINA RADIOCOMANDO / PULSANTIERA PENSILE'], ['IMPOSTARE TESTINE TEMPORIZZATE A 1 SECONDO'],
    ['ALIMENTARE QUADRO PROVA E QUADRO GENERALE GRU'], ['PARAMETRIZZARE INVERTER SOLLEVAMENTO', true], ['CONTROLLARE MESSA IN FASE SU MOVIMENTI SOLLEVAMENTO LENTO / VELOCE'],
    ['PARAMETRIZZARE INVERTER CARRELLO', true], ['CONTROLLARE MESSA IN FASE SU TRASLAZIONE CARRELLO LENTO / VELOCE'], ['PARAMETRIZZARE INVERTER PONTE', true],
    ['CONTROLLARE MESSA IN FASE SU SCORRIMENTO PONTE LENTO / VELOCE'], ['CONTROLLARE CORRETTO FUNZIONAMENTO FINECORSA SOLLEVAMENTO'],
    ['CONTROLLARE CORRETTO FUNZIONAMENTO FINECORSA CARRELLO'], ['CONTROLLARE CORRETTO FUNZIONAMENTO FINECORSA PONTE'], ['CONTROLLARE CORRETTO FUNZIONAMENTO FUNGO D\'EMERGENZA']
  ];
  // blocco «parametri inverter»: la linea guida GD20 / GD28 modificabile scheda per scheda (parte da quella della check list vecchia)
  const nuovoInv = () => ({ id: uid(), tipo: 'inv', titolo: 'PARAMETRI INVERTER GD20 / GD28', righe: PARAM.flat().map(([c, d, a, b]) => [c, d.toUpperCase(), a.toUpperCase(), b.toUpperCase()]),
    note: PARAM_NOTE.join('\n').toUpperCase() });
  // righe raggruppate per famiglia di parametri (P00, P02, P05…)
  const gruppi = (righe) => { const g = []; righe.forEach((r) => { const f = String(r[0] || '').toUpperCase().slice(0, 3); const u = g[g.length - 1]; if (u && u.f === f) u.r.push(r); else g.push({ f, r: [r] }); }); return g.map((x) => x.r); };
  function invHtml(b, i, ed, cella) {
    return `<div class="cbs-scroll"><table class="cbs-t ct-invt"><tr><th>PARAMETRO</th><th>DESCRIZIONE</th><th>GD20</th><th>GD28</th>${ed ? '<th></th>' : ''}</tr>
      ${b.righe.map((r, j) => { const nuovoG = j && String(r[0] || '').slice(0, 3).toUpperCase() !== String(b.righe[j - 1][0] || '').slice(0, 3).toUpperCase();
        return `<tr${nuovoG ? ' class="ct-gsep"' : ''}>${r.map((x, k) => `<td class="${['ct-cod', 'ct-dsc', 'ct-val', 'ct-val'][k]}">${ed ? `<textarea class="cbs-in ct-tin" data-p="b.${i}.righe.${j}.${k}" rows="1" spellcheck="false">${esc(x ?? '')}</textarea>` : cella(false, '', x)}</td>`).join('')}
        ${ed ? `<td><button type="button" class="cbs-mini danger" data-delr="${i}.${j}" aria-label="Togli riga" ${b.righe.length > 1 ? '' : 'disabled'}>×</button></td>` : ''}</tr>`; }).join('')}</table></div>
      ${ed ? `<button type="button" class="btn ghost small" data-addr="${i}">+ Parametro</button><p class="muted small">Nel test i parametri P00.00, P02.01, P02.02, P02.03, P02.04 e P02.05 vengono calcolati dai dati di targa dei motori. Le note con gli asterischi stanno nelle Note qui sotto.</p>` : ''}`;
  }
  const nuovo = () => ({ id: uid(), tipo: 'test', titolo: 'CHECK LIST TEST GRU', voci: VOCI_DEF.map(([testo, inv]) => ({ id: uid(), testo, inv: !!inv })) });

  // linea guida parametri inverter (dalla check list vecchia): [codice, descrizione, GD20, GD28]
  const PARAM = [
    [['P00.00', 'Controllo vettoriale', '2*', '2*'], ['P00.01', 'Comando da terminali', '1', ''], ['P00.03', 'Frequenza massima', '50', ''], ['P00.04', 'Limite massimo frequenza', '50', ''],
      ['P00.05', 'Limite minimo frequenza', '0', ''], ['P00.06', 'Impostazione multivelocità', '6', ''], ['P00.11', 'Tempo di accelerazione', '2,5', ''], ['P00.12', 'Tempo di decelerazione', '2,5', ''],
      ['P00.13', 'Inversione fasi', '0**', '']],
    [['P02.01', 'Potenza nominale motore', 'vedi targhetta', 'vedi targhetta'], ['P02.02', 'Frequenza nominale motore', 'vedi targhetta', 'vedi targhetta'],
      ['P02.03', 'Velocità nominale motore', 'vedi targhetta', 'vedi targhetta'], ['P02.04', 'Tensione nominale motore', 'vedi targhetta', 'vedi targhetta'], ['P02.05', 'Corrente nominale motore', '', '']],
    [['P05.01', 'Ingresso S1', '1', '1'], ['P05.02', 'Ingresso S2', '2', '2'], ['P05.03', 'Ingresso S3', '16', '16'], ['P05.04', 'Ingresso S4', '17', '17']],
    [['P06.03', 'Uscita R0 con funzione FDT1', '6', 'NO']],
    [['P08.32', 'Frequenza apertura freno', '3***', 'NO'], ['P08.37', 'Abilita Chopper frenatura', '1', 'NO'], ['P08.39', 'Attiva frenatura dinamica', 'NO', '1']],
    [['P10.02', 'Velocità 0', '30', '30'], ['P10.04', 'Velocità lenta', '50', '50'], ['P10.06', 'Velocità veloce', '95', '95']]
  ];
  const PARAM_NOTE = ["* Se c'è un solo motore collegato = 1, se ci sono 2 motori in parallelo = 2",
    '** Se i motori girano entrambi dallo stesso senso ma al contrario, mettere a 1', "*** Parametro utile solo se l'inverter è su un sollevamento"];
  // dati di targa dei motori (si chiedono all'inizio del test). Il sollevamento ha 2 velocità: 2 correnti e 2 giri
  const MOTORI = [['soll', 'Motore sollevamento'], ['carr', 'Motore carrello'], ['ponte', 'Motore ponte']];
  const CAMPI = (k) => [['hz', 'Frequenza nominale', 'Hz'], ['v', 'Tensione nominale', 'V'],
    ...(k === 'soll' ? [['a1', 'Corrente nominale 1ª vel.', 'A'], ['a2', 'Corrente nominale 2ª vel.', 'A'], ['g1', 'Giri motore 1ª vel.', 'rpm'], ['g2', 'Giri motore 2ª vel.', 'rpm']]
      : [['a1', 'Corrente nominale', 'A'], ['g1', 'Giri motore', 'rpm']]),
    ['kw', 'Potenza motore', 'kW'], ...(k === 'soll' ? [] : [['n', 'Quantità motori', 'n°']])];
  const motVuoto = (k) => Object.fromEntries(CAMPI(k).map(([c]) => [c, c === 'n' ? '1' : '']));
  const NOME_MOT = Object.fromEntries(MOTORI);
  // di quale motore parla la voce: scelto nel blocco, altrimenti dal testo
  const motoreDi = (v) => { if (v.mot) return v.mot; if (!v.inv) return ''; const t = String(v.testo || '').toUpperCase(); return /SOLLEV/.test(t) ? 'soll' : /CARREL/.test(t) ? 'carr' : 'ponte'; };
  const num = (x) => { const n = parseFloat(String(x || '').replace(',', '.')); return isNaN(n) ? null : n; };
  const cifra = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
  // linea guida adattata alla targa: P00.00 = n° motori, P02.01 = kW (× n), P02.02 Hz, P02.03 giri, P02.04 V, P02.05 A (× n)
  function parametri(k, m, base) {
    m = m || {}; const n = k === 'soll' ? 1 : Math.max(1, parseInt(m.n, 10) || 1), due = (a, b) => [a, b].filter(Boolean).join(' / ');
    const somma = (x) => { const v = num(x); return v == null ? '' : cifra(v * n); };
    const kw = somma(m.kw), I = k === 'soll' ? due(m.a1 && cifra(num(m.a1) ?? 0), m.a2 && cifra(num(m.a2) ?? 0)) : somma(m.a1), giri = k === 'soll' ? due(m.g1, m.g2) : m.g1;
    const calc = { 'P00.00': String(n), 'P02.01': kw && kw + ' kW', 'P02.02': m.hz && m.hz + ' Hz', 'P02.03': giri && giri + ' rpm', 'P02.04': m.v && m.v + ' V', 'P02.05': I && I + ' A' };
    return (base && base.length ? gruppi(base) : PARAM).map((g) => g.map(([c, d, a, b]) => { const cc = String(c || '').toUpperCase().trim(); return calc[cc] ? [c, d, calc[cc], calc[cc], 1] : [c, d, a, b, 0]; }));
  }
  const paramHtml = (k, m, base, note) => { const righe = k ? parametri(k, m, base) : PARAM, n = k === 'soll' ? 1 : Math.max(1, parseInt((m || {}).n, 10) || 1);
    return `<div class="ct-param">${k ? `<p class="ct-pmot">⚙ Inverter ${esc(NOME_MOT[k].replace('Motore ', ''))}${n > 1 ? ` · ${n} motori in parallelo (kW e corrente sommati)` : ''} · i valori in giallo vengono dai dati di targa</p>` : ''}
    <table><thead><tr><th>Parametro</th><th>Descrizione</th><th>GD20</th><th>GD28</th></tr></thead>
    ${righe.map((g) => `<tbody>${g.map(([c, d, a, b, x]) => `<tr${x ? ' class="ct-calc"' : ''}><td><b>${c}</b></td><td>${esc(d)}</td><td class="v">${esc(a) || '—'}</td><td class="v">${esc(b) || '—'}</td></tr>`).join('')}</tbody>`).join('')}</table>
    <p class="ct-pnote">${noteDi(note).filter((t) => !k || !/^\*\s/.test(t)).map(esc).join('<br>')}</p></div>`; };
  const noteDi = (note) => (note != null ? String(note).split('\n').map((x) => x.trim()).filter(Boolean) : PARAM_NOTE);

  // ---------- blocco nella scheda ----------
  function bloccoHtml(b, i, ed) {
    if (!ed) return `<ol class="ct-bvoci">${(b.voci || []).map((v) => `<li>${esc(String(v.testo || '').toUpperCase())}${motoreDi(v) ? ` <span class="ct-inv">⚙ inverter ${esc(NOME_MOT[motoreDi(v)].replace('Motore ', ''))}</span>` : ''}</li>`).join('')}</ol>`;
    return `<div class="ct-bed">${(b.voci || []).map((v, j) => `<div class="ct-bv">
        <span class="ct-n">${j + 1}</span>
        <textarea class="cbs-in ct-tin" data-p="b.${i}.voci.${j}.testo" rows="1" autocomplete="off" spellcheck="false">${esc(v.testo || '')}</textarea>
        <label class="ct-chk" title="Su questa voce si apre la linea guida dei parametri inverter GD20 / GD28 con i dati di targa del motore scelto">⚙<select data-tinv="${i}.${j}">${[['', 'No inverter'], ['soll', 'Inverter sollevamento'], ['carr', 'Inverter carrello'], ['ponte', 'Inverter ponte']].map(([x, t]) => `<option value="${x}" ${motoreDi(v) === x ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <span class="ct-bt"><button type="button" class="cbs-mini" data-tsu="${i}.${j}" ${j ? '' : 'disabled'} aria-label="Su">↑</button><button type="button" class="cbs-mini danger" data-tdel="${i}.${j}" aria-label="Togli voce" ${b.voci.length > 1 ? '' : 'disabled'}>×</button></span>
      </div>`).join('')}
      <button type="button" class="btn ghost small" data-tadd="${i}">+ Voce</button>
      <p class="muted small">Con «⚙» scegli su quali voci si fa la parametrizzazione e di quale inverter: durante il test lì si apre la linea guida GD20 / GD28 già calcolata coi dati di targa del motore.</p></div>`;
  }
  // tocchi del blocco in modifica: cambia(fn) = modifica i dati, segna e ridisegna
  function lega(el, bz, cambia) {
    const ij = (x, k) => x.dataset[k].split('.').map(Number);
    // il testo della voce va a capo da solo (niente scritte tagliate), Invio non crea righe nuove
    el.querySelectorAll('.ct-tin').forEach((x) => { const alto = () => { x.style.height = 'auto'; x.style.height = x.scrollHeight + 2 + 'px'; };
      requestAnimationFrame(alto); x.addEventListener('input', alto); x.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); }); });
    el.querySelectorAll('[data-tinv]').forEach((x) => (x.onchange = () => { const [i, j] = ij(x, 'tinv'); cambia(i, () => { const v = bz.blocchi[i].voci[j]; v.mot = x.value; v.inv = !!x.value; }); }));
    el.querySelectorAll('[data-tadd]').forEach((x) => (x.onclick = () => { const i = +x.dataset.tadd; cambia(i, () => bz.blocchi[i].voci.push({ id: uid(), testo: '', inv: false }), true); }));
    el.querySelectorAll('[data-tdel]').forEach((x) => (x.onclick = () => { const [i, j] = ij(x, 'tdel'); cambia(i, () => bz.blocchi[i].voci.splice(j, 1)); }));
    el.querySelectorAll('[data-tsu]').forEach((x) => (x.onclick = () => { const [i, j] = ij(x, 'tsu'); cambia(i, () => { const v = bz.blocchi[i].voci; [v[j - 1], v[j]] = [v[j], v[j - 1]]; }); }));
  }

  // ---------- esecuzione del test: check list tutta su una pagina ----------
  const puoTest = () => UT.puo('cablaggio.test') && !UT.solaLettura();
  function esegui(el, S, s) {
    const ib = (s.blocchi || []).find((b) => b.tipo === 'inv'), base = ib ? ib.righe : null, noteInv = ib ? ib.note || '' : null;
    const tb = (s.blocchi || []).find((b) => b.tipo === 'test'), voci = (tb ? tb.voci : nuovo().voci).filter((v) => String(v.testo || '').trim());
    const io = UT.attuale(), R = { cliente: '', matricola: '', note: '', esiti: voci.map(() => ''), noteV: voci.map(() => ''), motori: Object.fromEntries(MOTORI.map(([k]) => [k, motVuoto(k)])) };
    const aperti = new Set(), chiusi = new Set();   // chiusi = schede parametri chiuse a mano (non si riaprono da sole)
    let sporco = false, fase = 'targa';
    App.proteggi(() => sporco);
    const targaHtml = (riass) => MOTORI.map(([k, nome]) => `<div class="ct-mot"><h3>${nome}</h3><div class="ct-mc">${CAMPI(k).map(([c, l, u]) =>
      riass ? `<span><small>${l}</small><b>${esc(R.motori[k][c] || '—')} ${R.motori[k][c] ? u : ''}</b></span>` : `<label>${l} [${u}]<input data-mt="${k}.${c}" value="${esc(R.motori[k][c])}" inputmode="${c === 'n' ? 'numeric' : 'decimal'}" autocomplete="off"></label>`).join('')}</div></div>`).join('');
    // fase 1: finestra con i dati di targa dei motori
    const disegnaTarga = () => {
      el.innerHTML = `<section class="ct"><div class="card ct-testa"><h1>Test gru · ${esc(s.nome || '')} ${info('Prima di iniziare scrivi i dati di targa dei 3 motori. Servono per parametrizzare gli inverter: P00.00 = quanti motori, P02.01 = kW (sommati se 2 motori), P02.02 Hz, P02.03 giri, P02.04 V, P02.05 corrente (sommata se 2 motori). Se un motore non c\'è lascia vuoto.')}</h1>
          <p class="muted small">Passo 1 di 2 · dati di targa dei motori</p></div>
        <div class="ct-targa">${targaHtml(false)}</div>
        <div class="card"><div class="azioni-form"><a class="btn ghost" href="#/cablaggio/s/${s.id}">Annulla</a><span class="grow"></span><button type="button" class="btn" id="ctAvanti">Inizia la check list ▶</button></div></div></section>`;
      el.querySelectorAll('[data-mt]').forEach((x) => (x.oninput = () => { const [k, c] = x.dataset.mt.split('.'); x.value = x.value.replace(c === 'n' ? /[^0-9]/g : /[^0-9.,]/g, ''); R.motori[k][c] = x.value; sporco = true; }));
      el.querySelector('#ctAvanti').onclick = () => { fase = 'lista'; App.passoInterno?.(); disegna(); scrollTo(0, 0); };
      el.querySelector('[data-mt]')?.focus({ preventScroll: true });
    };
    App.suIndietroInterno?.(() => { if (fase === 'lista') { fase = 'targa'; disegnaTarga(); scrollTo(0, 0); return true; } return false; });
    const disegna = () => {
      if (fase === 'targa') return disegnaTarga();
      const prossima = R.esiti.indexOf('');
      if (prossima >= 0 && motoreDi(voci[prossima]) && !chiusi.has(prossima)) aperti.add(prossima);
      const fatti = R.esiti.filter(Boolean).length;
      el.innerHTML = `
        <section class="ct">
          <div class="card ct-testa"><h1>Test gru · ${esc(s.nome || '')} ${info('Rispondi a tutte le voci: ✔ fatto / ok, ✘ non va. Sulle voci con ⚙ trovi la linea guida dei parametri inverter GD20 e GD28 e puoi segnare «inverter non presente». Alla fine salva: la check list va in GHO ELIGIO › Collaudi.')}</h1>
            <div class="ct-campi"><label>Cliente / commessa<input id="ctCli" value="${esc(R.cliente)}" autocomplete="off"></label><label>Matricola gru<input id="ctMat" value="${esc(R.matricola)}" autocomplete="off"></label></div>
            <p class="muted small">${fmt(UI.oggi())} · tecnico ${esc(UT.breve(io))} · <b>${fatti}/${voci.length}</b> voci fatte</p></div>
          <div class="card ct-targa ct-riass"><div class="ct-rh"><b>Dati di targa motori</b><button type="button" class="btn ghost small" id="ctTarga">✏️ Modifica</button></div>${targaHtml(true)}</div>
          <ol class="ct-lista">${voci.map((v, k) => { const r = R.esiti[k]; return `<li class="ct-v ${r ? 'ct-es' + r : ''}">
              <div class="ct-vt"><span class="ct-n">${k + 1}</span><span class="ct-txt">${esc(String(v.testo).toUpperCase())}</span></div>
              <div class="ct-vx">
                <button type="button" data-e="${k}.v" class="${r === 'v' ? 'on' : ''}" aria-label="Fatto">✔</button>
                <button type="button" data-e="${k}.x" class="${r === 'x' ? 'on' : ''}" aria-label="Non va">✘</button>
                ${motoreDi(v) ? `<button type="button" data-e="${k}.np" class="np ${r === 'np' ? 'on' : ''}">INVERTER NON PRESENTE</button>` : ''}</div>
              ${motoreDi(v) ? `<button type="button" class="btn ghost small ct-pbtn" data-par="${k}">⚙ ${aperti.has(k) ? 'Chiudi' : 'Apri'} parametri inverter ${esc(NOME_MOT[motoreDi(v)].replace('Motore ', ''))} GD20 / GD28</button>${aperti.has(k) ? paramHtml(motoreDi(v), R.motori[motoreDi(v)], base, noteInv) : ''}` : ''}
              ${r === 'x' || R.noteV[k] ? `<input class="ct-nv" data-nv="${k}" value="${esc(R.noteV[k])}" placeholder="Cosa non va / nota" autocomplete="off">` : ''}
            </li>`; }).join('')}</ol>
          <div class="card"><label class="ct-nota">Note<textarea id="ctNote" rows="3">${esc(R.note)}</textarea></label>
            ${io?.firma ? `<div class="ct-firma"><span class="muted small">Firma del tecnico</span><img src="${io.firma}" alt="Firma"></div>` : '<p class="muted small">Non hai la firma salvata nel profilo: il collaudo viene salvato col tuo nome.</p>'}
            <div class="azioni-form"><a class="btn ghost" href="#/cablaggio/s/${s.id}">Annulla</a><span class="grow"></span><button type="button" class="btn" id="ctSalva">💾 Salva collaudo</button></div></div>
        </section>`;
      const inp = (id, k) => { const x = el.querySelector(id); x.oninput = () => { R[k] = id === '#ctNote' ? x.value : x.value.toUpperCase(); if (id !== '#ctNote') { const p = x.selectionStart; x.value = R[k]; x.setSelectionRange(p, p); } sporco = true; }; };
      inp('#ctCli', 'cliente'); inp('#ctMat', 'matricola'); inp('#ctNote', 'note');
      el.querySelector('#ctTarga').onclick = () => { fase = 'targa'; disegnaTarga(); scrollTo(0, 0); };
      el.querySelectorAll('[data-e]').forEach((x) => (x.onclick = () => { const [k, e] = x.dataset.e.split('.'); R.esiti[+k] = R.esiti[+k] === e ? '' : e; sporco = true; const y = scrollY; disegna(); scrollTo(0, y);
        if (e === 'x' && R.esiti[+k] === 'x') el.querySelector(`[data-nv="${k}"]`)?.focus({ preventScroll: true }); }));
      el.querySelectorAll('[data-par]').forEach((x) => (x.onclick = () => { const k = +x.dataset.par; if (aperti.has(k)) { aperti.delete(k); chiusi.add(k); } else { aperti.add(k); chiusi.delete(k); } const y = scrollY; disegna(); scrollTo(0, y); }));
      el.querySelectorAll('[data-nv]').forEach((x) => (x.oninput = () => { R.noteV[+x.dataset.nv] = x.value; sporco = true; }));
      el.querySelector('#ctSalva').onclick = async () => {
        const manca = R.esiti.filter((e) => !e).length;
        if (manca && !UI.conferma(`Mancano ${manca} voci senza risposta.\n\nSalvare lo stesso il collaudo come incompleto?`)) return;
        const esiti = R.esiti.slice(), nx = esiti.filter((e) => e === 'x').length;
        const doc = { id: uid(), tipo: 'checklist', nome: `Collaudo ${s.nome || ''} ${R.matricola || ''}`.trim(), schedaId: s.id, schedaNome: s.nome || '',
          cliente: R.cliente.trim(), matricola: R.matricola.trim(), note: R.note.trim(), motori: JSON.parse(JSON.stringify(R.motori)),
          voci: voci.map((v, k) => ({ testo: String(v.testo).toUpperCase(), inv: !!motoreDi(v), mot: motoreDi(v), esito: esiti[k], nota: R.noteV[k].trim() })),
          // fogli dei parametri inverter (uno per inverter presente), salvati così come calcolati
          inverter: voci.map((v, k) => [v, k]).filter(([v, k]) => motoreDi(v) && esiti[k] !== 'np').map(([v, k]) => ({ voce: k + 1, mot: motoreDi(v), testo: String(v.testo).toUpperCase(), esito: esiti[k], dati: { ...R.motori[motoreDi(v)] }, righe: parametri(motoreDi(v), R.motori[motoreDi(v)], base), note: noteDi(noteInv).filter((t) => !/^\*\s/.test(t)) })),
          esiti, completo: !manca && !nx, nonSuperato: nx > 0, data: new Date().toISOString(), tecnicoId: io?.id || '', tecnico: UT.breve(io), firma: io?.firma || null };
        try { await UI.salva('collaudi', doc); } catch (e) { return; }
        sporco = false; UT.registra?.('crea', 'Collaudo ' + doc.nome); UI.toast('Collaudo salvato in GHO › Collaudi', 'ok');
        location.hash = '#/gho/collaudi/' + doc.id;
      };
    };
    disegna();
    return { titolo: 'Test gru', indietro: `#/cablaggio/s/${s.id}`, live: false };
  }

  // ---------- GHO › Collaudi ----------
  const esito = (c) => (c.tipo !== 'checklist' ? (c.completo ? 'ok' : 'inc') : c.nonSuperato ? 'ko' : c.completo ? 'ok' : 'inc');
  const ESITO = { ok: ['✓', 'Superato'], ko: ['✘', 'Non superato'], inc: ['!', 'Incompleto'] };
  let cerca = '';
  function elenco(el, S) {
    const q = cerca.trim().toLowerCase();
    const lista = [...S.collaudi].sort((a, b) => (b.data || '').localeCompare(a.data || ''))
      .filter((c) => !q || [c.cliente, c.matricola, c.schedaNome, c.tecnico, c.note].join(' ').toLowerCase().includes(q));
    el.innerHTML = `
      <section class="cli">
        <div class="sez-head"><h1>Collaudi ${info('Tutte le check list di collaudo compilate con «▶ Avvia test gru» dalle schede di cablaggio. Ci sono anche i rapporti PDF fatti col configuratore vecchio (il PDF si apre solo sul dispositivo dove è stato creato).')}</h1></div>
        ${S.collaudi.length > 5 ? `<input type="search" id="ctQ" class="cerca" placeholder="Cerca cliente, matricola, scheda…" value="${esc(cerca)}">` : ''}
        <div class="elenco">${lista.map((c) => { const e = esito(c); return `
          <${c.tipo === 'checklist' ? `a href="#/gho/collaudi/${c.id}"` : 'div'} class="riga cli-riga ct-riga">
            <span class="avatar ct-av-${e}" title="${ESITO[e][1]}">${ESITO[e][0]}</span>
            <div class="riga-main"><div class="riga-top"><b>${esc(c.cliente || 'Cliente non indicato')}</b>${c.matricola ? ` · matr. ${esc(c.matricola)}` : ''}</div>
              <div class="muted small">${fmt((c.data || '').slice(0, 10))} · ${esc(c.tecnico || '—')}${c.schedaNome ? ' · ' + esc(c.schedaNome) : c.configurazione ? ' · ' + esc(String(c.configurazione).replace(/-/g, ' ').toUpperCase()) : ''} · ${ESITO[e][1]}</div></div>
            ${c.tipo !== 'checklist' && c.fileId ? `<button type="button" class="btn small" data-pdf="${c.id}">PDF</button>` : c.tipo === 'checklist' ? '<span class="cbs-fr">›</span>' : ''}
          </${c.tipo === 'checklist' ? 'a' : 'div'}>`; }).join('') || `<p class="nessuno">${S.collaudi.length ? 'Nessun collaudo trovato.' : 'Ancora nessun collaudo. Si fanno dalle schede di cablaggio con «▶ Avvia test gru».'}</p>`}</div>
      </section>`;
    el.querySelectorAll('[data-pdf]').forEach((b) => (b.onclick = () => { const c = S.collaudi.find((x) => x.id === b.dataset.pdf); ALLEGATI.apri(c.fileId, c.nome); }));
    const q2 = el.querySelector('#ctQ');
    q2 && (q2.oninput = () => { cerca = q2.value; const p = q2.selectionStart; App.ridisegna(); const n = document.getElementById('ctQ'); n.focus(); n.setSelectionRange(p, p); });
    return { titolo: 'Collaudi', indietro: '#/gho', live: true };
  }

  // foglio del collaudo (A4 verticale, anche da stampare)
  function dettaglio(el, S, id) {
    const c = S.collaudi.find((x) => x.id === id);
    if (!c) { el.innerHTML = '<p class="nessuno">Collaudo non trovato.</p>'; return { titolo: 'Collaudo', indietro: '#/gho/collaudi' }; }
    const e = esito(c), V = { v: '✔ OK', x: '✘ NO', np: 'INVERTER ASSENTE', '': '—' };
    el.innerHTML = `
      <section class="ct-det">
        <div class="cbs-azioni no-print">
          ${UT.puo('stampa') ? '<button type="button" class="btn ghost" id="ctPrint">🖨 Stampa</button>' : ''}
          ${c.schedaId ? `<a class="btn ghost" href="#/cablaggio/s/${c.schedaId}">Scheda di cablaggio</a>` : ''}
          ${UT.puo('cablaggio.modifica') && !UT.solaLettura() ? '<button type="button" class="btn ghost danger" id="ctDel">🗑 Elimina</button>' : ''}</div>
        <div class="ct-foglio">
          <div class="ct-fh"><img src="img/logo-grande.png" alt="Gru Impianti"><div><h1>RAPPORTO DI COLLAUDO</h1><p>Check list test gru</p></div></div>
          <table class="ct-dati"><tr><th>Cliente / commessa</th><td>${esc(c.cliente || '—')}</td><th>Matricola gru</th><td>${esc(c.matricola || '—')}</td></tr>
            <tr><th>Scheda di cablaggio</th><td>${esc(c.schedaNome || '—')}</td><th>Data</th><td>${fmt((c.data || '').slice(0, 10))}</td></tr></table>
          ${c.motori ? `<table class="ct-voci ct-mtab"><thead><tr><th>Dati di targa</th><th>Hz</th><th>V</th><th>A</th><th>rpm</th><th>kW</th><th>n°</th></tr></thead><tbody>
            ${MOTORI.map(([k, nome]) => { const m = c.motori[k] || {}, d = (...x) => esc(x.filter(Boolean).join(' / ') || '—');
              return `<tr><td>${nome.replace('Motore ', '').toUpperCase()}</td><td>${d(m.hz)}</td><td>${d(m.v)}</td><td>${d(m.a1, m.a2)}</td><td>${d(m.g1, m.g2)}</td><td>${d(m.kw)}</td><td>${k === 'soll' ? '1' : d(m.n)}</td></tr>`; }).join('')}</tbody></table>` : ''}
          <div class="ct-esito ct-es-${e}">${e === 'ok' ? 'COLLAUDO SUPERATO' : e === 'ko' ? 'COLLAUDO NON SUPERATO' : 'COLLAUDO INCOMPLETO'}</div>
          <table class="ct-voci"><thead><tr><th>N.</th><th>Voce</th><th>Esito</th></tr></thead><tbody>
            ${(c.voci || []).map((v, k) => `<tr class="ct-r-${v.esito || 'no'}"><td>${k + 1}</td><td>${esc(v.testo)}${v.nota ? `<small>${esc(v.nota)}</small>` : ''}</td><td class="es">${V[v.esito || '']}</td></tr>`).join('')}</tbody></table>
          ${c.note ? `<div class="ct-dnote"><b>Note</b><p>${esc(c.note).replace(/\n/g, '<br>')}</p></div>` : ''}
          <div class="ct-ff"><div><span>Tecnico</span><b>${esc(c.tecnico || '—')}</b></div><div class="ct-ffirma"><span>Firma</span>${c.firma ? `<img src="${c.firma}" alt="Firma">` : ''}</div></div>
        </div>
        ${(c.inverter || []).map((iv, q) => `<div class="ct-foglio ct-fpar">
          <div class="ct-fh"><img src="img/logo-grande.png" alt="Gru Impianti"><div><h1>PARAMETRI INVERTER ${esc(NOME_MOT[iv.mot].replace('Motore ', '').toUpperCase())}</h1><p>Rapporto di collaudo · ${esc(c.cliente || '')}${c.matricola ? ' · matr. ' + esc(c.matricola) : ''} · ${fmt((c.data || '').slice(0, 10))} · pagina ${q + 2} di ${(c.inverter || []).length + 1}</p></div></div>
          <p class="ct-pmot">Voce ${iv.voce}: ${esc(iv.testo)} · targa: ${CAMPI(iv.mot).filter(([k]) => iv.dati[k]).map(([k, l, u]) => `${l.toLowerCase()} <b>${esc(iv.dati[k])} ${u}</b>`).join(' · ') || 'non compilata'}</p>
          <div class="ct-param"><table><thead><tr><th>Parametro</th><th>Descrizione</th><th>GD20</th><th>GD28</th></tr></thead>
            ${iv.righe.map((g) => `<tbody>${g.map(([cd, d, a, b, x]) => `<tr${x ? ' class="ct-calc"' : ''}><td><b>${cd}</b></td><td>${esc(d)}</td><td class="v">${esc(a) || '—'}</td><td class="v">${esc(b) || '—'}</td></tr>`).join('')}</tbody>`).join('')}</table>
            <p class="ct-pnote">${(iv.note || PARAM_NOTE.filter((t) => !t.startsWith('* '))).map(esc).join('<br>')}</p></div>
        </div>`).join('')}
      </section>`;
    el.querySelector('#ctPrint')?.addEventListener('click', () => { const t0 = document.title; document.title = 'Collaudo_' + String(c.cliente || c.schedaNome || '').replace(/[^\w\-]+/g, '_'); document.body.classList.add('ct-stampa'); window.print(); setTimeout(() => { document.body.classList.remove('ct-stampa'); document.title = t0; }, 800); });
    el.querySelector('#ctDel')?.addEventListener('click', async () => {
      if (!UI.conferma('Eliminare questo collaudo?\n\nNon si potrà recuperare.')) return;
      await Backend.remove('collaudi', c.id); UT.registra?.('elimina', 'Collaudo ' + (c.nome || '')); UI.toast('Collaudo eliminato'); location.hash = '#/gho/collaudi';
    });
    return { titolo: 'Collaudo', indietro: '#/gho/collaudi', live: true };
  }

  function route(el, S, parti) { return parti[2] ? dettaglio(el, S, parti[2]) : elenco(el, S); }
  return { nuovo, nuovoInv, invHtml, bloccoHtml, lega, esegui, puoTest, route, paramHtml, parametri };
})();
