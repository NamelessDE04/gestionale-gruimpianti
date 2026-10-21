// ===== INVIO AI CLIENTI PER EMAIL (solo Master) =====
// Pagina unica: si sceglie il cliente e si spuntano schede di controllo, rapportini ed elenco sottoganci (anche insieme). L'app crea i PDF
// e lo spedisce con il Gmail del Master: al cliente arriva una mail normale dal suo indirizzo,
// e la mail resta anche nella sua cartella "Inviati".
window.INVIO = (function () {
  const { esc, uid, info, fmt, oggi } = UI;
  const TIPI = { rapportini: '🧾 Rapportini', controlli: '📋 Schede di controllo', sottoganci: '⛓️ Sottoganci' };

  // ---------- Gmail (account Google del Master) ----------
  const MAIL = (function () {
    let token = null, scade = 0, email = '';
    const carica = (src) => new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
    async function accedi(suggerito) {
      if (token && Date.now() < scade) return { token, email };
      if (!window.firebaseConfig) throw new Error('config');
      const V = '10.12.2';
      if (!window.firebase) await carica(`https://www.gstatic.com/firebasejs/${V}/firebase-app-compat.js`);
      if (!firebase.auth) await carica(`https://www.gstatic.com/firebasejs/${V}/firebase-auth-compat.js`);
      // app separata: non tocca l'accesso del dispositivo
      const app = firebase.apps.find((a) => a.name === 'posta') || firebase.initializeApp(window.firebaseConfig, 'posta');
      const p = new firebase.auth.GoogleAuthProvider();
      p.addScope('https://www.googleapis.com/auth/gmail.send');
      p.setCustomParameters(suggerito ? { login_hint: suggerito } : { prompt: 'select_account' });
      const r = await app.auth().signInWithPopup(p);
      token = r.credential && r.credential.accessToken; email = (r.user.email || '').toLowerCase(); scade = Date.now() + 50 * 60 * 1000;
      if (!token) throw new Error('token');
      return { token, email };
    }
    const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768)); return btoa(s); };
    const b64t = (t) => b64(new TextEncoder().encode(t));
    const righe = (s) => s.replace(/.{1,76}/g, '$&\r\n');
    const intest = (t) => (/^[\x20-\x7e]*$/.test(t) ? t : `=?UTF-8?B?${b64t(t)}?=`);
    async function invia({ da, nome, a, oggetto, testo, allegati }) {
      const conf = '----gruimpianti' + Date.now();
      let m = `From: ${intest(nome)} <${da}>\r\nTo: ${a.join(', ')}\r\nSubject: ${intest(oggetto)}\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="${conf}"\r\n\r\n` +
        `--${conf}\r\nContent-Type: text/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${righe(b64t(testo))}`;
      allegati.forEach((x) => { m += `--${conf}\r\nContent-Type: application/pdf; name="${x.nome}"\r\nContent-Disposition: attachment; filename="${x.nome}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${righe(b64(x.bytes))}`; });
      m += `--${conf}--`;
      // canale JSON di Gmail (risponde correttamente alle app web); il messaggio è già tutto in ASCII
      const raw = btoa(m).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      let r;
      try {
        r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw })
        });
      } catch (e) { throw new Error(navigator.onLine ? 'incerto' : 'rete'); }
      if (r.status === 401) { token = null; throw new Error('scaduto'); }
      if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error(/has not been used|disabled/i.test(t) ? 'api' : /insufficient|scope/i.test(t) ? 'permesso' : 'invio ' + r.status); }
      return r.json();
    }
    return { accedi, invia };
  })();

  // ---------- dati ----------
  const sedi = (S) => S.clienti.flatMap((c) => (c.sedi || []).map((s) => ({ c, s }))).sort((a, b) => CLI.nome(a.c).localeCompare(CLI.nome(b.c)));
  const nomeSede = (c, s) => `${CLI.nome(c)}${(c.sedi || []).length > 1 ? ' · ' + (s.sigla || s.nome || '') : ''}`;
  const indirizzi = (c) => {
    const out = [];
    if (c.email) out.push({ e: c.email, l: 'Email generale' });
    if (c.pec) out.push({ e: c.pec, l: 'PEC' });
    (c.referenti || []).filter((r) => r.email).forEach((r) => out.push({ e: r.email, l: [r.nome, r.cognome].filter(Boolean).join(' ') }));
    return out.filter((x, i, a) => a.findIndex((y) => y.e.toLowerCase() === x.e.toLowerCase()) === i);
  };
  // data dell'ultimo controllo dell'anno di un impianto (serve per raggruppare le schede)
  const ultimaData = (S, impId, anno) => {
    const sc = CTR.schedaDi(S, impId, anno);
    return Object.values(sc?.visite || {}).map((v) => v.dataScheda || '').sort().pop() || '';
  };
  const rapportiniDi = (S, sedeId, anno) => S.rapportini.filter((r) => r.sedeId === sedeId && (r.anno === anno || !r.inviatoIl))
    .sort((a, b) => (b.anno - a.anno) || (b.numero - a.numero))
    .map((r) => ({ id: r.id, senza: !r.numero, t: r.numero ? `Rapportino N° ${r.numero}/${r.anno}` : 'Rapportino (numero in arrivo)',
      sub: `${fmt((r.giorni || [])[0]?.data || r.dataConsegna)} · ${r.firmaReferente ? 'firmato' : 'da firmare'}${r.inviatoIl ? ' · ✉️ inviato il ' + fmt(r.inviatoIl.slice(0, 10)) : ''}`,
      on: !r.inviatoIl && !!r.firmaReferente && !!r.numero }));
  const schedeDi = (S, sedeId, anno) => S.impianti.filter((i) => i.sedeId === sedeId && CTR.schedaDi(S, i.id, anno))
    .sort((a, b) => String(a.numeroInterno).localeCompare(String(b.numeroInterno), 'it', { numeric: true }))
    .map((i) => { const n = Object.keys(CTR.schedaDi(S, i.id, anno).visite || {}).length, d = ultimaData(S, i.id, anno);
      return { id: i.id, data: d, t: `${i.numeroInterno ? 'N° ' + i.numeroInterno + ' · ' : ''}${IMP.titolo(i)}`, sub: `${n} ${n === 1 ? 'controllo' : 'controlli'}${d ? ' · ultimo ' + fmt(d) : ''}` }; });
  const haElenco = (S, sedeId) => S.sottoganci.some((x) => x.sedeId === sedeId);

  // testo della mail in base a cosa c'è dentro
  const testoBase = (S, p, anno) => {
    const io = UT.attuale(), firma = `\n\nCordiali saluti\n${io?.nome || ''}\nGru Impianti`;
    const rr = p.rap.map((id) => S.rapportini.find((r) => r.id === id)).filter(Boolean);
    const og = [], tx = [];
    if (p.imp.length) { og.push(`Schede di controllo ${anno}${p.data ? ' (controllo del ' + fmt(p.data) + ')' : ''}`); tx.push(`le schede di controllo degli apparecchi di sollevamento (D.Lgs. 81/08) dell'anno ${anno}${p.data ? ', controllo del ' + fmt(p.data) : ''}`); }
    if (rr.length) { og.push(rr.length === 1 ? `Rapportino N° ${rr[0].numero}/${rr[0].anno}` : `Rapportini di intervento (${rr.length})`); tx.push(rr.length === 1 ? `il rapportino di intervento N° ${rr[0].numero}/${rr[0].anno}` : 'i rapportini di intervento ' + rr.map((r) => `N° ${r.numero}/${r.anno}`).join(', ')); }
    if (p.sg) { og.push(`Elenco accessori di sollevamento ${anno}`); tx.push(`l'elenco aggiornato degli accessori di sollevamento (funi, catene, brache) dell'anno ${anno}`); }
    return { oggetto: og.join(' · '), testo: `Buongiorno,\nin allegato${tx.length > 1 ? ':\n' + tx.map((t) => '- ' + t).join(';\n') : ' ' + (tx[0] || '')}.${firma}` };
  };

  // ---------- PDF ----------
  const pulito = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  async function creaPdf(S, sedeId, anno, p) {
    const { c, s } = CTR.trovaSede(S, sedeId), nome = pulito(c ? CLI.nome(c) : 'cliente') + (s?.sigla ? '_' + pulito(s.sigla) : '');
    const out = [];
    if (p.imp.length && p.separati) {
      // un PDF per ogni scheda, col numero interno dell'impianto nel nome
      const usati = new Set();
      for (const id of p.imp) {
        const i = S.impianti.find((x) => x.id === id) || {};
        let base = `Scheda_${String(i.numeroInterno || i.matricola || IMP.titolo(i) || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9-]+/g, '_').replace(/^_+|_+$/g, '') || 'impianto'}_${anno}_${nome}`, f = base, k = 2;
        while (usati.has(f)) f = base + '_' + k++;
        usati.add(f);
        out.push({ nome: f + '.pdf', bytes: await PDFX.daStampa((el) => CTRS.render(el, S, [id], anno, '#/'), '.foglio-p', true) });
      }
    } else if (p.imp.length) out.push({ nome: `Schede_controllo_${anno}_${nome}${p.data ? '_' + p.data.split('-').reverse().join('-') : ''}.pdf`, bytes: await PDFX.daStampa((el) => CTRS.render(el, S, p.imp, anno, '#/'), '.foglio-p', true) });
    for (const id of p.rap) {
      const r = S.rapportini.find((x) => x.id === id);
      out.push({ nome: `Rapportino_${r.numero}-${r.anno}_${nome}.pdf`, bytes: await PDFX.daStampa((el) => RAP.route(el, S, ['rapportini', 'r', id], new URLSearchParams()), '.recap', true) });
    }
    if (p.sg) { const cs = SG.cliente(S, sedeId); out.push({ nome: `${pulito(cs?.titoloElenco || 'ELENCO_SOTTOGANCI')}_${anno}_${nome}.pdf`, bytes: await PDFX.daStampa((el) => SGStampa.render(el, S, sedeId, anno), '.foglio', false) }); }
    return out;
  }
  const scarica = (x) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([x.bytes], { type: 'application/pdf' })); a.download = x.nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); };
  const MAX = 18 * 1024 * 1024;   // Gmail accetta 25 MB a email, contando la codifica: sto larghi
  const peso = (al) => al.reduce((t, x) => t + x.bytes.length, 0);
  const mb = (b) => (b / 1048576).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + ' MB';

  // le email da mandare: tutto insieme, oppure una per ogni data di controllo (rapportini ed elenco vanno nella prima)
  function piano(S, st, sch) {
    const imp = sch.filter((x) => st.imp.has(x.id));
    const base = { rap: [...st.rap], sg: st.sg, separati: st.separati };
    if (st.modo !== 'date' || !imp.length) return [{ ...base, imp: imp.map((x) => x.id), data: '' }];
    const date = [...new Set(imp.map((x) => x.data))].sort();
    return date.map((d, k) => ({ separati: st.separati, rap: k ? [] : base.rap, sg: k ? false : base.sg, imp: imp.filter((x) => x.data === d).map((x) => x.id), data: d }));
  }

  // ---------- pagina ----------
  const stato = { rap: new Set(), imp: new Set(), sg: false, modo: 'una', chiave: '', separati: false };
  function pagina(el, S, query) {
    if (!UT.puoInviare()) { el.innerHTML = '<p class="nessuno">Solo il Master e Risorse Umane possono inviare i documenti ai clienti.</p>'; return { titolo: 'Invio', indietro: '#/' }; }
    const st = stato;
    if (query.get('sede')) st.sede = query.get('sede');
    if (query.get('anno')) st.anno = +query.get('anno');
    st.anno = st.anno || new Date().getFullYear();
    if (query.get('sede') || query.get('anno')) history.replaceState(null, '', '#/invio');
    const tutte = sedi(S);
    if (!tutte.some((x) => x.s.id === st.sede)) st.sede = tutte[0]?.s.id || '';
    const { c } = tutte.find((x) => x.s.id === st.sede) || {};
    const rap = st.sede ? rapportiniDi(S, st.sede, st.anno) : [], sch = st.sede ? schedeDi(S, st.sede, st.anno) : [], elenco = st.sede && haElenco(S, st.sede);
    // cambiando cliente o anno riparte la scelta proposta
    if (st.chiave !== st.sede + '|' + st.anno) {
      st.chiave = st.sede + '|' + st.anno; st.rap = new Set(rap.filter((d) => d.on).map((d) => d.id)); st.imp = new Set(); st.sg = false; st.modo = 'una'; st.testoMio = false;
    }
    const date = [...new Set(sch.map((x) => x.data))].filter(Boolean).sort();
    const ind = c ? indirizzi(c) : [];
    const io = UT.attuale(), da = io?.google || '';
    const storico = S.invii.filter((x) => x.sedeId === st.sede).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 6);
    const anni = [...new Set([new Date().getFullYear(), new Date().getFullYear() - 1, st.anno])].sort().reverse();
    const voce = (gr, d, on) => `<label class="spunta ${d.senza ? 'spenta' : ''}"><input type="checkbox" data-gr="${gr}" value="${d.id}" ${on ? 'checked' : ''} ${d.senza ? 'disabled' : ''}><span><b>${esc(d.t)}</b><small>${esc(d.sub)}</small></span></label>`;
    el.innerHTML = `
      <section class="cli invio">
        <div class="sez-head"><h1>Invia ai clienti ${info('Scegli il cliente e spunta quello che vuoi mandare: schede di controllo, rapportini ed elenco sottoganci possono partire insieme nella stessa email. L\'app crea i PDF (gli stessi della stampa) e li spedisce dalla tua casella Gmail. Se le schede sono tante puoi mandare una email per ogni data di controllo; se una email supera il limite di Gmail l\'app la divide da sola in più parti.')}</h1></div>
        <div class="card form"><div class="due">
          <label>Cliente<select id="selSede">${tutte.map(({ c, s }) => `<option value="${s.id}" ${s.id === st.sede ? 'selected' : ''}>${esc(nomeSede(c, s))}</option>`).join('')}</select></label>
          <label>Anno<select id="selAnno">${anni.map((a) => `<option ${a === st.anno ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
        </div></div>

        <div class="card">
          <div class="card-head"><h2>📋 Schede di controllo ${st.anno}</h2>${sch.length > 1 ? '<button type="button" class="link" data-tutti="imp">Tutte / nessuna</button>' : ''}</div>
          ${date.length > 1 ? `<div class="inv-date"><span class="muted small">Scegli per data di controllo:</span>${date.map((d) => { const n = sch.filter((x) => x.data === d).length, tutteOn = sch.filter((x) => x.data === d).every((x) => st.imp.has(x.id));
            return `<button type="button" class="inv-chip ${tutteOn ? 'on' : ''}" data-data="${d}">${esc(fmt(d))} <small>${n}</small></button>`; }).join('')}</div>` : ''}
          <div class="spunte inv-lista">${sch.map((d) => voce('imp', d, st.imp.has(d.id))).join('') || `<p class="muted">Nessuna scheda di controllo nel ${st.anno}.</p>`}</div>
        </div>

        <div class="card">
          <div class="card-head"><h2>🧾 Rapportini</h2>${rap.length > 1 ? '<button type="button" class="link" data-tutti="rap">Tutti / nessuno</button>' : ''}</div>
          <div class="spunte inv-lista">${rap.map((d) => voce('rap', d, st.rap.has(d.id))).join('') || '<p class="muted">Nessun rapportino da inviare.</p>'}</div>
        </div>

        ${elenco ? `<div class="card"><h2>⛓️ Elenco sottoganci</h2><div class="spunte">${voce('sg', { id: 'sg', t: `${SG.cliente(S, st.sede)?.titoloElenco || 'ELENCO SOTTOGANCI'} ${st.anno}`, sub: `${S.sottoganci.filter((x) => x.sedeId === st.sede && !x.dismesso).length} sottoganci` }, st.sg)}</div></div>` : ''}

        <div class="card" id="boxModo"></div>

        <div class="card">
          <h2>A chi inviarli</h2>
          <div class="spunte" id="dest">${ind.map((x, k) => `<label class="spunta"><input type="checkbox" value="${esc(x.e)}" ${k === 0 ? 'checked' : ''}><span><b>${esc(x.e)}</b><small>${esc(x.l)}</small></span></label>`).join('') || '<p class="muted small">Il cliente non ha indirizzi email in anagrafica: scrivine uno qui sotto.</p>'}</div>
          <label>Altri indirizzi <span class="unita">(separati da virgola)</span><input type="email" id="altri" multiple placeholder="nome@azienda.it"></label>
        </div>
        <div class="card form">
          <h2>Messaggio</h2>
          <label>Oggetto<input id="oggetto" data-libero></label>
          <label>Testo<textarea id="testo" rows="8" data-libero></textarea></label>
          <p class="muted small">Parte dalla tua casella Gmail${da ? ': <b>' + esc(da) + '</b>' : ''}. Con più email, all'oggetto e al testo si aggiunge da solo cosa c'è in ognuna.</p>
        </div>
        <div class="azioni-form barra-salva"><button type="button" class="btn ghost" id="btnAnteprima">👁 Scarica i PDF</button><span class="grow"></span><button class="btn big" id="btnInvia">📧 Invia</button></div>
        ${storico.length ? `<div class="card"><h2>Ultimi invii a questo cliente</h2>${storico.map((x) => `<p class="small">✉️ <b>${fmt(x.data.slice(0, 10))}</b> · ${esc(x.oggetto)}<br><span class="muted">a ${esc(x.a.join(', '))} · da ${esc(x.da)}</span></p>`).join('')}</div>` : ''}
      </section>`;

    const totale = () => ({ rap: [...st.rap], imp: [...st.imp], sg: st.sg });
    const vuoto = () => !st.rap.size && !st.imp.size && !st.sg;
    const disegnaModo = () => {
      const scelte = sch.filter((x) => st.imp.has(x.id)), nd = new Set(scelte.map((x) => x.data)).size;
      if (nd < 2 && st.modo === 'date') st.modo = 'una';
      const pp = piano(S, st, sch);
      el.querySelector('#boxModo').innerHTML = vuoto() ? '<h2>Come inviarli</h2><p class="muted">Spunta almeno un documento.</p>' : `
        <h2>Come inviarli</h2>
        <div class="seg"><button type="button" class="${st.modo === 'una' ? 'on' : ''}" data-modo="una">Tutto in una email</button>
          <button type="button" class="${st.modo === 'date' ? 'on' : ''}" data-modo="date" ${nd < 2 ? 'disabled' : ''}>Una email per data di controllo</button></div>
        ${scelte.length > 1 ? `<h3 class="inv-sotto">PDF delle schede</h3>
        <div class="seg"><button type="button" class="${st.separati ? '' : 'on'}" data-sep="0">Tutte in un PDF</button>
          <button type="button" class="${st.separati ? 'on' : ''}" data-sep="1">Un PDF per ogni scheda</button></div>
        ${st.separati ? '<p class="muted small">Ogni PDF ha nel nome il numero interno dell\'impianto (es. Scheda_M-C27_2026_…pdf).</p>' : ''}` : ''}
        <ol class="inv-piano">${pp.map((p) => `<li>${[p.imp.length && `${p.imp.length} ${p.imp.length === 1 ? 'scheda' : 'schede'}${p.data ? ' del ' + fmt(p.data) : ''}`, p.rap.length && `${p.rap.length} ${p.rap.length === 1 ? 'rapportino' : 'rapportini'}`, p.sg && 'elenco sottoganci'].filter(Boolean).join(' · ')}</li>`).join('')}</ol>
        <p class="muted small">${pp.length === 1 ? 'Parte 1 email.' : `Partono ${pp.length} email.`} Se una supera il limite di Gmail (circa 18 MB di allegati) viene divisa da sola in più parti.</p>`;
      el.querySelectorAll('[data-modo]').forEach((b) => (b.onclick = () => { st.modo = b.dataset.modo; disegnaModo(); testi(); }));
      el.querySelectorAll('[data-sep]').forEach((b) => (b.onclick = () => { st.separati = b.dataset.sep === '1'; disegnaModo(); }));
    };
    const testi = () => { if (st.testoMio) return; const t = testoBase(S, totale(), st.anno); el.querySelector('#oggetto').value = t.oggetto; el.querySelector('#testo').value = t.testo; };
    const aggiorna = () => { disegnaModo(); testi();
      el.querySelectorAll('[data-data]').forEach((b) => b.classList.toggle('on', sch.filter((x) => x.data === b.dataset.data).every((x) => st.imp.has(x.id)))); };
    el.querySelectorAll('input[data-gr]').forEach((x) => (x.onchange = () => {
      const g = x.dataset.gr; if (g === 'sg') st.sg = x.checked; else if (x.checked) st[g].add(x.value); else st[g].delete(x.value);
      aggiorna();
    }));
    el.querySelectorAll('[data-tutti]').forEach((b) => (b.onclick = () => {
      const g = b.dataset.tutti, bs = [...el.querySelectorAll(`input[data-gr="${g}"]:not(:disabled)`)], tutti = bs.every((x) => x.checked);
      bs.forEach((x) => { x.checked = !tutti; if (x.checked) st[g].add(x.value); else st[g].delete(x.value); }); aggiorna();
    }));
    el.querySelectorAll('[data-data]').forEach((b) => (b.onclick = () => {
      const ids = sch.filter((x) => x.data === b.dataset.data).map((x) => x.id), tutti = ids.every((id) => st.imp.has(id));
      ids.forEach((id) => { if (tutti) st.imp.delete(id); else st.imp.add(id); const cb = el.querySelector(`input[data-gr="imp"][value="${id}"]`); if (cb) cb.checked = !tutti; });
      aggiorna();
    }));
    ['#oggetto', '#testo'].forEach((q) => el.querySelector(q).addEventListener('input', () => (st.testoMio = true)));
    aggiorna();
    el.querySelector('#selSede').onchange = (e) => { st.sede = e.target.value; App.ridisegna(); };
    el.querySelector('#selAnno').onchange = (e) => { st.anno = +e.target.value; App.ridisegna(); };
    const destinatari = () => [...el.querySelectorAll('#dest input:checked')].map((x) => x.value)
      .concat(el.querySelector('#altri').value.split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean));

    // prepara le email con gli allegati; quelle troppo grandi si dividono (le schede a metà, poi i rapportini a parte)
    async function prepara(fase) {
      const coda = piano(S, st, sch), pronte = [];
      while (coda.length) {
        const p = coda.shift();
        fase(`⏳ Preparo i PDF… (${pronte.length + 1})`);
        const al = await creaPdf(S, st.sede, st.anno, p);
        if (peso(al) <= MAX) { pronte.push({ p, al }); continue; }
        if (p.imp.length > 1) { const m = Math.ceil(p.imp.length / 2); coda.unshift({ ...p, imp: p.imp.slice(0, m), diviso: true }, { ...p, imp: p.imp.slice(m), rap: [], sg: false, diviso: true }); continue; }
        if (p.imp.length && (p.rap.length || p.sg)) { coda.unshift({ ...p, rap: [], sg: false }, { ...p, imp: [], data: '' }); continue; }
        if (p.rap.length > 1) { const m = Math.ceil(p.rap.length / 2); coda.unshift({ ...p, rap: p.rap.slice(0, m) }, { ...p, imp: [], rap: p.rap.slice(m), sg: false }); continue; }
        throw new Error('grande:' + al.map((x) => x.nome).join(', ') + ' (' + mb(peso(al)) + ')');
      }
      return pronte;
    }

    const bAnte = el.querySelector('#btnAnteprima');
    bAnte.onclick = async () => {
      if (vuoto()) return UI.toast('Scegli almeno un documento', 'err');
      bAnte.disabled = true;
      try { (await prepara((t) => (bAnte.textContent = t))).forEach(({ al }) => al.forEach(scarica)); }
      catch (e) { console.error(e); UI.toast(String(e.message).startsWith('grande:') ? 'Un documento da solo è troppo grande per Gmail: ' + e.message.slice(7) : 'Non riesco a creare i PDF', 'err'); }
      bAnte.disabled = false; bAnte.textContent = '👁 Scarica i PDF';
    };
    const bInv = el.querySelector('#btnInvia');
    bInv.onclick = async () => {
      const a = destinatari();
      if (vuoto()) return UI.toast('Scegli almeno un documento', 'err');
      if (!a.length) return UI.toast('Scegli o scrivi almeno un indirizzo', 'err');
      const errato = a.find((x) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)); if (errato) return UI.toast('Indirizzo non valido: ' + errato, 'err');
      const oggetto = el.querySelector('#oggetto').value.trim(), testo = el.querySelector('#testo').value;
      const fase = (t) => (bInv.textContent = t);
      bInv.disabled = true; let fatte = 0;
      try {
        // prima il permesso di Google (deve partire subito dal tocco, altrimenti il popup viene bloccato)
        fase('🔐 Accesso a Gmail…'); const acc = await MAIL.accedi(da);
        const email = await prepara(fase), N = email.length;
        for (const [k, { p, al }] of email.entries()) {
          fase(N > 1 ? `📤 Invio ${k + 1} di ${N}…` : '📤 Invio…');
          const cosa = testoBase(S, p, st.anno).oggetto;
          const ogg = N > 1 ? `${oggetto} (${k + 1} di ${N} · ${cosa})` : oggetto;
          const txt = N > 1 ? `${testo}\n\n— Email ${k + 1} di ${N}: ${cosa}. Allegati: ${al.map((x) => x.nome).join(', ')}` : testo;
          await MAIL.invia({ da: acc.email, nome: `${io?.nome || ''} – Gru Impianti`, a, oggetto: ogg, testo: txt, allegati: al });
          fatte++;
          const ora = new Date().toISOString();
          await UI.salva('invii', { id: uid(), tipo: 'misto', tipi: [p.imp.length && 'controlli', p.rap.length && 'rapportini', p.sg && 'sottoganci'].filter(Boolean), sedeId: st.sede, clienteId: c?.id || '', anno: st.anno,
            docIds: [...p.imp, ...p.rap, ...(p.sg ? [st.sede] : [])], a, da: acc.email, oggetto: ogg, data: ora, utente: io?.id || '', allegati: al.map((x) => x.nome) });
          for (const id of p.rap) { const r = S.rapportini.find((x) => x.id === id); if (r) await UI.salva('rapportini', { ...r, inviatoIl: ora, inviatoA: a }); }
        }
        UI.toast(N > 1 ? `${N} email inviate a ${a.join(', ')}` : `Email inviata a ${a.join(', ')}`, 'ok');
        st.chiave = ''; App.ridisegna();
      } catch (e) {
        console.error(e);
        const m = String(e && (e.code || e.message) || '');
        const gia = fatte ? ` (${fatte} email erano già partite: controlla gli «Inviati» prima di rimandare)` : '';
        UI.toast((/popup-closed|cancelled/.test(m) ? 'Accesso a Gmail annullato'
          : m === 'config' ? 'Per inviare email serve il collegamento al cloud'
          : m === 'api' ? 'Su Google va attivata la «Gmail API» per questo progetto (vedi istruzioni)'
          : m === 'permesso' || m === 'token' ? 'Google non ha dato il permesso di inviare: riprova e accetta'
          : m === 'incerto' ? 'Google non ha confermato l\'invio: controlla tra gli «Inviati» di Gmail prima di rimandarla'
          : m === 'rete' ? 'Serve la connessione a internet per inviare'
          : m.startsWith('grande:') ? 'Un documento da solo è troppo grande per Gmail: ' + m.slice(7)
          : /^invio 4(13|00)/.test(m) ? 'Allegati troppo grandi per una email: scegli «Una email per data di controllo» o meno documenti' : 'Invio non riuscito (' + m + ')') + gia, 'err');
      }
      bInv.disabled = false; fase('📧 Invia');
    };
    return { titolo: 'Invia ai clienti', indietro: '#/', live: false };
  }

  return { route: (el, S, parti, query) => pagina(el, S, query) };
})();
