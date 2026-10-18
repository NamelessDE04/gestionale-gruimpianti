// ===== UTILITÀ COMUNI (date, testo, firma, foto) =====
window.UI = (function () {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // --- date (formato ISO "AAAA-MM-GG", ora locale) ---
  const iso = (d) => {
    const z = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  };
  const oggi = () => iso(new Date());
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addMesi = (s, n) => {
    const d = parse(s); const g = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + n);
    const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(g, ultimo));
    return iso(d);
  };
  const addGiorni = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const giorniDa = (s) => Math.round((parse(s) - parse(oggi())) / 86400000); // >0 nel futuro
  const fmt = (s) => { if (!s) return '—'; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };

  // --- messaggi ---
  let tt;
  const toast = (msg, tipo) => {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = 'show ' + (tipo || '');
    clearTimeout(tt); tt = setTimeout(() => (t.className = ''), tipo === 'err' ? 3200 : 2200);
  };

  const salva = async (col, doc) => {
    try { return await Backend.save(col, doc); }
    catch (e) {
      console.error(e);
      const m = (e.code || '') + ' ' + e.name + ' ' + e.message;
      toast(/quota/i.test(m) ? 'Memoria del dispositivo piena: elimina qualche foto.'
        : /permission/i.test(m) ? 'L\'account Google di questo dispositivo non ha il permesso per questa modifica'
        : /too large|exceeds the maximum/i.test(m) ? 'Documento troppo grande per il cloud: togli qualche foto o firma'
        : /sola lettura/.test(m) ? 'Accesso in sola lettura' : 'Errore nel salvataggio', 'err');
      throw e;
    }
  };

  // --- firma col dito (canvas) ---
  function firmaPad(canvas) {
    const ctx = canvas.getContext('2d');
    let vuota = true, disegna = false, last = null;
    let box = null; // area disegnata (per ritagliare la firma)
    let dpr0 = window.devicePixelRatio || 1;
    const allarga = (p) => { box = box ? { x0: Math.min(box.x0, p.x), y0: Math.min(box.y0, p.y), x1: Math.max(box.x1, p.x), y1: Math.max(box.y1, p.y) } : { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; };
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
      if (!w || !h || (w === canvas.width && h === canvas.height)) return;   // stessa misura: non cancello niente
      // copia sincrona del disegno, così la firma non sparisce mai (nemmeno per un attimo)
      let copia = null;
      if (!vuota) { copia = document.createElement('canvas'); copia.width = canvas.width; copia.height = canvas.height; copia.getContext('2d').drawImage(canvas, 0, 0); }
      const vecchiaW = canvas.width / dpr0;
      canvas.width = w; canvas.height = h;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#10243a';
      if (copia) {
        const k = r.width / vecchiaW;   // la firma segue la nuova larghezza
        ctx.drawImage(copia, 0, 0, copia.width, copia.height, 0, 0, copia.width / dpr0 * k, copia.height / dpr0 * k);
        if (box) box = { x0: box.x0 * k, y0: box.y0 * k, x1: box.x1 * k, y1: box.y1 * k };
      }
      dpr0 = dpr;
    };
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId); disegna = true; last = pos(e); allarga(last);
      ctx.beginPath(); ctx.arc(last.x, last.y, 1.1, 0, Math.PI * 2); ctx.fillStyle = '#10243a'; ctx.fill();
      vuota = false; canvas.closest('.firma')?.classList.add('firmata');
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!disegna) return; const p = pos(e);
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; allarga(p);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => canvas.addEventListener(ev, () => (disegna = false)));
    requestAnimationFrame(resize);
    window.addEventListener('resize', resize);
    return {
      vuota: () => vuota,
      pulisci() { ctx.clearRect(0, 0, canvas.width, canvas.height); vuota = true; box = null; canvas.closest('.firma')?.classList.remove('firmata'); },
      immagine() {
        if (vuota) return null;
        // ritaglio solo la parte firmata, sfondo trasparente, larghezza max 500 px
        const dpr = canvas.width / canvas.getBoundingClientRect().width;
        const r = canvas.getBoundingClientRect();
        const b = box || { x0: 0, y0: 0, x1: r.width, y1: r.height }, m = 6;
        const x = Math.max(0, b.x0 - m) * dpr, y = Math.max(0, b.y0 - m) * dpr;
        const w = Math.min(canvas.width - x, (b.x1 - b.x0 + 2 * m) * dpr), h = Math.min(canvas.height - y, (b.y1 - b.y0 + 2 * m) * dpr);
        const k = Math.min(1, 500 / w);
        const out = document.createElement('canvas'); out.width = Math.round(w * k); out.height = Math.round(h * k);
        out.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, out.width, out.height);
        return out.toDataURL('image/png');
      }
    };
  }

  // --- foto: ridotte a max 1280 px e compresse (~100-200 KB) ---
  function comprimiFoto(file, max = 1280, q = 0.62) {
    return new Promise((ok, ko) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => {
        const k = Math.min(1, max / Math.max(im.width, im.height));
        const c = document.createElement('canvas');
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        ok(c.toDataURL('image/jpeg', q));
      };
      im.onerror = ko; im.src = url;
    });
  }


  // --- "i" cerchiata: spiegazione a scomparsa (si chiude toccando altrove) ---
  document.addEventListener('click', (e) => document.querySelectorAll('details.info[open]').forEach((d) => { if (!d.contains(e.target)) d.open = false; }));
  const info = (testo) => `<details class="info" onclick="event.stopPropagation()"><summary aria-label="Informazioni">i</summary><div class="info-txt">${testo}</div></details>`;

  // --- finestra con modulo (per modificare dati senza cambiare pagina) ---
  // campi: [{k, label, tipo: 'text'|'email'|'tel'|'textarea'|'number', req, mezza, placeholder, aiuto}]
  function modal({ titolo, campi, valori = {}, onSalva, onElimina, testoElimina = 'Elimina', infoTxt, testoSalva = 'Salva', largo }) {
    if (window.UT && UT.solaLettura()) { toast('Accesso in sola lettura: puoi consultare e stampare'); return () => {}; }
    const ov = document.createElement('div');
    ov.className = 'modal-ov';
    ov.innerHTML = `
      <form class="modal ${largo ? 'largo' : ''}" novalidate>
        <div class="modal-head"><h2>${esc(titolo)}</h2>${infoTxt ? info(infoTxt) : ''}
          <button type="button" class="modal-x" aria-label="Chiudi">×</button></div>
        <div class="modal-body">
          ${campi.map((c) => c.tipo === 'titolo' ? `<h3 class="modal-sez">${esc(c.label)}</h3>` : c.tipo === 'sino' ? `
            <label class="check modal-check ${c.mezza ? 'mezza' : ''}"><input type="checkbox" name="${c.k}" ${valori[c.k] ? 'checked' : ''}> ${esc(c.label)}</label>` : `
            <label class="${c.mezza ? 'mezza' : ''} ${c.terzo ? 'terzo' : ''}">${esc(c.label)}${c.u ? ` <span class="unita">(${esc(c.u)})</span>` : ''}${c.req ? ' *' : ''}
              ${c.tipo === 'immagine'
                ? `<div class="campo-img" data-img="${c.k}">
                     <div class="img-prev">${valori[c.k] ? `<img src="${valori[c.k]}" alt="">` : `<span class="muted small">${esc(c.vuoto || 'Nessuna immagine')}</span>`}</div>
                     <span class="img-btn btn ghost small">📷 Scegli immagine<input type="file" accept="image/*" hidden></span>
                     <button type="button" class="btn ghost small danger" data-img-rm ${valori[c.k] ? '' : 'hidden'}>Togli</button>
                   </div>`
                : c.tipo === 'multi'
                ? `<div class="multi-campo" data-multi="${c.k}"></div><button type="button" class="btn ghost small" data-multi-add="${c.k}">+ ${esc(c.aggiungi || 'Aggiungi')}</button>`
                : c.tipo === 'select'
                ? `<select name="${c.k}"><option value="">—</option>${c.opzioni.map((o) => `<option ${o === valori[c.k] ? 'selected' : ''}>${esc(o)}</option>`).join('')}${valori[c.k] && !c.opzioni.includes(valori[c.k]) ? `<option selected>${esc(valori[c.k])}</option>` : ''}</select>`
                : c.tipo === 'textarea'
                ? `<textarea name="${c.k}" rows="3" placeholder="${esc(c.placeholder || '')}">${esc(valori[c.k] || '')}</textarea>`
                : `<input name="${c.k}" type="${c.tipo || 'text'}" ${c.tipo === 'tel' ? 'inputmode="tel"' : ''} ${c.num ? 'inputmode="decimal"' : ''} ${c.lista ? `list="dl-${c.k}"` : ''} placeholder="${esc(c.placeholder || '')}" value="${esc(valori[c.k] ?? '')}" ${c.maiuscolo ? 'style="text-transform:uppercase"' : ''}>${c.lista ? `<datalist id="dl-${c.k}">${c.lista.map((o) => `<option value="${esc(o)}">`).join('')}</datalist>` : ''}`}
              ${c.aiuto ? `<small class="muted">${esc(c.aiuto)}</small>` : ''}
            </label>`).join('')}
        </div>
        <div class="modal-foot">
          ${onElimina ? `<button type="button" class="btn danger ghost" data-del>${esc(testoElimina)}</button>` : ''}
          <span class="grow"></span>
          <button type="button" class="btn ghost" data-annulla>Annulla</button>
          <button type="submit" class="btn">${esc(testoSalva)}</button>
        </div>
      </form>`;
    document.body.appendChild(ov);
    document.body.classList.add('modal-aperto');
    const f = ov.querySelector('form');
    // campi con più valori (es. più tensioni secondarie)
    const multi = {};
    campi.filter((c) => c.tipo === 'multi').forEach((c) => {
      const v0 = valori[c.k]; multi[c.k] = Array.isArray(v0) ? v0.slice() : v0 ? [v0] : [];
      if (!multi[c.k].length) multi[c.k].push('');
      const box = f.querySelector(`[data-multi="${c.k}"]`);
      const leggi = () => box.querySelectorAll('input').forEach((n, j) => (multi[c.k][j] = n.value));
      const disegna = () => {
        box.innerHTML = multi[c.k].map((x, j) => `<div class="multi-riga"><input value="${esc(x)}" placeholder="${esc(c.placeholder || '')}" ${c.lista ? `list="dl-${c.k}"` : ''}>${multi[c.k].length > 1 ? `<button type="button" class="btn ghost small danger" data-j="${j}" aria-label="Togli">×</button>` : ''}</div>`).join('')
          + (c.lista ? `<datalist id="dl-${c.k}">${c.lista.map((o) => `<option value="${esc(o)}">`).join('')}</datalist>` : '');
        box.querySelectorAll('[data-j]').forEach((b) => (b.onclick = () => { leggi(); multi[c.k].splice(+b.dataset.j, 1); disegna(); }));
      };
      disegna();
      f.querySelector(`[data-multi-add="${c.k}"]`).onclick = () => { leggi(); multi[c.k].push(''); disegna(); [...box.querySelectorAll('.multi-riga input')].pop()?.focus(); };
      multi[c.k].leggi = leggi;
    });
    const immagini = {};
    campi.filter((c) => c.tipo === 'immagine').forEach((c) => {
      immagini[c.k] = valori[c.k] || '';
      const box = f.querySelector(`[data-img="${c.k}"]`), inp = box.querySelector('input'), rm = box.querySelector('[data-img-rm]');
      const mostra = () => {
        box.querySelector('.img-prev').innerHTML = immagini[c.k] ? `<img src="${immagini[c.k]}" alt="">` : `<span class="muted small">${esc(c.vuoto || 'Nessuna immagine')}</span>`;
        rm.hidden = !immagini[c.k];
      };
      box.querySelector('.img-btn').onclick = () => inp.click();
      inp.onchange = async () => { if (inp.files[0]) { try { immagini[c.k] = await comprimiLogo(inp.files[0]); } catch (e) { toast('Immagine non leggibile', 'err'); } mostra(); } };
      rm.onclick = () => { immagini[c.k] = ''; mostra(); };
    });
    const chiudi = () => { ov.remove(); document.body.classList.remove('modal-aperto'); };
    ov.querySelector('.modal-x').onclick = chiudi;
    ov.querySelector('[data-annulla]').onclick = chiudi;
    ov.addEventListener('click', (e) => { if (e.target === ov) chiudi(); });
    setTimeout(() => f.querySelector('input:not([type=checkbox]):not([type=file]),textarea')?.focus({ preventScroll: true }), 50);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const v = {};
      campi.forEach((c) => { if (c.tipo === 'titolo') return; if (c.tipo === 'immagine') { v[c.k] = immagini[c.k]; return; } if (c.tipo === 'sino') { v[c.k] = f[c.k].checked; return; } if (c.tipo === 'multi') { multi[c.k].leggi(); v[c.k] = multi[c.k].map((x) => x.trim()).filter(Boolean); return; } let x = f[c.k].value.trim(); if (daMaiusc(f[c.k])) x = x.toUpperCase(); v[c.k] = x; });
      const manca = campi.find((c) => c.req && !v[c.k]);
      if (manca) { f[manca.k].focus(); return toast(`Compila «${manca.label}»`, 'err'); }
      const malMail = campi.find((c) => c.tipo === 'email' && v[c.k] && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v[c.k]));
      if (malMail) { f[malMail.k].focus(); return toast(`«${malMail.label}» non sembra un indirizzo valido`, 'err'); }
      try { if ((await onSalva(v)) !== false) chiudi(); } catch (er) { /* errore già mostrato */ }
    };
    if (onElimina) ov.querySelector('[data-del]').onclick = async () => { if ((await onElimina()) !== false) chiudi(); };
    return chiudi;
  }

  // logo: lato massimo 256 px su sfondo bianco (pochi KB)
  function comprimiLogo(file) {
    return new Promise((ok, ko) => {
      const url = URL.createObjectURL(file); const im = new Image();
      im.onload = () => {
        const k = Math.min(1, 256 / Math.max(im.width, im.height));
        const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.9));
      };
      im.onerror = ko; im.src = url;
    });
  }

  // colore del cliente/sede, come i magneti della lavagna: dipende dal mese dei controlli nel trimestre
  // 1° mese (gen/apr/lug/ott) = giallo · 2° mese = verde · 3° mese = rosso
  const COLORI_SEDE = { 1: ['giallo', '1° mese del trimestre'], 2: ['verde', '2° mese del trimestre'], 3: ['rosso', '3° mese del trimestre'] };
  const coloreSede = (s) => (s?.pianoControlli ? (COLORI_SEDE[s.pianoControlli.mese1] || [''])[0] : '');
  const magnete = (s, testo) => {
    const c = coloreSede(s), t = testo ?? s?.sigla;
    const tit = c ? `Controlli nel ${COLORI_SEDE[s.pianoControlli.mese1][1]} (${c})` : 'Mese dei controlli non impostato';
    return t ? `<span class="mag-sede c-${c || 'nessuno'}" title="${esc(tit)}">${esc(t)}</span>` : `<span class="mag-sede punto c-${c || 'nessuno'}" title="${esc(tit)}"></span>`;
  };

  const conferma = (msg) => window.confirm(msg);

  // menu "⋯" con le azioni secondarie: voci = [{ t: 'testo', href } | { t, id }] (le voci vuote si saltano)
  const menu = (voci, titolo = 'Altre azioni') => {
    const v = voci.filter(Boolean);
    if (!v.length) return '';
    return `<details class="menu-az"><summary class="btn-menu" aria-label="${esc(titolo)}" title="${esc(titolo)}">⋯</summary><div class="menu-lista">${v.map((x) => x.href
      ? `<a href="${x.href}"${x.cls ? ` class="${x.cls}"` : ''}>${x.t}</a>` : `<button type="button" id="${x.id}"${x.cls ? ` class="${x.cls}"` : ''}>${x.t}</button>`).join('')}</div></details>`;
  };
  // si chiude toccando fuori o scegliendo una voce
  document.addEventListener('click', (e) => {
    document.querySelectorAll('details.menu-az[open]').forEach((d) => { if (!d.contains(e.target) || e.target.closest('.menu-lista a, .menu-lista button')) d.open = false; });
  });

  // ===== TASTIERA APERTA (telefono) =====
  // mentre si scrive spariscono barre fisse e pulsanti galleggianti, e il campo viene portato al centro
  const scrivibile = (el) => el && (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'file', 'range'].includes(el.type)));
  let ttTast;
  document.addEventListener('focusin', (e) => {
    if (!scrivibile(e.target) || innerWidth > 760) return;
    clearTimeout(ttTast); document.body.classList.add('scrive');
    if (e.target.tagName !== 'SELECT') setTimeout(() => { try { e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (x) {} }, 320);
  });
  document.addEventListener('focusout', () => { clearTimeout(ttTast); ttTast = setTimeout(() => { if (!scrivibile(document.activeElement)) document.body.classList.remove('scrive'); }, 150); });

  // ===== TUTTO MAIUSCOLO =====
  // Tutti i campi di testo sono in maiuscolo. Restano come sono: email, PIN/password,
  // numeri, date e i campi marcati con data-libero.
  const TIPI_MAIUSC = ['text', 'search', 'tel', ''];
  const daMaiusc = (el) => el && !el.hasAttribute('data-libero') &&
    (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && TIPI_MAIUSC.includes((el.getAttribute('type') || '').toLowerCase())));
  const maiusc = (el) => { if (daMaiusc(el) && el.value !== el.value.toUpperCase()) el.value = el.value.toUpperCase(); };
  // si converte quando si esce dal campo o si salva (non mentre si scrive: alcune tastiere Android si confondono)
  document.addEventListener('change', (e) => maiusc(e.target), true);
  document.addEventListener('focusout', (e) => maiusc(e.target), true);
  document.addEventListener('submit', (e) => e.target.querySelectorAll('input, textarea').forEach(maiusc), true);

  return { menu, coloreSede, magnete, COLORI_SEDE, info, modal, esc, uid, iso, oggi, addMesi, addGiorni, giorniDa, fmt, toast, salva, firmaPad, comprimiFoto, conferma };
})();
