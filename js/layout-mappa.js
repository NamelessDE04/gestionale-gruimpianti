// ===== CAPANNONI DALLA MAPPA (OpenStreetMap) =====
// Dall'indirizzo della sede trovo gli edifici disegnati su OpenStreetMap: tocchi quelli che sono i capannoni
// e diventano capannoni del layout con le misure vere in metri (il rettangolo che li contiene, già raddrizzato).
// Servizi gratuiti, senza chiave: Nominatim (indirizzo → coordinate), Overpass (edifici), tile della mappa OSM.
window.LAYMAP = (function () {
  const { esc } = UI;
  const Z = 18, T = 256;   // livello di zoom della mappa sotto e grandezza delle tessere
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
  async function edifici(lat, lon, raggio = 350) {
    const q = `[out:json][timeout:25];way["building"](around:${raggio},${lat},${lon});out geom;`;
    const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (!r.ok) throw new Error('edifici');
    const j = await r.json();
    return (j.elements || []).filter((e) => e.geometry && e.geometry.length > 3).map((e) => ({ id: e.id, nome: e.tags?.name || '', pts: e.geometry.map((g) => px(g.lon, g.lat)) }));
  }
  const area = (p) => Math.abs(p.reduce((a, q, i) => { const r = p[(i + 1) % p.length]; return a + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;
  const dentro = (p, [x, y]) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  // direzione principale dell'edificio: quella del lato più lungo
  function angolo(p) {
    let best = 0, ang = 0;
    p.forEach((q, i) => { const r = p[(i + 1) % p.length], l = Math.hypot(r[0] - q[0], r[1] - q[1]); if (l > best) { best = l; ang = Math.atan2(r[1] - q[1], r[0] - q[0]); } });
    // riporto tra -45° e 45°: i capannoni restano "dritti" (lati orizzontali e verticali)
    while (ang > Math.PI / 4) ang -= Math.PI / 2;
    while (ang < -Math.PI / 4) ang += Math.PI / 2;
    return ang;
  }
  // edifici scelti → rettangoli in metri, tutti raddrizzati con lo stesso angolo (quello del più grande)
  function rettangoli(scelti, lat) {
    const big = scelti.slice().sort((a, b) => area(b.pts) - area(a.pts))[0], a = -angolo(big.pts), m = metriPerPx(lat);
    const ruota = ([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
    const box = scelti.map((b) => { const r = b.pts.map(ruota), xs = r.map((q) => q[0]), ys = r.map((q) => q[1]);
      return { x: Math.min(...xs) * m, y: Math.min(...ys) * m, w: (Math.max(...xs) - Math.min(...xs)) * m, h: (Math.max(...ys) - Math.min(...ys)) * m, nome: b.nome }; });
    const x0 = Math.min(...box.map((b) => b.x)), y0 = Math.min(...box.map((b) => b.y)), r1 = (v) => Math.round(v * 10) / 10;
    return box.map((b) => ({ x: r1(b.x - x0), y: r1(b.y - y0), w: r1(b.w), h: r1(b.h), nome: b.nome }));
  }

  // finestra: cerco, mostro la mappa con gli edifici, li scegli col dito
  function apri(indirizzo, onScelti) {
    const ov = document.createElement('div'); ov.className = 'modal-ov';
    ov.innerHTML = `<div class="modal largo lm">
      <div class="modal-head"><h2>Capannoni dalla mappa</h2>${UI.info('Cerco l\'indirizzo della sede e mostro gli edifici disegnati su OpenStreetMap. Tocca i capannoni (diventano gialli) e premi «Aggiungi»: nel layout arrivano con le misure vere, raddrizzati. Le forme a L diventano il rettangolo che le contiene. Campate, gru e il resto si sistemano come sempre.')}<button type="button" class="modal-x" aria-label="Chiudi">×</button></div>
      <div class="lm-corpo">
        <div class="lm-cerca"><input id="lmQ" data-libero value="${esc(indirizzo)}" placeholder="Indirizzo della sede"><button type="button" class="btn small" id="lmVai">Cerca</button></div>
        <div class="lm-mappa" id="lmMappa"><p class="muted small">Cerco…</p></div>
        <p class="muted small lm-stato" id="lmStato"></p>
        <p class="lm-copy">Mappa e edifici © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a></p>
      </div>
      <div class="modal-foot"><span class="grow"></span><button type="button" class="btn ghost" data-annulla>Annulla</button><button type="button" class="btn" id="lmOk" disabled>Aggiungi</button></div>
    </div>`;
    document.body.appendChild(ov); document.body.classList.add('modal-aperto');
    const chiudi = () => { ov.remove(); document.body.classList.remove('modal-aperto'); };
    ov.querySelector('.modal-x').onclick = chiudi; ov.querySelector('[data-annulla]').onclick = chiudi;
    const box = ov.querySelector('#lmMappa'), stato = ov.querySelector('#lmStato'), ok = ov.querySelector('#lmOk');
    let lista = [], scelti = new Set(), lat = 45, O = [0, 0];
    const aggiornaOk = () => { ok.disabled = !scelti.size; ok.textContent = scelti.size ? `Aggiungi ${scelti.size} ${scelti.size === 1 ? 'capannone' : 'capannoni'}` : 'Aggiungi'; };
    async function cerca() {
      box.innerHTML = '<p class="muted small">Cerco l\'indirizzo…</p>'; stato.textContent = ''; scelti = new Set(); aggiornaOk();
      try {
        const g = await geocodifica(ov.querySelector('#lmQ').value.trim());
        if (!g) { box.innerHTML = '<p class="nessuno">Indirizzo non trovato: prova a scriverlo diverso (via, numero, città).</p>'; return; }
        lat = g.lat; box.innerHTML = '<p class="muted small">Cerco gli edifici intorno…</p>';
        lista = await edifici(g.lat, g.lon);
        if (!lista.length) { box.innerHTML = '<p class="nessuno">Qui su OpenStreetMap non ci sono edifici disegnati.</p>'; return; }
        // le coordinate "del mondo" sono numeri enormi: l'SVG li disegna male (bordi doppi), quindi le rendo relative a un'origine vicina
        const cw = px(g.lon, g.lat); O = [Math.floor(cw[0] / T) * T, Math.floor(cw[1] / T) * T];
        lista.forEach((b) => (b.pts = b.pts.map(([x, y]) => [x - O[0], y - O[1]])));
        const c = [cw[0] - O[0], cw[1] - O[1]];
        // preseleziono l'edificio sull'indirizzo (o il più vicino)
        const su = lista.find((b) => dentro(b.pts, c)) || lista.slice().sort((a, b) => Math.hypot(...[0, 1].map((k) => a.pts[0][k] - c[k])) - Math.hypot(...[0, 1].map((k) => b.pts[0][k] - c[k])))[0];
        if (su) scelti.add(su.id);
        disegna(c); aggiornaOk();
        stato.textContent = `${lista.length} edifici trovati intorno a: ${g.nome}`;
      } catch (e) { box.innerHTML = '<p class="nessuno">Servizio della mappa non raggiungibile. Controlla la connessione e riprova.</p>'; }
    }
    function disegna(c) {
      const tutti = lista.flatMap((b) => b.pts), xs = tutti.map((q) => q[0]), ys = tutti.map((q) => q[1]);
      const x0 = Math.min(...xs, c[0]) - 30, y0 = Math.min(...ys, c[1]) - 30, x1 = Math.max(...xs, c[0]) + 30, y1 = Math.max(...ys, c[1]) + 30;
      let tess = '';
      for (let tx = Math.floor(x0 / T); tx <= Math.floor(x1 / T); tx++) for (let ty = Math.floor(y0 / T); ty <= Math.floor(y1 / T); ty++)
        tess += `<image href="https://tile.openstreetmap.org/${Z}/${tx + O[0] / T}/${ty + O[1] / T}.png" x="${tx * T}" y="${ty * T}" width="${T}" height="${T}" opacity="0.55"/>`;
      box.innerHTML = `<svg viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" xmlns="http://www.w3.org/2000/svg">${tess}
        ${lista.map((b) => `<polygon data-b="${b.id}" points="${b.pts.map((q) => q.join(',')).join(' ')}" class="${scelti.has(b.id) ? 'on' : ''}"/>`).join('')}
        <circle cx="${c[0]}" cy="${c[1]}" r="5" fill="#d6453d" stroke="#fff" stroke-width="2"/></svg>`;
      box.querySelectorAll('[data-b]').forEach((pg) => (pg.onclick = () => { const id = +pg.dataset.b; scelti.has(id) ? scelti.delete(id) : scelti.add(id); pg.classList.toggle('on', scelti.has(id)); aggiornaOk(); }));
    }
    ov.querySelector('#lmVai').onclick = cerca;
    ov.querySelector('#lmQ').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); cerca(); } };
    ok.onclick = () => { const r = rettangoli(lista.filter((b) => scelti.has(b.id)), lat); chiudi(); onScelti(r); };
    if (indirizzo) cerca(); else box.innerHTML = '<p class="muted small">Scrivi l\'indirizzo e tocca «Cerca».</p>';
  }
  return { apri, rettangoli, px };
})();
