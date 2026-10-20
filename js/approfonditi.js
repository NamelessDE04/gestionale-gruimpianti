// ===== ALTRI CONTROLLI APPROFONDITI =====
// Cinque controlli, ognuno con il suo modulo originale da stampare:
//  - pinze motorizzate / ganci a C e magneti: un foglio all'anno per attrezzo, 4 controlli (uno per fascetta)
//  - funi e carrucole, bozzello (gancio), indagine supplementare: una scheda per ogni controllo
window.APR = (function () {
  const { esc, oggi, uid, fmt, info } = UI;

  const SLOT = [
    { n: 1, nome: 'blu', col: '#00b0f0' }, { n: 2, nome: 'giallo', col: '#ffff00' },
    { n: 3, nome: 'arancio', col: '#ffc000' }, { n: 4, nome: 'verde', col: '#92d050' }
  ];
  const TIPI = {
    pinza: { fam: 'a', titolo: 'Pinze motorizzate e ganci a C', uno: 'pinza / gancio a C', nuovo: '＋ Nuova pinza o gancio a C', ill: 'pinza',
      sotto: 'Attrezzi sottogancio: 4 controlli all\'anno', maxComp: 5, matricola: 'Matricola',
      comp: ['struttura', 'attacco superiore', 'catene e accessori', 'ganci inferiori', 'sicurezze ganci'].map((t) => ({ t, sc: 'T' })) },
    magnete: { fam: 'a', titolo: 'Magneti', uno: 'magnete', nuovo: '＋ Nuovo magnete', ill: 'magnete', sotto: 'Magneti sottogancio: 4 controlli all\'anno', maxComp: 6, matricola: 'CE',
      comp: [
        { t: 'presenza e leggibilità targhette', sc: 'T' },
        { t: 'sistemi ancoraggio (perni, orecchie, catene) deformazioni e usura < 10%', sc: 'T' },
        { t: 'integrità poli magnetici (ammaccature e sporgenze < 10%)', sc: 'T' },
        { t: 'controllo funzionale (movimento leva e suo blocco sicurezza)', sc: 'T' },
        { t: 'struttura/involucro (ammaccature, deformazioni, serraggio bulloneria)', sc: 'A' },
        { t: 'prove di carico 2x WLL (sollevamento, trasporto)', sc: 'A' }
      ] },
    fune: { fam: 's', titolo: 'Funi, carrucole e tamburo', uno: 'scheda fune', nuovo: '＋ Nuova scheda fune', ill: 'fune', sotto: 'Fune acciaio, carrucole e tamburo' },
    bozzello: { fam: 's', titolo: 'Bozzello e gancio', uno: 'scheda gancio', nuovo: '＋ Nuova scheda gancio', ill: 'bozzello', sotto: 'Controllo approfondito del gancio' },
    indagine: { fam: 's', titolo: 'Indagine supplementare', uno: 'indagine', nuovo: '＋ Nuova indagine', ill: 'indagine', sotto: 'Indagine approfondita a punti' }
  };
  const ORDINE = ['pinza', 'magnete', 'fune', 'bozzello', 'indagine'];
  // giudizi della colonna C e della colonna R/S
  const COD_C = [['X', 'esame visivo-funzionale'], ['nc', 'non controllato'], ['\\', 'non presente'], ['/', 'non eseguito']];
  const COD_RS = [['R', 'ripristinato'], ['S', 'sostituito'], ['P', 'pulito'], ['L', 'lubrificato']];
  const GRADI = ['NULLO', 'LEGGERO', 'MEDIO', 'SOSTITUIRE'];

  const anno0 = () => new Date().getFullYear();
  let annoScelto = anno0();
  const filtri = {};
  const componenti = (a) => (a.componenti?.length ? a.componenti : TIPI[a.tipo].comp);
  const cliDi = (S, sedeId) => SG.cliente(S, sedeId);
  const nomeCli = (c) => (c ? `${c.nome}${c.localita ? ' · ' + c.localita : ''}` : '(cliente)');
  const controlliAnno = (S, aid, anno) => SLOT.map((s) => S.controlliAttrezzi.find((c) => c.attrezzoId === aid && c.anno === anno && c.slot === s.n) || null);
  const dataBreve = (s) => { if (!s) return ''; const [, m, d] = s.split('-'); return `${+d}/${+m}`; };
  const num = (x) => { const v = parseFloat(String(x ?? '').replace(',', '.')); return Number.isFinite(v) ? v : null; };
  const fmtN = (v, dec = 2) => (v == null ? '' : String(Math.round(v * 10 ** dec) / 10 ** dec).replace('.', ','));
  const nomeFile = (t) => t.replace(/[^\w\-àèéìòù ]+/gi, '').trim().replace(/\s+/g, '_');

  // calcoli automatici del bozzello: deformazione dell'apertura e usura della sezione
  function calcoliBozzello(d) {
    const v = d.v || {}, ar = num(v.ar), am = num(v.am), hr = num(v.hr), hm = num(v.hm), o = {};
    if (ar != null && am != null) {
      const dr = Math.abs(am - ar), mda = ar * 0.10;
      Object.assign(o, { dr: fmtN(dr), mda: fmtN(mda), drPct: fmtN(ar ? dr / ar * 100 : 0, 1) + '%', esitoDim: dr <= mda ? 'ACCETTABILE (DR<MDA)' : 'NON ACCETTABILE (DR>MDA)' });
    } else if (ar != null) o.mda = fmtN(ar * 0.10);
    if (hr != null && hm != null) {
      const us = Math.abs(hr - hm), mha = hr * 0.05;
      Object.assign(o, { usura: fmtN(us), mha: fmtN(mha), usuraPct: fmtN(hr ? us / hr * 100 : 0, 1) + '%', esitoUsura: us <= mha ? 'ACCETTABILE (HR<MHA)' : 'NON ACCETTABILE (HR>MHA)' });
    } else if (hr != null) o.mha = fmtN(hr * 0.05);
    return o;
  }

  // ---------- pezzi di interfaccia ----------
  // scelta a pulsanti (una sola, oppure più di una con multi)
  const scelta = (k, opzioni, val, multi) => `<div class="ap-scelte${multi ? ' multi' : ''}" data-scelta="${k}">${opzioni.map((o) => {
    const on = multi ? [].concat(val || []).includes(o) : val === o;
    return `<button type="button" class="${on ? 'on' : ''}" data-v="${esc(o)}">${esc(o)}</button>`; }).join('')}</div>`;
  const leggiScelte = (root) => {
    const o = {};
    root.querySelectorAll('[data-scelta]').forEach((b) => {
      const on = [...b.querySelectorAll('button.on')].map((x) => x.dataset.v);
      o[b.dataset.scelta] = b.classList.contains('multi') ? on : (on[0] || '');
    });
    return o;
  };
  const collegaScelte = (root, dopo) => root.querySelectorAll('[data-scelta]').forEach((b) => b.querySelectorAll('button').forEach((x) => (x.onclick = () => {
    if (b.classList.contains('multi')) x.classList.toggle('on');
    else { const era = x.classList.contains('on'); b.querySelectorAll('button').forEach((y) => y.classList.remove('on')); if (!era) x.classList.add('on'); }
    dopo && dopo();
  })));
  const campo = (lab, k, val, o = {}) => `<label${o.cls ? ` class="${o.cls}"` : ''}>${lab}${o.info ? ' ' + info(o.info) : ''}<input name="${k}" value="${esc(val ?? '')}"${o.num ? ' inputmode="decimal"' : ''}${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${o.list ? ` list="${o.list}"` : ''}></label>`;
  const area = (lab, k, val, ph, righe = 2) => `<label>${lab}<textarea name="${k}" rows="${righe}" placeholder="${esc(ph || '')}">${esc(val ?? '')}</textarea></label>`;
  const leggiCampi = (f, chiavi) => Object.fromEntries(chiavi.map((k) => [k, (f.elements[k]?.value ?? '').trim()]));

  // scelta della sede del cliente
  function sceltaSede(S, sedeId) {
    const op = [...S.clienti].sort((a, b) => a.ragioneSociale.localeCompare(b.ragioneSociale))
      .map((c) => `<optgroup label="${esc(c.ragioneSociale)}">${(c.sedi || []).map((s) => `<option value="${s.id}" ${s.id === sedeId ? 'selected' : ''}>${esc(c.ragioneSociale)} – ${esc(s.nome || s.citta || 'sede')}</option>`).join('')}</optgroup>`).join('');
    return `<label>Cliente e sede *<select name="sede" required><option value="">— scegli —</option>${op}</select></label>`;
  }
  const portate = (i) => (i.paranchi || []).map((p) => p.portata).filter(Boolean).map((k) => (+k >= 1000 ? fmtN(k / 1000, 1) + ' t' : k + ' kg')).join(' + ');
  const descImp = (i) => [i.numeroInterno && 'N° ' + i.numeroInterno, i.tipologia, i.marca, i.matricola && 'matr. ' + i.matricola].filter(Boolean).join(' · ');
  function sceltaImpianto(S, sedeId, impId) {
    const imp = S.impianti.filter((i) => i.sedeId === sedeId);
    return `<label>Impianto (gru) ${info('Se scegli la gru dall\'anagrafica impianti, numero, tipo, matricola e portata si compilano da soli. Puoi sempre cambiarli a mano.')}
      <select name="impianto"><option value="">— nessuno / non in anagrafica —</option>${imp.map((i) => `<option value="${i.id}" ${i.id === impId ? 'selected' : ''}>${esc(descImp(i) || 'impianto')}</option>`).join('')}</select></label>`;
  }

  // foto (compresse, per stare comode nel database)
  function campoFoto(k, src, lab) {
    return `<div class="ap-foto" data-foto="${k}"><span class="lab">${lab}</span>
      <div class="ap-foto-box">${src ? `<img src="${src}" alt="">` : '<span class="muted">nessuna foto</span>'}</div>
      <div class="ap-foto-az"><label class="btn ghost small">📷 ${src ? 'Cambia' : 'Aggiungi'} foto<input type="file" accept="image/*" capture="environment" hidden></label>
      ${src ? '<button type="button" class="btn ghost small danger" data-togli>Togli</button>' : ''}</div></div>`;
  }
  function collegaFoto(root, stato, ridisegna) {
    root.querySelectorAll('[data-foto]').forEach((b) => {
      const k = b.dataset.foto;
      b.querySelector('input[type=file]').onchange = async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try { stato[k] = await UI.comprimiFoto(f, 1000, 0.6); ridisegna(); } catch (er) { UI.toast('Foto non leggibile', 'err'); }
      };
      b.querySelector('[data-togli]')?.addEventListener('click', () => { delete stato[k]; ridisegna(); });
    });
  }

  // ================= HUB =================
  function hub(el, S) {
    const conta = (k) => (TIPI[k].fam === 'a' ? S.attrezzi.filter((a) => a.tipo === k && !a.dismesso).length : S.schedeApprofondite.filter((d) => d.tipo === k).length);
    el.innerHTML = `
      <section class="home">
        <div class="home-head"><h1>Altri controlli approfonditi <span class="pill-beta">BETA</span></h1><p>Che controllo devi fare?</p></div>
        <div class="avviso-m st-b-scadenza ap-beta"><span class="av-ico">🧪</span><span class="grow"><b>Sezione in prova (beta)</b><span>Si può già usare, ma potrebbe cambiare: se qualcosa non torna o manca, segnalatelo.</span></span></div>
        <div class="tiles due-tiles">${ORDINE.map((k) => { const t = TIPI[k], n = conta(k);
          return `<a class="tile attiva" href="#/approfonditi/${k}"><div class="tile-ill">${ILL[t.ill]}</div>
            <div class="tile-txt"><h2>${t.titolo}</h2><p>${t.sotto}</p>${n ? `<span class="tile-badge">${n} ${t.fam === 'a' ? (n === 1 ? 'attrezzo' : 'attrezzi') : (n === 1 ? 'scheda' : 'schede')}</span>` : ''}</div></a>`; }).join('')}</div>
      </section>`;
    return { titolo: 'Altri controlli', indietro: '#/schede', live: true };
  }

  // ================= ELENCO =================
  function elenco(el, S, tipo, query) {
    const T = TIPI[tipo];
    const q = (filtri[tipo] || '').toLowerCase();
    let corpo = '';
    if (T.fam === 'a') {
      const anno = anno0();
      const tutti = S.attrezzi.filter((a) => a.tipo === tipo);
      const lista = tutti.filter((a) => !q || [a.nInterno, a.tipoDesc, a.casa, a.portata, a.nFabbrica, a.matricola, nomeCli(cliDi(S, a.sedeId))].join(' ').toLowerCase().includes(q));
      const gruppi = {};
      lista.forEach((a) => (gruppi[a.sedeId] = gruppi[a.sedeId] || []).push(a));
      corpo = Object.entries(gruppi).map(([sid, arr]) => ({ c: cliDi(S, sid), arr })).sort((x, y) => nomeCli(x.c).localeCompare(nomeCli(y.c))).map(({ c, arr }) => `
        <div class="sg2-tit">${esc(nomeCli(c))}</div>
        <div class="sg2-lista">${arr.sort((a, b) => String(a.nInterno || '').localeCompare(String(b.nInterno || ''), 'it', { numeric: true })).map((a) => {
          const ct = controlliAnno(S, a.id, anno), ult = ct.filter(Boolean).pop();
          return `<a class="sg2-riga ${a.dismesso ? 'dismesso' : ''}" href="#/approfonditi/${tipo}/a/${a.id}">
            <span class="n">${esc(a.nInterno || '–')}</span>
            <span class="d">${esc(a.tipoDesc || T.uno)}<small>${[a.casa, a.portata, a.nFabbrica && 'n° ' + a.nFabbrica].filter(Boolean).map(esc).join(' · ')}${ult?.fuoriServizio ? ' · <b class="txt-ko">FUORI SERVIZIO</b>' : ''}</small></span>
            <span class="ap-pallini">${SLOT.map((s, i) => `<i style="--c:${s.col}" class="${ct[i] ? 'on' : ''}" title="${s.nome}"></i>`).join('')}</span></a>`; }).join('')}</div>`).join('')
        || `<p class="nessuno">${tutti.length ? 'Nessun risultato.' : `Nessun${tipo === 'pinza' ? 'a pinza o gancio a C' : ' magnete'} in elenco. Aggiungi il primo con «${T.nuovo}».`}</p>`;
    } else {
      const tutti = S.schedeApprofondite.filter((d) => d.tipo === tipo);
      const lista = tutti.filter((d) => !q || [nomeCli(cliDi(S, d.sedeId)), d.v?.gruN, d.v?.gru, d.v?.matricola, d.v?.particolare, d.v?.nInterno, d.data].join(' ').toLowerCase().includes(q))
        .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
      const leggi = UT.solaLettura();
      corpo = lista.length ? `<div class="sg2-lista">${lista.map((d) => {
        const v = d.v || {}, esito = tipo === 'fune' ? v.giudizioFune || v.giudizio2 : tipo === 'bozzello' ? v.esito : v.conclusioni;
        const cosa = tipo === 'indagine' ? v.particolare : [v.gruN || v.gru, v.matricola && 'matr. ' + v.matricola].filter(Boolean).join(' · ');
        return `<a class="sg2-riga" href="#/approfonditi/${tipo}/s/${d.id}${leggi ? '/stampa' : ''}">
          <span class="n ap-data">${esc(fmt(d.data).replace(/\/(\d\d)(\d\d)$/, '/$2'))}</span>
          <span class="d">${esc(nomeCli(cliDi(S, d.sedeId)))}<small>${esc(cosa || '')}${esito ? ' · ' + esc(esito) : ''}</small></span></a>`; }).join('')}</div>`
        : `<p class="nessuno">${tutti.length ? 'Nessun risultato.' : `Nessuna scheda. Crea la prima con «${T.nuovo}».`}</p>`;
    }
    el.innerHTML = `
      <section class="sg sg2 ap">
        <div class="card sg2-testa"><div class="grow"><h1>${T.titolo}</h1>
          <p class="muted small">${T.sotto} ${info(T.fam === 'a' ? 'Ogni attrezzo ha il suo foglio annuale con 4 colonne, una per fascetta (blu, giallo, arancio, verde). Tocca un attrezzo per fare il controllo o stampare il foglio. I pallini colorati sono i controlli già fatti quest\'anno.' : 'Ogni controllo è una scheda: tocca una scheda per completarla o stamparla.')}</p></div></div>
        ${!UT.solaLettura() ? `<a class="sg2-inizia ap-nuovo" href="#/approfonditi/${tipo}/nuovo">${T.nuovo}</a>` : ''}
        <input type="search" id="fTesto" class="cerca" placeholder="Cerca cliente, numero, matricola…" value="${esc(filtri[tipo] || '')}">
        ${corpo}
      </section>`;
    const ft = el.querySelector('#fTesto');
    ft.oninput = () => { filtri[tipo] = ft.value; const p = ft.selectionStart; App.ridisegna(); const n = document.getElementById('fTesto'); n.focus(); n.setSelectionRange(p, p); };
    void query;
    return { titolo: T.titolo, indietro: '#/approfonditi', live: true };
  }

  // ================= ATTREZZO (pinza / magnete) =================
  function schedaAttrezzo(el, S, tipo, id, query) {
    const T = TIPI[tipo], a = S.attrezzi.find((x) => x.id === id);
    if (!a) { el.innerHTML = '<p class="nessuno">Attrezzo non trovato.</p>'; return { titolo: T.titolo, indietro: '#/approfonditi/' + tipo }; }
    if (query.get('anno')) annoScelto = +query.get('anno');
    const anno = annoScelto, ct = controlliAnno(S, id, anno), prossimo = SLOT.find((s, i) => !ct[i]);
    const c = cliDi(S, a.sedeId), comp = componenti(a), base = `#/approfonditi/${tipo}/a/${id}`;
    const oss = ct.filter(Boolean).flatMap((k) => [
      ...(k.righe || []).filter((r) => r.c === 'N').map((r) => `<li><b>${r.n}</b> ${esc(r.oss || '')} <small class="muted">${dataBreve(k.data)}</small></li>`),
      ...(k.note || '').split('\n').filter((t) => t.trim()).map((t) => `<li>${esc(t)} <small class="muted">${dataBreve(k.data)}</small></li>`),
      ...(k.fuoriServizio ? [`<li class="txt-ko"><b>${fmt(k.data)} – FUORI SERVIZIO</b></li>`] : [])]);
    el.innerHTML = `
      <section class="sg sg2 ap">
        <div class="card sg2-testa">
          <div class="grow"><h1>${esc(a.tipoDesc || T.uno)} ${a.nInterno ? `<span class="loc">n° ${esc(a.nInterno)}</span>` : ''}</h1>
            <p class="muted small">${esc(nomeCli(c))}${a.casa ? ' · ' + esc(a.casa) : ''}${a.portata ? ' · ' + esc(a.portata) : ''}
            ${info('Il pulsante grande avvia il prossimo controllo dell\'anno (una fascetta per controllo). Tocca una fascetta già fatta per correggerla. Nel menu ⋯ trovi la stampa del foglio e la modifica dei dati dell\'attrezzo.')}</p></div>
          <div class="anno anno-mini"><a href="${base}?anno=${anno - 1}" aria-label="Anno prima">‹</a><b>${anno}</b><a href="${base}?anno=${anno + 1}" aria-label="Anno dopo">›</a></div>
          ${UI.menu([
            UT.puoInviare() && { t: `🖨️ Foglio ${anno} per il cliente`, href: `${base}/stampa/${anno}` },
            !UT.solaLettura() && { t: '✏️ Modifica dati attrezzo', href: `${base}/modifica` }
          ])}
        </div>
        <div class="sg2-fasce">${SLOT.map((s, i) => ct[i] ? `<a class="fatta" style="--c:${s.col}" href="${base}/controllo/${anno}/${s.n}">✓ ${s.nome} ${dataBreve(ct[i].data)}</a>` : `<span style="--c:${s.col}">${s.nome}</span>`).join('')}</div>
        ${prossimo && !UT.solaLettura() ? `<a class="sg2-inizia" style="--c:${prossimo.col}" href="${base}/controllo/${anno}/${prossimo.n}">▶ Inizia controllo fascetta ${prossimo.nome.toUpperCase()}<small>${prossimo.n}° controllo del ${anno}</small></a>`
          : !prossimo ? `<p class="sg2-finito">✓ Tutti e 4 i controlli del ${anno} sono fatti</p>` : ''}
        <div class="sg2-tit">Componenti · giudizi ${anno}</div>
        <div class="sg2-lista">${comp.map((cp, i) => `
          <div class="sg2-riga"><span class="d">${esc(cp.t)}${tipo === 'magnete' ? ` <small class="muted">${cp.sc === 'A' ? 'annuale' : 'trimestrale'}</small>` : ''}</span>
            <span class="es">${ct.map((k, si) => { const r = k?.righe?.[i]; return r ? `<em style="--c:${SLOT[si].col}">${esc(r.c === 'N' ? r.n : r.c)}${r.rs ? '<sup>' + esc(r.rs) + '</sup>' : ''}</em>` : ''; }).join('')}</span></div>`).join('')}</div>
        ${oss.length ? `<div class="sg2-tit">Osservazioni ${anno}</div><div class="card"><ul class="ap-oss">${oss.join('')}</ul></div>` : ''}
        ${tipo === 'pinza' && a.accessori ? `<div class="sg2-tit">Accessori</div><div class="card"><p class="ap-pre">${esc(a.accessori)}</p></div>` : ''}
      </section>`;
    return { titolo: `${T.uno.charAt(0).toUpperCase() + T.uno.slice(1)} · ${c ? c.nome : ''}`, indietro: '#/approfonditi/' + tipo, live: true };
  }

  function formAttrezzo(el, S, tipo, id, query) {
    const T = TIPI[tipo], orig = id ? S.attrezzi.find((x) => x.id === id) : null;
    if (id && !orig) { el.innerHTML = '<p class="nessuno">Attrezzo non trovato.</p>'; return { titolo: T.titolo, indietro: '#/approfonditi/' + tipo }; }
    const a = orig ? JSON.parse(JSON.stringify(orig)) : { id: uid(), tipo, sedeId: query.get('sede') || '', casa: '', nInterno: '', portata: '', nFabbrica: '', matricola: '', tipoDesc: tipo === 'magnete' ? 'MAGNETE' : '', anno: '', classe: '', accessori: '', dismesso: false };
    let comp = JSON.parse(JSON.stringify(componenti(a)));
    el.innerHTML = `
      <form class="sg form card ap-form" id="fA" novalidate>
        <h1>${id ? 'Modifica ' + T.uno : T.nuovo.replace('＋ ', '')}</h1>
        ${sceltaSede(S, a.sedeId)}
        <div class="due">${campo('Tipo', 'tipoDesc', a.tipoDesc, { ph: tipo === 'pinza' ? 'es. GANCIO A C, PINZA MOTORIZZATA' : 'es. MAGNETE A LEVA MHM IT 2000' })}${campo('N° interno', 'nInterno', a.nInterno, { ph: 'numero usato dal cliente' })}</div>
        <div class="due">${campo('Casa costruttrice', 'casa', a.casa)}${campo('Portata', 'portata', a.portata, { ph: 'es. 10 TON, 2000 KG' })}</div>
        <div class="due">${campo('N° fabbrica', 'nFabbrica', a.nFabbrica)}${campo(T.matricola, 'matricola', a.matricola)}</div>
        <div class="due">${campo('Anno', 'anno', a.anno, { num: 1 })}${campo('Classe', 'classe', a.classe)}</div>
        ${tipo === 'pinza' ? area('Accessori (una riga per accessorio)', 'accessori', a.accessori, 'es. CAMPANELLA DUE BRACCI', 4) : ''}
        <h2 class="sez-form">Componenti da controllare ${info(`Sono le righe del foglio (al massimo ${T.maxComp}). Di solito vanno bene così come sono${tipo === 'magnete' ? '; «annuale» vuol dire che si controlla una volta all\'anno' : ''}.`)}</h2>
        <div id="comp"></div>
        <button type="button" class="btn ghost small" id="btnComp">+ Aggiungi componente</button>
        <div class="checks"><label class="check"><input type="checkbox" name="dismesso" ${a.dismesso ? 'checked' : ''}> Non più in uso (resta nei fogli degli anni passati)</label></div>
        <div class="azioni-form">
          ${id && !UT.solaLettura() ? '<button type="button" class="btn danger ghost" id="btnElimina">Elimina</button>' : ''}
          <span class="grow"></span>
          <a class="btn ghost" href="${id ? `#/approfonditi/${tipo}/a/${id}` : '#/approfonditi/' + tipo}">Annulla</a>
          <button class="btn" type="submit">Salva</button>
        </div>
      </form>`;
    const f = el.querySelector('#fA'), box = el.querySelector('#comp');
    const leggi = () => box.querySelectorAll('.ap-comp').forEach((r, i) => { comp[i].t = r.querySelector('input').value; const s = r.querySelector('select'); if (s) comp[i].sc = s.value; });
    const disegna = () => {
      box.innerHTML = comp.map((cp, i) => `<div class="ap-comp"><input value="${esc(cp.t)}" placeholder="componente">
        ${tipo === 'magnete' ? `<select><option value="T" ${cp.sc !== 'A' ? 'selected' : ''}>trimestrale</option><option value="A" ${cp.sc === 'A' ? 'selected' : ''}>annuale</option></select>` : ''}
        <button type="button" class="btn ghost small danger" data-rm="${i}" aria-label="Togli">×</button></div>`).join('');
      box.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { leggi(); comp.splice(+b.dataset.rm, 1); disegna(); }));
      el.querySelector('#btnComp').hidden = comp.length >= T.maxComp;
    };
    disegna();
    el.querySelector('#btnComp').onclick = () => { leggi(); comp.push({ t: '', sc: 'T' }); disegna(); };
    f.onsubmit = async (e) => {
      e.preventDefault(); leggi();
      if (!f.sede.value) return UI.toast('Scegli il cliente e la sede', 'err');
      comp = comp.map((x) => ({ t: x.t.trim(), sc: x.sc || 'T' })).filter((x) => x.t);
      if (!comp.length) return UI.toast('Serve almeno un componente', 'err');
      const c = cliDi(S, f.sede.value);
      Object.assign(a, leggiCampi(f, ['tipoDesc', 'nInterno', 'casa', 'portata', 'nFabbrica', 'matricola', 'anno', 'classe']), {
        sedeId: f.sede.value, clienteId: c?.clienteId || '', accessori: (f.accessori?.value || '').trim(), dismesso: f.dismesso.checked,
        componenti: JSON.stringify(comp).toLowerCase() === JSON.stringify(T.comp).toLowerCase() ? [] : comp
      });
      ['tipoDesc', 'casa', 'portata', 'classe'].forEach((k) => (a[k] = a[k].toUpperCase()));
      a.accessori = a.accessori.toUpperCase();
      await UI.salva('attrezzi', a); UI.toast('Salvato', 'ok');
      location.hash = `#/approfonditi/${tipo}/a/${a.id}`;
    };
    el.querySelector('#btnElimina')?.addEventListener('click', async () => {
      const n = S.controlliAttrezzi.filter((x) => x.attrezzoId === a.id).length;
      if (!UI.conferma(n ? `Questo attrezzo ha ${n} controlli salvati: eliminandolo spariscono anche quelli. Se è solo fuori uso, meglio spuntare «Non più in uso». Eliminare comunque?` : 'Eliminare questo attrezzo?')) return;
      for (const x of S.controlliAttrezzi.filter((x) => x.attrezzoId === a.id)) await Backend.remove('controlliAttrezzi', x.id);
      await Backend.remove('attrezzi', a.id); location.hash = '#/approfonditi/' + tipo;
    });
    return { titolo: id ? 'Modifica ' + T.uno : T.nuovo.replace('＋ ', ''), indietro: id ? `#/approfonditi/${tipo}/a/${id}` : '#/approfonditi/' + tipo, live: false };
  }

  // controllo di una fascetta: per ogni componente il giudizio (colonna C) ed eventualmente R/S
  function formControllo(el, S, tipo, id, anno, slotN) {
    const T = TIPI[tipo], a = S.attrezzi.find((x) => x.id === id);
    if (!a) { el.innerHTML = '<p class="nessuno">Attrezzo non trovato.</p>'; return { titolo: T.titolo, indietro: '#/approfonditi/' + tipo }; }
    const slot = SLOT[slotN - 1], base = `#/approfonditi/${tipo}/a/${id}`;
    const ct = controlliAnno(S, id, anno), esistente = ct[slotN - 1], comp = componenti(a);
    const g = esistente ? JSON.parse(JSON.stringify(esistente)) : { id: uid(), attrezzoId: id, tipo, sedeId: a.sedeId, clienteId: a.clienteId, anno, slot: slotN, data: oggi(), righe: [], note: '', fuoriServizio: false, tecnici: [] };
    comp.forEach((_, i) => (g.righe[i] = g.righe[i] || { c: '', rs: '', oss: '' }));
    const rs = tipo === 'magnete' ? [...COD_RS, ['FS', 'fuori servizio']] : COD_RS;
    const fatti = () => g.righe.slice(0, comp.length).filter((r) => r.c).length;
    el.innerHTML = `
      <form class="sg form sg2-giro ap-ctr" id="fC" novalidate>
        <details class="sg2-dati" style="--c:${slot.col}">
          <summary><b>Fascetta ${slot.nome.toUpperCase()} ${anno}</b><span class="grow"></span><span>📅 <b id="sDat">${dataBreve(g.data)}</b> · 👷 <b id="sTec">${esc(g.tecnico || UT.breve(UT.attuale()))}</b> ✎</span></summary>
          <div class="due giro-dati"><label>Data<input type="date" name="data" value="${g.data}"></label></div>
          ${UT.campoTecnici((g.tecnici || []).map((t) => t.id), g.firmaDi)}
        </details>
        <p class="muted small ap-sotto">${esc(a.tipoDesc || T.uno)}${a.nInterno ? ' n° ' + esc(a.nInterno) : ''} · ${esc(nomeCli(cliDi(S, a.sedeId)))}
          ${info('Per ogni componente tocca il giudizio: X = esame visivo-funzionale, nc = non controllato, \\ = non presente, / = non eseguito. «N° oss.» apre un\'osservazione numerata (il numero va sul foglio). Sotto, R/S se hai ripristinato, sostituito, pulito o lubrificato. Quello che lasci vuoto, al salvataggio, diventa «nc»' + (tipo === 'magnete' ? ' (i controlli annuali diventano «/»)' : '') + '.')}</p>
        <div class="sg2-lista">${comp.map((cp, i) => `
          <div class="sg2-gi ap-gi" data-i="${i}">
            <div class="h"><span class="d">${esc(cp.t)}${tipo === 'magnete' ? `<small>${cp.sc === 'A' ? 'annuale' : 'trimestrale'}</small>` : ''}</span></div>
            <div class="ap-bt">${COD_C.map(([k, l]) => `<button type="button" class="cod-btn" data-c="${esc(k)}" title="${l}">${esc(k)}</button>`).join('')}<button type="button" class="cod-btn ap-n" data-c="N" title="osservazione">N° oss.</button></div>
            <input class="gi-nota" data-oss placeholder="Osservazione (es. SICUREZZA ALBERO ROTTA)" value="${esc(g.righe[i].oss || '')}" hidden>
            <div class="ap-rs"><span class="muted small">R/S</span>${rs.map(([k, l]) => `<button type="button" data-rs="${k}" title="${l}">${k}</button>`).join('')}</div>
          </div>`).join('')}</div>
        <div class="card">
          ${area('Altre osservazioni (una per riga)', 'note', g.note, 'es. CATENE INCISE')}
          <label class="check ap-fs"><input type="checkbox" name="fs" ${g.fuoriServizio ? 'checked' : ''}> <b>FUORI SERVIZIO</b> (sul foglio compare in rosso con la data)</label>
          <div class="azioni-form"><a class="link" href="${base}">📂 Torna all'attrezzo</a><span class="grow"></span>
            ${esistente && !UT.solaLettura() ? '<button type="button" class="btn danger ghost small" id="btnElimina">🗑 Elimina questo controllo</button>' : ''}</div>
        </div>
        <div class="sg2-piede"><b><span id="nFatti">0</span>/${comp.length}</b><div class="bar"><i id="gBar"></i></div><button class="btn big" type="submit">Salva</button></div>
      </form>`;
    const f = el.querySelector('#fC');
    const agg = () => { el.querySelector('#nFatti').textContent = fatti(); el.querySelector('#gBar').style.width = (fatti() / comp.length * 100) + '%'; };
    el.querySelectorAll('.ap-gi').forEach((box) => {
      const i = +box.dataset.i, r = g.righe[i], oss = box.querySelector('[data-oss]');
      const seg = () => {
        box.querySelectorAll('[data-c]').forEach((b) => b.classList.toggle('on', b.dataset.c === r.c));
        box.querySelectorAll('[data-rs]').forEach((b) => b.classList.toggle('on', b.dataset.rs === r.rs));
        oss.hidden = r.c !== 'N'; box.classList.toggle('fatto', !!r.c); agg();
      };
      box.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { r.c = r.c === b.dataset.c ? '' : b.dataset.c; seg(); if (r.c === 'N') oss.focus(); }));
      box.querySelectorAll('[data-rs]').forEach((b) => (b.onclick = () => { r.rs = r.rs === b.dataset.rs ? '' : b.dataset.rs; seg(); }));
      oss.oninput = () => (r.oss = oss.value);
      seg();
    });
    const leggiTecnici = UT.collegaTecnici(el, g.firmaDi);
    const riassunto = () => { const t = leggiTecnici(); el.querySelector('#sDat').textContent = dataBreve(f.data.value); el.querySelector('#sTec').textContent = t.tecnico || '— scegli —'; };
    el.querySelector('.sg2-dati').addEventListener('change', riassunto); el.querySelector('.sg2-dati').addEventListener('click', () => setTimeout(riassunto, 0));
    if (!esistente) riassunto();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const t = leggiTecnici();
      if (!t.tecnici.length) { el.querySelector('.sg2-dati').open = true; window.scrollTo({ top: 0, behavior: 'smooth' }); return UI.toast('Scegli almeno un tecnico', 'err'); }
      if (g.righe.some((r, i) => i < comp.length && r.c === 'N' && !(r.oss || '').trim())) return UI.toast('Scrivi l\'osservazione dove hai messo «N° oss.»', 'err');
      // vuoti: nc (non controllato); per i magneti le voci annuali diventano «/»
      let vuoti = 0;
      g.righe = g.righe.slice(0, comp.length);
      g.righe.forEach((r, i) => { if (!r.c) { r.c = comp[i].sc === 'A' && tipo === 'magnete' ? '/' : 'nc'; vuoti++; } r.oss = r.c === 'N' ? (r.oss || '').trim().toUpperCase() : ''; });
      // numeri delle osservazioni: continuano dai controlli precedenti dello stesso anno
      let n = Math.max(0, ...ct.filter((k, si) => k && si < slotN - 1).flatMap((k) => (k.righe || []).map((r) => +r.n || 0)));
      g.righe.forEach((r) => { if (r.c === 'N') r.n = r.n && esistente ? r.n : ++n; else delete r.n; });
      const firma = t.firmaDi === g.firmaDi && g.firmaTecnico && esistente ? g.firmaTecnico : t.firma;
      if (!firma && !UI.conferma(`${t.firmatario} non ha ancora salvato la firma nel profilo: sul foglio non comparirà. Salvare lo stesso?`)) return;
      Object.assign(g, { data: f.data.value || oggi(), tecnici: t.tecnici, tecnico: t.tecnico, firmaDi: t.firmaDi, firmaTecnico: firma,
        note: f.note.value.trim().toUpperCase(), fuoriServizio: f.fs.checked, sedeId: a.sedeId, clienteId: a.clienteId });
      try { await UI.salva('controlliAttrezzi', g); } catch (er) { return; }
      UI.toast(vuoti ? `Controllo salvato · ${vuoti} ${vuoti === 1 ? 'voce vuota segnata' : 'voci vuote segnate'} nc` : 'Controllo salvato', 'ok');
      location.hash = base + '?anno=' + anno;
    };
    el.querySelector('#btnElimina')?.addEventListener('click', async () => {
      if (!UI.conferma(`Eliminare il ${slotN}° controllo (${slot.nome}) del ${anno}?`)) return;
      await Backend.remove('controlliAttrezzi', g.id); location.hash = base;
    });
    return { titolo: `${slotN}° controllo · ${a.tipoDesc || T.uno}`, indietro: base + '?anno=' + anno, live: false };
  }

  // ================= SCHEDE SINGOLE =================
  const CAMPI = {
    fune: ['ubicazione', 'gruN', 'tipo', 'matricola', 'portata', 'tratti', 'diametro', 'formazione', 'resistenza', 'certificato', 'caricoRottura', 'lubFune', 'giudizioFune', 'lubCarrucole', 'lubTamburo', 'giudizio2'],
    bozzello: ['gru', 'portata', 'matricola', 'forma', 'norma', 'portataGancio', 'tipoN', 'classe', 'anno', 'catalogo', 'ar', 'am', 'a1', 'hr', 'hm', 'esito'],
    indagine: ['particolare', 'nInterno', 'matricola', 'utilizzo', 'allegati', 'conclusioni']
  };
  const VUOTE = { tratti: () => ({ fili6: '', fili30: '', diam: '', usura: '', corrosione: '', danno: '', natura: '', note: '' }), punti: () => ({ fase: '', esito: '', note: '' }) };
  const GIUDIZI = ['IDONEA', 'DA RICONTROLLARE', 'DA SOSTITUIRE'];

  function corpoFune(d) {
    const v = d.v, c = d.carrucole, t = d.tamburo;
    const tratti = d.tratti.map((r, i) => `
      <div class="ap-tratto card-in" data-tr="${i}"><div class="ap-tratto-h"><b>Riga ${i + 1}</b>${d.tratti.length > 1 ? `<button type="button" class="btn ghost small danger" data-rmtr="${i}">×</button>` : ''}</div>
        <div class="tre">${campo('Fili rotti su 6 d', 'tr_fili6_' + i, r.fili6, { num: 1, ph: 'limite 7>14' })}${campo('Fili rotti su 30 d', 'tr_fili30_' + i, r.fili30, { num: 1, ph: 'limite 14>28' })}${campo('Diametro effettivo mm', 'tr_diam_' + i, r.diam, { num: 1 })}</div>
        <span class="lab">Usura</span>${scelta('tr_usura_' + i, GRADI, r.usura)}
        <span class="lab">Corrosione</span>${scelta('tr_corrosione_' + i, GRADI, r.corrosione)}
        <span class="lab">Danneggiamento</span>${scelta('tr_danno_' + i, GRADI, r.danno)}
        <div class="due">${campo('Natura del danno', 'tr_natura_' + i, r.natura)}${campo('Note (dove)', 'tr_note_' + i, r.note)}</div>
      </div>`).join('');
    const ghD = (pref, lab, o, terza) => `<div class="ap-gruppo"><b>${lab}</b><div class="tre">${campo('g', pref + 'g', o[pref + 'g'], { num: 1 })}${campo('h', pref + 'h', o[pref + 'h'], { num: 1 })}${campo(terza, pref + terza, o[pref + terza], { num: 1 })}</div>${campo('Note', pref + 'Note', o[pref + 'Note'])}</div>`;
    return `
      <h2 class="sez-form">Dati della gru</h2>
      <div class="tre">${campo('Ubicazione', 'ubicazione', v.ubicazione)}${campo('Gru N°', 'gruN', v.gruN)}${campo('Tipo', 'tipo', v.tipo)}</div>
      <div class="tre">${campo('Matricola', 'matricola', v.matricola)}${campo('Portata', 'portata', v.portata)}${campo('Tratti', 'tratti', v.tratti, { num: 1 })}</div>
      <h2 class="sez-form">Caratteristiche fune</h2>
      <div class="tre">${campo('Diametro mm', 'diametro', v.diametro, { num: 1 })}${campo('Formazione', 'formazione', v.formazione)}${campo('Resistenza', 'resistenza', v.resistenza)}</div>
      <div class="due">${campo('Certificato n°', 'certificato', v.certificato)}${campo('Carico rottura kg', 'caricoRottura', v.caricoRottura, { num: 1 })}</div>
      <span class="lab">Avvolgimento</span>${scelta('avvolgimento', ['CROCIATA', 'PARALLELA'], v.avvolgimento)}
      <h2 class="sez-form">Stato fune ${info('Una riga per ogni punto controllato (al massimo 6). Limiti: fili rotti 7 su 6 d (14 sostituire), 14 su 30 d (28 sostituire), diminuzione del diametro 7%. Grado: nullo, leggero, medio, sostituire.')}</h2>
      <div id="tratti">${tratti}</div>
      ${d.tratti.length < 6 ? '<button type="button" class="btn ghost small" id="btnTratto">+ Aggiungi riga</button>' : ''}
      <div class="due">${campo('Lubrificazione fune', 'lubFune', v.lubFune, { ph: 'es. BUONA' })}${campo('Giudizio finale fune', 'giudizioFune', v.giudizioFune, { list: 'apGiudizi' })}</div>
      <h2 class="sez-form">Stato carrucole ${info('g, h e D come nel disegno. Riferimenti: angolo della gola 45°-60°, g = 1,08 × d, h = 1,75 × d, D/d > 20 (d = diametro fune).')}</h2>
      <img class="ap-schema" src="img/approfonditi/carrucole.png" alt="schema carrucola">
      ${ghD('bil', 'Bilanciamento', c, 'D')}${ghD('fis', 'Fisse', c, 'D')}${ghD('mob', 'Mobili', c, 'D')}
      ${campo('Lubrificazione carrucole', 'lubCarrucole', v.lubCarrucole)}
      <h2 class="sez-form">Stato tamburo</h2>
      <img class="ap-schema" src="img/approfonditi/tamburo.png" alt="schema tamburo">
      ${ghD('dx', 'Destro', t, 'P')}${ghD('sx', 'Sinistro', t, 'P')}
      <div class="due">${campo('Lubrificazione tamburo', 'lubTamburo', v.lubTamburo)}${campo('Giudizio finale carrucole e tamburo', 'giudizio2', v.giudizio2, { list: 'apGiudizi' })}</div>
      <datalist id="apGiudizi">${GIUDIZI.map((x) => `<option value="${x}">`).join('')}</datalist>`;
  }

  function corpoBozzello(d) {
    const v = d.v, s = d.scelte, cal = calcoliBozzello(d), foto = d.foto;
    const riga = (lab, k, op, multi) => `<div class="ap-riga-sc"><span class="lab">${lab}</span>${scelta(k, op, s[k], multi)}</div>`;
    return `
      <h2 class="sez-form">Gru</h2>
      <div class="tre">${campo('Gru', 'gru', v.gru)}${campo('Portata', 'portata', v.portata)}${campo('Matricola', 'matricola', v.matricola)}</div>
      <h2 class="sez-form">1 · Caratteristiche generali</h2>
      <div class="tre">${campo('Forma', 'forma', v.forma)}${campo('Norma', 'norma', v.norma)}${campo('Portata gancio', 'portataGancio', v.portataGancio)}</div>
      <div class="tre">${campo('Tipo N°', 'tipoN', v.tipoN)}${campo('Classe resistenza', 'classe', v.classe)}${campo('Anno', 'anno', v.anno, { num: 1 })}</div>
      ${riga('Condizioni di utilizzo', 'condizioni', ['LEGGERA', 'MEDIA', 'PESANTE'])}
      ${riga('Certificato', 'certificato', ['DISPONIBILE', 'NON DISPONIBILE', 'NON VERIFICATO'])}
      ${riga('Marcatura', 'marcatura', ['PRESENTE', 'NON PRESENTE', 'NON LEGGIBILE'])}
      ${riga('Conformità al certificato', 'conformita', ['CONFORME', 'NON CONFORME', 'NON ACCETTABILE'])}
      ${riga('Controllo completo', 'completo', ['SI', 'NO', 'DIMENSIONALE'])}
      <h2 class="sez-form">2 · Controllo dimensionale ${info('Scrivi le misure in mm: deformazione (AM − AR), massima ammessa (10% di AR) e risultato si calcolano da soli.')}</h2>
      ${campo('Riferimento catalogo', 'catalogo', v.catalogo)}
      <div class="tre">${campo('Apertura di riferimento Y (AR)', 'ar', v.ar, { num: 1 })}${campo('Apertura misurata (AM)', 'am', v.am, { num: 1 })}${campo('Diametro a1', 'a1', v.a1, { num: 1 })}</div>
      <label class="check"><input type="checkbox" name="nonPresente" ${v.nonPresente ? 'checked' : ''}> Riferimento non presente</label>
      <p class="ap-calc" id="calcDim">${cal.dr ? `Deformazione <b>${cal.dr}</b> · massima ammessa <b>${cal.mda}</b> → <b class="${/NON/.test(cal.esitoDim) ? 'txt-ko' : 'txt-ok'}">${cal.esitoDim}</b>` : 'Inserisci AR e AM per il calcolo.'}</p>
      <h2 class="sez-form">3 · Stato della superficie esterna</h2>
      ${riga('Tipologia del controllo', 'tipologia', ['VISIVO', 'STRUMENTALE (PND)'])}
      ${riga('Presenza di (anche più di uno)', 'presenza', ['INCISIONI', 'RICALCATURE', 'DEFORMAZIONI'], true)}
      ${riga('Entità del difetto', 'entita', ['LIEVE', 'MEDIO', 'GRAVE'])}
      ${riga('Presenza di cricche', 'cricche', ['SI', 'NO'])}
      ${riga('Tipologia delle cricche', 'tipoCricche', ['PARALLELA', 'TRASVERSALE'])}
      ${campoFoto('collocazione', foto.collocazione, 'Zona di collocazione (foto o disegno)')}
      <h2 class="sez-form">4 · Stato di usura ${info('Altezza di riferimento h2 (HR) e altezza misurata (HM) in mm: usura, massima ammessa (5% di HR) e risultato si calcolano da soli.')}</h2>
      <div class="due">${campo('Altezza di riferimento h2 (HR)', 'hr', v.hr, { num: 1 })}${campo('Altezza misurata (HM)', 'hm', v.hm, { num: 1 })}</div>
      <p class="ap-calc" id="calcUs">${cal.usura ? `Usura <b>${cal.usura}</b> · massima ammessa <b>${cal.mha}</b> → <b class="${/NON/.test(cal.esitoUsura) ? 'txt-ko' : 'txt-ok'}">${cal.esitoUsura}</b>` : 'Inserisci HR e HM per il calcolo.'}</p>
      ${campoFoto('usura', foto.usura, 'Zona di usura (foto o disegno)')}
      <h2 class="sez-form">5 · Corrosione</h2>
      ${riga('Corrosione superficiale', 'corrSup', ['SI', 'NO', 'NON VERIFICATO'])}
      ${riga('Corrosione su gambo e/o filettatura', 'corrGambo', ['SI', 'NO', 'NON VERIFICATO'])}
      <h2 class="sez-form">6 · Funzionalità</h2>
      ${riga('Presenza sicurezza gancio', 'sicurezza', ['SI', 'NO', 'NON PREVISTA'])}
      ${riga('Funzionamento', 'funzionamento', ['REGOLARE', 'NON REGOLARE', 'NON PREVISTA'])}
      ${riga('Rotazione assiale gambo', 'rotazione', ['REGOLARE', 'NON REGOLARE', 'NON PREVISTA'])}
      ${riga('Snodo su bozzello', 'snodo', ['REGOLARE', 'NON REGOLARE', 'NON PREVISTO'])}
      ${riga('Rumori anomali', 'rumori', ['SI', 'NO', 'ALTRO'])}
      <h2 class="sez-form">7 · Documentazione fotografica</h2>
      ${campoFoto('insieme', foto.insieme, 'Vista d\'insieme del gancio')}
      ${campo('Esito', 'esito', v.esito, { list: 'apEsiti', ph: 'es. IDONEO' })}
      <datalist id="apEsiti"><option value="IDONEO"><option value="NON IDONEO"><option value="DA RICONTROLLARE"></datalist>`;
  }

  function corpoIndagine(d) {
    const v = d.v;
    const punti = d.punti.map((p, i) => `
      <div class="ap-tratto card-in"><div class="ap-tratto-h"><b>Punto ${'abcdefgh'[i]})</b>${d.punti.length > 1 ? `<button type="button" class="btn ghost small danger" data-rmpt="${i}">×</button>` : ''}</div>
        ${campo('Fase di lavoro', 'pt_fase_' + i, p.fase)}
        <div class="due">${campo('Esito', 'pt_esito_' + i, p.esito, { list: 'apEsitiP', ph: 'es. OK' })}${campo('Note', 'pt_note_' + i, p.note)}</div></div>`).join('');
    return `
      ${campo('Particolare', 'particolare', v.particolare, { ph: 'es. RIDUTTORE SOLLEVAMENTO' })}
      <div class="tre">${campo('N° interno', 'nInterno', v.nInterno)}${campo('Matricola', 'matricola', v.matricola)}${campo('Utilizzo', 'utilizzo', v.utilizzo)}</div>
      <h2 class="sez-form">Fasi di lavoro ${info('Fino a 8 punti (dalla a alla h), come sul modulo.')}</h2>
      <div id="punti">${punti}</div>
      ${d.punti.length < 8 ? '<button type="button" class="btn ghost small" id="btnPunto">+ Aggiungi punto</button>' : ''}
      <datalist id="apEsitiP"><option value="OK"><option value="NON OK"><option value="DA SOSTITUIRE"><option value="DA RICONTROLLARE"></datalist>
      <h2 class="sez-form">Allegati ${info('Fino a 4 foto: vanno su una seconda pagina.')}</h2>
      ${campo('Allegati', 'allegati', v.allegati, { ph: 'es. RELAZIONE PND' })}
      <div class="ap-foto-griglia">${[0, 1, 2, 3].map((i) => campoFoto('a' + i, d.allegati[i], 'Foto ' + (i + 1))).join('')}</div>
      ${area('Conclusioni', 'conclusioni', v.conclusioni, '', 3)}`;
  }

  function formScheda(el, S, tipo, id, query) {
    const T = TIPI[tipo], orig = id ? S.schedeApprofondite.find((x) => x.id === id) : null;
    if (id && !orig) { el.innerHTML = '<p class="nessuno">Scheda non trovata.</p>'; return { titolo: T.titolo, indietro: '#/approfonditi/' + tipo }; }
    const d = orig ? JSON.parse(JSON.stringify(orig)) : { id: uid(), tipo, sedeId: query.get('sede') || '', impiantoId: '', data: oggi(), tecnici: [], v: {} };
    d.v = d.v || {}; d.scelte = d.scelte || {}; d.foto = d.foto || {}; d.carrucole = d.carrucole || {}; d.tamburo = d.tamburo || {};
    d.tratti = d.tratti?.length ? d.tratti : [VUOTE.tratti()]; d.punti = d.punti?.length ? d.punti : [VUOTE.punti(), VUOTE.punti(), VUOTE.punti()]; d.allegati = d.allegati || [];
    const fotoAll = {}; d.allegati.forEach((x, i) => (fotoAll['a' + i] = x));
    const base = `#/approfonditi/${tipo}`;

    // legge tutto quello che c'è nel modulo dentro d (prima di ridisegnare)
    const leggi = (f) => {
      d.sedeId = f.sede.value; d.impiantoId = f.impianto?.value || ''; d.data = f.data.value || oggi();
      Object.assign(d.v, leggiCampi(f, CAMPI[tipo]));
      const sc = leggiScelte(f);
      if (tipo === 'fune') {
        d.v.avvolgimento = sc.avvolgimento;
        d.tratti = d.tratti.map((_, i) => Object.fromEntries(Object.keys(VUOTE.tratti()).map((k) => [k, ['usura', 'corrosione', 'danno'].includes(k) ? sc[`tr_${k}_${i}`] || '' : (f.elements[`tr_${k}_${i}`]?.value || '').trim()])));
        ['bil', 'fis', 'mob'].forEach((p) => ['g', 'h', 'D', 'Note'].forEach((k) => (d.carrucole[p + k] = (f.elements[p + k]?.value || '').trim())));
        ['dx', 'sx'].forEach((p) => ['g', 'h', 'P', 'Note'].forEach((k) => (d.tamburo[p + k] = (f.elements[p + k]?.value || '').trim())));
      }
      if (tipo === 'bozzello') { Object.assign(d.scelte, sc); d.v.nonPresente = f.nonPresente.checked; }
      if (tipo === 'indagine') d.punti = d.punti.map((_, i) => ({ fase: (f.elements['pt_fase_' + i]?.value || '').trim(), esito: (f.elements['pt_esito_' + i]?.value || '').trim(), note: (f.elements['pt_note_' + i]?.value || '').trim() }));
    };

    let tecSel = (d.tecnici || []).map((t) => t.id), firmaDi = d.firmaDi;
    function disegna() {
      const y = window.scrollY;
      el.innerHTML = `
        <form class="sg form card ap-form" id="fS" novalidate>
          <h1>${id ? T.titolo : T.nuovo.replace('＋ ', '')}</h1>
          ${sceltaSede(S, d.sedeId)}
          <div class="due">${d.sedeId ? sceltaImpianto(S, d.sedeId, d.impiantoId) : '<p class="muted small">Scegli il cliente: poi puoi scegliere la gru dall\'anagrafica impianti.</p>'}<label>Data<input type="date" name="data" value="${d.data}"></label></div>
          ${tipo === 'fune' ? corpoFune(d) : tipo === 'bozzello' ? corpoBozzello(d) : corpoIndagine(d)}
          <h2 class="sez-form">Tecnici e firma</h2>
          ${UT.campoTecnici(tecSel, firmaDi)}
          <div class="azioni-form">
            ${id && !UT.solaLettura() ? '<button type="button" class="btn danger ghost" id="btnElimina">Elimina</button>' : ''}
            <span class="grow"></span>
            <a class="btn ghost" href="${base}">Annulla</a>
            ${UT.puoInviare() ? '<button class="btn ghost" type="button" id="btnStampaS">🖨️ Salva e stampa</button>' : ''}
            <button class="btn" type="submit">Salva</button>
          </div>
        </form>`;
      const f = el.querySelector('#fS');
      const leggiTec = UT.collegaTecnici(el, firmaDi);
      const ridisegna = () => { leggi(f); const t = leggiTec(); tecSel = t.tecnici.map((x) => x.id); firmaDi = t.firmaDi; disegna(); };
      collegaScelte(f);
      f.sede.onchange = ridisegna;
      f.impianto && (f.impianto.onchange = () => {
        const i = S.impianti.find((x) => x.id === f.impianto.value); if (!i) return;
        const metti = (k, val) => { if (f.elements[k] && !f.elements[k].value && val) f.elements[k].value = val; };
        if (tipo === 'fune') { metti('gruN', i.numeroInterno); metti('tipo', i.tipologia); metti('matricola', i.matricola); metti('portata', portate(i)); }
        if (tipo === 'bozzello') { metti('gru', [i.numeroInterno && 'N° ' + i.numeroInterno, i.tipologia].filter(Boolean).join(' ')); metti('matricola', i.matricola); metti('portata', portate(i)); }
        if (tipo === 'indagine') { metti('nInterno', i.numeroInterno); metti('matricola', i.matricola); }
      });
      if (tipo === 'fune') {
        el.querySelector('#btnTratto')?.addEventListener('click', () => { leggi(f); d.tratti.push(VUOTE.tratti()); ridisegna(); });
        el.querySelectorAll('[data-rmtr]').forEach((b) => (b.onclick = () => { leggi(f); d.tratti.splice(+b.dataset.rmtr, 1); disegna(); }));
      }
      if (tipo === 'indagine') {
        el.querySelector('#btnPunto')?.addEventListener('click', () => { leggi(f); d.punti.push(VUOTE.punti()); ridisegna(); });
        el.querySelectorAll('[data-rmpt]').forEach((b) => (b.onclick = () => { leggi(f); d.punti.splice(+b.dataset.rmpt, 1); disegna(); }));
        collegaFoto(f, fotoAll, () => { d.allegati = [0, 1, 2, 3].map((i) => fotoAll['a' + i]).filter(Boolean); [0, 1, 2, 3].forEach((i) => delete fotoAll['a' + i]); d.allegati.forEach((x, i) => (fotoAll['a' + i] = x)); ridisegna(); });
      }
      if (tipo === 'bozzello') {
        collegaFoto(f, d.foto, ridisegna);
        const calc = () => { leggi(f); const c = calcoliBozzello(d);
          el.querySelector('#calcDim').innerHTML = c.dr ? `Deformazione <b>${c.dr}</b> · massima ammessa <b>${c.mda}</b> → <b class="${/NON/.test(c.esitoDim) ? 'txt-ko' : 'txt-ok'}">${c.esitoDim}</b>` : 'Inserisci AR e AM per il calcolo.';
          el.querySelector('#calcUs').innerHTML = c.usura ? `Usura <b>${c.usura}</b> · massima ammessa <b>${c.mha}</b> → <b class="${/NON/.test(c.esitoUsura) ? 'txt-ko' : 'txt-ok'}">${c.esitoUsura}</b>` : 'Inserisci HR e HM per il calcolo.'; };
        ['ar', 'am', 'hr', 'hm'].forEach((k) => (f.elements[k].oninput = calc));
      }
      const salva = async (poi) => {
        leggi(f);
        if (!d.sedeId) { UI.toast('Scegli il cliente e la sede', 'err'); f.sede.focus(); return; }
        const t = leggiTec();
        if (!t.tecnici.length) return UI.toast('Scegli almeno un tecnico', 'err');
        const firma = t.firmaDi === d.firmaDi && d.firmaTecnico && orig ? d.firmaTecnico : t.firma;
        if (!firma && !UI.conferma(`${t.firmatario} non ha ancora salvato la firma nel profilo: sulla scheda non comparirà. Salvare lo stesso?`)) return;
        const c = cliDi(S, d.sedeId);
        // tutto in maiuscolo come sui moduli
        Object.keys(d.v).forEach((k) => { if (typeof d.v[k] === 'string') d.v[k] = d.v[k].toUpperCase(); });
        if (d.tratti) d.tratti = d.tratti.map((r) => Object.fromEntries(Object.entries(r).map(([k, x]) => [k, String(x).toUpperCase()])));
        if (d.punti) d.punti = d.punti.map((r) => Object.fromEntries(Object.entries(r).map(([k, x]) => [k, String(x).toUpperCase()])));
        ['carrucole', 'tamburo'].forEach((k) => Object.keys(d[k]).forEach((j) => (d[k][j] = String(d[k][j]).toUpperCase())));
        if (tipo === 'bozzello') { const cal = calcoliBozzello(d); if (cal.esitoDim) d.scelte.esitoDim = cal.esitoDim; if (cal.esitoUsura) d.scelte.esitoUsura = cal.esitoUsura; }
        const rec = { ...d, clienteId: c?.clienteId || '', tecnici: t.tecnici, tecnico: t.tecnico, firmaDi: t.firmaDi, firmaTecnico: firma };
        if (tipo !== 'fune') { delete rec.tratti; delete rec.carrucole; delete rec.tamburo; }
        if (tipo !== 'indagine') { delete rec.punti; delete rec.allegati; }
        if (tipo !== 'bozzello') { delete rec.scelte; delete rec.foto; }
        try { await UI.salva('schedeApprofondite', rec); } catch (er) { return; }
        UI.toast('Scheda salvata', 'ok');
        location.hash = poi === 'stampa' ? `${base}/s/${d.id}/stampa` : base;
      };
      f.onsubmit = (e) => { e.preventDefault(); salva(); };
      el.querySelector('#btnStampaS')?.addEventListener('click', () => salva('stampa'));
      el.querySelector('#btnElimina')?.addEventListener('click', async () => {
        if (!UI.conferma('Eliminare questa scheda?')) return;
        await Backend.remove('schedeApprofondite', d.id); location.hash = base;
      });
      window.scrollTo(0, y);
    }
    disegna();
    return { titolo: id ? T.titolo : T.nuovo.replace('＋ ', ''), indietro: base, live: false };
  }

  // ================= STAMPA =================
  function stampa(el, S, tipo, parti) {
    const T = TIPI[tipo];
    if (T.fam === 'a') {
      const a = S.attrezzi.find((x) => x.id === parti[3]); const anno = +parti[5] || anno0();
      if (!a) { el.innerHTML = '<p class="nessuno">Attrezzo non trovato.</p>'; return { titolo: 'Stampa' }; }
      const c = cliDi(S, a.sedeId);
      APS.render(el, S, tipo, a, anno, nomeFile(`${tipo === 'pinza' ? 'Attrezzo_sottogancio' : 'Magnete'} ${a.nInterno || ''} ${c?.nome || ''} ${anno}`), `#/approfonditi/${tipo}/a/${a.id}`);
      return { titolo: `Foglio ${anno} · ${a.tipoDesc || T.uno}`, indietro: `#/approfonditi/${tipo}/a/${a.id}?anno=${anno}`, live: true };
    }
    const d = S.schedeApprofondite.find((x) => x.id === parti[3]);
    if (!d) { el.innerHTML = '<p class="nessuno">Scheda non trovata.</p>'; return { titolo: 'Stampa' }; }
    const c = cliDi(S, d.sedeId);
    const tit = { fune: 'Scheda_fune_carrucole', bozzello: 'Scheda_controllo_gancio', indagine: 'Indagine_approfondita' }[tipo];
    APS.render(el, S, tipo, d, null, nomeFile(`${tit} ${c?.nome || ''} ${d.data || ''}`), '');
    return { titolo: T.titolo + ' · stampa', indietro: UT.solaLettura() ? `#/approfonditi/${tipo}` : `#/approfonditi/${tipo}/s/${d.id}`, live: true };
  }

  // ================= ROUTER =================
  function route(el, S, parti, query) {
    const tipo = parti[1];
    if (!tipo) return hub(el, S);
    if (!TIPI[tipo]) { location.hash = '#/approfonditi'; return null; }
    if (parti.includes('stampa')) return stampa(el, S, tipo, parti);
    if (parti[2] === 'nuovo') return TIPI[tipo].fam === 'a' ? formAttrezzo(el, S, tipo, null, query) : formScheda(el, S, tipo, null, query);
    if (parti[2] === 'a' && parti[4] === 'modifica') return formAttrezzo(el, S, tipo, parti[3], query);
    if (parti[2] === 'a' && parti[4] === 'controllo') return formControllo(el, S, tipo, parti[3], +parti[5], +parti[6]);
    if (parti[2] === 'a') return schedaAttrezzo(el, S, tipo, parti[3], query);
    if (parti[2] === 's') return formScheda(el, S, tipo, parti[3], query);
    return elenco(el, S, tipo, query);
  }

  return { route, TIPI, ORDINE, componenti, controlliAnno, calcoliBozzello };
})();
