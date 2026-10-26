// ===== LAYOUT DELLE SEDI (pianta dall'alto, solo un disegno: nessuna misura) =====
// Ogni sede ha la sua pianta composta liberamente: uno o più capannoni (rettangoli divisi in campate),
// corridoi e collegamenti, corsie, reparti, punti di riferimento e gli impianti dell'anagrafica.
// Tutti la vedono; la modificano tutti tranne Risorse Umane.
// Con ?ctr=1 è la "vista layout" dei controlli: impianti colorati (fatto / da fare), toccandoli si apre il controllo.
window.LAY = (function () {
  const { esc, uid } = UI;

  // ---------- dati ----------
  // tutto sta in "elementi" (capannoni compresi) con coordinate libere: la vista si adatta da sola al disegno
  const nuovo = (sedeId, clienteId) => ({ id: sedeId, sedeId, clienteId, elementi: [{ id: uid(), tipo: 'capannone', x: 0, y: 0, w: 100, h: 70, n: 4, or: 'v', testo: '' }], impianti: [] });
  const docDi = (S, sedeId) => (S.layouts || []).find((x) => x.id === sedeId) || null;
  // layout della prima versione (campate in metri): diventa un capannone come gli altri
  function aggiorna(L) {
    L.elementi = L.elementi || []; L.impianti = L.impianti || [];
    if (Array.isArray(L.campate)) {
      const W = L.campate.reduce((a, b) => a + (+b || 0), 0) || 100, H = +L.lunghezza || 70;
      L.elementi.unshift({ id: uid(), tipo: 'capannone', x: 0, y: 0, w: W, h: H, n: L.campate.length, or: 'v', testo: '' });
      (L.corsie || []).forEach((c) => L.elementi.splice(1, 0, { id: uid(), tipo: 'corsia', x: 0, y: +c.y, w: W, h: +c.h }));
      delete L.campate; delete L.lunghezza; delete L.corsie;
    }
    return L;
  }
  const tipoIco = (i) => (i && window.MIMP ? MIMP.di(App.dati(), i).icona : '');
  const eBandiera = (i) => tipoIco(i) === 'bandiera' || /bandiera/i.test(i?.tipologia || '');
  // famiglie di impianti per il filtro e per il simbolo nel layout
  const FAMIGLIE = { carroponte: 'Carriponte', bandiera: 'Gru a bandiera', rotaia: 'Monorotaie', pinza: 'Pinze', seghetto: 'Seghetti' };
  const NOME_SIMBOLO = { carroponte: 'Carroponte', bandiera: 'Gru a bandiera', rotaia: 'Monorotaia / paranco su binario', pinza: 'Pinza', seghetto: 'Seghetto' };
  const famiglia = (i) => { const t = i?.tipologia || '', k = tipoIco(i); if (k === 'bandiera' || k === 'seghetto') return k; return /bandiera/i.test(t) ? 'bandiera' : /pinz/i.test(t) ? 'pinza' : /seghett/i.test(t) ? 'seghetto' : 'carroponte'; };
  // nel layout il simbolo si può cambiare a mano (p.fam), altrimenti segue la tipologia
  const famigliaIn = (L, i) => (L.impianti.find((p) => p.impId === i.id)?.fam) || famiglia(i);
  const SCALE = [1, 0.8, 0.65, 0.5];   // grandezza dei simboli (bandiera, pinza, seghetto)
  const filtroLay = {};               // filtro scelto per sede (solo su questo dispositivo)
  const sigla = (i) => i.numeroInterno || (eBandiera(i) ? 'GB' : famiglia(i) === 'seghetto' ? 'SG' : 'CP');
  const RIDIM = ['capannone', 'zona', 'uffici', 'corsia', 'corridoio'];

  // cose che si possono aggiungere
  const TIPI = {
    capannone: { nome: 'Capannone', ico: '🏭' },
    corridoio: { nome: 'Corridoio / collegamento', ico: '▭' },
    corsia: { nome: 'Corsia (fascia grigia)', ico: '▬' },
    zona: { nome: 'Zona / box', ico: '⬜' },
    uffici: { nome: 'Uffici', ico: '🏢' },
    testo: { nome: 'Scritta reparto', ico: '🔤' },
    ingresso: { nome: 'Ingresso', ico: '🚪' },
    caffe: { nome: 'Macchinette caffè', ico: '☕' },
    wc: { nome: 'Bagni', ico: '🚻' },
    quadro: { nome: 'Quadro elettrico', ico: '⚡' },
    estintore: { nome: 'Estintore', ico: '🧯' },
    soccorso: { nome: 'Pronto soccorso', ico: '⛑️' },
    punto: { nome: 'Altro punto', ico: '📍' }
  };

  // ---------- geometria ----------
  const capannoni = (L) => L.elementi.filter((e) => e.tipo === 'capannone');
  const dentro = (c, x, y) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h;
  // grandezza di riferimento per testi e simboli (dai capannoni, così non cambia mentre si sposta un oggetto)
  function unita(L) {
    if (+L.u > 0) return +L.u;
    return unitaCalcolata(L);
  }
  function unitaCalcolata(L) {
    const cs = capannoni(L);
    if (!cs.length) return 100 / 60;
    const x0 = Math.min(...cs.map((c) => c.x)), x1 = Math.max(...cs.map((c) => c.x + c.w));
    const y0 = Math.min(...cs.map((c) => c.y)), y1 = Math.max(...cs.map((c) => c.y + c.h));
    return Math.max(x1 - x0, y1 - y0, 40) / 60;
  }
  // campata in cui cade un punto: { c, a, b, or } (a-b = limiti della campata lungo x se verticali, lungo y se orizzontali)
  function campataDi(L, x, y) {
    const c = capannoni(L).slice().reverse().find((k) => dentro(k, x, y)); if (!c) return null;
    const n = Math.max(1, +c.n || 1);
    if (c.or === 'o') { const p = c.h / n, k = Math.min(n - 1, Math.floor((y - c.y) / p)); return { c, a: c.y + k * p, b: c.y + (k + 1) * p, or: 'o' }; }
    const p = c.w / n, k = Math.min(n - 1, Math.floor((x - c.x) / p)); return { c, a: c.x + k * p, b: c.x + (k + 1) * p, or: 'v' };
  }

  // ---------- testi che vanno a capo dentro la loro campata ----------
  let ctx2d = null;
  const largo = (t, fs) => { ctx2d = ctx2d || document.createElement('canvas').getContext('2d'); ctx2d.font = `${fs}px Arial, Helvetica, sans-serif`; return ctx2d.measureText(t).width; };
  function aCapo(testo, fs, max) {
    const parole = testo.split(/\s+/).filter(Boolean);
    if (!max || !parole.length) return { fs, righe: [testo] };
    // una parola più lunga della campata: rimpicciolisco quanto basta
    const lunga = Math.max(...parole.map((w) => largo(w, fs)));
    if (lunga > max) fs = fs * max / lunga;
    const righe = []; let r = '';
    parole.forEach((w) => { const prova = r ? r + ' ' + w : w; if (r && largo(prova, fs) > max) { righe.push(r); r = w; } else r = prova; });
    if (r) righe.push(r);
    return { fs, righe };
  }
  // dentro un capannone la scritta resta dove la metti e va a capo prima del bordo della sua campata,
  // nella direzione in cui è scritta (anche ruotata). null = fuori dai capannoni: nessun limite
  function spazioTesto(L, e, u) {
    if (!L) return null;
    const c = capannoni(L).slice().reverse().find((k) => dentro(k, e.x, e.y)); if (!c) return null;
    const n = Math.max(1, +c.n || 1);
    let x0 = c.x, x1 = c.x + c.w, y0 = c.y, y1 = c.y + c.h;
    if (c.or === 'o') { const k = Math.min(n - 1, Math.floor((e.y - c.y) / (c.h / n))); y0 = c.y + k * c.h / n; y1 = y0 + c.h / n; }
    else { const k = Math.min(n - 1, Math.floor((e.x - c.x) / (c.w / n))); x0 = c.x + k * c.w / n; x1 = x0 + c.w / n; }
    const r = (((+e.rot || 0) % 360) + 360) % 360;
    // il testo è centrato sul suo punto: lungo = spazio per la riga, largo = spazio per le righe impilate
    const orizz = 2 * Math.min(e.x - x0, x1 - e.x), vert = 2 * Math.min(e.y - y0, y1 - e.y);
    const lungo = r === 90 || r === 270 ? vert : orizz, largo2 = r === 90 || r === 270 ? orizz : vert;
    return { lungo: Math.max(u * 2, lungo - u * 1.2), largo: Math.max(u * 1.5, largo2 - u * 0.8) };
  }

  // testo centrato in un riquadro (uffici, zone, corridoi): va a capo e si rimpicciolisce per starci
  function testoNelRiquadro(testo, w, h, fs0, u, colore) {
    if (!testo) return '';
    const verticale = h > w * 1.4, lw = (verticale ? h : w) - u * 1.2, lh = (verticale ? w : h) - u * 0.8;
    let { fs, righe } = aCapo(testo, fs0, Math.max(u, lw));
    for (let q = 0; q < 14 && (righe.length * 1.15 - 0.15) * fs > lh; q++) ({ fs, righe } = aCapo(testo, fs * 0.88, Math.max(u, lw)));
    const y0 = h / 2 - (righe.length - 1) * 1.15 * fs / 2;
    return `<text x="${w / 2}" y="${y0}" font-size="${fs}" text-anchor="middle" dominant-baseline="middle" fill="${colore}"${verticale ? ` transform="rotate(-90 ${w / 2} ${h / 2})"` : ''}>${righe.map((r, q) => `<tspan x="${w / 2}" dy="${q ? '1.15em' : 0}">${esc(r)}</tspan>`).join('')}</text>`;
  }

  // ---------- disegno (SVG) ----------
  function disegna(S, L, opz = {}) {
    const u = unita(L), m = u * 6;
    const imp = S.impianti.filter((i) => i.sedeId === L.sedeId);
    const ordine = { capannone: 0, corridoio: 1, corsia: 2, zona: 3, uffici: 3 };
    const els = L.elementi.slice().sort((a, b) => (ordine[a.tipo] ?? 9) - (ordine[b.tipo] ?? 9));
    let g = '';
    opz = { ...opz, L };
    els.forEach((e) => (g += elemento(e, u, opz)));
    L.impianti.forEach((p) => { const i = imp.find((x) => x.id === p.impId); if (i && (!opz.filtro || (p.fam || famiglia(i)) === opz.filtro)) g += impianto(L, i, p, u, opz); });
    // la vista comprende tutto il disegno
    const pts = [...L.elementi.map((e) => [e.x, e.y, +e.w || 0, +e.h || 0]), ...L.impianti.map((p) => [p.x, p.y, 0, 0])];
    if (!pts.length) pts.push([0, 0, 100, 70]);
    const x0 = Math.min(...pts.map((q) => q[0])) - m, y0 = Math.min(...pts.map((q) => q[1])) - m;
    const x1 = Math.max(...pts.map((q) => q[0] + q[2])) + m, y1 = Math.max(...pts.map((q) => q[1] + q[3])) + m;
    return `<svg class="lay-svg${opz.modifica ? ' in-modifica' : ''}" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" xmlns="http://www.w3.org/2000/svg" font-family="Arial, Helvetica, sans-serif">${g}</svg>`;
  }
  const sel = (opz, k) => (opz.scelto === k ? ' scelto' : '');
  const maniglia = (e, u, opz) => (opz.modifica && opz.scelto === 'el:' + e.id && RIDIM.includes(e.tipo)
    ? `<rect class="lay-handle" data-resize="${e.id}" x="${e.w - u * 1.2}" y="${e.h - u * 1.2}" width="${u * 2.4}" height="${u * 2.4}" rx="${u * 0.4}" fill="#1f5fbf" stroke="#fff" stroke-width="${u * 0.2}"/>` : '');
  function elemento(e, u, opz) {
    const t = esc(e.testo || '');
    const k = 'el:' + e.id;
    const apri = (extra = '') => `<g class="lay-drag lay-${e.tipo}${sel(opz, k)}" data-k="${k}" transform="translate(${e.x} ${e.y})${extra}">`;
    if (e.tipo === 'capannone') {
      const n = Math.max(1, +e.n || 1); let lin = '';
      for (let q = 1; q < n; q++) lin += e.or === 'o'
        ? `<line x1="0" y1="${(e.h * q) / n}" x2="${e.w}" y2="${(e.h * q) / n}" stroke="#111" stroke-width="${u * 0.12}"/>`
        : `<line x1="${(e.w * q) / n}" y1="0" x2="${(e.w * q) / n}" y2="${e.h}" stroke="#111" stroke-width="${u * 0.12}"/>`;
      return `${apri()}<rect x="0" y="0" width="${e.w}" height="${e.h}" fill="#fff" stroke="#111" stroke-width="${u * 0.2}"/>${lin}
        ${t ? `<text x="${e.w / 2}" y="${-u * 0.7}" font-size="${u * 1.5}" font-weight="700" text-anchor="middle" fill="#5b6b7d">${t}</text>` : ''}${maniglia(e, u, opz)}</g>`;
    }
    if (e.tipo === 'corsia') return `${apri()}<rect x="0" y="0" width="${e.w}" height="${e.h}" fill="#d9d9d9"/>${maniglia(e, u, opz)}</g>`;
    if (e.tipo === 'corridoio') {
      return `${apri()}<rect x="0" y="0" width="${e.w}" height="${e.h}" fill="#f3f5f7" stroke="#111" stroke-width="${u * 0.16}" stroke-dasharray="${u * 0.8} ${u * 0.5}"/>
        ${testoNelRiquadro(e.testo || '', e.w, e.h, u * 1.3, u, '#5b6b7d')}${maniglia(e, u, opz)}</g>`;
    }
    if (e.tipo === 'zona' || e.tipo === 'uffici') {
      return `${apri()}<rect x="0" y="0" width="${e.w}" height="${e.h}" fill="${e.tipo === 'uffici' ? '#eef3f8' : '#fff'}" stroke="#111" stroke-width="${u * 0.14}"/>
        ${testoNelRiquadro(e.testo || (e.tipo === 'uffici' ? 'UFFICI' : ''), e.w, e.h, u * 1.6, u, '#1f5fbf')}${maniglia(e, u, opz)}</g>`;
    }
    if (e.tipo === 'testo') {
      const sp = spazioTesto(opz.L, e, u);
      let { fs, righe } = aCapo(e.testo || 'SCRITTA', u * 1.8 * (+e.s || 1), sp?.lungo);
      // troppe righe per lo spazio: rimpicciolisco finché ci stanno
      for (let q = 0; sp && q < 12 && (righe.length * 1.15 - 0.15) * fs > sp.largo; q++) ({ fs, righe } = aCapo(e.testo || 'SCRITTA', fs * 0.88, sp.lungo));
      // il blocco di righe sta sempre verso l'interno della campata, mantenendo l'ordine di lettura
      const y0 = -(righe.length - 1) * 1.15 * fs / 2;   // blocco di righe centrato sul punto
      return `${apri(e.rot ? ` rotate(${e.rot})` : '')}<text x="0" y="${y0}" font-size="${fs}" fill="${e.colore || '#1f5fbf'}" text-anchor="middle" dominant-baseline="middle">${righe.map((rr, q) => `<tspan x="0" dy="${q ? '1.15em' : 0}">${esc(rr)}</tspan>`).join('')}</text></g>`;
    }
    if (e.tipo === 'ingresso') {
      // la freccia gira, la scritta resta sempre dritta e leggibile, dalla parte della coda della freccia
      const r = ((+e.rot || 0) * Math.PI) / 180, d = u * 3.4;
      const tx = Math.sin(r) * d, ty = -Math.cos(r) * d;
      const anc = Math.abs(tx) < u * 0.8 ? 'middle' : tx > 0 ? 'start' : 'end';
      return `${apri()}<rect x="${-u * 1.6}" y="${-u * 2.8}" width="${u * 3.2}" height="${u * 4.6}" fill="#fff" fill-opacity="0" transform="rotate(${+e.rot || 0})"/>
        <g transform="rotate(${+e.rot || 0})"><path d="M0 ${-u * 2.4} L0 ${u * 0.6}" stroke="#2e9e5b" stroke-width="${u * 0.45}"/><path d="M${-u} ${-u * 0.2} L0 ${u * 1.4} L${u} ${-u * 0.2}z" fill="#2e9e5b"/></g>
        <text x="${tx}" y="${ty}" font-size="${u * 1.6}" font-weight="700" fill="#111" text-anchor="${anc}" dominant-baseline="middle">${t || 'INGRESSO'}</text></g>`;
    }
    // simboli: l'icona gira, la scritta sotto resta dritta
    return `${apri()}<g transform="rotate(${+e.rot || 0})"><circle r="${u * 1.6}" fill="#fff" stroke="#16324f" stroke-width="${u * 0.15}"/>
      <text x="0" y="${u * 0.1}" font-size="${u * 1.8}" text-anchor="middle" dominant-baseline="middle">${TIPI[e.tipo]?.ico || '📍'}</text></g>
      ${t ? `<text x="0" y="${u * 3.2}" font-size="${u * 1.2}" text-anchor="middle" fill="#111">${t}</text>` : ''}</g>`;
  }
  function impianto(L, i, p, u, opz) {
    const k = 'imp:' + i.id;
    const st = opz.stato ? opz.stato(i) : '';
    const col = st === 'fatto' ? '#2e9e5b' : st === 'dafare' ? '#e07a1f' : '#f2b705';
    const nome = esc(sigla(i));
    const fam = p.fam || famiglia(i);
    if (fam === 'rotaia') {
      // monorotaia / paranco su binario: una barra lunga «len», orizzontale o girata
      const len = +p.len || u * 14, t = u * 0.9, r = +p.rot || 0, vert = r % 180 === 90;
      return `<g class="lay-drag lay-imp${sel(opz, k)} st-${st}" data-k="${k}" transform="translate(${p.x} ${p.y})">
        <g transform="rotate(${r})"><rect x="${-len / 2 - u * 0.6}" y="${-u * 2.2}" width="${len + u * 1.2}" height="${u * 4.4}" fill="#fff" fill-opacity="0"/>
        <rect x="${-len / 2}" y="${-t / 2}" width="${len}" height="${t}" rx="${t / 3}" fill="${st ? col : '#dbe6f3'}" stroke="#1f3f66" stroke-width="${u * 0.18}"/></g>
        <text x="${vert ? u * 1.2 : 0}" y="${vert ? -len / 2 + u * 1.6 : -t - u * 0.5}" font-size="${u * 2 * Math.max(0.6, +L.scala || 1)}" text-anchor="${vert ? 'start' : 'middle'}" font-weight="700" fill="#111">${nome}</text></g>`;
    }
    if (fam !== 'carroponte') {
      const sc = +L.scala || 1, s = u * 1.6 * sc, k2 = Math.max(0.6, sc);
      const ico = fam === 'bandiera'
        ? `<path d="M${-s * 0.6} ${s} L${-s * 0.6} ${-s} L${s * 0.9} ${-s}" fill="none" stroke="#c99a00" stroke-width="${u * 0.35 * sc}"/>
        <path d="M${s * 0.6} ${-s} L${s * 0.6} ${-s * 0.3}" stroke="#111" stroke-width="${u * 0.12 * sc}"/>`
        : fam === 'pinza'
          ? `<path d="M0 ${-s} L0 ${-s * 0.4} M${-s * 0.7} ${-s * 0.4} L${s * 0.7} ${-s * 0.4} M${-s * 0.6} ${-s * 0.4} L${-s * 0.6} ${s * 0.8} L${-s * 0.2} ${s * 0.8} M${s * 0.6} ${-s * 0.4} L${s * 0.6} ${s * 0.8} L${s * 0.2} ${s * 0.8}" fill="none" stroke="#1f5fbf" stroke-width="${u * 0.3 * sc}" stroke-linejoin="round"/>`
          : `<circle r="${s * 0.85}" fill="none" stroke="#7a3fb0" stroke-width="${u * 0.25 * sc}" stroke-dasharray="${u * 0.35 * sc} ${u * 0.2 * sc}"/><circle r="${s * 0.2}" fill="#7a3fb0"/>`;
      return `<g class="lay-drag lay-imp${sel(opz, k)} st-${st}" data-k="${k}" transform="translate(${p.x} ${p.y})">
        <rect x="${-s * 1.6}" y="${-s * 1.6 - u * 2 * k2}" width="${s * 3.2}" height="${s * 3.2 + u * 2 * k2}" fill="#fff" fill-opacity="0"/>
        <g transform="rotate(${+p.rot || 0})"><rect x="${-s * 1.3}" y="${-s * 1.3}" width="${s * 2.6}" height="${s * 2.6}" rx="${u * 0.3 * sc}" fill="${st ? col : '#fff8e0'}" fill-opacity="${st ? 0.22 : 1}" stroke="${col}" stroke-width="${u * 0.15 * sc}"/>
        ${ico}</g>
        <text x="0" y="${-s * 1.3 - u * 0.4 * k2}" font-size="${u * 2 * k2}" text-anchor="middle" font-weight="700" fill="#111">${nome}</text></g>`;
    }
    // carroponte: trave che attraversa tutta la sua campata (anche nei capannoni con campate orizzontali)
    const cp = campataDi(L, p.x, p.y), h = u * 0.9;
    let cx = p.x, cy = p.y, mezza = u * 6, ruota = '';
    if (cp && cp.or === 'v') { cx = (cp.a + cp.b) / 2; mezza = (cp.b - cp.a) / 2 - u * 0.5; }
    if (cp && cp.or === 'o') { cy = (cp.a + cp.b) / 2; mezza = (cp.b - cp.a) / 2 - u * 0.5; ruota = ' rotate(90)'; }
    mezza = Math.max(mezza, u * 2);
    const etich = ruota
      ? `<text transform="rotate(-90)" x="${-h * 1.4}" y="${-mezza + u * 1.6}" font-size="${u * 2}" text-anchor="end" font-weight="700" fill="#111">${nome}</text>`
      : `<text x="${mezza}" y="${-h * 1.4}" font-size="${u * 2}" text-anchor="end" font-weight="700" fill="#111">${nome}</text>`;
    return `<g class="lay-drag lay-imp${sel(opz, k)} st-${st}" data-k="${k}" transform="translate(${cx} ${cy})${ruota}">
      <rect x="${-mezza - u * 0.4}" y="${-h * 3.4}" width="${mezza * 2 + u * 0.8}" height="${h * 5.4}" fill="#fff" fill-opacity="0"/>
      <rect x="${-mezza}" y="${-h / 2}" width="${mezza * 2}" height="${h}" fill="${col}" stroke="#111" stroke-width="${u * 0.1}"/>
      <rect x="${-mezza - u * 0.25}" y="${-h * 1.6}" width="${u * 0.6}" height="${h * 3.2}" fill="${col}" stroke="#111" stroke-width="${u * 0.1}"/>
      <rect x="${mezza - u * 0.35}" y="${-h * 1.6}" width="${u * 0.6}" height="${h * 3.2}" fill="${col}" stroke="#111" stroke-width="${u * 0.1}"/>
      ${etich}</g>`;
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
          : 'Per ogni sede si disegna una volta la pianta dall\'alto: uno o più capannoni con le loro campate, corridoi, corsie, reparti, ingressi e punti di riferimento; poi si mettono al loro posto gli impianti dell\'anagrafica. È solo un disegno: nessuna misura da inserire.')}</h1>
          ${ctr ? '<a class="btn ghost small" href="#/controlli">☰ Vista elenco</a>' : ''}</div>
        <input type="search" class="cerca" id="lCerca" placeholder="Cerca cliente o sede…" value="${esc(filtro.q)}">
        <div class="lista">
          ${righe.length ? righe.map(({ c, s }) => {
            const L = docDi(S, s.id), imp = S.impianti.filter((i) => i.sedeId === s.id && !i.dismesso);
            const messi = L ? (L.impianti || []).filter((p) => imp.some((i) => i.id === p.impId)).length : 0;
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
    const L = aggiorna(salvato ? JSON.parse(JSON.stringify(salvato)) : nuovo(sedeId, c.id));
    if (!(+L.u > 0)) L.u = Math.round(unitaCalcolata(L) * 1000) / 1000;   // da qui in poi testi e simboli hanno sempre la stessa grandezza
    const imp = IMP.ordinaSede(S, sedeId, S.impianti.filter((i) => i.sedeId === sedeId && !i.dismesso));
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
            <p class="muted small">${ctr ? (pr ? `<span class="pill st-${pr.k}">${esc(pr.label)}</span> · <span class="leg leg-ok">■</span> fatto <span class="leg leg-da">■</span> da fare` : '<span class="pill st-ok">Controlli dell\'anno completati</span>') : modifica ? 'Tocca un oggetto per sceglierlo, poi trascinalo · il quadratino blu ridimensiona' : `${imp.length} impianti`}</p></div>
          ${modifica ? '<button class="btn" id="btnFine">✓ Fine</button>' : ''}
          ${UI.menu([
            !modifica && puoModificare && { t: '✏️ Modifica layout', id: 'btnMod' },
            UT.puoInviare() && !modifica && salvato && { t: '🖨️ Stampa', id: 'btnStampa' },
            !modifica && puoModificare && { t: '📥 Carica layout da file', id: 'btnCarica' },
            !modifica && puoModificare && docDi(S, sedeId + COPIA) && { t: `↩ Rimetti il layout di prima (copia del ${UI.fmt(docDi(S, sedeId + COPIA).copiaDel || '')})`, id: 'btnRipristina' },
            ctr ? { t: '☰ Controlli: vista elenco', href: '#/controlli/s/' + sedeId } : { t: '✅ Controlli di questa sede', href: '#/layout/s/' + sedeId + '?ctr=1' },
            { t: '🏢 Anagrafica cliente', href: `#/clienti/${c.id}` }
          ])}
        </div>
        ${modifica ? `
        <div class="card lay-pal no-print">
          <div class="lay-pal-tit">Aggiungi ${UI.info('Componi la pianta come vuoi: anche più capannoni, girati o collegati da un corridoio. Non servono misure: trascina per spostare e usa il quadratino blu nell\'angolo per allargare o stringere. Toccando un capannone puoi cambiare il numero di campate e girarle.')}</div>
          <div class="lay-pal-voci">${Object.entries(TIPI).map(([k, t]) => `<button type="button" class="chip-s" data-add="${k}">${t.ico} ${t.nome}</button>`).join('')}<button type="button" class="chip-s chip-mappa" id="btnMappa">🛰️ Capannoni dalla mappa</button></div>
          <div class="lay-pal-tit">Impianti da posizionare ${UI.info('Solo gli impianti dell\'anagrafica di questa sede. I carriponte si allineano da soli alla campata in cui li metti.')}</div>
          <div class="lay-pal-voci" id="impFuori"></div>
        </div>` : ''}
        ${!salvato && !modifica ? `<div class="card vuoto-lay"><p>Per questa sede il layout non è ancora stato disegnato.</p>${puoModificare ? '<button class="btn" id="btnMod2">✏️ Disegna il layout</button>' : ''}</div>` : ''}
        ${(salvato || modifica) && imp.length ? `<div class="lay-barra no-print">
          ${(() => { const presenti = Object.keys(FAMIGLIE).filter((f) => imp.some((i) => famigliaIn(L, i) === f)); return presenti.length > 1 ? `<div class="lay-filtri"><button type="button" class="inv-chip ${filtroLay[sedeId] ? '' : 'on'}" data-fam="">Tutti</button>${presenti.map((f) => `<button type="button" class="inv-chip ${filtroLay[sedeId] === f ? 'on' : ''}" data-fam="${f}">${FAMIGLIE[f]} <small>${imp.filter((i) => famigliaIn(L, i) === f).length}</small></button>`).join('')}</div>` : ''; })()}
          ${imp.some((i) => famigliaIn(L, i) !== 'carroponte') ? `<div class="lay-scala"><span class="muted small">Simboli</span><button type="button" class="btn ghost small" data-scala="-1" aria-label="Più piccoli">A−</button><b id="scalaVal">${Math.round((+L.scala || 1) * 100)}%</b><button type="button" class="btn ghost small" data-scala="1" aria-label="Più grandi">A+</button></div>` : ''}
        </div>` : ''}
        <div class="lay-foglio" id="foglio" ${!salvato && !modifica ? 'hidden' : ''}>
          <div class="lay-stampa-testa"><b>${esc(CTR.nomeSede(c, s))}</b><span>LAYOUT IMPIANTI · ${UI.fmt(UI.oggi())}</span></div>
          <div id="svgBox"></div>
        </div>
        <div class="card lay-prop no-print" id="prop" hidden></div>
        ${!modifica && salvato && fuori().length ? `<div class="card no-print"><b>Non ancora nel layout:</b> <span class="lay-fuori">${fuori().map((i) => ctr
          ? `<a class="chip-s ${fatto(i) ? 'on-ok' : ''}" href="${apri(i)}">${esc(sigla(i))}</a>` : `<span class="chip-s">${esc(sigla(i))}</span>`).join('')}</span></div>` : ''}
      </section>`;

    const box = el.querySelector('#svgBox');
    const ridisegna = () => {
      box.innerHTML = (salvato || modifica) ? disegna(S, L, { modifica, stato, scelto, filtro: filtroLay[sedeId] || '' }) : '';
      if (modifica) { disegnaPal(); collegaTrascina(); }
      else collegaTocchi();
    };

    el.querySelectorAll('[data-fam]').forEach((b) => (b.onclick = () => {
      filtroLay[sedeId] = b.dataset.fam; el.querySelectorAll('[data-fam]').forEach((x) => x.classList.toggle('on', x === b)); ridisegna();
    }));
    el.querySelectorAll('[data-scala]').forEach((b) => (b.onclick = async () => {
      const ora = SCALE.indexOf(+L.scala || 1), k = Math.min(SCALE.length - 1, Math.max(0, (ora < 0 ? 0 : ora) - +b.dataset.scala));
      L.scala = SCALE[k]; el.querySelector('#scalaVal').textContent = Math.round(L.scala * 100) + '%'; ridisegna();
      if (puoModificare && salvato && !modifica) { try { await UI.salva('layouts', L); } catch (e) {} } else if (modifica) salva();
    }));
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
    const salva = () => { clearTimeout(timer); timer = setTimeout(async () => { try { await UI.salva('layouts', L); } catch (e) { /* già segnalato */ } }, 700); };
    const centro = () => {
      const cs = capannoni(L);
      if (!cs.length) return { x: 50, y: 35 };
      const c0 = cs[0]; return { x: c0.x + c0.w / 2, y: c0.y + c0.h / 2 };
    };
    function disegnaPal() {
      el.querySelector('#impFuori').innerHTML = fuori().map((i) => `<button type="button" class="chip-s chip-imp" data-addimp="${i.id}">${({ bandiera: '🏗️', pinza: '🗜️', seghetto: '🪚' })[famiglia(i)] || '═'} ${esc(sigla(i))}</button>`).join('') || '<span class="muted small">Tutti gli impianti sono nel layout ✓</span>';
      el.querySelectorAll('[data-addimp]').forEach((b) => (b.onclick = () => {
        // un posto libero: una campata dopo l'altra del primo capannone, scendendo
        const c0 = capannoni(L)[0], k = L.impianti.length;
        let x = centro().x, y = centro().y;
        if (c0) {
          const nn = Math.max(1, +c0.n || 1), cc = k % nn, riga = Math.floor(k / nn);
          if (c0.or === 'o') { y = c0.y + (cc + 0.5) * c0.h / nn; x = c0.x + Math.min(c0.w - 3, (riga + 1) * c0.w / 8); }
          else { x = c0.x + (cc + 0.5) * c0.w / nn; y = c0.y + Math.min(c0.h - 3, (riga + 1) * c0.h / 8); }
        }
        L.impianti.push({ impId: b.dataset.addimp, x, y });
        scelto = 'imp:' + b.dataset.addimp; ridisegna(); proprieta(); salva();
      }));
    }
    function collegaModifica() {
      el.querySelectorAll('[data-add]').forEach((b) => (b.onclick = () => {
        const t = b.dataset.add, u = unita(L), ce = centro(), sfasa = (L.elementi.length % 6) * u * 3;
        const e = { id: uid(), tipo: t, x: ce.x - u * 8 + sfasa, y: ce.y - u * 6 + sfasa, testo: t === 'testo' ? 'REPARTO' : t === 'uffici' ? 'UFFICI' : t === 'ingresso' ? 'INGRESSO' : '' };
        if (t === 'testo') { const cp = campataDi(L, ce.x, ce.y); if (cp && cp.or === 'v') e.x = (cp.a + cp.b) / 2; else if (cp) { e.x = cp.c.x + cp.c.w / 2; e.y = (cp.a + cp.b) / 2; } }   // al centro della campata: c'è tutto lo spazio
        if (t === 'capannone') { const cs = capannoni(L), ult = cs[cs.length - 1]; Object.assign(e, { x: ult ? ult.x : 0, y: ult ? ult.y + ult.h + u * 8 : 0, w: ult ? ult.w : 100, h: ult ? ult.h : 70, n: ult ? ult.n : 4, or: ult?.or || 'v' }); }
        if (t === 'corridoio') Object.assign(e, { w: u * 8, h: u * 20 });
        if (t === 'corsia') { const c0 = capannoni(L)[0]; Object.assign(e, c0 ? { x: c0.x, y: c0.y + c0.h / 2 - u * 1.5, w: c0.w, h: u * 3 } : { w: u * 40, h: u * 3 }); }
        if (t === 'zona' || t === 'uffici') Object.assign(e, { w: u * 16, h: u * 10 });
        L.elementi.push(e); scelto = 'el:' + e.id; ridisegna(); proprieta(); salva();
        el.querySelector('#foglio').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }));
      // capannoni presi da OpenStreetMap con le misure vere
      el.querySelector('#btnMappa').onclick = () => LAYMAP.apri(CLI.indirizzo ? CLI.indirizzo(s) : '', async (rett) => {
        if (!rett.length) return;
        if (salvato) { try { await UI.salva('layouts', copiaDiSicurezza(S, sedeId, salvato)); } catch (e) {} }
        // layout ancora "vuoto" (solo il capannone di partenza): lo sostituisco; altrimenti li metto sotto al disegno
        const vuoto = !L.impianti.length && L.elementi.length === 1 && L.elementi[0].tipo === 'capannone' && L.elementi[0].w === 100 && L.elementi[0].h === 70;
        let dy = 0, dx = 0;
        if (vuoto) L.elementi = [];
        else { const b = L.elementi.map((e) => e.y + (+e.h || 0)); dy = Math.max(0, ...b) + unita(L) * 10; dx = Math.min(...L.elementi.map((e) => e.x), 0); }
        rett.forEach((r) => L.elementi.push({ id: uid(), tipo: 'capannone', x: r.x + dx, y: r.y + dy, w: r.w, h: r.h, n: Math.max(1, Math.round(Math.min(r.w, r.h) / 25)), or: r.w >= r.h ? 'o' : 'v', testo: (r.nome || '').toUpperCase() }));
        if (vuoto) L.u = Math.round(unitaCalcolata(L) * 1000) / 1000;
        scelto = null; ridisegna(); proprieta(); salva();
        UI.toast(`✓ ${rett.length} ${rett.length === 1 ? 'capannone aggiunto' : 'capannoni aggiunti'} con le misure vere · campate da controllare`, 'ok');
      });
      el.querySelector('#btnFine').onclick = () => { clearTimeout(timer); UI.salva('layouts', L).finally(() => { delete inModifica[sedeId]; App.ridisegna(); }); };
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
          ${i ? `<label class="lay-sim">Simbolo<select id="pSimbolo">${Object.keys(FAMIGLIE).map((k) => `<option value="${k}" ${famigliaIn(L, i) === k ? 'selected' : ''}>${NOME_SIMBOLO[k]}${k === famiglia(i) ? ' (dalla tipologia)' : ''}</option>`).join('')}</select></label>` : ''}
          ${i && famigliaIn(L, i) !== 'carroponte' ? '<button type="button" class="btn ghost small" id="pRuotaImp">↻ Ruota</button>' : ''}
          ${i && famigliaIn(L, i) === 'rotaia' ? '<button type="button" class="btn ghost small" id="pCorta" aria-label="Più corta">− corta</button><button type="button" class="btn ghost small" id="pLunga" aria-label="Più lunga">+ lunga</button>' : ''}
          <button type="button" class="btn ghost small danger" id="pTogli">Togli dal layout</button><button type="button" class="btn ghost small" id="pChiudi">Fatto</button></div>`;
        p.querySelector('#pSimbolo')?.addEventListener('change', (e) => {
          const q = L.impianti.find((x) => x.impId === id); if (!q) return;
          if (e.target.value === famiglia(i)) delete q.fam; else q.fam = e.target.value;
          ridisegna(); proprieta(); salva();
        });
        p.querySelector('#pRuotaImp')?.addEventListener('click', () => { const q = L.impianti.find((x) => x.impId === id); q.rot = ((+q.rot || 0) + (famigliaIn(L, i) === 'rotaia' ? 90 : 45)) % 360; ridisegna(); salva(); });
        const lungh = (f) => { const q = L.impianti.find((x) => x.impId === id); q.len = Math.round(Math.max(unita(L) * 3, (+q.len || unita(L) * 14) * f) * 10) / 10; ridisegna(); salva(); };
        p.querySelector('#pCorta')?.addEventListener('click', () => lungh(1 / 1.2));
        p.querySelector('#pLunga')?.addEventListener('click', () => lungh(1.2));
        p.querySelector('#pTogli').onclick = () => { L.impianti = L.impianti.filter((x) => x.impId !== id); scelto = null; ridisegna(); proprieta(); salva(); };
      } else {
        const e = L.elementi.find((x) => x.id === id); if (!e) { p.hidden = true; return; }
        const ruota = true, conTesto = e.tipo !== 'corsia';
        p.innerHTML = `<div class="lay-prop-riga"><b>${TIPI[e.tipo]?.ico || ''} ${esc(TIPI[e.tipo]?.nome || '')}</b><span class="grow"></span>
            <button type="button" class="btn ghost small" id="pDup">⧉ Duplica</button>
            <button type="button" class="btn ghost small danger" id="pTogli">Elimina</button><button type="button" class="btn ghost small" id="pChiudi">Fatto</button></div>
          <div class="lay-prop-campi">
            ${conTesto ? `<label>${e.tipo === 'capannone' ? 'Nome (facoltativo)' : 'Testo'}<input id="pTesto" value="${esc(e.testo || '')}" autocomplete="off"></label>` : ''}
            ${e.tipo === 'capannone' ? `<div class="lay-campate"><span>Campate</span><button type="button" class="btn ghost small" id="pMeno">−</button><b>${e.n}</b><button type="button" class="btn ghost small" id="pPiu">+</button></div>
              <button type="button" class="btn ghost small" id="pGira">${e.or === 'o' ? '⇆ Campate verticali' : '⇅ Campate orizzontali'}</button>` : ''}
            ${e.tipo === 'testo' ? `<div class="lay-campate"><span>Grandezza</span><button type="button" class="btn ghost small" id="pAmeno" aria-label="Più piccola">A−</button><b>${Math.round((+e.s || 1) * 100)}%</b><button type="button" class="btn ghost small" id="pApiu" aria-label="Più grande">A+</button></div>` : ''}
            ${ruota ? '<button type="button" class="btn ghost small" id="pRuota">↻ Ruota</button>' : ''}
            ${e.tipo === 'testo' ? `<span class="lay-colori">${['#1f5fbf', '#2e9e5b', '#d6453d', '#111111'].map((cc) => `<button type="button" class="lay-col" data-col="${cc}" style="background:${cc}" aria-label="colore"></button>`).join('')}</span>` : ''}
          </div>`;
        p.querySelector('#pTesto')?.addEventListener('input', (ev) => { e.testo = ev.target.value.toUpperCase(); ridisegna(); salva(); });
        p.querySelector('#pMeno')?.addEventListener('click', () => { e.n = Math.max(1, (+e.n || 1) - 1); ridisegna(); proprieta(); salva(); });
        p.querySelector('#pPiu')?.addEventListener('click', () => { e.n = Math.min(30, (+e.n || 1) + 1); ridisegna(); proprieta(); salva(); });
        p.querySelector('#pGira')?.addEventListener('click', () => { e.or = e.or === 'o' ? 'v' : 'o'; ridisegna(); proprieta(); salva(); });
        const grand = (f) => { e.s = Math.round(Math.min(4, Math.max(0.3, (+e.s || 1) * f)) * 100) / 100; ridisegna(); proprieta(); salva(); };
        p.querySelector('#pAmeno')?.addEventListener('click', () => grand(1 / 1.2));
        p.querySelector('#pApiu')?.addEventListener('click', () => grand(1.2));
        p.querySelector('#pRuota')?.addEventListener('click', () => {
          if (e.tipo === 'capannone') {
            // il capannone gira di 90° attorno al suo centro e si porta dietro tutto quello che ha dentro
            const cx = e.x + e.w / 2, cy = e.y + e.h / 2, gira = (q) => { const dx = q.x - cx, dy = q.y - cy; q.x = Math.round((cx - dy) * 10) / 10; q.y = Math.round((cy + dx) * 10) / 10; };
            const dentroEl = L.elementi.filter((q) => q !== e && q.tipo !== 'capannone' && dentro(e, q.x + (+q.w || 0) / 2, q.y + (+q.h || 0) / 2));
            const dentroImp = L.impianti.filter((q) => dentro(e, q.x, q.y));
            dentroEl.forEach((q) => {
              if (RIDIM.includes(q.tipo)) { const c = { x: q.x + q.w / 2, y: q.y + q.h / 2 }; gira(c); [q.w, q.h] = [q.h, q.w]; q.x = c.x - q.w / 2; q.y = c.y - q.h / 2; }
              else { gira(q); if (q.tipo === 'testo' || q.tipo === 'ingresso') q.rot = ((+q.rot || 0) + 90) % 360; }
            });
            dentroImp.forEach(gira);
            [e.w, e.h] = [e.h, e.w]; e.x = cx - e.w / 2; e.y = cy - e.h / 2; e.or = e.or === 'o' ? 'v' : 'o';
          } else if (RIDIM.includes(e.tipo)) { const cx = e.x + e.w / 2, cy = e.y + e.h / 2; [e.w, e.h] = [e.h, e.w]; e.x = cx - e.w / 2; e.y = cy - e.h / 2; }
          else e.rot = ((+e.rot || 0) + (e.tipo === 'testo' ? 90 : 45)) % 360;   // scritte di 90°, frecce e simboli di 45°
          ridisegna(); salva();
        });
        p.querySelectorAll('[data-col]').forEach((b) => (b.onclick = () => { e.colore = b.dataset.col; ridisegna(); salva(); }));
        p.querySelector('#pDup').onclick = () => { const u = unita(L), d = { ...e, id: uid(), x: e.x + u * 4, y: e.y + u * 4 }; L.elementi.push(d); scelto = 'el:' + d.id; ridisegna(); proprieta(); salva(); };
        p.querySelector('#pTogli').onclick = () => { L.elementi = L.elementi.filter((x) => x.id !== id); scelto = null; ridisegna(); proprieta(); salva(); };
      }
      p.querySelector('#pChiudi').onclick = () => { scelto = null; ridisegna(); proprieta(); };
    }
    // trascinamento e ridimensionamento (mouse e dito): gli eventi li segue l'SVG, che non viene ridisegnato durante il gesto
    function collegaTrascina() {
      const svg = box.querySelector('svg');
      const punto = (ev) => { const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
      const u = unita(L);
      const gDi = (k) => svg.querySelector(`[data-k="${k}"]`);
      const rifai = (k) => {   // ridisegna un solo oggetto al suo posto
        const g = gDi(k); if (!g) return;
        const [tipo, id] = k.split(':'), opz = { modifica: true, scelto: k === scelto ? k : null, L };
        const html = tipo === 'imp' ? impianto(L, imp.find((x) => x.id === id), L.impianti.find((x) => x.impId === id), u, opz) : elemento(L.elementi.find((x) => x.id === id), u, opz);
        const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'g'); tmp.innerHTML = html;
        const ng = tmp.firstElementChild; g.setAttribute('transform', ng.getAttribute('transform')); g.innerHTML = ng.innerHTML;
      };
      // col dito: il primo tocco SCEGLIE l'oggetto (e la pagina si può scorrere liberamente);
      // si sposta solo trascinando un oggetto già scelto, così scorrendo non si sposta niente per sbaglio
      let trascino = false;
      svg.addEventListener('touchmove', (tv) => { if (trascino && tv.cancelable) tv.preventDefault(); }, { passive: false });
      svg.addEventListener('pointerdown', (ev) => {
        const h = ev.target.closest('[data-resize]'), g = ev.target.closest('.lay-drag');
        const dito = ev.pointerType === 'touch' || ev.pointerType === 'pen';
        if (!g && !h) {
          if (!scelto) return;
          if (!dito) { scelto = null; ridisegna(); proprieta(); return; }
          // col dito tolgo la scelta solo con un tocco secco (non scorrendo)
          const t0 = { x: ev.clientX, y: ev.clientY };
          const fine = (e2) => { svg.removeEventListener('pointerup', fine); if (Math.hypot(e2.clientX - t0.x, e2.clientY - t0.y) < 8) { scelto = null; ridisegna(); proprieta(); } };
          svg.addEventListener('pointerup', fine, { once: true }); return;
        }
        const k = g.dataset.k, [tipo, id] = k.split(':');
        if (dito && !h && k !== scelto) {
          const t0 = { x: ev.clientX, y: ev.clientY };
          const fine = (e2) => { if (e2.type === 'pointerup' && Math.hypot(e2.clientX - t0.x, e2.clientY - t0.y) < 10) { scelto = k; ridisegna(); proprieta(); } };
          svg.addEventListener('pointerup', fine, { once: true }); svg.addEventListener('pointercancel', fine, { once: true });
          return;
        }
        ev.preventDefault(); trascino = true;
        const o = tipo === 'imp' ? L.impianti.find((x) => x.impId === id) : L.elementi.find((x) => x.id === id);
        if (!o) return;
        const p0 = punto(ev), soglia = u * 0.4;
        const x0 = o.x, y0 = o.y, w0 = +o.w || 0, h0 = +o.h || 0;
        // spostando un capannone si porta dietro quello che ci sta dentro
        const seguono = o.tipo === 'capannone' && !h
          ? [...L.impianti.filter((q) => dentro(o, q.x, q.y)).map((q) => ['imp:' + q.impId, q]), ...L.elementi.filter((q) => q !== o && q.tipo !== 'capannone' && dentro(o, q.x, q.y)).map((q) => ['el:' + q.id, q])]
              .map(([kk, q]) => [kk, q, q.x, q.y]) : [];
        let mosso = false;
        svg.setPointerCapture(ev.pointerId);
        const muovi = (e2) => {
          const p1 = punto(e2), dx = p1.x - p0.x, dy = p1.y - p0.y;
          if (!mosso && Math.hypot(dx, dy) < soglia) return;
          mosso = true;
          const r = (v) => Math.round(v * 10) / 10;
          if (h) { o.w = r(Math.max(u * 3, w0 + dx)); o.h = r(Math.max(u * 1.5, h0 + dy)); }
          else { o.x = r(x0 + dx); o.y = r(y0 + dy); seguono.forEach(([kk, q, qx, qy]) => { q.x = r(qx + dx); q.y = r(qy + dy); rifai(kk); }); }
          rifai(k);
          if (o.tipo === 'capannone') L.impianti.forEach((q) => rifai('imp:' + q.impId));   // le travi seguono le campate
        };
        const su = () => {
          trascino = false;
          svg.removeEventListener('pointermove', muovi); svg.removeEventListener('pointerup', su); svg.removeEventListener('pointercancel', su);
          scelto = k; ridisegna(); proprieta(); if (mosso) salva();
        };
        svg.addEventListener('pointermove', muovi); svg.addEventListener('pointerup', su); svg.addEventListener('pointercancel', su);
      });
    }

    el.querySelector('#btnCarica')?.addEventListener('click', () => caricaDaFile(S, sedeId));
    el.querySelector('#btnRipristina')?.addEventListener('click', async () => {
      const cp = docDi(S, sedeId + COPIA);
      if (!UI.conferma(`Rimettere il layout com'era il ${UI.fmt(cp.copiaDel || '')}?\n\nIl layout di adesso diventa la nuova copia: puoi sempre tornare indietro.`)) return;
      const ora = salvato ? JSON.parse(JSON.stringify(salvato)) : null;
      const vecchio = JSON.parse(JSON.stringify(cp)); delete vecchio.copiaDi; delete vecchio.copiaDel; vecchio.id = sedeId; vecchio.sedeId = sedeId;
      // la versione rimessa "discende" da quella di adesso: è una modifica fatta qui, non un conflitto
      vecchio._rev = salvato?._rev; vecchio._storia = salvato?._storia || [];
      await UI.salva('layouts', vecchio);
      if (ora) await UI.salva('layouts', copiaDiSicurezza(S, sedeId, ora));
      UI.toast('Layout di prima rimesso', 'ok');
    });
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

  // ---------- layout da file (preparato da un PDF / disegno esistente) ----------
  // Il file contiene capannoni, corsie, zone e la posizione di ogni impianto indicato con la sua sigla (es. GB17, SF6, CP16).
  // Prima di toccare il layout ne salvo una copia (id sede + COPIA), che si rimette dal menu.
  const COPIA = '~copia';
  // copia del layout di adesso (quella vecchia viene sostituita, continuando la sua storia)
  const copiaDiSicurezza = (S, sedeId, L) => {
    const c = { ...JSON.parse(JSON.stringify(L)), id: sedeId + COPIA, copiaDi: sedeId, copiaDel: UI.oggi(), sedeId: '' }, prima = docDi(S, sedeId + COPIA);
    c._rev = prima?._rev; c._storia = prima?._storia || []; return c;
  };
  const normSigla = (t) => String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const cifre = (t) => (String(t || '').match(/\d+/g) || []).join('/');
  function abbina(imp, voci) {
    const usati = new Set(), out = [], mancano = [];
    // 1) stessa sigla (GB17 = GB 17 = gb-17)  2) stesso numero (17 = GB17) se non è ambiguo
    const trova = (v) => {
      const n = normSigla(v.sigla), d = cifre(v.sigla);
      let i = imp.find((x) => !usati.has(x.id) && normSigla(x.numeroInterno) === n);
      if (!i && d) { const cand = imp.filter((x) => !usati.has(x.id) && cifre(x.numeroInterno) === d); if (cand.length === 1) i = cand[0]; }
      return i;
    };
    voci.forEach((v) => { const i = trova(v); if (i) { usati.add(i.id); out.push({ v, i }); } else mancano.push(v.sigla); });
    return { out, mancano };
  }
  const bbox = (els) => { const cs = els.filter((e) => e.tipo === 'capannone'); if (!cs.length) return null;
    const x0 = Math.min(...cs.map((c) => c.x)), y0 = Math.min(...cs.map((c) => c.y));
    return { x: x0, y: y0, w: Math.max(...cs.map((c) => c.x + c.w)) - x0, h: Math.max(...cs.map((c) => c.y + c.h)) - y0 }; };
  function caricaDaFile(S, sedeId) {
    // nessun filtro sul tipo: telefoni e tablet spesso non riconoscono i .json e li mostrano grigi
    const inp = document.createElement('input'); inp.type = 'file'; inp.hidden = true; document.body.appendChild(inp);
    inp.onchange = async () => {
      const f = inp.files[0]; inp.remove(); if (!f) return;
      let D; try { D = JSON.parse(await f.text()); } catch (e) { return UI.toast('File non leggibile: deve essere il file .json del layout', 'err'); }
      if (D.formato !== 'gid-layout' || !Array.isArray(D.impianti)) return UI.toast('Questo file non è un layout', 'err');
      applica(S, sedeId, D);
    };
    inp.click();
  }
  // mostra cosa ha trovato e carica il layout D nella sede (anche dalla pagina «Importa»)
  function applica(S, sedeId, D, dopo) {
    const { c: cli } = CTR.trovaSede(S, sedeId);
    const salvato = docDi(S, sedeId);
    const L = aggiorna(salvato ? JSON.parse(JSON.stringify(salvato)) : nuovo(sedeId, cli?.id));
    const imp = S.impianti.filter((i) => i.sedeId === sedeId && !i.dismesso);
    {
      const { out, mancano } = abbina(imp, D.impianti);
      const haDisegno = !!(salvato && bbox(L.elementi));
      UI.modal({
        titolo: 'Carica layout' + (D.titolo ? ' · ' + D.titolo : ''), testoSalva: 'Carica',
        infoTxt: 'Prima di cambiare qualcosa salvo una copia del layout di adesso: se il risultato non ti piace, nel menu ⋯ trovi «↩ Rimetti il layout di prima».',
        valori: { modo: haDisegno ? 'Metto solo le gru nel mio disegno' : 'Sostituisco tutto con il disegno del file' },
        campi: [
          { tipo: 'titolo', label: `Trovati ${out.length} impianti su ${D.impianti.length}` },
          ...(mancano.length ? [{ tipo: 'titolo', label: 'Non trovati in anagrafica (restano fuori): ' + mancano.join(', ') }] : []),
          { k: 'modo', label: 'Cosa faccio?', tipo: 'select', opzioni: haDisegno ? ['Metto solo le gru nel mio disegno', 'Sostituisco tutto con il disegno del file'] : ['Sostituisco tutto con il disegno del file'] }
        ],
        onSalva: async (v) => {
          const soloGru = /solo le gru/.test(v.modo || '');
          if (salvato) await UI.salva('layouts', copiaDiSicurezza(S, sedeId, salvato));
          const N = JSON.parse(JSON.stringify(salvato || nuovo(sedeId, cli.id)));
          aggiorna(N);
          let mappa = (x, y) => [x, y], k = 1;
          if (soloGru) {
            // le posizioni del file vengono "stirate" sui capannoni che hai disegnato tu
            const a = bbox(N.elementi), b = bbox(D.elementi || []) || { x: 0, y: 0, w: 1, h: 1 };
            mappa = (x, y) => [a.x + (x - b.x) * a.w / b.w, a.y + (y - b.y) * a.h / b.h]; k = Math.min(a.w / b.w, a.h / b.h);
          } else {
            N.elementi = (D.elementi || []).map((e) => ({ ...e, id: uid() }));
            if (D.u) N.u = D.u; if (D.scala) N.scala = D.scala;
          }
          const r = (q) => Math.round(q * 10) / 10;
          out.forEach(({ v, i }) => {
            const [x, y] = mappa(v.x, v.y);
            const pos = { impId: i.id, x: r(x), y: r(y), ...(v.fam ? { fam: v.fam } : {}), ...(v.rot ? { rot: v.rot } : {}), ...(v.len ? { len: r(v.len * k) } : {}) };
            const q = N.impianti.findIndex((p) => p.impId === i.id);
            if (q >= 0) N.impianti[q] = pos; else N.impianti.push(pos);
          });
          await UI.salva('layouts', N);
          UI.toast(`✓ Layout caricato: ${out.length} impianti al loro posto${mancano.length ? ` · ${mancano.length} non trovati` : ''}`, 'ok');
          if (dopo) dopo();
        }
      });
    }
  }

  function route(el, S, parti, query) {
    const ctr = query.get('ctr') === '1';
    if (parti[1] === 's' && parti[2]) return pianta(el, S, parti[2], ctr);
    return elenco(el, S, ctr);
  }
  return { route, disegna, applica };
})();
