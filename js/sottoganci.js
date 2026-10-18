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

  // ---------- dati ----------
  // Una "cartella" = una sede di un cliente dell'anagrafica.
  // Restituisce i dati presi DIRETTAMENTE dall'anagrafica: se cambi il nome lì, cambia anche qui e sulle stampe.
  function cliente(S, sedeId) {
    for (const c of S.clienti) {
      const sd = (c.sedi || []).find((x) => x.id === sedeId);
      if (sd) return { id: sd.id, clienteId: c.id, nome: c.nomeBreve || c.ragioneSociale, localita: sd.nome || sd.citta || '', titoloElenco: sd.titoloElenco || 'ELENCO SOTTOGANCI', sigla: sd.sigla || '', sede: sd, anagrafica: c };
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
  function cartelle(el, S) {
    const anno = annoCorrente();
    const lista = cartelleDi(S);
    el.innerHTML = `
      <section class="sg">
        <div class="sez-head">
          <h1>Cartelle clienti ${UI.info('Ogni cartella è una sede di un cliente con i suoi sottoganci. Le 4 caselle colorate sono i controlli dell\'anno (fascette blu, giallo, arancio, verde).')}</h1>
          <a class="btn fab" href="#/sottoganci/cartella-nuova"><span class="fab-piu">+</span><span class="fab-txt"> Nuova cartella</span></a>
        </div>
        ${lista.length ? '' : `<p class="nessuno">Nessuna cartella. ${S.clienti.length ? 'Creane una con «+ Nuova cartella» scegliendo la sede del cliente.' : 'Prima aggiungi i clienti e le loro sedi in <a class="link" href="#/clienti">Anagrafica clienti</a>.'}</p>`}
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
    const t = (filtroTesto[cliId] || '').toLowerCase();
    const items = elenco(S, cliId, anno).filter((s) => !t ||
      (s.numero + ' ' + s.parti.map((p) => p.denominazione + ' ' + p.dimensioni).join(' ') + ' ' + s.ubicazione + ' ' + s.portata).toLowerCase().includes(t));
    const st = statoCartella(S, cliId);

    const nAtt = S.sottoganci.filter((x) => x.sedeId === cliId && !x.dismesso).length;
    el.innerHTML = `
      <section class="sg ctr">
        <div class="card ctr-testa">
          <div class="grow">
            <h1><a class="link-anag" href="#/clienti/${c.clienteId}" title="Apri anagrafica">${esc(c.nome)} <span class="loc">${esc(c.localita || '')}</span></a> ${UI.magnete(c.sede)}
              ${UI.info('Le 4 caselle colorate sono i controlli dell\'anno (una per fascetta): tocca quella tratteggiata per iniziare il prossimo, oppure una già fatta per correggerla. Nel menu ⋯ trovi l\'elenco da stampare, l\'invio al cliente, l\'aggiunta di un sottogancio e il titolo dell\'elenco. Tocca una riga per modificare quel sottogancio.')}</h1>
            <p class="muted small">${nAtt} sottoganci · <span class="pill st-${st.k}">${esc(st.label)}</span></p>
          </div>
          <div class="anno anno-mini"><a href="#/sottoganci/c/${cliId}?anno=${anno - 1}" aria-label="Anno prima">‹</a><b>${anno}</b><a href="#/sottoganci/c/${cliId}?anno=${anno + 1}" aria-label="Anno dopo">›</a></div>
          ${UI.menu([
            !UT.solaLettura() && { t: '+ Nuovo sottogancio', href: `#/sottoganci/c/${cliId}/nuovo` },
            UT.puoInviare() && { t: `🖨️ Elenco ${anno} per il cliente`, href: `#/sottoganci/c/${cliId}/stampa/${anno}` },
            UT.puoInviare() && { t: '📧 Invia al cliente', href: `#/invio?tipo=sottoganci&sede=${cliId}&anno=${anno}&da=${encodeURIComponent('#/sottoganci/c/' + cliId)}` },
            { t: '⚙ Titolo dell\'elenco', href: `#/sottoganci/cartella/${cliId}` },
            { t: '🏢 Anagrafica cliente', href: `#/clienti/${c.clienteId}` }
          ])}
        </div>

        <div class="striscia">
          ${SLOT.map((s, i) => { const ok = sl[i], pr = prossimo === s;
            return `<a class="st-v st-sg ${ok ? 'fatto' : ''} ${pr ? 'prossimo' : ''} ${!ok && !pr ? 'vuoto' : ''}" style="--c:${s.col}"
               href="${ok || pr ? `#/sottoganci/c/${cliId}/giro/${anno}/${s.n}` : 'javascript:void(0)'}">
              <b>${s.n}° ${s.nome}</b><span>${ok ? '✓ ' + dataBreve(ok.data) : pr ? '▶ inizia' : '—'}</span></a>`; }).join('')}
        </div>
        ${prossimo ? `<a class="btn sg-inizia" href="#/sottoganci/c/${cliId}/giro/${anno}/${prossimo.n}">▶ Inizia il ${prossimo.n}° controllo · fascetta ${prossimo.nome}</a>` : ''}

        <input type="search" id="fTesto" class="cerca" placeholder="Cerca numero, denominazione, ubicazione…" value="${esc(filtroTesto[cliId] || '')}">

        <div class="tabella">
          <div class="tr th">
            <span>N°</span><span>Denominazione</span><span>Dimens.</span><span>Portata</span><span>Ubic.</span><span>N° certif.</span>
            ${SLOT.map((s, i) => `<span class="th-slot" style="--c:${s.col}">${sl[i] ? dataBreve(sl[i].data) : s.nome}</span>`).join('')}
            <span>Note</span>
          </div>
          ${items.length ? items.map((s) => {
            const note = noteDi(S, s, anno);
            return `
            <a class="tr ${s.dismesso ? 'dismesso' : ''}" href="#/sottoganci/s/${s.id}">
              <span class="num">${esc(s.numero)}</span>
              <span class="multi">${s.parti.map((p) => `<i>${esc(p.denominazione)}</i>`).join('')}</span>
              <span class="multi">${s.parti.map((p) => `<i>${esc(p.dimensioni) || '&nbsp;'}</i>`).join('')}</span>
              <span>${esc(s.portata)}</span><span>${esc(s.ubicazione)}</span><span>${esc(s.certificato)}</span>
              ${sl.map((g) => `<span class="multi cod">${s.parti.map((_, pi) => { const cod = g?.righe[s.id]?.codici[pi] || ''; return `<i><em class="${classeCod(cod)}">${esc(cod)}</em></i>`; }).join('')}</span>`).join('')}
              <span class="multi note">${s.parti.map((_, pi) => `<i>${esc(note[pi] || '')}</i>`).join('')}</span>
            </a>`; }).join('') : '<p class="nessuno">Nessun sottogancio. Aggiungi il primo con “+ Sottogancio”.</p>'}
        </div>
        <p class="legenda-app">${CODICI.map(([k, l]) => `<span><em class="${classeCod(k)}">${esc(k)}</em> ${l}</span>`).join('')}</p>
      </section>`;

    const ft = el.querySelector('#fTesto');
    ft.oninput = () => {
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
      .map((sd) => ({ id: sd.id, label: `${cl.nomeBreve || cl.ragioneSociale} – ${sd.nome || sd.citta}` })))
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
    const totale = () => items.reduce((n, s) => n + s.parti.length, 0);
    const fatti = () => items.reduce((n, s) => n + g.righe[s.id].codici.filter(Boolean).length, 0);

    el.innerHTML = `
      <form class="sg form" id="fGiro" novalidate>
        ${esistente ? CONF.avvisoAltro(esistente, `Il ${slotN}° controllo ${anno} (fascetta ${slot.nome})`) : ''}
        <div class="vis-testa sg-testa" style="--c:${slot.col}">
          <div class="grow"><b>${slotN}° controllo ${anno} · fascetta ${slot.nome}</b>
            <div class="vis-imp">${esc(c.nome)} ${esc(c.localita || '')} · ${precedente ? `prima: ${dataBreve(precedente.data)} (${SLOT[precedente.slot - 1].nome}${precedente.anno !== anno ? ' ' + precedente.anno : ''})` : 'primo controllo'}</div></div>
          ${UI.menu([
            { t: '✓ Righe mancanti = B (buono)', id: 'btnTutteB' },
            esistente && !UT.solaLettura() && { t: '🗑 Elimina questo controllo', id: 'btnElimina', cls: 'txt-ko' },
            { t: '📂 Cartella del cliente', href: `#/sottoganci/c/${cliId}?anno=${anno}` }
          ])}
        </div>
        <details class="card dati-vis">
          <summary><span>📅 <b id="sDat">${fmt(g.data)}</b></span><span>👷 <b id="sTec">${esc(g.tecnico || UT.breve(UT.attuale()))}</b></span><span class="link">modifica</span></summary>
          <div class="due giro-dati"><label>Data<input type="date" name="data" value="${g.data}"></label></div>
          ${UT.campoTecnici((g.tecnici || []).map((t) => t.id), g.firmaDi)}
        </details>

        <div class="giro-tools vis-tools">
          ${precedente ? '<button type="button" class="btn ghost small" data-copia>↺ Copia precedente</button>' : ''}
          <span class="grow"></span>
          <span class="progress"><b id="nFatti">0</b>/${totale()}</span>
          ${UI.info('Tocca la sigla dello stato per ogni riga (toccala di nuovo per toglierla). «Copia precedente» riporta gli stati del controllo prima: poi cambi solo quelli diversi. Le note sono già ricopiate dal controllo precedente. Nel menu ⋯ puoi segnare B su tutte le righe mancanti. Le righe lasciate vuote, al salvataggio, diventano NC.')}
        </div>

        <div class="giro-lista">
          ${items.map((s) => `
            <div class="giro-item" data-id="${s.id}">
              <div class="gi-head"><b class="num">${esc(s.numero)}</b>
                <span>${esc(s.parti[0].denominazione)}${s.parti.length > 1 ? ` <small class="muted">+${s.parti.length - 1} comp.</small>` : ''}</span>
                <span class="muted small">${esc(s.parti[0].dimensioni)} ${s.portata ? '· ' + esc(s.portata) : ''} ${s.ubicazione ? '· ' + esc(s.ubicazione) : ''}</span></div>
              ${s.parti.map((p, pi) => {
                const prima = precedente?.righe[s.id]?.codici[pi];
                return `
                <div class="gi-parte" data-p="${pi}">
                  ${s.parti.length > 1 ? `<div class="gi-comp">${esc(p.denominazione)} <span class="muted">${esc(p.dimensioni)}</span></div>` : ''}
                  <div class="gi-row">
                    <div class="codici">${CODICI.map(([k, l]) => `<button type="button" class="cod-btn ${classeCod(k)}" data-c="${esc(k)}" title="${l}">${esc(k)}</button>`).join('')}</div>
                    ${prima ? `<span class="prima">prima: <em class="${classeCod(prima)}">${esc(prima)}</em></span>` : ''}
                  </div>
                  <input class="gi-nota" data-nota placeholder="Note" value="${esc(g.righe[s.id].note[pi] || '')}">
                </div>`; }).join('')}
            </div>`).join('')}
        </div>

        <div class="card">
          <h2>Note generali (in fondo all'elenco)</h2>
          <textarea name="noteGenerali" rows="3" placeholder="Una riga per ogni nota (massimo 7 righe)">${esc(g.noteGenerali || '')}</textarea>
        </div>


        <div class="azioni-form sticky">
          <a class="btn ghost" href="#/sottoganci/c/${cliId}?anno=${anno}">Annulla</a>
          <span class="grow"></span>
          <button class="btn big" type="submit">Salva controllo</button>
        </div>
      </form>`;

    const f = el.querySelector('#fGiro');
    const aggiorna = () => (el.querySelector('#nFatti').textContent = fatti());
    const setCod = (sid, pi, cod) => {
      g.righe[sid].codici[pi] = cod;
      const box = el.querySelector(`.giro-item[data-id="${sid}"] .gi-parte[data-p="${pi}"]`);
      box.querySelectorAll('.cod-btn').forEach((b) => b.classList.toggle('on', b.dataset.c === cod));
      box.classList.remove('manca'); box.classList.toggle('fatto', !!cod);
      aggiorna();
    };
    items.forEach((s) => s.parti.forEach((_, pi) => {
      const box = el.querySelector(`.giro-item[data-id="${s.id}"] .gi-parte[data-p="${pi}"]`);
      box.querySelectorAll('.cod-btn').forEach((b) => (b.onclick = () => setCod(s.id, pi, g.righe[s.id].codici[pi] === b.dataset.c ? '' : b.dataset.c)));
      if (g.righe[s.id].codici[pi]) setCod(s.id, pi, g.righe[s.id].codici[pi]);
    }));
    aggiorna();
    const copia = () => { let k = 0; items.forEach((s) => s.parti.forEach((_, pi) => {
      const pr = precedente.righe[s.id]?.codici[pi];
      if (pr && !g.righe[s.id].codici[pi]) { setCod(s.id, pi, pr); k++; }
    })); UI.toast(k ? `Copiati ${k} esiti` : 'Niente da copiare', k ? 'ok' : ''); };
    el.querySelector('[data-copia]')?.addEventListener('click', copia);
    el.querySelector('#btnTutteB').onclick = () => items.forEach((s) => s.parti.forEach((_, pi) => { if (!g.righe[s.id].codici[pi]) setCod(s.id, pi, 'B'); }));

    // firma (se il controllo esisteva già, mostro la firma salvata)
    const leggiTecnici = UT.collegaTecnici(el, g.firmaDi);
    const riassunto = () => { const t = leggiTecnici(); el.querySelector('#sDat').textContent = fmt(f.data.value); el.querySelector('#sTec').textContent = t.tecnico || '— scegli —'; };
    el.querySelector('.dati-vis').addEventListener('change', riassunto); el.querySelector('.dati-vis').addEventListener('click', () => setTimeout(riassunto, 0));
    if (!esistente) riassunto();

    f.onsubmit = async (e) => {
      e.preventDefault();
      const mancanti = [];
      items.forEach((s) => s.parti.forEach((_, pi) => { if (!g.righe[s.id].codici[pi]) mancanti.push(el.querySelector(`.giro-item[data-id="${s.id}"] .gi-parte[data-p="${pi}"]`)); }));
      if (mancanti.length) {
        mancanti.forEach((b) => b.classList.add('manca'));
        mancanti[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (!UI.conferma(`${mancanti.length} righe senza esito. Segnarle come NC (non controllate) e salvare?`)) return;
        items.forEach((s) => s.parti.forEach((_, pi) => { if (!g.righe[s.id].codici[pi]) g.righe[s.id].codici[pi] = 'NC'; }));
      }
      const t = leggiTecnici();
      if (!t.tecnici.length) { el.querySelector('.dati-vis').open = true; return UI.toast('Scegli almeno un tecnico', 'err'); }
      const firma = t.firmaDi === g.firmaDi && g.firmaTecnico && esistente ? g.firmaTecnico : t.firma;
      if (!firma && !UI.conferma(`${t.firmatario} non ha ancora salvato la firma nel profilo: sull'elenco non comparirà. Salvare lo stesso?`)) return;
      items.forEach((s) => el.querySelectorAll(`.giro-item[data-id="${s.id}"] [data-nota]`).forEach((n, pi) => (g.righe[s.id].note[pi] = n.value.trim())));
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
    return { titolo: `${slotN}° controllo · ${nomeCliente(c)}`, indietro: '#/sottoganci/c/' + cliId, live: false };
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
