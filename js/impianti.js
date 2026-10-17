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

  const kg = (n) => { n = +n; if (!n) return ''; return n >= 1000 ? (n / 1000).toLocaleString('it-IT') + ' t' : n + ' kg'; };
  const portate = (i) => (i.paranchi || []).map((p) => kg(p.portata)).filter(Boolean).join(' + ') || '—';
  const ordina = (a, b) => (a.numeroInterno || '~').localeCompare(b.numeroInterno || '~', 'it', { numeric: true }) || (a.matricola || '').localeCompare(b.matricola || '');
  const cliente = (S, id) => S.clienti.find((c) => c.id === id);
  const sede = (c, id) => (c?.sedi || []).find((s) => s.id === id);
  const nomeSede = (s) => (s ? (s.sigla ? s.sigla + ' · ' : '') + (s.nome || s.citta) : '(sede tolta)');
  const titoloImp = (i) => [i.tipologia, i.marca].filter(Boolean).join(' ') || 'Impianto';

  // piccola icona in base al tipo (bandiera o carroponte)
  const icona = (t = '') => /bandiera/i.test(t)
    ? `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M10 36V5" stroke="#16324f" stroke-width="4"/><path d="M10 8h24" stroke="#f2b705" stroke-width="5"/><path d="M26 10v10" stroke="#16324f" stroke-width="2"/><path d="M26 20c0 4-4 4-4 1" fill="none" stroke="#16324f" stroke-width="2.5"/><path d="M5 36h12" stroke="#16324f" stroke-width="4"/></svg>`
    : `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M6 36V8M34 36V8" stroke="#16324f" stroke-width="4"/><path d="M3 9h34" stroke="#f2b705" stroke-width="5"/><rect x="16" y="12" width="8" height="5" fill="#16324f"/><path d="M20 17v9c0 4-4 4-4 1" fill="none" stroke="#16324f" stroke-width="2.5"/></svg>`;

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
          <h1>Anagrafica impianti ${info('Gli impianti sono divisi per cliente. Tocca un cliente per vedere i suoi impianti e aggiungerne di nuovi. Puoi cercare anche per matricola, numero di serie o numero interno.')}</h1>
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
    const gruppi = (c.sedi || []).map((s) => ({ s, lista: imp.filter((i) => i.sedeId === s.id).sort(ordina) }));
    const orfani = imp.filter((i) => !sede(c, i.sedeId));
    if (orfani.length) gruppi.push({ s: null, lista: orfani });
    el.innerHTML = `
      <section class="cli">
        <div class="card cli-head">
          ${CLI.avatar(c, true)}
          <div class="grow"><h1><a class="link-anag" href="#/clienti/${c.id}">${esc(CLI.nome(c))}</a></h1>
            <p class="muted">${imp.length} impianti · ${(c.sedi || []).length} ${(c.sedi || []).length === 1 ? 'sede' : 'sedi'}</p></div>
          <a class="btn" href="#/impianti/nuovo?cliente=${c.id}">+ Nuovo impianto</a>
        </div>
        ${gruppi.filter((g) => g.lista.length || (c.sedi || []).length > 1).map((g) => `
          <h2 class="sez">${g.s ? esc(nomeSede(g.s)) : 'Senza sede'} <span class="conta">${g.lista.length}</span></h2>
          <div class="elenco">
            ${g.lista.map((i) => `
              <a class="riga imp-riga" href="#/impianti/i/${i.id}">
                <span class="imp-ico">${icona(i.tipologia)}</span>
                <div class="riga-main">
                  <div class="riga-top">${i.numeroInterno ? `<b>N° ${esc(i.numeroInterno)}</b> · ` : ''}<b>${esc(titoloImp(i))}</b></div>
                  <div class="muted small">${[i.matricola && 'Matr. ' + esc(i.matricola), i.annoCostruzione && 'Anno ' + esc(i.annoCostruzione)].filter(Boolean).join(' · ')}</div>
                </div>
                <div class="riga-dx"><b class="portata">${portate(i)}</b></div>
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
      id: uid(), clienteId: query.get('cliente') || '', sedeId: query.get('sede') || '', tipologia: '', marca: '',
      paranchi: [{ ruolo: 'Primario', portata: '' }], annoCostruzione: '', matricola: '', numeroSerie: '', numeroInterno: ''
    };
    const clientiOrd = [...S.clienti].sort((a, b) => CLI.nome(a).localeCompare(CLI.nome(b)));
    el.innerHTML = `
      <form class="sg form card" id="fImp" novalidate>
        <h1>${id ? 'Modifica impianto' : 'Nuovo impianto'}</h1>
        <div class="due">
          <label>Cliente *<select name="clienteId"><option value="">— scegli —</option>
            ${clientiOrd.map((c) => `<option value="${c.id}" ${c.id === i.clienteId ? 'selected' : ''}>${esc(CLI.nome(c))}</option>`).join('')}</select></label>
          <label>Sede *<select name="sedeId"></select></label>
        </div>
        <div class="due">
          <label><span class="lab-riga">Tipologia di gru
              <button type="button" class="link" id="btnTipi">modifica elenco</button></span>
            <select name="tipologia"></select></label>
          <label>Marca<input name="marca" list="listaMarche" value="${esc(i.marca)}" placeholder="es. Demag, Donati, Stahl…">
            <datalist id="listaMarche">${marche(S).map((m) => `<option value="${esc(m)}">`).join('')}</datalist></label>
        </div>

        <h2 class="sez-form">Portata ${info('Se la gru ha più paranchi (es. doppio paranco) tocca «+ Aggiungi paranco»: il primo è il primario, il secondo il secondario. Scrivi la portata in kg (es. 10000 per 10 t).')}</h2>
        <div id="paranchi"></div>
        <button type="button" class="btn ghost small" id="btnParanco">+ Aggiungi paranco</button>

        <h2 class="sez-form">Identificazione e misure</h2>
        <div class="due">
          <label>Matricola<input name="matricola" value="${esc(i.matricola)}"></label>
          <label>Numero di serie<input name="numeroSerie" value="${esc(i.numeroSerie)}"></label>
        </div>
        <div class="due">
          <label>Numero interno<input name="numeroInterno" value="${esc(i.numeroInterno)}" placeholder="numero usato dal cliente"></label>
          <label>Anno di costruzione<input name="annoCostruzione" type="number" inputmode="numeric" min="1900" max="2100" value="${esc(i.annoCostruzione)}"></label>
        </div>
        <div class="due">
          <label>Scartamento (luce) <span class="unita">(mm)</span><input name="scartamento" type="number" inputmode="numeric" value="${esc(i.scartamento || '')}" placeholder="distanza tra le vie di corsa"></label>
          <span></span>
        </div>
        <p class="muted small">Sollevamento, carrello, ponte, impianto elettrico e documenti si compilano dalle tab della scheda, dopo il salvataggio.</p>

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
      const voci = tipologie(S).slice();
      if (i.tipologia && !voci.includes(i.tipologia)) voci.push(i.tipologia);
      f.tipologia.innerHTML = '<option value="">— scegli —</option>' + voci.map((t) => `<option ${t === i.tipologia ? 'selected' : ''}>${esc(t)}</option>`).join('');
    };
    disegnaTipi();
    f.tipologia.onchange = () => (i.tipologia = f.tipologia.value);
    el.querySelector('#btnTipi').onclick = () => UI.modal({
      titolo: 'Tipologie di gru',
      infoTxt: 'Scrivi una tipologia per riga. Puoi aggiungere, togliere o rinominare le voci. Gli impianti già salvati mantengono la loro tipologia.',
      valori: { voci: tipologie(S).join('\n') },
      campi: [{ k: 'voci', label: 'Voci del menu', tipo: 'textarea' }],
      onSalva: async (v) => {
        const voci = [...new Set(v.voci.split('\n').map((x) => x.trim()).filter(Boolean))];
        if (!voci.length) { UI.toast('Serve almeno una voce', 'err'); return false; }
        await UI.salva('impostazioni', { id: 'tipologieGru', voci });
        S.impostazioni = [...S.impostazioni.filter((x) => x.id !== 'tipologieGru'), { id: 'tipologieGru', voci }];
        disegnaTipi(); UI.toast('Elenco aggiornato', 'ok');
      }
    });
    // paranchi
    const box = el.querySelector('#paranchi');
    const leggi = () => box.querySelectorAll('.paranco').forEach((r, n) => (i.paranchi[n].portata = r.querySelector('input').value));
    const disegnaParanchi = () => {
      box.innerHTML = i.paranchi.map((p, n) => `
        <div class="paranco">
          <span class="paranco-nome">${RUOLI[n] || 'Paranco ' + (n + 1)}</span>
          <label class="misura"><input type="number" inputmode="numeric" min="0" step="1" value="${esc(p.portata)}" placeholder="portata"><span>kg</span></label>
          <span class="muted small conv">${kg(p.portata)}</span>
          ${n > 0 ? `<button type="button" class="btn ghost small danger" data-rm="${n}" aria-label="Togli paranco">×</button>` : ''}
        </div>`).join('');
      box.querySelectorAll('.paranco').forEach((r, n) => (r.querySelector('input').oninput = (e) => { r.querySelector('.conv').textContent = kg(e.target.value); }));
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
        clienteId: f.clienteId.value, sedeId: f.sedeId.value, tipologia: f.tipologia.value, marca: f.marca.value.trim(),
        // tengo tutti i dati del paranco (fune, motori, carrello…), aggiorno solo nome e portata
        paranchi: i.paranchi.map((p, n) => ({ ...p, ruolo: RUOLI[n] || 'Paranco ' + (n + 1), portata: p.portata ? +p.portata : '' })),
        scartamento: f.scartamento.value,
        matricola: f.matricola.value.trim(), numeroSerie: f.numeroSerie.value.trim(), numeroInterno: f.numeroInterno.value.trim(),
        annoCostruzione: f.annoCostruzione.value
      });
      const giaSalvato = !!orig;
      const dop = S.impianti.find((x) => x.id !== i.id && x.matricola && i.matricola && x.matricola.toLowerCase() === i.matricola.toLowerCase());
      if (dop && !UI.conferma(`C'è già un impianto con matricola ${i.matricola}. Salvare comunque?`)) return;
      await UI.salva('impianti', i); UI.toast('Impianto salvato', 'ok');
      location.hash = '#/impianti/i/' + i.id + (giaSalvato ? '' : '?tab=soll');
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
    if (a === 'nuovo') return form(el, S, null, query);
    if (a === 'i' && cmd === 'modifica') return form(el, S, b, query);
    if (a === 'i' && cmd === 'stampa') return IMPS.stampa(el, S, b);
    if (a === 'i') return IMPS.render(el, S, b, query);
    return clienti(el, S);
  }
  return { route, TIPOLOGIE_BASE, icona, titolo: titoloImp, nomeSede };
})();
