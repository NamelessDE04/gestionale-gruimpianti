// ===== ANAGRAFICHE DAL FILE DEI DDT (clienti e fornitori) =====
// Il file (formato «gid-anagrafiche-ddt») ha un elenco di ditte con sede legale (destinatario) e destinazioni.
// Regola concordata con Luca:
//  - ditta uguale o simile a un CLIENTE già in anagrafica (anche archiviato) → è quel cliente: va controllata a mano
//    («È lui: aggiungi» la sede legale se manca e le sedi che mancano, oppure «Non è lui» → diventa fornitore);
//  - se è tutto perfettamente uguale (stesso nome e niente da aggiungere) non succede niente;
//  - tutto il resto è un FORNITORE: entra direttamente (se c'è già un fornitore simile, va controllato anche quello).
// Le ditte da controllare restano in impostazioni/anagDaControllare finché non si decide: riquadro in home.
// Qui c'è anche lo scambio cliente ↔ fornitore (tasto nelle schede).
window.AIMP = (function () {
  const { esc, uid, info } = UI;
  const ID = 'anagDaControllare';
  const BK = 'anagBackupDdt';   // com'erano clienti e fornitori prima di «È lui: aggiungi» (per annullare tutto)

  // ---------- confronto nomi e indirizzi ----------
  const FORME = /\b(S\.?\s?R\.?\s?L\.?\s?S?\.?|S\.?\s?P\.?\s?A\.?|S\.?\s?N\.?\s?C\.?|S\.?\s?A\.?\s?S\.?|SR\s?L|SOCIO UNICO|UNIPERSONALE)(?=\s|$|[^A-Z0-9])/g;
  const chiave = (n) => String(n || '').toUpperCase().replace(/&/g, ' E ').replace(FORME, ' ').replace(/[^A-Z0-9À-Ù]+/g, ' ')
    .split(' ').filter((w) => w && !['A', 'DI', 'E', 'C', 'DEI', 'DEL'].includes(w)).join(' ');
  const compatta = (n) => chiave(n).replace(/ /g, '');
  function lev(a, b) {
    const m = a.length, n = b.length; if (!m || !n) return Math.max(m, n);
    let p = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) { const q = [i]; for (let j = 1; j <= n; j++) q[j] = Math.min(p[j] + 1, q[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = q; }
    return p[n];
  }
  // 'uguale' (stesso nome a parte S.r.l., punti e maiuscole), 'simile' oppure null
  function somiglia(a, b) {
    const ka = chiave(a), kb = chiave(b), ca = ka.replace(/ /g, ''), cb = kb.replace(/ /g, '');
    if (!ca || !cb) return null;
    if (ca === cb) return 'uguale';
    const ta = ka.split(' '), tb = kb.split(' ');
    if (ta[0] === tb[0] && ta[0].length >= 4) return 'simile';
    const [corta, lunga] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
    if (corta.some((w) => w.length >= 3) && corta.every((w) => lunga.includes(w))) return 'simile';
    if (Math.min(ca.length, cb.length) >= 4 && (ca.startsWith(cb) || cb.startsWith(ca))) return 'simile';
    if (Math.min(ca.length, cb.length) >= 5 && 1 - lev(ca, cb) / Math.max(ca.length, cb.length) >= 0.85) return 'simile';
    return null;
  }
  const via = (s) => String(s?.indirizzo || '').toUpperCase().replace(/\bC\.?\s?SO\b/g, 'CORSO').replace(/\bV\.?\s?LE\b/g, 'VIALE').replace(/\bSTR\.\s?/g, 'STRADA ')
    .replace(/[^A-Z0-9]/g, '');
  const citta = (s) => String(s?.citta || '').toUpperCase().replace(/[^A-Z]/g, '');
  const stessoPosto = (a, b) => !!via(a) && via(a) === via(b) && (!citta(a) || !citta(b) || citta(a) === citta(b) || citta(a).includes(citta(b)) || citta(b).includes(citta(a)));
  const pieno = (s) => !!(s && (s.indirizzo || s.citta));
  const testoInd = (s) => [s.indirizzo, [s.cap, s.citta].filter(Boolean).join(' ') + (s.provincia ? ` (${s.provincia})` : '')].filter((x) => x && x.trim()).join(', ');
  const sedeNuova = (s) => ({ id: uid(), nome: String(s.nome || s.citta || '').toUpperCase(), indirizzo: s.indirizzo || '', cap: s.cap || '', citta: s.citta || '', provincia: s.provincia || '' });

  // cosa manca a un cliente o fornitore esistente rispetto alla ditta del file
  function differenze(x, d, forn) {
    const esistenti = [...(x.sedi || []), ...(forn && pieno(x.sedeLegale) ? [x.sedeLegale] : [])];
    const nuove = (d.sedi || []).filter((s) => !esistenti.some((e) => stessoPosto(e, s)) && !(forn && stessoPosto(d.legale, s) && !pieno(x.sedeLegale)));
    // sede legale: solo se manca e non è già una delle sedi (allora il DDT esce uguale)
    const legale = !pieno(x.sedeLegale) && pieno(d.legale) && !(x.sedi || []).concat(forn ? [] : nuove).some((e) => stessoPosto(e, d.legale)) ? d.legale : null;
    const legaleDiversa = pieno(x.sedeLegale) && pieno(d.legale) && !stessoPosto(x.sedeLegale, d.legale) && !(x.sedi || []).some((e) => stessoPosto(e, d.legale)) ? d.legale : null;
    // sedi che forse ci sono già scritte in un altro modo (stessa città e una parola della via in comune)
    const parole = (x) => String(x?.indirizzo || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length >= 4 && !['VIA', 'CORSO', 'STRADA', 'VIALE', 'DELLA', 'DELLE', 'ZONA'].includes(w));
    const forse = (n) => esistenti.find((e) => citta(e) && citta(e) === citta(n) && parole(e).some((w) => parole(n).includes(w)));
    nuove.forEach((n) => { const f = forse(n); n._forse = f ? (f.nome || f.indirizzo || 'sede legale') : ''; });
    return { nuove, legale, legaleDiversa, niente: !nuove.length && !legale };
  }
  const fornitoreDa = (d) => ({ id: uid(), ragioneSociale: String(d.nome).toUpperCase(), sedeLegale: pieno(d.legale) ? { indirizzo: d.legale.indirizzo || '', cap: d.legale.cap || '', citta: d.legale.citta || '', provincia: d.legale.provincia || '' } : null,
    sedi: (d.sedi || []).filter((s) => !stessoPosto(s, d.legale)).map(sedeNuova), daFileDdt: true });

  // ---------- PIANO: cosa succede caricando il file ----------
  function piano(S, dati) {
    const clienti = CLI.tutti(S), fornitori = S.fornitori || [];
    const out = { fornitoriNuovi: [], proposte: [], uguali: [] };
    const giaInLista = new Set(((S.impostazioni.find((x) => x.id === ID) || {}).voci || []).map((v) => chiave(v.ditta.nome)));
    for (const d of dati.ditte || []) {
      if (!d.nome || giaInLista.has(chiave(d.nome))) continue;
      const trova = (lista) => lista.map((x) => ({ x, s: somiglia(d.nome, x.ragioneSociale) })).filter((m) => m.s).sort((a, b) => (a.s === 'uguale' ? -1 : 1) - (b.s === 'uguale' ? -1 : 1));
      const mc = trova(clienti)[0];
      if (mc) {
        const df = differenze(mc.x, d, false);
        if (mc.s === 'uguale' && df.niente) out.uguali.push({ nome: d.nome, con: mc.x.ragioneSociale, tipo: 'cliente' });
        else out.proposte.push({ id: uid(), ditta: d, tipo: 'cliente', targetId: mc.x.id, somiglianza: mc.s });
        continue;
      }
      const mf = trova(fornitori)[0] || trova(out.fornitoriNuovi)[0];
      if (mf) {
        const df = differenze(mf.x, d, true);
        if (out.fornitoriNuovi.includes(mf.x)) { df.nuove.forEach((s) => mf.x.sedi.push(sedeNuova(s))); continue; }   // stessa ditta due volte nel file
        if (mf.s === 'uguale' && df.niente) out.uguali.push({ nome: d.nome, con: mf.x.ragioneSociale, tipo: 'fornitore' });
        else out.proposte.push({ id: uid(), ditta: d, tipo: 'fornitore', targetId: mf.x.id, somiglianza: mf.s });
        continue;
      }
      out.fornitoriNuovi.push(fornitoreDa(d));
    }
    return out;
  }

  // anteprima nella pagina «Importa dati»
  function anteprima(box, S, dati) {
    const p = piano(S, dati);
    box.innerHTML = `
      <div class="imp-ris">
        <p><b>${p.fornitoriNuovi.length}</b> fornitori nuovi · <b>${p.proposte.length}</b> ditte da controllare (uguali o simili a clienti o fornitori che hai già) · <b>${p.uguali.length}</b> già presenti identiche (non tocco niente)</p>
        ${p.proposte.length ? `<p class="muted small">Quelle da controllare finiscono nel riquadro «📥 Anagrafiche da controllare» in home: per ognuna scegli tu.</p>` : ''}
        <div class="imp-lista">
          ${p.proposte.map((x) => `<div><span class="pill st-scadenza">da controllare</span> <b>${esc(x.ditta.nome)}</b> <span class="muted small">≈ ${esc(nomeTarget(S, x))}</span></div>`).join('')}
          ${p.fornitoriNuovi.map((f) => `<div><span class="pill st-ok">fornitore nuovo</span> <b>${esc(f.ragioneSociale)}</b> <span class="muted small">${esc([pieno(f.sedeLegale) ? f.sedeLegale.citta : '', ...f.sedi.map((s) => s.nome)].filter(Boolean).join(' · '))}</span></div>`).join('')}
          ${p.uguali.map((u) => `<div><span class="pill st-mai">già presente</span> <b>${esc(u.nome)}</b> <span class="muted small">= ${esc(u.con)} (${u.tipo})</span></div>`).join('')}
        </div>
        ${p.fornitoriNuovi.length || p.proposte.length ? '<div class="azioni-form"><span class="grow"></span><button class="btn big" id="btnImp">📥 Importa</button></div>' : '<p class="muted">Niente da importare: è già tutto presente.</p>'}
      </div>`;
    box.querySelector('#btnImp')?.addEventListener('click', async (ev) => {
      if (Backend.mode === 'cloud' && !navigator.onLine) return UI.toast('Serve internet', 'err');
      ev.target.disabled = true; ev.target.textContent = 'Importo…';
      if (p.fornitoriNuovi.length) await Backend.saveMany('fornitori', p.fornitoriNuovi);
      if (p.proposte.length) {
        const prima = (S.impostazioni.find((x) => x.id === ID) || {}).voci || [];
        await UI.salva('impostazioni', { id: ID, voci: [...prima, ...p.proposte] });
      }
      UT.registra('creazione', `Anagrafiche dal file DDT: ${p.fornitoriNuovi.length} fornitori nuovi, ${p.proposte.length} ditte da controllare`);
      UI.toast('Importazione completata', 'ok');
      location.hash = p.proposte.length ? '#/controlla' : '#/fornitori';
    });
  }

  // ---------- DA CONTROLLARE: riquadro in home e pagina ----------
  const voci = (S) => ((S.impostazioni.find((x) => x.id === ID) || {}).voci || []);
  const targetDi = (S, v) => (v.tipo === 'cliente' ? CLI.tutti(S) : S.fornitori || []).find((x) => x.id === v.targetId);
  const nomeTarget = (S, v) => { const t = targetDi(S, v); return t ? `${t.ragioneSociale}${t.congelato ? ' (archiviato)' : ''} · ${v.tipo}` : `(${v.tipo} non più presente)`; };

  const avvisoHome = (S) => {
    const n = voci(S).length;
    if (!n || !UT.puo('anag.controlla')) return '';
    return `<a class="avviso-m st-b-scadenza" href="#/controlla"><span class="av-ico">📥</span><span class="grow"><b>Anagrafiche da controllare: ${n} ${n === 1 ? 'ditta' : 'ditte'}</b><span>Dal file dei DDT: uguali o simili a clienti o fornitori che hai già. Decidi tu cosa tenere</span></span>›</a>`;
  };

  function pagina(el, S) {
    const lista = voci(S);
    const blocco = (titolo, legale, sedi) => `<div class="ac-col"><span class="lab">${titolo}</span>
      ${pieno(legale) ? `<p><small class="muted">Sede legale</small><br>${esc(testoInd(legale))}</p>` : '<p class="muted small">Sede legale: —</p>'}
      ${(sedi || []).length ? `<p><small class="muted">Sedi / destinazioni</small></p><ul>${sedi.map((s) => `<li>${esc([s.nome, testoInd(s)].filter(Boolean).join(' – '))}</li>`).join('')}</ul>` : '<p class="muted small">Nessuna sede</p>'}</div>`;
    el.innerHTML = `
      <section class="cli acontr">
        <div class="sez-head"><h1>Anagrafiche da controllare ${info('Ditte del file dei DDT che somigliano a un cliente o a un fornitore che hai già. Guarda le due schede affiancate e scegli: «È lui» aggiunge solo quello che manca (sede legale e sedi nuove), senza cancellare niente. «Non è lui» crea un fornitore nuovo. «Scarta» la toglie dall\'elenco senza salvare niente. Se poi ti accorgi che una ditta è un cliente e non un fornitore (o il contrario) usa il tasto nella sua scheda.')}</h1></div>
        ${lista.length ? '' : '<p class="nessuno">Tutto controllato 👍</p>'}
        ${UT.puo('anag.controlla') && !UT.solaLettura() && daAnnullare(S).n ? `<div class="card ac-annulla"><p>Non sei convinto? <b>Annulla l'importazione</b> e torni a clienti e fornitori com'erano prima di caricare il file.</p>
          <div class="azioni-form"><button type="button" class="btn ghost small danger" id="btnAnnullaImp">↩ Annulla l'importazione del file DDT</button><span class="grow"></span>
          ${lista.length ? '' : '<button type="button" class="btn small" id="btnTieni">✓ Va bene così</button>'}</div>
          <p class="muted small">«Va bene così» rende definitiva l'importazione: dopo non si può più annullare in un colpo solo.</p></div>` : ''}
        ${lista.map((v) => {
          const t = targetDi(S, v), d = v.ditta, df = t ? differenze(t, d, v.tipo === 'fornitore') : null;
          return `<div class="card ac-card" data-v="${v.id}">
            <div class="ac-testa"><b>${esc(d.nome)}</b> <span class="muted">${v.somiglianza === 'uguale' ? '=' : '≈'}</span> <b>${t ? esc(t.ragioneSociale) : '—'}</b>
              <span class="pill ${v.tipo === 'cliente' ? 'st-ok' : 'st-mai'}">${v.tipo === 'cliente' ? '🏢 cliente' : '🏭 fornitore'}${t?.congelato ? ' · 🗄 archiviato' : ''}</span></div>
            <div class="due ac-due">${blocco('📄 Nel file dei DDT', d.legale, d.sedi)}${t ? blocco(v.tipo === 'cliente' ? '🏢 Nella tua anagrafica clienti' : '🏭 Nei tuoi fornitori', t.sedeLegale, t.sedi) : '<div class="ac-col muted">Non c\'è più in anagrafica</div>'}</div>
            ${df ? `<div class="ac-diff">${df.niente ? '<span class="muted">Se è lui non c\'è niente da aggiungere.</span>' : `<b>Se è lui aggiungo</b> <span class="muted small">(togli la spunta a quello che non vuoi)</span>:<div class="ac-voci">${df.legale ? `<label class="ac-v"><input type="checkbox" data-leg checked><span>+ sede legale: ${esc(testoInd(df.legale))}</span></label>` : ''}${df.nuove.map((s, i) => `<label class="ac-v"><input type="checkbox" data-sede="${i}" ${s._forse ? '' : 'checked'}><span>+ sede ${esc(s.nome || '')}${v.tipo === 'cliente' ? ' (solo per i DDT)' : ''}: ${esc(testoInd(s))}${s._forse ? ` <em class="txt-ko">forse c'è già («${esc(s._forse)}»)</em>` : ''}</span></label>`).join('')}</div>`}
              ${df.legaleDiversa ? `<p class="muted small">⚠️ Nel file la sede legale è diversa (${esc(testoInd(df.legaleDiversa))}): quella in anagrafica non la cambio.</p>` : ''}</div>` : ''}
            <div class="azioni-form ac-az">
              <button type="button" class="btn ghost small danger" data-az="scarta">🗑 Scarta</button><span class="grow"></span>
              <button type="button" class="btn ghost small" data-az="nuovo">🏭 Non è lui: ${v.tipo === 'cliente' ? 'crealo come fornitore' : 'crea un fornitore nuovo'}</button>
              ${t ? `<button type="button" class="btn small" data-az="lui">✓ È lui${df && !df.niente ? ': aggiungi' : ''}</button>` : ''}
            </div></div>`; }).join('')}
      </section>`;
    el.querySelector('#btnAnnullaImp')?.addEventListener('click', () => annulla(S));
    el.querySelector('#btnTieni')?.addEventListener('click', async () => {
      if (!UI.conferma('Tenere tutto così? L\'importazione diventa definitiva.')) return;
      const marcati = (S.fornitori || []).filter((f) => f.daFileDdt).map((f) => { const x = { ...f }; delete x.daFileDdt; return x; });
      if (marcati.length) await Backend.saveMany('fornitori', marcati);
      for (const id of [ID, BK]) if (S.impostazioni.some((x) => x.id === id)) await Backend.remove('impostazioni', id);
      UT.registra('modifica', 'Importazione del file DDT resa definitiva');
      UI.toast('Fatto: importazione definitiva', 'ok'); location.hash = '#/fornitori';
    });
    el.querySelectorAll('.ac-card [data-az]').forEach((b) => (b.onclick = async () => {
      const v = lista.find((x) => x.id === b.closest('[data-v]').dataset.v); if (!v) return;
      b.disabled = true;
      const az = b.dataset.az;
      if (az === 'lui') {
        const t = targetDi(S, v), forn = v.tipo === 'fornitore', df = differenze(t, v.ditta, forn), card = b.closest('.ac-card');
        // solo le voci con la spunta
        df.nuove = df.nuove.filter((_, i) => card.querySelector(`[data-sede="${i}"]`)?.checked);
        if (df.legale && !card.querySelector('[data-leg]')?.checked) df.legale = null;
        df.niente = !df.nuove.length && !df.legale;
        if (!df.niente) {
          const doc = JSON.parse(JSON.stringify(t));
          doc.sedi = [...(doc.sedi || []), ...df.nuove.map((x) => (forn ? sedeNuova(x) : { ...sedeNuova(x), soloDdt: true }))];   // dal file DDT: sono destinazioni della merce
          if (df.legale) doc.sedeLegale = { indirizzo: df.legale.indirizzo || '', cap: df.legale.cap || '', citta: df.legale.citta || '', provincia: df.legale.provincia || '' };
          // copia di com'era prima (solo la prima volta), così «Annulla l'importazione» lo rimette com'era
          const bk = JSON.parse(JSON.stringify(App.dati().impostazioni.find((x) => x.id === BK) || { id: BK, clienti: {}, fornitori: {} }));
          const col = forn ? 'fornitori' : 'clienti';
          if (!bk[col][t.id]) { bk[col][t.id] = JSON.parse(JSON.stringify(t)); await UI.salva('impostazioni', bk); }
          await UI.salva(col, doc);
        }
        UT.registra('modifica', `Anagrafiche dal file DDT: ${v.ditta.nome} = ${t.ragioneSociale}${df.niente ? '' : ` (+${df.nuove.length} sedi${df.legale ? ', sede legale' : ''})`}`);
      } else if (az === 'nuovo') {
        await UI.salva('fornitori', fornitoreDa(v.ditta));
        UT.registra('creazione', `Fornitore ${v.ditta.nome} (dal file DDT)`);
      }
      await UI.salva('impostazioni', { id: ID, voci: voci(App.dati()).filter((x) => x.id !== v.id) });
      UI.toast(az === 'lui' ? 'Aggiornato' : az === 'nuovo' ? 'Fornitore creato' : 'Scartato', 'ok');
    }));
    return { titolo: 'Anagrafiche da controllare', indietro: '#/', live: true };
  }

  // ---------- ANNULLA L'IMPORTAZIONE ----------
  // toglie i fornitori nati dal file (anche quelli creati con «Non è lui»), rimette com'erano clienti e fornitori
  // modificati con «È lui: aggiungi» e svuota l'elenco da controllare. Non tocca nient'altro.
  function daAnnullare(S) {
    const bk = S.impostazioni.find((x) => x.id === BK) || { clienti: {}, fornitori: {} };
    const forn = (S.fornitori || []).filter((f) => f.daFileDdt && !bk.fornitori[f.id]);
    const conDdt = forn.filter((f) => (S.ddt || []).some((d) => d.fornitoreId === f.id));
    const rip = Object.keys(bk.clienti || {}).length + Object.keys(bk.fornitori || {}).length;
    return { forn, conDdt, bk, rip, n: forn.length + rip + voci(S).length };
  }
  async function annulla(S) {
    const a = daAnnullare(S);
    const via = a.forn.filter((f) => !a.conDdt.includes(f));
    if (!UI.conferma(`Annullare l'importazione del file DDT?\n\n• tolgo ${via.length} fornitori arrivati dal file${a.conDdt.length ? ` (ne tengo ${a.conDdt.length} perché hanno già dei DDT: ${a.conDdt.map((f) => f.ragioneSociale).join(', ')})` : ''}\n• rimetto com'erano ${a.rip} clienti/fornitori a cui avevi aggiunto sedi\n• svuoto le ${voci(S).length} ditte da controllare\n\nI clienti non vengono mai cancellati.`)) return;
    if (Backend.mode === 'cloud' && !navigator.onLine) return UI.toast('Serve internet', 'err');
    if (via.length) await Backend.removeMany('fornitori', via.map((f) => f.id));
    for (const [col, docs] of [['clienti', a.bk.clienti || {}], ['fornitori', a.bk.fornitori || {}]]) {
      for (const [id, doc] of Object.entries(docs)) if ((col === 'clienti' ? CLI.tutti(S) : S.fornitori).some((x) => x.id === id)) await UI.salva(col, doc);
    }
    for (const id of [ID, BK]) if (S.impostazioni.some((x) => x.id === id)) await Backend.remove('impostazioni', id);
    UT.registra('eliminazione', `Annullata l'importazione del file DDT: tolti ${via.length} fornitori, ripristinati ${a.rip} clienti/fornitori`);
    UI.toast('Importazione annullata', 'ok'); location.hash = '#/clienti';
  }

  // ---------- CLIENTE ↔ FORNITORE ----------
  // collegati che impediscono di far diventare fornitore un cliente (i DDT invece si spostano)
  const COLL = [['impianti', 'impianti'], ['sottoganci', 'sottoganci'], ['giriSottoganci', 'controlli sottoganci'], ['schedeControllo', 'schede di controllo'], ['rapportini', 'rapportini'],
    ['layouts', 'layout'], ['collaudi', 'collaudi'], ['attrezzi', 'pinze e magneti'], ['schedeApprofondite', 'controlli approfonditi']];
  async function aFornitore(S, c) {
    if (!UT.serve('anag.scambia')) return;
    const sedi = new Set((c.sedi || []).map((s) => s.id));
    const legati = COLL.map(([col, lab]) => [lab, (S[col] || []).filter((d) => d.clienteId === c.id || sedi.has(d.sedeId)).length]).filter((x) => x[1]);
    if (legati.length) return UI.toast(`Non si può: ha ${legati.map(([l, n]) => n + ' ' + l).join(', ')}. Un cliente con lavori fatti resta cliente (se non lavora più con voi, archivialo).`, 'err');
    const ddt = (S.ddt || []).filter((d) => d.clienteId === c.id);
    if (!UI.conferma(`Spostare ${c.ragioneSociale} tra i FORNITORI?\n\nSede legale e sedi diventano le sue destinazioni${ddt.length ? `; i suoi ${ddt.length} DDT passano con lui` : ''}. Referenti e logo non servono ai fornitori e non vengono portati.`)) return;
    const f = { id: c.id, ragioneSociale: c.ragioneSociale, piva: c.piva || '', cf: c.cf || '', telefono: c.telefono || '', email: c.email || '', pec: c.pec || '', note: c.note || '',
      sedeLegale: pieno(c.sedeLegale) ? c.sedeLegale : null, sedi: (c.sedi || []).map((s) => ({ id: s.id, nome: s.nome || '', indirizzo: s.indirizzo || '', cap: s.cap || '', citta: s.citta || '', provincia: s.provincia || '' })) };
    await UI.salva('fornitori', f);
    for (const d of ddt) await UI.salva('ddt', { ...d, clienteId: '', fornitoreId: f.id });
    await Backend.remove('clienti', c.id);
    UT.registra('modifica', `${c.ragioneSociale} spostato da cliente a fornitore`);
    UI.toast('Ora è un fornitore', 'ok'); location.hash = '#/fornitori/' + f.id;
  }
  async function aCliente(S, f) {
    if (!UT.serve('anag.scambia')) return;
    const ddt = (S.ddt || []).filter((d) => d.fornitoreId === f.id);
    if (!UI.conferma(`Spostare ${f.ragioneSociale} tra i CLIENTI?\n\nLe destinazioni diventano le sue sedi${ddt.length ? `; i suoi ${ddt.length} DDT passano con lui` : ''}.`)) return;
    const sedi = (f.sedi || []).map((s) => ({ ...s }));
    let legale = pieno(f.sedeLegale) ? { ...f.sedeLegale } : null;
    // la sede legale diventa anche una sede se non ce ne sono altre o se un DDT la usa come destinazione
    if (legale && !sedi.some((s) => stessoPosto(s, legale)) && (!sedi.length || ddt.some((d) => d.sedeId === f.id))) {
      sedi.unshift({ id: f.id, nome: String(legale.citta || 'SEDE').toUpperCase(), indirizzo: legale.indirizzo || '', cap: legale.cap || '', citta: legale.citta || '', provincia: legale.provincia || '' });
      if (sedi.length === 1) legale = null;   // un'unica sede: è già lei, la sede legale non serve
    }
    const c = { id: f.id, ragioneSociale: f.ragioneSociale, piva: f.piva || '', cf: f.cf || '', telefono: f.telefono || '', email: f.email || '', pec: f.pec || '', note: f.note || '', sedeLegale: legale, sedi, referenti: [] };
    await UI.salva('clienti', c);
    for (const d of ddt) await UI.salva('ddt', { ...d, fornitoreId: '', clienteId: c.id });
    await Backend.remove('fornitori', f.id);
    UT.registra('modifica', `${f.ragioneSociale} spostato da fornitore a cliente`);
    UI.toast('Ora è un cliente', 'ok'); location.hash = '#/clienti/' + c.id;
  }

  return { piano, anteprima, avvisoHome, pagina, daAnnullare, annulla, aFornitore, aCliente, somiglia, chiave };
})();
