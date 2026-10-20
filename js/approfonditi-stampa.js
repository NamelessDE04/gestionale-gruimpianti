// ===== STAMPA DEI CONTROLLI APPROFONDITI =====
// Ogni foglio è il modulo originale (sfondo in approfonditi-modelli.js, misure in mm prese dal PDF)
// con sopra i dati del controllo. Ogni dato ha la sua casella: se è lungo il testo si rimpicciolisce
// (o va su due righe) ma non esce mai dai bordi.
window.APS = (function () {
  const { esc } = UI;
  const n2 = (x) => Math.round(x * 100) / 100;

  // casella di testo: x0,y0 → x1,y1 in mm
  function V(x0, y0, x1, y1, txt, o = {}) {
    if (txt == null || String(txt).trim() === '') return '';
    const st = `left:${n2(x0)}mm;top:${n2(y0)}mm;width:${n2(x1 - x0)}mm;height:${n2(y1 - y0)}mm;--fs:${o.pt || 8}pt${o.col ? ';color:' + o.col : ''}${o.st || ''}`;
    return `<div class="ap-v${o.c ? ' c' : ''}${o.basso ? ' basso' : ''}${o.cls ? ' ' + o.cls : ''}" data-adatta="${o.min || 0.4}"${o.righe ? ' data-righe="2"' : ''}${o.blocco ? ' data-blocco' : ''} style="${st}">${esc(String(txt))}</div>`;
  }
  const IMG = (x0, y0, x1, y1, src, cls = '') => (src ? `<img class="ap-img ${cls}" src="${src}" alt="" style="left:${n2(x0)}mm;top:${n2(y0)}mm;width:${n2(x1 - x0)}mm;height:${n2(y1 - y0)}mm">` : '');
  // firma ruotata dentro la colonna FIRMA (come sul modulo cartaceo)
  const FIRMA_V = (x0, y0, x1, y1, src) => {
    if (!src) return '';
    const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return `<div class="ap-rot" style="left:${n2(cx - h / 2)}mm;top:${n2(cy - w / 2)}mm;width:${n2(h)}mm;height:${n2(w)}mm"><img src="${src}" alt=""></div>`;
  };
  const LOGO = (b) => `<img class="ap-logo" src="img/logo-grande.png" alt="" style="left:${b[0]}mm;top:${b[1]}mm;width:${n2(b[2] - b[0])}mm;height:${n2(b[3] - b[1])}mm">`;
  const pagina = (svg, dentro) => `<div class="foglio-p ap-f">${svg}${dentro}</div>`;
  const dataIt = (s) => (s ? s.split('-').reverse().map((x, i) => (i < 2 ? String(+x) : x)).join('/') : '');
  const dataLunga = (s) => (s ? s.split('-').reverse().join('/') : '');

  // ---------------- PINZE / GANCI A C e MAGNETI (foglio annuale a 4 colonne) ----------------
  // geometria dei due moduli
  const G = {
    pinza: {
      logo: [21.65, 31.34, 45.12, 43.14],
      cliente: [132.4, 29.75, 188.4, 35.0, 10],
      campi: { casa: [42, 47.2, 143.2, 55.3, 14.9], nInterno: [143.6, 47.2, 188.4, 55.3, 12], portata: [42, 58, 75.5, 66.1, 10], nFabbrica: [75.9, 58, 132, 66.1, 10],
        matricola: [132.3, 58, 188.4, 66.1, 10], tipoDesc: [42, 69, 143.2, 76.9, 10], anno: [143.6, 69, 165.8, 76.9, 10], classe: [166.2, 69, 188.4, 76.9, 10] },
      blocchi: [53.2, 87.06, 120.94, 154.81], largC: 11.29, fineBlocco: 33.87,
      data: [79.4, 87.6, 8.8], dataDopoColore: 0,
      righe: [98.74, 109.42, 120.2, 130.99, 141.77, 152.55], compX: [19.5, 52.9], compPt: 7.4, scad: null,
      oss: { y: [171.05, 176.14, 181.34, 186.54, 191.74, 196.94, 202.14, 207.34, 212.55, 217.75, 222.95], nX: [19.4, 30.5], tX: [30.7, 188.4], pt: 8.8 },
      codPt: 12.4
    },
    magnete: {
      logo: [28.53, 31.08, 47.13, 43.56],
      cliente: [126.7, 32.8, 175.7, 37.85, 8],
      intest: [57.6, 29.2, 131.5, 32.6, 5.8],
      campi: { casa: [47.8, 48.7, 136.3, 56.4, 8], nInterno: [136.5, 48.7, 175.7, 56.4, 8], portata: [47.8, 58.6, 77.1, 66.2, 8], nFabbrica: [77.3, 58.6, 126.4, 66.2, 8],
        matricola: [126.6, 58.6, 175.7, 66.2, 8], tipoDesc: [47.8, 68.5, 126.4, 76.1, 8], anno: [126.6, 68.5, 156, 76.1, 8], classe: [156.2, 68.5, 175.7, 76.1, 8] },
      blocchi: [57.4, 87.0, 116.6, 146.2], largC: 9.88, fineBlocco: 29.6,
      data: [78.3, 85.9, 6.8], dataDopoColore: 9.88,
      righe: [95.9, 105.77, 115.63, 125.5, 135.36, 145.23, 155.1], compX: [27.9, 57.3], compPt: 5.8, scad: [18.3, 27.7],
      oss: { y: [172.3, 177.1, 181.9, 186.7, 191.5, 196.3, 201.0, 205.8, 210.6, 215.4, 220.2], nX: [27.9, 37.6], tX: [37.8, 175.7], pt: 7 },
      codPt: 9.1
    }
  };

  // righe delle osservazioni dell'anno (numerate come nella colonna C)
  function righeOss(ctrl) {
    const out = [];
    ctrl.filter(Boolean).forEach((c) => {
      (c.righe || []).forEach((r) => { if (r.c === 'N' && r.n) out.push({ n: r.n, t: r.oss || '' }); });
      (c.note || '').split('\n').map((t) => t.trim()).filter(Boolean).forEach((t) => out.push({ n: '', t }));
      if (c.fuoriServizio) out.push({ n: '', t: `${dataIt(c.data)} - FUORI SERVIZIO`, rosso: true });
    });
    // al massimo 10 righe sul modulo: se sono di più le unisco a coppie (mai fuori dalle caselle)
    while (out.length > 10) {
      const i = out.findIndex((x, k) => k < out.length - 1 && !x.n && !out[k + 1].n && !x.rosso && !out[k + 1].rosso);
      if (i < 0) { const u = out.splice(9); out.push({ n: '', t: u.map((x) => (x.n ? x.n + ') ' : '') + x.t).join(' · '), rosso: u.some((x) => x.rosso) }); break; }
      out.splice(i, 2, { n: '', t: out[i].t + ' · ' + out[i + 1].t });
    }
    return out;
  }

  function foglioAttrezzo(S, a, anno) {
    const g = G[a.tipo], cli = SG.cliente(S, a.sedeId);
    const ctrl = APR.controlliAnno(S, a.id, anno);   // [slot1..slot4] (o null)
    const comp = APR.componenti(a);
    let h = LOGO(g.logo);
    if (cli) {
      const nome = CLI.nomeAl(cli.anagrafica, ctrl.filter(Boolean).pop()?.data || `${anno}-12-31`, cli.sede);
      h += V(g.cliente[0], g.cliente[1], g.cliente[2], g.cliente[3], nome, { c: 1, pt: g.cliente[4] });
      if (g.intest) h += V(g.intest[0], g.intest[1], g.intest[2], g.intest[3], `schede controllo ${nome} sottogancio`, { pt: g.intest[4] });
    }
    for (const [k, b] of Object.entries(g.campi)) h += V(b[0], b[1], b[2], b[3], a[k], { c: 1, pt: b[4] });
    const y0 = g.righe[0], y1 = g.righe[comp.length] ?? g.righe[g.righe.length - 1], yFine = g.righe[g.righe.length - 1];
    comp.forEach((cp, i) => {
      const ya = g.righe[i], yb = g.righe[i + 1];
      h += V(g.compX[0], ya, g.compX[1], yb, cp.t, { c: a.tipo === 'magnete', pt: g.compPt, righe: 1, min: 0.5 });
      if (g.scad) h += V(g.scad[0], ya, g.scad[1], yb, cp.sc === 'A' ? 'Ann' : 'Trim', { c: 1, pt: g.compPt });
    });
    g.blocchi.forEach((x, si) => {
      const c = ctrl[si]; if (!c) return;
      h += V(x + g.dataDopoColore + 0.3, g.data[0], x + g.fineBlocco - 0.3, g.data[1], dataIt(c.data), { c: 1, pt: g.data[2] });
      comp.forEach((_, i) => {
        const r = (c.righe || [])[i] || {}, ya = g.righe[i], yb = g.righe[i + 1];
        const cod = r.c === 'N' ? String(r.n || '') : (r.c || '');
        const blu = r.c === 'X' && a.tipo === 'magnete';
        h += V(x + 0.2, ya, x + g.largC - 0.2, yb, cod, { c: 1, pt: g.codPt, col: blu ? '#0070c0' : '' , min: 0.5 });
        h += V(x + g.largC + 0.2, ya, x + 2 * g.largC - 0.2, yb, r.rs, { c: 1, pt: g.codPt * 0.8, min: 0.5 });
      });
      h += FIRMA_V(x + 2 * g.largC + 0.4, y0 + 0.6, x + g.fineBlocco - 0.4, yFine - 0.6, c.firmaTecnico);
    });
    void y1;
    righeOss(ctrl).forEach((r, i) => {
      const ya = g.oss.y[i], yb = g.oss.y[i + 1];
      h += V(g.oss.nX[0], ya, g.oss.nX[1], yb, r.n, { c: 1, pt: g.oss.pt + 1 });
      h += V(g.oss.tX[0], ya, g.oss.tX[1], yb, r.t, { pt: g.oss.pt, col: r.rosso ? '#ff0000' : '' });
    });
    if (a.tipo === 'pinza' && a.accessori) h += `<div class="ap-v ap-acc" data-adatta="0.4" data-blocco style="left:65.2mm;top:226mm;width:123.2mm;height:36mm;--fs:12.4pt">${esc(a.accessori)}</div>`;
    return pagina(APM[a.tipo].pagine[0], h);
  }

  // ---------------- FUNE ACCIAIO - CARRUCOLE - TAMBURO ----------------
  function foglioFune(S, d) {
    const cli = SG.cliente(S, d.sedeId), v = d.v || {};
    let h = LOGO([172.94, 5.0, 196.14, 16.77]);
    const nome = cli ? CLI.nomeAl(cli.anagrafica, d.data, cli.sede) : '';
    h += V(26.4, 17.8, 67.9, 24.9, nome, { basso: 1, pt: 7.5 }) + V(84.3, 17.8, 138.9, 24.9, v.ubicazione, { basso: 1, pt: 7.5 }) + V(149, 17.8, 204.4, 24.9, v.gruN, { basso: 1, pt: 7.5 });
    h += V(22, 25.1, 67.9, 32.3, v.tipo, { basso: 1, pt: 7.5 }) + V(84, 25.1, 138.9, 32.3, v.matricola, { basso: 1, pt: 7.5 }) + V(152, 25.1, 174.7, 32.3, v.portata, { basso: 1, pt: 7.5 }) + V(184.2, 25.1, 204.4, 32.3, v.tratti, { basso: 1, pt: 7.5 });
    h += V(34.3, 37.2, 67.9, 43.0, v.diametro, { basso: 1, pt: 7.5 }) + V(86, 37.2, 138.9, 43.0, v.formazione, { basso: 1, pt: 7.5 }) + V(155.4, 37.2, 204.4, 43.0, v.resistenza, { basso: 1, pt: 7.5 });
    h += V(35.1, 43.3, 67.9, 49.1, v.certificato, { basso: 1, pt: 7.5 }) + V(95, 43.3, 138.9, 49.1, v.caricoRottura, { basso: 1, pt: 7.5 }) + V(168.7, 43.3, 204.4, 49.1, v.avvolgimento, { basso: 1, pt: 7.5, c: 1 });
    const Y = [64.4, 77.0, 89.6, 102.3, 114.9, 127.5, 140.1], X = [14.9, 32.7, 50.4, 68.1, 85.9, 103.6, 121.4, 139.1, 204.7];
    const K = ['fili6', 'fili30', 'diam', 'usura', 'corrosione', 'danno', 'natura', 'note'];
    (d.tratti || []).slice(0, 6).forEach((r, i) => K.forEach((k, j) => {
      h += V(X[j] + 0.3, Y[i] + 0.2, X[j + 1] - 0.3, Y[i + 1] - 0.2, r[k], { c: j < 7, pt: 7.5, righe: j === 7 });
    }));
    h += V(165, 140.2, 204.4, 144.2, v.lubFune, { basso: 1, pt: 6.8 });
    h += V(35.8, 144.5, 85.7, 151.6, v.giudizioFune, { basso: 1, pt: 7.5, cls: 'b' }) + V(93.2, 144.5, 138.9, 151.6, dataLunga(d.data), { basso: 1, pt: 7.5 }) + IMG(148, 144.5, 204.3, 151.6, d.firmaTecnico, 'firma-sx');
    const valori = (y, r, pref) => V(53.2, y + 0.1, 85.6, y + 6.9, r[pref + 'g'], { basso: 1, pt: 8.5 }) + V(88.8, y + 0.1, 121.2, y + 6.9, r[pref + 'h'], { basso: 1, pt: 8.5 }) + V(124.6, y + 0.1, 156.6, y + 6.9, r[pref + 'D'], { basso: 1, pt: 8.5 });
    const note = (y, txt) => (txt ? `<div class="ap-v ap-note2" data-adatta="0.45" data-blocco style="left:15.4mm;top:${n2(y + 0.15)}mm;width:141.2mm;height:13.8mm;--fs:8.5pt">${esc(txt)}</div>` : '');
    const c = d.carrucole || {}, t = d.tamburo || {};
    [['bil', 156.3], ['fis', 177.2], ['mob', 198.2]].forEach(([k, y]) => { h += valori(y, c, k) + note(y + 6.95, c[k + 'Note']); });
    h += IMG(156.64, 156.47, 203.7, 205.15, 'img/approfonditi/carrucole.png', 'ap-fill') + V(172, 215.3, 204.4, 219.0, v.lubCarrucole, { basso: 1, pt: 6.8 });
    [['dx', 227.9], ['sx', 248.8]].forEach(([k, y]) => {
      h += V(53.2, y + 0.1, 85.6, y + 6.9, t[k + 'g'], { basso: 1, pt: 8.5 }) + V(88.8, y + 0.1, 121.2, y + 6.9, t[k + 'h'], { basso: 1, pt: 8.5 }) + V(124.6, y + 0.1, 156.6, y + 6.9, t[k + 'P'], { basso: 1, pt: 8.5 });
      h += note(y + 6.95, t[k + 'Note']);
    });
    h += IMG(156.63, 228.06, 204.17, 272.81, 'img/approfonditi/tamburo.png', 'ap-fill') + V(172, 277.1, 204.4, 280.8, v.lubTamburo, { basso: 1, pt: 6.8 });
    h += V(35.8, 281.1, 85.7, 288.3, v.giudizio2, { basso: 1, pt: 7.5, cls: 'b' }) + V(93.2, 281.1, 138.9, 288.3, dataLunga(d.data), { basso: 1, pt: 7.5 }) + IMG(148, 281.1, 204.3, 288.3, d.firmaTecnico, 'firma-sx');
    return pagina(APM.fune.pagine[0], h);
  }

  // ---------------- BOZZELLO / GANCIO (2 pagine) ----------------
  // pallino pieno sulla «O» dell'opzione scelta
  function pallini(pag, b, scelta) {
    if (!scelta) return '';
    const sc = [].concat(scelta);
    return APM.opzBozzello.filter((o) => o[0] === pag && Math.abs(o[3] - b) < 0.3 && sc.includes(o[1])).map((o) => {
      const r = o[4] * 0.3528 * 0.37, cx = o[2] + o[4] * 0.3528 * 0.39, cy = o[3] - o[4] * 0.3528 * 0.36;
      return `<div class="ap-dot" style="left:${n2(cx - r)}mm;top:${n2(cy - r)}mm;width:${n2(2 * r)}mm;height:${n2(2 * r)}mm"></div>`;
    }).join('');
  }
  const BOZ_SCELTE = [
    // [pagina, riga (baseline), campo]
    [0, 86.66, 'condizioni'], [0, 95.21, 'certificato'], [0, 103.78, 'marcatura'], [0, 112.33, 'conformita'], [0, 120.88, 'completo'],
    [0, 176.47, 'esitoDim'], [0, 193.57, 'tipologia'], [0, 202.12, 'presenza'], [0, 210.69, 'entita'], [0, 219.24, 'cricche'], [0, 227.79, 'tipoCricche'],
    [1, 69.56, 'esitoUsura'], [1, 133.71, 'corrSup'], [1, 142.26, 'corrGambo'], [1, 159.37, 'sicurezza'], [1, 167.92, 'funzionamento'],
    [1, 176.47, 'rotazione'], [1, 185.02, 'snodo'], [1, 193.57, 'rumori']
  ];
  function foglioBozzello(S, d) {
    const cli = SG.cliente(S, d.sedeId), v = d.v || {}, s = d.scelte || {}, cal = APR.calcoliBozzello(d);
    const nome = cli ? CLI.nomeAl(cli.anagrafica, d.data, cli.sede) : '';
    let p1 = LOGO([26.78, 20.55, 45.34, 32.13]);
    p1 += V(31.4, 36.45, 105.2, 44.8, nome, { basso: 1, pt: 7.8 }) + V(113.2, 36.45, 175.2, 44.8, v.gru, { basso: 1, pt: 7.8 });
    p1 += V(32.3, 45.0, 105.2, 53.3, v.portata, { basso: 1, pt: 7.8 }) + V(123.2, 45.0, 175.2, 53.3, v.matricola, { basso: 1, pt: 7.8 });
    p1 += V(29.3, 62.1, 70.2, 70.5, v.forma, { basso: 1, pt: 7.8 }) + V(82, 62.1, 122.7, 70.5, v.norma, { basso: 1, pt: 7.8 }) + V(137.2, 62.1, 175.2, 70.5, v.portataGancio, { basso: 1, pt: 7.8 });
    p1 += V(30.3, 70.7, 70.2, 79.0, v.tipoN, { basso: 1, pt: 7.8 }) + V(100.6, 70.7, 122.7, 79.0, v.classe, { basso: 1, pt: 7.8 }) + V(132.2, 70.7, 175.2, 79.0, v.anno, { basso: 1, pt: 7.8 });
    p1 += v.catalogo ? `<div class="ap-v ap-bianco" data-adatta="0.4" style="left:51.5mm;top:138.9mm;width:123.5mm;height:4.1mm;--fs:8.5pt">${esc(v.catalogo)}</div>` : '';
    p1 += V(60.6, 143.3, 70.2, 151.7, v.ar, { basso: 1, pt: 7.8, c: 1 }) + V(101.2, 143.3, 122.7, 151.7, v.am, { basso: 1, pt: 7.8 }) + V(145.6, 143.3, 175.2, 151.7, v.nonPresente ? 'X' : '', { basso: 1, pt: 7.8, c: 1 });
    p1 += V(82.6, 151.9, 122.7, 160.3, cal.dr, { basso: 1, pt: 7.8 }) + V(142.2, 151.9, 175.2, 160.3, v.a1, { basso: 1, pt: 7.8 });
    p1 += V(87, 160.5, 103.6, 168.8, cal.mda, { basso: 1, pt: 7.8, c: 1 }) + V(105.4, 160.5, 116.7, 168.8, cal.drPct, { basso: 1, pt: 7.8, c: 1 });
    p1 += IMG(19, 229.4, 174.5, 271.8, d.foto?.collocazione);
    let p2 = V(58.6, 36.45, 70.2, 44.8, v.hr, { basso: 1, pt: 7.8, c: 1 }) + V(98.2, 36.45, 122.7, 44.8, v.hm, { basso: 1, pt: 7.8 });
    p2 += V(83, 45.0, 122.7, 53.4, cal.usura, { basso: 1, pt: 7.8 });
    p2 += V(86.4, 53.6, 101.2, 61.9, cal.mha, { basso: 1, pt: 7.8, c: 1 }) + V(102.8, 53.6, 117.6, 61.9, cal.usuraPct, { basso: 1, pt: 7.8, c: 1 });
    p2 += IMG(19, 71.1, 174.5, 113.7, d.foto?.usura) + IMG(19, 203.7, 174.5, 246.6, d.foto?.insieme);
    p2 += V(18.5, 259.6, 70.2, 266.9, dataLunga(d.data), { basso: 1, pt: 8 }) + V(71, 259.6, 113.8, 266.9, v.esito, { basso: 1, pt: 8, cls: 'b' }) + IMG(115, 258.4, 175, 266.9, d.firmaTecnico, 'firma-sx');
    BOZ_SCELTE.forEach(([pg, b, k]) => { const x = pallini(pg, b, s[k]); if (pg === 0) p1 += x; else p2 += x; });
    return pagina(APM.gancio.pagine[0], p1) + pagina(APM.gancio.pagine[1], p2);
  }

  // ---------------- INDAGINE APPROFONDITA ----------------
  function foglioIndagine(S, d) {
    const cli = SG.cliente(S, d.sedeId), v = d.v || {};
    const nome = cli ? CLI.nomeAl(cli.anagrafica, d.data, cli.sede) : '';
    let h = LOGO([26.67, 23.16, 45.43, 34.8]);
    h += V(68.6, 28.2, 178.1, 36.5, v.particolare, { pt: 10 });
    h += V(34, 41.3, 124.6, 49.5, nome, { pt: 10 }) + V(139.3, 41.3, 178.1, 49.5, dataLunga(d.data), { pt: 10 });
    h += V(35, 49.9, 53.4, 58.3, v.nInterno, { pt: 9 }) + V(71.8, 49.9, 124.6, 58.3, v.matricola, { pt: 10 }) + V(140.8, 49.9, 178.1, 58.3, v.utilizzo, { pt: 10 });
    (d.punti || []).slice(0, 8).forEach((p, i) => {
      const y = 71.6 + i * 21.8;
      h += V(36.2, y + 0.2, 160.3, y + 8.5, p.fase, { pt: 9, righe: 1 }) + V(160.9, y + 0.2, 178.1, y + 8.5, p.esito, { pt: 9, c: 1, cls: 'b' });
      h += V(36.2, y + 8.9, 160.3, y + 17.2, p.note, { pt: 9, righe: 1 });
    });
    const nFoto = (d.allegati || []).length;
    h += V(54, 246.2, 178.1, 254.6, [v.allegati, nFoto ? `${nFoto} ${nFoto === 1 ? 'foto allegata' : 'foto allegate'} (pag. 2)` : ''].filter(Boolean).join(' · '), { pt: 9 });
    h += v.conclusioni ? `<div class="ap-v" data-adatta="0.4" data-blocco style="left:18.4mm;top:263.4mm;width:88.4mm;height:8.6mm;--fs:9pt;white-space:pre-wrap;align-items:flex-start;line-height:1.15">${esc(v.conclusioni)}</div>` : '';
    h += IMG(118, 264, 172, 280, d.firmaTecnico);
    let out = pagina(APM.indagine.pagine[0], h);
    if (nFoto) {
      // pagina degli allegati: fino a 4 foto
      const pos = [[17.9, 45, 104, 150], [107, 45, 193, 150], [17.9, 155, 104, 260], [107, 155, 193, 260]];
      out += `<div class="foglio-p ap-f">${LOGO([26.67, 23.16, 45.43, 34.8])}
        <div class="ap-v" style="left:54mm;top:24mm;width:124mm;height:10mm;--fs:14pt">INDAGINE APPROFONDITA · ALLEGATI</div>
        ${V(54, 34, 178, 40, [nome, v.particolare, dataLunga(d.data)].filter(Boolean).join(' · '), { pt: 9 })}
        ${(d.allegati || []).slice(0, 4).map((f, i) => IMG(...pos[i], f, 'ap-cornice')).join('')}</div>`;
    }
    return out;
  }

  function documento(S, tipo, rec, anno) {
    if (tipo === 'pinza' || tipo === 'magnete') return foglioAttrezzo(S, rec, anno);
    if (tipo === 'fune') return foglioFune(S, rec);
    if (tipo === 'bozzello') return foglioBozzello(S, rec);
    return foglioIndagine(S, rec);
  }

  function adatta() {
    const w = document.querySelector('.ap-stampa .fogli-pv'); if (!w) return;
    w.style.zoom = 1;
    const disp = w.parentElement.clientWidth, mm = 210 * 96 / 25.4;
    w.style.zoom = Math.min(1, (disp - 4) / mm).toFixed(3);
  }
  window.addEventListener('resize', adatta);

  // pagina di stampa: Stampa / salva PDF + Scarica PDF
  function render(el, S, tipo, rec, anno, nomeFile, indietro) {
    el.innerHTML = `
      <section class="ap-stampa stampa">
        <div class="azioni-lista no-print">
          <button class="btn" id="btnStampa">🖨️ Stampa / salva PDF</button>
          <button class="btn ghost" id="btnPdf">⬇ Scarica PDF</button>
          ${anno ? `<a class="btn ghost" href="${indietro}/stampa/${anno - 1}">‹ ${anno - 1}</a><a class="btn ghost" href="${indietro}/stampa/${anno + 1}">${anno + 1} ›</a>` : ''}
          ${UI.info('Nella finestra di stampa scegli la stampante oppure «Salva come PDF»: formato A4 verticale, margini «Nessuno». Con «Scarica PDF» il file è già pronto da inviare al cliente.')}
        </div>
        <div class="fogli-wrap"><div class="fogli-pv">${documento(S, tipo, rec, anno)}</div></div>
      </section>`;
    const fv = el.querySelector('.fogli-pv');
    fv.style.zoom = 1; UI.adattaTesti(fv);   // misuro a grandezza reale, poi rimpicciolisco per lo schermo
    el.querySelector('#btnStampa').onclick = () => {
      const t = document.title; document.title = nomeFile; window.print(); setTimeout(() => (document.title = t), 1000);
    };
    el.querySelector('#btnPdf').onclick = async (e) => {
      const b = e.currentTarget; b.disabled = true; b.textContent = '⏳ Preparo il PDF…';
      try {
        const bytes = await PDFX.daStampa((box) => { box.innerHTML = `<div class="fogli-pv">${documento(S, tipo, rec, anno)}</div>`; UI.adattaTesti(box); }, '.foglio-p', true);
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })); a.download = nomeFile + '.pdf'; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      } catch (er) { UI.toast('PDF non riuscito: ' + er.message, 'err'); }
      b.disabled = false; b.textContent = '⬇ Scarica PDF';
    };
    requestAnimationFrame(adatta);
  }

  return { render, documento };
})();
