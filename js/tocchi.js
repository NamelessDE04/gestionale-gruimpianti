// Filtro dei tocchi involontari ("tocchi fantasma") di alcuni tablet.
// Vale solo per questo dispositivo (localStorage). Blocca solo dita e penna: il mouse funziona sempre.
//  - zona: una fascia in basso (al centro o tutta larga) dove i tocchi non valgono
//  - raffica: tanti tocchi velocissimi nello stesso punto (tipico del tocco fantasma) vengono ignorati
const Tocchi = (() => {
  const KEY = 'gid_tocchi';
  const BASE = { zona: 'no', altezza: 10, larghezza: 40, raffica: false, alza: true, segna: true };
  const leggi = () => { try { return { ...BASE, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...BASE }; } };
  let C = leggi(), bloccati = 0, ultimoBlocco = null, recenti = [];

  function salva(n) {
    C = { ...C, ...n };
    try { localStorage.setItem(KEY, JSON.stringify(C)); } catch {}
    applica();
  }

  // rettangolo della zona in pixel (oppure null)
  function rett() {
    if (C.zona === 'no') return null;
    const W = innerWidth, H = innerHeight, h = H * C.altezza / 100;
    const w = C.zona === 'basso' ? W : W * C.larghezza / 100;
    return { x: (W - w) / 2, y: H - h, w, h };
  }
  const dentro = (x, y) => { const r = rett(); return !!r && x >= r.x && x <= r.x + r.w && y >= r.y; };

  // i tasti fissi in basso (Salva, Finisci…) salgono sopra la zona, così restano usabili
  function applica() {
    const r = rett(), b = document.body; if (!b) return;
    b.classList.toggle('tz-alza', !!r && C.alza);
    document.documentElement.style.setProperty('--tz-h', r ? Math.round(r.h) + 'px' : '0px');
  }

  function segna(x, y) {
    bloccati++;
    if (!C.segna) return;
    const d = document.createElement('div'); d.className = 'tz-punto';
    d.style.left = x + 'px'; d.style.top = y + 'px';
    document.body.appendChild(d); setTimeout(() => d.remove(), 700);
  }

  // tocco a raffica: almeno 3 tocchi nello stesso punto (±12px) in meno di 0,6 secondi
  // (la schermata del PIN è esclusa: lì si possono battere cifre uguali di fila)
  function raffica(x, y, t, el) {
    if (!C.raffica || el?.closest?.('.login')) return false;
    recenti = recenti.filter((p) => t - p.t < 600);
    const vicini = recenti.filter((p) => Math.abs(p.x - x) < 12 && Math.abs(p.y - y) < 12).length;
    recenti.push({ x, y, t });
    return vicini >= 2;
  }

  function punto(e) {
    const p = e.touches?.[0] || e.changedTouches?.[0] || e;
    return { x: p.clientX, y: p.clientY };
  }
  // l'evento viene da dito/penna? (il mouse non viene mai bloccato)
  const dito = (e) => e.type.startsWith('touch') || (e.pointerType && e.pointerType !== 'mouse') || (e.sourceCapabilities?.firesTouchEvents);

  function ferma(e) { e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); }

  function inizio(e) {
    // la schermata del PIN non viene mai filtrata: così si riesce sempre a entrare
    if (!dito(e) || e.target?.closest?.('.tz-prova, .login')) return;
    const { x, y } = punto(e), t = Date.now();
    if (ultimoBlocco && t - ultimoBlocco.t < 50) return ferma(e);   // stesso tocco (touchstart + pointerdown)
    // la raffica la conto una volta sola per tocco (pointerdown; touchstart solo nei browser senza pointer)
    const conta = e.type === 'pointerdown' || !window.PointerEvent;
    if (dentro(x, y) || (conta && raffica(x, y, t, e.target))) { ultimoBlocco = { x, y, t }; segna(x, y); ferma(e); }
  }
  // dopo un tocco bloccato fermo anche il rilascio e il "click" che il browser genera
  function seguito(e) {
    if (!ultimoBlocco || Date.now() - ultimoBlocco.t > 700) return;
    if (e.pointerType === 'mouse' || (e.type.startsWith('mouse') && e.sourceCapabilities && !e.sourceCapabilities.firesTouchEvents)) return;   // il mouse vero passa sempre
    const { x, y } = punto(e);
    if (x === undefined || (Math.abs(x - ultimoBlocco.x) < 40 && Math.abs(y - ultimoBlocco.y) < 40)) ferma(e);
  }

  const opz = { capture: true, passive: false };
  for (const t of ['pointerdown', 'touchstart']) window.addEventListener(t, inizio, opz);
  for (const t of ['pointerup', 'touchend', 'mousedown', 'mouseup', 'click', 'contextmenu']) window.addEventListener(t, seguito, opz);
  window.addEventListener('resize', applica);
  document.addEventListener('DOMContentLoaded', applica);

  // mostra la zona per qualche secondo (per capire dove sta)
  function mostra() {
    document.querySelectorAll('.tz-mostra').forEach((x) => x.remove());
    const r = rett(); if (!r) return UI.toast('Nessuna zona: il filtro della zona è spento');
    const d = document.createElement('div'); d.className = 'tz-mostra';
    Object.assign(d.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    d.textContent = 'Qui i tocchi non valgono';
    document.body.appendChild(d); setTimeout(() => d.remove(), 2500);
  }

  // riquadro per il Profilo
  function card() {
    return `<div class="card" id="cardTocchi">
      <h2>🖐 Tocchi involontari ${UI.info('Per i tablet che "toccano da soli" sempre nello stesso punto. Vale solo per questo dispositivo. Nella zona scelta i tocchi del dito non valgono (il mouse funziona sempre); i tasti fissi in basso, come Salva e Finisci, salgono sopra la zona. Se il punto rosso compare dove non stai toccando, il filtro sta lavorando. «Tocchi a raffica» ignora i tocchi velocissimi ripetuti nello stesso punto (la schermata del PIN non viene mai filtrata, così entri sempre). Attenzione: partendo dalla zona non si riesce nemmeno a scorrere la pagina.')}</h2>
      <div class="form">
        <div class="due">
          <label>Zona da bloccare<select data-tz="zona">
            <option value="no">Nessuna</option><option value="centro">In basso al centro</option><option value="basso">Tutta la fascia in basso</option></select></label>
          <label>Altezza fascia <span class="unita" data-tzv="altezza"></span><input type="range" min="4" max="30" step="1" data-tz="altezza"></label>
        </div>
        <label data-tzc>Larghezza (al centro) <span class="unita" data-tzv="larghezza"></span><input type="range" min="15" max="90" step="5" data-tz="larghezza"></label>
        <label class="check"><input type="checkbox" data-tz="raffica"> Ignora i tocchi a raffica nello stesso punto</label>
        <label class="check"><input type="checkbox" data-tz="segna"> Mostra un punto rosso dove blocco un tocco</label>
        <div class="azioni-form"><span class="muted small" data-tzn></span><span class="grow"></span><button type="button" class="btn ghost tz-prova" id="btnTzMostra">👁 Mostra la zona</button></div>
      </div></div>`;
  }
  function collega(el) {
    const box = el.querySelector('#cardTocchi'); if (!box) return;
    const agg = () => {
      box.querySelectorAll('[data-tz]').forEach((i) => { const k = i.dataset.tz; if (i.type === 'checkbox') i.checked = !!C[k]; else i.value = C[k]; });
      box.querySelectorAll('[data-tzv]').forEach((s) => (s.textContent = C[s.dataset.tzv] + '%'));
      box.querySelector('[data-tzc]').hidden = C.zona !== 'centro';
      box.querySelectorAll('[data-tz=altezza]').forEach((i) => (i.disabled = C.zona === 'no'));
      box.querySelector('[data-tzn]').textContent = bloccati ? `Bloccati finora: ${bloccati}` : '';
    };
    box.querySelectorAll('[data-tz]').forEach((i) => {
      i.addEventListener(i.type === 'range' ? 'input' : 'change', () => {
        salva({ [i.dataset.tz]: i.type === 'checkbox' ? i.checked : i.type === 'range' ? +i.value : i.value }); agg();
      });
      if (i.type === 'range') i.addEventListener('change', mostra);
    });
    box.querySelector('[data-tz=zona]').addEventListener('change', mostra);
    box.querySelector('#btnTzMostra').onclick = mostra;
    agg();
  }
  return { card, collega, impostazioni: () => ({ ...C }) };
})();
