// ===== SCHEDE DI CABLAGGIO MODULABILI (configuratore cablaggio, versione nuova) =====
// Una scheda si crea da zero ed è fatta di blocchi, ognuno con la sua struttura fissa ma tutto il testo libero:
//  - «conn»  presa o spina: connettore a 16 / 24 / 32 poli al centro, colonne libere a sinistra e a destra
//  - «fc»    finecorsa: righe  A · 15 · 1 —/— 2 · 90 · RAL AV  (contatto NA o NC)
//  - «cavo»  qualsiasi cavo: titolo e tabella con colonne e righe libere
// Ogni scheda è un documento della raccolta «impostazioni» (id «cab-…», tipo «cabScheda»): vale per tutti i dispositivi.
// Il vecchio configuratore resta raggiungibile dal menu ⋯ (#/cablaggio/vecchio).
window.CABS = (function () {
  const { esc, uid, info } = UI;
  const PIN = [16, 24, 32];
  const schede = (S) => S.impostazioni.filter((d) => d.tipo === 'cabScheda').sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'it'));
  const puoModificare = () => UT.puo('cablaggio.schede') && !UT.solaLettura();
  const clona = (o) => JSON.parse(JSON.stringify(o));
  const quando = (iso) => { if (!iso) return ''; const d = new Date(iso); return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' }); };

  // ---------- blocchi nuovi ----------
  const righeConn = (pin, nSx, nDx, vecchie = []) => Array.from({ length: pin / 2 }, (_, i) => ({
    sx: Array.from({ length: nSx }, (_, k) => vecchie[i]?.sx?.[k] ?? ''),
    dx: Array.from({ length: nDx }, (_, k) => vecchie[i]?.dx?.[k] ?? '')
  }));
  const NUOVO = {
    conn: (o = {}) => {
      const pin = o.pin || 16;
      return { id: uid(), tipo: 'conn', titolo: o.titolo || 'PRESA PULSANTIERA', nomePin: o.nomePin || 'PRESA', pin,
        colSx: ['N° FEST', 'N° SCHEMA'], colDx: ['N° SCHEMA', 'N° FEST'], righe: righeConn(pin, 2, 2), nota: '' };
    },
    fc: (o = {}) => ({ id: uid(), tipo: 'fc', titolo: o.titolo || 'FINECORSA',
      righe: Array.from({ length: o.n || 4 }, (_, i) => ({ sig: String.fromCharCode(65 + i), a: '', p1: '', c: 'NA', p2: '', b: '', nota: '' })) }),
    cavo: (o = {}) => {
      const n = Math.max(1, Math.min(60, +o.n || 3)), cols = o.colonne || ['FILO', 'N° QUADRO', 'MORSETTO'];
      const righe = Array.from({ length: n }, (_, i) => cols.map((_, k) => (k === 0 ? String(i + 1) : '')));
      if (o.pe) righe.push(cols.map((_, k) => (k === 0 ? 'PE' : '')));
      return { id: uid(), tipo: 'cavo', titolo: o.titolo || 'CAVO', colonne: [...cols], righe };
    }
  };
  NUOVO.puls = (o = {}) => {
    const n = Math.max(1, Math.min(40, +o.n || 6)), nc = Math.max(0, Math.min(n, +o.nc || 0));
    return { id: uid(), tipo: 'puls', titolo: o.titolo || 'PULSANTIERA', orient: o.orient === 'v' ? 'v' : 'o',
      tasti: Array.from({ length: n }, (_, k) => ({ id: uid(), nome: 'P' + (k + 1), schema: '', filo: '', tipo: k < n - nc ? 'NO' : 'NC', schemaSotto: '', filoSotto: '' })) };
  };
  NUOVO.mors = (o = {}) => {
    const n = Math.max(1, Math.min(120, +o.n || 10)), tipo = MT[o.tipo] ? o.tipo : 'WDU 2,5';
    return { id: uid(), tipo: 'mors', titolo: o.titolo || 'MORSETTIERA', morsetti: Array.from({ length: n }, (_, k) => ({ id: uid(), nome: MT[tipo].pe ? 'PE' : String(k + 1), tipo, ev: false })), ponti: [] };
  };
  // scatola di derivazione MISIA (8 pressacavi motore cilindrico, 7 conico: senza il n. 3)
  const SCAT_DEF = () => {
    const pic = () => ({ uso: '', pressacavo: 'M20 × 1,5', foro: 'Ø 20,5 MM (DA CONFERMARE)', lama: '' });
    const gra = () => ({ uso: '', pressacavo: 'M25 × 1,5 (DA CONFERMARE)', foro: 'Ø 25,5 MM (DA CONFERMARE)', lama: '' });
    return { pressacavi: [pic(), pic(), pic(), pic(), pic(), pic(), gra(), gra()],
      din: { tipo: '35 × 7,5 MM (DA CONFERMARE)', lunghezza: '', fori: '', maschiatura: '', bulloni: '' },
      fori: { quanti: '4, UNO PER ANGOLO', foro: '', minuteria: 'VITE TESTA ESAGONALE + RONDELLA + DADO AUTOBLOCCANTE (DA CONFERMARE)' },
      piatto: { uso: 'INGRESSO DEL CAVO PIATTO DEL FESTONE', modello: 'CARPEL PRA80X25 IN ALLUMINIO (DA CONFERMARE)', viti: '', procedura: '' } };
  };
  let SCAT_VECCHI = null;   // valori già scritti nel configuratore vecchio (se ci sono), per partire da quelli
  NUOVO.scat = (o = {}) => ({ id: uid(), tipo: 'scat', titolo: o.titolo || 'SCATOLA DI DERIVAZIONE', versione: o.versione === 'con' ? 'con' : 'cil', morsId: o.morsId || '',
    dati: SCAT_VECCHI ? clona(SCAT_VECCHI) : SCAT_DEF() });
  const NOME_TIPO = { conn: 'Presa / spina', fc: 'Finecorsa', cavo: 'Cavo', puls: 'Pulsantiera', mors: 'Morsettiera', scat: 'Scatola di derivazione' };

  // ---------- scatola di derivazione: 3 viste da toccare, scheda del pezzo sotto ----------
  const SDV = {};   // vista e pezzo scelto, per blocco
  let BLOCCHI_ORA = [];   // blocchi della scheda che si sta disegnando (per la morsettiera sulla guida DIN)
  const SD_CAMPI = {
    p: [['uso', 'A cosa serve'], ['pressacavo', 'Pressacavo'], ['foro', 'Foro da fare'], ['lama', 'Lama / punzone della pressa']],
    din: [['tipo', 'Tipo'], ['lunghezza', 'Lunghezza'], ['fori', 'Fori di fissaggio'], ['maschiatura', 'Maschiatura sulla scatola'], ['bulloni', 'Bulloni']],
    fori: [['quanti', 'Quanti'], ['foro', 'Foro da fare'], ['minuteria', 'Minuteria']],
    piatto: [['uso', 'A cosa serve'], ['modello', 'Modello'], ['viti', 'Viti della flangia'], ['procedura', 'Procedura per il foro']]
  };
  // la morsettiera collegata, disegnata sulla guida DIN (stessi morsetti, colori e proporzioni)
  function morsSuGuida(b) {
    const m = BLOCCHI_ORA.find((x) => x.id === b.morsId && x.tipo === 'mors'); if (!m || !m.morsetti.length) return '';
    const tot = m.morsetti.reduce((a, x) => a + mtipo(x).mm, 0), L = 296, R2 = 344, Y0 = 104, LUN = 292;
    let y = Y0, h = '<g class="sd-mg">';
    m.morsetti.forEach((x, k) => {
      const hh = mtipo(x).mm / tot * LUN, pe = mtipo(x).pe;
      h += `<g class="sd-pz sd-mors" data-id="m${k}"><title>${esc(x.nome)} · ${x.tipo}</title>
        <rect x="${L}" y="${y.toFixed(1)}" width="${R2 - L}" height="${hh.toFixed(1)}" fill="${pe ? '#f4d21f' : x.ev ? '#f7a46b' : '#d8d3c6'}" stroke="#6b6658" stroke-width=".8"/>
        ${pe ? `<rect x="${L}" y="${(y + hh * .3).toFixed(1)}" width="${R2 - L}" height="${(hh * .4).toFixed(1)}" fill="#3aa346"/>` : ''}
        ${hh >= 6 ? `<text x="${(L + R2) / 2}" y="${(y + hh / 2).toFixed(1)}" font-size="${Math.min(8, hh * .8).toFixed(1)}" font-weight="800" text-anchor="middle" dominant-baseline="middle" fill="#1d2433">${esc(String(x.nome || '').toUpperCase())}</text>` : ''}</g>`;
      y += hh;
    });
    return h + '</g>';
  }
  // scatola in stampa: le 3 viste insieme e l'elenco del materiale
  function scatStampaHtml(b) {
    const con = b.versione === 'con', D = b.dati || {}, V = window.CBS_SD || {}, v = (x) => (x ? esc(String(x).toUpperCase()) : '<span class="sd-dd">—</span>');
    const vista = (n, vb, t) => `<figure class="cbs-sdf cbs-sdf${n}"><figcaption>${t}</figcaption><svg viewBox="${vb}">${(V['v' + n] || '').replace('{{MORS}}', n === 1 ? morsSuGuida(b) : '')}</svg></figure>`;
    const pc = (D.pressacavi || []).map((x, k) => [k + 1, x]).filter(([n]) => !(con && n === 3));
    const det = (k, lista) => lista.filter(([c]) => (D[k] || {})[c]).map(([c, l]) => `<b>${l}:</b> ${v(D[k][c])}`).join(' · ') || '<span class="sd-dd">da definire</span>';
    const ver = `<p class="cbs-sdver">MISIA · MOTORE ${con ? 'CONICO · 7' : 'CILINDRICO · 8'} PRESSACAVI</p>`;
    // due fogli: le 3 viste grandi, poi l'elenco del materiale
    return [`<div class="sd cbs-sdw cbs-sdst${con ? ' sd-conico' : ''}">${ver}
      <div class="cbs-sdviste">${vista(1, '32 34 502 416', '1 · Vista dall\'alto')}${vista(2, '20 20 480 300', '2 · Lato pressacavi')}${vista(3, '20 20 480 300', '3 · Lato festone')}</div></div>`,
      `<div class="sd cbs-sdw cbs-sdst cbs-sdlista${con ? ' sd-conico' : ''}">${ver}<table class="cbs-sdmat"><thead><tr><th>N.</th><th>A cosa serve</th><th>Pressacavo</th><th>Foro da fare</th><th>Lama / punzone</th></tr></thead>
        <tbody>${pc.map(([n, x]) => `<tr><td><b>${n}</b></td><td>${v(x.uso)}</td><td>${v(x.pressacavo)}</td><td>${v(x.foro)}</td><td>${v(x.lama)}</td></tr>`).join('')}</tbody></table>
      <dl class="cbs-sdaltro"><dt>Guida DIN</dt><dd>${det('din', SD_CAMPI.din)}</dd><dt>Fori di fissaggio</dt><dd>${det('fori', SD_CAMPI.fori)}</dd><dt>Pressacavo cavo piatto</dt><dd>${det('piatto', SD_CAMPI.piatto)}</dd>${String(b.note || '').trim() ? `<dt>Note</dt><dd>${esc(String(b.note).toUpperCase()).replace(/\n/g, '<br>')}</dd>` : ''}</dl></div>`];
  }
  function scatHtml(b, i, ed) {
    const st = (SDV[b.id] = SDV[b.id] || { vista: 1, sel: null }), con = b.versione === 'con';
    const ammessi = { 1: ['din', 'fori'], 2: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'], 3: ['piatto'] }[st.vista];
    if (!ammessi.includes(st.sel) || (con && st.sel === 'p3')) st.sel = null;
    const svg = (window.CBS_SD || {})['v' + st.vista] || '';
    const vb = st.vista === 1 ? '32 34 502 416' : '20 20 480 300';
    let info = `<p class="sd-hint">${st.vista === 1 ? `Tocca la guida DIN o un angolo (fori di fissaggio)${b.morsId ? ', un morsetto per aprire la morsettiera' : ''}. A sinistra i pressacavi, a destra il pressacavo del festone.` : st.vista === 2 ? 'Tocca un pressacavo.' : 'Tocca il pressacavo per cavo piatto.'}</p>`;
    if (st.sel) {
      const pi = /^p(\d)$/.exec(st.sel), tipo = pi ? 'p' : st.sel, base = pi ? `b.${i}.dati.pressacavi.${pi[1] - 1}` : `b.${i}.dati.${st.sel}`, dati = pi ? b.dati.pressacavi[pi[1] - 1] : b.dati[st.sel];
      const tit = pi ? `PRESSACAVO ${pi[1]}${+pi[1] >= 7 ? ' (GRANDE)' : ''}` : { din: 'GUIDA DIN', fori: 'FORI DI FISSAGGIO DELLA SCATOLA (4)', piatto: 'PRESSACAVO PER CAVO PIATTO (FESTONE)' }[st.sel];
      info = `<h4>${tit}</h4><dl>${SD_CAMPI[tipo].map(([k, l]) => `<dt>${l}</dt><dd>${ed ? `<input class="cbs-in cbs-sdin" data-p="${base}.${k}" value="${esc(dati[k] || '')}" autocomplete="off">` : (dati[k] ? esc(String(dati[k]).toUpperCase()) : '<span class="sd-dd">da definire</span>')}</dd>`).join('')}</dl>`;
    }
    return `<div class="sd cbs-sdw${con ? ' sd-conico' : ''}" data-sdb="${i}">
      <p class="cbs-sdver">MISIA · MOTORE ${con ? 'CONICO · 7' : 'CILINDRICO · 8'} PRESSACAVI</p>
      <div class="cbs-sdtab no-print">${[[1, 'Dall\'alto'], [2, 'Pressacavi'], [3, 'Festone']].map(([n, t]) => `<button type="button" class="${st.vista === n ? 'on' : ''}" data-sdv="${n}">${n} · ${t}</button>`).join('')}</div>
      <svg viewBox="${vb}" class="cbs-sdsvg">${svg.replace('{{MORS}}', st.vista === 1 ? morsSuGuida(b) : '')}</svg>
      <div class="cbs-sdinfo">${info}</div></div>`;
  }
  // tocchi nella scatola (vale in lettura e in modifica): rid = ridisegna solo il blocco
  function legaScat(box, b, i, ed, onInput) {
    const st = SDV[b.id], rid = () => { const t = document.createElement('div'); t.innerHTML = scatHtml(b, i, ed); const nb = t.firstElementChild; box.replaceWith(nb); legaScat(nb, b, i, ed, onInput); return nb; };
    box.querySelectorAll('[data-sdv]').forEach((x) => (x.onclick = () => { st.vista = +x.dataset.sdv; st.sel = null; rid(); }));
    box.querySelectorAll('.sd-zona').forEach((x) => (x.onclick = () => { st.vista = +x.dataset.vai; st.sel = null; rid(); }));
    box.querySelectorAll('.sd-pz').forEach((g) => g.classList.toggle('sd-on', g.dataset.id === st.sel));
    box.querySelectorAll('.sd-pz').forEach((g) => (g.onclick = (e) => {
      e.stopPropagation();
      const mm = /^m(\d+)$/.exec(g.dataset.id);
      if (mm) {   // morsetto: si va alla morsettiera, su quel morsetto
        const t = box.closest('.cbs-pag')?.querySelector(`[id="cb-${b.morsId}"]`) || document.getElementById('cb-' + b.morsId); if (!t) return;
        const mb = BLOCCHI_ORA.find((x) => x.id === b.morsId);
        if (ed && mb) { const ms = mst(mb); ms.modo = 'sel'; ms.sel = new Set([mb.morsetti[+mm[1]].id]); const mdx = t.querySelector('[data-md]'); if (mdx) mdx.dispatchEvent(new CustomEvent('cbs-rid')); }
        t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.classList.add('cbs-lampo'); setTimeout(() => t.classList.remove('cbs-lampo'), 1400);
        return;
      }
      st.sel = g.dataset.id; const nb = rid(); nb.querySelector('.cbs-sdinfo')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }));
    if (ed) box.querySelectorAll('.cbs-sdin').forEach((x) => (x.oninput = () => { const p0 = x.selectionStart; x.value = x.value.toUpperCase(); x.setSelectionRange(p0, p0); onInput(x.dataset.p, x.value); }));
  }

  // ---------- zone della gru (foto monotrave / bitrave con i punti da toccare) ----------
  const ZONE_DEF = () => [{ k: 'quadro', nome: 'QUADRO ELETTRICO', blocchi: [] }, { k: 'carrello', nome: 'ZONA CARRELLO', blocchi: [] }, { k: 'pulsantiera', nome: 'DERIVAZIONE PULSANTIERA', blocchi: [] }, { k: 'ponte', nome: 'MOTORI PONTE', blocchi: [] }];
  const PUNTI = {
    monotrave: { img: 'img/cablaggio/monotrave.jpg', p: [['quadro', 24.7, 35], ['carrello', 49.4, 44.5], ['pulsantiera', 40.9, 76], ['ponte', 8.3, 45], ['ponte', 70.2, 6.6]] },
    bitrave: { img: 'img/cablaggio/bitrave.jpg', p: [['quadro', 24.2, 35.8], ['carrello', 45, 24.3], ['pulsantiera', 38.5, 77], ['ponte', 11, 47.3], ['ponte', 88.5, 16]] }
  };
  const zoneDi = (s) => { const z = ZONE_DEF(); (s.aree || []).forEach((a) => { const t = z.find((x) => x.k === a.k); if (t) Object.assign(t, a); }); return z; };
  function fotoGru(s, link) {
    const F = PUNTI[s.gru]; if (!F) return '';
    const z = zoneDi(s), n = (k) => z.findIndex((x) => x.k === k) + 1;
    return `<div class="cbs-foto"><img src="${F.img}" alt="${s.gru}" draggable="false">
      ${F.p.map(([k, x, y]) => { const a = z.find((q) => q.k === k), vuota = !a.blocchi.length;
        return `<a class="cbs-punto${vuota ? ' vuota' : ''}" ${link && !vuota ? `href="${link}/z/${k}"` : ''} style="left:${x}%;top:${y}%" aria-label="${esc(a.nome)}"><b>${n(k)}</b><span>${esc(a.nome)}</span></a>`; }).join('')}</div>`;
  }


  // ---------- pulsantiera: simbolo IEC del pulsante (testa a pressione «[», tratteggio, contatto NO o NC) ----------
  function simboloPuls(t) {
    const testa = `<path d="M6 50V74M6 50H2M6 74H2" class="cbs-pl"/><line x1="7" y1="62" x2="${t.tipo === 'NC' ? 31 : 24}" y2="62" class="cbs-pl cbs-pt"/>`;
    const fili = '<line x1="28" y1="0" x2="28" y2="40" class="cbs-pl"/><line x1="28" y1="84" x2="28" y2="118" class="cbs-pl"/>';
    const lama = t.tipo === 'NC' ? '<line x1="28" y1="40" x2="36" y2="40" class="cbs-pl"/><line x1="28" y1="84" x2="39" y2="36" class="cbs-pl"/>' : '<line x1="28" y1="84" x2="15" y2="44" class="cbs-pl"/>';
    return `<svg viewBox="0 0 44 118" class="cbs-psym">${fili}${lama}${testa}</svg>`;
  }
  // il disegno dei pulsanti (orizzontale: colonne come sul foglio · verticale: una riga per pulsante)
  // in modifica i cerchietti, i numeri e il nome sono caselle da scrivere direttamente
  let PSEL = null;   // pulsante selezionato in modifica (sotto: NO/NC, duplica, togli)
  function disegnoPuls(b, i, ed) {
    const v = b.orient === 'v';
    const c = (k, campo, cls) => `<input class="cbs-pi ${cls}" data-pi="${k}.${campo}" value="${esc(b.tasti[k][campo] || '')}" autocomplete="off" spellcheck="false" ${cls === 'cer' ? 'inputmode="numeric"' : ''} aria-label="${campo}">`;
    const cer = (val) => (val ? `<span class="cbs-cerchio">${esc(val)}</span>` : '<span class="cbs-cerchio nulla"></span>');
    return `<div class="cbs-scroll"><div class="cbs-prow ${v ? 'vert' : 'oriz'}" data-pr="${i}">${b.tasti.map((t, k) => `
      <div class="cbs-tasto${ed && PSEL === t.id ? ' sel' : ''}" data-tk="${i}.${k}">
        ${ed ? '<span class="cbs-presa" title="Trascina per spostare">⠿</span>' : ''}
        ${ed ? c(k, 'filo', 'cer') : cer(t.filo)}
        ${ed ? c(k, 'schema', 'num') : `<span class="cbs-pnum">${esc(t.schema || '')}</span>`}
        <span class="cbs-psbox">${simboloPuls(t)}${!v && !ed ? `<span class="cbs-pnv">${esc(t.nome)}</span>` : ''}</span>
        ${ed ? c(k, 'schemaSotto', 'num') : `<span class="cbs-pnum">${esc(t.schemaSotto || '')}</span>`}
        ${ed ? c(k, 'filoSotto', 'cer') : cer(t.filoSotto)}
        ${ed ? c(k, 'nome', 'nome') : v ? `<span class="cbs-pnome">${esc(t.nome)}</span>` : ''}
      </div>`).join('')}</div></div>`;
  }
  function pannelloPuls(b, i) {
    const k = b.tasti.findIndex((t) => t.id === PSEL); if (k < 0) return '';
    const t = b.tasti[k];
    return `<div class="cbs-ped cbs-ped2"><h4>Pulsante ${k + 1} di ${b.tasti.length}${t.nome ? ' · ' + esc(t.nome) : ''}</h4>
      <div class="cbs-ptipo"><button type="button" class="btn ghost${t.tipo === 'NO' ? ' on' : ''}" data-ptipo="${i}.${k}.NO">NO</button><button type="button" class="btn ghost${t.tipo === 'NC' ? ' on' : ''}" data-ptipo="${i}.${k}.NC">NC</button></div>
      <button type="button" class="btn ghost" data-pdup="${i}.${k}">⧉ Duplica</button>
      <button type="button" class="btn ghost danger" data-pdel="${i}.${k}" ${b.tasti.length > 1 ? '' : 'disabled'}>🗑 Togli</button>
      <button type="button" class="btn ghost" data-pok>Fatto</button></div>`;
  }

  // ---------- morsettiera: morsetti WDU / WPE con larghezze vere, ponticelli, gruppi per sezione ----------
  const MT = { 'WDU 2,5': { mm: 5.1, s: '2,5' }, 'WDU 4': { mm: 6.1, s: '4' }, 'WDU 6': { mm: 7.9, s: '6' }, 'WDU 10': { mm: 9.9, s: '10' }, 'WPE 4': { mm: 6.1, s: '4', pe: 1 }, 'WPE 6': { mm: 8, s: '6', pe: 1 }, 'WPE 10': { mm: 10, s: '10', pe: 1 } };
  const MT_NOMI = Object.keys(MT);
  const MPX = 4.2, MH = 150, MTOP = 26;
  const MST = {};   // stato di modifica per blocco: { modo, sel:Set, primo, multi }
  const mst = (b) => (MST[b.id] = MST[b.id] || { modo: 'sel', sel: new Set(), primo: null, multi: false });
  const mtipo = (m) => MT[m.tipo] || MT['WDU 2,5'];
  const mpos = (b) => { let x = 0; return b.morsetti.map((m) => { const w = mtipo(m).mm * MPX; const p = { x, w }; x += w; return p; }); };
  function morsSvg(b) {
    const pos = mpos(b), st = MST[b.id], W = pos.length ? pos[pos.length - 1].x + pos[pos.length - 1].w : 0;
    let s = `<svg class="cbs-ms" width="${W + 2}" height="${MTOP + MH + 58}" viewBox="-1 0 ${W + 2} ${MTOP + MH + 58}">
      <defs><pattern id="gv-${b.id}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="8" height="8" fill="#f4d21f"/><rect width="4" height="8" fill="#3aa346"/></pattern></defs>`;
    b.morsetti.forEach((m, i) => {
      const { x, w } = pos[i], t = mtipo(m), cx = x + w / 2, y = MTOP, r = Math.min(w * 0.32, 7);
      const vite = (yy) => `<circle cx="${cx}" cy="${yy}" r="${r}" fill="#eef0f2" stroke="#55595f" stroke-width=".8"/><line x1="${cx - w * 0.22}" y1="${yy}" x2="${cx + w * 0.22}" y2="${yy}" stroke="#55595f" stroke-width="1"/>`;
      s += `<g class="cbs-m${st && st.sel.has(m.id) ? ' sel' : ''}" data-mi="${i}"><title>${esc(m.nome)} · ${m.tipo}</title>
        <rect x="${x}" y="${y}" width="${w}" height="${MH}" fill="${t.pe ? `url(#gv-${b.id})` : m.ev ? '#f7a46b' : '#e9e3d1'}" stroke="#3d3a30" stroke-width="1"/>
        ${t.pe && m.ev ? `<rect x="${x}" y="${y}" width="${w}" height="${MH}" fill="#f7a46b" opacity=".55"/>` : ''}
        ${vite(y + 16)}${vite(y + MH - 16)}
        <rect class="cbs-mtarga" x="${x + w * 0.16}" y="${y + 56}" width="${w * 0.68}" height="${MH - 92}" rx="1.5" fill="#fff" stroke="#9a957f" stroke-width=".6"/>
        <text x="${cx}" y="${y + MH / 2 + 6}" transform="rotate(-90 ${cx} ${y + MH / 2 + 6})" text-anchor="middle" dominant-baseline="middle" font-size="${Math.min(11, w * 0.5)}" font-weight="800" fill="#1d2433" pointer-events="none">${esc(String(m.nome || "").toUpperCase())}</text>
        <rect class="cbs-msel" x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${MH - 2}"/>
        <rect class="cbs-mtarga-hit" data-mt="${i}" x="${x + w * 0.1}" y="${y + 50}" width="${w * 0.8}" height="${MH - 80}"/></g>`;
    });
    const livelli = [];
    (b.ponti || []).forEach((p, k) => {
      let a = b.morsetti.findIndex((m) => m.id === p.da), c = b.morsetti.findIndex((m) => m.id === p.a); if (a < 0 || c < 0) return; if (a > c) [a, c] = [c, a];
      let l = 0; while ((livelli[l] || []).some(([x, y]) => !(c < x || a > y))) l++; (livelli[l] = livelli[l] || []).push([a, c]);
      const y = MTOP + 48 + (l % 2 ? -14 : 0) + Math.floor(l / 2) * 8, x1 = pos[a].x + pos[a].w / 2, x2 = pos[c].x + pos[c].w / 2;
      s += `<g class="cbs-ponte" data-po="${k}"><title>Ponticello</title><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#1d2433" stroke-width="2.2"/>` +
        Array.from({ length: c - a + 1 }, (_, j) => `<circle cx="${pos[a + j].x + pos[a + j].w / 2}" cy="${y}" r="3.4" fill="#1d2433"/>`).join('') +
        `<rect x="${x1 - 6}" y="${y - 9}" width="${x2 - x1 + 12}" height="18" fill="transparent"/></g>`;
    });
    let g0 = 0;
    for (let i = 1; i <= b.morsetti.length; i++) {
      if (i < b.morsetti.length && mtipo(b.morsetti[i]).s === mtipo(b.morsetti[g0]).s) continue;
      const x1 = pos[g0].x + 3, x2 = pos[i - 1].x + pos[i - 1].w - 3, y = MTOP + MH + 10;
      s += `<path d="M${x1} ${y}V${y + 8}H${x2}V${y}" fill="none" stroke="#1d2433" stroke-width="1.2"/><text x="${(x1 + x2) / 2}" y="${y + 28}" text-anchor="middle" font-size="14" font-weight="800" fill="#1d2433">Ø ${mtipo(b.morsetti[g0]).s}</text>`;
      g0 = i;
    }
    return s + '</svg>';
  }
  function morsDistinta(b) {
    const c = {}; b.morsetti.forEach((m) => (c[m.tipo] = (c[m.tipo] || 0) + 1));
    const pz = {}; (b.ponti || []).forEach((p) => { const a = b.morsetti.findIndex((m) => m.id === p.da), d = b.morsetti.findIndex((m) => m.id === p.a); if (a < 0 || d < 0) return; const n = Math.abs(d - a) + 1; pz[n] = (pz[n] || 0) + 1; });
    return `<div class="cbs-mdist"><span>Distinta:</span>${MT_NOMI.filter((t) => c[t]).map((t) => `<span><b>${c[t]}</b> × ${t}</span>`).join('')}${Object.keys(pz).map((n) => `<span><b>${pz[n]}</b> × ponticello da ${n}</span>`).join('')}</div>`;
  }
  function morsHtml(b, i, ed) {
    if (!ed) return `<div class="cbs-scroll"><div class="cbs-mriga">${morsSvg(b)}</div></div>${morsDistinta(b)}`;
    const st = mst(b), pos = mpos(b);
    return `<div class="cbs-mbar"><button type="button" class="btn ghost${st.modo === 'sel' ? ' on' : ''}" data-mmodo="sel">✋ Seleziona</button><button type="button" class="btn ghost${st.modo === 'ponte' ? ' on' : ''}" data-mmodo="ponte">🔗 Ponticelli</button>
        ${st.modo === 'sel' ? `<label class="cbs-mmulti"><input type="checkbox" data-mmulti ${st.multi ? 'checked' : ''}> selezione multipla</label>` : ''}<span class="grow"></span><button type="button" class="btn ghost" data-madd>+ Morsetto</button></div>
      ${st.modo === 'ponte' ? `<p class="cbs-mhint">${st.primo ? 'Ora tocca l\'<b>ultimo</b> morsetto del ponticello.' : 'Tocca il <b>primo</b> morsetto del ponticello, poi l\'ultimo. Tocca un ponticello per toglierlo.'}</p>` : ''}
      <div class="cbs-scroll"><div class="cbs-mriga">
        ${st.modo === 'sel' ? `<div class="cbs-mprese">${b.morsetti.map((m, k) => `<span class="cbs-mpresa" data-mpr="${k}" style="width:${pos[k].w}px" title="Trascina">⠿</span>`).join('')}</div>` : ''}
        <div class="cbs-msvg">${morsSvg(b)}</div></div></div>
      ${morsDistinta(b)}<div data-mpan></div>`;
  }
  function morsPannello(b) {
    const st = mst(b), scelti = b.morsetti.filter((m) => st.sel.has(m.id)); if (st.modo !== 'sel' || !scelti.length) return '';
    const uno = scelti.length === 1 ? scelti[0] : null, tipo = scelti.every((m) => m.tipo === scelti[0].tipo) ? scelti[0].tipo : '';
    return `<div class="cbs-ped cbs-mped"><h4>${uno ? `Morsetto ${b.morsetti.indexOf(uno) + 1} di ${b.morsetti.length}` : `${scelti.length} morsetti selezionati`}</h4>
      ${uno ? `<label>Nome<input class="cbs-in cbs-pin-in" data-mnome value="${esc(uno.nome)}" autocomplete="off"></label>` : ''}
      <div class="cbs-mtipi">${MT_NOMI.map((t) => `<button type="button" class="btn ghost${MT[t].pe ? ' pe' : ''}${t === tipo ? ' on' : ''}" data-mtipo="${t}">${t}</button>`).join('')}</div>
      <div class="cbs-pedb"><button type="button" class="btn ghost" data-mev>🟧 Evidenzia (variante)</button><button type="button" class="btn ghost danger" data-mdel>🗑 Togli</button><button type="button" class="btn ghost" data-mok>Fatto</button></div></div>`;
  }

  // simbolo del contatto: NA (aperto) o NC (chiuso)
  const contatto = (c) => c === 'NC'
    ? '<svg class="cbs-ct" viewBox="0 0 64 16" aria-label="contatto NC"><path d="M0 12H22L40 4M44 2V12H64M40 4V12" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'
    : '<svg class="cbs-ct" viewBox="0 0 64 16" aria-label="contatto NA"><path d="M0 12H22L40 3M44 3V12H64" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';

  // ---------- disegno di un blocco: in lettura (ed = false) o con i campi da scrivere (ed = true) ----------
  // p = percorso del valore nella bozza, es. «b.2.righe.3.sx.0»
  const cella = (ed, p, val, cls = '') => ed
    ? `<input class="cbs-in ${cls}" data-p="${p}" value="${esc(val ?? '')}" autocomplete="off" spellcheck="false">`
    : `<span class="${cls}">${esc(String(val ?? '').toUpperCase())}</span>`;
  function bloccoHtml(b, i, ed) {
    const bp = 'b.' + i;
    const testa = `<div class="cbs-bt">${ed ? `<input class="cbs-in cbs-tit" data-p="${bp}.titolo" value="${esc(b.titolo)}" placeholder="Titolo del blocco">` : `<h3>${esc(b.titolo)}</h3>`}
      ${ed ? `<div class="cbs-strum">
          <button type="button" class="cbs-mini" data-su="${i}" aria-label="Sposta su" ${i ? '' : 'disabled'}>↑</button>
          <button type="button" class="cbs-mini" data-giu="${i}" aria-label="Sposta giù">↓</button>
          <button type="button" class="cbs-mini" data-imp="${i}" aria-label="Impostazioni del blocco">⚙</button>
          <button type="button" class="cbs-mini" data-dupb="${i}" aria-label="Duplica il blocco" title="Duplica il blocco">⧉</button>
          <button type="button" class="cbs-mini danger" data-del="${i}" aria-label="Elimina blocco">🗑</button></div>` : ''}</div>`;
    let corpo = '';
    if (b.tipo === 'conn') {
      const n = b.pin / 2;
      corpo = `<div class="cbs-scroll"><table class="cbs-t cbs-conn"><tr>
          ${b.colSx.map((c, k) => `<th>${cella(ed, `${bp}.colSx.${k}`, c, 'th')}</th>`).join('')}
          <th colspan="2" class="cbs-pinh">${cella(ed, `${bp}.nomePin`, b.nomePin, 'th')}</th>
          ${b.colDx.map((c, k) => `<th>${cella(ed, `${bp}.colDx.${k}`, c, 'th')}</th>`).join('')}</tr>
        ${b.righe.map((r, j) => `<tr>
          ${r.sx.map((x, k) => `<td>${cella(ed, `${bp}.righe.${j}.sx.${k}`, x)}</td>`).join('')}
          <td class="cbs-pin l${j === 0 ? ' top' : ''}${j === n - 1 ? ' bot' : ''}">${j + 1}</td><td class="cbs-pin r${j === 0 ? ' top' : ''}${j === n - 1 ? ' bot' : ''}">${j + 1 + n}</td>
          ${r.dx.map((x, k) => `<td>${cella(ed, `${bp}.righe.${j}.dx.${k}`, x)}</td>`).join('')}</tr>`).join('')}
        </table></div>
        ${ed || b.nota ? `<p class="cbs-nota">⏚ ${cella(ed, `${bp}.nota`, b.nota, 'nota')}</p>` : ''}`;
    } else if (b.tipo === 'fc') {
      corpo = `<div class="cbs-scroll"><table class="cbs-t cbs-fc">${b.righe.map((r, j) => { const rp = `${bp}.righe.${j}`; return `<tr>
          <td class="cbs-sig">${cella(ed, rp + '.sig', r.sig, 'sig')}</td><td>${cella(ed, rp + '.a', r.a)}</td><td>${cella(ed, rp + '.p1', r.p1)}</td>
          <td class="cbs-ctd">${ed ? `<button type="button" class="cbs-ctb" data-ct="${i}.${j}" title="Tocca per cambiare NA / NC">${contatto(r.c)}<small>${r.c}</small></button>` : contatto(r.c)}</td>
          <td>${cella(ed, rp + '.p2', r.p2)}</td><td>${cella(ed, rp + '.b', r.b)}</td><td class="cbs-fcn">${cella(ed, rp + '.nota', r.nota, 'nota')}</td>
          ${ed ? `<td><button type="button" class="cbs-mini danger" data-delr="${i}.${j}" aria-label="Togli riga" ${b.righe.length > 1 ? '' : 'disabled'}>×</button></td>` : ''}</tr>`; }).join('')}</table></div>
        ${ed ? `<button type="button" class="btn ghost small" data-addr="${i}">+ Riga</button>` : ''}`;
    } else if (b.tipo === 'scat') {
      corpo = scatHtml(b, i, ed);
    } else if (b.tipo === 'mors') {
      corpo = `<div data-md="${i}">${morsHtml(b, i, ed)}</div>`;
    } else if (b.tipo === 'puls') {
      corpo = `<div data-pd="${i}">${disegnoPuls(b, i, ed)}</div>
        ${ed ? `<p class="cbs-pnota">Scrivi direttamente nei cerchietti, nei numeri e nel nome · tocca il simbolo per NO / NC, duplica o togli · ⠿ per spostare.</p><div data-pp="${i}">${pannelloPuls(b, i)}</div>
          <button type="button" class="btn ghost small" data-padd="${i}">+ Pulsante</button>` : ''}`;
    } else {
      corpo = `<div class="cbs-scroll"><table class="cbs-t cbs-cavo"><tr>${b.colonne.map((c, k) => `<th>${cella(ed, `${bp}.colonne.${k}`, c, 'th')}</th>`).join('')}${ed ? '<th></th>' : ''}</tr>
        ${b.righe.map((r, j) => `<tr>${r.map((x, k) => `<td>${cella(ed, `${bp}.righe.${j}.${k}`, x)}</td>`).join('')}
          ${ed ? `<td><button type="button" class="cbs-mini danger" data-delr="${i}.${j}" aria-label="Togli riga" ${b.righe.length > 1 ? '' : 'disabled'}>×</button></td>` : ''}</tr>`).join('')}</table></div>
        ${ed ? `<button type="button" class="btn ghost small" data-addr="${i}">+ Riga</button>` : ''}`;
    }
    // note libere del blocco (in modifica sempre, in lettura e in stampa solo se scritte)
    const note = ed ? `<label class="cbs-notebox"><span>Note</span><textarea class="cbs-in cbs-note" data-p="${bp}.note" rows="${Math.max(2, String(b.note || '').split('\n').length)}" placeholder="Scrivi qui eventuali note…" spellcheck="false">${esc(b.note || '')}</textarea></label>`
      : (String(b.note || '').trim() ? `<div class="cbs-notebox cbs-notel"><span>Note</span><p>${esc(String(b.note).toUpperCase()).replace(/\n/g, '<br>')}</p></div>` : '');
    return `<section class="cbs-blocco cbs-${b.tipo}" id="cb-${b.id}">${testa}${corpo}${note}</section>`;
  }

  // ---------- ELENCO ----------
  let cerca = '';
  function elenco(el, S) {
    const tutte = schede(S), q = cerca.trim().toLowerCase();
    const lista = tutte.filter((s) => !q || [s.nome, s.note, ...(s.blocchi || []).map((b) => b.titolo)].join(' ').toLowerCase().includes(q));
    el.innerHTML = `
      <section class="cli cbs">
        <div class="sez-head"><h1>Configuratore cablaggio ${info('Qui crei le tue schede di cablaggio partendo da zero. Ogni scheda è fatta di blocchi: <b>presa / spina</b> (connettore a 16, 24 o 32 poli), <b>finecorsa</b>, <b>cavo</b>, <b>pulsantiera</b>, <b>morsettiera</b> e <b>scatola di derivazione</b>. Puoi scegliere la foto della gru (monotrave o bitrave) e mettere i blocchi nelle sue zone. La struttura la scegli tu, e anche tutto quello che c\'è scritto. Le schede valgono per tutti i dispositivi. Il vecchio configuratore è nel menu ⋯.')}</h1>
          ${UI.menu([{ t: '📄 Rapporti di collaudo', href: '#/cablaggio/rapporti' }, { t: '🗄 Configuratore vecchio', href: '#/cablaggio/vecchio' }])}</div>
        ${puoModificare() ? '<button type="button" class="sg2-inizia ap-nuovo" id="csNuova">＋ Nuova scheda di cablaggio</button>' : ''}
        ${tutte.length > 5 ? `<input type="search" id="csQ" class="cerca" placeholder="Cerca una scheda…" value="${esc(cerca)}">` : ''}
        ${lista.length ? `<div class="sg2-lista">${lista.map((s) => `<a class="sg2-riga" href="#/cablaggio/s/${s.id}">
            <span class="d">${esc(s.nome || 'Senza nome')}<small>${(s.blocchi || []).length} blocchi${s.agg?.il ? ' · modificata il ' + quando(s.agg.il) + (s.agg.da ? ' da ' + esc(s.agg.da) : '') : ''}</small></span><span class="cbs-fr">›</span></a>`).join('')}</div>`
          : `<p class="nessuno">${tutte.length ? 'Nessuna scheda trovata.' : 'Nessuna scheda ancora.' + (puoModificare() ? ' Crea la prima con «＋ Nuova scheda di cablaggio».' : '')}</p>`}
      </section>`;
    el.querySelector('#csNuova')?.addEventListener('click', () => nuovaScheda(S));
    const q2 = el.querySelector('#csQ');
    q2 && (q2.oninput = () => { cerca = q2.value; const p = q2.selectionStart; App.ridisegna(); const n = document.getElementById('csQ'); n.focus(); n.setSelectionRange(p, p); });
    return { titolo: 'Configuratore cablaggio', indietro: '#/gho', live: true };
  }

  function nuovaScheda(S) {
    UI.modal({ titolo: 'Nuova scheda di cablaggio', infoTxt: 'Dai un nome alla scheda (es. «GHO CORIMAG 1092-1093» o «MONOTRAVE DONATI 2000 kg»). Poi aggiungi i blocchi uno alla volta.',
      valori: { nome: '' }, campi: [{ k: 'nome', label: 'Nome della scheda', req: true, maiuscolo: true }],
      onSalva: async (v) => {
        const d = { id: 'cab-' + uid(), tipo: 'cabScheda', nome: String(v.nome || '').trim().toUpperCase(), blocchi: [], agg: { il: new Date().toISOString(), da: UT.breve(UT.attuale()) } };
        await UI.salva('impostazioni', d);
        UT.registra?.('crea', 'Scheda di cablaggio ' + d.nome);
        location.hash = `#/cablaggio/s/${d.id}/modifica`;
      } });
  }

  // ---------- SCHEDA: lettura ----------
  // blocchi larghi (pulsantiera, morsettiera, scatola) a tutta riga; gli altri in colonne
  const LARGHI = ['puls', 'mors', 'scat'];
  function blocchiHtml(lista, compatta) {
    if (!compatta) return `<div class="cbs-blocchi">${lista.map(([b, i]) => bloccoHtml(b, i, false)).join('')}</div>`;
    // compatta: prima i piccoli, uno sotto l'altro in colonne (riempiono i buchi), poi i larghi
    const pic = lista.filter(([b]) => !LARGHI.includes(b.tipo)), lar = lista.filter(([b]) => LARGHI.includes(b.tipo));
    return `${pic.length ? `<div class="cbs-colonne">${pic.map(([b, i]) => bloccoHtml(b, i, false)).join('')}</div>` : ''}${lar.length ? `<div class="cbs-blocchi">${lar.map(([b, i]) => bloccoHtml(b, i, false)).join('')}</div>` : ''}`;
  }
  function legaLettura(el, s) {
    el.querySelectorAll('[data-sdb]').forEach((x) => { const i = +x.dataset.sdb; legaScat(x, s.blocchi[i], i, false); });
  }
  // Stampa A4: un foglio per zona. Per ogni foglio si prova verticale e orizzontale con varie larghezze di impaginazione
  // e si tiene la combinazione che rende tutto più grande possibile (anche ingrandendo se c'è poco).
  function stampa(titolo) {
    const t0 = document.title; document.title = 'Cablaggio_' + String(titolo || '').replace(/[^\w\-]+/g, '_');
    document.body.classList.add('cbs-stampa');
    const FOGLIO = { P: [718, 1047], L: [1047, 718] }, SICURO = 0.96;   // 190×277 mm utili a 96 dpi
    const pagine = [...document.querySelectorAll('.cbs-scheda .cbs-pag')].filter((p) => !p.closest('.cbs-soloschermo'));
    const pulisci = () => pagine.forEach((p) => { p.style.height = ''; p.style.width = ''; p.classList.remove('cbs-pagP', 'cbs-pagL'); const n = p.querySelector('.cbs-pin'); if (n) { n.style.transform = ''; n.style.width = ''; } });
    pulisci();
    // un solo orientamento per tutta la stampa (Chrome rimpicciolisce tutto se si mischiano fogli verticali e orizzontali):
    // per ogni foglio si cerca la disposizione migliore nei due orientamenti, poi vince l'orientamento che riempie di più
    const LARG = [380, 480, 600, 718, 800, 900, 1047, 1150, 1300, 1450];
    const prove = pagine.map((p) => {
      const n = p.querySelector('.cbs-pin'), best = {}; if (!n) return null;
      LARG.forEach((wd) => {
        n.style.width = wd + 'px';
        const w = Math.max(wd, n.scrollWidth), h = n.scrollHeight;
        ['P', 'L'].forEach((o) => { const f = Math.min(FOGLIO[o][0] / w, FOGLIO[o][1] * SICURO / h, 3), pieno = (f * f * w * h) / (FOGLIO[o][0] * FOGLIO[o][1]), bo = best[o];
          if (!bo || pieno > bo.pieno + 0.02 || (pieno > bo.pieno - 0.02 && f > bo.f)) best[o] = { f, wd, h, pieno }; });
      });
      return best;
    });
    const tot = (o) => prove.reduce((a, x) => a + (x ? x[o].pieno : 0), 0), O = tot('L') >= tot('P') ? 'L' : 'P';
    document.body.classList.add('cbs-stampa' + O);
    pagine.forEach((p, k) => {
      const n = p.querySelector('.cbs-pin'), x = prove[k] && prove[k][O]; if (!x) return;
      n.style.width = x.wd + 'px'; n.style.transform = `scale(${x.f.toFixed(3)})`;
      p.classList.add('cbs-pag' + O); p.style.width = FOGLIO[O][0] + 'px'; p.style.height = Math.floor(x.h * x.f) + 'px';
    });
    const fine = () => { document.body.classList.remove('cbs-stampa', 'cbs-stampaL', 'cbs-stampaP'); pulisci(); document.title = t0; window.removeEventListener('afterprint', fine); };
    window.addEventListener('afterprint', fine);
    window.print();
    setTimeout(fine, 1500);
  }
  function vista(el, S, id, zona) {
    const s = S.impostazioni.find((d) => d.id === id);
    if (!s) { el.innerHTML = '<p class="nessuno">Scheda non trovata.</p>'; return { titolo: 'Configuratore cablaggio', indietro: '#/cablaggio' }; }
    BLOCCHI_ORA = s.blocchi || [];
    const tutti = (s.blocchi || []).map((b, i) => [b, i]), base = `#/cablaggio/s/${id}`;
    const z = zoneDi(s), conGru = !!PUNTI[s.gru];
    const inZona = new Set(conGru ? z.flatMap((a) => a.blocchi) : []);
    // blocchi di una zona nell'ordine della scheda (un blocco può stare in più zone)
    const diZona = (a) => tutti.filter(([b]) => a.blocchi.includes(b.id));
    const pag = (num, nome, lista) => `<div class="cbs-pag"><div class="cbs-pin"><p class="cbs-ptit">${esc(s.nome || '')}</p>
      ${nome ? `<h2 class="cbs-zt">${num ? `<span>${num}</span>` : ''}${esc(nome)}</h2>` : ''}${blocchiHtml(lista, s.compatta)}</div></div>`;
    // in stampa: ogni morsettiera e ogni scatola su un foglio suo, gli altri blocchi insieme
    const testaF = (num, nome, sotto) => `<p class="cbs-ptit">${esc(s.nome || '')}</p>${nome ? `<h2 class="cbs-zt">${num ? `<span>${num}</span>` : ''}${esc(nome)}${sotto ? ` <small>· ${esc(sotto)}</small>` : ''}</h2>` : ''}`;
    const fogli = (num, nome, lista) => {
      const resto = lista.filter(([b]) => b.tipo !== 'mors' && b.tipo !== 'scat');
      return (resto.length ? `<div class="cbs-pag"><div class="cbs-pin">${testaF(num, nome)}${blocchiHtml(resto, s.compatta)}</div></div>` : '')
        + lista.filter(([b]) => b.tipo === 'mors').map(([b, i]) => `<div class="cbs-pag"><div class="cbs-pin">${testaF(num, nome)}<div class="cbs-uno">${bloccoHtml(b, i, false)}</div></div></div>`).join('')
        + lista.filter(([b]) => b.tipo === 'scat').map(([b]) => { const [viste, mat] = scatStampaHtml(b);
          return `<div class="cbs-pag"><div class="cbs-pin">${testaF(num, nome, b.titolo)}${viste}</div></div><div class="cbs-pag"><div class="cbs-pin">${testaF(num, nome, b.titolo + ' · MATERIALE')}${mat}</div></div>`; }).join('');
    };
    const conStampa = (num, nome, lista) => `<div class="cbs-soloschermo">${pag(num, nome, lista)}</div><div class="cbs-solostampa">${fogli(num, nome, lista)}</div>`;
    let corpo;
    const altri = tutti.filter(([b]) => !inZona.has(b.id));
    if (zona === 'altri') {
      corpo = altri.length ? conStampa(0, 'Altri blocchi', altri) : '<p class="nessuno">Nessun blocco.</p>';
    } else if (zona) {
      const a = z.find((x) => x.k === zona), lista = a ? diZona(a) : [];
      corpo = lista.length ? conStampa(z.indexOf(a) + 1, a.nome, lista) : '<p class="nessuno">Nessun blocco in questa zona.</p>';
    } else if (!conGru) {
      corpo = tutti.length ? conStampa(0, '', tutti) : '<p class="nessuno">La scheda è vuota.</p>';
    } else {
      corpo = `${conGru ? `<div class="card cbs-gru cbs-pag cbs-pfoto"><div class="cbs-pin"><p class="cbs-ptit">${esc(s.nome || '')}</p><h2>Tocca la zona della gru</h2>${fotoGru(s, base)}
          <div class="cbs-zbtn">${z.map((a, k) => `<a class="btn ghost${a.blocchi.length ? '' : ' disabled'}" ${a.blocchi.length ? `href="${base}/z/${a.k}"` : ''}><span class="cbs-zn">${k + 1}</span>${esc(a.nome)}<small>${a.blocchi.length}</small></a>`).join('')}${altri.length ? `<a class="btn ghost" href="${base}/z/altri"><span class="cbs-zn cbs-zn0">+</span>ALTRI BLOCCHI<small>${altri.length}</small></a>` : ''}</div>
          <ol class="cbs-indice">${z.filter((a) => a.blocchi.length).map((a) => `<li><b>${z.indexOf(a) + 1} · ${esc(a.nome)}</b> — ${diZona(a).map(([b]) => esc(b.titolo || NOME_TIPO[b.tipo])).join(', ')}</li>`).join('')}</ol></div></div>` : ''}
        <div class="cbs-solostampa">${z.map((a, k) => { const l = diZona(a); return l.length ? fogli(k + 1, a.nome, l) : ''; }).join('')}${altri.length ? fogli(0, 'Altri blocchi', altri) : ''}</div>`;
    }
    el.innerHTML = `
      <section class="cbs cbs-scheda">
        <div class="card sg2-testa"><div class="grow"><h1>${esc(s.nome || 'Senza nome')}${zona ? '' : ''}</h1>
          <p class="muted small">${(s.blocchi || []).length} blocchi${s.gru ? ' · ' + s.gru.toUpperCase() : ''}${s.agg?.il ? ' · modificata il ' + quando(s.agg.il) + (s.agg.da ? ' da ' + esc(s.agg.da) : '') : ''}</p></div>
          ${puoModificare() ? UI.menu([{ t: '✏️ Modifica', href: `${base}/modifica` }, { t: '⧉ Duplica', id: 'csDup' }, { t: '🗑 Elimina scheda', id: 'csDel', cls: 'txt-ko' }]) : ''}</div>
        <div class="cbs-azioni no-print">
          ${puoModificare() ? `<a class="btn ghost" href="${base}/modifica">✏️ Modifica</a>` : ''}
          ${zona || !conGru ? `<button type="button" class="btn ghost" id="csComp" title="Riordina i blocchi per occupare meno spazio">${s.compatta ? '▤ In ordine' : '▦ Compatta'}</button>` : ''}
          <button type="button" class="btn ghost" id="csStampa">🖨 Stampa</button></div>
        ${corpo}
      </section>`;
    legaLettura(el, s);
    const cmp = el.querySelector('#csComp'); if (cmp) cmp.onclick = async () => {
      const d = clona(s); d.compatta = !s.compatta;
      if (UT.solaLettura() || !puoModificare()) { s.compatta = d.compatta; App.ridisegna(); return; }   // chi non modifica: solo su questo schermo
      await UI.salva('impostazioni', d); App.ridisegna();
    };
    el.querySelector('#csStampa').onclick = () => stampa(s.nome + (zona ? '_' + zona : ''));
    el.querySelector('#csDup')?.addEventListener('click', async () => {
      const d = clona(s), mappa = {}; d.id = 'cab-' + uid(); d.nome = (s.nome || '') + ' (COPIA)';
      d.blocchi.forEach((b) => { const n = uid(); mappa[b.id] = n; b.id = n; });
      d.blocchi.forEach((b) => { if (b.morsId) b.morsId = mappa[b.morsId] || ''; });
      (d.aree || []).forEach((a) => (a.blocchi = a.blocchi.map((x) => mappa[x]).filter(Boolean)));
      d.agg = { il: new Date().toISOString(), da: UT.breve(UT.attuale()) };
      await UI.salva('impostazioni', d); UI.toast('Scheda duplicata', 'ok'); location.hash = `#/cablaggio/s/${d.id}/modifica`;
    });
    el.querySelector('#csDel')?.addEventListener('click', async () => {
      if (!UI.conferma(`Eliminare la scheda «${s.nome}»?\n\nNon si potrà recuperare.`)) return;
      await Backend.remove('impostazioni', s.id); UT.registra?.('elimina', 'Scheda di cablaggio ' + s.nome); UI.toast('Scheda eliminata'); location.hash = '#/cablaggio';
    });
    return { titolo: zona === 'altri' ? 'Altri blocchi' : zona ? (z.find((x) => x.k === zona) || {}).nome || 'Zona' : 'Configuratore cablaggio', indietro: zona ? base : '#/cablaggio', live: true };
  }

  // ---------- SCHEDA: modifica ----------
  function modifica(el, S, id) {
    const orig = S.impostazioni.find((d) => d.id === id);
    if (!orig) { el.innerHTML = '<p class="nessuno">Scheda non trovata.</p>'; return { titolo: 'Configuratore cablaggio', indietro: '#/cablaggio' }; }
    if (!puoModificare()) { location.hash = `#/cablaggio/s/${id}`; return null; }
    const bz = clona(orig); bz.blocchi = bz.blocchi || []; bz.aree = zoneDi(bz);
    try { const m = JSON.parse((S.impostazioni.find((x) => x.id === 'modificheCablaggio') || {}).json || '{}'); const v = m['misia/scatola-derivazione']; SCAT_VECCHI = v && v.scatola && v.scatola.pressacavi ? v.scatola : null; } catch (e) { SCAT_VECCHI = null; }
    let sporco = false;
    App.proteggi(() => sporco);
    const segna = () => { sporco = true; const b = el.querySelector('#csSalva'); if (b) b.classList.add('pulsa'); };
    const imposta = (p, v) => { const k = p.split('.'); let o = { b: bz.blocchi }; for (let i = 0; i < k.length - 1; i++) o = o[k[i]]; o[k[k.length - 1]] = v; };
    // disegno della gru e zone: nome modificabile, blocchi da mettere dentro (un blocco sta in una zona sola)
    const gruHtml = () => `<div class="card cbs-gruc"><label>Disegno della gru<select id="csGru">${[['', 'Nessuno'], ['monotrave', 'Monotrave'], ['bitrave', 'Bitrave']].map(([v, t]) => `<option value="${v}" ${bz.gru === v || (!bz.gru && !v) ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      ${PUNTI[bz.gru] ? `${fotoGru(bz, '')}<p class="muted small">Dai il nome alle zone e tocca i blocchi da mettere dentro ciascuna. Lo stesso blocco può stare in più zone; quelli in nessuna zona finiscono in «Altri blocchi». Salvando, i blocchi si mettono in ordine di zona.</p>
        ${bz.aree.map((a, k) => `<div class="cbs-zed"><div class="cbs-zedt"><span class="cbs-zn">${k + 1}</span><input class="cbs-in cbs-zin" data-z="${k}" value="${esc(a.nome)}" autocomplete="off"></div>
          <div class="cbs-chips">${bz.blocchi.map((b) => { const qui = a.blocchi.includes(b.id), alt = bz.aree.map((x, j) => (j !== k && x.blocchi.includes(b.id) ? j + 1 : 0)).filter(Boolean); return `<button type="button" class="cbs-chip${qui ? ' on' : ''}" data-zb="${k}.${b.id}">${esc(b.titolo || NOME_TIPO[b.tipo])}${alt.map((n) => `<i>${n}</i>`).join('')}</button>`; }).join('') || '<span class="muted small">Prima aggiungi dei blocchi.</span>'}</div></div>`).join('')}` : ''}</div>`;
    const disegna = (scorriA) => {
      BLOCCHI_ORA = bz.blocchi;
      el.innerHTML = `
        <section class="cbs cbs-scheda cbs-mod">
          <div class="card"><label>Nome della scheda<input id="csNome" class="cbs-nome" value="${esc(bz.nome || '')}" autocomplete="off"></label>
            <p class="muted small">Scrivi direttamente nelle caselle. ⚙ cambia la struttura del blocco (poli, colonne, orientamento), ↑ ↓ lo spostano.</p></div>
          ${gruHtml()}
          <div class="cbs-blocchi">${bz.blocchi.map((b, i) => bloccoHtml(b, i, true)).join('') || '<p class="nessuno">Nessun blocco: aggiungine uno qui sotto.</p>'}</div>
          <div class="cbs-agg"><span>Aggiungi un blocco</span>
            <button type="button" class="btn ghost" data-nuovo="conn">🔌 Presa / spina</button>
            <button type="button" class="btn ghost" data-nuovo="fc">⛔ Finecorsa</button>
            <button type="button" class="btn ghost" data-nuovo="cavo">〰 Cavo</button>
            <button type="button" class="btn ghost" data-nuovo="puls">🎛 Pulsantiera</button>
            <button type="button" class="btn ghost" data-nuovo="mors">▥ Morsettiera</button>
            <button type="button" class="btn ghost" data-nuovo="scat">📦 Scatola di derivazione</button>
            ${schede(S).some((x) => x.id !== id && (x.blocchi || []).length) ? '<button type="button" class="btn ghost cbs-copia" id="csCopia">⧉ Copia blocchi da un\'altra scheda</button>' : ''}</div>
          <div class="azioni-form cbs-salvabar"><a class="btn ghost" href="#/cablaggio/s/${id}">Chiudi</a><span class="grow"></span><button type="button" class="btn" id="csSalva">💾 Salva</button></div>
        </section>`;
      const nm = el.querySelector('#csNome'); nm.oninput = () => { bz.nome = nm.value.toUpperCase(); segna(); };
      el.querySelectorAll('.cbs-in[data-p]').forEach((x) => (x.oninput = () => { const p0 = x.selectionStart; x.value = x.value.toUpperCase(); x.setSelectionRange(p0, p0); imposta(x.dataset.p, x.value); segna(); }));
      el.querySelectorAll('[data-su]').forEach((x) => (x.onclick = () => { const i = +x.dataset.su; [bz.blocchi[i - 1], bz.blocchi[i]] = [bz.blocchi[i], bz.blocchi[i - 1]]; segna(); disegna(bz.blocchi[i - 1].id); }));
      el.querySelectorAll('[data-giu]').forEach((x) => (x.onclick = () => { const i = +x.dataset.giu; if (i >= bz.blocchi.length - 1) return; [bz.blocchi[i + 1], bz.blocchi[i]] = [bz.blocchi[i], bz.blocchi[i + 1]]; segna(); disegna(bz.blocchi[i + 1].id); }));
      el.querySelectorAll('[data-del]').forEach((x) => (x.onclick = () => { const b = bz.blocchi[+x.dataset.del]; if (!UI.conferma(`Togliere il blocco «${b.titolo}»?`)) return; bz.blocchi.splice(+x.dataset.del, 1); segna(); disegna(); }));
      el.querySelectorAll('[data-ct]').forEach((x) => (x.onclick = () => { const [i, j] = x.dataset.ct.split('.').map(Number); const r = bz.blocchi[i].righe[j]; r.c = r.c === 'NC' ? 'NA' : 'NC'; segna(); disegna(); }));
      el.querySelectorAll('[data-addr]').forEach((x) => (x.onclick = () => {
        const b = bz.blocchi[+x.dataset.addr];
        if (b.tipo === 'fc') b.righe.push({ sig: String.fromCharCode(65 + b.righe.length), a: '', p1: '', c: 'NA', p2: '', b: '', nota: '' });
        else b.righe.push(b.colonne.map((_, k) => (k === 0 ? String(b.righe.filter((r) => /^\d+$/.test(r[0])).length + 1) : '')));
        segna(); disegna(b.id);
      }));
      el.querySelectorAll('[data-delr]').forEach((x) => (x.onclick = () => { const [i, j] = x.dataset.delr.split('.').map(Number); bz.blocchi[i].righe.splice(j, 1); segna(); disegna(bz.blocchi[i].id); }));
      el.querySelectorAll('[data-imp]').forEach((x) => (x.onclick = () => impostazioni(+x.dataset.imp)));
      // duplica: la copia va subito sotto l'originale, con «(COPIA)» nel titolo
      el.querySelectorAll('[data-dupb]').forEach((x) => (x.onclick = () => { const i = +x.dataset.dupb, c = clona(bz.blocchi[i]); c.id = uid(); c.titolo = (c.titolo || '') + ' (COPIA)'; bz.blocchi.splice(i + 1, 0, c); segna(); disegna(c.id); UI.toast('Blocco duplicato: cambia il titolo e i valori', 'ok'); }));
      el.querySelectorAll('[data-nuovo]').forEach((x) => (x.onclick = () => nuovoBlocco(x.dataset.nuovo)));
      el.querySelector('#csCopia')?.addEventListener('click', copiaDa);
      el.querySelector('#csSalva').onclick = salva;
      el.querySelectorAll('[data-pd]').forEach((c) => legaPuls(+c.dataset.pd));
      el.querySelectorAll('[data-md]').forEach((c) => legaMors(+c.dataset.md));
      el.querySelectorAll('[data-sdb]').forEach((x) => { const i = +x.dataset.sdb; legaScat(x, bz.blocchi[i], i, true, (p, v) => { imposta(p, v); segna(); }); });
      const sg = el.querySelector('#csGru'); sg.onchange = () => { bz.gru = sg.value; segna(); disegna(); el.querySelector('.cbs-gruc')?.scrollIntoView({ block: 'start' }); };
      el.querySelectorAll('.cbs-zin').forEach((x) => (x.oninput = () => { const p0 = x.selectionStart; x.value = x.value.toUpperCase(); x.setSelectionRange(p0, p0); bz.aree[+x.dataset.z].nome = x.value; segna(); }));
      el.querySelectorAll('[data-zb]').forEach((x) => (x.onclick = () => {
        const [k, bid] = [+x.dataset.zb.split('.')[0], x.dataset.zb.split('.').slice(1).join('.')], era = bz.aree[k].blocchi.includes(bid);
        if (era) bz.aree[k].blocchi = bz.aree[k].blocchi.filter((y) => y !== bid); else bz.aree[k].blocchi.push(bid);
        segna(); const y = scrollY; disegna(); scrollTo(0, y);
      }));
      el.querySelectorAll('[data-padd]').forEach((x) => (x.onclick = () => { const b = bz.blocchi[+x.dataset.padd]; const t = { id: uid(), nome: 'P' + (b.tasti.length + 1), schema: '', filo: '', tipo: 'NO', schemaSotto: '', filoSotto: '' }; b.tasti.push(t); PSEL = t.id; segna(); disegna(b.id); }));
      if (scorriA) { const t = el.querySelector('#cb-' + scorriA); if (t) t.scrollIntoView({ block: 'center' }); }
    };
    function legaPuls(i) {
      const b = bz.blocchi[i], box = el.querySelector(`[data-pd="${i}"]`), pp = el.querySelector(`[data-pp="${i}"]`);
      const ridisegnaDisegno = () => { box.innerHTML = disegnoPuls(b, i, true); legaTasti(); };
      const ridisegnaPannello = () => {
        pp.innerHTML = pannelloPuls(b, i);
        pp.querySelectorAll('[data-ptipo]').forEach((x) => (x.onclick = () => { const [, k, tp] = x.dataset.ptipo.split('.'); b.tasti[+k].tipo = tp; segna(); ridisegnaDisegno(); ridisegnaPannello(); }));
        pp.querySelector('[data-pdup]')?.addEventListener('click', (e) => { const k = +e.currentTarget.dataset.pdup.split('.')[1]; const t = { ...clona(b.tasti[k]), id: uid() }; b.tasti.splice(k + 1, 0, t); PSEL = t.id; segna(); ridisegnaDisegno(); ridisegnaPannello(); });
        pp.querySelector('[data-pdel]')?.addEventListener('click', (e) => { const k = +e.currentTarget.dataset.pdel.split('.')[1]; if (!UI.conferma(`Togliere il pulsante «${b.tasti[k].nome}»?`)) return; b.tasti.splice(k, 1); PSEL = null; segna(); ridisegnaDisegno(); ridisegnaPannello(); });
        pp.querySelector('[data-pok]')?.addEventListener('click', () => { PSEL = null; ridisegnaDisegno(); ridisegnaPannello(); });
      };
      const seleziona = (id) => { PSEL = id; box.querySelectorAll('.cbs-tasto').forEach((c) => c.classList.toggle('sel', b.tasti[+c.dataset.tk.split('.')[1]].id === id)); ridisegnaPannello(); };
      function legaTasti() {
        box.querySelectorAll('.cbs-tasto').forEach((c) => {
          // tocco fuori dalle caselle: seleziona (sotto NO/NC, duplica, togli)
          c.onclick = (e) => { if (e.target.closest('input')) return; const t = b.tasti[+c.dataset.tk.split('.')[1]]; seleziona(t.id); if (PSEL) pp.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
          c.querySelector('.cbs-presa')?.addEventListener('pointerdown', (e) => trascina(e, c));
        });
        // caselle in linea: si scrive direttamente nel disegno (Invio passa alla casella dopo)
        box.querySelectorAll('[data-pi]').forEach((x) => {
          x.oninput = () => { const [k, campo] = x.dataset.pi.split('.'); b.tasti[+k][campo] = x.value.toUpperCase(); segna(); };
          x.onfocus = () => { const t = b.tasti[+x.dataset.pi.split('.')[0]]; if (PSEL !== t.id) seleziona(t.id); x.select(); };
          x.onkeydown = (e) => { if (e.key !== 'Enter') return; e.preventDefault(); const tutti = [...box.querySelectorAll('[data-pi]')], n = tutti[tutti.indexOf(x) + 1]; n ? n.focus() : x.blur(); };
        });
      }
      // trascinamento col dito o col mouse: la barretta gialla mostra dove finisce
      function trascina(e, c) {
        e.preventDefault(); e.stopPropagation();
        const riga = box.querySelector('.cbs-prow'), vert = b.orient === 'v', da = +c.dataset.tk.split('.')[1], r = c.getBoundingClientRect();
        const f = c.cloneNode(true); f.classList.add('cbs-fant'); Object.assign(f.style, { width: r.width + 'px', left: r.left + 'px', top: r.top + 'px' }); document.body.appendChild(f);
        c.classList.add('trascina');
        const ox = e.clientX - r.left, oy = e.clientY - r.top, ins = document.createElement('div'); ins.className = 'cbs-ins'; let dove = da;
        const muovi = (ev) => {
          f.style.left = (vert ? r.left : ev.clientX - ox) + 'px'; f.style.top = (vert ? ev.clientY - oy : r.top) + 'px';
          const cols = [...riga.querySelectorAll('.cbs-tasto')]; dove = cols.length;
          for (let k = 0; k < cols.length; k++) { const q = cols[k].getBoundingClientRect(); if (vert ? ev.clientY < q.top + q.height / 2 : ev.clientX < q.left + q.width / 2) { dove = k; break; } }
          cols[dove] ? riga.insertBefore(ins, cols[dove]) : riga.appendChild(ins);
          const sc = riga.parentElement, sr = sc.getBoundingClientRect();
          if (!vert) { if (ev.clientX > sr.right - 30) sc.scrollLeft += 12; if (ev.clientX < sr.left + 30) sc.scrollLeft -= 12; }
          else { if (ev.clientY > innerHeight - 60) scrollBy(0, 12); if (ev.clientY < 80) scrollBy(0, -12); }
        };
        const fine = () => {
          document.removeEventListener('pointermove', muovi); document.removeEventListener('pointerup', fine); document.removeEventListener('pointercancel', fine);
          f.remove(); ins.remove(); c.classList.remove('trascina');
          const a = dove > da ? dove - 1 : dove;
          if (a !== da) { const [t] = b.tasti.splice(da, 1); b.tasti.splice(a, 0, t); PSEL = t.id; segna(); }
          ridisegnaDisegno(); ridisegnaPannello();
        };
        document.addEventListener('pointermove', muovi); document.addEventListener('pointerup', fine); document.addEventListener('pointercancel', fine);
      }
      legaTasti(); ridisegnaPannello();
    }
    function legaMors(i) {
      const b = bz.blocchi[i], box = el.querySelector(`[data-md="${i}"]`), st = mst(b);
      const tutto = () => { box.innerHTML = morsHtml(b, i, true); lega(); };
      const soloSvg = () => { box.querySelector('.cbs-msvg').innerHTML = morsSvg(b); legaSvg(); };
      function legaPan() {
        const pan = box.querySelector('[data-mpan]'); pan.innerHTML = morsPannello(b);
        const nm = pan.querySelector('[data-mnome]');
        if (nm) {
          nm.oninput = () => { b.morsetti.find((m) => st.sel.has(m.id)).nome = nm.value.toUpperCase(); segna(); soloSvg(); };
          nm.onkeydown = (e) => { if (e.key !== 'Enter') return; e.preventDefault(); const k = b.morsetti.findIndex((m) => st.sel.has(m.id)); if (k < b.morsetti.length - 1) { st.sel = new Set([b.morsetti[k + 1].id]); tutto(); const n = box.querySelector('[data-mnome]'); n?.focus(); n?.select(); } };
        }
        pan.querySelectorAll('[data-mtipo]').forEach((x) => (x.onclick = () => { b.morsetti.forEach((m) => { if (st.sel.has(m.id)) { m.tipo = x.dataset.mtipo; if (MT[m.tipo].pe) m.nome = 'PE'; } }); segna(); tutto(); }));
        pan.querySelector('[data-mev]')?.addEventListener('click', () => { const sc = b.morsetti.filter((m) => st.sel.has(m.id)), v = !sc.every((m) => m.ev); sc.forEach((m) => (m.ev = v)); segna(); tutto(); });
        pan.querySelector('[data-mdel]')?.addEventListener('click', () => { if (!UI.conferma(`Togliere ${st.sel.size > 1 ? st.sel.size + ' morsetti' : 'il morsetto'}?`)) return; b.morsetti = b.morsetti.filter((m) => !st.sel.has(m.id)); b.ponti = (b.ponti || []).filter((q) => !st.sel.has(q.da) && !st.sel.has(q.a)); st.sel.clear(); segna(); tutto(); });
        pan.querySelector('[data-mok]')?.addEventListener('click', () => { st.sel.clear(); tutto(); });
      }
      // nome scritto direttamente sulla targhetta bianca (Invio = morsetto dopo)
      function apriTarga(k) {
        if (k < 0 || k >= b.morsetti.length) return;
        st.modo = 'sel'; st.sel = new Set([b.morsetti[k].id]); tutto();
        const riga = box.querySelector('.cbs-mriga'), sv = box.querySelector('.cbs-ms'), rr = riga.getBoundingClientRect(), rs = sv.getBoundingClientRect(), pos = mpos(b);
        const inp = document.createElement('input'); inp.className = 'cbs-mtin'; inp.value = b.morsetti[k].nome || ''; inp.setAttribute('autocomplete', 'off'); inp.setAttribute('spellcheck', 'false');
        inp.style.left = (rs.left - rr.left + pos[k].x + pos[k].w / 2 - 48) + 'px'; inp.style.top = (rs.top - rr.top + MTOP + MH / 2 - 20) + 'px';
        riga.appendChild(inp);
        const sc = riga.parentElement, cx = rs.left - rr.left + pos[k].x; if (cx < sc.scrollLeft + 40 || cx > sc.scrollLeft + sc.clientWidth - 60) sc.scrollLeft = cx - sc.clientWidth / 2;
        inp.focus({ preventScroll: true }); inp.select();
        let via = false;
        inp.oninput = () => { b.morsetti[k].nome = inp.value.toUpperCase(); segna(); soloSvg(); const pn = box.querySelector('[data-mnome]'); if (pn) pn.value = b.morsetti[k].nome; };
        inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); via = true; inp.remove(); apriTarga(k + 1 < b.morsetti.length ? k + 1 : -1); } else if (e.key === 'Escape') { via = true; inp.remove(); } };
        inp.onblur = () => { if (!via) inp.remove(); };
      }
      function legaSvg() {
        box.querySelectorAll('.cbs-mtarga-hit').forEach((r) => (r.onclick = (e) => { if (st.modo !== 'sel') return; e.stopPropagation(); apriTarga(+r.dataset.mt); }));
        box.querySelectorAll('.cbs-m').forEach((g) => (g.onclick = () => {
          const m = b.morsetti[+g.dataset.mi];
          if (st.modo === 'ponte') {
            if (!st.primo) { st.primo = m.id; st.sel = new Set([m.id]); }
            else if (st.primo === m.id) { st.primo = null; st.sel.clear(); }
            else { (b.ponti = b.ponti || []).push({ da: st.primo, a: m.id }); st.primo = null; st.sel.clear(); segna(); }
            tutto(); return;
          }
          if (st.multi) st.sel.has(m.id) ? st.sel.delete(m.id) : st.sel.add(m.id);
          else st.sel = st.sel.has(m.id) && st.sel.size === 1 ? new Set() : new Set([m.id]);
          tutto();
          const n = box.querySelector('[data-mnome]'); if (n) { n.focus({ preventScroll: true }); n.select(); box.querySelector('[data-mpan]').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
        }));
        box.querySelectorAll('.cbs-ponte').forEach((g) => (g.onclick = (e) => { e.stopPropagation(); if (!UI.conferma('Togliere questo ponticello?')) return; b.ponti.splice(+g.dataset.po, 1); segna(); tutto(); }));
      }
      function lega() {
        box.querySelectorAll('[data-mmodo]').forEach((x) => (x.onclick = () => { st.modo = x.dataset.mmodo; st.primo = null; st.sel.clear(); tutto(); }));
        const mu = box.querySelector('[data-mmulti]'); if (mu) mu.onchange = () => { st.multi = mu.checked; if (!st.multi && st.sel.size > 1) st.sel = new Set([...st.sel].slice(-1)); tutto(); };
        box.querySelector('[data-madd]').onclick = () => {
          const ult = [...st.sel].pop(), k = ult ? b.morsetti.findIndex((m) => m.id === ult) + 1 : b.morsetti.length, prec = b.morsetti[k - 1];
          const tp = prec ? prec.tipo : 'WDU 2,5', m = { id: uid(), nome: MT[tp].pe ? 'PE' : '', tipo: tp, ev: false }; b.morsetti.splice(k, 0, m); st.modo = 'sel'; st.sel = new Set([m.id]); segna(); tutto();
          box.querySelector('[data-mnome]')?.focus();
        };
        box.querySelectorAll('.cbs-mpresa').forEach((h) => h.addEventListener('pointerdown', (e) => trascinaM(e, +h.dataset.mpr)));
        legaSvg(); legaPan();
      }
      function trascinaM(e, da) {
        e.preventDefault();
        const riga = box.querySelector('.cbs-mriga'), pos = mpos(b), r0 = box.querySelector('.cbs-ms').getBoundingClientRect(), rr = riga.getBoundingClientRect();
        const ins = document.createElement('div'); ins.className = 'cbs-mins'; riga.appendChild(ins);
        const f = document.createElement('div'); f.className = 'cbs-fant cbs-mfant'; f.textContent = '⠿ ' + (b.morsetti[da].nome || '?'); document.body.appendChild(f);
        let dove = da;
        const muovi = (ev) => {
          f.style.left = ev.clientX + 10 + 'px'; f.style.top = ev.clientY - 34 + 'px';
          const x = ev.clientX - r0.left; dove = pos.length; for (let k = 0; k < pos.length; k++) if (x < pos[k].x + pos[k].w / 2) { dove = k; break; }
          ins.style.left = (r0.left - rr.left) + (dove < pos.length ? pos[dove].x : pos[pos.length - 1].x + pos[pos.length - 1].w) + 'px';
          const sc = riga.parentElement, sr = sc.getBoundingClientRect(); if (ev.clientX > sr.right - 30) sc.scrollLeft += 12; if (ev.clientX < sr.left + 30) sc.scrollLeft -= 12;
        };
        const fine = () => {
          document.removeEventListener('pointermove', muovi); document.removeEventListener('pointerup', fine); document.removeEventListener('pointercancel', fine); f.remove(); ins.remove();
          const a = dove > da ? dove - 1 : dove; if (a !== da) { const [m] = b.morsetti.splice(da, 1); b.morsetti.splice(a, 0, m); st.sel = new Set([m.id]); segna(); } tutto();
        };
        document.addEventListener('pointermove', muovi); document.addEventListener('pointerup', fine); document.addEventListener('pointercancel', fine);
      }
      lega();
      box.addEventListener('cbs-rid', tutto);
    }
    // tutte le scritte in maiuscolo (non gli identificativi interni)
    const maiuscolo = (o) => {
      if (Array.isArray(o)) return o.map((x) => (typeof x === 'string' ? x.toUpperCase() : maiuscolo(x)));
      if (!o || typeof o !== 'object') return o;
      const salta = new Set(['id', 'tipo', 'orient', 'c', 'agg', 'versione', 'morsId', ...('da' in o ? ['da', 'a'] : [])]);
      Object.keys(o).forEach((k) => { if (salta.has(k)) return; o[k] = typeof o[k] === 'string' ? o[k].toUpperCase() : maiuscolo(o[k]); });
      return o;
    };
    async function salva() {
      bz.blocchi = maiuscolo(bz.blocchi); bz.nome = String(bz.nome || '').toUpperCase();
      const ids = new Set(bz.blocchi.map((b) => b.id)); bz.aree = bz.aree.map((a) => ({ k: a.k, nome: String(a.nome || '').toUpperCase(), blocchi: a.blocchi.filter((x) => ids.has(x)) }));
      bz.blocchi.forEach((b) => { if (b.morsId && !ids.has(b.morsId)) b.morsId = ''; });
      if (PUNTI[bz.gru]) { const zi = (b) => { const k = bz.aree.findIndex((a) => a.blocchi.includes(b.id)); return k < 0 ? 99 : k; }; bz.blocchi = bz.blocchi.map((b, i) => [b, i]).sort((p, q) => zi(p[0]) - zi(q[0]) || p[1] - q[1]).map(([b]) => b); }
      if (!String(bz.nome || '').trim()) { UI.toast('Scrivi il nome della scheda'); el.querySelector('#csNome').focus(); return; }
      bz.agg = { il: new Date().toISOString(), da: UT.breve(UT.attuale()) };
      try { await UI.salva('impostazioni', clona(bz)); } catch (e) { return; }
      sporco = false; UT.registra?.('modifica', 'Scheda di cablaggio ' + bz.nome); UI.toast('Scheda salvata', 'ok');
      location.hash = `#/cablaggio/s/${id}`;
    }
    // struttura di un blocco: poli, colonne, righe
    function impostazioni(i) {
      const b = bz.blocchi[i];
      if (b.tipo === 'conn') {
        UI.modal({ titolo: 'Presa / spina', infoTxt: 'Scegli quanti poli ha il connettore e quante colonne vuoi a sinistra e a destra. Quello che hai già scritto resta al suo posto.',
          valori: { pin: String(b.pin), sx: String(b.colSx.length), dx: String(b.colDx.length) },
          campi: [{ k: 'pin', label: 'Poli', tipo: 'select', opzioni: PIN.map(String) },
            { k: 'sx', label: 'Colonne a sinistra', tipo: 'select', opzioni: ['0', '1', '2', '3'], mezza: true },
            { k: 'dx', label: 'Colonne a destra', tipo: 'select', opzioni: ['0', '1', '2', '3'], mezza: true }],
          onSalva: (v) => {
            const pin = +v.pin, sx = +v.sx, dx = +v.dx;
            const cols = (vecchie, n, def) => Array.from({ length: n }, (_, k) => vecchie[k] ?? def[k] ?? '');
            b.colSx = cols(b.colSx, sx, ['N° FEST', 'N° SCHEMA', '']); b.colDx = cols(b.colDx, dx, ['N° SCHEMA', 'N° FEST', '']);
            b.pin = pin; b.righe = righeConn(pin, sx, dx, b.righe); segna(); disegna(b.id);
          } });
      } else if (b.tipo === 'cavo') {
        UI.modal({ titolo: 'Cavo', infoTxt: 'Quante colonne ha la tabella. Le righe le aggiungi o togli direttamente nel blocco (+ Riga e ×).',
          valori: { col: String(b.colonne.length) },
          campi: [{ k: 'col', label: 'Colonne', tipo: 'select', opzioni: ['1', '2', '3', '4', '5', '6'] }],
          onSalva: (v) => {
            const n = +v.col;
            b.colonne = Array.from({ length: n }, (_, k) => b.colonne[k] ?? '');
            b.righe = b.righe.map((r) => Array.from({ length: n }, (_, k) => r[k] ?? ''));
            segna(); disegna(b.id);
          } });
      } else if (b.tipo === 'scat') {
        const mors = bz.blocchi.filter((x) => x.tipo === 'mors'), et = (x) => x.titolo || 'MORSETTIERA';
        UI.modal({ titolo: 'Scatola di derivazione', infoTxt: 'Versione: cilindrico = 8 pressacavi, conico = 7 (senza il n. 3). La morsettiera scelta viene disegnata sulla guida DIN: toccando un morsetto si va alla morsettiera.',
          valori: { versione: b.versione === 'con' ? 'Motore conico · 7 pressacavi' : 'Motore cilindrico · 8 pressacavi', mors: (mors.find((x) => x.id === b.morsId) && et(mors.find((x) => x.id === b.morsId))) || 'Nessuna' },
          campi: [{ k: 'versione', label: 'Versione', tipo: 'select', opzioni: ['Motore cilindrico · 8 pressacavi', 'Motore conico · 7 pressacavi'] },
            { k: 'mors', label: 'Morsettiera sulla guida DIN', tipo: 'select', opzioni: ['Nessuna', ...mors.map(et)] }],
          onSalva: (v) => { b.versione = /conico/i.test(v.versione) ? 'con' : 'cil'; const m = mors.find((x) => et(x) === v.mors); b.morsId = m ? m.id : ''; segna(); disegna(b.id); } });
      } else if (b.tipo === 'mors') {
        UI.toast('Nella morsettiera: tocca un morsetto per nome e tipo, «🔗 Ponticelli» per unirli, ⠿ per spostarli');
      } else if (b.tipo === 'puls') {
        UI.modal({ titolo: 'Pulsantiera', infoTxt: 'Orizzontale: i pulsanti uno accanto all\'altro, come sul foglio. Verticale: un pulsante per riga, comodo sul telefono e per le pulsantiere lunghe.',
          valori: { orient: b.orient === 'v' ? 'Verticale' : 'Orizzontale' }, campi: [{ k: 'orient', label: 'Orientamento', tipo: 'select', opzioni: ['Orizzontale', 'Verticale'] }],
          onSalva: (v) => { b.orient = v.orient === 'Verticale' ? 'v' : 'o'; segna(); disegna(b.id); } });
      } else {
        UI.toast('Nel finecorsa: aggiungi o togli righe direttamente nel blocco; tocca il contatto per passare da NA a NC');
      }
    }
    // copia di blocchi da un'altra scheda: prima si sceglie la scheda, poi si spuntano i blocchi
    function copiaDa() {
      const altre = schede(S).filter((x) => x.id !== id && (x.blocchi || []).length);
      const etichetta = (x) => `${x.nome || 'SENZA NOME'} (${x.blocchi.length} blocchi)`;
      UI.modal({ titolo: 'Copia blocchi', infoTxt: 'Scegli la scheda da cui copiare. Poi spunti i blocchi che ti servono: vengono aggiunti in fondo a questa scheda con tutto quello che c\'è scritto e finiscono nelle stesse zone della gru in cui erano nell\'originale. Li puoi modificare senza toccare l\'originale.',
        valori: { da: etichetta(altre[0]) }, campi: [{ k: 'da', label: 'Copia da', tipo: 'select', opzioni: altre.map(etichetta), req: true }], testoSalva: 'Avanti',
        onSalva: (v) => {
          const src = altre.find((x) => etichetta(x) === v.da); if (!src) return;
          setTimeout(() => UI.modal({ titolo: 'Quali blocchi?', infoTxt: `Blocchi della scheda «${src.nome}». Spunta quelli da copiare.`,
            valori: { tutti: false, ...Object.fromEntries(src.blocchi.map((b, k) => ['b' + k, false])) },
            campi: [{ k: 'tutti', label: 'TUTTI I BLOCCHI', tipo: 'sino' }, ...src.blocchi.map((b, k) => { const zz = PUNTI[src.gru] ? zoneDi(src).map((a, j) => (a.blocchi.includes(b.id) ? j + 1 : 0)).filter(Boolean) : [];
              return { k: 'b' + k, label: `${NOME_TIPO[b.tipo] || ''} · ${b.titolo || ''}${zz.length ? ' · zona ' + zz.join(', ') : ''}`, tipo: 'sino' }; })], testoSalva: '⧉ Copia',
            onSalva: (w) => {
              const scelti = src.blocchi.filter((b, k) => w.tutti || w['b' + k]);
              if (!scelti.length) { UI.toast('Nessun blocco spuntato'); return; }
              let ultimo = null; const mappa = {};
              scelti.forEach((b) => { const c = clona(b); c.id = uid(); mappa[b.id] = c.id; bz.blocchi.push(c); ultimo = c.id; });
              // la scatola copiata insieme alla sua morsettiera resta collegata a quella nuova
              scelti.forEach((b) => { const c = bz.blocchi.find((x) => x.id === mappa[b.id]); if (c.morsId) c.morsId = mappa[c.morsId] || (bz.blocchi.some((x) => x.id === c.morsId) ? c.morsId : ''); });
              // stesse zone della gru dell'originale (se la scheda non ha ancora la gru, prende quella dell'originale)
              if (PUNTI[src.gru]) {
                if (!PUNTI[bz.gru]) bz.gru = src.gru;
                const zs = zoneDi(src);
                zs.forEach((a, j) => { const ids = a.blocchi.filter((x) => mappa[x]).map((x) => mappa[x]); if (!ids.length) return;
                  const t = bz.aree[j]; if (!t.blocchi.length && t.nome === ZONE_DEF()[j].nome) t.nome = a.nome; t.blocchi.push(...ids); });
              }
              segna(); disegna(ultimo); UI.toast(scelti.length === 1 ? 'Blocco copiato' : `${scelti.length} blocchi copiati`, 'ok');
            } }), 50);
        } });
    }
    function nuovoBlocco(tipo) {
      if (tipo === 'scat') {
        const mors = bz.blocchi.filter((x) => x.tipo === 'mors');
        UI.modal({ titolo: 'Scatola di derivazione', infoTxt: 'La scatola dei paranchi MISIA: 3 viste da toccare (dall\'alto, lato pressacavi, lato festone) con la scheda di ogni pezzo. Le voci si scrivono in modifica.',
          valori: { titolo: 'SCATOLA DI DERIVAZIONE', versione: 'Motore cilindrico · 8 pressacavi', mors: mors.length ? (mors[0].titolo || 'MORSETTIERA') : 'Nessuna' },
          campi: [{ k: 'titolo', label: 'Titolo', req: true, maiuscolo: true }, { k: 'versione', label: 'Versione', tipo: 'select', opzioni: ['Motore cilindrico · 8 pressacavi', 'Motore conico · 7 pressacavi'] },
            { k: 'mors', label: 'Morsettiera sulla guida DIN', tipo: 'select', opzioni: ['Nessuna', ...mors.map((x) => x.titolo || 'MORSETTIERA')] }],
          onSalva: (v) => { const m = mors.find((x) => (x.titolo || 'MORSETTIERA') === v.mors); const b = NUOVO.scat({ titolo: String(v.titolo).toUpperCase(), versione: /conico/i.test(v.versione) ? 'con' : 'cil', morsId: m ? m.id : '' }); bz.blocchi.push(b); segna(); disegna(b.id); } });
        return;
      }
      if (tipo === 'mors') {
        UI.modal({ titolo: 'Nuova morsettiera', infoTxt: 'Dici quanti morsetti ha e il tipo di partenza. Poi tocchi ogni morsetto per dargli nome e tipo (WDU normali, WPE di terra gialloverdi), metti i ponticelli e li sposti con ⠿.',
          valori: { titolo: '', n: '20', tipo: 'WDU 2,5' },
          campi: [{ k: 'titolo', label: 'Titolo (es. MORSETTIERA CARRELLO)', req: true, maiuscolo: true }, { k: 'n', label: 'Quanti morsetti', mezza: true }, { k: 'tipo', label: 'Tipo di partenza', tipo: 'select', opzioni: MT_NOMI, mezza: true }],
          onSalva: (v) => { const b = NUOVO.mors({ titolo: String(v.titolo).toUpperCase(), n: parseInt(v.n, 10), tipo: v.tipo }); bz.blocchi.push(b); segna(); disegna(b.id); } });
        return;
      }
      if (tipo === 'puls') {
        UI.modal({ titolo: 'Nuova pulsantiera', infoTxt: 'Dici quanti pulsanti ha e quanti sono NC (gli altri sono NO). Poi tocchi ogni pulsante per scrivere nome, n° schema e n° filo, e li trascini per metterli in ordine.',
          valori: { titolo: '', n: '14', nc: '1', orient: 'Orizzontale' },
          campi: [{ k: 'titolo', label: 'Titolo (es. SCHEMA PULSANTIERA PENSILE 18G 1,5)', req: true, maiuscolo: true },
            { k: 'n', label: 'Quanti pulsanti', mezza: true }, { k: 'nc', label: 'Di cui NC', mezza: true },
            { k: 'orient', label: 'Orientamento', tipo: 'select', opzioni: ['Orizzontale', 'Verticale'] }],
          onSalva: (v) => { const b = NUOVO.puls({ titolo: String(v.titolo).toUpperCase(), n: parseInt(v.n, 10), nc: parseInt(v.nc, 10), orient: v.orient === 'Verticale' ? 'v' : 'o' }); PSEL = null; bz.blocchi.push(b); segna(); disegna(b.id); } });
        return;
      }
      if (tipo === 'conn') {
        UI.modal({ titolo: 'Nuova presa / spina', valori: { titolo: '', nomePin: 'PRESA', pin: '16' },
          campi: [{ k: 'titolo', label: 'Titolo (es. PRESA PULSANTIERA)', req: true, maiuscolo: true }, { k: 'nomePin', label: 'Scritta sul connettore', tipo: 'select', opzioni: ['PRESA', 'SPINA'], mezza: true },
            { k: 'pin', label: 'Poli', tipo: 'select', opzioni: PIN.map(String), mezza: true }],
          onSalva: (v) => { const b = NUOVO.conn({ titolo: String(v.titolo).toUpperCase(), nomePin: v.nomePin, pin: +v.pin }); bz.blocchi.push(b); segna(); disegna(b.id); } });
      } else if (tipo === 'fc') {
        UI.modal({ titolo: 'Nuovo finecorsa', valori: { titolo: '', n: '4' },
          campi: [{ k: 'titolo', label: 'Titolo (es. F.C. PONTE)', req: true, maiuscolo: true }, { k: 'n', label: 'Quanti contatti', tipo: 'select', opzioni: ['1', '2', '3', '4', '5', '6', '8'] }],
          onSalva: (v) => { const b = NUOVO.fc({ titolo: String(v.titolo).toUpperCase(), n: +v.n }); bz.blocchi.push(b); segna(); disegna(b.id); } });
      } else {
        UI.modal({ titolo: 'Nuovo cavo', infoTxt: 'Il numero di conduttori crea le righe già numerate (1, 2, 3…). Le intestazioni delle colonne si cambiano scrivendoci sopra.',
          valori: { titolo: '', n: '3', pe: true, c1: 'FILO', c2: 'N° QUADRO', c3: 'MORSETTO' },
          campi: [{ k: 'titolo', label: 'Titolo (es. AUX QUADRO CARRO 12G1,5)', req: true, maiuscolo: true },
            { k: 'n', label: 'Conduttori (righe)', mezza: true }, { k: 'pe', label: 'Riga PE in fondo', tipo: 'sino', mezza: true },
            { k: 'c1', label: 'Colonna 1', mezza: true, maiuscolo: true }, { k: 'c2', label: 'Colonna 2', mezza: true, maiuscolo: true }, { k: 'c3', label: 'Colonna 3 (vuota = niente)', maiuscolo: true }],
          onSalva: (v) => {
            const cols = [v.c1, v.c2, v.c3].map((x) => String(x || '').trim().toUpperCase()).filter((x, k) => k < 2 || x);
            const b = NUOVO.cavo({ titolo: String(v.titolo).toUpperCase(), n: parseInt(v.n, 10) || 3, pe: !!v.pe, colonne: cols });
            bz.blocchi.push(b); segna(); disegna(b.id);
          } });
      }
    }
    disegna();
    return { titolo: 'Modifica scheda di cablaggio', indietro: `#/cablaggio/s/${id}`, live: false };
  }

  function route(el, S, parti) {
    if (parti[1] === 's' && parti[2]) return parti[3] === 'modifica' ? modifica(el, S, parti[2]) : vista(el, S, parti[2], parti[3] === 'z' ? parti[4] : null);
    return elenco(el, S);
  }
  return { route, schede };
})();
