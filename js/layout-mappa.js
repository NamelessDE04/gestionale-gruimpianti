// ===== CAPANNONI DALLA FOTO SATELLITARE =====
// Si apre la foto dall'alto della sede (foto satellitari Esri World Imagery, gratuite, senza chiavi),
// si gira la foto finché i tetti sono dritti e si disegnano col dito i capannoni sopra.
// Nel layout arrivano con le misure vere in metri (la scala della foto è nota).
// L'indirizzo → coordinate lo trova Nominatim (OpenStreetMap), solo per centrare la foto.
window.LAYMAP = (function () {
  const { esc } = UI;
  const Z = 18, T = 256;
  const TILE = (x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${Z}/${y}/${x}`;
  const px = (lon, lat) => {
    const n = T * 2 ** Z, s = Math.sin((lat * Math.PI) / 180);
    return [((lon + 180) / 360) * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
  };
  const metriPerPx = (lat) => (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** Z;

  async function geocodifica(q) {
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=it&q=' + encodeURIComponent(q), { headers: { 'Accept-Language': 'it' } });
    if (!r.ok) throw new Error('indirizzo');
    const j = await r.json(); if (!j.length) return null;
    return { lat: +j[0].lat, lon: +j[0].lon, nome: j[0].display_name };
  }

  function apri(indirizzo, onScelti) {
    const ov = document.createElement('div'); ov.className = 'modal-ov lm-ov';
    ov.innerHTML = `<div class="modal largo lm">
      <div class="modal-head"><h2>Capannoni dalla foto</h2>${UI.info('1) Cerca la sede. 2) Con «↻» gira la foto finché i capannoni sono dritti. 3) Tocca «▭ Disegna» e tira un rettangolo sopra ogni capannone, da un angolo all\'angolo opposto (puoi spostarlo e allargarlo dal quadratino blu). 4) «Aggiungi»: nel layout arrivano con le misure vere. Per spostare la foto usa «✋ Sposta»; per ingrandire + e −, la rotellina o due dita.')}<button type="button" class="modal-x" aria-label="Chiudi">×</button></div>
      <div class="lm-corpo">
        <div class="lm-cerca"><input id="lmQ" data-libero value="${esc(indirizzo)}" placeholder="Indirizzo della sede"><button type="button" class="btn small" id="lmVai">Cerca</button></div>
        <div class="lm-strum">
          <span class="lm-modi"><button type="button" class="chip-s on" data-modo="sposta">✋ Sposta</button><button type="button" class="chip-s" data-modo="disegna">▭ Disegna</button></span>
          <span class="lm-gira"><button type="button" class="btn ghost small" data-gira="-5" aria-label="Gira a sinistra">↺</button><b id="lmAng">0°</b><button type="button" class="btn ghost small" data-gira="5" aria-label="Gira a destra">↻</button><button type="button" class="btn ghost small" data-gira="-1" aria-label="Un grado a sinistra">‹</button><button type="button" class="btn ghost small" data-gira="1" aria-label="Un grado a destra">›</button></span>
          <span class="lm-zoom"><button type="button" class="btn ghost small" data-zoom="1.4" aria-label="Ingrandisci">+</button><button type="button" class="btn ghost small" data-zoom="0.7" aria-label="Rimpicciolisci">−</button></span>
        </div>
        <div class="lm-mappa" id="lmMappa"><p class="muted small">Cerco…</p></div>
        <div class="lm-sotto"><span class="muted small" id="lmStato"></span><button type="button" class="btn ghost small danger" id="lmTogli" hidden>🗑 Togli il rettangolo scelto</button></div>
        <p class="lm-copy">Foto © Esri, Maxar, Earthstar Geographics · indirizzi © OpenStreetMap</p>
      </div>
      <div class="modal-foot"><span class="grow"></span><button type="button" class="btn ghost" data-annulla>Annulla</button><button type="button" class="btn" id="lmOk" disabled>Aggiungi</button></div>
    </div>`;
    document.body.appendChild(ov); document.body.classList.add('modal-aperto');
    const chiudi = () => { ov.remove(); document.body.classList.remove('modal-aperto'); };
    ov.querySelector('.modal-x').onclick = chiudi; ov.querySelector('[data-annulla]').onclick = chiudi;
    const box = ov.querySelector('#lmMappa'), stato = ov.querySelector('#lmStato'), ok = ov.querySelector('#lmOk'), togli = ov.querySelector('#lmTogli');

    // le coordinate "del mondo" sono numeri enormi (decine di milioni): l'SVG le disegna male,
    // quindi lavoro relativo a un'origine O vicina alla sede
    let O = [0, 0], C = null, lat = 45, ang = 0, vb = null, modo = 'sposta', rett = [], scelto = -1, svg = null, gFoto = null, gRett = null;
    const caricate = new Set();
    const aggiornaOk = () => { ok.disabled = !rett.length; ok.textContent = rett.length ? `Aggiungi ${rett.length} ${rett.length === 1 ? 'capannone' : 'capannoni'}` : 'Aggiungi'; togli.hidden = scelto < 0; };
    const misura = (r) => `${Math.round(r.w * metriPerPx(lat))} × ${Math.round(r.h * metriPerPx(lat))} m`;

    async function cerca() {
      box.innerHTML = '<p class="muted small">Cerco l\'indirizzo…</p>';
      try {
        const g = await geocodifica(ov.querySelector('#lmQ').value.trim());
        if (!g) { box.innerHTML = '<p class="nessuno">Indirizzo non trovato: prova a scriverlo diverso (via, numero, città).</p>'; return; }
        lat = g.lat; const w0 = px(g.lon, g.lat); O = [Math.floor(w0[0] / T) * T, Math.floor(w0[1] / T) * T]; C = [w0[0] - O[0], w0[1] - O[1]]; rett = []; scelto = -1; ang = 0; caricate.clear();
        const w = 900; vb = { x: C[0] - w / 2, y: C[1] - w / 2, w, h: w };
        monta(); stato.textContent = g.nome; aggiornaOk();
      } catch (e) { box.innerHTML = '<p class="nessuno">Servizio non raggiungibile. Controlla la connessione e riprova.</p>'; }
    }
    function monta() {
      box.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><g id="lmFoto"></g><g id="lmRett"></g></svg>`;
      svg = box.querySelector('svg'); gFoto = svg.querySelector('#lmFoto'); gRett = svg.querySelector('#lmRett');
      vista(); collega();
    }
    // tessere della foto che servono per la parte visibile (anche girata)
    function tessere() {
      const r = Math.hypot(vb.w, vb.h) / 2 + T, cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2;
      let n = 0;
      const ox = O[0] / T, oy = O[1] / T;
      for (let tx = Math.floor((cx - r) / T); tx <= Math.floor((cx + r) / T); tx++) for (let ty = Math.floor((cy - r) / T); ty <= Math.floor((cy + r) / T); ty++) {
        const k = tx + ':' + ty; if (caricate.has(k) || caricate.size > 600) continue;
        caricate.add(k); n++;
        const im = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        im.setAttribute('href', TILE(tx + ox, ty + oy)); im.setAttribute('x', tx * T); im.setAttribute('y', ty * T); im.setAttribute('width', T + 0.6); im.setAttribute('height', T + 0.6);
        gFoto.appendChild(im);
      }
      return n;
    }
    function vista() {
      svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
      gFoto.setAttribute('transform', `rotate(${ang} ${C[0]} ${C[1]})`);
      tessere(); disegnaRett();
      ov.querySelector('#lmAng').textContent = ang + '°';
    }
    function disegnaRett() {
      const k = vb.w / 300;   // spessori che restano uguali sullo schermo
      gRett.innerHTML = rett.map((r, i) => `<g data-r="${i}"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="rgba(242,183,5,${i === scelto ? 0.35 : 0.22})" stroke="${i === scelto ? '#1f5fbf' : '#f2b705'}" stroke-width="${k * 1.2}"/>
        <text x="${r.x + r.w / 2}" y="${r.y + r.h / 2}" font-size="${k * 7}" text-anchor="middle" dominant-baseline="middle" fill="#fff" stroke="#000" stroke-width="${k * 0.6}" paint-order="stroke" font-weight="700" font-family="Arial">${misura(r)}</text>
        ${i === scelto ? `<rect data-h="${i}" x="${r.x + r.w - k * 6}" y="${r.y + r.h - k * 6}" width="${k * 12}" height="${k * 12}" fill="#1f5fbf" stroke="#fff" stroke-width="${k}"/>` : ''}</g>`).join('');
    }
    const punto = (ev) => { const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse()); return [q.x, q.y]; };
    function zoom(f, centro) {
      const nw = Math.min(3000, Math.max(80, vb.w / f));   // da ~35 m a ~1,3 km di larghezza
      const g = nw / vb.w, [cx, cy] = centro || [vb.x + vb.w / 2, vb.y + vb.h / 2];
      vb = { x: cx - (cx - vb.x) * g, y: cy - (cy - vb.y) * g, w: vb.w * g, h: vb.h * g }; vista();
    }
    function collega() {
      const dita = new Map(); let gesto = null;
      svg.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, punto(e)); }, { passive: false });
      svg.addEventListener('pointerdown', (e) => {
        svg.setPointerCapture(e.pointerId); dita.set(e.pointerId, [e.clientX, e.clientY]);
        if (dita.size === 2) { if (gesto?.tipo === 'nuovo') { rett.splice(gesto.i, 1); scelto = -1; disegnaRett(); aggiornaOk(); }
          const [a, b] = [...dita.values()]; gesto = { tipo: 'pinch', d0: Math.hypot(a[0] - b[0], a[1] - b[1]), vb0: { ...vb } }; return; }
        const p = punto(e), h = e.target.closest('[data-h]'), gr = e.target.closest('[data-r]');
        if (modo === 'disegna' && h) { gesto = { tipo: 'allarga', i: +h.dataset.h, p0: p, r0: { ...rett[+h.dataset.h] } }; return; }
        if (modo === 'disegna' && gr) { scelto = +gr.dataset.r; gesto = { tipo: 'muovi', i: scelto, p0: p, r0: { ...rett[scelto] } }; disegnaRett(); aggiornaOk(); return; }
        if (modo === 'disegna') { rett.push({ x: p[0], y: p[1], w: 0, h: 0 }); scelto = rett.length - 1; gesto = { tipo: 'nuovo', i: scelto, p0: p }; return; }
        if (gr) { scelto = +gr.dataset.r; disegnaRett(); aggiornaOk(); }
        gesto = { tipo: 'sposta', c0: [e.clientX, e.clientY], vb0: { ...vb }, sc: vb.w / svg.getBoundingClientRect().width };
      });
      svg.addEventListener('pointermove', (e) => {
        if (!dita.has(e.pointerId) || !gesto) return;
        dita.set(e.pointerId, [e.clientX, e.clientY]);
        if (gesto.tipo === 'pinch' && dita.size === 2) {
          const [a, b] = [...dita.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
          vb = { ...gesto.vb0 }; zoom(d / gesto.d0); return;
        }
        if (gesto.tipo === 'sposta') { vb = { ...gesto.vb0, x: gesto.vb0.x - (e.clientX - gesto.c0[0]) * gesto.sc, y: gesto.vb0.y - (e.clientY - gesto.c0[1]) * gesto.sc }; vista(); return; }
        const p = punto(e), r = rett[gesto.i];
        if (gesto.tipo === 'nuovo') { r.x = Math.min(p[0], gesto.p0[0]); r.y = Math.min(p[1], gesto.p0[1]); r.w = Math.abs(p[0] - gesto.p0[0]); r.h = Math.abs(p[1] - gesto.p0[1]); }
        if (gesto.tipo === 'muovi') { r.x = gesto.r0.x + p[0] - gesto.p0[0]; r.y = gesto.r0.y + p[1] - gesto.p0[1]; }
        if (gesto.tipo === 'allarga') { r.w = Math.max(4, gesto.r0.w + p[0] - gesto.p0[0]); r.h = Math.max(4, gesto.r0.h + p[1] - gesto.p0[1]); }
        disegnaRett();
      });
      const su = (e) => {
        dita.delete(e.pointerId);
        if (gesto?.tipo === 'nuovo') { const r = rett[gesto.i]; if (r.w < 8 || r.h < 8) { rett.splice(gesto.i, 1); scelto = -1; } disegnaRett(); aggiornaOk(); }
        if (!dita.size) gesto = null;
      };
      svg.addEventListener('pointerup', su); svg.addEventListener('pointercancel', su);
    }
    ov.querySelectorAll('[data-modo]').forEach((b) => (b.onclick = () => { modo = b.dataset.modo; ov.querySelectorAll('[data-modo]').forEach((x) => x.classList.toggle('on', x === b)); box.classList.toggle('disegno', modo === 'disegna'); }));
    ov.querySelectorAll('[data-gira]').forEach((b) => (b.onclick = () => { if (!svg) return; ang = Math.max(-90, Math.min(90, ang + +b.dataset.gira)); vista(); }));
    ov.querySelectorAll('[data-zoom]').forEach((b) => (b.onclick = () => svg && zoom(+b.dataset.zoom)));
    togli.onclick = () => { if (scelto >= 0) { rett.splice(scelto, 1); scelto = -1; disegnaRett(); aggiornaOk(); } };
    ov.querySelector('#lmVai').onclick = cerca;
    ov.querySelector('#lmQ').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); cerca(); } };
    ok.onclick = () => {
      const m = metriPerPx(lat), x0 = Math.min(...rett.map((r) => r.x)), y0 = Math.min(...rett.map((r) => r.y)), r1 = (v) => Math.round(v * 10) / 10;
      const out = rett.map((r) => ({ x: r1((r.x - x0) * m), y: r1((r.y - y0) * m), w: r1(r.w * m), h: r1(r.h * m), nome: '' }));
      chiudi(); onScelti(out);
    };
    if (indirizzo) cerca(); else box.innerHTML = '<p class="muted small">Scrivi l\'indirizzo e tocca «Cerca».</p>';
  }
  return { apri, px };
})();
