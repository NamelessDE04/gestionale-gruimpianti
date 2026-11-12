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
  const NOME_TIPO = { conn: 'Presa / spina', fc: 'Finecorsa', cavo: 'Cavo' };

  // simbolo del contatto: NA (aperto) o NC (chiuso)
  const contatto = (c) => c === 'NC'
    ? '<svg class="cbs-ct" viewBox="0 0 64 16" aria-label="contatto NC"><path d="M0 12H22L40 4M44 2V12H64M40 4V12" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'
    : '<svg class="cbs-ct" viewBox="0 0 64 16" aria-label="contatto NA"><path d="M0 12H22L40 3M44 3V12H64" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';

  // ---------- disegno di un blocco: in lettura (ed = false) o con i campi da scrivere (ed = true) ----------
  // p = percorso del valore nella bozza, es. «b.2.righe.3.sx.0»
  const cella = (ed, p, val, cls = '') => ed
    ? `<input class="cbs-in ${cls}" data-p="${p}" value="${esc(val ?? '')}" autocomplete="off" spellcheck="false">`
    : `<span class="${cls}">${esc(val ?? '')}</span>`;
  function bloccoHtml(b, i, ed) {
    const bp = 'b.' + i;
    const testa = `<div class="cbs-bt">${ed ? `<input class="cbs-in cbs-tit" data-p="${bp}.titolo" value="${esc(b.titolo)}" placeholder="Titolo del blocco">` : `<h3>${esc(b.titolo)}</h3>`}
      ${ed ? `<div class="cbs-strum">
          <button type="button" class="cbs-mini" data-su="${i}" aria-label="Sposta su" ${i ? '' : 'disabled'}>↑</button>
          <button type="button" class="cbs-mini" data-giu="${i}" aria-label="Sposta giù">↓</button>
          <button type="button" class="cbs-mini" data-imp="${i}" aria-label="Impostazioni del blocco">⚙</button>
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
    } else {
      corpo = `<div class="cbs-scroll"><table class="cbs-t cbs-cavo"><tr>${b.colonne.map((c, k) => `<th>${cella(ed, `${bp}.colonne.${k}`, c, 'th')}</th>`).join('')}${ed ? '<th></th>' : ''}</tr>
        ${b.righe.map((r, j) => `<tr>${r.map((x, k) => `<td>${cella(ed, `${bp}.righe.${j}.${k}`, x)}</td>`).join('')}
          ${ed ? `<td><button type="button" class="cbs-mini danger" data-delr="${i}.${j}" aria-label="Togli riga" ${b.righe.length > 1 ? '' : 'disabled'}>×</button></td>` : ''}</tr>`).join('')}</table></div>
        ${ed ? `<button type="button" class="btn ghost small" data-addr="${i}">+ Riga</button>` : ''}`;
    }
    return `<section class="cbs-blocco cbs-${b.tipo}" id="cb-${b.id}">${testa}${corpo}</section>`;
  }

  // ---------- ELENCO ----------
  let cerca = '';
  function elenco(el, S) {
    const tutte = schede(S), q = cerca.trim().toLowerCase();
    const lista = tutte.filter((s) => !q || [s.nome, s.note, ...(s.blocchi || []).map((b) => b.titolo)].join(' ').toLowerCase().includes(q));
    el.innerHTML = `
      <section class="cli cbs">
        <div class="sez-head"><h1>Configuratore cablaggio ${info('Qui crei le tue schede di cablaggio partendo da zero. Ogni scheda è fatta di blocchi: <b>presa / spina</b> (connettore a 16, 24 o 32 poli), <b>finecorsa</b> e <b>cavo</b>. La struttura la scegli tu, e anche tutto quello che c\'è scritto. Le schede valgono per tutti i dispositivi. Il vecchio configuratore è nel menu ⋯.')}</h1>
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
  function vista(el, S, id) {
    const s = S.impostazioni.find((d) => d.id === id);
    if (!s) { el.innerHTML = '<p class="nessuno">Scheda non trovata.</p>'; return { titolo: 'Configuratore cablaggio', indietro: '#/cablaggio' }; }
    el.innerHTML = `
      <section class="cbs cbs-scheda">
        <div class="card sg2-testa"><div class="grow"><h1>${esc(s.nome || 'Senza nome')}</h1>
          <p class="muted small">${(s.blocchi || []).length} blocchi${s.agg?.il ? ' · modificata il ' + quando(s.agg.il) + (s.agg.da ? ' da ' + esc(s.agg.da) : '') : ''}</p></div>
          ${puoModificare() ? UI.menu([{ t: '✏️ Modifica', href: `#/cablaggio/s/${id}/modifica` }, { t: '⧉ Duplica', id: 'csDup' }, { t: '🗑 Elimina scheda', id: 'csDel', cls: 'txt-ko' }]) : ''}</div>
        ${puoModificare() ? `<a class="btn ghost cbs-modbtn" href="#/cablaggio/s/${id}/modifica">✏️ Modifica la scheda</a>` : ''}
        ${(s.blocchi || []).length ? `<div class="cbs-blocchi">${s.blocchi.map((b, i) => bloccoHtml(b, i, false)).join('')}</div>` : '<p class="nessuno">La scheda è vuota.</p>'}
      </section>`;
    el.querySelector('#csDup')?.addEventListener('click', async () => {
      const d = clona(s); d.id = 'cab-' + uid(); d.nome = (s.nome || '') + ' (COPIA)'; d.blocchi.forEach((b) => (b.id = uid())); d.agg = { il: new Date().toISOString(), da: UT.breve(UT.attuale()) };
      await UI.salva('impostazioni', d); UI.toast('Scheda duplicata', 'ok'); location.hash = `#/cablaggio/s/${d.id}/modifica`;
    });
    el.querySelector('#csDel')?.addEventListener('click', async () => {
      if (!UI.conferma(`Eliminare la scheda «${s.nome}»?\n\nNon si potrà recuperare.`)) return;
      await Backend.remove('impostazioni', s.id); UT.registra?.('elimina', 'Scheda di cablaggio ' + s.nome); UI.toast('Scheda eliminata'); location.hash = '#/cablaggio';
    });
    return { titolo: 'Configuratore cablaggio', indietro: '#/cablaggio', live: true };
  }

  // ---------- SCHEDA: modifica ----------
  function modifica(el, S, id) {
    const orig = S.impostazioni.find((d) => d.id === id);
    if (!orig) { el.innerHTML = '<p class="nessuno">Scheda non trovata.</p>'; return { titolo: 'Configuratore cablaggio', indietro: '#/cablaggio' }; }
    if (!puoModificare()) { location.hash = `#/cablaggio/s/${id}`; return null; }
    const bz = clona(orig); bz.blocchi = bz.blocchi || [];
    let sporco = false;
    App.proteggi(() => sporco);
    const segna = () => { sporco = true; const b = el.querySelector('#csSalva'); if (b) b.classList.add('pulsa'); };
    const imposta = (p, v) => { const k = p.split('.'); let o = { b: bz.blocchi }; for (let i = 0; i < k.length - 1; i++) o = o[k[i]]; o[k[k.length - 1]] = v; };
    const disegna = (scorriA) => {
      el.innerHTML = `
        <section class="cbs cbs-scheda cbs-mod">
          <div class="card"><label>Nome della scheda<input id="csNome" class="cbs-nome" value="${esc(bz.nome || '')}" autocomplete="off"></label>
            <p class="muted small">Scrivi direttamente nelle caselle. ⚙ cambia la struttura del blocco (poli, colonne), ↑ ↓ lo spostano.</p></div>
          <div class="cbs-blocchi">${bz.blocchi.map((b, i) => bloccoHtml(b, i, true)).join('') || '<p class="nessuno">Nessun blocco: aggiungine uno qui sotto.</p>'}</div>
          <div class="cbs-agg"><span>Aggiungi un blocco</span>
            <button type="button" class="btn ghost" data-nuovo="conn">🔌 Presa / spina</button>
            <button type="button" class="btn ghost" data-nuovo="fc">⛔ Finecorsa</button>
            <button type="button" class="btn ghost" data-nuovo="cavo">〰 Cavo</button></div>
          <div class="azioni-form cbs-salvabar"><a class="btn ghost" href="#/cablaggio/s/${id}">Chiudi</a><span class="grow"></span><button type="button" class="btn" id="csSalva">💾 Salva</button></div>
        </section>`;
      const nm = el.querySelector('#csNome'); nm.oninput = () => { bz.nome = nm.value.toUpperCase(); segna(); };
      el.querySelectorAll('.cbs-in[data-p]').forEach((x) => (x.oninput = () => { imposta(x.dataset.p, x.value); segna(); }));
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
      el.querySelectorAll('[data-nuovo]').forEach((x) => (x.onclick = () => nuovoBlocco(x.dataset.nuovo)));
      el.querySelector('#csSalva').onclick = salva;
      if (scorriA) { const t = el.querySelector('#cb-' + scorriA); if (t) t.scrollIntoView({ block: 'center' }); }
    };
    async function salva() {
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
      } else {
        UI.toast('Nel finecorsa: aggiungi o togli righe direttamente nel blocco; tocca il contatto per passare da NA a NC');
      }
    }
    function nuovoBlocco(tipo) {
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
    if (parti[1] === 's' && parti[2]) return parti[3] === 'modifica' ? modifica(el, S, parti[2]) : vista(el, S, parti[2]);
    return elenco(el, S);
  }
  return { route, schede };
})();
