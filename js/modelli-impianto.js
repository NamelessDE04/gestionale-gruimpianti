// ===== MODELLI DI ANAGRAFICA IMPIANTO =====
// Ogni impianto ha un "tipo" (gru a ponte, gru a bandiera, seghetto… o uno creato da master/developer, es. sollevatore).
// Il tipo decide quali tab e quali voci ha la scheda dell'impianto.
// Salvati in impostazioni/modelliImpianto. Le gru continuano ad avere le loro tab fisse (sollevamento, carrello, ponte, elettrico);
// le «sezioni» sono voci libere create qui.
window.MIMP = (function () {
  const { esc, uid, info } = UI;

  const ICONE = {
    ponte: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M6 36V8M34 36V8" stroke="#16324f" stroke-width="4"/><path d="M3 9h34" stroke="#f2b705" stroke-width="5"/><rect x="16" y="12" width="8" height="5" fill="#16324f"/><path d="M20 17v9c0 4-4 4-4 1" fill="none" stroke="#16324f" stroke-width="2.5"/></svg>`,
    bandiera: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M10 36V5" stroke="#16324f" stroke-width="4"/><path d="M10 8h24" stroke="#f2b705" stroke-width="5"/><path d="M26 10v10" stroke="#16324f" stroke-width="2"/><path d="M26 20c0 4-4 4-4 1" fill="none" stroke="#16324f" stroke-width="2.5"/><path d="M5 36h12" stroke="#16324f" stroke-width="4"/></svg>`,
    seghetto: `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="5" y="27" width="30" height="5" rx="1" fill="#16324f"/><path d="M8 27V22M32 27V22" stroke="#16324f" stroke-width="3"/><path d="M7 14h26l-3 8H10z" fill="#f2b705" stroke="#16324f" stroke-width="2"/><path d="M10 22l2 2 2-2 2 2 2-2 2 2 2-2 2 2 2-2 2 2 2-2" fill="none" stroke="#16324f" stroke-width="1.6"/><path d="M28 14V9h-6" stroke="#16324f" stroke-width="2.5" fill="none"/><path d="M5 36h30" stroke="#16324f" stroke-width="3"/></svg>`,
    muletto: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 30V15h10l4 7v8z" fill="#f2b705" stroke="#16324f" stroke-width="2"/><path d="M10 15V9h6v6" fill="none" stroke="#16324f" stroke-width="2"/><path d="M26 6v26M26 31h10" stroke="#16324f" stroke-width="3"/><circle cx="12" cy="32" r="3.5" fill="#16324f"/><circle cx="21" cy="32" r="3.5" fill="#16324f"/></svg>`,
    monotrave: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M5 36V10M35 36V10" stroke="#16324f" stroke-width="3.5"/><rect x="3" y="8" width="34" height="5" fill="#f2b705" stroke="#16324f" stroke-width="1.5"/><rect x="15" y="13" width="10" height="6" rx="1" fill="#16324f"/><path d="M20 19v8" stroke="#16324f" stroke-width="2"/><path d="M20 27c0 4-4 4-4 1" fill="none" stroke="#16324f" stroke-width="2.5"/></svg>`,
    bitrave: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M5 36V12M35 36V12" stroke="#16324f" stroke-width="3.5"/><rect x="3" y="11" width="34" height="4" fill="#f2b705" stroke="#16324f" stroke-width="1.5"/><rect x="3" y="16" width="34" height="4" fill="#f2b705" stroke="#16324f" stroke-width="1.5"/><rect x="14" y="5" width="12" height="6" rx="1" fill="#16324f"/><path d="M18 20v7M22 20v7" stroke="#16324f" stroke-width="1.6"/><rect x="16.5" y="26" width="7" height="3" rx="1" fill="#16324f"/><path d="M20 29v3c0 3-3 3-3 1" fill="none" stroke="#16324f" stroke-width="2.2"/></svg>`,
    mensola: `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="3" y="3" width="6" height="34" fill="#c9d3dd" stroke="#16324f" stroke-width="1.5"/><path d="M4 9l4-3M4 16l4-3M4 23l4-3M4 30l4-3" stroke="#16324f" stroke-width="1"/><rect x="9" y="9" width="3" height="16" fill="#16324f"/><path d="M12 10h25" stroke="#f2b705" stroke-width="4.5"/><path d="M12 22L30 12" stroke="#16324f" stroke-width="2"/><rect x="25" y="13" width="7" height="5" rx="1" fill="#16324f"/><path d="M28.5 18v7c0 3.5-3.5 3.5-3.5 1" fill="none" stroke="#16324f" stroke-width="2.2"/></svg>`,
    pinzaCoil: `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="5" r="3" fill="none" stroke="#16324f" stroke-width="2.2"/><path d="M8 9h24" stroke="#16324f" stroke-width="3.5"/><path d="M9 9v19h5M31 9v19h-5" fill="none" stroke="#16324f" stroke-width="3" stroke-linejoin="round"/><circle cx="20" cy="27" r="9" fill="#f2b705" stroke="#16324f" stroke-width="1.5"/><circle cx="20" cy="27" r="3.5" fill="#fff" stroke="#16324f" stroke-width="1.5"/><path d="M14 28h3.5M26 28h-3.5" stroke="#16324f" stroke-width="3"/></svg>`,
    gancioC: `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="22" cy="5" r="3" fill="none" stroke="#16324f" stroke-width="2.2"/><path d="M22 8v3H8v24h22" fill="none" stroke="#16324f" stroke-width="4" stroke-linejoin="round"/><rect x="18" y="22" width="16" height="11" rx="2" fill="#f2b705" stroke="#16324f" stroke-width="1.5"/><path d="M21 22v11M24 22v11M27 22v11M30 22v11" stroke="#16324f" stroke-width=".8" opacity=".6"/><path d="M8 35h26" stroke="#16324f" stroke-width="3.5"/></svg>`,
    magnete: `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="5" r="3" fill="none" stroke="#16324f" stroke-width="2.2"/><path d="M20 8L10 17M20 8l10 9" stroke="#16324f" stroke-width="2"/><rect x="6" y="17" width="28" height="9" rx="2" fill="#16324f"/><rect x="8" y="26" width="24" height="3" fill="#f2b705"/><path d="M12 31v3M17 31v4M23 31v4M28 31v3" stroke="#f2b705" stroke-width="2" stroke-linecap="round"/><path d="M21 19l-3 3h4l-3 3" fill="none" stroke="#f2b705" stroke-width="1.6"/></svg>`,
    pinzaLastre: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M15 3h10v6c0 3-10 3-10 0z" fill="none" stroke="#16324f" stroke-width="2.2"/><path d="M11 11h18v14H23v-8h-6v8h-6z" fill="#16324f"/><rect x="18" y="16" width="4" height="21" fill="#f2b705" stroke="#16324f" stroke-width="1"/><circle cx="14" cy="20" r="1.8" fill="#f2b705"/><path d="M26 13l4-4" stroke="#f2b705" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    bilancino: `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="5" r="3" fill="none" stroke="#16324f" stroke-width="2.2"/><path d="M20 8L8 17M20 8l12 9" stroke="#16324f" stroke-width="2"/><rect x="3" y="17" width="34" height="5" fill="#f2b705" stroke="#16324f" stroke-width="1.5"/><path d="M8 22v6M32 22v6" stroke="#16324f" stroke-width="2"/><path d="M8 28c0 4-4 4-4 1M32 28c0 4-4 4-4 1" fill="none" stroke="#16324f" stroke-width="2.3"/></svg>`,
    scala: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M10 34L17 4M24 34L31 4" stroke="#16324f" stroke-width="2.8" stroke-linecap="round"/><path d="M11.5 28h13.5M13 22h13.5M14.5 16h13.5M16 10h13.5" stroke="#f2b705" stroke-width="2.6"/><path d="M16 4h16" stroke="#16324f" stroke-width="2.5"/><path d="M6 34h24" stroke="#16324f" stroke-width="2.5"/><circle cx="8" cy="36.5" r="2.5" fill="#16324f"/><circle cx="28" cy="36.5" r="2.5" fill="#16324f"/></svg>`,
    generico: `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="9" fill="#f2b705" stroke="#16324f" stroke-width="3"/><circle cx="20" cy="20" r="3.5" fill="#16324f"/><path d="M20 5v6M20 29v6M5 20h6M29 20h6M9.5 9.5l4 4M26.5 26.5l4 4M9.5 30.5l4-4M26.5 13.5l4-4" stroke="#16324f" stroke-width="3"/></svg>`
  };
  const NOMI_ICONE = { ponte: 'Gru a ponte', bandiera: 'Bandiera', seghetto: 'Seghetto', muletto: 'Sollevatore', monotrave: 'Monotrave', bitrave: 'Bitrave', mensola: 'Bandiera a mensola', pinzaCoil: 'Pinza per coils', gancioC: 'Gancio a C', magnete: 'Elettromagnete', pinzaLastre: 'Pinza lastre', bilancino: 'Bilancino', scala: 'Scala cimiteriale', generico: 'Altro' };
  const TIPI_CAMPO = [['testo', 'Testo'], ['numero', 'Numero'], ['data', 'Data'], ['sino', 'Sì / No'], ['scelta', 'Scelta']];

  const c = (k, label, tipo = 'testo', x = {}) => ({ k, label, tipo, ...x });
  const BASE = () => [
    { id: 'ponte', base: true, nome: 'Gru a ponte', icona: 'ponte', gru: true, ponte: true, elettrico: true, scartamento: true,
      tipologie: ['Bitrave', 'Bitrave tralicciata', 'Monotrave', 'Monotrave tralicciata', 'Cavalletto', 'Semicavalletto'], sezioni: [] },
    { id: 'bandiera', base: true, nome: 'Gru a bandiera', icona: 'bandiera', gru: true, ponte: false, elettrico: true, scartamento: false,
      tipologie: ['Bandiera a colonna', 'Bandiera a mensola', 'Bandiera sospesa'],
      sezioni: [{ id: 'braccio', titolo: 'Braccio e rotazione', campi: [
        c('sbraccio', 'Sbraccio', 'numero', { u: 'm' }), c('altezzaBraccio', 'Altezza sotto braccio', 'numero', { u: 'm' }),
        c('altezza', 'Altezza totale', 'numero', { u: 'm' }), c('rotazione', 'Rotazione', 'scelta', { opzioni: ['Manuale', 'Motorizzata'] }),
        c('angolo', 'Angolo di rotazione', 'scelta', { opzioni: ['180°', '270°', '360°'] }),
        c('fissaggio', 'Fissaggio', 'scelta', { opzioni: ['Colonna su plinto con tirafondi', 'Colonna con piastra e tasselli', 'A parete / pilastro'] }),
        c('fermi', 'Fermi di fine rotazione', 'sino'), c('motoreRot', 'Motore di rotazione', 'testo', { ph: 'marca, kW' })] }] },
    { id: 'seghetto', base: true, nome: 'Seghetto', icona: 'seghetto', gru: false, ponte: false, elettrico: false, scartamento: false,
      tipologie: ['Seghetto a nastro', 'Seghetto alternativo', 'Troncatrice a disco'],
      sezioni: [
        { id: 'macchina', titolo: 'Dati macchina', campi: [
          c('funzionamento', 'Funzionamento', 'scelta', { opzioni: ['Manuale', 'Semiautomatico', 'Automatico'] }),
          c('tensione', 'Tensione di alimentazione', 'numero', { u: 'V' }), c('potenzaLama', 'Potenza motore lama', 'numero', { u: 'kW' }),
          c('centralina', 'Centralina idraulica', 'sino'), c('potenzaCentr', 'Potenza centralina', 'numero', { u: 'kW' })] },
        { id: 'taglio', titolo: 'Taglio', campi: [
          c('tondo', 'Capacità di taglio tondo', 'numero', { u: 'mm' }), c('quadro', 'Capacità di taglio quadro', 'numero', { u: 'mm' }),
          c('rettangolo', 'Capacità di taglio rettangolo', 'testo', { u: 'mm', ph: 'es. 400x300' }),
          c('inclinato', 'Taglio inclinato', 'scelta', { opzioni: ['No', 'Fino a 45°', 'Fino a 60°'] }),
          c('lama', 'Dimensioni lama', 'testo', { ph: 'es. 4160x34x1,1' }), c('velLama', 'Velocità lama', 'testo', { u: 'm/min', ph: 'es. 20-90' })] },
        { id: 'sicurezze', titolo: 'Sicurezze', campi: [
          c('emergenza', 'Pulsante di emergenza', 'sino'), c('ripari', 'Ripari della lama', 'sino'),
          c('morsa', 'Morsa idraulica', 'sino'), c('refrigerante', 'Impianto refrigerante', 'sino')] }] }
  ];

  // le tipologie già personalizzate nell'elenco unico di prima vanno divise tra ponte e bandiera
  function iniziali(S) {
    const m = BASE(), vecchie = (S.impostazioni.find((x) => x.id === 'tipologieGru') || {}).voci;
    if (vecchie && vecchie.length) {
      m[0].tipologie = [...new Set([...vecchie.filter((t) => !/bandiera/i.test(t)), ...m[0].tipologie.filter((t) => vecchie.includes(t))])];
      const b = vecchie.filter((t) => /bandiera/i.test(t)); if (b.length) m[1].tipologie = b;
    }
    return m;
  }
  const tutti = (S) => {
    const salv = (S?.impostazioni?.find((x) => x.id === 'modelliImpianto') || {}).modelli;
    if (!salv) return S ? iniziali(S) : BASE();
    // un modello di base che manca (es. aggiunto in una versione nuova) torna disponibile
    return [...salv, ...BASE().filter((b) => !salv.some((x) => x.id === b.id))];
  };
  async function salvaTutti(S, ms) {
    await UI.salva('impostazioni', { id: 'modelliImpianto', modelli: ms });
    S.impostazioni = [...S.impostazioni.filter((x) => x.id !== 'modelliImpianto'), { id: 'modelliImpianto', modelli: ms }];
  }
  // tipo di un impianto: quello scelto, altrimenti lo deduco dalla tipologia (per gli impianti di prima)
  const indovina = (t = '') => (/bandiera/i.test(t) ? 'bandiera' : /seghett|segatric|troncatric/i.test(t) ? 'seghetto' : 'ponte');
  function di(S, i) {
    const ms = tutti(S);
    return ms.find((m) => m.id === i?.modello) || ms.find((m) => m.id === indovina(i?.tipologia)) || ms[0];
  }
  const icona = (S, i) => ICONE[di(S, i).icona] || ICONE.generico;

  // campi di una sezione nel formato delle finestre di modifica
  const campiModal = (sez) => sez.campi.map((f) => ({
    k: f.k, label: f.label, u: f.u || '', placeholder: f.ph || '', mezza: true,
    ...(f.tipo === 'numero' ? { num: true } : f.tipo === 'data' ? { tipo: 'date' } : f.tipo === 'sino' ? { tipo: 'sino' } : f.tipo === 'scelta' ? { tipo: 'select', opzioni: f.opzioni || [] } : {})
  }));
  const valoreCampo = (f, v) => f.tipo === 'sino' ? (v ? 'Sì' : 'No') : f.tipo === 'data' ? UI.fmt(v) : esc(v) + (f.u ? ' ' + esc(f.u) : '');
  const pieno = (f, v) => (f.tipo === 'sino' ? v === true || v === false : v !== undefined && v !== null && v !== '');
  // righe [etichetta, valore] dei campi compilati
  const righe = (sez, o) => sez.campi.filter((f) => pieno(f, o?.[f.k])).map((f) => [f.label, valoreCampo(f, o[f.k])]);

  // ================= PAGINE (solo master e developer) =================
  function elenco(el, S) {
    const ms = tutti(S);
    el.innerHTML = `
      <section class="cli mimp">
        <div class="sez-head"><h1>Tipi di impianto ${info('Ogni impianto ha un tipo: decide quali tab e quali voci ha la sua scheda in anagrafica. Puoi cambiare le voci dei tipi che ci sono o crearne di nuovi (es. sollevatore, piattaforma). I tipi «Gru a ponte», «Gru a bandiera» e «Seghetto» non si possono eliminare.')}</h1></div>
        <div class="elenco">
          ${ms.map((m) => { const n = S.impianti.filter((i) => di(S, i).id === m.id).length;
            return `<a class="riga imp-riga" href="#/impianti/modelli/${m.id}">
              <span class="imp-ico">${ICONE[m.icona] || ICONE.generico}</span>
              <div class="riga-main"><div class="riga-top"><b>${esc(m.nome)}</b></div>
                <div class="muted small">${[m.gru && 'sollevamento e carrello', m.ponte && 'ponte', m.elettrico && 'impianto elettrico', ...m.sezioni.map((s) => s.titolo.toLowerCase())].filter(Boolean).map(esc).join(' · ') || 'solo dati generali'}</div></div>
              <div class="riga-dx"><span class="conta-big">${n}</span><span class="muted small">impianti</span></div></a>`; }).join('')}
        </div>
        <a class="btn" href="#/impianti/modelli/nuovo">＋ Nuovo tipo di impianto</a>
      </section>`;
    return { titolo: 'Tipi di impianto', indietro: '#/impianti', live: true };
  }

  function modifica(el, S, id) {
    const ms = tutti(S), orig = ms.find((m) => m.id === id);
    if (id !== 'nuovo' && !orig) { el.innerHTML = '<p class="nessuno">Tipo non trovato.</p>'; return { titolo: 'Tipi di impianto', indietro: '#/impianti/modelli' }; }
    const m = orig ? JSON.parse(JSON.stringify(orig)) : { id: uid(), nome: '', icona: 'generico', gru: false, ponte: false, elettrico: false, scartamento: false, tipologie: [], sezioni: [{ id: uid(), titolo: 'Dati tecnici', campi: [{ k: 'c' + uid(), label: '', tipo: 'testo' }] }] };
    const uso = S.impianti.filter((i) => di(S, i).id === m.id).length;
    const schede = ((S.impostazioni.find((x) => x.id === 'modelliScheda') || {}).modelli || []);
    let sporco = false;
    el.innerHTML = `
      <form class="sg form card mimp-form" id="fM" novalidate>
        <h1>${orig ? 'Tipo: ' + esc(m.nome) : 'Nuovo tipo di impianto'}</h1>
        <label>Nome *<input name="nome" data-libero value="${esc(m.nome)}" placeholder="es. Sollevatore"></label>
        <div class="lab-blocco">Disegno</div>
        <div class="mimp-icone">${Object.keys(ICONE).map((k) => `<button type="button" class="mimp-ico ${m.icona === k ? 'on' : ''}" data-ico="${k}">${ICONE[k]}<span>${NOMI_ICONE[k]}</span></button>`).join('')}</div>
        <div class="lab-blocco">Tab fisse delle gru ${info('Sollevamento e carrello: paranchi con portata, fune, motori (con «Sostituisci» e storico). Ponte: traslazione del ponte. Impianto elettrico: alimentazione, pulsantiera, radiocomando.')}</div>
        <div class="checks mimp-checks">
          <label class="check"><input type="checkbox" name="gru" ${m.gru ? 'checked' : ''}> Sollevamento e carrello (paranchi e portata)</label>
          <label class="check"><input type="checkbox" name="ponte" ${m.ponte ? 'checked' : ''}> Ponte</label>
          <label class="check"><input type="checkbox" name="elettrico" ${m.elettrico ? 'checked' : ''}> Impianto elettrico gru</label>
          <label class="check"><input type="checkbox" name="scartamento" ${m.scartamento ? 'checked' : ''}> Scartamento (luce)</label>
        </div>
        <label>Tipologie (una per riga) ${info('È il menu «Tipologia» quando si crea l\'impianto. Es. per un sollevatore: Elettrico, Diesel, Telescopico.')}<textarea name="tipologie" rows="4" data-libero>${esc(m.tipologie.join('\n'))}</textarea></label>
        ${schede.length ? `<label>Scheda di controllo da proporre ${info('Il modello di scheda di controllo che viene usato per gli impianti di questo tipo, se non ne scegli un altro sul singolo impianto.')}<select name="schedaCtr"><option value="">— automatico —</option>${schede.map((s) => `<option value="${esc(s.id)}" ${s.id === m.schedaCtr ? 'selected' : ''}>${esc(s.nome)}</option>`).join('')}</select></label>` : ''}
        <h2 class="sez-form">Voci della scheda ${info('Ogni sezione diventa una tab della scheda impianto. Per ogni voce scegli se è un testo, un numero (con l\'unità, es. mm), una data, un sì/no o una scelta da un elenco (scrivi le scelte separate da virgola).')}</h2>
        <div id="sezioni"></div>
        <button type="button" class="btn ghost" id="btnSez">＋ Aggiungi sezione</button>
        <div class="azioni-form">
          ${orig && !m.base ? `<button type="button" class="btn danger ghost" id="btnElimina">Elimina</button>` : ''}
          <span class="grow"></span>
          <a class="btn ghost" href="#/impianti/modelli">Annulla</a>
          <button class="btn" type="submit">Salva</button>
        </div>
      </form>`;
    const f = el.querySelector('#fM'), box = el.querySelector('#sezioni');
    const leggi = () => box.querySelectorAll('.mimp-sez').forEach((sb, si) => {
      const s = m.sezioni[si]; s.titolo = sb.querySelector('[data-tit]').value;
      sb.querySelectorAll('.mimp-campo').forEach((r, ci) => {
        const x = s.campi[ci]; x.label = r.querySelector('[data-l]').value; x.tipo = r.querySelector('[data-t]').value;
        x.u = r.querySelector('[data-u]').value.trim(); x.opzioni = r.querySelector('[data-o]').value.split(',').map((o) => o.trim()).filter(Boolean);
      });
    });
    const disegna = () => {
      box.innerHTML = m.sezioni.map((s, si) => `
        <div class="card mimp-sez">
          <div class="mimp-sez-h"><input data-tit data-libero value="${esc(s.titolo)}" placeholder="Titolo della sezione (es. Dati tecnici)">
            ${si > 0 ? `<button type="button" class="btn ghost small" data-su="${si}" aria-label="Sposta su">↑</button>` : ''}
            <button type="button" class="btn ghost small danger" data-rmsez="${si}" aria-label="Togli sezione">🗑</button></div>
          ${s.campi.map((x, ci) => `
            <div class="mimp-campo">
              <input data-l data-libero value="${esc(x.label)}" placeholder="Voce (es. Portata)">
              <select data-t>${TIPI_CAMPO.map(([k, l]) => `<option value="${k}" ${x.tipo === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
              <input data-u data-libero value="${esc(x.u || '')}" placeholder="unità" ${x.tipo === 'numero' || x.tipo === 'testo' ? '' : 'hidden'}>
              <input data-o data-libero value="${esc((x.opzioni || []).join(', '))}" placeholder="scelte separate da virgola" ${x.tipo === 'scelta' ? '' : 'hidden'}>
              <span class="mimp-btn">${ci > 0 ? `<button type="button" class="btn ghost small" data-csu="${si}:${ci}" aria-label="Sposta su">↑</button>` : ''}<button type="button" class="btn ghost small danger" data-rmc="${si}:${ci}" aria-label="Togli voce">×</button></span>
            </div>`).join('') || '<p class="muted small">Nessuna voce.</p>'}
          <button type="button" class="btn ghost small" data-addc="${si}">＋ Aggiungi voce</button>
        </div>`).join('') || '<p class="muted small">Nessuna sezione: la scheda avrà solo i dati generali (tipologia, marca, matricola…).</p>';
      const mod = (fn) => () => { leggi(); fn(); sporco = true; disegna(); };
      box.querySelectorAll('[data-t]').forEach((s) => (s.onchange = mod(() => {})));
      box.querySelectorAll('[data-addc]').forEach((b) => (b.onclick = () => { leggi(); m.sezioni[+b.dataset.addc].campi.push({ k: 'c' + uid(), label: '', tipo: 'testo' }); sporco = true; disegna();
        [...box.querySelectorAll('.mimp-sez')][+b.dataset.addc].querySelectorAll('[data-l]').forEach((x, j, a) => j === a.length - 1 && x.focus()); }));
      box.querySelectorAll('[data-rmc]').forEach((b) => (b.onclick = mod(() => { const [si, ci] = b.dataset.rmc.split(':').map(Number); m.sezioni[si].campi.splice(ci, 1); })));
      box.querySelectorAll('[data-csu]').forEach((b) => (b.onclick = mod(() => { const [si, ci] = b.dataset.csu.split(':').map(Number); const a = m.sezioni[si].campi; [a[ci - 1], a[ci]] = [a[ci], a[ci - 1]]; })));
      box.querySelectorAll('[data-su]').forEach((b) => (b.onclick = mod(() => { const si = +b.dataset.su, a = m.sezioni; [a[si - 1], a[si]] = [a[si], a[si - 1]]; })));
      box.querySelectorAll('[data-rmsez]').forEach((b) => (b.onclick = () => {
        leggi(); const s = m.sezioni[+b.dataset.rmsez];
        if (!UI.conferma(`Togliere la sezione «${s.titolo || 'senza titolo'}»?${uso ? '\n\nI dati già scritti negli impianti restano salvati ma non si vedono più.' : ''}`)) return;
        m.sezioni.splice(+b.dataset.rmsez, 1); sporco = true; disegna();
      }));
    };
    disegna();
    f.addEventListener('input', () => (sporco = true)); f.addEventListener('change', () => (sporco = true));
    App.proteggi(() => sporco);
    el.querySelectorAll('[data-ico]').forEach((b) => (b.onclick = () => { m.icona = b.dataset.ico; el.querySelectorAll('[data-ico]').forEach((x) => x.classList.toggle('on', x === b)); sporco = true; }));
    el.querySelector('#btnSez').onclick = () => { leggi(); m.sezioni.push({ id: uid(), titolo: '', campi: [{ k: 'c' + uid(), label: '', tipo: 'testo' }] }); sporco = true; disegna(); box.querySelectorAll('[data-tit]')[m.sezioni.length - 1].focus(); };
    f.onsubmit = async (e) => {
      e.preventDefault(); leggi();
      m.nome = f.nome.value.trim();
      if (!m.nome) return UI.toast('Scrivi il nome del tipo', 'err');
      if (ms.some((x) => x.id !== m.id && x.nome.toLowerCase() === m.nome.toLowerCase())) return UI.toast('C\'è già un tipo con questo nome', 'err');
      ['gru', 'ponte', 'elettrico', 'scartamento'].forEach((k) => (m[k] = f[k].checked));
      m.tipologie = [...new Set(f.tipologie.value.split('\n').map((t) => t.trim()).filter(Boolean))];
      if (f.schedaCtr) m.schedaCtr = f.schedaCtr.value;
      m.sezioni = m.sezioni.map((s) => ({ ...s, titolo: s.titolo.trim(), campi: s.campi.filter((x) => x.label.trim()).map((x) => ({ ...x, label: x.label.trim() })) }))
        .filter((s) => s.titolo || s.campi.length).map((s) => ({ ...s, titolo: s.titolo || 'Dati tecnici' }));
      const senzaScelte = m.sezioni.flatMap((s) => s.campi).find((x) => x.tipo === 'scelta' && !(x.opzioni || []).length);
      if (senzaScelte) return UI.toast(`Scrivi le scelte per «${senzaScelte.label}»`, 'err');
      const nuovi = orig ? ms.map((x) => (x.id === m.id ? m : x)) : [...ms, m];
      await salvaTutti(S, nuovi); sporco = false;
      UI.toast('Tipo di impianto salvato', 'ok'); location.hash = '#/impianti/modelli';
    };
    el.querySelector('#btnElimina')?.addEventListener('click', async () => {
      if (uso) return UI.toast(`Ci sono ${uso} impianti di questo tipo: prima cambia il loro tipo`, 'err');
      if (!UI.conferma(`Eliminare il tipo «${m.nome}»?`)) return;
      await salvaTutti(S, ms.filter((x) => x.id !== m.id)); sporco = false; location.hash = '#/impianti/modelli';
    });
    return { titolo: orig ? m.nome : 'Nuovo tipo', indietro: '#/impianti/modelli', live: false };
  }

  // tipologie di un tipo modificabili dal form dell'impianto
  async function salvaTipologie(S, id, voci) {
    const ms = JSON.parse(JSON.stringify(tutti(S)));
    ms.find((m) => m.id === id).tipologie = voci; await salvaTutti(S, ms);
  }

  return { tutti, di, icona, ICONE, campiModal, righe, elenco, modifica, salvaTipologie, indovina };
})();
