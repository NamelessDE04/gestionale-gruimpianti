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

  // un intervento può durare più giorni (ognuno con i suoi orari e il suo viaggio) e usare più mezzi (ognuno con i suoi km).
  // Gli interventi vecchi (un giorno, un mezzo) hanno i dati nei campi singoli: li leggo come un giorno e un mezzo.
  const giorniDi = (r) => (r.giorni?.length ? r.giorni : [{ data: r.data, mattDa: r.mattDa, mattA: r.mattA, pomDa: r.pomDa, pomA: r.pomA, viaggio: r.viaggio || 0 }]);
  const mezziDi = (r) => (r.mezzi?.length ? r.mezzi : [{ mezzo: r.mezzo === 'loro' ? 'loro' : 'nostro', mezzoId: r.mezzoId || '', km: r.km || '' }]);
  const nostro = (m) => m.mezzo !== 'loro';
  const kmNostri = (r) => mezziDi(r).filter(nostro).reduce((t, m) => t + num(m.km), 0);
  const kmLoro = (r) => mezziDi(r).filter((m) => !nostro(m)).reduce((t, m) => t + num(m.km), 0);
  const kmTot = (r) => kmNostri(r) + kmLoro(r);
  const nostroMezzo = (r) => mezziDi(r).some(nostro);
  const lavoroG = (g) => durata(g.mattDa, g.mattA) + durata(g.pomDa, g.pomA);
  const lavoro = (r) => giorniDi(r).reduce((t, g) => t + lavoroG(g), 0);
  const viaggioTot = (r) => giorniDi(r).reduce((t, g) => t + (g.viaggio || 0), 0);
  const nPers = (r) => (r.persone || []).length || 1;
  const oreUomo = (r) => (lavoro(r) + viaggioTot(r)) * nPers(r);   // (ore lavorate + viaggio) × persone
  const costoKm = (r) => kmNostri(r) * EURO_KM;
  const piattNostre = (r) => (r.piattaforme || []).filter((p) => p.nostra);
  const orePiattNostre = (r) => piattNostre(r).reduce((t, p) => t + num(p.ore) * (num(p.qta) || 1), 0);
  const costoPiatt = (r) => orePiattNostre(r) * EURO_ORA_PIATT;
  const matNostri = (r) => (r.materiali || []).filter((m) => m.nostro);
  const senzaPrezzo = (m) => m.nostro && (m.prezzo == null || String(m.prezzo).trim() === '');
  const costoMat = (r) => matNostri(r).reduce((t, m) => t + num(m.prezzo) * (num(m.qta) || 1), 0);
  const costoTot = (r) => costoKm(r) + costoPiatt(r) + costoMat(r);
  // chi vede i soldi nel GHO (prezzi materiale, spese, totali): funzione «gho.prezzi» in Gestione utenti
  const vp = () => UT.puo('gho.prezzi');
  const puoPrezzi = () => vp() && UT.puo('gho.prezzi.modifica');   // scrivere i prezzi del materiale
  const daPrezzare = (S) => (S.oreGho || []).filter((r) => (r.materiali || []).some(senzaPrezzo));
  const badge = (S) => { if (!puoPrezzi()) return ''; const n = daPrezzare(S).reduce((t, r) => t + r.materiali.filter(senzaPrezzo).length, 0); return n ? `${n} ${n === 1 ? 'prezzo' : 'prezzi'} da controllare` : ''; };

  const utente = (S, id) => S.utenti.find((u) => u.id === id);
  const nomiPers = (S, r) => (r.persone || []).map((id) => UT.breve(utente(S, id)) || '?');
  const siglePers = (S, r) => (r.persone || []).map((id) => UT.sigla(utente(S, id)) || '?');
  const mezzoDi = (S, id) => (S.mezzi || []).find((m) => m.id === id);
  const meseDi = (r) => (r.data || '').slice(0, 7);
  const nomeMese = (m) => { const [y, mm] = m.split('-'); return `${MESI[+mm - 1]} ${y}`; };
  const meseShift = (m, d) => { const [y, mm] = m.split('-').map(Number); const t = new Date(y, mm - 1 + d, 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`; };
  const orariG = (g) => [g.mattDa && g.mattA && `dalle ${g.mattDa} alle ${g.mattA}`, g.pomDa && g.pomA && `dalle ${g.pomDa} alle ${g.pomA}`].filter(Boolean);
  const orari = (r) => orariG(giorniDi(r)[0]);
  const ggmm = (d) => fmt(d).slice(0, 5);
  const nomeMezzo = (S, m) => (nostro(m) ? (mezzoDi(S, m.mezzoId) ? (mezzoDi(S, m.mezzoId).modello || mezzoDi(S, m.mezzoId).marca || 'nostro') : 'nostro mezzo') : 'mezzo loro');

  // ---------- messaggio WhatsApp ----------
  function messaggio(S, r) {
    const gg = giorniDi(r), piu = gg.length > 1;
    const nomeG = (d, anno) => (d ? new Date(d + 'T12:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'numeric', ...(anno ? { year: 'numeric' } : {}) }) : '');
    const giorno = piu ? gg.map((g, k) => nomeG(g.data, k === gg.length - 1)).join(', ').replace(/, ([^,]*)$/, ' e $1') : nomeG(r.data, true);
    const np = nPers(r);
    // piattaforme in coda alla riga degli orari, es. «+ 1 piattaforma nostra - 2,5 h utilizzo» oppure
    // «+ 2 piattaforme vostre - 3 h utilizzo cad.» (il messaggio è per GHO: le loro sono «vostre»; il tipo non serve)
    const piatt = (r.piattaforme || []).filter((p) => p.tipo || num(p.ore)).map((p) => {
      const n = num(p.qta) || 1, pl = n > 1;
      return `${n} ${pl ? 'piattaforme' : 'piattaforma'} ${p.nostra ? (pl ? 'nostre' : 'nostra') : (pl ? 'vostre' : 'vostra')}${num(p.ore) ? ` - ${String(num(p.ore)).replace('.', ',')} h utilizzo${pl ? ' cad.' : ''}` : ''}`;
    });
    // km: uno per mezzo (es. «64 km + 30 km (mezzo loro)»)
    const km = mezziDi(r).filter((m) => num(m.km)).map((m) => `${m.km} km${nostro(m) ? '' : ' (mezzo vostro)'}`).join(' + ');
    const orariTxt = (g) => orariG(g).join(' e ') + (g.viaggio ? ` + ${oreTesto(g.viaggio)} di viaggio` : '');
    // più giorni: una riga per giorno con i suoi orari, poi km, persone e piattaforme
    const riga2 = (piu ? gg.map((g) => `${nomeG(g.data)}: ${orariTxt(g)}`).join('\n') + '\n' : '') + [piu ? '' : orariTxt(gg[0]),
      km, `${np} ${np === 1 ? 'persona' : 'persone'}`].filter(Boolean).join(' - ') + piatt.map((x) => ' + ' + x).join('');
    const mat = (r.materiali || []).filter((m) => m.descrizione || m.codice).map((m) => `${m.qta ? m.qta + ' x ' : ''}${[m.codice, m.descrizione].filter(Boolean).join(' ')}${m.nostro && !vp() ? ' (di nostra fornitura)' : ''}${m.nostro && vp() ? ` (di nostra fornitura, ${senzaPrezzo(m) ? 'prezzo da definire' : ((num(m.qta) || 1) > 1 ? euro(num(m.prezzo)) + ' cad., totale ' + euro(num(m.prezzo) * num(m.qta)) : euro(num(m.prezzo)))})` : ''}`);
    // annotazioni in elenco puntato: una per riga (le righe vuote e i trattini/pallini già scritti si tolgono)
    const note = String(r.segnalazioni || '').split(/\n+/).map((x) => x.replace(/^\s*[-•*·]+\s*/, '').trim()).filter(Boolean);
    // blocchi staccati da una riga vuota: intestazione · lavoro · materiale · annotazioni
    return [
      [giorno.charAt(0).toUpperCase() + giorno.slice(1), r.cliente, r.citta].filter(Boolean).join(' - ') + '\n' + riga2,
      `${r.gru ? 'GRU ' + r.gru + ': ' : ''}${r.descrizione || ''}`.trim(),
      mat.length ? 'Materiale usato: ' + mat.join('; ') : '',
      note.length ? 'Annotazioni:\n' + note.map((x) => '• ' + x).join('\n') : ''
    ].filter(Boolean).join('\n\n').trim();
  }
  // ---------- invio WhatsApp: spunta con le iniziali di chi l'ha mandato ----------
  // L'app non può leggere WhatsApp: segna «inviato» quando tocchi Invia e, quando torni nell'app, chiede conferma.
  const quando = (iso) => { const d = new Date(iso); return `${d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })} alle ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`; };
  const puoSegnare = () => UT.puo('gho.ore') && !UT.solaLettura();
  const statoWa = (S, r) => { const w = r.waInviato; if (!w) return null; const u = utente(S, w.da); return { ...w, sigla: ((u?.nomeBreve || '').trim() || UT.iniziali(u?.nome || '')).toUpperCase(), nome: UT.breve(u) || 'qualcuno' }; };
  const iconaWa = (S, r) => { const w = statoWa(S, r);
    return w ? `<span class="wa-ok${w.modificato ? ' wa-mod' : ''}">${w.modificato ? '!' : '✓'}<small>${esc(w.sigla)}</small></span>` : '💬'; };
  async function segna(S, r, w) {
    const doc = JSON.parse(JSON.stringify((S.oreGho || []).find((x) => x.id === r.id) || r));
    if (w) doc.waInviato = w; else delete doc.waInviato;
    try { await UI.salva('oreGho', doc); } catch (e) { return false; }
    Object.assign(r, { waInviato: doc.waInviato }); if (!w) delete r.waInviato;
    return true;
  }
  let daConfermare = null;   // { id, prima } dopo il tocco su «Invia»
  function chiediConferma() {
    if (!daConfermare || document.hidden) return;
    const { id, prima } = daConfermare; daConfermare = null;
    const S = App.dati(), r = (S.oreGho || []).find((x) => x.id === id); if (!r) return;
    const m = document.createElement('div'); m.className = 'modal-ov';
    m.innerHTML = `<div class="modal"><div class="modal-head"><h2>💬 Messaggio partito?</h2></div>
      <div class="modal-body"><div class="wa-conf"><p>Hai inviato su WhatsApp il messaggio di <b>${esc(r.cliente || 'questo intervento')}</b> del ${esc(fmt(r.data))}?</p>
      <div class="azioni-form"><button type="button" class="btn ghost" id="waNo">No, non l'ho mandato</button><span class="grow"></span><button type="button" class="btn" id="waSi">✓ Sì, inviato</button></div></div></div></div>`;
    document.body.appendChild(m);
    m.querySelector('#waSi').onclick = () => { m.remove(); UI.toast('Segnato come inviato', 'ok'); };
    m.querySelector('#waNo').onclick = async () => { m.remove(); if (await segna(S, r, prima)) { UI.toast('Tolta la spunta'); App.ridisegna(); } };
  }
  document.addEventListener('visibilitychange', () => setTimeout(chiediConferma, 400));
  window.addEventListener('focus', () => setTimeout(chiediConferma, 400));

  function apriMessaggio(S, r) {
    const testo = messaggio(S, r), w = statoWa(S, r);
    const m = document.createElement('div');
    m.className = 'modal-ov';
    m.innerHTML = `<div class="modal wa-modal"><div class="modal-head"><h2>💬 Messaggio WhatsApp</h2><button type="button" class="modal-x" aria-label="Chiudi">×</button></div>
      <div class="modal-body">
      ${w ? `<div class="wa-stato${w.modificato ? ' wa-mod' : ''}"><span class="grow">${w.modificato ? `⚠️ <b>Modificato dopo l'invio</b>: mandato da ${esc(w.nome)} il ${esc(quando(w.il))}, ma poi l'intervento è cambiato. Rimandalo.` : `✓ <b>Già inviato</b> da ${esc(w.nome)} il ${esc(quando(w.il))}`}</span>
        ${puoSegnare() ? '<button type="button" class="link" id="wTogli">Togli la spunta</button>' : ''}</div>` : ''}
      <p class="muted small">Puoi correggerlo prima di inviarlo.</p><textarea id="wTesto" rows="11" class="gho-wa">${esc(testo)}</textarea>
      <div class="azioni-form"><span class="grow"></span>
        <a class="btn btn-wa" id="wApri" target="_blank" rel="noopener">${w ? 'Invia di nuovo su WhatsApp' : 'Invia su WhatsApp'}</a></div></div></div>`;
    document.body.appendChild(m);
    const chiudi = () => m.remove();
    m.querySelector('.modal-x').onclick = chiudi;
    m.addEventListener('click', (e) => { if (UI.toccoFuori(e, m)) chiudi(); });
    const ta = m.querySelector('#wTesto'), a = m.querySelector('#wApri');
    const agg = () => (a.href = 'https://wa.me/?text=' + encodeURIComponent(ta.value));
    ta.oninput = agg; agg();
    a.addEventListener('click', () => {
      if (!puoSegnare()) return;
      const prima = r.waInviato ? JSON.parse(JSON.stringify(r.waInviato)) : null;
      segna(S, r, { da: UT.attuale()?.id || '', il: new Date().toISOString() }).then((ok) => { if (ok) { daConfermare = { id: r.id, prima }; App.ridisegna(); } });
      setTimeout(chiudi, 200);
    });
    m.querySelector('#wTogli')?.addEventListener('click', async () => { if (await segna(S, r, null)) { chiudi(); UI.toast('Tolta la spunta'); App.ridisegna(); } });
  }

  // ================= PAGINA GHO ELIGIO =================
  function home(el, S) {
    const b = badge(S);
    el.innerHTML = `
      <section class="home">
        <div class="home-head"><h1>GHO ELIGIO</h1><p>Lavori per GHO ELIGIO</p></div>
        <div class="tiles due-tiles">
          <a class="tile attiva" href="#/gho/ore"><div class="tile-ill">${ILL.registroOre}</div><div class="tile-txt"><h2>Registro ore</h2><p>Interventi mese per mese, per la fattura</p>${b ? `<span class="tile-badge">${b}</span>` : ''}</div></a>
          ${UT.puo('sez.schede') ? `<a class="tile attiva" href="#/gho/schede"><div class="tile-ill">${ILL.schede || ILL.cablaggio}</div><div class="tile-txt"><h2>Schede di controllo</h2><p>Gru dei clienti di GHO, senza anagrafica</p></div></a>` : ''}
          <a class="tile attiva" href="#/cablaggio"><div class="tile-ill">${ILL.cablaggio}</div><div class="tile-txt"><h2>Configuratore cablaggio gru</h2><p>Schede di cablaggio da creare e modificare</p></div></a>
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
    const vedeP = puoPrezzi(), vedeSoldi = vp(), prezzi = vedeP ? daPrezzare(S) : [];
    const tot = righe.reduce((t, r) => ({ uomo: t.uomo + oreUomo(r), km: t.km + kmTot(r), costo: t.costo + costoTot(r) }), { uomo: 0, km: 0, costo: 0 });
    const leggi = UT.solaLettura();
    el.innerHTML = `
      <section class="sg sg2 gho">
        ${prezzi.length ? `<div class="avviso-m st-b-scadenza gho-prezzi"><span class="av-ico">💶</span><span class="grow"><b>Materiale nostro senza prezzo: ${prezzi.reduce((t, r) => t + r.materiali.filter(senzaPrezzo).length, 0)}</b>
          <span>${prezzi.slice(0, 4).map((r) => `<a class="link" href="#/gho/ore/${r.id}">${fmt(r.data)} ${esc(r.cliente || '')}</a>`).join(' · ')}${prezzi.length > 4 ? ' …' : ''}</span></span></div>` : ''}
        <div class="card sg2-testa">
          <div class="grow"><h1>Registro ore</h1><p class="muted small">${righe.length} ${righe.length === 1 ? 'intervento' : 'interventi'} · ${hm(tot.uomo)} ore · ${tot.km} km${vedeSoldi ? ' · ' + euro(tot.costo) + ' di spese' : ''}
            ${info('Ogni intervento fatto per GHO ELIGIO: orari, viaggio, persone, km, piattaforme e materiale. Le ore totali sono (ore lavorate + ore di viaggio) × persone. Il viaggio costa 0,50 € al km solo se andiamo con un nostro mezzo; la nostra piattaforma 5 € all\'ora. Il materiale messo da noi va con il prezzo: se non lo sai, lascialo vuoto e comparirà un promemoria. A fine mese stampa il riepilogo per la fattura. Il tasto 💬 apre il messaggio WhatsApp: quando lo invii diventa ✓ verde con le iniziali di chi l\'ha mandato; se poi modifichi l\'intervento diventa ! arancione, da rimandare.')}</p></div>
          <div class="anno anno-mini gho-mese"><a href="#/gho/ore?mese=${meseShift(mese, -1)}" aria-label="Mese prima">‹</a><b>${nomeMese(mese)}</b><a href="#/gho/ore?mese=${meseShift(mese, 1)}" aria-label="Mese dopo">›</a></div>
          ${UI.menu([UT.puo('stampa') && { t: `🖨️ Riepilogo di ${nomeMese(mese)}`, href: `#/gho/ore/stampa/${mese}` }])}
        </div>
        ${!leggi ? `<a class="sg2-inizia ap-nuovo" href="#/gho/ore/nuovo">＋ Nuovo intervento</a>` : ''}
        ${righe.length ? `<div class="sg2-lista">${righe.map((r) => `
          <div class="sg2-riga gho-riga">
            <a class="gho-apri" href="#/gho/ore/${r.id}">
              <span class="n ap-data">${esc(fmt(r.data).replace(/\/(\d\d)(\d\d)$/, '/$2'))}${giorniDi(r).length > 1 ? `<small class="gho-ng">+${giorniDi(r).length - 1} ${giorniDi(r).length === 2 ? 'giorno' : 'giorni'}</small>` : ''}</span>
              <span class="d">${esc([r.cliente, r.citta].filter(Boolean).join(' · '))}${r.gru ? ` <small class="muted">gru ${esc(r.gru)}</small>` : ''}
                <small>${giorniDi(r).length > 1 ? `${giorniDi(r).length} giorni, fino al ${esc(ggmm(giorniDi(r).slice(-1)[0].data))}` : esc(orari(r).join(' e '))}${viaggioTot(r) ? ' + viaggio ' + oreTesto(viaggioTot(r)) : ''} · ${esc(nomiPers(S, r).join(', '))}${puoPrezzi() && (r.materiali || []).some(senzaPrezzo) ? ' · <b class="txt-ko">prezzo da mettere</b>' : ''}</small></span>
              <span class="gho-ore">${hm(oreUomo(r))}</span></a>
            <button type="button" class="btn ghost small gho-wabtn" data-wa="${r.id}" aria-label="Messaggio WhatsApp${r.waInviato ? ' (già inviato)' : ''}">${iconaWa(S, r)}</button>
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
    r.giorni = JSON.parse(JSON.stringify(giorniDi(r))); r.mezzi = JSON.parse(JSON.stringify(mezziDi(r)));
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
          <div class="tre"><label>Cliente (loro)<input name="cliente" list="ghoCli" value="${esc(r.cliente)}" placeholder="es. ROSSI SPA"></label>
            <label>Città<input name="citta" list="ghoCitta" value="${esc(r.citta)}"></label>
          <datalist id="ghoCli">${clientiNoti.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
          <datalist id="ghoCitta">${cittaNote.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
          <label>N° gru<input name="gru" value="${esc(r.gru)}"></label></div>
          <label>Descrizione dei lavori svolti<textarea name="descrizione" rows="3">${esc(r.descrizione)}</textarea></label>

          <h2 class="sez-form">Giorni e orari ${info('Scrivi le ore con la tastiera: 0800 o 8 = 08:00. Si arrotondano ai quarti d\'ora. Le ore di viaggio come 1,5 oppure 1:30. Se il lavoro dura più giorni tocca «+ Aggiungi giorno»: ogni giorno ha i suoi orari e il suo viaggio.')}</h2>
          <div id="gGiorni">${r.giorni.map((g, i) => `
            <div class="ap-tratto gho-g" data-i="${i}">
              ${r.giorni.length > 1 ? `<div class="ap-tratto-h"><b>${i + 1}° giorno</b><button type="button" class="btn ghost small danger" data-rmg="${i}" aria-label="Togli giorno">×</button></div>` : ''}
              <label class="gho-gdata">Data<input type="date" data-g="data" value="${esc(g.data || '')}"></label>
              <div class="gr-riga gr-orari gho-orari">
                <fieldset class="gr-fascia"><legend>Mattina</legend><input type="text" inputmode="numeric" data-g="mattDa" data-ora maxlength="5" placeholder="--:--" autocomplete="off" value="${esc(g.mattDa || '')}"><span>–</span><input type="text" inputmode="numeric" data-g="mattA" data-ora maxlength="5" placeholder="--:--" autocomplete="off" value="${esc(g.mattA || '')}"></fieldset>
                <fieldset class="gr-fascia"><legend>Pomeriggio</legend><input type="text" inputmode="numeric" data-g="pomDa" data-ora maxlength="5" placeholder="--:--" autocomplete="off" value="${esc(g.pomDa || '')}"><span>–</span><input type="text" inputmode="numeric" data-g="pomA" data-ora maxlength="5" placeholder="--:--" autocomplete="off" value="${esc(g.pomA || '')}"></fieldset>
                <label>Ore di viaggio<input data-g="viaggio" inputmode="decimal" value="${esc(viaggioTxt(g.viaggio))}" placeholder="es. 1,5"></label>
              </div></div>`).join('')}</div>
          <button type="button" class="btn ghost small" id="gAddG">+ Aggiungi giorno</button>
          <span class="lab">Persone</span>
          <div class="chip-tecnici" id="gPers">${persone.map((u) => `<button type="button" class="chip-t ${r.persone.includes(u.id) ? 'on' : ''}" data-p="${u.id}">${esc(UT.breve(u))}</button>`).join('')}</div>
          <p class="gho-calc" id="gOre"></p>

          <h2 class="sez-form">Mezzi e km ${info('Un mezzo per riga, con i suoi km (di tutti i giorni). Se siete andati con due furgoni aggiungi il secondo con «+ Aggiungi mezzo». I km dei nostri mezzi costano 0,50 € al km; quelli dei mezzi loro non si contano.')}</h2>
          <div id="gMezzi">${r.mezzi.map((m, i) => `
            <div class="ap-tratto gho-mz" data-i="${i}"><div class="ap-tratto-h">
              <div class="ap-scelte"><button type="button" data-mv="nostro" class="${nostro(m) ? 'on' : ''}">🚐 Nostro mezzo</button><button type="button" data-mv="loro" class="${nostro(m) ? '' : 'on'}">Mezzo loro</button></div>
              ${r.mezzi.length > 1 ? `<button type="button" class="btn ghost small danger" data-rmz="${i}" aria-label="Togli mezzo">×</button>` : ''}</div>
              <div class="due">
                ${nostro(m) ? `<label>Quale mezzo<select data-z="mezzoId"><option value="">— scegli —</option>${veicoli.map((v) => `<option value="${v.id}" ${v.id === m.mezzoId ? 'selected' : ''}>${esc(MEZ.corto(v))}</option>`).join('')}</select></label>` : '<span></span>'}
                <label>Km di viaggio<span class="gho-km"><input data-z="km" inputmode="decimal" value="${esc(m.km || '')}"><b data-kmc></b></span></label>
              </div></div>`).join('')}</div>
          <button type="button" class="btn ghost small" id="gAddZ">+ Aggiungi mezzo</button>

          <h2 class="sez-form">Piattaforme ${info('Per ogni piattaforma: quante, che tipo, per quante ore. Il tasto «Copia le ore dell\'intervento» mette le ore lavorate (senza il viaggio): es. dalle 8 alle 9 = 1 h. La nostra costa 5 € all\'ora, quella loro non si conta.')}</h2>
          <div id="gPiatt">${r.piattaforme.map((p, i) => `
            <div class="ap-tratto gho-p" data-i="${i}"><div class="ap-tratto-h">
              <div class="ap-scelte"><button type="button" data-pn="1" class="${p.nostra ? 'on' : ''}">Nostra</button><button type="button" data-pn="0" class="${p.nostra ? '' : 'on'}">Loro</button></div>
              <button type="button" class="btn ghost small danger" data-rmp="${i}">×</button></div>
              <div class="tre"><label>Quante<input data-k="qta" inputmode="numeric" value="${esc(p.qta ?? 1)}"></label>
                <label>Tipo<input data-k="tipo" list="ghoPiatt" value="${esc(p.tipo || '')}" placeholder="es. SEMOVENTE A FORBICE"></label>
                <label>Ore di utilizzo<input data-k="ore" inputmode="decimal" value="${esc(p.ore || '')}"></label></div>
              <div class="gho-p-azioni"><button type="button" class="btn ghost small" data-co="${i}">⏱ Copia le ore dell'intervento</button><p class="gho-calc" data-pc></p></div></div>`).join('')}</div>
          <datalist id="ghoPiatt">${[...new Set([...piattMie.map((m) => MEZ.tipoP(m)), 'MOBILE CON STABILIZZATORI', 'SEMOVENTE A FORBICE', 'SEMOVENTE ARTICOLATA', 'CINGOLATA (RAGNO)', 'SU AUTOCARRO'])].map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
          <button type="button" class="btn ghost small" id="gAddP">+ Aggiungi piattaforma</button>

          <h2 class="sez-form">Materiale impiegato ${info('Scegli se il materiale l\'hanno dato loro o l\'abbiamo messo noi. Quello nostro va in blu sul foglio e serve il prezzo (al pezzo): se ora non lo sai lascialo vuoto, ti comparirà un promemoria.')}</h2>
          <div id="gMat">${r.materiali.map((m, i) => `
            <div class="ap-tratto gho-m ${m.nostro ? 'nostro' : ''}" data-i="${i}"><div class="ap-tratto-h">
              <div class="ap-scelte"><button type="button" data-mn="0" class="${m.nostro ? '' : 'on'}">Dato da loro</button><button type="button" data-mn="1" class="${m.nostro ? 'on' : ''}">Messo da noi</button></div>
              <button type="button" class="btn ghost small danger" data-rmm="${i}">×</button></div>
              <div class="gho-mat"><label>Codice<input data-k="codice" value="${esc(m.codice || '')}"></label><label class="lungo">Descrizione${m.articoloId ? ' <span class="art-tag">📦 dal magazzino</span>' : ''}<input data-k="descrizione" value="${esc(m.descrizione || '')}" ${m.nostro ? 'placeholder="scrivi per cercare in magazzino"' : ''}></label>
                <label>Quantità<input data-k="qta" inputmode="decimal" value="${esc(m.qta ?? 1)}"></label>
                ${m.nostro && puoPrezzi() ? `<label>Prezzo € (al pezzo)<input data-k="prezzo" inputmode="decimal" value="${esc(m.prezzo ?? '')}" placeholder="da vedere"></label>` : ''}</div></div>`).join('')}</div>
          <button type="button" class="btn ghost small" id="gAddM">+ Aggiungi materiale</button>

          <h2 class="sez-form">Segnalazioni ${info('Quello che va segnalato al cliente: sul foglio stampato esce in rosso. Scrivi una annotazione per riga (vai a capo): nel messaggio WhatsApp diventano un elenco puntato.')}</h2>
          <textarea name="segnalazioni" rows="4" placeholder="una annotazione per riga, es.&#10;FUNE DA SOSTITUIRE AL PROSSIMO INTERVENTO&#10;SI CONSIGLIA INSTALLAZIONE RADIOCOMANDO">${esc(r.segnalazioni)}</textarea>

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
      ['cliente', 'citta', 'gru', 'descrizione', 'segnalazioni'].forEach((k) => (r[k] = (F.elements[k].value || '').trim()));
      F.querySelectorAll('.gho-g').forEach((b, i) => { const g = r.giorni[i];
        g.data = b.querySelector('[data-g="data"]').value;
        ['mattDa', 'mattA', 'pomDa', 'pomA'].forEach((k) => (g[k] = RAP.ora15(b.querySelector(`[data-g="${k}"]`).value) || ''));
        g.viaggio = viaggioMin(b.querySelector('[data-g="viaggio"]').value); });
      F.querySelectorAll('.gho-mz').forEach((b, i) => { const m = r.mezzi[i];
        m.km = (b.querySelector('[data-z="km"]').value || '').trim(); m.mezzoId = nostro(m) ? (b.querySelector('[data-z="mezzoId"]')?.value || '') : ''; });
      r.persone = [...F.querySelectorAll('#gPers .chip-t.on')].map((b) => b.dataset.p);
      F.querySelectorAll('.gho-p').forEach((b, i) => { const p = r.piattaforme[i]; b.querySelectorAll('[data-k]').forEach((x) => (p[x.dataset.k] = x.value.trim())); });
      F.querySelectorAll('.gho-m').forEach((b, i) => { const m = r.materiali[i]; b.querySelectorAll('[data-k]').forEach((x) => (m[x.dataset.k] = x.value.trim())); });
    }
    function calcoli() {
      leggi();
      const F = f();
      F.querySelector('#gOre').innerHTML = `${r.giorni.length > 1 ? r.giorni.length + ' giorni: ' : ''}Lavoro <b>${hm(lavoro(r))}</b> + viaggio <b>${hm(viaggioTot(r))}</b> × ${nPers(r)} ${nPers(r) === 1 ? 'persona' : 'persone'} = <b>${hm(oreUomo(r))} ore</b>`;
      F.querySelectorAll('.gho-mz').forEach((b, i) => { const m = r.mezzi[i]; b.querySelector('[data-kmc]').textContent = nostro(m) ? (vp() ? `= ${euro(num(m.km) * EURO_KM)}` : 'mezzo nostro: si conta') : 'non si conta (mezzo loro)'; });
      F.querySelectorAll('.gho-p').forEach((b, i) => { const p = r.piattaforme[i]; b.querySelector('[data-pc]').innerHTML = p.nostra ? (vp() ? `${num(p.qta) || 1} × ${String(num(p.ore)).replace('.', ',')} h × 5 € = <b>${euro(num(p.ore) * (num(p.qta) || 1) * EURO_ORA_PIATT)}</b>` : `${num(p.qta) || 1} × ${String(num(p.ore)).replace('.', ',')} h: si conta`) : 'piattaforma loro: non si conta'; });
      const manca = r.materiali.filter(senzaPrezzo).length;
      F.querySelector('#gTot').innerHTML = vp() ? `Spese: viaggio ${euro(costoKm(r))} · piattaforme ${euro(costoPiatt(r))} · materiale ${euro(costoMat(r))} → <b>${euro(costoTot(r))}</b>${manca && puoPrezzi() ? ` <span class="txt-ko">· ${manca} ${manca === 1 ? 'prezzo' : 'prezzi'} da mettere</span>` : ''}`
        : '';
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
        x.addEventListener('input', () => { x.classList.remove('ora-ko'); if (/^\d{4}$/.test(x.value) || /^\d{1,2}[:.]\d{2}$/.test(x.value)) { if (sistema(x)) { const g = x.closest('.gho-g'); if (ore[k + 1] && ore[k + 1].closest('.gho-g') === g) ore[k + 1].focus(); else g.querySelector('[data-g="viaggio"]').focus(); } } });
      });
      F.querySelectorAll('#gPers .chip-t').forEach((b) => (b.onclick = () => { b.classList.toggle('on'); calcoli(); }));
      F.querySelectorAll('.gho-mz [data-mv]').forEach((b) => (b.onclick = () => { leggi(); r.mezzi[+b.closest('.gho-mz').dataset.i].mezzo = b.dataset.mv; disegna(); }));
      F.querySelector('#gAddZ').onclick = () => { leggi(); r.mezzi.push({ mezzo: 'nostro', mezzoId: '', km: '' }); disegna(); };
      F.querySelectorAll('[data-rmz]').forEach((b) => (b.onclick = () => { leggi(); r.mezzi.splice(+b.dataset.rmz, 1); disegna(); }));
      // nuovo giorno: il giorno dopo l'ultimo, con gli stessi orari e lo stesso viaggio
      F.querySelector('#gAddG').onclick = () => { leggi(); const u = r.giorni[r.giorni.length - 1] || {};
        const d = u.data ? new Date(u.data + 'T12:00') : new Date(); d.setDate(d.getDate() + 1);
        r.giorni.push({ ...u, data: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }); disegna(); };
      F.querySelectorAll('[data-rmg]').forEach((b) => (b.onclick = () => { leggi(); r.giorni.splice(+b.dataset.rmg, 1); disegna(); }));
      F.querySelectorAll('[data-co]').forEach((b) => (b.onclick = () => { leggi(); const h = Math.round(lavoro(r) / 60 * 100) / 100;
        if (!h) { UI.toast('Prima scrivi gli orari dell\'intervento'); return; }
        r.piattaforme[+b.dataset.co].ore = String(h).replace('.', ','); disegna(); UI.toast(`Messe ${String(h).replace('.', ',')} h`, 'ok'); }));
      F.querySelector('#gAddP').onclick = () => { leggi(); r.piattaforme.push({ qta: 1, tipo: '', ore: '', nostra: true }); disegna(); };
      F.querySelector('#gAddM').onclick = () => { leggi(); r.materiali.push({ codice: '', descrizione: '', qta: 1, nostro: false }); disegna(); };
      F.querySelectorAll('[data-rmp]').forEach((b) => (b.onclick = () => { leggi(); r.piattaforme.splice(+b.dataset.rmp, 1); disegna(); }));
      F.querySelectorAll('[data-rmm]').forEach((b) => (b.onclick = () => { leggi(); r.materiali.splice(+b.dataset.rmm, 1); disegna(); }));
      F.querySelectorAll('.gho-p [data-pn]').forEach((b) => (b.onclick = () => { leggi(); r.piattaforme[+b.closest('.gho-p').dataset.i].nostra = b.dataset.pn === '1'; disegna(); }));
      // materiale messo da noi: scrivendo la descrizione (o il codice) compaiono gli articoli del magazzino
      F.querySelectorAll('.gho-m.nostro').forEach((b) => {
        const i = +b.dataset.i;
        const scegli = (a) => {
          leggi(); const m = r.materiali[i];
          const gho = S.clienti.find((c) => /\bGHO\b/i.test(CLI.nome(c)));
          const p = MAG.prezzoCliente(S, a, gho);
          Object.assign(m, { articoloId: a.id, codice: a.codCostruttore || a.codice, descrizione: a.descrizione, prezzo: p != null ? String(Math.round(p * 100) / 100).replace('.', ',') : m.prezzo });
          disegna();
        };
        MAG.collegaRicerca(b.querySelector('[data-k="descrizione"]'), scegli, { soloSe: () => !r.materiali[i]?.articoloId });
        MAG.collegaRicerca(b.querySelector('[data-k="codice"]'), scegli, { soloSe: () => !r.materiali[i]?.articoloId });
      });
      F.querySelectorAll('.gho-m [data-mn]').forEach((b) => (b.onclick = () => { leggi(); r.materiali[+b.closest('.gho-m').dataset.i].nostro = b.dataset.mn === '1'; disegna(); }));
      const salva = async (wa) => {
        if (ore.some((x) => x.value && RAP.ora15(x.value) === null)) return UI.toast('C\'è un orario non valido', 'err');
        leggi();
        if (r.giorni.some((g) => !g.data)) return UI.toast('Manca la data di un giorno', 'err');
        r.giorni.sort((a, b) => a.data.localeCompare(b.data));
        r.mezzi = r.mezzi.filter((m, i) => i === 0 || num(m.km) || m.mezzoId);
        // campi «riassunto» (primo giorno, totali) usati da elenco, magazzino e versioni vecchie
        const g0 = r.giorni[0];
        Object.assign(r, { data: g0.data, mattDa: g0.mattDa, mattA: g0.mattA, pomDa: g0.pomDa, pomA: g0.pomA, viaggio: viaggioTot(r), km: String(kmTot(r) || ''),
          mezzo: nostroMezzo(r) ? 'nostro' : 'loro', mezzoId: (r.mezzi.find(nostro) || {}).mezzoId || '' });
        if (!r.cliente) { F.elements.cliente.focus(); return UI.toast('Scrivi il cliente', 'err'); }
        if (!r.persone.length) return UI.toast('Scegli almeno una persona', 'err');
        const up = (x) => String(x || '').toUpperCase();
        Object.assign(r, { cliente: up(r.cliente), citta: up(r.citta), gru: up(r.gru), descrizione: up(r.descrizione), segnalazioni: up(r.segnalazioni) });
        r.materiali = r.materiali.filter((m) => m.codice || m.descrizione).map((m) => ({ ...m, codice: up(m.codice), descrizione: up(m.descrizione), prezzo: m.nostro ? m.prezzo : undefined }));
        r.piattaforme = r.piattaforme.filter((p) => p.tipo || num(p.ore)).map((p) => ({ ...p, tipo: up(p.tipo) }));
        if (orig?.waInviato && messaggio(S, orig) !== messaggio(S, r)) r.waInviato = { ...orig.waInviato, modificato: true };
        try { await UI.salva('oreGho', JSON.parse(JSON.stringify(r))); } catch (e) { return; }
        const manca = r.materiali.filter(senzaPrezzo).length;
        UI.toast(manca && puoPrezzi() ? `Salvato · ricordati il prezzo di ${manca} ${manca === 1 ? 'materiale' : 'materiali'}` : 'Salvato', manca ? '' : 'ok');
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
    const mat = (r.materiali || []).map((m) => `<div class="${m.nostro ? 'gs-blu' : ''}">${m.qta ? esc(String(m.qta)) + ' × ' : ''}${esc([m.codice, m.descrizione].filter(Boolean).join(' – '))}${m.nostro && !vp() ? ' <i>(nostra fornitura)</i>' : ''}${m.nostro && vp() ? ` <i>(nostra fornitura${senzaPrezzo(m) ? ', prezzo da definire' : ' – ' + euro(num(m.prezzo)) + ((num(m.qta) || 1) > 1 ? ' cad.' : '')})</i>` : ' <i>(fornito dal cliente)</i>'}</div>`).join('');
    const piatt = (r.piattaforme || []).map((p) => `${num(p.qta) || 1} × ${esc(p.tipo || 'piattaforma')} ${num(p.ore) ? `(${String(num(p.ore)).replace('.', ',')} h)` : ''} ${p.nostra ? 'NOSTRA' : 'LORO'}`).join('<br>');
    const gg = giorniDi(r), piu = gg.length > 1, mz = mezziDi(r);
    return `<tr>
      <td class="c">${piu ? gg.map((g) => esc(fmt(g.data))).join('<br>') : esc(fmt(r.data))}</td>
      <td><b>${esc(r.cliente || '')}</b><br>${esc(r.citta || '')}</td>
      <td class="c">${esc(r.gru || '')}</td>
      <td class="gs-lav">${esc(r.descrizione || '')}${mat ? `<div class="gs-mat">${mat}</div>` : ''}${r.segnalazioni ? `<div class="gs-rosso">${String(r.segnalazioni).split(/\n+/).map((x) => x.replace(/^\s*[-•*·]+\s*/, '').trim()).filter(Boolean).map((x) => '⚠ ' + esc(x)).join('<br>')}</div>` : ''}</td>
      <td class="c">${gg.map((g) => `${piu ? `<b>${esc(ggmm(g.data))}</b> ` : ''}${orariG(g).map((o) => o.replace('dalle ', '').replace(' alle ', '–')).join(piu ? ' ' : '<br>')}`).join('<br>')}</td>
      <td class="c">${viaggioTot(r) ? hm(viaggioTot(r)) : ''}</td>
      <td class="c">${esc(siglePers(S, r).join(' - '))}</td>
      <td class="c"><b>${hm(oreUomo(r))}</b></td>
      <td class="c">${mz.map((m) => `${esc(m.km || '')}<div class="gs-pic">${esc(nomeMezzo(S, m))}</div>`).join('')}</td>
      ${vp() ? `<td class="d">${costoKm(r) ? euro(costoKm(r)) : '–'}</td>` : ''}
      <td>${piatt}</td>
      ${vp() ? `<td class="d">${costoPiatt(r) ? euro(costoPiatt(r)) : '–'}</td>` : ''}</tr>`;
  }
  function riepilogo(S, righe, mese) {
    const T = righe.reduce((t, r) => ({ lav: t.lav + lavoro(r), via: t.via + viaggioTot(r) * nPers(r), uomo: t.uomo + oreUomo(r), km: t.km + kmNostri(r), kmLoro: t.kmLoro + kmLoro(r),
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
      ${vp() ? `<div class="gs-box"><h3>COSTI DEL MESE</h3>
        <table><tr><td>Viaggi: ${T.km} km × ${euro(EURO_KM)}${T.kmLoro ? ` <i>(+ ${T.kmLoro} km con mezzo loro, non conteggiati)</i>` : ''}</td><td class="d">${euro(T.ckm)}</td></tr>
          <tr><td>Piattaforme nostre: ${String(T.op).replace('.', ',')} h × ${euro(EURO_ORA_PIATT)}</td><td class="d">${euro(T.cp)}</td></tr>
          <tr><td>Materiale di nostra fornitura${manca ? ' <i class="gs-rosso">(alcuni prezzi da definire)</i>' : ''}</td><td class="d">${euro(T.cm)}</td></tr>
          <tr class="gs-forte"><td>TOTALE COSTI</td><td class="d">${euro(T.ckm + T.cp + T.cm)}</td></tr></table></div>` : ''}
      <div class="gs-box gs-largo"><h3>MATERIALI DEL MESE</h3>
        ${nostri.length ? `<div class="gs-blu"><b>Di nostra fornitura:</b> ${nostri.map((m) => `${String(m.qta).replace('.', ',')} × ${esc([m.codice, m.descrizione].filter(Boolean).join(' – '))}${!vp() ? '' : senzaPrezzo(m) ? ' (prezzo da definire)' : ' = ' + euro(m.qta * num(m.prezzo))}`).join('; ')}</div>` : ''}
        ${loro.length ? `<div><b>Forniti dal cliente:</b> ${loro.map((m) => `${String(m.qta).replace('.', ',')} × ${esc([m.codice, m.descrizione].filter(Boolean).join(' – '))}`).join('; ')}</div>` : ''}
        ${!nostri.length && !loro.length ? '<div class="muted">Nessun materiale impiegato.</div>' : ''}</div>
    </div>`;
  }
  const testaPagina = (mese, n, tot) => `<div class="gs-testa"><img src="img/logo-grande.png" alt=""><div class="grow"><h2>RIEPILOGO INTERVENTI · GHO ELIGIO</h2><p>${nomeMese(mese).toUpperCase()}</p></div><span class="gs-pag">Pag. ${n}/${tot}</span></div>`;
  const piede = () => '<div class="gs-piede">Gru impianti S.a.s di Cau Alessandro &amp; C. Sede operativa : Via Avigliana 4/H - 10057 S.Ambrogio(TO) · <span class="gs-blu">in blu: materiale di nostra fornitura</span> · <span class="gs-rosso">in rosso: segnalazioni</span></div>';
  const colonne = () => COLS.filter(([t]) => vp() || !t.startsWith('€'));
  const intestTab = () => `<thead><tr>${colonne().map(([t, w]) => `<th${w ? ` style="width:${w}mm"` : ''}>${t}</th>`).join('')}</tr></thead>`;

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
      ${p.length || !totaliSoli ? `<table class="gs-tab">${intestTab()}<tbody>${p.map((i) => rigaStampa(S, righe[i])).join('') || `<tr><td colspan="${colonne().length}" class="c muted">Nessun intervento nel mese.</td></tr>`}</tbody></table>` : ''}
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
    if (parti[1] === 'schede') return GHOS.route(el, S, parti);
    if (parti[1] !== 'ore') { location.hash = '#/gho'; return null; }
    if (parti[2] === 'stampa') return stampa(el, S, parti[3] || meseScelto);
    if (parti[2] === 'nuovo') return form(el, S, null);
    if (parti[2]) return form(el, S, parti[2]);
    return elenco(el, S, query);
  }
  return { route, badge, messaggio };
})();
