// ===== MODULO: ANAGRAFICA IMPIANTI =====
// Ogni impianto appartiene a un cliente e a una sua sede (dall'anagrafica clienti).
window.IMP = (function () {
  const { esc, uid, info } = UI;

  const TIPOLOGIE_BASE = ['Bitrave', 'Bitrave tralicciata', 'Monotrave', 'Monotrave tralicciata', 'Cavalletto',
    'Bandiera a mensola', 'Bandiera a colonna', 'Bandiera sospesa'];
  const RUOLI = ['Primario', 'Secondario', 'Ausiliario'];

  // elenco tipologie modificabile (salvato in "impostazioni")
  const tipologie = (S) => (S.impostazioni.find((x) => x.id === 'tipologieGru') || {}).voci || TIPOLOGIE_BASE;
  const marche = (S) => [...new Set(S.impianti.map((i) => i.marca).filter(Boolean))].sort();

  const soloNum = (v) => /^\s*\d+([.,]\d+)?\s*$/.test(String(v ?? '')) ? +String(v).replace(',', '.') : null;
  // portata: se è un numero la scrivo in kg/t, se c'è scritto altro (es. «10 t + 5 t», «vedi targa») la lascio com'è
  const kg = (v) => { const n = soloNum(v); if (n === null) return String(v ?? '').trim(); if (!n) return ''; return n >= 1000 ? (n / 1000).toLocaleString('it-IT') + ' t' : n + ' kg'; };
  const portate = (i, S) => (S && !MIMP.di(S, i).gru ? '' : (i.paranchi || []).map((p) => kg(p.portata)).filter(Boolean).join(' + ') || '—');
  // ordine delle gru di una sede. Con «per campata» un numero interno tipo 3/11 o 1-50 (gru/campata)
  // si ordina per il secondo numero e poi per il primo: 1/1, 2/1, 3/1, 1/2, 2/2…
  const chiaveNum = (i, modo) => {
    const n = String(i.numeroInterno || '').trim(), m = modo === 'secondo' && n.match(/^(\d+)\s*[\/-]\s*(\d+)$/);
    return m ? m[2] + '/' + m[1] : n || '~';
  };
  const confronta = (modo) => (a, b) => chiaveNum(a, modo).localeCompare(chiaveNum(b, modo), 'it', { numeric: true }) || (a.matricola || '').localeCompare(b.matricola || '');
  const ordina = confronta('');
  const ordineSede = (S, sedeId) => { for (const c of S.clienti) { const s = (c.sedi || []).find((x) => x.id === sedeId); if (s) return s.ordineGru || ''; } return ''; };
  const ordinaSede = (S, sedeId, lista) => lista.sort(confronta(ordineSede(S, sedeId)));
  const cliente = (S, id) => S.clienti.find((c) => c.id === id);
  // stato: in servizio · fuori servizio provvisorio (si controlla ancora) · fuori servizio definitivo (dismesso: grigio, non si controlla più)
  const statoImp = (i) => (i.dismesso || i.stato === 'fsd' ? 'fsd' : i.stato === 'fsp' ? 'fsp' : '');
  const pillStato = (i) => ({ fsd: ' · <span class="pill pill-fsd">⛔ fuori servizio definitivo</span>', fsp: ' · <span class="pill pill-fsp">⏸ fuori servizio provvisorio</span>' })[statoImp(i)] || '';
  const sede = (c, id) => (c?.sedi || []).find((s) => s.id === id);
  const nomeSede = (s) => (s ? (s.sigla ? s.sigla + ' · ' : '') + (s.nome || s.citta) : '(sede tolta)');
  const titoloImp = (i) => [i.tipologia, i.marca].filter(Boolean).join(' ') || 'Impianto';

  // piccola icona in base al tipo (bandiera o carroponte)
  const icona = (x) => MIMP.icona(window.App && App.dati ? App.dati() : null, typeof x === 'string' ? { tipologia: x } : x);

  // ---------- 1. ELENCO CLIENTI (con quanti impianti hanno) ----------
  let cerca = '';
  function clienti(el, S) {
    const t = cerca.trim().toLowerCase();
    const lista = [...S.clienti].sort((a, b) => CLI.nome(a).localeCompare(CLI.nome(b)))
      .map((c) => ({ c, imp: S.impianti.filter((i) => i.clienteId === c.id) }))
      .filter(({ c, imp }) => !t || [CLI.nome(c), c.ragioneSociale, ...(c.sedi || []).flatMap((s) => [s.nome, s.sigla]),
        ...imp.flatMap((i) => [i.marca, i.matricola, i.numeroSerie, i.numeroInterno])].join(' ').toLowerCase().includes(t));
    el.innerHTML = `
      <section class="cli">
        <div class="sez-head">
          <h1>Anagrafica impianti ${info('Gli impianti sono divisi per cliente. Tocca un cliente per vedere i suoi impianti e aggiungerne di nuovi. Puoi cercare anche per matricola, numero di serie o numero interno.' + (UT.isMaster() ? ' Con «⚙ Tipi di impianto» decidi quali voci ha la scheda di ogni tipo (gru a ponte, bandiera, seghetto…) e ne crei di nuovi.' : ''))}</h1>
          ${UT.puo('imp.tipi') && !UT.solaLettura() ? '<a class="btn ghost small" href="#/impianti/modelli">⚙ Tipi di impianto</a>' : ''}
        </div>
        <input type="search" id="fCerca" class="cerca" placeholder="Cerca cliente, matricola, n° di serie, n° interno…" value="${esc(cerca)}">
        <div class="elenco">
          ${lista.length ? lista.map(({ c, imp }) => `
            <a class="riga cli-riga" href="#/impianti/c/${c.id}">
              ${CLI.avatar(c)}
              <div class="riga-main">
                <div class="riga-top"><b>${esc(CLI.nome(c))}</b></div>
                <div class="muted small">${[...new Set(imp.map((i) => i.tipologia))].filter(Boolean).join(' · ') || 'Nessun impianto inserito'}</div>
              </div>
              <div class="riga-dx"><span class="conta-big">${imp.length}</span><span class="muted small">impianti</span></div>
            </a>`).join('') : (S.clienti.length ? '<p class="nessuno">Nessun risultato.</p>' : '<p class="nessuno">Prima aggiungi i clienti e le loro sedi in <a class="link" href="#/clienti">Anagrafica clienti</a>.</p>')}
        </div>
      </section>`;
    const fc = el.querySelector('#fCerca');
    fc.oninput = () => { cerca = fc.value; const p = fc.selectionStart; App.ridisegna(); const n = document.getElementById('fCerca'); n.focus(); n.setSelectionRange(p, p); };
    return { titolo: 'Anagrafica impianti', indietro: '#/', live: true };
  }

  // ---------- 2. IMPIANTI DI UN CLIENTE (divisi per sede) ----------
  function delCliente(el, S, cliId) {
    const c = cliente(S, cliId);
    if (!c) { el.innerHTML = '<p class="nessuno">Cliente non trovato.</p>'; return { titolo: 'Impianti', indietro: '#/impianti' }; }
    const imp = S.impianti.filter((i) => i.clienteId === cliId);
    const ordSt = (a, b) => ((statoImp(a) === 'fsd') - (statoImp(b) === 'fsd')) || ordina(a, b);
    const gruppi = (c.sedi || []).map((s) => ({ s, lista: imp.filter((i) => i.sedeId === s.id).sort((a, b) => ((statoImp(a) === 'fsd') - (statoImp(b) === 'fsd')) || confronta(s.ordineGru || '')(a, b)) }));
    const orfani = imp.filter((i) => !sede(c, i.sedeId));
    if (orfani.length) gruppi.push({ s: null, lista: orfani });
    el.innerHTML = `
      <section class="cli">
        <div class="card cli-head">
          ${CLI.avatar(c, true)}
          <div class="grow"><h1><a class="link-anag" href="#/clienti/${c.id}">${esc(CLI.nome(c))}</a></h1>
            <p class="muted">${imp.length} impianti · ${(c.sedi || []).length} ${(c.sedi || []).length === 1 ? 'sede' : 'sedi'}</p></div>
          <a class="btn fab" href="#/impianti/nuovo?cliente=${c.id}" ${UT.puo('anag.modifica') ? '' : 'hidden'}><span class="fab-piu">+</span><span class="fab-txt"> Nuovo impianto</span></a>
        </div>
        ${gruppi.filter((g) => g.lista.length || (c.sedi || []).length > 1).map((g) => `
          <h2 class="sez">${g.s ? UI.magnete(g.s) + ' ' + esc(g.s.nome || g.s.citta) : 'Senza sede'} <span class="conta">${g.lista.length}</span></h2>
          <div class="elenco">
            ${g.lista.map((i) => `
              <a class="riga imp-riga ${statoImp(i) === 'fsd' ? 'dismesso' : ''}" href="#/impianti/i/${i.id}">
                <span class="imp-ico">${icona(i)}</span>
                <div class="riga-main">
                  <div class="riga-top">${i.numeroInterno ? `<b>N° ${esc(i.numeroInterno)}</b> · ` : ''}<b>${esc(titoloImp(i))}</b></div>
                  <div class="muted small">${[i.matricola && 'Matr. ' + esc(i.matricola), i.annoCostruzione && 'Anno ' + esc(i.annoCostruzione)].filter(Boolean).join(' · ')}${pillStato(i)}</div>
                </div>
                <div class="riga-dx"><b class="portata">${portate(i, S)}</b></div>
              </a>`).join('') || `<p class="muted vuoto-sede">Nessun impianto in questa sede. ${g.s ? `<a class="link" href="#/impianti/nuovo?cliente=${c.id}&sede=${g.s.id}">Aggiungi</a>` : ''}</p>`}
          </div>`).join('') || '<p class="nessuno">Nessun impianto. Aggiungi il primo con «+ Nuovo impianto».</p>'}
        ${(c.sedi || []).length ? '' : `<p class="nessuno">Questo cliente non ha sedi: <a class="link" href="#/clienti/${c.id}">aggiungile in anagrafica</a>.</p>`}
      </section>`;
    return { titolo: 'Impianti · ' + CLI.nome(c), indietro: '#/impianti', live: true };
  }

  // ---------- 3. SCHEDA IMPIANTO: vedi impianti-scheda.js (tab) ----------

  // ---------- 4. NUOVO / MODIFICA IMPIANTO ----------
  function form(el, S, id, query) {
    const orig = id ? S.impianti.find((x) => x.id === id) : null;
    if (id && !orig) { el.innerHTML = '<p class="nessuno">Impianto non trovato.</p>'; return { titolo: 'Impianto', indietro: '#/impianti' }; }
    const i = orig ? JSON.parse(JSON.stringify(orig)) : {
      id: uid(), clienteId: query.get('cliente') || '', sedeId: query.get('sede') || '', tipologia: '', marca: '', modello: query.get('tipo') || 'ponte',
      paranchi: [{ ruolo: 'Primario', portata: '' }], annoCostruzione: '', matricola: '', numeroSerie: '', numeroInterno: ''
    };
    const clientiOrd = [...S.clienti].sort((a, b) => CLI.nome(a).localeCompare(CLI.nome(b)));
    const MODELLI = MIMP.tutti(S);
    i.modello = MIMP.di(S, i).id;
    const M = () => MODELLI.find((m) => m.id === i.modello) || MODELLI[0];
    el.innerHTML = `
      <form class="sg form card" id="fImp" novalidate>
        <h1>${id ? 'Modifica impianto' : 'Nuovo impianto'}</h1>
        <div class="due">
          <label>Cliente *<select name="clienteId"><option value="">— scegli —</option>
            ${clientiOrd.map((c) => `<option value="${c.id}" ${c.id === i.clienteId ? 'selected' : ''}>${esc(CLI.nome(c))}</option>`).join('')}</select></label>
          <label>Sede *<select name="sedeId"></select></label>
        </div>
        <div class="lab-blocco">Tipo di impianto ${info('Il tipo decide le voci della scheda: una gru a ponte ha sollevamento, carrello e ponte; una bandiera ha braccio e rotazione al posto del ponte; un seghetto ha i dati della macchina e del taglio.' + (UT.isMaster() ? ' I tipi e le loro voci si cambiano in Anagrafica impianti › «⚙ Tipi di impianto».' : ''))}</div>
        <div class="mimp-scelta">${MODELLI.map((m) => `<button type="button" class="mimp-ico ${m.id === i.modello ? 'on' : ''}" data-modello="${m.id}">${MIMP.ICONE[m.icona] || MIMP.ICONE.generico}<span>${esc(m.nome)}</span></button>`).join('')}</div>
        <div class="due">
          <label><span class="lab-riga">Tipologia
              ${UT.puo('imp.tipi') ? '<button type="button" class="link" id="btnTipi">modifica elenco</button>' : ''}</span>
            <select name="tipologia"></select></label>
          <label>Marca<input name="marca" list="listaMarche" value="${esc(i.marca)}">
            <datalist id="listaMarche">${marche(S).map((m) => `<option value="${esc(m)}">`).join('')}</datalist></label>
        </div>

        <div id="bloccoGru">
        <h2 class="sez-form">Portata ${info('Se la gru ha più paranchi (es. doppio paranco) tocca «+ Aggiungi paranco»: il primo è il primario, il secondo il secondario. Scrivi la portata in kg (es. 10000 per 10 t).')}</h2>
        <div id="paranchi"></div>
        <button type="button" class="btn ghost small" id="btnParanco">+ Aggiungi paranco</button>
        </div>

        <h2 class="sez-form">Identificazione e misure</h2>
        <div class="due">
          <label>Matricola<input name="matricola" value="${esc(i.matricola)}"></label>
          <label>Numero di serie<input name="numeroSerie" value="${esc(i.numeroSerie)}"></label>
        </div>
        <div class="due">
          <label>Numero interno<input name="numeroInterno" value="${esc(i.numeroInterno)}" placeholder="numero usato dal cliente"></label>
          <label>Anno di costruzione<input name="annoCostruzione" value="${esc(i.annoCostruzione)}"></label>
        </div>
        <div class="due" id="bloccoScart">
          <label>Scartamento (luce) <span class="unita">(mm)</span><input name="scartamento" value="${esc(i.scartamento || '')}" placeholder="distanza tra le vie di corsa"></label>
          <span></span>
        </div>
        <h2 class="sez-form">Stato ${info('Fuori servizio PROVVISORIO: l\'impianto resta nei controlli (nel controllo si segna con il tasto «⛔ fuori servizio provvisorio»). Fuori servizio DEFINITIVO: diventa grigio, non compare più tra gli impianti da controllare né nel layout; le schede degli anni passati restano.')}</h2>
        <div class="due">
          <label>Stato dell'impianto<select name="stato">
            <option value="" ${statoImp(i) === '' ? 'selected' : ''}>In servizio</option>
            <option value="fsp" ${statoImp(i) === 'fsp' ? 'selected' : ''}>Fuori servizio provvisorio</option>
            <option value="fsd" ${statoImp(i) === 'fsd' ? 'selected' : ''}>Fuori servizio definitivo</option></select></label>
          <label>Dal<input type="date" name="fsDal" value="${esc(i.fsDal || '')}"></label>
        </div>
        <p class="muted small">Le altre voci (<span id="altreVoci"></span>) e i documenti si compilano dalle tab della scheda, dopo il salvataggio.</p>

        <div class="azioni-form">
          ${id ? '<button type="button" class="btn danger ghost" id="btnElimina">Elimina</button>' : ''}
          <span class="grow"></span>
          <a class="btn ghost" href="${id ? '#/impianti/i/' + id : i.clienteId ? '#/impianti/c/' + i.clienteId : '#/impianti'}">Annulla</a>
          <button class="btn" type="submit">Salva</button>
        </div>
      </form>`;

    const f = el.querySelector('#fImp');
    // sede dipende dal cliente
    const sedi = () => {
      const c = cliente(S, f.clienteId.value), ss = c?.sedi || [];
      f.sedeId.innerHTML = ss.length ? (ss.length > 1 ? '<option value="">— scegli —</option>' : '') +
        ss.map((s) => `<option value="${s.id}" ${s.id === i.sedeId ? 'selected' : ''}>${esc(nomeSede(s))}</option>`).join('')
        : '<option value="">(il cliente non ha sedi)</option>';
    };
    f.clienteId.onchange = sedi; sedi();
    // tipologia (elenco modificabile)
    const disegnaTipi = () => {
      const voci = M().tipologie.slice();
      if (i.tipologia && !voci.includes(i.tipologia)) voci.push(i.tipologia);
      f.tipologia.innerHTML = '<option value="">— scegli —</option>' + voci.map((t) => `<option ${t === i.tipologia ? 'selected' : ''}>${esc(t)}</option>`).join('');
    };
    disegnaTipi();
    f.tipologia.onchange = () => (i.tipologia = f.tipologia.value);
    // tipo di impianto: cambia le tipologie e le parti del form
    const mostraTipo = () => {
      const m = M();
      el.querySelector('#bloccoGru').hidden = !m.gru; el.querySelector('#bloccoScart').hidden = !m.scartamento;
      el.querySelector('#altreVoci').textContent = [m.gru && 'sollevamento, carrello', m.ponte && 'ponte', ...m.sezioni.map((x) => x.titolo.toLowerCase()), m.elettrico && 'impianto elettrico'].filter(Boolean).join(', ') || 'nessuna';
    };
    mostraTipo();
    el.querySelectorAll('[data-modello]').forEach((b) => (b.onclick = () => {
      i.modello = b.dataset.modello; el.querySelectorAll('[data-modello]').forEach((x) => x.classList.toggle('on', x === b));
      if (!M().tipologie.includes(i.tipologia)) i.tipologia = '';
      disegnaTipi(); mostraTipo();
    }));
    el.querySelector('#btnTipi')?.addEventListener('click', () => UI.modal({
      titolo: 'Tipologie · ' + M().nome,
      infoTxt: 'Scrivi una tipologia per riga. Puoi aggiungere, togliere o rinominare le voci. Gli impianti già salvati mantengono la loro tipologia.',
      valori: { voci: M().tipologie.join('\n') },
      campi: [{ k: 'voci', label: 'Voci del menu', tipo: 'textarea' }],
      onSalva: async (v) => {
        const voci = [...new Set(v.voci.split('\n').map((x) => x.trim()).filter(Boolean))];
        if (!voci.length) { UI.toast('Serve almeno una voce', 'err'); return false; }
        await MIMP.salvaTipologie(S, i.modello, voci);
        M().tipologie = voci; disegnaTipi(); UI.toast('Elenco aggiornato', 'ok');
      }
    }));
    // paranchi
    const box = el.querySelector('#paranchi');
    const leggi = () => box.querySelectorAll('.paranco').forEach((r, n) => (i.paranchi[n].portata = r.querySelector('input').value));
    const disegnaParanchi = () => {
      box.innerHTML = i.paranchi.map((p, n) => `
        <div class="paranco">
          <span class="paranco-nome">${RUOLI[n] || 'Paranco ' + (n + 1)}</span>
          <label class="misura"><input value="${esc(p.portata)}" placeholder="es. 10000"><span>kg</span></label>
          <span class="muted small conv">${soloNum(p.portata) !== null ? kg(p.portata) : ''}</span>
          ${n > 0 ? `<button type="button" class="btn ghost small danger" data-rm="${n}" aria-label="Togli paranco">×</button>` : ''}
        </div>`).join('');
      box.querySelectorAll('.paranco').forEach((r, n) => (r.querySelector('input').oninput = (e) => { r.querySelector('.conv').textContent = soloNum(e.target.value) !== null ? kg(e.target.value) : ''; }));
      box.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { leggi(); i.paranchi.splice(+b.dataset.rm, 1); disegnaParanchi(); }));
      el.querySelector('#btnParanco').hidden = i.paranchi.length >= 3;
    };
    disegnaParanchi();
    el.querySelector('#btnParanco').onclick = () => { leggi(); i.paranchi.push({ portata: '' }); disegnaParanchi(); };

    f.onsubmit = async (e) => {
      e.preventDefault(); leggi();
      if (!f.clienteId.value) return UI.toast('Scegli il cliente', 'err');
      if (!f.sedeId.value) return UI.toast('Scegli la sede', 'err');
      Object.assign(i, {
        clienteId: f.clienteId.value, sedeId: f.sedeId.value, modello: i.modello, tipologia: f.tipologia.value, marca: f.marca.value.trim(),
        // tengo tutti i dati del paranco (fune, motori, carrello…), aggiorno solo nome e portata
        paranchi: i.paranchi.map((p, n) => ({ ...p, ruolo: RUOLI[n] || 'Paranco ' + (n + 1), portata: soloNum(p.portata) ?? String(p.portata ?? '').trim() })),
        scartamento: f.scartamento.value.trim(),
        matricola: f.matricola.value.trim(), numeroSerie: f.numeroSerie.value.trim(), numeroInterno: f.numeroInterno.value.trim(),
        annoCostruzione: f.annoCostruzione.value.trim(),
        stato: f.stato.value, dismesso: f.stato.value === 'fsd', fsDal: f.stato.value ? (f.fsDal.value || (statoImp(orig || {}) === f.stato.value ? i.fsDal : '') || UI.oggi()) : ''
      });
      if (f.stato.value === 'fsd' && statoImp(orig || {}) !== 'fsd' && !UI.conferma('Mettere l\'impianto FUORI SERVIZIO DEFINITIVO?\n\nDiventa grigio e non compare più tra gli impianti da controllare né nel layout. Le schede degli anni passati restano.')) return;
      const giaSalvato = !!orig;
      const dop = S.impianti.find((x) => x.id !== i.id && x.matricola && i.matricola && x.matricola.toLowerCase() === i.matricola.toLowerCase());
      if (dop && !UI.conferma(`C'è già un impianto con matricola ${i.matricola}. Salvare comunque?`)) return;
      await UI.salva('impianti', i); UI.toast('Impianto salvato', 'ok');
      const m = M(), primaTab = m.gru ? 'soll' : m.sezioni[0] ? 'x_' + m.sezioni[0].id : 'dati';
      location.hash = '#/impianti/i/' + i.id + (giaSalvato ? '' : '?tab=' + primaTab);
    };
    el.querySelector('#btnElimina')?.addEventListener('click', async () => {
      if (!UI.conferma(`Eliminare ${titoloImp(i)}${i.matricola ? ' (matr. ' + i.matricola + ')' : ''} con tutti i suoi dati, documenti e storico?`)) return;
      for (const a of orig.allegati || []) await ALLEGATI.elimina(a.id).catch(() => {});
      await Backend.remove('impianti', i.id); location.hash = '#/impianti/c/' + i.clienteId;
    });
    return { titolo: id ? 'Modifica impianto' : 'Nuovo impianto', indietro: id ? '#/impianti/i/' + id : i.clienteId ? '#/impianti/c/' + i.clienteId : '#/impianti', live: false };
  }

  function route(el, S, parti, query) {
    const [, a, b, cmd] = parti;
    if (a === 'c') return delCliente(el, S, b);
    if (a === 'modelli') {
      if (!UT.puo('imp.tipi')) { el.innerHTML = '<p class="nessuno">I tipi di impianto non sono abilitati per te.</p>'; return { titolo: 'Tipi di impianto', indietro: '#/impianti' }; }
      return b ? MIMP.modifica(el, S, b) : MIMP.elenco(el, S);
    }
    if (a === 'nuovo') return form(el, S, null, query);
    if (a === 'i' && cmd === 'modifica') return form(el, S, b, query);
    if (a === 'i' && cmd === 'stampa') return IMPS.stampa(el, S, b);
    if (a === 'i') return IMPS.render(el, S, b, query);
    return clienti(el, S);
  }
  return { route, TIPOLOGIE_BASE, icona, titolo: titoloImp, nomeSede, statoImp, pillStato, ordinaSede };
})();
