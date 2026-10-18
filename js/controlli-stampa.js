// ===== STAMPA "SCHEDA CONTROLLO (D.Lgs.81/08)" =====
// Ricalca la scheda attuale: A4 verticale, misure in millimetri prese dal PDF originale.
// Una pagina per impianto; si possono stampare tutti gli impianti di una sede in un colpo.
window.CTRS = (function () {
  const { esc, fmt } = UI;
  const kgT = (n) => { n = +n; if (!n) return ''; return (n / 1000).toLocaleString('it-IT'); };   // portata in t, senza unità (come sull'originale)

  // colonne (mm)
  const X0 = 5.04, X1 = 204.89, XC = 13.12, XD = 119.25;
  const BLOCCHI = [[119.25, 130.13, 141.31], [141.31, 151.81, 162.48], [162.48, 172.89, 183.3], [183.3, 193.72, 204.89]];
  const T2 = 55.88, R0 = 5.59, R1 = 5.12, RIGA = 4.549;

  const T = (x, y, txt, cls = '', w) => `<div class="cs-t ${cls}" style="left:${x}mm;top:${y}mm${w ? `;width:${w}mm` : ''}">${txt}</div>`;
  const box = (x, y, w, h, cls = '') => `<div class="cs-b ${cls}" style="left:${x}mm;top:${y}mm;width:${w}mm;height:${h}mm"></div>`;
  const val = (v) => esc(v ?? '');

  function pagina(S, imp, anno) {
    const { c, s } = CTR.trovaSede(S, imp.sedeId);
    const sc = CTR.schedaDi(S, imp.id, anno);
    const voci = sc ? sc.voci : [];
    const par = imp.paranchi?.length ? imp.paranchi : [{}];
    const np = par.length;
    const el = imp.elettrico || {};
    const unisci = (arr) => arr.filter(Boolean).join(' - ');
    const tratti = (t) => (t ? (String(t).includes('/') ? t : t + '/1') : '');

    // ----- intestazione -----
    let h = `
      <img class="cs-logo" src="img/logo-scheda.png" alt="">
      ${T(144.9, 10.0, 'SCHEDA CONTROLLO (D.Lgs.81/08)', 'cs-tit')}
      ${T(145.2, 15.4, 'MATRICOLA')}
      ${box(160.2, 15.6, 35.3, 3.7, 'cs-sottile')}${T(161.2, 15.6, val(imp.matricola))}`;

    // ----- tabella dati impianto -----
    const righe1 = [27.09, 32.94, 38.10, 43.94, 49.61, 54.95];
    h += box(X0, righe1[0], X1 - X0, righe1[5] - righe1[0]);
    righe1.slice(1, 5).forEach((y) => (h += `<div class="cs-h" style="left:${X0}mm;top:${y}mm;width:${X1 - X0}mm"></div>`));
    h += `<div class="cs-v" style="left:82.38mm;top:${righe1[0]}mm;height:${righe1[5] - righe1[0]}mm"></div>`;
    h += `<div class="cs-v" style="left:165.86mm;top:${righe1[0]}mm;height:${righe1[4] - righe1[0]}mm"></div>`;
    const L = (x, y, l, vx, v) => T(x, y, `<b>${l}</b>`) + T(vx, y, val(v));
    // ubicazione: solo via, CAP e città, sempre dentro la sua casella
    const ubic = s ? [s.indirizzo, [s.cap, s.citta].filter(Boolean).join(' ')].filter(Boolean).join(' – ') : '';
    h += L(5.9, 28.5, 'CLIENTE', 17.3, c?.ragioneSociale) + T(83.4, 28.5, '<b>UBICAZIONE</b>') + T(99.6, 28.5, `<span style="font-size:${Math.max(55, Math.min(100, Math.floor(4400 / Math.max(1, ubic.length))))}%">${val(ubic)}</span>`, 'cs-ubic', 65.6) + L(167.0, 28.5, 'N°INT.', 188.6, imp.numeroInterno);
    h += L(5.9, 33.7, 'CASA', 17.3, imp.marca) + L(83.3, 33.7, 'N°FABBRICA', 99.7, imp.numeroSerie);
    h += L(5.9, 39.2, 'ANNO COSTRUZIONE', 32.6, imp.annoCostruzione) + L(83.3, 39.2, 'TIPO', 99.7, (imp.tipologia || '').toUpperCase())
      + L(167.0, 39.5, 'PORTATA', 190.5, par.map((p) => kgT(p.portata)).filter(Boolean).join(' + '));
    h += L(5.8, 45.0, 'ARGANO', 17.3, unisci(par.map((p) => p.marcaModello))) + L(83.2, 45.0, 'DIAM.FUNE', 98.7, unisci(par.map((p) => p.fune?.diametro)))
      + L(125.7, 45.0, 'TRATTI FUNE', 145.8, unisci(par.map((p) => tratti(p.fune?.tratti))));
    h += L(5.8, 50.6, 'CLASSE', 17.3, unisci(par.map((p) => unisci([p.classeFem, p.classeIso])).filter((x, i, a) => a.indexOf(x) === i)))
      + L(83.2, 50.6, 'RADIOCOMANDO', 105.5, unisci([el.radioMarca, el.radioModello])) + L(155.7, 50.6, 'MATR.', 165.5, el.radioMatricola);

    // ----- tabella controlli -----
    const gruppi = ['T', 'S', 'A'].map((pp) => voci.filter((v) => v.per === pp)).filter((g) => g.length);
    const righe = [];
    gruppi.forEach((g, gi) => { if (gi) righe.push(null); g.forEach((v) => righe.push(v)); });
    const nRighe = Math.max(righe.length, 1);
    // se le voci sono tante, le righe si stringono per stare in una pagina
    const nOss = Math.max(5, (sc?.osservazioni || []).length);
    const spazio = 278 - (T2 + R0 + R1) - 8 - nOss * 3.45 - 2;
    const rh = Math.min(RIGA, spazio / nRighe);
    const top0 = T2 + R0 + R1, fine = top0 + nRighe * rh;
    const visite = [1, 2, 3, 4].map((n) => sc?.visite?.[n] || null);
    const pianoSede = CTR.piano(s);
    const dovute = [1, 2, 3, 4].map((n) => CTR.periodiDi(CTR.tipoVisita(pianoSede, n)));

    // colonne di ogni blocco visita: P1 (P2) FIRMA
    const colBlocco = ([a, b, cc]) => {
      if (np === 1) return { p: [[a, b]], f: [b, cc] };
      const w = (cc - a) / (np + 1.15);
      const p = Array.from({ length: np }, (_, k) => [a + k * w, a + (k + 1) * w]);
      return { p, f: [a + np * w, cc] };
    };
    const blocchi = BLOCCHI.map(colBlocco);

    // riga 0: anno scheda + date
    h += box(X0, T2, XD - X0, R0) + T(5.9, 56.9, '<b>ANNO SCHEDA</b>') + T(25.8, 56.9, anno);
    BLOCCHI.forEach(([a, , cc], k) => { h += box(a, T2, cc - a, R0) + T(a, 56.9, visite[k] ? fmt(visite[k].dataScheda) : '', 'cs-c', cc - a); });
    // riga 1: P1 / FIRMA
    h += box(X0, T2 + R0, XD - X0, R1);
    blocchi.forEach((bl) => {
      bl.p.forEach(([a, b], k) => (h += box(a, T2 + R0, b - a, R1) + T(a, 62.2, `<b>P${k + 1}</b>`, 'cs-c', b - a)));
      h += box(bl.f[0], T2 + R0, bl.f[1] - bl.f[0], R1) + T(bl.f[0], 62.2, '<b>FIRMA</b>', 'cs-c', bl.f[1] - bl.f[0]);
    });
    // righe delle voci
    const ty = (k) => top0 + k * rh + (rh - 3.45) / 2 + 0.05;
    righe.forEach((v, k) => {
      const y = top0 + k * rh;
      h += box(X0, y, XC - X0, rh) + box(XC, y, XD - XC, rh);
      blocchi.forEach((bl) => bl.p.forEach(([a, b]) => (h += box(a, y, b - a, rh))));
      if (!v) return;
      h += T(5.9, ty(k), CTR.PER[v.per]) + T(13.7, ty(k), val(v.testo), 'cs-desc', XD - 13.7 - 0.5);
      visite.forEach((vis, n) => {
        if (!vis || !dovute[n].includes(v.per)) return;
        const es = vis.esiti?.[v.id] || [];
        const vl = vis.valori?.[v.id] || [];
        const bl = blocchi[n];
        // SCHEDA CLIENTE: una voce dovuta e lasciata vuota esce come X; se è stato scritto un valore esce il valore
        // (al posto della X). Le lettere delle anomalie e i codici R/P/L/S restano quelli scritti.
        const vecchio = (x) => x && !CTR.CODICI.some(([c]) => c === x) && !/^[A-Z]{1,2}$/.test(x);   // vecchia "misura" nell'esito
        bl.p.forEach(([a, b], pi) => {
          const e = es[pi] || '', w = vl[pi] || (vecchio(e) ? e : '');
          const txt = w && (!e || e === 'X' || vecchio(e)) ? w : (e || 'X');
          h += T(a, ty(k), val(txt), 'cs-c' + (String(txt).length > 3 ? ' cs-lungo' : ''), b - a);
        });
      });
    });
    // firma: una sola per ogni gruppo (TRIM / SEME / ANN) di ogni controllo, girata di 90° e in verticale.
    // Tutte della stessa grandezza: prendo la misura che sta nel gruppo più corto della pagina.
    const gruppiRighe = ['T', 'S', 'A'].map((pp) => righe.map((v, k) => (v && v.per === pp ? k : -1)).filter((k) => k >= 0)).filter((g) => g.length);
    const lungFirma = Math.min(24, ...gruppiRighe.map((g) => g.length * rh - 1.2));
    visite.forEach((vis, n) => {
      if (!vis?.firma) return;
      const [fa, fb] = blocchi[n].f, w = fb - fa, H = w - 1.4, L = lungFirma;
      ['T', 'S', 'A'].filter((pp) => dovute[n].includes(pp)).forEach((pp) => {
        const idx = righe.map((v, k) => (v && v.per === pp ? k : -1)).filter((k) => k >= 0);
        if (!idx.length) return;
        const yc = top0 + idx[0] * rh + (idx.length * rh) / 2;
        h += `<img class="cs-firma" src="${vis.firma}" alt="" style="left:${(fa + w / 2 - L / 2).toFixed(2)}mm;top:${(yc - H / 2).toFixed(2)}mm;width:${L.toFixed(2)}mm;height:${H.toFixed(2)}mm;transform:rotate(-90deg)">`;
      });
    });

    // ----- osservazioni e legenda -----
    const yo = fine + 3.23;
    h += T(6.7, yo, '<b>OSSERVAZIONI</b>');
    h += T(70.9, yo, '<b>LEGENDA&nbsp;:&nbsp; X=esame visivo funzionale&nbsp; -&nbsp; R=ripristinato&nbsp; -&nbsp; P=pulito&nbsp; -&nbsp; L=lubrificato&nbsp; -&nbsp; S=sostituito</b>');
    const oss = (sc?.osservazioni || []).map((o) => `${o.lettera}=${o.testo}${o.risoltaIl ? ' - SISTEMATO IL ' + fmt(o.risoltaIl) : ''}`.toUpperCase());
    const yb = yo + 4.4, hb = Math.max(oss.length, 5) * 3.45 + 0.8;
    h += box(X0, yb, X1 - X0, hb, 'cs-grigio');
    oss.forEach((t, k) => (h += T(6.3, yb + 0.5 + k * 3.45, val(t), 'cs-oss', X1 - 7.5)));

    // ----- piè di pagina -----
    h += `<div class="cs-h cs-grigio-l" style="left:${X0}mm;top:280.84mm;width:${X1 - X0}mm"></div>`;
    h += T(180, 282.2, 'Pag. 1/ 1', 'cs-pag', 24.3);
    return `<div class="foglio-p">${h}</div>`;
  }

  function adatta() {
    const w = document.querySelector('.fogli-pv'); if (!w) return;
    const mm = 210 * 96 / 25.4;
    w.style.zoom = Math.min(1, w.parentElement.clientWidth / mm).toFixed(3);
  }
  window.addEventListener('resize', adatta);

  function render(el, S, impIds, anno, indietro) {
    const imp = impIds.map((id) => S.impianti.find((x) => x.id === id)).filter(Boolean);
    if (!imp.length) { el.innerHTML = '<p class="nessuno">Nessun impianto.</p>'; return { titolo: 'Stampa', indietro }; }
    const senza = imp.filter((i) => !CTR.schedaDi(S, i.id, anno)).length;
    el.innerHTML = `
      <section class="sg stampa">
        <div class="azioni-lista no-print">
          <button class="btn" id="btnStampa">🖨️ Stampa / salva PDF</button>
          <a class="btn ghost" href="${indietro}">Indietro</a>
          ${UI.info('Nella finestra di stampa scegli la stampante oppure «Salva come PDF», formato A4 verticale, margini «Nessuno». Ogni impianto ha la sua pagina.')}
          ${senza ? `<span class="muted small">${senza} ${senza === 1 ? 'impianto non ha' : 'impianti non hanno'} ancora controlli nel ${anno}: la scheda esce senza voci.</span>` : ''}
        </div>
        <div class="fogli-wrap"><div class="fogli-pv">${imp.map((i) => pagina(S, i, anno)).join('')}</div></div>
      </section>`;
    el.querySelector('#btnStampa').onclick = () => {
      const t = document.title, i0 = imp[0], { c } = CTR.trovaSede(S, i0.sedeId);
      document.title = (`Scheda_${c ? CLI.nome(c) : ''}_${imp.length === 1 ? (i0.numeroInterno || i0.matricola || '') : 'tutti'}_${anno}`).replace(/[^\w\-]+/g, '_');
      window.print(); setTimeout(() => (document.title = t), 1000);
    };
    requestAnimationFrame(adatta);
    return { titolo: 'Stampa schede ' + anno, indietro, live: true };
  }
  return { render };
})();
