// ===== MODULO: CONTROLLO SOTTOGANCI =====
// Ogni cliente (sede) ha la sua cartella con i suoi sottoganci, ordinati per numero.
// Ogni anno ha fino a 4 controlli, contrassegnati dal colore della fascetta: blu, giallo, arancio, verde.
window.SG = (function () {
  const { esc, oggi, addMesi, giorniDa, uid, fmt } = UI;

  const SLOT = [
    { n: 1, nome: 'blu', col: '#00b0f0' },
    { n: 2, nome: 'giallo', col: '#ffff00' },
    { n: 3, nome: 'arancio', col: '#ffc000' },
    { n: 4, nome: 'verde', col: '#92d050' }
  ];
  const CODICI = [
    ['B', 'Buona'], ['D', 'Discreta'], ['DE', 'Discreta / da eliminare'], ['E', 'Da eliminare'],
    ['S', 'Scorta'], ['SU', 'Scorta utilizzata'], ['\\', 'Eliminata'], ['NC', 'Non controllata']
  ];
  const classeCod = (c) => ({ B: 'c-b', D: 'c-d', DE: 'c-e', E: 'c-e', S: 'c-s', SU: 'c-s', '\\': 'c-x', NC: 'c-x' }[c] || '');

  // data "2026-04-02" -> "2/4/26" (come sull'elenco cartaceo)
  const dataBreve = (s) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${+d}/${+m}/${y.slice(2)}`; };
  const ordinaNum = (a, b) => a.numero.localeCompare(b.numero, 'it', { numeric: true, sensitivity: 'base' });

  // testo su cui cercare: numero, componenti, portata, ubicazione, certificato
  const testoSg = (s) => (s.numero + ' ' + s.parti.map((p) => p.denominazione + ' ' + p.dimensioni).join(' ') + ' ' + s.ubicazione + ' ' + s.portata + ' ' + s.certificato).toLowerCase();

  // ---------- dati ----------
  // Una "cartella" = una sede di un cliente dell'anagrafica.
  // Restituisce i dati presi DIRETTAMENTE dall'anagrafica: se cambi il nome lì, cambia anche qui e sulle stampe.
  function cliente(S, sedeId) {
    for (const c of S.clienti) {
      const sd = (c.sedi || []).find((x) => x.id === sedeId);
      if (sd) return { id: sd.id, clienteId: c.id, nome: c.ragioneSociale, localita: sd.nome || sd.citta || '', titoloElenco: sd.titoloElenco || 'ELENCO SOTTOGANCI', sigla: sd.sigla || '', sede: sd, anagrafica: c };
    }
    return null;
  }
  // cartelle attive: sedi con sottoganci o aperte apposta
  const cartelleDi = (S) => S.clienti.flatMap((c) => (c.sedi || [])
    .filter((sd) => sd.cartellaSottoganci || S.sottoganci.some((x) => x.sedeId === sd.id))
    .map((sd) => cliente(S, sd.id)))
    .sort((a, b) => nomeCliente(a).localeCompare(nomeCliente(b)));
  const nomeCliente = (c) => (c ? `${c.nome}${c.localita ? ' ' + c.localita : ''}` : '(cliente)');
  const giriDi = (S, cliId, anno) => S.giriSottoganci.filter((g) => g.sedeId === cliId && (anno == null || g.anno === anno));
  const slotGiri = (S, cliId, anno) => SLOT.map((s) => giriDi(S, cliId, anno).find((g) => g.slot === s.n) || null);

  // sottoganci da mostrare in un anno: quelli attivi + quelli controllati quell'anno
  function elenco(S, cliId, anno) {
    const giri = giriDi(S, cliId, anno);
    return S.sottoganci.filter((s) => s.sedeId === cliId && (!s.dismesso || giri.some((g) => g.righe[s.id])))
      .sort(ordinaNum);
  }
  // note da mostrare: quelle dell'ultimo controllo dell'anno che contiene il sottogancio
  function noteDi(S, sg, anno) {
    const g = slotGiri(S, sg.sedeId, anno).filter(Boolean).reverse().find((x) => x.righe[sg.id]);
    return g ? g.righe[sg.id].note || [] : [];
  }
  function ultimoGiro(S, cliId) {
    return giriDi(S, cliId).sort((a, b) => b.data.localeCompare(a.data))[0] || null;
  }
  // stato della cartella: quando va fatto il prossimo controllo (ogni 3 mesi)
  function statoCartella(S, cliId) {
    const u = ultimoGiro(S, cliId);
    if (!u) return { k: 'mai', label: 'Mai controllato' };
    const prossimo = addMesi(u.data, 3), d = giorniDa(prossimo);
    if (d < 0) return { k: 'scaduto', label: `Controllo scaduto da ${-d} gg`, prossimo };
    if (d <= 15) return { k: 'scadenza', label: `Controllo tra ${d} gg`, prossimo };
    return { k: 'ok', label: 'In regola', prossimo };
  }
  const daEliminare = (S, cliId) => {
    const u = ultimoGiro(S, cliId); if (!u) return 0;
    return Object.values(u.righe).filter((r) => r.codici.some((c) => c === 'E' || c === 'DE')).length;
  };
  function riepilogo(S) {
    return { scaduti: cartelleDi(S).filter((c) => ['scaduto', 'mai'].includes(statoCartella(S, c.id).k)).length };
  }

  const annoCorrente = () => +oggi().slice(0, 4);
  let annoScelto = annoCorrente();

  // ---------- ELENCO CARTELLE CLIENTI ----------
  const FILTRO = { q: '' };
  function cartelle(el, S) {
    const anno = annoCorrente();
    const tutte = cartelleDi(S), q = FILTRO.q.trim().toLowerCase();
    const lista = tutte.filter((c) => !q || [c.nome, c.localita, c.sigla, c.titoloElenco, c.sede?.citta].join(' ').toLowerCase().includes(q));
    el.innerHTML = `
      <section class="sg">
        <div class="sez-head">
          <h1>Cartelle clienti ${UI.info('Ogni cartella è una sede di un cliente con i suoi sottoganci. Le 4 caselle colorate sono i controlli dell\'anno (fascette blu, giallo, arancio, verde).')}</h1>
          <a class="btn fab" href="#/sottoganci/cartella-nuova"><span class="fab-piu">+</span><span class="fab-txt"> Nuova cartella</span></a>
        </div>
        ${tutte.length ? `<input type="search" id="fCerca" class="cerca" placeholder="Cerca cliente, sede o sigla…" value="${esc(FILTRO.q)}" autocomplete="off">` : ''}
        ${tutte.length && !lista.length ? '<p class="nessuno">Nessuna cartella trovata.</p>' : ''}
        ${tutte.length ? '' : `<p class="nessuno">Nessuna cartella. ${S.clienti.length ? 'Creane una con «+ Nuova cartella» scegliendo la sede del cliente.' : 'Prima aggiungi i clienti e le loro sedi in <a class="link" href="#/clienti">Anagrafica clienti</a>.'}</p>`}
        <div class="cartelle">
          ${lista.map((c) => {
            const st = statoCartella(S, c.id), n = S.sottoganci.filter((s) => s.sedeId === c.id && !s.dismesso).length;
            const sl = slotGiri(S, c.id, anno), del = daEliminare(S, c.id);
            return `
            <a class="cartella" href="#/sottoganci/c/${c.id}">
              <div class="cartella-ico">${c.anagrafica.logo ? CLI.avatar(c.anagrafica, true) : icoCartella}</div>
              <div class="cartella-txt">
                <h2>${UI.magnete(c.sede)} ${esc(c.nome)}</h2>
                <p class="loc">${esc(c.localita || '')}</p>
                <p class="muted small">${n} sottoganci · ${esc(c.titoloElenco || '')}</p>
                <div class="fascette">${SLOT.map((s, i) => `<span class="fasc ${sl[i] ? 'fatto' : ''}" style="--c:${s.col}" title="${s.nome}">${sl[i] ? dataBreve(sl[i].data) : ''}</span>`).join('')}</div>
                <div class="cartella-st"><span class="pill st-${st.k}">${esc(st.label)}</span>
                  ${del ? `<span class="pill st-scaduto">${del} da eliminare</span>` : ''}</div>
              </div>
            </a>`; }).join('')}
        </div>
      </section>`;
    const ft = el.querySelector('#fCerca');
    ft && (ft.oninput = () => { FILTRO.q = ft.value; const pos = ft.selectionStart; App.ridisegna(); const n = document.getElementById('fCerca'); n.focus(); n.setSelectionRange(pos, pos); });
    return { titolo: 'Controllo sottoganci', indietro: '#/schede', live: true };
  }
  const icoCartella = `<svg viewBox="0 0 64 52" aria-hidden="true"><path d="M3 9a4 4 0 0 1 4-4h16l6 6h28a4 4 0 0 1 4 4v30a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" fill="#f2b705" stroke="#16324f" stroke-width="3" stroke-linejoin="round"/><path d="M3 19h58" stroke="#16324f" stroke-width="3"/><rect x="22" y="27" width="20" height="9" rx="2" fill="#fff" stroke="#16324f" stroke-width="2.5"/></svg>`;

  // ---------- CARTELLA DEL CLIENTE ----------
  const filtroTesto = {};
  function cartella(el, S, cliId, query) {
    const c = cliente(S, cliId);
    if (!c) { el.innerHTML = '<p class="nessuno">Cliente non trovato.</p>'; return { titolo: 'Sottoganci', indietro: '#/sottoganci' }; }
    if (query.get('anno')) annoScelto = +query.get('anno');
    const anno = annoScelto;
    const sl = slotGiri(S, cliId, anno);
    const prossimo = SLOT.find((s, i) => !sl[i]);
    const tutti = elenco(S, cliId, anno);
    const t = (filtroTesto[cliId] || '').toLowerCase();
    const items = tutti.filter((s) => !t || testoSg(s).includes(t));
    const st = statoCartella(S, cliId);
    const nAtt = S.sottoganci.filter((x) => x.sedeId === cliId && !x.dismesso).length;
    el.innerHTML = `
      <section class="sg sg2">
        <div class="card sg2-testa">
          <div class="grow">
            <h1><a class="link-anag" href="#/clienti/${c.clienteId}" title="Apri anagrafica">${esc(c.nome)}</a> ${UI.magnete(c.sede)}</h1>
            <p class="muted small">${esc(c.localita || '')} · ${nAtt} sottoganci · <span class="pill st-${st.k}">${esc(st.label)}</span>
              ${UI.info('Il pulsante grande avvia il prossimo controllo dell\'anno (una fascetta per controllo). Tocca una fascetta già fatta per correggerla. Tocca un sottogancio per modificarlo. «＋ Aggiungi sottogancio» per inserirne uno nuovo. Nel menu ⋯ trovi l\'elenco da stampare, l\'invio al cliente e il titolo dell\'elenco.')}</p>
          </div>
          <div class="anno anno-mini"><a href="#/sottoganci/c/${cliId}?anno=${anno - 1}" aria-label="Anno prima">‹</a><b>${anno}</b><a href="#/sottoganci/c/${cliId}?anno=${anno + 1}" aria-label="Anno dopo">›</a></div>
          ${UI.menu([
            UT.puoInviare() && { t: `🖨️ Elenco ${anno} per il cliente`, href: `#/sottoganci/c/${cliId}/stampa/${anno}` },
            UT.puoInviare() && { t: '📧 Invia al cliente', href: `#/invio?tipo=sottoganci&sede=${cliId}&anno=${anno}&da=${encodeURIComponent('#/sottoganci/c/' + cliId)}` },
            { t: '⚙ Titolo dell\'elenco', href: `#/sottoganci/cartella/${cliId}` },
            { t: '🏢 Anagrafica cliente', href: `#/clienti/${c.clienteId}` }
          ])}
        </div>
        <div class="sg2-fasce">
          ${SLOT.map((s, i) => { const ok = sl[i];
            return ok ? `<a class="fatta" style="--c:${s.col}" href="#/sottoganci/c/${cliId}/giro/${anno}/${s.n}">✓ ${s.nome} ${dataBreve(ok.data).replace(/\/\d+$/, '')}</a>`
              : `<span style="--c:${s.col}">${s.nome}</span>`; }).join('')}
        </div>
        ${prossimo && !UT.solaLettura() ? `<a class="sg2-inizia" style="--c:${prossimo.col}" href="#/sottoganci/c/${cliId}/giro/${anno}/${prossimo.n}">▶ Inizia controllo fascetta ${prossimo.nome.toUpperCase()}<small>${prossimo.n}° controllo del ${anno}</small></a>`
          : !prossimo ? `<p class="sg2-finito">✓ Tutti e 4 i controlli del ${anno} sono fatti</p>` : ''}
        ${!UT.solaLettura() ? `<a class="btn ghost sg2-nuovo" href="#/sottoganci/c/${cliId}/nuovo">＋ Aggiungi sottogancio</a>` : ''}
        ${tutti.length > 15 ? `<input type="search" id="fTesto" class="cerca" placeholder="Cerca numero, denominazione, ubicazione…" value="${esc(filtroTesto[cliId] || '')}">` : ''}
        <div class="sg2-tit">Sottoganci · giudizi ${anno}</div>
        <div class="sg2-lista">
          ${items.length ? items.map((s) => `
            <a class="sg2-riga ${s.dismesso ? 'dismesso' : ''}" href="#/sottoganci/s/${s.id}">
              <span class="n">${esc(s.numero)}</span>
              <span class="d">${esc(s.parti[0].denominazione)}${s.parti.length > 1 ? ` <small class="muted">+ ${s.parti.length - 1} comp.</small>` : ''}
                <small>${[s.parti[0].dimensioni, s.portata, s.ubicazione].filter(Boolean).map(esc).join(' · ')}</small></span>
              <span class="es">${sl.map((g, i) => g?.righe[s.id] ? `<em class="${classeCod(g.righe[s.id].codici[0])}" style="--c:${SLOT[i].col}">${esc(g.righe[s.id].codici.filter(Boolean).join('/'))}</em>` : '').join('')}</span>
            </a>`).join('') : `<p class="nessuno">${tutti.length ? 'Nessun sottogancio trovato.' : 'Nessun sottogancio. Aggiungi il primo con «＋ Aggiungi sottogancio».'}</p>`}
        </div>
        <p class="legenda-app">${CODICI.map(([k, l]) => `<span><em class="${classeCod(k)}">${esc(k)}</em> ${l}</span>`).join('')}</p>
      </section>`;

    const ft = el.querySelector('#fTesto');
    if (ft) ft.oninput = () => {
      filtroTesto[cliId] = ft.value; const pos = ft.selectionStart;
      App.ridisegna(); const n = document.getElementById('fTesto'); n.focus(); n.setSelectionRange(pos, pos);
    };
    return { titolo: nomeCliente(c), indietro: '#/sottoganci', live: true };
  }

  // ---------- CARTELLA (nuova / impostazioni) ----------
  // La cartella è legata a una sede dell'anagrafica clienti: qui si sceglie solo la sede e il titolo dell'elenco.
  function formCartella(el, S, sedeId) {
    const c = sedeId ? cliente(S, sedeId) : null;
    const attive = new Set(cartelleDi(S).map((x) => x.id));
    const libere = S.clienti.flatMap((cl) => (cl.sedi || []).filter((sd) => !attive.has(sd.id))
      .map((sd) => ({ id: sd.id, label: `${cl.ragioneSociale} – ${sd.nome || sd.citta}` })))
      .sort((x, y) => x.label.localeCompare(y.label));
    el.innerHTML = `
      <form class="sg form card" id="fCart" novalidate>
        <h1>${c ? 'Impostazioni elenco' : 'Nuova cartella sottoganci'}
          ${UI.info('Ogni sede di un cliente ha la sua cartella. I nomi del cliente e della sede si cambiano in Anagrafica clienti e si aggiornano qui e sulle stampe.')}</h1>
        ${c ? `<p><b>${esc(c.nome)}</b> – ${esc(c.localita)} <a class="link" href="#/clienti/${c.clienteId}">apri anagrafica</a></p>` : `
          <label>Sede del cliente *<select name="sede"><option value="">— scegli —</option>
            ${libere.map((x) => `<option value="${x.id}">${esc(x.label)}</option>`).join('')}</select></label>
          ${libere.length ? '' : '<p class="muted small">Tutte le sedi hanno già una cartella.</p>'}
          <p class="muted small">Il cliente o la sede non ci sono? <a class="link" href="#/clienti">Aggiungili in Anagrafica clienti</a>.</p>`}
        <label>Titolo dell'elenco stampato<input name="titolo" value="${esc(c ? c.titoloElenco : 'ELENCO SOTTOGANCI')}" placeholder="es. ELENCO FUNI"></label>
        <p class="muted small">Sulla stampa viene aggiunto l'anno: «${esc(c ? c.titoloElenco : 'ELENCO SOTTOGANCI')} ${annoCorrente()}».</p>
        <div class="azioni-form">
          ${c && !S.sottoganci.some((x) => x.sedeId === sedeId) ? '<button type="button" class="btn danger ghost" id="btnChiudi">Chiudi cartella</button>' : ''}
          <span class="grow"></span>
          <a class="btn ghost" href="${c ? '#/sottoganci/c/' + sedeId : '#/sottoganci'}">Annulla</a>
          <button class="btn" type="submit">Salva</button>
        </div>
      </form>`;
    const f = el.querySelector('#fCart');
    const salvaSede = async (id, cambi) => {
      const cl = S.clienti.find((x) => (x.sedi || []).some((sd) => sd.id === id));
      const copia = JSON.parse(JSON.stringify(cl));
      Object.assign(copia.sedi.find((sd) => sd.id === id), cambi);
      await UI.salva('clienti', copia);
    };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const id = c ? sedeId : f.sede.value;
      if (!id) return UI.toast('Scegli la sede', 'err');
      await salvaSede(id, { cartellaSottoganci: true, titoloElenco: f.titolo.value.trim().toUpperCase() || 'ELENCO SOTTOGANCI' });
      UI.toast('Salvato', 'ok'); location.hash = '#/sottoganci/c/' + id;
    };
    el.querySelector('#btnChiudi')?.addEventListener('click', async () => {
      if (!UI.conferma('Chiudere questa cartella vuota? La sede resta in anagrafica.')) return;
      for (const g of giriDi(S, sedeId)) await Backend.remove('giriSottoganci', g.id);
      await salvaSede(sedeId, { cartellaSottoganci: false }); location.hash = '#/sottoganci';
    });
    return { titolo: c ? 'Impostazioni elenco' : 'Nuova cartella', indietro: c ? '#/sottoganci/c/' + sedeId : '#/sottoganci', live: false };
  }

  // ---------- SOTTOGANCIO (nuovo / modifica + storico) ----------
  function prossimoNumero(S, cliId) {
    const nums = S.sottoganci.filter((s) => s.sedeId === cliId).map((s) => s.numero).sort((a, b) => a.localeCompare(b, 'it', { numeric: true }));
    const ult = nums[nums.length - 1];
    if (!ult) return '1';
    const m = ult.match(/^(.*?)(\d+)$/);
    return m ? m[1] + String(+m[2] + 1).padStart(m[2].length, '0') : ult + '-1';
  }

  function formSottogancio(el, S, id, cliIdNuovo) {
    const orig = id ? S.sottoganci.find((x) => x.id === id) : null;
    if (id && !orig) { el.innerHTML = '<p class="nessuno">Sottogancio non trovato.</p>'; return { titolo: 'Sottogancio', indietro: '#/sottoganci' }; }
    const s = orig ? JSON.parse(JSON.stringify(orig)) : {
      id: uid(), sedeId: cliIdNuovo, clienteId: cliente(S, cliIdNuovo)?.clienteId, numero: prossimoNumero(S, cliIdNuovo), parti: [{ denominazione: '', dimensioni: '' }],
      portata: '', ubicazione: '', certificato: '', dismesso: false
    };
    const c = cliente(S, s.sedeId);
    // storico: tutti i codici negli anni
    const storico = id ? [...new Set(giriDi(S, s.sedeId).map((g) => g.anno))].sort((a, b) => b - a).map((anno) => {
      const sl = slotGiri(S, s.sedeId, anno);
      return `<div class="sto-anno"><b>${anno}</b>${sl.map((g, i) => `<span class="fasc ${g ? 'fatto' : ''}" style="--c:${SLOT[i].col}">${g?.righe[s.id] ? g.righe[s.id].codici.join(' / ') : ''}</span>`).join('')}</div>`;
    }).join('') : '';

    el.innerHTML = `
      <form class="sg form card" id="fSg" novalidate>
        <h1>${id ? 'Sottogancio ' + esc(s.numero) : 'Nuovo sottogancio'} <small class="muted">${esc(nomeCliente(c))}</small></h1>
        <div class="tre">
          <label>N° (univoco) *<input name="numero" required value="${esc(s.numero)}"></label>
          <label>Portata<input name="portata" value="${esc(s.portata)}" placeholder="es. 3550 KG"></label>
          <label>Ubicazione<input name="ubicazione" value="${esc(s.ubicazione)}" placeholder="es. CP5"></label>
        </div>
        <label>N° certificato<input name="certificato" value="${esc(s.certificato)}" placeholder="es. C5338 / MTF"></label>
        <h2 class="sez-form">Denominazione e dimensioni</h2>
        <p class="muted small">Se è un insieme (es. tirante + campanella + ganci), aggiungi una riga per ogni componente: ognuno avrà il suo esito.</p>
        <div id="parti"></div>
        <button type="button" class="btn ghost small" id="btnParte">+ Aggiungi componente</button>
        <div class="checks"><label class="check"><input type="checkbox" name="dismesso" ${s.dismesso ? 'checked' : ''}> Eliminato / non più in uso (resta negli elenchi degli anni in cui è stato controllato)</label></div>
        <div class="azioni-form">
          ${id ? '<button type="button" class="btn danger ghost" id="btnElimina">Elimina</button>' : ''}
          <span class="grow"></span>
          <a class="btn ghost" href="#/sottoganci/c/${s.sedeId}">Annulla</a>
          <button class="btn" type="submit">Salva</button>
        </div>
        ${storico ? `<h2 class="sez-form">Storico controlli</h2><div class="storico">${storico}</div>` : ''}
      </form>`;

    const f = el.querySelector('#fSg'), box = el.querySelector('#parti');
    const leggiParti = () => box.querySelectorAll('.parte').forEach((r, i) => {
      s.parti[i] = { denominazione: r.querySelector('[data-d]').value, dimensioni: r.querySelector('[data-m]').value };
    });
    const disegna = () => {
      box.innerHTML = s.parti.map((p, i) => `
        <div class="parte">
          <label>Denominazione${i === 0 ? ' *' : ''}<input data-d value="${esc(p.denominazione)}" placeholder="${i === 0 ? 'es. FUNE ACCIAIO A.A.' : 'es. campanella'}"></label>
          <label>Dimensioni<input data-m value="${esc(p.dimensioni)}" placeholder="es. 18x3000x500"></label>
          ${s.parti.length > 1 ? `<button type="button" class="btn ghost small danger" data-rm="${i}" aria-label="Togli componente">×</button>` : ''}
        </div>`).join('');
      box.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { leggiParti(); s.parti.splice(+b.dataset.rm, 1); disegna(); }));
    };
    disegna();
    el.querySelector('#btnParte').onclick = () => { leggiParti(); s.parti.push({ denominazione: '', dimensioni: '' }); disegna(); };

    f.onsubmit = async (e) => {
      e.preventDefault(); leggiParti();
      const numero = f.numero.value.trim();
      if (!numero) return UI.toast('Manca il numero', 'err');
      if (S.sottoganci.some((x) => x.id !== s.id && x.sedeId === s.sedeId && x.numero.toLowerCase() === numero.toLowerCase()))
        return UI.toast(`Il numero ${numero} esiste già per questo cliente`, 'err');
      s.parti = s.parti.map((p) => ({ denominazione: p.denominazione.trim(), dimensioni: p.dimensioni.trim() })).filter((p, i) => i === 0 || p.denominazione || p.dimensioni);
      if (!s.parti[0].denominazione) return UI.toast('Manca la denominazione', 'err');
      // se ho cambiato il numero dei componenti, adeguo i controlli già fatti
      if (orig && orig.parti.length !== s.parti.length) {
        for (const g of giriDi(S, s.sedeId).filter((g) => g.righe[s.id])) {
          const r = g.righe[s.id];
          r.codici = s.parti.map((_, i) => r.codici[i] || ''); r.note = s.parti.map((_, i) => r.note[i] || '');
          await UI.salva('giriSottoganci', g);
        }
      }
      Object.assign(s, { numero, portata: f.portata.value.trim(), ubicazione: f.ubicazione.value.trim(), certificato: f.certificato.value.trim(), dismesso: f.dismesso.checked });
      await UI.salva('sottoganci', s); UI.toast('Sottogancio salvato', 'ok');
      location.hash = '#/sottoganci/c/' + s.sedeId;
    };
    const d = el.querySelector('#btnElimina');
    if (d) d.onclick = async () => {
      const usato = giriDi(S, s.sedeId).some((g) => g.righe[s.id]);
      if (!UI.conferma(usato ? `${s.numero} compare in controlli già fatti: eliminandolo sparirà anche da quegli elenchi. Se è solo fuori uso, meglio spuntare «Eliminato». Eliminare comunque?` : `Eliminare ${s.numero}?`)) return;
      for (const g of giriDi(S, s.sedeId).filter((g) => g.righe[s.id])) { delete g.righe[s.id]; await UI.salva('giriSottoganci', g); }
      await Backend.remove('sottoganci', s.id); location.hash = '#/sottoganci/c/' + s.sedeId;
    };
    return { titolo: id ? 'Sottogancio ' + s.numero : 'Nuovo sottogancio', indietro: '#/sottoganci/c/' + s.sedeId, live: false };
  }

  // ---------- CONTROLLO TRIMESTRALE (giro) ----------
  // Una riga per ogni componente: numero, descrizione e i giudizi. Dopo ogni giudizio si passa da soli al prossimo.
  // Due modi: elenco (con ricerca, per i clienti con centinaia di accessori) oppure una scheda alla volta a tutto schermo.
  const PRINCIPALI = ['B', 'D', 'DE', 'E'];
  let modoGiro = 'elenco';
  function formGiro(el, S, cliId, anno, slotN) {
    const c = cliente(S, cliId);
    if (!c) { el.innerHTML = '<p class="nessuno">Cliente non trovato.</p>'; return { titolo: 'Controllo' }; }
    const slot = SLOT[slotN - 1];
    const esistente = slotGiri(S, cliId, anno)[slotN - 1];
    // controllo precedente: stesso anno slot prima, altrimenti ultimo dell'anno prima
    const precedente = giriDi(S, cliId).filter((g) => g.anno < anno || (g.anno === anno && g.slot < slotN))
      .sort((a, b) => (b.anno - a.anno) || (b.slot - a.slot))[0] || null;
    const g = esistente ? JSON.parse(JSON.stringify(esistente)) : {
      id: uid(), sedeId: cliId, clienteId: c.clienteId, anno, slot: slotN, data: oggi(), tecnici: [], tecnico: '', righe: {},
      noteGenerali: precedente && precedente.anno === anno ? precedente.noteGenerali || '' : '', firmaTecnico: null
    };
    const items = elenco(S, cliId, anno).filter((s) => !s.dismesso || g.righe[s.id]);
    // preparo le righe: le note ripartono da quelle del controllo precedente
    items.forEach((s) => {
      if (!g.righe[s.id]) {
        const pr = precedente?.righe[s.id];
        g.righe[s.id] = { codici: s.parti.map(() => ''), note: s.parti.map((_, i) => pr?.note?.[i] || '') };
      }
    });
    // elenco "piatto": una voce per ogni componente
    const voci = items.flatMap((s) => s.parti.map((p, pi) => ({ s, p, pi, key: s.id + ':' + pi })));
    const fatti = () => voci.filter((v) => g.righe[v.s.id].codici[v.pi]).length;
    const sub = (v) => [v.p.dimensioni, v.pi === 0 && v.s.portata, v.pi === 0 && v.s.ubicazione, v.s.parti.length > 1 && `componente ${v.pi + 1} di ${v.s.parti.length}`].filter(Boolean).map(esc).join(' · ');
    const prima = (v) => precedente?.righe[v.s.id]?.codici[v.pi] || '';
    const bottoni = (cls) => `<div class="${cls}">${PRINCIPALI.map((k) => `<button type="button" class="cod-btn ${classeCod(k)}" data-c="${esc(k)}" title="${esc(CODICI.find((x) => x[0] === k)[1])}">${esc(k)}</button>`).join('')}
        <button type="button" class="cod-btn altro" data-altro>altro ▾</button></div>
      <div class="sg2-altri" hidden>${CODICI.filter(([k]) => !PRINCIPALI.includes(k)).map(([k, l]) => `<button type="button" class="cod-btn ${classeCod(k)}" data-c="${esc(k)}"><b>${esc(k)}</b> <small>${esc(l)}</small></button>`).join('')}</div>`;

    el.innerHTML = `
      <form class="sg form sg2-giro modo-${modoGiro}" id="fGiro" novalidate>
        ${esistente ? CONF.avvisoAltro(esistente, `Il ${slotN}° controllo ${anno} (fascetta ${slot.nome})`) : ''}
        <details class="sg2-dati" style="--c:${slot.col}">
          <summary><b>Fascetta ${slot.nome.toUpperCase()} ${anno}</b><span class="grow"></span><span>📅 <b id="sDat">${fmt(g.data).replace(/\/\d+$/, '')}</b> · 👷 <b id="sTec">${esc(g.tecnico || UT.breve(UT.attuale()))}</b> ✎</span></summary>
          <div class="due giro-dati"><label>Data<input type="date" name="data" value="${g.data}"></label></div>
          ${UT.campoTecnici((g.tecnici || []).map((t) => t.id), g.firmaDi)}
        </details>
        <div class="sg2-barra">
          <input type="search" id="gCerca" class="cerca" placeholder="🔍 Cerca n° o nome" autocomplete="off">
          <button type="button" class="btn ghost small" id="btnModo">${modoGiro === 'elenco' ? '▢ Una alla volta' : '☰ Elenco'}</button>
          ${UI.info('Tocca il giudizio di ogni sottogancio: la pagina passa da sola al prossimo. «altro» apre gli altri giudizi (S, SU, \\, NC), la matita ✎ le note. Con tanti accessori scrivi il numero nella ricerca: dopo il giudizio la ricerca si svuota e puoi scrivere subito il numero successivo. Con «Una alla volta» vedi un sottogancio per volta a tutto schermo. Quelli lasciati senza giudizio, al salvataggio, diventano NC (non controllati).')}
        </div>

        <div class="sg2-lista giro-lista">
          ${voci.map((v) => `
            <div class="sg2-gi gi-parte" data-k="${v.key}">
              <div class="h"><b class="n ${v.pi ? 'comp' : ''}">${esc(v.s.numero)}</b>
                <span class="d">${esc(v.p.denominazione)}<small>${sub(v)}${prima(v) ? ` · prima: <em class="${classeCod(prima(v))}">${esc(prima(v))}</em>` : ''}</small></span>
                <button type="button" class="pen" data-pen aria-label="Note">✎</button></div>
              ${bottoni('sg2-bt')}
              <div class="notina" data-vedi></div>
              <input class="gi-nota" data-nota placeholder="Note" value="${esc(g.righe[v.s.id].note[v.pi] || '')}" hidden>
            </div>`).join('')}
          <p class="nessuno" id="gNessuno" hidden>Nessun sottogancio trovato.</p>
        </div>

        <div class="sg2-uno card" id="uno"></div>

        <div class="card sg2-ng">
          <h2>Note generali (in fondo all'elenco)</h2>
          <textarea name="noteGenerali" rows="3" placeholder="Una riga per ogni nota (massimo 7 righe)">${esc(g.noteGenerali || '')}</textarea>
          <div class="azioni-form">
            <a class="link" href="#/sottoganci/c/${cliId}?anno=${anno}">📂 Cartella del cliente</a><span class="grow"></span>
            ${esistente && !UT.solaLettura() ? '<button type="button" class="btn danger ghost small" id="btnElimina">🗑 Elimina questo controllo</button>' : ''}
          </div>
        </div>

        <div class="sg2-piede">
          <b><span id="nFatti">0</span>/${voci.length}</b><div class="bar"><i id="gBar"></i></div>
          <button class="btn big" type="submit">Salva</button>
        </div>
      </form>`;

    const f = el.querySelector('#fGiro');
    const riga = (k) => el.querySelector(`.sg2-gi[data-k="${CSS.escape(k)}"]`);
    let corrente = 0;   // indice della voce "a cui sei arrivato" (anche per la scheda singola)
    const aggiorna = () => {
      const n = fatti(); el.querySelector('#nFatti').textContent = n;
      el.querySelector('#gBar').style.width = (voci.length ? n / voci.length * 100 : 0) + '%';
    };
    const segnaBottoni = (box, cod) => {
      box.querySelectorAll('.cod-btn[data-c]').forEach((b) => b.classList.toggle('on', b.dataset.c === cod));
      const alt = box.querySelector('[data-altro]');
      const extra = cod && !PRINCIPALI.includes(cod);
      alt.classList.toggle('on', !!extra); alt.className = 'cod-btn altro ' + (extra ? 'on ' + classeCod(cod) : '');
      alt.textContent = extra ? cod + ' ▾' : 'altro ▾';
    };
    const mostraNota = (box, testo) => { const vd = box.querySelector('[data-vedi]'); vd.textContent = testo ? '📝 ' + testo : ''; vd.hidden = !testo; };
    const evidenzia = () => el.querySelectorAll('.sg2-gi').forEach((b, i) => b.classList.toggle('ora', i === corrente));
    const setCod = (i, cod) => {
      const v = voci[i]; g.righe[v.s.id].codici[v.pi] = cod;
      const box = riga(v.key); segnaBottoni(box, cod);
      box.classList.remove('manca'); box.classList.toggle('fatto', !!cod);
      box.querySelector('.sg2-altri').hidden = true;
      aggiorna();
    };
    // il prossimo da fare (dopo i), tra quelli visibili con la ricerca
    const visibile = (i) => !riga(voci[i].key).hidden;
    const prossimo = (i) => { for (let j = i + 1; j < voci.length; j++) if (!g.righe[voci[j].s.id].codici[voci[j].pi] && visibile(j)) return j;
      for (let j = 0; j <= i; j++) if (!g.righe[voci[j].s.id].codici[voci[j].pi] && visibile(j)) return j; return -1; };

    // --- ricerca ---
    const cerca = el.querySelector('#gCerca');
    const filtra = () => {
      const t = cerca.value.trim().toLowerCase(); let k = 0;
      voci.forEach((v) => { const ok = !t || String(v.s.numero).toLowerCase() === t || testoSg(v.s).includes(t); riga(v.key).hidden = !ok; if (ok) k++; });
      el.querySelector('#gNessuno').hidden = !!k;
      if (modoGiro === 'uno') { const j = voci.findIndex((v, i) => visibile(i)); if (j >= 0) { corrente = j; disegnaUno(); } }
    };
    cerca.oninput = filtra;
    cerca.onkeydown = (e) => { if (e.key === 'Enter') e.preventDefault(); };

    const dopoGiudizio = (i) => {
      if (cerca.value) {   // con la ricerca: la svuoto, pronta per il numero successivo
        cerca.value = ''; filtra();
        if (modoGiro === 'elenco') { const j = prossimo(i); corrente = j >= 0 ? j : i; evidenzia(); riga(voci[i].key).scrollIntoView({ block: 'center' }); cerca.focus(); return; }
      }
      const j = prossimo(i);
      corrente = j >= 0 ? j : i; evidenzia();
      if (modoGiro === 'uno') return disegnaUno();
      if (j >= 0) riga(voci[j].key).scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    voci.forEach((v, i) => {
      const box = riga(v.key);
      box.querySelectorAll('.cod-btn[data-c]').forEach((b) => (b.onclick = () => {
        const nuovo = g.righe[v.s.id].codici[v.pi] === b.dataset.c ? '' : b.dataset.c;
        setCod(i, nuovo); if (nuovo) dopoGiudizio(i);
      }));
      box.querySelector('[data-altro]').onclick = () => { const a = box.querySelector('.sg2-altri'); a.hidden = !a.hidden; };
      const nota = box.querySelector('[data-nota]');
      box.querySelector('[data-pen]').onclick = () => { nota.hidden = !nota.hidden; if (!nota.hidden) nota.focus(); };
      nota.oninput = () => { g.righe[v.s.id].note[v.pi] = nota.value; mostraNota(box, nota.hidden ? nota.value : ''); };
      nota.onblur = () => { if (nota.value.trim()) { nota.hidden = true; mostraNota(box, nota.value.trim()); } };
      mostraNota(box, g.righe[v.s.id].note[v.pi]);
      if (g.righe[v.s.id].codici[v.pi]) setCod(i, g.righe[v.s.id].codici[v.pi]); else segnaBottoni(box, '');
    });
    corrente = Math.max(0, prossimo(-1)); evidenzia(); aggiorna();

    // --- una scheda alla volta ---
    const uno = el.querySelector('#uno');
    function disegnaUno() {
      if (!voci.length) { uno.innerHTML = '<p class="nessuno">Nessun sottogancio.</p>'; return; }
      const v = voci[corrente], cod = g.righe[v.s.id].codici[v.pi], nota = g.righe[v.s.id].note[v.pi] || '';
      uno.innerHTML = `
        <div class="u-pos">${corrente + 1} di ${voci.length}</div>
        <div class="u-num">${esc(v.s.numero)}</div>
        <div class="u-den">${esc(v.p.denominazione)}</div>
        <div class="u-dim">${sub(v)}</div>
        ${prima(v) ? `<div class="u-prima">l'ultima volta: <em class="${classeCod(prima(v))}">${esc(prima(v))}</em></div>` : ''}
        ${nota ? `<div class="notina">📝 ${esc(nota)}</div>` : ''}
        <span class="grow"></span>
        <div class="u-bt">${PRINCIPALI.map((k) => `<button type="button" class="cod-btn ${classeCod(k)} ${cod === k ? 'on' : ''}" data-c="${esc(k)}">${esc(k)}</button>`).join('')}</div>
        <div class="u-sotto"><button type="button" class="link" data-ualtro>${cod && !PRINCIPALI.includes(cod) ? '<b>' + esc(cod) + '</b> ▾' : 'altro giudizio ▾'}</button><button type="button" class="link" data-unota>✎ nota</button></div>
        <div class="sg2-altri" hidden>${CODICI.filter(([k]) => !PRINCIPALI.includes(k)).map(([k, l]) => `<button type="button" class="cod-btn ${classeCod(k)} ${cod === k ? 'on' : ''}" data-c="${esc(k)}"><b>${esc(k)}</b> <small>${esc(l)}</small></button>`).join('')}</div>
        <input class="gi-nota" data-unotain placeholder="Note" value="${esc(nota)}" hidden>
        <div class="u-nav"><button type="button" class="link" data-uprec>‹ precedente</button><button type="button" class="link" data-usalta>salta ›</button></div>`;
      const y = el.querySelector('.sg2-barra').getBoundingClientRect().top + window.scrollY - 70;
      if (window.scrollY > y + 5) window.scrollTo({ top: Math.max(0, y) });
      uno.querySelectorAll('.cod-btn[data-c]').forEach((b) => (b.onclick = () => {
        const nuovo = cod === b.dataset.c ? '' : b.dataset.c; setCod(corrente, nuovo);
        if (nuovo) dopoGiudizio(corrente); else disegnaUno();
      }));
      uno.querySelector('[data-ualtro]').onclick = () => { const a = uno.querySelector('.sg2-altri'); a.hidden = !a.hidden; };
      const ni = uno.querySelector('[data-unotain]');
      uno.querySelector('[data-unota]').onclick = () => { ni.hidden = !ni.hidden; if (!ni.hidden) ni.focus(); };
      ni.oninput = () => { g.righe[v.s.id].note[v.pi] = ni.value; const r = riga(v.key); r.querySelector('[data-nota]').value = ni.value; mostraNota(r, ni.value); };
      const vai = (d) => { let j = corrente; do { j += d; } while (j >= 0 && j < voci.length && !visibile(j)); if (j >= 0 && j < voci.length) { corrente = j; evidenzia(); disegnaUno(); } };
      uno.querySelector('[data-uprec]').onclick = () => vai(-1);
      uno.querySelector('[data-usalta]').onclick = () => vai(1);
    }
    el.querySelector('#btnModo').onclick = (e) => {
      modoGiro = modoGiro === 'elenco' ? 'uno' : 'elenco';
      f.classList.toggle('modo-uno', modoGiro === 'uno'); f.classList.toggle('modo-elenco', modoGiro === 'elenco');
      e.currentTarget.textContent = modoGiro === 'elenco' ? '▢ Una alla volta' : '☰ Elenco';
      if (modoGiro === 'uno') disegnaUno(); else riga(voci[corrente]?.key || '')?.scrollIntoView({ block: 'center' });
    };
    if (modoGiro === 'uno') disegnaUno();

    // data e tecnici
    const leggiTecnici = UT.collegaTecnici(el, g.firmaDi);
    const riassunto = () => { const t = leggiTecnici(); el.querySelector('#sDat').textContent = fmt(f.data.value).replace(/\/\d+$/, ''); el.querySelector('#sTec').textContent = t.tecnico || '— scegli —'; };
    el.querySelector('.sg2-dati').addEventListener('change', riassunto); el.querySelector('.sg2-dati').addEventListener('click', () => setTimeout(riassunto, 0));
    if (!esistente) riassunto();

    f.onsubmit = async (e) => {
      e.preventDefault();
      const mancanti = voci.map((v, i) => i).filter((i) => !g.righe[voci[i].s.id].codici[voci[i].pi]);
      if (mancanti.length) {
        // quello che non è stato trovato passa da solo a NC (non controllato)
        mancanti.forEach((i) => setCod(i, 'NC'));
        UI.toast(`${mancanti.length} ${mancanti.length === 1 ? 'sottogancio senza giudizio segnato' : 'sottoganci senza giudizio segnati'} NC`, '');
      }
      const t = leggiTecnici();
      if (!t.tecnici.length) { el.querySelector('.sg2-dati').open = true; window.scrollTo({ top: 0, behavior: 'smooth' }); return UI.toast('Scegli almeno un tecnico', 'err'); }
      const firma = t.firmaDi === g.firmaDi && g.firmaTecnico && esistente ? g.firmaTecnico : t.firma;
      if (!firma && !UI.conferma(`${t.firmatario} non ha ancora salvato la firma nel profilo: sull'elenco non comparirà. Salvare lo stesso?`)) return;
      voci.forEach((v) => (g.righe[v.s.id].note[v.pi] = (g.righe[v.s.id].note[v.pi] || '').trim()));
      Object.assign(g, {
        data: f.data.value || oggi(), tecnici: t.tecnici, tecnico: t.tecnico, firmaDi: t.firmaDi, noteGenerali: f.noteGenerali.value.trim(),
        firmaTecnico: firma
      });
      try { await UI.salva('giriSottoganci', g); } catch (er) { return; }
      App.ricordaTecnico(g.tecnico);
      UI.toast('Controllo salvato', 'ok');
      location.hash = '#/sottoganci/c/' + cliId + '?anno=' + anno;
    };
    el.querySelector('#btnElimina')?.addEventListener('click', async () => {
      if (!UI.conferma(`Eliminare il ${slotN}° controllo (${slot.nome}) del ${anno}?`)) return;
      await Backend.remove('giriSottoganci', g.id); location.hash = '#/sottoganci/c/' + cliId;
    });
    return { titolo: `${slotN}° controllo · ${nomeCliente(c)}`, indietro: '#/sottoganci/c/' + cliId + '?anno=' + anno, live: false };
  }


  function route(el, S, parti, query) {
    const [, a, b, cmd, x, y] = parti;
    if (!a) return cartelle(el, S);
    if (a === 'cartella-nuova') return formCartella(el, S, null);
    if (a === 'cartella') return formCartella(el, S, b);
    if (a === 's') return formSottogancio(el, S, b, null);
    if (a === 'c' && cmd === 'nuovo') return formSottogancio(el, S, null, b);
    if (a === 'c' && cmd === 'giro') return formGiro(el, S, b, +x, +y);
    if (a === 'c' && cmd === 'stampa') return SGStampa.render(el, S, b, +x);
    if (a === 'c') return cartella(el, S, b, query);
    return cartelle(el, S);
  }

  return { SLOT, CODICI, route, cartelleDi, riepilogo, elenco, slotGiri, noteDi, cliente, dataBreve, nomeCliente };
})();
