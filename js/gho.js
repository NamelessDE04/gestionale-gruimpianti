// ===== GHO ELIGIO =====
// Sezione dedicata al cliente per cui lavoriamo "in appalto": il registro delle ore (un elenco di interventi
// mese per mese, da cui fare la fattura) e il configuratore di cablaggio.
// I loro clienti NON entrano nella nostra anagrafica: cliente e città sono semplici testi.
window.GHO = (function () {
  const { esc, uid, oggi, fmt, info } = UI;
  const EURO_KM = 0.5, EURO_ORA_PIATT = 5;          // tariffe: 0,50 € al km, 5 € all'ora la nostra piattaforma
  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

  // ---------- calcoli ----------
  const minuti = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
  const durata = (da, a) => { const x = minuti(da), y = minuti(a); return x != null && y != null && y > x ? y - x : 0; };
  const num = (x) => { const v = parseFloat(String(x ?? '').replace(',', '.')); return Number.isFinite(v) ? v : 0; };
  const euro = (v) => '€ ' + (Math.round(v * 100) / 100).toFixed(2).replace('.', ',');
  const hm = (min) => { const m = Math.round(min || 0); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
  const oreTesto = (min) => { const m = Math.round(min || 0), h = Math.floor(m / 60), r = m % 60; return h && r ? `${h}h${String(r).padStart(2, '0')}` : h ? `${h}h` : `${r} min`; };
  // ore di viaggio scritte come 1,5 oppure 1:30 -> minuti
  const viaggioMin = (t) => { const s = String(t || '').trim(); if (!s) return 0; const m = s.match(/^(\d+)[:.](\d{2})$/); if (m && s.includes(':')) return +m[1] * 60 + +m[2]; return Math.round(num(s) * 60); };
  const viaggioTxt = (min) => (min ? (min % 60 ? hm(min) : String(min / 60)) : '');

  const nostroMezzo = (r) => r.mezzo !== 'loro';
  const lavoro = (r) => durata(r.mattDa, r.mattA) + durata(r.pomDa, r.pomA);
  const nPers = (r) => (r.persone || []).length || 1;
  const oreUomo = (r) => (lavoro(r) + (r.viaggio || 0)) * nPers(r);   // (ore lavorate + viaggio) × persone
  const costoKm = (r) => (nostroMezzo(r) ? num(r.km) * EURO_KM : 0);
  const piattNostre = (r) => (r.piattaforme || []).filter((p) => p.nostra);
  const orePiattNostre = (r) => piattNostre(r).reduce((t, p) => t + num(p.ore) * (num(p.qta) || 1), 0);
  const costoPiatt = (r) => orePiattNostre(r) * EURO_ORA_PIATT;
  const matNostri = (r) => (r.materiali || []).filter((m) => m.nostro);
  const senzaPrezzo = (m) => m.nostro && (m.prezzo == null || String(m.prezzo).trim() === '');
  const costoMat = (r) => matNostri(r).reduce((t, m) => t + num(m.prezzo) * (num(m.qta) || 1), 0);
  const costoTot = (r) => costoKm(r) + costoPiatt(r) + costoMat(r);
  const daPrezzare = (S) => (S.oreGho || []).filter((r) => (r.materiali || []).some(senzaPrezzo));
  const badge = (S) => { const n = daPrezzare(S).reduce((t, r) => t + r.materiali.filter(senzaPrezzo).length, 0); return n ? `${n} ${n === 1 ? 'prezzo' : 'prezzi'} da controllare` : ''; };

  const utente = (S, id) => S.utenti.find((u) => u.id === id);
  const nomiPers = (S, r) => (r.persone || []).map((id) => UT.breve(utente(S, id)) || '?');
  const siglePers = (S, r) => (r.persone || []).map((id) => UT.sigla(utente(S, id)) || '?');
  const mezzoDi = (S, id) => (S.mezzi || []).find((m) => m.id === id);
  const meseDi = (r) => (r.data || '').slice(0, 7);
  const nomeMese = (m) => { const [y, mm] = m.split('-'); return `${MESI[+mm - 1]} ${y}`; };
  const meseShift = (m, d) => { const [y, mm] = m.split('-').map(Number); const t = new Date(y, mm - 1 + d, 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`; };
  const orari = (r) => [r.mattDa && r.mattA && `dalle ${r.mattDa} alle ${r.mattA}`, r.pomDa && r.pomA && `dalle ${r.pomDa} alle ${r.pomA}`].filter(Boolean);

  // ---------- messaggio WhatsApp ----------
  function messaggio(S, r) {
    const giorno = r.data ? new Date(r.data + 'T12:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' }) : '';
    const pn = piattNostre(r).reduce((t, p) => t + (num(p.qta) || 1), 0), np = nPers(r);
    const riga2 = [orari(r).join(' e ') + (r.viaggio ? ` + ${oreTesto(r.viaggio)} di viaggio` : ''),
      r.km ? `${r.km} km${nostroMezzo(r) ? '' : ' (mezzo loro)'}` : '', pn ? `${pn} ${pn === 1 ? 'piattaforma nostra' : 'piattaforme nostre'}` : '',
      `${np} ${np === 1 ? 'persona' : 'persone'}`].filter(Boolean).join(' - ');
    const mat = (r.materiali || []).filter((m) => m.descrizione || m.codice).map((m) => `${m.qta ? m.qta + ' x ' : ''}${[m.codice, m.descrizione].filter(Boolean).join(' ')}${m.nostro ? ' (di nostra fornitura)' : ''}`);
    return [
      [giorno.charAt(0).toUpperCase() + giorno.slice(1), r.cliente, r.citta].filter(Boolean).join(' - '),
      riga2,
      '',
      `${r.gru ? 'GRU ' + r.gru + ': ' : ''}${r.descrizione || ''}`.trim(),
      mat.length ? 'Materiale usato: ' + mat.join('; ') : '',
      r.segnalazioni ? 'Annotazioni: ' + r.segnalazioni : ''
    ].filter((x, i) => x || i === 2).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  function apriMessaggio(S, r) {
    const testo = messaggio(S, r);
    const m = document.createElement('div');
    m.className = 'modal-ov';
    m.innerHTML = `<div class="modal"><div class="modal-head"><h2>💬 Messaggio WhatsApp</h2><button type="button" class="modal-x" aria-label="Chiudi">×</button></div>
      <div class="modal-body"><p class="muted small">Puoi correggerlo prima di inviarlo.</p><textarea id="wTesto" rows="11" class="gho-wa">${esc(testo)}</textarea>
      <div class="azioni-form"><button type="button" class="btn ghost" id="wCopia">📋 Copia</button><span class="grow"></span>
        <a class="btn" id="wApri" target="_blank" rel="noopener">Apri WhatsApp</a></div></div></div>`;
    document.body.appendChild(m);
    const chiudi = () => m.remove();
    m.querySelector('.modal-x').onclick = chiudi;
    m.addEventListener('click', (e) => { if (UI.toccoFuori(e, m)) chiudi(); });
    const ta = m.querySelector('#wTesto'), a = m.querySelector('#wApri');
    const agg = () => (a.href = 'https://wa.me/?text=' + encodeURIComponent(ta.value));
    ta.oninput = agg; agg();
    m.querySelector('#wCopia').onclick = async () => {
      try { await navigator.clipboard.writeText(ta.value); UI.toast('Messaggio copiato', 'ok'); }
      catch (e) { ta.select(); document.execCommand('copy'); UI.toast('Messaggio copiato', 'ok'); }
    };
  }

  // ================= PAGINA GHO ELIGIO =================
  function home(el, S) {
    const b = badge(S);
    el.innerHTML = `
      <section class="home">
        <div class="home-head"><h1>GHO ELIGIO</h1><p>Lavori per GHO ELIGIO</p></div>
        <div class="tiles due-tiles">
          <a class="tile attiva" href="#/gho/ore"><div class="tile-ill">${ILL.registroOre}</div><div class="tile-txt"><h2>Registro ore</h2><p>Interventi mese per mese, per la fattura</p>${b ? `<span class="tile-badge">${b}</span>` : ''}</div></a>
          <a class="tile attiva" href="#/cablaggio"><div class="tile-ill">${ILL.cablaggio}</div><div class="tile-txt"><h2>Configuratore cablaggio gru</h2><p>Schemi di cablaggio e collaudo</p></div></a>
        </div>
      </section>`;
    return { titolo: 'GHO ELIGIO', indietro: '#/', live: true };
  }

  // ================= ELENCO DEL MESE =================
  let meseScelto = oggi().slice(0, 7);
  function elenco(el, S, query) {
    if (query.get('mese')) meseScelto = query.get('mese');
    const mese = meseScelto;
    const righe = (S.oreGho || []).filter((r) => meseDi(r) === mese).sort((a, b) => (a.data || '').localeCompare(b.data || '') || (a.mattDa || '').localeCompare(b.mattDa || ''));
    const prezzi = daPrezzare(S);
    const tot = righe.reduce((t, r) => ({ uomo: t.uomo + oreUomo(r), km: t.km + num(r.km), costo: t.costo + costoTot(r) }), { uomo: 0, km: 0, costo: 0 });
    const leggi = UT.solaLettura();
    el.innerHTML = `
      <section class="sg sg2 gho">
        ${prezzi.length ? `<div class="avviso-m st-b-scadenza gho-prezzi"><span class="av-ico">💶</span><span class="grow"><b>Materiale nostro senza prezzo: ${prezzi.reduce((t, r) => t + r.materiali.filter(senzaPrezzo).length, 0)}</b>
          <span>${prezzi.slice(0, 4).map((r) => `<a class="link" href="#/gho/ore/${r.id}">${fmt(r.data)} ${esc(r.cliente || '')}</a>`).join(' · ')}${prezzi.length > 4 ? ' …' : ''}</span></span></div>` : ''}
        <div class="card sg2-testa">
          <div class="grow"><h1>Registro ore</h1><p class="muted small">${righe.length} ${righe.length === 1 ? 'intervento' : 'interventi'} · ${hm(tot.uomo)} ore · ${tot.km} km · ${euro(tot.costo)} di spese
            ${info('Ogni intervento fatto per GHO ELIGIO: orari, viaggio, persone, km, piattaforme e materiale. Le ore totali sono (ore lavorate + ore di viaggio) × persone. Il viaggio costa 0,50 € al km solo se andiamo con un nostro mezzo; la nostra piattaforma 5 € all\'ora. Il materiale messo da noi va con il prezzo: se non lo sai, lascialo vuoto e comparirà un promemoria. A fine mese stampa il riepilogo per la fattura.')}</p></div>
          <div class="anno anno-mini gho-mese"><a href="#/gho/ore?mese=${meseShift(mese, -1)}" aria-label="Mese prima">‹</a><b>${nomeMese(mese)}</b><a href="#/gho/ore?mese=${meseShift(mese, 1)}" aria-label="Mese dopo">›</a></div>
          ${UI.menu([UT.puoInviare() && { t: `🖨️ Riepilogo di ${nomeMese(mese)}`, href: `#/gho/ore/stampa/${mese}` }])}
        </div>
        ${!leggi ? `<a class="sg2-inizia ap-nuovo" href="#/gho/ore/nuovo">＋ Nuovo intervento</a>` : ''}
        ${righe.length ? `<div class="sg2-lista">${righe.map((r) => `
          <div class="sg2-riga gho-riga">
            <a class="gho-apri" href="#/gho/ore/${r.id}">
              <span class="n ap-data">${esc(fmt(r.data).replace(/\/(\d\d)(\d\d)$/, '/$2'))}</span>
              <span class="d">${esc([r.cliente, r.citta].filter(Boolean).join(' · '))}${r.gru ? ` <small class="muted">gru ${esc(r.gru)}</small>` : ''}
                <small>${esc(orari(r).join(' e '))}${r.viaggio ? ' + viaggio ' + oreTesto(r.viaggio) : ''} · ${esc(nomiPers(S, r).join(', '))}${(r.materiali || []).some(senzaPrezzo) ? ' · <b class="txt-ko">prezzo da mettere</b>' : ''}</small></span>
              <span class="gho-ore">${hm(oreUomo(r))}</span></a>
            <button type="button" class="btn ghost small" data-wa="${r.id}" aria-label="Messaggio WhatsApp">💬</button>
          </div>`).join('')}</div>` : `<p class="nessuno">Nessun intervento a ${nomeMese(mese)}.</p>`}
      </section>`;
    el.querySelectorAll('[data-wa]').forEach((b) => (b.onclick = () => apriMessaggio(S, S.oreGho.find((x) => x.id === b.dataset.wa))));
    return { titolo: 'Registro ore · GHO ELIGIO', indietro: '#/gho', live: true };
  }

  // ================= INTERVENTO =================
  function form(el, S, id) {
    const orig = id ? (S.oreGho || []).find((x) => x.id === id) : null;
    if (id && !orig) { el.innerHTML = '<p class="nessuno">Intervento non trovato.</p>'; return { titolo: 'Registro ore', indietro: '#/gho/ore' }; }
    const r = orig ? JSON.parse(JSON.stringify(orig)) : { id: uid(), data: oggi(), cliente: '', citta: '', gru: '', descrizione: '', materiali: [], segnalazioni: '',
      mattDa: '', mattA: '', pomDa: '', pomA: '', viaggio: 0, persone: [UT.attuale()?.id].filter(Boolean), km: '', mezzo: 'nostro', mezzoId: '', piattaforme: [] };
    r.materiali = r.materiali || []; r.piattaforme = r.piattaforme || [];
    const tutti = S.oreGho || [];
    const clientiNoti = [...new Set(tutti.map((x) => x.cliente).filter(Boolean))].sort();
    const cittaNote = [...new Set(tutti.map((x) => x.citta).filter(Boolean))].sort();
    const veicoli = (S.mezzi || []).filter((m) => !MEZ.isPiatt(m) && !m.dismesso);
    const piattMie = MEZ.piattaforme(S);
    const persone = UT.attivi().filter((u) => UT.ruoloDi(u) !== 'ru' || r.persone.includes(u.id));

    function disegna() {
      const y = window.scrollY;
      el.innerHTML = `
        <form class="sg form card ap-form gho-form" id="fG" novalidate>
          <h1>${id ? 'Intervento' : 'Nuovo intervento'}</h1>
          <div class="tre"><label>Data<input type="date" name="data" value="${r.data}"></label>
            <label>Cliente (loro)<input name="cliente" list="ghoCli" value="${esc(r.cliente)}" placeholder="es. ROSSI SPA"></label>
            <label>Città<input name="citta" list="ghoCitta" value="${esc(r.citta)}"></label></div>
          <datalist id="ghoCli">${clientiNoti.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
          <datalist id="ghoCitta">${cittaNote.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
          <div class="tre"><label>N° gru<input name="gru" value="${esc(r.gru)}"></label></div>
          <label>Descrizione dei lavori svolti<textarea name="descrizione" rows="3">${esc(r.descrizione)}</textarea></label>

          <h2 class="sez-form">Orari ${info('Scrivi le ore con la tastiera: 0800 o 8 = 08:00. Si arrotondano ai quarti d\'ora. Le ore di viaggio come 1,5 oppure 1:30.')}</h2>
          <div class="gr-riga gr-orari gho-orari">
            <fieldset class="gr-fascia"><legend>Mattina</legend><input type="text" inputmode="numeric" name="mattDa" data-ora maxlength="5" placeholder="--:--" autocomplete="off" value="${esc(r.mattDa)}"><span>–</span><input type="text" inputmode="numeric" name="mattA" data-ora maxlength="5" placeholder="--:--" autocomplete="off" value="${esc(r.mattA)}"></fieldset>
            <fieldset class="gr-fascia"><legend>Pomeriggio</legend><input type="text" inputmode="numeric" name="pomDa" data-ora maxlength="5" placeholder="--:--" autocomplete="off" value="${esc(r.pomDa)}"><span>–</span><input type="text" inputmode="numeric" name="pomA" data-ora maxlength="5" placeholder="--:--" autocomplete="off" value="${esc(r.pomA)}"></fieldset>
            <label>Ore di viaggio<input name="viaggio" inputmode="decimal" value="${esc(viaggioTxt(r.viaggio))}" placeholder="es. 1,5"></label>
          </div>
          <span class="lab">Persone</span>
          <div class="chip-tecnici" id="gPers">${persone.map((u) => `<button type="button" class="chip-t ${r.persone.includes(u.id) ? 'on' : ''}" data-p="${u.id}">${esc(UT.breve(u))}</button>`).join('')}</div>
          <p class="gho-calc" id="gOre"></p>

          <h2 class="sez-form">Viaggio</h2>
          <div class="ap-scelte" data-mezzo><button type="button" data-v="nostro" class="${nostroMezzo(r) ? 'on' : ''}">🚐 Nostro mezzo</button><button type="button" data-v="loro" class="${nostroMezzo(r) ? '' : 'on'}">Mezzo loro</button></div>
          <div class="due">
            ${nostroMezzo(r) ? `<label>Quale mezzo<select name="mezzoId"><option value="">— scegli —</option>${veicoli.map((m) => `<option value="${m.id}" ${m.id === r.mezzoId ? 'selected' : ''}>${esc(MEZ.corto(m))}</option>`).join('')}</select></label>` : '<span></span>'}
            <label>Km di viaggio<span class="gho-km"><input name="km" inputmode="decimal" value="${esc(r.km)}"><b id="gKm"></b></span></label>
          </div>

          <h2 class="sez-form">Piattaforme ${info('Per ogni piattaforma: quante, che tipo, per quante ore. La nostra costa 5 € all\'ora, quella loro non si conta.')}</h2>
          <div id="gPiatt">${r.piattaforme.map((p, i) => `
            <div class="ap-tratto gho-p" data-i="${i}"><div class="ap-tratto-h">
              <div class="ap-scelte"><button type="button" data-pn="1" class="${p.nostra ? 'on' : ''}">Nostra</button><button type="button" data-pn="0" class="${p.nostra ? '' : 'on'}">Loro</button></div>
              <button type="button" class="btn ghost small danger" data-rmp="${i}">×</button></div>
              <div class="tre"><label>Quante<input data-k="qta" inputmode="numeric" value="${esc(p.qta ?? 1)}"></label>
                <label>Tipo<input data-k="tipo" list="ghoPiatt" value="${esc(p.tipo || '')}" placeholder="es. SEMOVENTE A FORBICE"></label>
                <label>Ore di utilizzo<input data-k="ore" inputmode="decimal" value="${esc(p.ore || '')}"></label></div>
              <p class="gho-calc" data-pc></p></div>`).join('')}</div>
          <datalist id="ghoPiatt">${[...new Set([...piattMie.map((m) => MEZ.tipoP(m)), 'MOBILE CON STABILIZZATORI', 'SEMOVENTE A FORBICE', 'SEMOVENTE ARTICOLATA', 'CINGOLATA (RAGNO)', 'SU AUTOCARRO'])].map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
          <button type="button" class="btn ghost small" id="gAddP">+ Aggiungi piattaforma</button>

          <h2 class="sez-form">Materiale impiegato ${info('Scegli se il materiale l\'hanno dato loro o l\'abbiamo messo noi. Quello nostro va in blu sul foglio e serve il prezzo (al pezzo): se ora non lo sai lascialo vuoto, ti comparirà un promemoria.')}</h2>
          <div id="gMat">${r.materiali.map((m, i) => `
            <div class="ap-tratto gho-m ${m.nostro ? 'nostro' : ''}" data-i="${i}"><div class="ap-tratto-h">
              <div class="ap-scelte"><button type="button" data-mn="0" class="${m.nostro ? '' : 'on'}">Dato da loro</button><button type="button" data-mn="1" class="${m.nostro ? 'on' : ''}">Messo da noi</button></div>
              <button type="button" class="btn ghost small danger" data-rmm="${i}">×</button></div>
              <div class="gho-mat"><label>Codice<input data-k="codice" value="${esc(m.codice || '')}"></label><label class="lungo">Descrizione<input data-k="descrizione" value="${esc(m.descrizione || '')}"></label>
                <label>Quantità<input data-k="qta" inputmode="decimal" value="${esc(m.qta ?? 1)}"></label>
                ${m.nostro ? `<label>Prezzo € (al pezzo)<input data-k="prezzo" inputmode="decimal" value="${esc(m.prezzo ?? '')}" placeholder="da vedere"></label>` : ''}</div></div>`).join('')}</div>
          <button type="button" class="btn ghost small" id="gAddM">+ Aggiungi materiale</button>

          <h2 class="sez-form">Segnalazioni ${info('Quello che va segnalato al cliente: sul foglio stampato esce in rosso.')}</h2>
          <textarea name="segnalazioni" rows="2" placeholder="es. FUNE DA SOSTITUIRE AL PROSSIMO INTERVENTO">${esc(r.segnalazioni)}</textarea>

          <p class="gho-calc gho-tot" id="gTot"></p>
          <div class="azioni-form">
            ${id && !UT.solaLettura() ? '<button type="button" class="btn danger ghost" id="btnElimina">Elimina</button>' : ''}
            <span class="grow"></span>
            <a class="btn ghost" href="#/gho/ore">Annulla</a>
            <button type="button" class="btn ghost" id="btnWa">💬 Salva e messaggio</button>
            <button class="btn" type="submit">Salva</button>
          </div>
        </form>`;
      collega();
      window.scrollTo(0, y);
    }
    const f = () => el.querySelector('#fG');
    function leggi() {
      const F = f();
      ['data', 'cliente', 'citta', 'gru', 'descrizione', 'segnalazioni'].forEach((k) => (r[k] = (F.elements[k].value || '').trim()));
      ['mattDa', 'mattA', 'pomDa', 'pomA'].forEach((k) => (r[k] = RAP.ora15(F.elements[k].value) || ''));
      r.viaggio = viaggioMin(F.elements.viaggio.value);
      r.km = (F.elements.km.value || '').trim();
      r.mezzoId = F.elements.mezzoId?.value || (nostroMezzo(r) ? r.mezzoId : '');
      r.persone = [...F.querySelectorAll('#gPers .chip-t.on')].map((b) => b.dataset.p);
      F.querySelectorAll('.gho-p').forEach((b, i) => { const p = r.piattaforme[i]; b.querySelectorAll('[data-k]').forEach((x) => (p[x.dataset.k] = x.value.trim())); });
      F.querySelectorAll('.gho-m').forEach((b, i) => { const m = r.materiali[i]; b.querySelectorAll('[data-k]').forEach((x) => (m[x.dataset.k] = x.value.trim())); });
    }
    function calcoli() {
      leggi();
      const F = f();
      F.querySelector('#gOre').innerHTML = `Lavoro <b>${hm(lavoro(r))}</b> + viaggio <b>${hm(r.viaggio)}</b> × ${nPers(r)} ${nPers(r) === 1 ? 'persona' : 'persone'} = <b>${hm(oreUomo(r))} ore</b>`;
      F.querySelector('#gKm').textContent = nostroMezzo(r) ? `= ${euro(costoKm(r))}` : 'non si conta (mezzo loro)';
      F.querySelectorAll('.gho-p').forEach((b, i) => { const p = r.piattaforme[i]; b.querySelector('[data-pc]').innerHTML = p.nostra ? `${num(p.qta) || 1} × ${num(p.ore)} h × 5 € = <b>${euro(num(p.ore) * (num(p.qta) || 1) * EURO_ORA_PIATT)}</b>` : 'piattaforma loro: non si conta'; });
      const manca = r.materiali.filter(senzaPrezzo).length;
      F.querySelector('#gTot').innerHTML = `Spese: viaggio ${euro(costoKm(r))} · piattaforme ${euro(costoPiatt(r))} · materiale ${euro(costoMat(r))} → <b>${euro(costoTot(r))}</b>${manca ? ` <span class="txt-ko">· ${manca} ${manca === 1 ? 'prezzo' : 'prezzi'} da mettere</span>` : ''}`;
    }
    function collega() {
      const F = f();
      F.addEventListener('input', calcoli);
      // orari a tastiera, come nei rapportini
      const ore = [...F.querySelectorAll('[data-ora]')];
      const sistema = (x) => { const v = RAP.ora15(x.value); if (v === null) { x.classList.add('ora-ko'); UI.toast('Orario non valido: scrivi ad esempio 0800 o 8', 'err'); return false; } x.classList.remove('ora-ko'); x.value = v; calcoli(); return true; };
      ore.forEach((x, k) => {
        x.addEventListener('focus', () => (x.dataset.nuovo = '1'));
        x.addEventListener('beforeinput', (e) => { if (x.dataset.nuovo && /^insert/.test(e.inputType)) x.value = ''; delete x.dataset.nuovo; });
        x.addEventListener('change', () => sistema(x));
        x.addEventListener('input', () => { x.classList.remove('ora-ko'); if (/^\d{4}$/.test(x.value) || /^\d{1,2}[:.]\d{2}$/.test(x.value)) { if (sistema(x)) { if (ore[k + 1]) ore[k + 1].focus(); else F.elements.viaggio.focus(); } } });
      });
      F.querySelectorAll('#gPers .chip-t').forEach((b) => (b.onclick = () => { b.classList.toggle('on'); calcoli(); }));
      F.querySelectorAll('[data-mezzo] button').forEach((b) => (b.onclick = () => { leggi(); r.mezzo = b.dataset.v; disegna(); }));
      F.querySelector('#gAddP').onclick = () => { leggi(); r.piattaforme.push({ qta: 1, tipo: '', ore: '', nostra: true }); disegna(); };
      F.querySelector('#gAddM').onclick = () => { leggi(); r.materiali.push({ codice: '', descrizione: '', qta: 1, nostro: false }); disegna(); };
      F.querySelectorAll('[data-rmp]').forEach((b) => (b.onclick = () => { leggi(); r.piattaforme.splice(+b.dataset.rmp, 1); disegna(); }));
      F.querySelectorAll('[data-rmm]').forEach((b) => (b.onclick = () => { leggi(); r.materiali.splice(+b.dataset.rmm, 1); disegna(); }));
      F.querySelectorAll('.gho-p [data-pn]').forEach((b) => (b.onclick = () => { leggi(); r.piattaforme[+b.closest('.gho-p').dataset.i].nostra = b.dataset.pn === '1'; disegna(); }));
      F.querySelectorAll('.gho-m [data-mn]').forEach((b) => (b.onclick = () => { leggi(); r.materiali[+b.closest('.gho-m').dataset.i].nostro = b.dataset.mn === '1'; disegna(); }));
      const salva = async (wa) => {
        if (ore.some((x) => x.value && RAP.ora15(x.value) === null)) return UI.toast('C\'è un orario non valido', 'err');
        leggi();
        if (!r.data) return UI.toast('Manca la data', 'err');
        if (!r.cliente) { F.elements.cliente.focus(); return UI.toast('Scrivi il cliente', 'err'); }
        if (!r.persone.length) return UI.toast('Scegli almeno una persona', 'err');
        const up = (x) => String(x || '').toUpperCase();
        Object.assign(r, { cliente: up(r.cliente), citta: up(r.citta), gru: up(r.gru), descrizione: up(r.descrizione), segnalazioni: up(r.segnalazioni) });
        r.materiali = r.materiali.filter((m) => m.codice || m.descrizione).map((m) => ({ ...m, codice: up(m.codice), descrizione: up(m.descrizione), prezzo: m.nostro ? m.prezzo : undefined }));
        r.piattaforme = r.piattaforme.filter((p) => p.tipo || num(p.ore)).map((p) => ({ ...p, tipo: up(p.tipo) }));
        if (!nostroMezzo(r)) r.mezzoId = '';
        try { await UI.salva('oreGho', JSON.parse(JSON.stringify(r))); } catch (e) { return; }
        const manca = r.materiali.filter(senzaPrezzo).length;
        UI.toast(manca ? `Salvato · ricordati il prezzo di ${manca} ${manca === 1 ? 'materiale' : 'materiali'}` : 'Salvato', manca ? '' : 'ok');
        meseScelto = meseDi(r) || meseScelto;
        location.hash = '#/gho/ore?mese=' + meseScelto;
        if (wa) setTimeout(() => apriMessaggio(S, r), 300);
      };
      F.onsubmit = (e) => { e.preventDefault(); salva(false); };
      F.querySelector('#btnWa').onclick = () => salva(true);
      F.querySelector('#btnElimina')?.addEventListener('click', async () => { if (!UI.conferma('Eliminare questo intervento?')) return; await Backend.remove('oreGho', r.id); location.hash = '#/gho/ore'; });
      calcoli();
    }
    disegna();
    return { titolo: id ? 'Intervento · GHO ELIGIO' : 'Nuovo intervento', indietro: '#/gho/ore', live: false };
  }

  // ================= STAMPA DEL MESE =================
  // A4 orizzontale: una riga per intervento, in fondo i totali di ore, costi e materiali
  const COLS = [['DATA', 17], ['CLIENTE / CITTÀ', 34], ['GRU', 13], ['LAVORI SVOLTI · MATERIALE · SEGNALAZIONI', 0], ['ORARI', 22], ['VIAGGIO', 13], ['PERSONE', 17], ['ORE TOT.', 14], ['KM', 11], ['€ KM', 15], ['PIATTAFORME', 27], ['€ PIATT.', 15]];
  function rigaStampa(S, r) {
    const mat = (r.materiali || []).map((m) => `<div class="${m.nostro ? 'gs-blu' : ''}">${m.qta ? esc(String(m.qta)) + ' × ' : ''}${esc([m.codice, m.descrizione].filter(Boolean).join(' – '))}${m.nostro ? ` <i>(nostra fornitura${senzaPrezzo(m) ? ', prezzo da definire' : ' – ' + euro(num(m.prezzo)) + ' cad.'})</i>` : ' <i>(fornito dal cliente)</i>'}</div>`).join('');
    const piatt = (r.piattaforme || []).map((p) => `${num(p.qta) || 1} × ${esc(p.tipo || 'piattaforma')} ${num(p.ore) ? `(${String(num(p.ore)).replace('.', ',')} h)` : ''} ${p.nostra ? 'NOSTRA' : 'LORO'}`).join('<br>');
    const mz = nostroMezzo(r) ? (mezzoDi(S, r.mezzoId) ? (mezzoDi(S, r.mezzoId).modello || mezzoDi(S, r.mezzoId).marca || 'nostro') : 'nostro mezzo') : 'mezzo loro';
    return `<tr>
      <td class="c">${esc(fmt(r.data))}</td>
      <td><b>${esc(r.cliente || '')}</b><br>${esc(r.citta || '')}</td>
      <td class="c">${esc(r.gru || '')}</td>
      <td class="gs-lav">${esc(r.descrizione || '')}${mat ? `<div class="gs-mat">${mat}</div>` : ''}${r.segnalazioni ? `<div class="gs-rosso">⚠ ${esc(r.segnalazioni)}</div>` : ''}</td>
      <td class="c">${orari(r).map((o) => o.replace('dalle ', '').replace(' alle ', '–')).join('<br>')}</td>
      <td class="c">${r.viaggio ? hm(r.viaggio) : ''}</td>
      <td class="c">${esc(siglePers(S, r).join(' - '))}</td>
      <td class="c"><b>${hm(oreUomo(r))}</b></td>
      <td class="c">${esc(r.km || '')}<div class="gs-pic">${esc(mz)}</div></td>
      <td class="d">${costoKm(r) ? euro(costoKm(r)) : '–'}</td>
      <td>${piatt}</td>
      <td class="d">${costoPiatt(r) ? euro(costoPiatt(r)) : '–'}</td></tr>`;
  }
  function riepilogo(S, righe, mese) {
    const T = righe.reduce((t, r) => ({ lav: t.lav + lavoro(r), via: t.via + (r.viaggio || 0) * nPers(r), uomo: t.uomo + oreUomo(r), km: t.km + (nostroMezzo(r) ? num(r.km) : 0), kmLoro: t.kmLoro + (nostroMezzo(r) ? 0 : num(r.km)),
      ckm: t.ckm + costoKm(r), op: t.op + orePiattNostre(r), cp: t.cp + costoPiatt(r), cm: t.cm + costoMat(r), lavU: t.lavU + lavoro(r) * nPers(r) }), { lav: 0, via: 0, uomo: 0, km: 0, kmLoro: 0, ckm: 0, op: 0, cp: 0, cm: 0, lavU: 0 });
    // materiali raggruppati (stesso codice e descrizione)
    const gruppi = {};
    righe.forEach((r) => (r.materiali || []).forEach((m) => { const k = (m.nostro ? 'N' : 'L') + '|' + (m.codice || '') + '|' + (m.descrizione || '') + '|' + (m.nostro ? m.prezzo : ''); gruppi[k] = gruppi[k] || { ...m, qta: 0 }; gruppi[k].qta += num(m.qta) || 1; }));
    const g = Object.values(gruppi), nostri = g.filter((m) => m.nostro), loro = g.filter((m) => !m.nostro);
    const manca = nostri.some(senzaPrezzo);
    return `<div class="gs-totali">
      <div class="gs-box"><h3>ORE DEL MESE</h3>
        <table><tr><td>Interventi</td><td class="d">${righe.length}</td></tr>
          <tr><td>Ore lavorate (× persone)</td><td class="d">${hm(T.lavU)}</td></tr>
          <tr><td>Ore di viaggio (× persone)</td><td class="d">${hm(T.via)}</td></tr>
          <tr class="gs-forte"><td>ORE TOTALI</td><td class="d">${hm(T.uomo)}</td></tr></table></div>
      <div class="gs-box"><h3>COSTI DEL MESE</h3>
        <table><tr><td>Viaggi: ${T.km} km × ${euro(EURO_KM)}${T.kmLoro ? ` <i>(+ ${T.kmLoro} km con mezzo loro, non conteggiati)</i>` : ''}</td><td class="d">${euro(T.ckm)}</td></tr>
          <tr><td>Piattaforme nostre: ${String(T.op).replace('.', ',')} h × ${euro(EURO_ORA_PIATT)}</td><td class="d">${euro(T.cp)}</td></tr>
          <tr><td>Materiale di nostra fornitura${manca ? ' <i class="gs-rosso">(alcuni prezzi da definire)</i>' : ''}</td><td class="d">${euro(T.cm)}</td></tr>
          <tr class="gs-forte"><td>TOTALE COSTI</td><td class="d">${euro(T.ckm + T.cp + T.cm)}</td></tr></table></div>
      <div class="gs-box gs-largo"><h3>MATERIALI DEL MESE</h3>
        ${nostri.length ? `<div class="gs-blu"><b>Di nostra fornitura:</b> ${nostri.map((m) => `${String(m.qta).replace('.', ',')} × ${esc([m.codice, m.descrizione].filter(Boolean).join(' – '))}${senzaPrezzo(m) ? ' (prezzo da definire)' : ' = ' + euro(m.qta * num(m.prezzo))}`).join('; ')}</div>` : ''}
        ${loro.length ? `<div><b>Forniti dal cliente:</b> ${loro.map((m) => `${String(m.qta).replace('.', ',')} × ${esc([m.codice, m.descrizione].filter(Boolean).join(' – '))}`).join('; ')}</div>` : ''}
        ${!nostri.length && !loro.length ? '<div class="muted">Nessun materiale impiegato.</div>' : ''}</div>
    </div>`;
  }
  const testaPagina = (mese, n, tot) => `<div class="gs-testa"><img src="img/logo-grande.png" alt=""><div class="grow"><h2>RIEPILOGO INTERVENTI · GHO ELIGIO</h2><p>${nomeMese(mese).toUpperCase()}</p></div><span class="gs-pag">Pag. ${n}/${tot}</span></div>`;
  const piede = () => '<div class="gs-piede">Gru impianti S.a.s di Cau Alessandro &amp; C. Sede operativa : Via Avigliana 4/H - 10057 S.Ambrogio(TO) · <span class="gs-blu">in blu: materiale di nostra fornitura</span> · <span class="gs-rosso">in rosso: segnalazioni</span></div>';
  const intestTab = () => `<thead><tr>${COLS.map(([t, w]) => `<th${w ? ` style="width:${w}mm"` : ''}>${t}</th>`).join('')}</tr></thead>`;

  // divide le righe in pagine misurandole davvero (mai una riga spezzata a metà)
  function documento(box, S, mese) {
    const righe = (S.oreGho || []).filter((r) => meseDi(r) === mese).sort((a, b) => (a.data || '').localeCompare(b.data || '') || (a.mattDa || '').localeCompare(b.mattDa || ''));
    const MM = 96 / 25.4, H_UTILE = (210 - 12 - 10) * MM;
    box.innerHTML = `<div class="fogli gs-misura"><div class="foglio gs-foglio">${testaPagina(mese, 1, 1)}<table class="gs-tab">${intestTab()}<tbody>${righe.map((r) => rigaStampa(S, r)).join('')}</tbody></table>${riepilogo(S, righe, mese)}${piede()}</div></div>`;
    const fg = box.querySelector('.gs-foglio');
    const hTesta = fg.querySelector('.gs-testa').offsetHeight, hTh = fg.querySelector('thead').offsetHeight, hPiede = fg.querySelector('.gs-piede').offsetHeight + 6;
    const hTr = [...fg.querySelectorAll('.gs-tab > tbody > tr')].map((t) => t.offsetHeight), hTot = fg.querySelector('.gs-totali').offsetHeight + 10;
    const pagine = []; let cur = [], usato = hTesta + hTh + hPiede;
    hTr.forEach((h, i) => { if (cur.length && usato + h > H_UTILE) { pagine.push(cur); cur = []; usato = hTesta + hTh + hPiede; } cur.push(i); usato += h; });
    let totaliSoli = false;
    if (usato + hTot > H_UTILE && cur.length) { pagine.push(cur); cur = []; totaliSoli = true; }
    pagine.push(cur);
    const n = pagine.length;
    box.innerHTML = `<div class="fogli">${pagine.map((p, k) => `<div class="foglio gs-foglio">${testaPagina(mese, k + 1, n)}
      ${p.length || !totaliSoli ? `<table class="gs-tab">${intestTab()}<tbody>${p.map((i) => rigaStampa(S, righe[i])).join('') || `<tr><td colspan="${COLS.length}" class="c muted">Nessun intervento nel mese.</td></tr>`}</tbody></table>` : ''}
      ${k === n - 1 ? riepilogo(S, righe, mese) : ''}${piede()}</div>`).join('')}</div>`;
  }
  function adatta() {
    const w = document.querySelector('.gs-stampa .fogli'); if (!w) return;
    w.style.zoom = 1; const disp = w.parentElement.clientWidth; w.style.zoom = Math.min(1, (disp - 4) / (297 * 96 / 25.4)).toFixed(3);
  }
  window.addEventListener('resize', adatta);
  function stampa(el, S, mese) {
    el.innerHTML = `
      <section class="gs-stampa stampa">
        <div class="azioni-lista no-print">
          <button class="btn" id="btnStampa">🖨️ Stampa / salva PDF</button>
          <button class="btn ghost" id="btnPdf">⬇ Scarica PDF</button>
          <a class="btn ghost" href="#/gho/ore/stampa/${meseShift(mese, -1)}">‹</a><a class="btn ghost" href="#/gho/ore/stampa/${meseShift(mese, 1)}">›</a>
          ${info('Formato A4 orizzontale, margini «Nessuno». In blu il materiale di nostra fornitura, in rosso le segnalazioni. In fondo: ore totali, costi e materiali del mese.')}
        </div>
        <div class="fogli-wrap" id="gsBox"></div>
      </section>`;
    const box = el.querySelector('#gsBox');
    documento(box, S, mese);
    const nome = `Riepilogo_GHO_ELIGIO_${nomeMese(mese).replace(' ', '_')}`;
    el.querySelector('#btnStampa').onclick = () => { const t = document.title; document.title = nome; window.print(); setTimeout(() => (document.title = t), 1000); };
    el.querySelector('#btnPdf').onclick = async (e) => {
      const b = e.currentTarget; b.disabled = true; b.textContent = '⏳ Preparo il PDF…';
      try {
        const bytes = await PDFX.daStampa((bx) => documento(bx, S, mese), '.foglio', false);
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })); a.download = nome + '.pdf'; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      } catch (er) { UI.toast('PDF non riuscito: ' + er.message, 'err'); }
      b.disabled = false; b.textContent = '⬇ Scarica PDF';
    };
    requestAnimationFrame(adatta);
    return { titolo: `Riepilogo ${nomeMese(mese)}`, indietro: '#/gho/ore?mese=' + mese, live: true };
  }

  function route(el, S, parti, query) {
    if (!parti[1]) return home(el, S);
    if (parti[1] !== 'ore') { location.hash = '#/gho'; return null; }
    if (parti[2] === 'stampa') return stampa(el, S, parti[3] || meseScelto);
    if (parti[2] === 'nuovo') return form(el, S, null);
    if (parti[2]) return form(el, S, parti[2]);
    return elenco(el, S, query);
  }
  return { route, badge, messaggio };
})();
