// ===== MAGAZZINO RICAMBI E LISTINO PREZZI =====
// Un solo archivio di articoli (collezione «articoli»): codice nostro progressivo GI0001, codice del costruttore,
// descrizione, ubicazione, quantità, quantità minima, prezzo nostro, maggiorazione % e prezzo cliente.
// «Tengo a magazzino» spento = articolo solo su ordinazione (sta nel listino ma non nel magazzino).
// La quantità NON si scrive a mano nei documenti: è calcolata =
//   base (quantità iniziale o rettifiche) + carichi − materiale usato in rapportini, interventi GHO e DDT.
// Così se un documento si modifica o si elimina, la merce torna da sola a magazzino.
// I prezzi li vede solo chi ha la funzione «prezzi» (di partenza il Master): mai su rapportini e DDT.
window.MAG = (function () {
  const { esc, uid, info, fmt, oggi } = UI;
  const num = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
  const numO = (v) => { if (v === null || v === undefined || String(v).trim() === '') return null; const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
  const q = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
  const euro = (n) => (n == null ? '—' : n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }));
  const due = (n) => (n == null ? '' : String(Math.round(n * 100) / 100).replace('.', ','));

  const articoli = (S) => S.articoli || [];
  const trova = (S, id) => articoli(S).find((a) => a.id === id);
  const impostazioni = (S) => (S.impostazioni || []).find((x) => x.id === 'magazzino') || { id: 'magazzino' };
  const maggNormale = (S) => numO(impostazioni(S).maggiorazione);

  // ---------- codici ----------
  const prossimoN = (S) => Math.max(0, ...articoli(S).map((a) => +a.n || 0)) + 1;
  const codice = (n) => 'GI' + String(n).padStart(4, '0');

  // ---------- prezzi ----------
  // maggiorazione dell'articolo (se vuota vale quella normale del listino)
  const maggDi = (S, a) => (numO(a.magg) ?? maggNormale(S));
  // prezzo cliente: prezzo nostro + maggiorazione (del cliente se l'ha in anagrafica, altrimenti dell'articolo)
  function prezzoCliente(S, a, cliente) {
    const nostro = numO(a.prezzoNostro);
    const mc = cliente ? numO(cliente.maggiorazione) : null;
    if (nostro != null && mc != null) return nostro * (1 + mc / 100);
    if (nostro != null && maggDi(S, a) != null) return nostro * (1 + maggDi(S, a) / 100);
    return numO(a.prezzoCliente);
  }

  // ---------- giacenze ----------
  // quanto materiale di ogni articolo è uscito nei documenti
  function usi(S) {
    const m = {};
    const add = (id, qta, doc) => { if (!id) return; (m[id] = m[id] || { tot: 0, doc: [] }); m[id].tot += qta; m[id].doc.push({ ...doc, qta }); };
    const ddtQ = {};
    (S.ddt || []).forEach((d) => (d.righe || []).forEach((r) => {
      if (!r.articoloId) return; const x = num(r.qta);
      add(r.articoloId, x, { tipo: 'DDT', t: 'DDT ' + DDT.numeroDi(d), data: d.data, href: '#/rapportini/ddt/' + d.id });
      ddtQ[d.id] = ddtQ[d.id] || {}; ddtQ[d.id][r.articoloId] = (ddtQ[d.id][r.articoloId] || 0) + x;
    }));
    (S.rapportini || []).forEach((r) => {
      // se il rapportino è abbinato a un DDT, il materiale già uscito con il DDT non si scala due volte
      const giaDdt = { ...(r.ddtId ? ddtQ[r.ddtId] || {} : {}) };
      const per = {};
      (r.materiali || []).forEach((x) => { if (x.articoloId) per[x.articoloId] = (per[x.articoloId] || 0) + num(x.qta); });
      Object.entries(per).forEach(([id, tot]) => { const resto = Math.max(0, tot - (giaDdt[id] || 0)); if (resto) add(id, resto, { tipo: 'RAP', t: 'Rapportino ' + (r.numero ? r.numero + '/' + r.anno : '(numero in arrivo)'), data: (r.giorni?.[0]?.data) || r.dataConsegna, href: '#/rapportini/r/' + r.id }); });
    });
    (S.oreGho || []).forEach((r) => (r.materiali || []).forEach((x) => { if (x.nostro && x.articoloId) add(x.articoloId, num(x.qta) || 1, { tipo: 'GHO', t: 'GHO ' + (r.cliente || ''), data: r.data, href: '#/gho/ore/' + r.id }); }));
    return m;
  }
  const caricato = (a) => (a.carichi || []).reduce((t, c) => t + num(c.qta), 0);
  const giacenza = (S, a, U) => num(a.base) + caricato(a) - ((U || usi(S))[a.id]?.tot || 0);
  const sottoScorta = (S, a, U) => a.scorta !== false && numO(a.qtaMin) != null && giacenza(S, a, U) <= num(a.qtaMin);
  const daRiordinare = (S) => { const U = usi(S); return articoli(S).filter((a) => !a.eliminato && sottoScorta(S, a, U)); };
  const badge = (S) => { const n = daRiordinare(S).length; return n ? `${n} ${n === 1 ? 'articolo' : 'articoli'} da riordinare` : ''; };

  const testoArt = (a) => [a.codice, a.codCostruttore, a.descrizione, a.ubicazione].join(' ').toLowerCase();
  const cerca = (S, t, soloScorta) => {
    const parole = String(t || '').toLowerCase().split(/\s+/).filter(Boolean);
    return articoli(S).filter((a) => !a.eliminato && (!soloScorta || a.scorta !== false) && parole.every((p) => testoArt(a).includes(p)))
      .sort((a, b) => (a.descrizione || '').localeCompare(b.descrizione || ''));
  };

  // ---------- ricerca articolo dentro i documenti (rapportini, GHO, DDT) ----------
  // input = casella dove si scrive; scegli(art) = cosa fare quando si tocca un articolo
  function collegaRicerca(input, scegli, { soloSe } = {}) {
    if (!input || !UT.puo('sez.magazzino')) return;
    const box = document.createElement('div'); box.className = 'art-pop'; box.hidden = true;
    input.insertAdjacentElement('afterend', box);
    input.parentElement.classList.add('art-host');
    let lista = [];
    const mostra = () => {
      const S = App.dati(), t = input.value.trim();
      if (t.length < 2 || (soloSe && !soloSe())) { box.hidden = true; return; }
      const U = usi(S);
      lista = cerca(S, t).slice(0, 8);
      box.innerHTML = lista.length ? lista.map((a, i) => `<button type="button" data-i="${i}"><b>${esc(a.codice)}</b>${a.codCostruttore ? ` <small>${esc(a.codCostruttore)}</small>` : ''}<span>${esc(a.descrizione)}</span>${a.scorta !== false ? `<em class="${giacenza(S, a, U) <= 0 ? 'txt-ko' : ''}">${q(giacenza(S, a, U))} a mag.</em>` : '<em>su ordinazione</em>'}</button>`).join('') : '';
      box.hidden = !lista.length;
      box.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); box.hidden = true; scegli(lista[+b.dataset.i]); }));
    };
    input.addEventListener('input', mostra);
    input.addEventListener('focus', mostra);
    input.addEventListener('blur', () => setTimeout(() => (box.hidden = true), 150));
  }

  // ---------- PAGINE ----------
  let filtro = { q: '', cli: '', tutti: false };
  function tabs(attiva) {
    if (!UT.puo('prezzi')) return '';
    return `<nav class="tabs tabs-scheda"><a class="tab ${attiva === 'mag' ? 'on' : ''}" href="#/magazzino"><b>📦 Magazzino</b></a><a class="tab ${attiva === 'listino' ? 'on' : ''}" href="#/magazzino/listino"><b>💶 Listino prezzi</b></a></nav>`;
  }
  const puoModificare = () => UT.puo('mag.modifica') && !UT.solaLettura();

  function lista(el, S) {
    const U = usi(S), riord = daRiordinare(S);
    const elenco = cerca(S, filtro.q, !filtro.tutti);
    el.innerHTML = `
      <section class="cli mag">
        ${tabs('mag')}
        <div class="sez-head"><h1>Magazzino ricambi ${info('Gli articoli che teniamo a scorta. La quantità scende da sola quando il materiale si usa in un rapportino, in un intervento GHO o in un DDT (e torna su se il documento si modifica o si elimina). Quando arriva merce apri l\'articolo e tocca «+ Carico». Con la quantità minima, sotto quella soglia l\'articolo va in «Da riordinare» e compare un avviso in home. Gli articoli solo su ordinazione stanno nel listino prezzi.')}</h1>
          ${puoModificare() ? '<button class="btn fab" id="btnNuovo"><span class="fab-piu">+</span><span class="fab-txt"> Nuovo articolo</span></button>' : ''}</div>
        ${riord.length ? `<details class="card mag-riord" ${riord.length <= 6 ? 'open' : ''}><summary><b>⚠️ Da riordinare (${riord.length})</b></summary>
          <div class="elenco">${riord.map((a) => riga(S, a, U)).join('')}</div></details>` : ''}
        <div class="barra-cerca"><input type="search" class="cerca" data-f="q" placeholder="Cerca codice, descrizione, posto…" value="${esc(filtro.q)}"></div>
        <label class="check mag-tutti"><input type="checkbox" id="chkTutti" ${filtro.tutti ? 'checked' : ''}> Mostra anche gli articoli solo su ordinazione</label>
        <div class="elenco">${elenco.map((a) => riga(S, a, U)).join('') || `<p class="nessuno">${articoli(S).length ? 'Nessun articolo trovato.' : 'Ancora nessun articolo. Crea il primo con «+ Nuovo articolo».'}</p>`}</div>
      </section>`;
    collegaFiltri(el);
    el.querySelector('#chkTutti').onchange = (e) => { filtro.tutti = e.target.checked; App.ridisegna(); };
    el.querySelector('#btnNuovo')?.addEventListener('click', () => modale(S, null, { scorta: true }));
    return { titolo: 'Magazzino ricambi', indietro: '#/', live: true };
  }
  function riga(S, a, U) {
    const g = giacenza(S, a, U), basso = sottoScorta(S, a, U);
    return `<a class="riga mag-riga ${basso ? 'basso' : ''}" href="#/magazzino/a/${a.id}">
      <div class="mag-cod"><b>${esc(a.codice)}</b>${a.codCostruttore ? `<small>${esc(a.codCostruttore)}</small>` : ''}</div>
      <div class="riga-main"><b class="mag-desc">${esc(a.descrizione)}</b>
        <div class="muted small">${a.ubicazione ? '📍 ' + esc(a.ubicazione) : ''}${a.scorta === false ? ' <span class="pill">su ordinazione</span>' : numO(a.qtaMin) != null ? ` · minimo ${q(num(a.qtaMin))}` : ''}</div></div>
      ${a.scorta === false ? '' : `<div class="mag-qta ${basso ? 'txt-ko' : ''}"><b>${q(g)}</b><small>a mag.</small></div>`}›</a>`;
  }
  function collegaFiltri(el) {
    el.querySelectorAll('[data-f]').forEach((x) => x.addEventListener(x.tagName === 'INPUT' ? 'input' : 'change', () => {
      filtro[x.dataset.f] = x.value;
      if (x.tagName === 'INPUT') { clearTimeout(collegaFiltri.t); collegaFiltri.t = setTimeout(() => App.ridisegna(), 300); } else App.ridisegna();
    }));
  }

  // ---------- scheda articolo ----------
  function scheda(el, S, a) {
    const U = usi(S), g = giacenza(S, a, U), pr = UT.puo('prezzi');
    const mov = [
      ...(a.carichi || []).map((c) => ({ data: c.data, t: `➕ Carico${c.nota ? ' · ' + c.nota : ''}${c.daNome ? ' · ' + c.daNome : ''}`, qta: num(c.qta), id: c.id })),
      ...(U[a.id]?.doc || []).map((d) => ({ data: d.data, t: d.t, href: d.href, qta: -d.qta }))
    ].sort((x, y) => (y.data || '').localeCompare(x.data || ''));
    const campo = (l, v) => `<div class="campo"><span>${l}</span><b>${v || '<i class="muted">—</i>'}</b></div>`;
    el.innerHTML = `
      <section class="cli mag">
        <div class="card">
          <div class="card-head"><h2>${esc(a.codice)} · ${esc(a.descrizione)}</h2>${puoModificare() ? '<button class="btn ghost small" id="btnMod">✏️ Modifica</button>' : ''}</div>
          <div class="griglia-campi">
            ${campo('Codice nostro', esc(a.codice))}
            ${campo('Codice costruttore', esc(a.codCostruttore))}
            ${campo('Descrizione', esc(a.descrizione))}
            ${campo('Ubicazione', esc(a.ubicazione))}
            ${a.scorta === false ? campo('Magazzino', 'Solo su ordinazione') : campo('Quantità a magazzino', `<span class="${sottoScorta(S, a, U) ? 'txt-ko' : ''}">${q(g)}</span>`) + campo('Quantità minima', numO(a.qtaMin) != null ? q(num(a.qtaMin)) : '')}
            ${pr ? campo('Prezzo nostro', euro(numO(a.prezzoNostro))) + campo('Maggiorazione', maggDi(S, a) != null ? due(maggDi(S, a)) + ' %' + (numO(a.magg) == null ? ' <small class="muted">(normale)</small>' : '') : '') + campo('Prezzo cliente', euro(prezzoCliente(S, a))) : ''}
          </div>
          ${a.scorta !== false && puoModificare() ? '<div class="azioni-form"><button class="btn" id="btnCarico">+ Carico</button><button class="btn ghost" id="btnConta">🔢 Ho contato: correggi la quantità</button></div>' : ''}
        </div>
        ${a.scorta !== false ? `<div class="card"><div class="card-head"><h2>Movimenti ${info('Carichi (merce arrivata) e materiale usato nei documenti. Tocca un documento per aprirlo. Il carico iniziale e le correzioni dopo un conteggio non compaiono qui.')}</h2></div>
          <div class="mag-mov">${mov.map((m) => `<${m.href ? `a href="${m.href}"` : 'div'} class="mag-mov-r"><span class="muted small">${m.data ? fmt(m.data) : ''}</span><span class="grow">${esc(m.t)}</span><b class="${m.qta < 0 ? 'txt-ko' : 'txt-ok'}">${m.qta > 0 ? '+' : ''}${q(m.qta)}</b>${m.id && puoModificare() ? `<button type="button" class="link txt-ko" data-togli="${m.id}" aria-label="Togli carico">✕</button>` : ''}</${m.href ? 'a' : 'div'}>`).join('') || '<p class="muted small">Nessun movimento.</p>'}</div></div>` : ''}
      </section>`;
    el.querySelector('#btnMod')?.addEventListener('click', () => modale(S, a));
    el.querySelector('#btnCarico')?.addEventListener('click', () => UI.modal({
      titolo: '+ Carico · ' + a.codice, infoTxt: 'Scrivi quanti pezzi sono arrivati: si aggiungono alla quantità a magazzino.',
      campi: [{ k: 'qta', label: 'Quantità arrivata', num: true, req: true, mezza: true }, { k: 'data', label: 'Data', tipo: 'date', mezza: true }, { k: 'nota', label: 'Nota', placeholder: 'es. fornitore, DDT fornitore…' }],
      valori: { data: oggi() }, testoSalva: 'Carica',
      onSalva: async (v) => {
        const x = numO(v.qta); if (!x) { UI.toast('Scrivi la quantità', 'err'); return false; }
        const io = UT.attuale();
        await UI.salva('articoli', { ...a, carichi: [...(a.carichi || []), { id: uid(), qta: x, data: v.data || oggi(), nota: v.nota || '', da: io?.id || '', daNome: io ? UT.breve(io) : '' }] });
        UI.toast(`Caricati ${q(x)} pezzi`, 'ok');
      }
    }));
    el.querySelector('#btnConta')?.addEventListener('click', () => UI.modal({
      titolo: '🔢 Quantità contata · ' + a.codice, infoTxt: 'Dopo un conteggio in magazzino scrivi quanti pezzi ci sono davvero: la quantità si corregge. I documenti già fatti non cambiano.',
      campi: [{ k: 'qta', label: 'Pezzi contati', num: true, req: true }], valori: { qta: q(g) },
      onSalva: async (v) => { const x = numO(v.qta); if (x == null) { UI.toast('Scrivi un numero', 'err'); return false; } await UI.salva('articoli', { ...a, base: num(a.base) + x - g }); UI.toast('Quantità corretta', 'ok'); }
    }));
    el.querySelectorAll('[data-togli]').forEach((b) => (b.onclick = async (e) => {
      e.preventDefault(); if (!UI.conferma('Togliere questo carico? La quantità a magazzino scende.')) return;
      await UI.salva('articoli', { ...a, carichi: (a.carichi || []).filter((c) => c.id !== b.dataset.togli) });
    }));
    return { titolo: a.codice, indietro: '#/magazzino', live: true };
  }

  // ---------- nuovo / modifica articolo ----------
  function modale(S, a, pre = {}) {
    if (!UT.serve('mag.modifica')) return;
    const nuovo = !a, pr = UT.puo('prezzi');
    const U = usi(S);
    UI.modal({
      titolo: nuovo ? 'Nuovo articolo · ' + codice(prossimoN(S)) : 'Articolo ' + a.codice,
      infoTxt: 'Il codice nostro (GI0001, GI0002…) lo dà l\'app. «Tengo a magazzino» spento = articolo solo su ordinazione: sta nel listino ma non nel magazzino.' + (pr ? ' Il prezzo cliente è il prezzo nostro più la maggiorazione: se la lasci vuota vale quella normale del listino. Se scrivi direttamente il prezzo cliente, la maggiorazione si ricalcola.' : ''),
      valori: nuovo ? { scorta: true, ...pre } : { ...a, scorta: a.scorta !== false, qta: q(giacenza(S, a, U)), qtaMin: a.qtaMin ?? '', prezzoNostro: due(numO(a.prezzoNostro)), magg: due(numO(a.magg)), prezzoCliente: due(prezzoCliente(S, a)) },
      campi: [
        { k: 'descrizione', label: 'Descrizione', req: true, maiuscolo: true },
        { k: 'codCostruttore', label: 'Codice costruttore', mezza: true, maiuscolo: true, placeholder: 'es. LC1D09' },
        { k: 'ubicazione', label: 'Ubicazione', mezza: true, maiuscolo: true, placeholder: 'es. SCAFFALE 3 · CASSETTO B' },
        { k: 'scorta', label: 'Tengo a magazzino (scorta)', tipo: 'sino' },
        { k: 'qta', label: nuovo ? 'Quantità a magazzino ora' : 'Quantità a magazzino', num: true, mezza: true },
        { k: 'qtaMin', label: 'Quantità minima (per riordinare)', num: true, mezza: true },
        ...(pr ? [{ k: 'prezzoNostro', label: 'Prezzo nostro €', num: true, mezza: true }, { k: 'magg', label: 'Maggiorazione %', num: true, mezza: true, placeholder: maggNormale(S) != null ? due(maggNormale(S)) + ' (normale)' : '' }, { k: 'prezzoCliente', label: 'Prezzo cliente €', num: true, mezza: true }] : [])
      ],
      onSalva: async (v) => {
        const doc = nuovo ? { id: uid(), n: prossimoN(S), creato: new Date().toISOString(), carichi: [], base: 0 } : { ...a };
        if (nuovo) doc.codice = codice(doc.n);
        Object.assign(doc, { descrizione: v.descrizione, codCostruttore: v.codCostruttore, ubicazione: v.ubicazione, scorta: !!v.scorta, qtaMin: numO(v.qtaMin) });
        const qx = numO(v.qta);
        if (qx != null) doc.base = num(doc.base) + qx - (nuovo ? 0 : giacenza(S, a, U));
        if (pr) Object.assign(doc, calcolaPrezzi(S, doc, v, nuovo ? { magg: null } : { prezzoNostro: numO(a.prezzoNostro), magg: numO(a.magg), prezzoCliente: prezzoCliente(S, a) }));
        await UI.salva('articoli', doc);
        UI.toast(nuovo ? `Articolo ${doc.codice} creato` : 'Articolo salvato', 'ok');
        if (nuovo && location.hash.startsWith('#/magazzino') && !location.hash.includes('listino')) location.hash = '#/magazzino/a/' + doc.id;
      }
    });
  }
  // dai tre campi (nostro, %, cliente) ricavo cosa salvare: se è cambiato il prezzo cliente ricalcolo la %
  function calcolaPrezzi(S, a, v, prima) {
    const nostro = numO(v.prezzoNostro), magg = numO(v.magg), cli = numO(v.prezzoCliente);
    const cliCambiato = cli != null && (prima.prezzoCliente == null || Math.abs(cli - prima.prezzoCliente) > 0.004);
    const maggCambiata = magg !== prima.magg;
    if (cliCambiato && !maggCambiata && nostro) return { prezzoNostro: nostro, magg: Math.round((cli / nostro - 1) * 10000) / 100, prezzoCliente: null };
    if (nostro == null) return { prezzoNostro: null, magg, prezzoCliente: cli };
    return { prezzoNostro: nostro, magg, prezzoCliente: null };
  }

  // ---------- LISTINO PREZZI ----------
  function listino(el, S) {
    if (!UT.puo('prezzi')) { el.innerHTML = '<section class="vuoto"><h1>🔒 Listino prezzi</h1><p>Il listino non è abilitato per te.</p></section>'; return { titolo: 'Listino prezzi', indietro: '#/magazzino' }; }
    const cli = S.clienti.find((c) => c.id === filtro.cli);
    const elenco = cerca(S, filtro.q, false);
    const mod = puoModificare();
    el.innerHTML = `
      <section class="cli mag listino">
        ${tabs('listino')}
        <div class="sez-head"><h1>Listino prezzi ${info('Tutti gli articoli: quelli a magazzino e quelli solo su ordinazione. Il prezzo si cambia direttamente nella riga e si salva da solo. Prezzo cliente = prezzo nostro + maggiorazione: se la maggiorazione dell\'articolo è vuota vale quella normale qui sotto. Se scrivi il prezzo cliente la maggiorazione si ricalcola. Scegliendo un cliente vedi i suoi prezzi: se ha una maggiorazione sua in anagrafica, vale quella su tutti gli articoli. I prezzi non compaiono mai su rapportini e DDT e i tecnici non li vedono.')}</h1>
          ${mod ? '<button class="btn fab" id="btnNuovo"><span class="fab-piu">+</span><span class="fab-txt"> Nuovo articolo</span></button>' : ''}</div>
        <div class="card form lis-testa">
          <label>Maggiorazione normale %<input id="lisMagg" inputmode="decimal" value="${esc(due(maggNormale(S)))}" placeholder="es. 30" ${mod ? '' : 'disabled'}></label>
          <label>Prezzi per il cliente<select data-f="cli"><option value="">— prezzo normale —</option>${[...S.clienti].sort((a, b) => CLI.nome(a).localeCompare(CLI.nome(b))).map((c) => `<option value="${c.id}" ${c.id === filtro.cli ? 'selected' : ''}>${esc(CLI.nome(c))}${numO(c.maggiorazione) != null ? ` (+${due(numO(c.maggiorazione))}%)` : ''}</option>`).join('')}</select></label>
          ${cli ? `<p class="muted small lis-nota">${numO(cli.maggiorazione) != null ? `${esc(CLI.nome(cli))} ha la maggiorazione <b>${due(numO(cli.maggiorazione))} %</b> su tutti gli articoli.` : `${esc(CLI.nome(cli))} non ha una maggiorazione sua: valgono i prezzi normali.`} Si cambia nell'anagrafica del cliente.</p>` : ''}
        </div>
        <div class="barra-cerca"><input type="search" class="cerca" data-f="q" placeholder="Cerca codice, descrizione…" value="${esc(filtro.q)}"></div>
        <div class="lis-righe">${elenco.map((a) => `
          <div class="lis-r" data-a="${a.id}">
            <a class="lis-desc" href="#/magazzino/a/${a.id}"><b>${esc(a.codice)}</b>${a.codCostruttore ? ` <small>${esc(a.codCostruttore)}</small>` : ''}<span>${esc(a.descrizione)}</span>${a.scorta === false ? '<em class="pill">su ordinazione</em>' : ''}</a>
            <label>Nostro €<input id="ln-${a.id}" data-p="prezzoNostro" inputmode="decimal" value="${esc(due(numO(a.prezzoNostro)))}" ${mod ? '' : 'disabled'}></label>
            <label>Magg. %<input id="lm-${a.id}" data-p="magg" inputmode="decimal" value="${esc(due(numO(a.magg)))}" placeholder="${esc(due(maggNormale(S)))}" ${mod ? '' : 'disabled'}></label>
            <label>Cliente €<input id="lc-${a.id}" data-p="prezzoCliente" inputmode="decimal" value="${esc(due(prezzoCliente(S, a)))}" ${mod ? '' : 'disabled'}></label>
            ${cli ? `<div class="lis-percli"><small>per ${esc(CLI.nome(cli))}</small><b>${euro(prezzoCliente(S, a, cli))}</b></div>` : ''}
          </div>`).join('') || `<p class="nessuno">${articoli(S).length ? 'Nessun articolo trovato.' : 'Ancora nessun articolo.'}</p>`}</div>
      </section>`;
    collegaFiltri(el);
    el.querySelector('#btnNuovo')?.addEventListener('click', () => modale(S, null, { scorta: false }));
    const lm = el.querySelector('#lisMagg');
    lm.addEventListener('change', async () => { const x = numO(lm.value); await UI.salva('impostazioni', { ...impostazioni(S), maggiorazione: x }); UI.toast('Maggiorazione normale salvata', 'ok'); });
    // prezzo cambiato nella riga: salvo appena esci dalla casella
    el.querySelectorAll('.lis-r input[data-p]').forEach((x) => x.addEventListener('change', async () => {
      const a = trova(S, x.closest('.lis-r').dataset.a); if (!a) return;
      const box = x.closest('.lis-r'), val = (k) => box.querySelector(`[data-p="${k}"]`).value;
      const prima = { prezzoNostro: numO(a.prezzoNostro), magg: numO(a.magg), prezzoCliente: prezzoCliente(S, a) };
      const v = { prezzoNostro: val('prezzoNostro'), magg: val('magg'), prezzoCliente: x.dataset.p === 'prezzoCliente' ? val('prezzoCliente') : '' };
      // cambiando nostro o % il prezzo cliente si ricalcola; cambiando il prezzo cliente si ricalcola la %
      if (x.dataset.p !== 'prezzoCliente') prima.prezzoCliente = null;
      if (x.dataset.p === 'prezzoCliente') prima.magg = numO(v.magg);
      const doc = { ...a, ...calcolaPrezzi(S, a, v, prima) };
      await UI.salva('articoli', doc);
      box.querySelector('[data-p="magg"]').value = due(numO(doc.magg));
      box.querySelector('[data-p="prezzoCliente"]').value = due(prezzoCliente(S, doc));
      UI.toast(`${a.codice}: prezzo salvato`, 'ok');
    }));
    return { titolo: 'Listino prezzi', indietro: '#/magazzino', live: false };
  }

  function route(el, S, parti) {
    if (parti[1] === 'listino') return listino(el, S);
    if (parti[1] === 'a') {
      const a = trova(S, parti[2]);
      if (!a) { el.innerHTML = '<p class="nessuno">Articolo non trovato.</p>'; return { titolo: 'Magazzino', indietro: '#/magazzino' }; }
      return scheda(el, S, a);
    }
    return lista(el, S);
  }

  return { route, collegaRicerca, prezzoCliente, giacenza, usi, badge, trova, cerca, num, q };
})();
