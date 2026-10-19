// ===== LAYOUT DELLE SEDI (pianta dall'alto del capannone) =====
// Una pianta schematica per ogni sede: campate, corsie, reparti, punti di riferimento e gli impianti
// dell'anagrafica messi al loro posto. Tutti la vedono; la modificano tutti tranne Risorse Umane.
// Con ?ctr=1 è la "vista layout" dei controlli: gli impianti si colorano (fatto / da fare) e toccandoli
// si apre subito il controllo da compilare.
window.LAY = (function () {
  const { esc, uid } = UI;

  // ---------- dati ----------
  const nuovo = (sedeId, clienteId) => ({ id: sedeId, sedeId, clienteId, campate: [20, 20, 20, 20], lunghezza: 80, corsie: [], elementi: [], impianti: [] });
  const docDi = (S, sedeId) => (S.layouts || []).find((x) => x.id === sedeId) || null;
  const larghezza = (L) => L.campate.reduce((a, b) => a + (+b || 0), 0);
  const bordiCampate = (L) => { const b = [0]; L.campate.forEach((w) => b.push(b[b.length - 1] + (+w || 0))); return b; };
  const campataDi = (L, x) => { const b = bordiCampate(L); for (let k = 0; k < L.campate.length; k++) if (x < b[k + 1]) return k; return L.campate.length - 1; };
  const eBandiera = (i) => /bandiera/i.test(i?.tipologia || '');
  const sigla = (i) => i.numeroInterno || (eBandiera(i) ? 'GB' : 'CP');

  // punti di riferimento che si possono aggiungere
  const TIPI = {
    testo: { nome: 'Scritta reparto', ico: '🔤' },
    zona: { nome: 'Zona / box', ico: '⬜' },
    uffici: { nome: 'Uffici', ico: '🏢' },
    ingresso: { nome: 'Ingresso', ico: '🚪' },
    caffe: { nome: 'Macchinette caffè', ico: '☕' },
    wc: { nome: 'Bagni', ico: '🚻' },
    quadro: { nome: 'Quadro elettrico', ico: '⚡' },
    estintore: { nome: 'Estintore', ico: '🧯' },
    soccorso: { nome: 'Pronto soccorso', ico: '⛑️' },
    punto: { nome: 'Altro punto', ico: '📍' }
  };

  // ---------- disegno (SVG in metri) ----------
  function disegna(S, L, opz = {}) {
    const W = larghezza(L) || 1, H = +L.lunghezza || 1;
    const u = Math.max(W, H) / 60;                       // unità per testi e simboli
    const m = u * 7;                                     // margine attorno al capannone (per ingressi e scritte fuori)
    const b = bordiCampate(L);
    const imp = S.impianti.filter((i) => i.sedeId === L.sedeId);
    let g = '';
    g += `<rect x="0" y="0" width="${W}" height="${H}" fill="#fff" stroke="#111" stroke-width="${u * 0.18}"/>`;
    (L.corsie || []).forEach((c) => (g += `<rect x="0" y="${+c.y}" width="${W}" height="${+c.h}" fill="#d9d9d9"/>`));
    b.slice(1, -1).forEach((x) => (g += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#111" stroke-width="${u * 0.12}"/>`));
    if (opz.modifica) L.campate.forEach((w, k) => (g += `<text x="${b[k] + w / 2}" y="${-u * 1.2}" font-size="${u * 1.3}" text-anchor="middle" fill="#9aa8b8">${k + 1}ª · ${w} m</text>`));
    // zone e riferimenti
    (L.elementi || []).forEach((e) => (g += elemento(e, u, opz)));
    // impianti
    (L.impianti || []).forEach((p) => { const i = imp.find((x) => x.id === p.impId); if (i) g += impianto(L, i, p, u, opz); });
    // la vista comprende anche ciò che sta fuori dal capannone (ingressi, gru all'esterno)
    const pts = [...(L.elementi || []).map((e) => [e.x, e.y, (+e.w || 0), (+e.h || 0)]), ...(L.impianti || []).map((p) => [p.x, p.y, 0, 0])];
    const x0 = Math.min(-m, ...pts.map((q) => q[0] - m)), y0 = Math.min(-m, ...pts.map((q) => q[1] - m));
    const x1 = Math.max(W + m, ...pts.map((q) => q[0] + q[2] + m)), y1 = Math.max(H + m, ...pts.map((q) => q[1] + q[3] + m));
    return `<svg class="lay-svg${opz.modifica ? ' in-modifica' : ''}" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" xmlns="http://www.w3.org/2000/svg" font-family="Arial, Helvetica, sans-serif">${g}</svg>`;
  }
  const sel = (opz, k) => (opz.scelto === k ? ' scelto' : '');
  function elemento(e, u, opz) {
    const t = esc(e.testo || '');
    const k = 'el:' + e.id;
    if (e.tipo === 'testo') {
      return `<g class="lay-drag${sel(opz, k)}" data-k="${k}" transform="translate(${e.x} ${e.y})${e.rot ? ` rotate(${e.rot})` : ''}">
        <text x="0" y="0" font-size="${u * 1.8}" fill="${e.colore || '#1f5fbf'}" dominant-baseline="middle">${t || 'SCRITTA'}</text></g>`;
    }
    if (e.tipo === 'zona' || e.tipo === 'uffici') {
      const w = +e.w || 10, h = +e.h || 6;
      return `<g class="lay-drag${sel(opz, k)}" data-k="${k}" transform="translate(${e.x} ${e.y})">
        <rect x="0" y="0" width="${w}" height="${h}" fill="${e.tipo === 'uffici' ? '#eef3f8' : '#fff'}" stroke="#111" stroke-width="${u * 0.14}"/>
        <text x="${u * 0.6}" y="${u * 1.7}" font-size="${u * 1.6}" fill="#1f5fbf">${t || (e.tipo === 'uffici' ? 'UFFICI' : '')}</text></g>`;
    }
    if (e.tipo === 'ingresso') {
      return `<g class="lay-drag${sel(opz, k)}" data-k="${k}" transform="translate(${e.x} ${e.y})${e.rot ? ` rotate(${e.rot})` : ''}">
        <path d="M0 ${-u * 2.4} L0 ${u * 0.6}" stroke="#2e9e5b" stroke-width="${u * 0.45}"/><path d="M${-u} ${-u * 0.2} L0 ${u * 1.4} L${u} ${-u * 0.2}z" fill="#2e9e5b"/>
        <text x="${u * 1.4}" y="${-u * 0.6}" font-size="${u * 1.6}" font-weight="700" fill="#111">${t || 'INGRESSO'}</text></g>`;
    }
    // simbolo con etichetta
    return `<g class="lay-drag${sel(opz, k)}" data-k="${k}" transform="translate(${e.x} ${e.y})">
      <circle r="${u * 1.6}" fill="#fff" stroke="#16324f" stroke-width="${u * 0.15}"/>
      <text x="0" y="${u * 0.1}" font-size="${u * 1.8}" text-anchor="middle" dominant-baseline="middle">${TIPI[e.tipo]?.ico || '📍'}</text>
      ${t ? `<text x="0" y="${u * 3.2}" font-size="${u * 1.1}" text-anchor="middle" fill="#111">${t}</text>` : ''}</g>`;
  }
  function impianto(L, i, p, u, opz) {
    const k = 'imp:' + i.id;
    const st = opz.stato ? opz.stato(i) : '';
    const col = st === 'fatto' ? '#2e9e5b' : st === 'dafare' ? '#e07a1f' : '#f2b705';
    const nome = esc(sigla(i));
    if (eBandiera(i)) {
      const s = u * 1.6;
      return `<g class="lay-drag lay-imp${sel(opz, k)} st-${st}" data-k="${k}" transform="translate(${p.x} ${p.y})">
        <rect x="${-s * 1.6}" y="${-s * 2.5}" width="${s * 3.2}" height="${s * 3.9}" fill="#fff" fill-opacity="0"/>
        <rect x="${-s * 1.3}" y="${-s * 1.3}" width="${s * 2.6}" height="${s * 2.6}" rx="${u * 0.3}" fill="${st ? col : '#fff8e0'}" fill-opacity="${st ? 0.22 : 1}" stroke="${col}" stroke-width="${u * 0.15}"/>
        <path d="M${-s * 0.6} ${s} L${-s * 0.6} ${-s} L${s * 0.9} ${-s}" fill="none" stroke="#c99a00" stroke-width="${u * 0.35}"/>
        <path d="M${s * 0.6} ${-s} L${s * 0.6} ${-s * 0.3}" stroke="#111" stroke-width="${u * 0.12}"/>
        <text x="0" y="${-s * 1.55}" font-size="${u * 2}" text-anchor="middle" font-weight="700" fill="#111">${nome}</text></g>`;
    }
    // carroponte: trave che attraversa tutta la campata
    const b = bordiCampate(L), c = campataDi(L, p.x), x0 = b[c], x1 = b[c + 1], cx = (x0 + x1) / 2, mezza = (x1 - x0) / 2 - u * 0.5;
    const h = u * 0.9;
    return `<g class="lay-drag lay-imp${sel(opz, k)} st-${st}" data-k="${k}" transform="translate(${cx} ${p.y})">
      <rect x="${-mezza - u * 0.4}" y="${-h * 3.4}" width="${mezza * 2 + u * 0.8}" height="${h * 5.4}" fill="#fff" fill-opacity="0"/>
      <rect x="${-mezza}" y="${-h / 2}" width="${mezza * 2}" height="${h}" fill="${col}" stroke="#111" stroke-width="${u * 0.1}"/>
      <rect x="${-mezza - u * 0.25}" y="${-h * 1.6}" width="${u * 0.6}" height="${h * 3.2}" fill="${col}" stroke="#111" stroke-width="${u * 0.1}"/>
      <rect x="${mezza - u * 0.35}" y="${-h * 1.6}" width="${u * 0.6}" height="${h * 3.2}" fill="${col}" stroke="#111" stroke-width="${u * 0.1}"/>
      <text x="${mezza}" y="${-h * 1.4}" font-size="${u * 2}" text-anchor="end" font-weight="700" fill="#111">${nome}</text></g>`;
  }

  // ---------- elenco delle sedi ----------
  const filtro = { q: '' };
  function elenco(el, S, ctr) {
    const sedi = CTR.sediConImpianti(S);
    const q = filtro.q.toLowerCase();
    const anno = +UI.oggi().slice(0, 4);
    const righe = sedi.filter(({ c, s }) => !q || CTR.nomeSede(c, s).toLowerCase().includes(q));
    el.innerHTML = `
      <section class="cli">
        <div class="sez-head"><h1>${ctr ? 'Controlli · vista layout' : 'Layout delle sedi'} ${UI.info(ctr
          ? 'Scegli la sede: si apre la pianta con gli impianti colorati (verde = controllo fatto, arancio = da fare). Tocca un impianto per aprire subito il suo controllo.'
          : 'Per ogni sede si disegna una volta la pianta dall\'alto: campate, corsie, reparti, ingressi e punti di riferimento, poi si mettono al loro posto gli impianti dell\'anagrafica. Durante i controlli si apre la pianta e si trovano subito le gru.')}</h1>
          ${ctr ? '<a class="btn ghost small" href="#/controlli">☰ Vista elenco</a>' : ''}</div>
        <input type="search" class="cerca" id="lCerca" placeholder="Cerca cliente o sede…" value="${esc(filtro.q)}">
        <div class="lista">
          ${righe.length ? righe.map(({ c, s }) => {
            const L = docDi(S, s.id), imp = S.impianti.filter((i) => i.sedeId === s.id && !i.dismesso);
            const messi = L ? L.impianti.filter((p) => imp.some((i) => i.id === p.impId)).length : 0;
            const pr = ctr ? CTR.prossima(S, s.id, anno) : null;
            return `<a class="riga" href="#/layout/s/${s.id}${ctr ? '?ctr=1' : ''}">
              <span class="lay-mini">🗺️</span>
              <div class="grow"><b>${esc(CTR.nomeSede(c, s))}</b>
                <div class="muted small">${imp.length} impianti · ${L ? (messi === imp.length ? '<span class="txt-ok">layout completo</span>' : `${messi}/${imp.length} nel layout`) : '<span class="txt-ko">layout da disegnare</span>'}
                ${ctr ? ' · ' + (pr ? `<span class="pill st-${pr.k}">${esc(pr.label)}</span>` : '<span class="pill st-ok">anno completato</span>') : ''}</div></div>
              <span class="freccia">›</span></a>`; }).join('') : '<p class="nessuno">Nessuna sede con impianti. Prima inserisci gli impianti in «Anagrafica impianti».</p>'}
        </div>
      </section>`;
    const c = el.querySelector('#lCerca');
    c.oninput = () => { filtro.q = c.value; const pos = c.selectionStart; App.ridisegna(); const n = document.getElementById('lCerca'); n.focus(); n.setSelectionRange(pos, pos); };
    return { titolo: ctr ? 'Controlli · layout' : 'Layout delle sedi', indietro: ctr ? '#/schede' : '#/', live: true };
  }

  // ---------- pianta di una sede ----------
  const inModifica = {};   // sedeId -> true mentre si modifica
  function pianta(el, S, sedeId, ctr) {
    const { c, s } = CTR.trovaSede(S, sedeId);
    if (!s) { el.innerHTML = '<p class="nessuno">Sede non trovata.</p>'; return { titolo: 'Layout', indietro: '#/layout' }; }
    const indietro = ctr ? '#/layout?ctr=1' : '#/layout';
    const salvato = docDi(S, sedeId);
    const puoModificare = !UT.solaLettura();
    const modifica = !!inModifica[sedeId] && puoModificare;
    const L = salvato ? JSON.parse(JSON.stringify(salvato)) : nuovo(sedeId, c.id);
    L.corsie = L.corsie || []; L.elementi = L.elementi || []; L.impianti = L.impianti || [];
    const imp = S.impianti.filter((i) => i.sedeId === sedeId && !i.dismesso)
      .sort((a, b) => (a.numeroInterno || '~').localeCompare(b.numeroInterno || '~', 'it', { numeric: true }));
    // stato dei controlli (vista controlli)
    const anno = +UI.oggi().slice(0, 4);
    const pr = CTR.prossima(S, sedeId, anno), n = pr ? pr.n : 4;
    const fatto = (i) => !!CTR.schedaDi(S, i.id, anno)?.visite?.[n];
    const stato = ctr ? (i) => (fatto(i) ? 'fatto' : 'dafare') : null;
    const apri = (i) => (fatto(i) || !pr ? `#/controlli/i/${i.id}?anno=${anno}` : `#/controlli/i/${i.id}/${anno}/${n}?torna=${encodeURIComponent('#/layout/s/' + sedeId + '?ctr=1')}`);
    let scelto = null;

    const fuori = () => imp.filter((i) => !L.impianti.some((p) => p.impId === i.id));
    el.innerHTML = `
      <section class="lay ${modifica ? 'lay-mod' : ''}">
        <div class="card ctr-testa no-print">
          <div class="grow"><h1>${esc(CTR.nomeSede(c, s))}</h1>
            <p class="muted small">${ctr ? (pr ? `<span class="pill st-${pr.k}">${esc(pr.label)}</span> · <span class="leg leg-ok">■</span> fatto <span class="leg leg-da">■</span> da fare` : '<span class="pill st-ok">Controlli dell\'anno completati</span>') : modifica ? 'Modifica: trascina gli oggetti, toccali per cambiarli' : `${imp.length} impianti`}</p></div>
          ${modifica ? '<button class="btn" id="btnFine">✓ Fine</button>' : ''}
          ${UI.menu([
            !modifica && puoModificare && { t: '✏️ Modifica layout', id: 'btnMod' },
            UT.puoInviare() && !modifica && salvato && { t: '🖨️ Stampa', id: 'btnStampa' },
            ctr ? { t: '☰ Controlli: vista elenco', href: '#/controlli/s/' + sedeId } : { t: '✅ Controlli di questa sede', href: '#/layout/s/' + sedeId + '?ctr=1' },
            { t: '🏢 Anagrafica cliente', href: `#/clienti/${c.id}` }
          ])}
        </div>
        ${modifica ? `
        <details class="card lay-strut no-print" ${salvato ? '' : 'open'}>
          <summary><b>🏭 Capannone</b> <span class="muted small" id="strutSint"></span></summary>
          <div class="due">
            <label>N° campate<input type="number" inputmode="numeric" min="1" max="20" id="nCamp" value="${L.campate.length}"></label>
            <label>Lunghezza capannone (m)<input type="number" inputmode="decimal" min="5" id="lung" value="${L.lunghezza}"></label>
          </div>
          <div class="lay-camp" id="campBox"></div>
          <div class="lay-corsie"><b>Corsie trasversali</b> ${UI.info('Le fasce grigie che attraversano il capannone. «Da» è la distanza dal lato in alto, in metri.')}
            <div id="corsieBox"></div><button type="button" class="btn ghost small" id="btnCorsia">+ Corsia</button></div>
        </details>
        <div class="card lay-pal no-print">
          <div class="lay-pal-tit">Aggiungi</div>
          <div class="lay-pal-voci">${Object.entries(TIPI).map(([k, t]) => `<button type="button" class="chip-s" data-add="${k}">${t.ico} ${t.nome}</button>`).join('')}</div>
          <div class="lay-pal-tit">Impianti da posizionare ${UI.info('Solo gli impianti dell\'anagrafica di questa sede. I carriponte si allineano da soli alla campata.')}</div>
          <div class="lay-pal-voci" id="impFuori"></div>
        </div>` : ''}
        ${!salvato && !modifica ? `<div class="card vuoto-lay"><p>Per questa sede il layout non è ancora stato disegnato.</p>${puoModificare ? '<button class="btn" id="btnMod2">✏️ Disegna il layout</button>' : ''}</div>` : ''}
        <div class="lay-foglio" id="foglio">
          <div class="lay-stampa-testa"><b>${esc(CTR.nomeSede(c, s))}</b><span>LAYOUT IMPIANTI · ${UI.fmt(UI.oggi())}</span></div>
          <div id="svgBox"></div>
        </div>
        <div class="card lay-prop no-print" id="prop" hidden></div>
        ${!modifica && salvato && fuori().length ? `<div class="card no-print"><b>Non ancora nel layout:</b> <span class="lay-fuori">${fuori().map((i) => ctr
          ? `<a class="chip-s ${fatto(i) ? 'on-ok' : ''}" href="${apri(i)}">${esc(sigla(i))}</a>` : `<span class="chip-s">${esc(sigla(i))}</span>`).join('')}</span></div>` : ''}
      </section>`;

    const box = el.querySelector('#svgBox');
    const ridisegna = () => {
      box.innerHTML = (salvato || modifica) ? disegna(S, L, { modifica, stato, scelto }) : '';
      if (modifica) { disegnaPal(); collegaTrascina(); }
      else collegaTocchi();
    };

    // ---- vista: tocco su un impianto ----
    function collegaTocchi() {
      box.querySelectorAll('.lay-imp').forEach((g) => {
        g.style.cursor = 'pointer';
        g.addEventListener('click', () => {
          const i = imp.find((x) => 'imp:' + x.id === g.dataset.k); if (!i) return;
          if (ctr) { location.hash = apri(i); return; }
          const p = el.querySelector('#prop'); p.hidden = false;
          p.innerHTML = `<div class="lay-prop-riga"><b>${esc(sigla(i))}</b> <span class="grow">${esc(IMP.titolo(i))}${i.matricola ? ' · matr. ' + esc(i.matricola) : ''}</span>
            <a class="btn small" href="#/controlli/i/${i.id}?anno=${anno}">📋 Controlli</a><a class="btn ghost small" href="#/impianti/i/${i.id}">Anagrafica</a></div>`;
          p.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      });
    }

    // ---- modifica ----
    let timer = null;
    const salva = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => { try { await UI.salva('layouts', L); } catch (e) { /* messaggio già mostrato */ } }, 700);
    };
    function disegnaPal() {
      el.querySelector('#impFuori').innerHTML = fuori().map((i) => `<button type="button" class="chip-s chip-imp" data-addimp="${i.id}">${eBandiera(i) ? '🏗️' : '═'} ${esc(sigla(i))}</button>`).join('') || '<span class="muted small">Tutti gli impianti sono nel layout ✓</span>';
      el.querySelectorAll('[data-addimp]').forEach((b) => (b.onclick = () => {
        // ogni nuovo impianto in un posto libero: una campata dopo l'altra, scendendo
        const b2 = bordiCampate(L), nc = L.campate.length, k = L.impianti.length;
        const cc = k % nc, riga = Math.floor(k / nc), passo = Math.max(6, L.lunghezza / 8);
        L.impianti.push({ impId: b.dataset.addimp, x: (b2[cc] + b2[cc + 1]) / 2, y: Math.min(L.lunghezza - 3, passo * (riga + 1)) });
        scelto = 'imp:' + b.dataset.addimp; ridisegna(); proprieta(); salva();
      }));
      const sint = el.querySelector('#strutSint');
      if (sint) sint.textContent = `${L.campate.length} campate · ${larghezza(L)} × ${L.lunghezza} m${L.corsie.length ? ' · ' + L.corsie.length + ' corsie' : ''}`;
    }
    function struttura() {
      const cb = el.querySelector('#campBox');
      cb.innerHTML = '<span class="muted small">Larghezza di ogni campata (m):</span>' + L.campate.map((w, k) => `<label class="lay-mini-in">${k + 1}ª<input type="number" inputmode="decimal" min="1" data-camp="${k}" value="${w}"></label>`).join('');
      cb.querySelectorAll('[data-camp]').forEach((x) => (x.onchange = () => { L.campate[+x.dataset.camp] = Math.max(1, +x.value || 1); ridisegna(); salva(); }));
      const co = el.querySelector('#corsieBox');
      co.innerHTML = L.corsie.map((c, k) => `<div class="lay-corsia"><label class="lay-mini-in">Da (m)<input type="number" inputmode="decimal" data-cy="${k}" value="${c.y}"></label><label class="lay-mini-in">Larga (m)<input type="number" inputmode="decimal" data-ch="${k}" value="${c.h}"></label><button type="button" class="btn ghost small danger" data-cdel="${k}">×</button></div>`).join('');
      co.querySelectorAll('[data-cy]').forEach((x) => (x.onchange = () => { L.corsie[+x.dataset.cy].y = Math.max(0, +x.value || 0); ridisegna(); salva(); }));
      co.querySelectorAll('[data-ch]').forEach((x) => (x.onchange = () => { L.corsie[+x.dataset.ch].h = Math.max(0.5, +x.value || 1); ridisegna(); salva(); }));
      co.querySelectorAll('[data-cdel]').forEach((x) => (x.onclick = () => { L.corsie.splice(+x.dataset.cdel, 1); struttura(); ridisegna(); salva(); }));
    }
    function collegaModifica() {
      el.querySelector('#nCamp').onchange = (e) => {
        const n2 = Math.max(1, Math.min(20, +e.target.value || 1)), ultima = L.campate[L.campate.length - 1] || 20;
        while (L.campate.length < n2) L.campate.push(ultima);
        L.campate.length = n2; struttura(); ridisegna(); salva();
      };
      el.querySelector('#lung').onchange = (e) => { L.lunghezza = Math.max(5, +e.target.value || 5); ridisegna(); salva(); };
      el.querySelector('#btnCorsia').onclick = () => { L.corsie.push({ y: Math.round(L.lunghezza / 2), h: 4 }); struttura(); ridisegna(); salva(); };
      el.querySelectorAll('[data-add]').forEach((b) => (b.onclick = () => {
        const t = b.dataset.add, W = larghezza(L);
        const sfasa = (L.elementi.length % 6) * Math.max(3, L.lunghezza / 20);   // non uno sopra l'altro
        const e = { id: uid(), tipo: t, x: W / 2, y: L.lunghezza * 0.2 + sfasa, testo: t === 'testo' ? 'REPARTO' : t === 'uffici' ? 'UFFICI' : t === 'ingresso' ? 'INGRESSO' : '' };
        if (t === 'zona' || t === 'uffici') Object.assign(e, { w: Math.round(W / 4) || 10, h: 8 });
        if (t === 'ingresso') e.y = -Math.max(W, L.lunghezza) / 60 * 3;
        L.elementi.push(e); scelto = 'el:' + e.id; ridisegna(); proprieta(); salva();
      }));
      el.querySelector('#btnFine').onclick = () => { clearTimeout(timer); UI.salva('layouts', L).finally(() => { delete inModifica[sedeId]; App.ridisegna(); }); };
      struttura();
    }
    // pannello dell'oggetto scelto
    function proprieta() {
      const p = el.querySelector('#prop');
      if (!scelto) { p.hidden = true; return; }
      p.hidden = false;
      const [tipo, id] = scelto.split(':');
      if (tipo === 'imp') {
        const i = imp.find((x) => x.id === id);
        p.innerHTML = `<div class="lay-prop-riga"><b>${esc(i ? sigla(i) : '')}</b><span class="grow">${esc(i ? IMP.titolo(i) : '')}</span>
          <button type="button" class="btn ghost small danger" id="pTogli">Togli dal layout</button><button type="button" class="btn ghost small" id="pChiudi">Fatto</button></div>`;
        p.querySelector('#pTogli').onclick = () => { L.impianti = L.impianti.filter((x) => x.impId !== id); scelto = null; ridisegna(); proprieta(); salva(); };
      } else {
        const e = L.elementi.find((x) => x.id === id); if (!e) { p.hidden = true; return; }
        const conTesto = true, dim = e.tipo === 'zona' || e.tipo === 'uffici', ruota = e.tipo === 'testo' || e.tipo === 'ingresso';
        p.innerHTML = `<div class="lay-prop-riga"><b>${TIPI[e.tipo]?.ico || ''} ${esc(TIPI[e.tipo]?.nome || '')}</b><span class="grow"></span>
            <button type="button" class="btn ghost small danger" id="pTogli">Elimina</button><button type="button" class="btn ghost small" id="pChiudi">Fatto</button></div>
          <div class="lay-prop-campi">
            ${conTesto ? `<label>Testo<input id="pTesto" value="${esc(e.testo || '')}" autocomplete="off"></label>` : ''}
            ${dim ? `<label class="lay-mini-in">Larga (m)<input type="number" inputmode="decimal" id="pW" value="${e.w}"></label><label class="lay-mini-in">Lunga (m)<input type="number" inputmode="decimal" id="pH" value="${e.h}"></label>` : ''}
            ${ruota ? `<button type="button" class="btn ghost small" id="pRuota">↻ Ruota</button>` : ''}
            ${e.tipo === 'testo' ? `<span class="lay-colori">${['#1f5fbf', '#2e9e5b', '#d6453d', '#111111'].map((cc) => `<button type="button" class="lay-col" data-col="${cc}" style="background:${cc}" aria-label="colore"></button>`).join('')}</span>` : ''}
          </div>`;
        p.querySelector('#pTesto').oninput = (ev) => { e.testo = ev.target.value.toUpperCase(); ridisegna(); salva(); };
        p.querySelector('#pW')?.addEventListener('change', (ev) => { e.w = Math.max(1, +ev.target.value || 1); ridisegna(); salva(); });
        p.querySelector('#pH')?.addEventListener('change', (ev) => { e.h = Math.max(1, +ev.target.value || 1); ridisegna(); salva(); });
        p.querySelector('#pRuota')?.addEventListener('click', () => { e.rot = ((+e.rot || 0) + 90) % 360; ridisegna(); salva(); });
        p.querySelectorAll('[data-col]').forEach((b) => (b.onclick = () => { e.colore = b.dataset.col; ridisegna(); salva(); }));
        p.querySelector('#pTogli').onclick = () => { L.elementi = L.elementi.filter((x) => x.id !== id); scelto = null; ridisegna(); proprieta(); salva(); };
      }
      p.querySelector('#pChiudi').onclick = () => { scelto = null; ridisegna(); proprieta(); };
    }
    // trascinamento (mouse e dito)
    function collegaTrascina() {
      const svg = box.querySelector('svg');
      const punto = (ev) => { const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
      svg.querySelectorAll('.lay-drag').forEach((g) => {
        g.addEventListener('pointerdown', (ev) => {
          ev.preventDefault();
          const k = g.dataset.k, [tipo, id] = k.split(':');
          const o = tipo === 'imp' ? L.impianti.find((x) => x.impId === id) : L.elementi.find((x) => x.id === id);
          if (!o) return;
          const p0 = punto(ev), x0 = o.x, y0 = o.y; let mosso = false;
          g.setPointerCapture(ev.pointerId);
          const muovi = (e2) => {
            const p1 = punto(e2), dx = p1.x - p0.x, dy = p1.y - p0.y;
            if (!mosso && Math.hypot(dx, dy) < Math.max(larghezza(L), L.lunghezza) / 300) return;
            mosso = true;
            o.x = Math.round((x0 + dx) * 10) / 10; o.y = Math.round((y0 + dy) * 10) / 10;
            if (tipo === 'imp') {   // i carriponte seguono la campata: rifaccio il loro disegno
              const i = imp.find((x) => x.id === id), u = Math.max(larghezza(L), L.lunghezza) / 60;
              const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'g'); tmp.innerHTML = impianto(L, i, o, u, { scelto: k });
              const nuovoG = tmp.firstElementChild; g.setAttribute('transform', nuovoG.getAttribute('transform')); g.innerHTML = nuovoG.innerHTML;
            } else {
              const tr = g.getAttribute('transform').replace(/translate\([^)]*\)/, `translate(${o.x} ${o.y})`); g.setAttribute('transform', tr);
            }
          };
          const su = () => {
            g.removeEventListener('pointermove', muovi); g.removeEventListener('pointerup', su); g.removeEventListener('pointercancel', su);
            scelto = k; ridisegna(); proprieta(); if (mosso) salva();
          };
          g.addEventListener('pointermove', muovi); g.addEventListener('pointerup', su); g.addEventListener('pointercancel', su);
        });
      });
    }

    const entra = () => { inModifica[sedeId] = true; App.ridisegna(); };
    el.querySelector('#btnMod')?.addEventListener('click', entra);
    el.querySelector('#btnMod2')?.addEventListener('click', entra);
    el.querySelector('#btnStampa')?.addEventListener('click', () => {
      const t = document.title; document.title = `Layout_${CTR.nomeSede(c, s)}`.replace(/[^\w\-]+/g, '_');
      document.body.classList.add('stampa-layout'); window.print();
      setTimeout(() => { document.title = t; document.body.classList.remove('stampa-layout'); }, 1000);
    });
    if (modifica) collegaModifica();
    ridisegna();
    return { titolo: modifica ? 'Modifica layout' : (ctr ? 'Controlli · layout' : 'Layout'), indietro, live: !modifica };
  }

  function route(el, S, parti, query) {
    const ctr = query.get('ctr') === '1';
    if (parti[1] === 's' && parti[2]) return pianta(el, S, parti[2], ctr);
    return elenco(el, S, ctr);
  }
  return { route, disegna };
})();
