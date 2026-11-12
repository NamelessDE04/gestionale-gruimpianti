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
      if (Backend.test) { await new Promise((ok) => setTimeout(ok, 400)); UI.toast('🧪 Modalità test: email NON inviata davvero', 'ok'); return { id: 'test' }; }
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
  const sedi = (S) => S.clienti.flatMap((c) => CLI.sediDi(c).map((s) => ({ c, s }))).sort((a, b) => CLI.nome(a.c).localeCompare(CLI.nome(b.c)));
  const nomeSede = (c, s) => `${CLI.nome(c)}${CLI.sediDi(c).length > 1 ? ' · ' + (s.sigla || s.nome || '') : ''}`;
  const indirizzi = (c) => {
    const out = [];
    if (c.email) out.push({ e: c.email, l: 'Email generale' });
    if (c.pec) out.push({ e: c.pec, l: 'PEC' });
    (c.altreEmail || []).forEach((x) => out.push({ e: x.e, l: x.l || 'Altra email' }));
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
  // DDT: di un cliente (tutte le sue sedi, anche quelle «solo DDT») o di un fornitore; quelli già inviati solo nell'anno scelto
  const eFornitore = (S, id) => (S.fornitori || []).some((f) => f.id === id);
  const ddtDi = (S, c, anno) => !c || !UT.puo('sez.ddt') ? [] : (S.ddt || []).filter((d) => (eFornitore(S, c.id) ? d.fornitoreId === c.id : d.clienteId === c.id) && (+d.anno === +anno || !d.inviatoIl))
    .sort((a, b) => (b.anno - a.anno) || (b.numero - a.numero))
    .map((d) => { const s = (c.sedi || []).find((x) => x.id === d.sedeId);
      return { id: d.id, t: `DDT N° ${DDT.numeroDi(d)}`, sub: `${fmt(d.data)} · copia cliente, senza prezzi · ${d.firmaDestinatario ? 'firmato' : 'da firmare'}${s?.nome ? ' · ' + s.nome : ''}${d.inviatoIl ? ' · ✉️ inviato il ' + fmt(d.inviatoIl.slice(0, 10)) : ''}`,
        on: !d.inviatoIl && !!d.firmaDestinatario }; });
  // schede di controllo fatte per GHO (modello GHO): si mandano a GHO ELIGIO (il cliente in anagrafica, se c'è)
  const GHO_ID = 'gho-schede';
  const clienteGho = (S) => CLI.tutti(S).find((x) => /\bGHO\b/i.test(x.ragioneSociale || '')) || { id: GHO_ID, ragioneSociale: 'GHO ELIGIO', email: 'info@ghoeligio.it', sedi: [], referenti: [] };
  const ghoDi = (S, anno) => !window.GHOS ? [] : GHOS.controlli(S).filter((c) => +c.anno === +anno || !c.inviatoIl).map((c) => {
    const i = GHOS.gru(S).find((x) => x.id === c.gruId) || {};
    return { id: c.id, t: `${i.ghoCliente?.nome || 'Gru'} · ${fmt(c.data)}`, sub: `${GHOS.titoloCtr(c)}${i.matricola ? ' · matr. ' + i.matricola : ''}${c.firma ? '' : ' · da firmare'}${c.inviatoIl ? ' · ✉️ inviata il ' + fmt(c.inviatoIl.slice(0, 10)) : ''}`, on: !c.inviatoIl && !!c.firma };
  });
  const haElenco = (S, sedeId) => S.sottoganci.some((x) => x.sedeId === sedeId);

  // testo della mail in base a cosa c'è dentro
  const testoBase = (S, p, anno) => {
    const io = UT.attuale(), firma = `\n\nCordiali saluti\n${io?.nome || ''}\nGru Impianti`;
    const rr = p.rap.map((id) => S.rapportini.find((r) => r.id === id)).filter(Boolean);
    const og = [], tx = [];
    if (p.imp.length) { og.push(`Schede di controllo ${anno}${p.data ? ' (controllo del ' + fmt(p.data) + ')' : ''}`); tx.push(`le schede di controllo degli apparecchi di sollevamento (D.Lgs. 81/08) dell'anno ${anno}${p.data ? ', controllo del ' + fmt(p.data) : ''}`); }
    if (rr.length) { og.push(rr.length === 1 ? `Rapportino N° ${rr[0].numero}/${rr[0].anno}` : `Rapportini di intervento (${rr.length})`); tx.push(rr.length === 1 ? `il rapportino di intervento N° ${rr[0].numero}/${rr[0].anno}` : 'i rapportini di intervento ' + rr.map((r) => `N° ${r.numero}/${r.anno}`).join(', ')); }
    const gg = (p.gho || []).map((id) => (S.ghoControlli || []).find((d) => d.id === id)).filter(Boolean);
    if (gg.length) {
      const nomi = [...new Set(gg.map((c) => (GHOS.gru(S).find((x) => x.id === c.gruId) || {}).ghoCliente?.nome).filter(Boolean))];
      og.push(gg.length === 1 ? `Scheda di controllo gru ${nomi[0] || ''} del ${fmt(gg[0].data)}` : `Schede di controllo gru (${gg.length})`);
      tx.push(gg.length === 1 ? `la scheda di controllo della gru presso ${nomi[0] || 'il vostro cliente'} (controllo del ${fmt(gg[0].data)})` : `le schede di controllo delle gru presso ${nomi.join(', ')}`);
    }
    const dd = (p.ddt || []).map((id) => (S.ddt || []).find((d) => d.id === id)).filter(Boolean);
    if (dd.length) { og.push(dd.length === 1 ? `DDT N° ${DDT.numeroDi(dd[0])}` : `Documenti di trasporto (${dd.length})`); tx.push(dd.length === 1 ? `il documento di trasporto N° ${DDT.numeroDi(dd[0])}` : 'i documenti di trasporto ' + dd.map((d) => 'N° ' + DDT.numeroDi(d)).join(', ')); }
    if (p.sg) { og.push(`Elenco accessori di sollevamento ${anno}`); tx.push(`l'elenco aggiornato degli accessori di sollevamento (funi, catene, brache) dell'anno ${anno}`); }
    return { oggetto: og.join(' · '), testo: `Buongiorno,\nin allegato${tx.length > 1 ? ':\n' + tx.map((t) => '- ' + t).join(';\n') : ' ' + (tx[0] || '')}.${firma}` };
  };

  // ---------- PDF ----------
  const pulito = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  async function creaPdf(S, sedeId, anno, p) {
    let { c, s } = CTR.trovaSede(S, sedeId);
    if (!c) c = (S.fornitori || []).find((f) => f.id === sedeId);   // fornitore (solo DDT)
    if (sedeId === GHO_ID) c = { ragioneSociale: 'GHO' };
    const nome = pulito(c ? CLI.nome(c) : 'cliente') + (s?.sigla ? '_' + pulito(s.sigla) : '');
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
    for (const id of p.gho || []) {
      const c = (S.ghoControlli || []).find((x) => x.id === id), i = GHOS.gru(S).find((x) => x.id === c?.gruId);
      if (c && i) out.push({ nome: GHOS.nomeFile(i, c), bytes: await PDFX.daStampa((el) => GHOS.disegnaFoglio(el, S, id), '.ghs-pag', true) });
    }
    for (const id of p.ddt || []) {
      const d = (S.ddt || []).find((x) => x.id === id);
      out.push({ nome: `DDT_${pulito(DDT.numeroDi(d)).replace(/_/g, '-')}_${nome}.pdf`, bytes: await PDFX.daStampa((el) => DDT.route(el, S, ['rapportini', 'ddt', id], new URLSearchParams()), '.ddt-pag', true) });
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
    const base = { rap: [...st.rap], ddt: [...st.ddt], gho: [...st.gho], sg: st.sg, separati: st.separati };
    if (st.modo !== 'date' || !imp.length) return [{ ...base, imp: imp.map((x) => x.id), data: '' }];
    const date = [...new Set(imp.map((x) => x.data))].sort();
    return date.map((d, k) => ({ separati: st.separati, rap: k ? [] : base.rap, ddt: k ? [] : base.ddt, gho: k ? [] : base.gho, sg: k ? false : base.sg, imp: imp.filter((x) => x.data === d).map((x) => x.id), data: d }));
  }

  // ---------- STAMPA E PDF: mese per mese, per cliente e stabilimento ----------
  const MESI_N = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const arch = { sel: new Set(), sg: false, modo: 'tutto', chiave: '' };
  const schiacciaData = (d) => (d ? d.split('-').reverse().join('-') : '');
  // documenti di una sede nell'anno: una riga per ogni controllo fatto (scheda + data) e per ogni rapportino
  function docsArchivio(S, sedeId, anno) {
    const out = [];
    S.impianti.filter((i) => i.sedeId === sedeId).forEach((i) => {
      const sc = CTR.schedaDi(S, i.id, anno); if (!sc) return;
      Object.entries(sc.visite || {}).forEach(([n, v]) => { const d = v.dataScheda || ''; if (!d) return;
        out.push({ k: `imp|${i.id}|${n}`, tipo: 'imp', id: i.id, data: d, ord: String(i.numeroInterno || '~'), t: `Scheda ${i.numeroInterno ? 'N° ' + i.numeroInterno + ' · ' : ''}${IMP.titolo(i)}`, sub: `${n}° controllo del ${fmt(d)}${v.inCorso ? ' · ⏸ in corso' : ''}` }); });
    });
    S.rapportini.filter((r) => r.sedeId === sedeId && r.anno === anno && r.numero).forEach((r) => {
      const d = (r.giorni || [])[0]?.data || r.dataConsegna || '';
      out.push({ k: `rap|${r.id}`, tipo: 'rap', id: r.id, data: d, ord: String(r.numero).padStart(6, '0'), t: `Rapportino N° ${r.numero}/${r.anno}`, sub: `${fmt(d)} · ${r.firmaReferente ? 'firmato' : 'da firmare'}` });
    });
    return out.sort((a, b) => a.data.localeCompare(b.data) || a.tipo.localeCompare(b.tipo) || a.ord.localeCompare(b.ord, 'it', { numeric: true }));
  }
  // pagine di un gruppo di documenti (schede di un gruppo unite nello stesso foglio annuale)
  async function pagineDi(S, sedeId, anno, g) {
    const pag = [];
    if (g.imp.length) pag.push(...await PDFX.pagine((el) => CTRS.render(el, S, g.imp, anno, '#/'), '.foglio-p', true));
    for (const id of g.rap) pag.push(...await PDFX.pagine((el) => RAP.route(el, S, ['rapportini', 'r', id], new URLSearchParams()), '.recap', true));
    if (g.sg) pag.push(...await PDFX.pagine((el) => SGStampa.render(el, S, sedeId, anno), '.foglio', false));
    return pag;
  }
  function paginaPdf(el, S, st, tutte, c) {
    const a = arch, docs = st.sede ? docsArchivio(S, st.sede, st.anno) : [], elenco = st.sede && haElenco(S, st.sede);
    if (a.chiave !== st.sede + '|' + st.anno) { a.chiave = st.sede + '|' + st.anno; a.sel = new Set(); a.sg = false; }
    const anni = [...new Set([new Date().getFullYear(), new Date().getFullYear() - 1, st.anno])].sort().reverse();
    const mesi = [...new Set(docs.map((d) => +d.data.slice(5, 7)))].filter(Boolean).sort((x, y) => y - x);
    const { s } = tutte.find((x) => x.s.id === st.sede) || {};
    const nomeF = pulito(c ? CLI.nome(c) : 'cliente') + (s?.sigla ? '_' + pulito(s.sigla) : '');
    el.innerHTML = `
      <section class="cli invio">
        <div class="sez-head"><h1>Invia e archivia</h1></div>
        ${segVista(st)}
        <div class="card form"><div class="due">
          <label>Cliente e stabilimento<select id="selSede">${tutte.map(({ c, s }) => `<option value="${s.id}" ${s.id === st.sede ? 'selected' : ''}>${esc(nomeSede(c, s))}</option>`).join('')}</select></label>
          <label>Anno<select id="selAnno">${anni.map((x) => `<option ${x === st.anno ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        </div></div>
        ${mesi.map((m) => { const dm = docs.filter((d) => +d.data.slice(5, 7) === m), tutti = dm.every((d) => a.sel.has(d.k));
          return `<div class="card arch-mese"><div class="card-head"><h2>${MESI_N[m - 1]} ${st.anno} <span class="muted small">· ${dm.length}</span></h2><button type="button" class="link" data-mese="${m}">${tutti ? 'Nessuno' : 'Tutto il mese'}</button></div>
            <div class="spunte inv-lista">${dm.map((d) => `<label class="spunta"><input type="checkbox" data-k="${esc(d.k)}" ${a.sel.has(d.k) ? 'checked' : ''}><span><b>${d.tipo === 'rap' ? '🧾' : '📋'} ${esc(d.t)}</b><small>${esc(d.sub)}</small></span></label>`).join('')}</div></div>`; }).join('') || `<div class="card"><p class="muted">Nessuna scheda o rapportino nel ${st.anno} per questo stabilimento.</p></div>`}
        ${elenco ? `<div class="card"><h2>⛓️ Elenco sottoganci</h2><div class="spunte"><label class="spunta"><input type="checkbox" id="chkSg" ${a.sg ? 'checked' : ''}><span><b>${esc(SG.cliente(S, st.sede)?.titoloElenco || 'ELENCO SOTTOGANCI')} ${st.anno}</b><small>${S.sottoganci.filter((x) => x.sedeId === st.sede && !x.dismesso).length} sottoganci</small></span></label></div></div>` : ''}
        <div class="card"><h2>Come archiviarli</h2>
          <div class="seg arch-modo"><button type="button" data-am="tutto" class="${a.modo === 'tutto' ? 'on' : ''}">Tutto in un PDF</button><button type="button" data-am="date" class="${a.modo === 'date' ? 'on' : ''}">Un PDF per data di controllo</button><button type="button" data-am="uno" class="${a.modo === 'uno' ? 'on' : ''}">Un PDF per documento</button></div>
          <p class="muted small" id="archRiep"></p></div>
        <div class="azioni-form barra-salva"><button type="button" class="btn ghost" id="btnStampaA">🖨️ Stampa</button><span class="grow"></span><button class="btn big" id="btnSalvaA">💾 Salva i PDF</button></div>
      </section>`;
    const scelti = () => docs.filter((d) => a.sel.has(d.k));
    // gruppi = i PDF da creare
    const gruppi = (modo) => {
      const L = scelti(), out = [];
      const gr = (lista) => ({ imp: [...new Set(lista.filter((d) => d.tipo === 'imp').map((d) => d.id))], rap: lista.filter((d) => d.tipo === 'rap').map((d) => d.id), sg: false });
      if (modo === 'uno') {
        [...new Set(L.filter((d) => d.tipo === 'imp').map((d) => d.id))].forEach((id) => { const i = S.impianti.find((x) => x.id === id) || {}; out.push({ imp: [id], rap: [], sg: false, nome: `Scheda_${pulito(i.numeroInterno || i.matricola || IMP.titolo(i))}_${st.anno}_${nomeF}.pdf` }); });
        L.filter((d) => d.tipo === 'rap').forEach((d) => { const r = S.rapportini.find((x) => x.id === d.id); out.push({ imp: [], rap: [d.id], sg: false, nome: `Rapportino_${r.numero}-${r.anno}_${nomeF}.pdf` }); });
      } else if (modo === 'date') {
        [...new Set(L.map((d) => d.data))].sort().forEach((dt) => out.push({ ...gr(L.filter((d) => d.data === dt)), nome: `Documenti_${nomeF}_${schiacciaData(dt)}.pdf` }));
      } else if (L.length) out.push({ ...gr(L), nome: `Documenti_${nomeF}_${st.anno}.pdf` });
      if (a.sg) { if (modo === 'tutto' && out.length) out[0].sg = true; else out.push({ imp: [], rap: [], sg: true, nome: `${pulito(SG.cliente(S, st.sede)?.titoloElenco || 'ELENCO_SOTTOGANCI')}_${st.anno}_${nomeF}.pdf` }); }
      return out;
    };
    const riep = () => { const g = gruppi(a.modo), n = scelti().length + (a.sg ? 1 : 0);
      el.querySelector('#archRiep').textContent = n ? `${n} ${n === 1 ? 'documento scelto' : 'documenti scelti'} → ${g.length} PDF${a.modo === 'date' ? ' (uno per ogni data)' : ''}. «Stampa» li mette tutti in un unico PDF da stampare.` : 'Spunta almeno un documento.';
      el.querySelectorAll('[data-mese]').forEach((b) => { const dm = docs.filter((d) => +d.data.slice(5, 7) === +b.dataset.mese); b.textContent = dm.every((d) => a.sel.has(d.k)) ? 'Nessuno' : 'Tutto il mese'; }); };
    el.querySelectorAll('[data-k]').forEach((x) => (x.onchange = () => { if (x.checked) a.sel.add(x.dataset.k); else a.sel.delete(x.dataset.k); riep(); }));
    el.querySelectorAll('[data-mese]').forEach((b) => (b.onclick = () => {
      const dm = docs.filter((d) => +d.data.slice(5, 7) === +b.dataset.mese), tutti = dm.every((d) => a.sel.has(d.k));
      dm.forEach((d) => { if (tutti) a.sel.delete(d.k); else a.sel.add(d.k); const cb = el.querySelector(`[data-k="${CSS.escape(d.k)}"]`); if (cb) cb.checked = !tutti; }); riep();
    }));
    el.querySelector('#chkSg')?.addEventListener('change', (e) => { a.sg = e.target.checked; riep(); });
    el.querySelectorAll('[data-am]').forEach((b) => (b.onclick = () => { a.modo = b.dataset.am; el.querySelectorAll('[data-am]').forEach((x) => x.classList.toggle('on', x === b)); riep(); }));
    el.querySelector('#selSede').onchange = (e) => { st.sede = e.target.value; App.ridisegna(); };
    el.querySelector('#selAnno').onchange = (e) => { st.anno = +e.target.value; App.ridisegna(); };
    el.querySelectorAll('[data-vista]').forEach((b) => (b.onclick = () => { st.vista = b.dataset.vista; App.ridisegna(); }));
    riep();
    const lavora = async (btn, testo, fn) => {
      if (!scelti().length && !a.sg) return UI.toast('Spunta almeno un documento', 'err');
      btn.disabled = true;
      try { await fn((t) => (btn.textContent = t)); } catch (e) { console.error(e); UI.toast('Non riesco a creare i PDF', 'err'); }
      btn.disabled = false; btn.textContent = testo;
    };
    const bS = el.querySelector('#btnSalvaA');
    bS.onclick = () => lavora(bS, '💾 Salva i PDF', async (fase) => {
      const g = gruppi(a.modo);
      for (const [k, x] of g.entries()) { fase(`⏳ PDF ${k + 1} di ${g.length}…`); scarica({ nome: x.nome, bytes: PDFX.pdf(await pagineDi(S, st.sede, st.anno, x), true) }); }
      UT.registra('stampa', `${g.length} PDF salvati · ${c ? CLI.nome(c) : ''} ${st.anno}`);
      UI.toast(g.length === 1 ? 'PDF salvato' : `${g.length} PDF salvati`, 'ok');
    });
    const bP = el.querySelector('#btnStampaA');
    bP.onclick = () => lavora(bP, '🖨️ Stampa', async (fase) => {
      // per stampare: un PDF unico con tutto, aperto in una finestra nuova
      const win = window.open('', '_blank');
      fase('⏳ Preparo la stampa…');
      const pag = [];
      for (const x of gruppi('date')) pag.push(...await pagineDi(S, st.sede, st.anno, x));
      const url = URL.createObjectURL(new Blob([PDFX.pdf(pag, true)], { type: 'application/pdf' }));
      if (win) win.location = url; else scarica({ nome: `Stampa_${nomeF}_${st.anno}.pdf`, bytes: PDFX.pdf(pag, true) });
      UT.registra('stampa', `Stampa documenti · ${c ? CLI.nome(c) : ''} ${st.anno}`);
    });
    return { titolo: 'Invia e archivia · PDF', indietro: '#/', live: false };
  }
  const segVista = (st) => `<div class="seg inv-vista"><button type="button" data-vista="invio" class="${st.vista !== 'pdf' ? 'on' : ''}">📧 Invia per email</button><button type="button" data-vista="pdf" class="${st.vista === 'pdf' ? 'on' : ''}">🖨️ Stampa e PDF</button></div>`;

  // ---------- pagina ----------
  const stato = { rap: new Set(), imp: new Set(), ddt: new Set(), gho: new Set(), sg: false, modo: 'una', chiave: '', separati: false, vista: 'invio' };
  function pagina(el, S, query) {
    if (!UT.puo('invio')) { el.innerHTML = '<p class="nessuno">Invia e archivia non è abilitato per te.</p>'; return { titolo: 'Invio', indietro: '#/' }; }
    const st = stato;
    if (query.get('vista')) st.vista = query.get('vista');
    if (query.get('sede')) st.sede = query.get('sede');
    if (query.get('gho')) st.sede = GHO_ID;
    if (query.get('anno')) st.anno = +query.get('anno');
    st.anno = st.anno || new Date().getFullYear();
    if (query.get('sede') || query.get('anno') || query.get('gho')) history.replaceState(null, '', '#/invio');
    const soloClienti = sedi(S);
    // per l'invio dei DDT nell'elenco ci sono anche i fornitori (solo DDT, niente schede o rapportini)
    const forn = UT.puo('sez.ddt') ? [...(S.fornitori || [])].sort((a, b) => a.ragioneSociale.localeCompare(b.ragioneSociale)).map((f) => ({ c: f, s: { id: f.id }, forn: true })) : [];
    const ghoVoce = window.GHOS && UT.puo('sez.gho') && GHOS.gru(S).length ? [{ c: clienteGho(S), s: { id: GHO_ID }, gho: true }] : [];
    const tutte = st.vista === 'pdf' ? soloClienti : soloClienti.concat(forn, ghoVoce);
    if (!tutte.some((x) => x.s.id === st.sede)) st.sede = tutte[0]?.s.id || '';
    const { c: c0, forn: eForn0, gho: eGho } = tutte.find((x) => x.s.id === st.sede) || {};
    const c = c0, eForn = eForn0 || eGho;   // GHO: solo le sue schede (niente rapportini, controlli nostri, sottoganci)
    if (st.vista === 'pdf') return paginaPdf(el, S, st, tutte, c);
    const rap = st.sede && !eForn ? rapportiniDi(S, st.sede, st.anno) : [], sch = st.sede && !eForn ? schedeDi(S, st.sede, st.anno) : [], elenco = st.sede && !eForn && haElenco(S, st.sede);
    const ddt = eGho ? [] : ddtDi(S, c, st.anno), gho = eGho ? ghoDi(S, st.anno) : [];
    // cambiando cliente o anno riparte la scelta proposta
    if (st.chiave !== st.sede + '|' + st.anno) {
      st.chiave = st.sede + '|' + st.anno; st.rap = new Set(rap.filter((d) => d.on).map((d) => d.id)); st.ddt = new Set(ddt.filter((d) => d.on).map((d) => d.id)); st.gho = new Set(gho.filter((d) => d.on).map((d) => d.id)); st.imp = new Set(); st.sg = false; st.modo = 'una'; st.testoMio = false;
    }
    const date = [...new Set(sch.map((x) => x.data))].filter(Boolean).sort();
    const ind = c ? indirizzi(c) : [];
    const io = UT.attuale(), da = io?.google || '';
    const storico = S.invii.filter((x) => x.sedeId === st.sede).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 6);
    const anni = [...new Set([new Date().getFullYear(), new Date().getFullYear() - 1, st.anno])].sort().reverse();
    const voce = (gr, d, on) => `<label class="spunta ${d.senza ? 'spenta' : ''}"><input type="checkbox" data-gr="${gr}" value="${d.id}" ${on ? 'checked' : ''} ${d.senza ? 'disabled' : ''}><span><b>${esc(d.t)}</b><small>${esc(d.sub)}</small></span></label>`;
    el.innerHTML = `
      <section class="cli invio">
        <div class="sez-head"><h1>Invia e archivia ${info('Con «📧 Invia per email» mandi i documenti ai clienti; con «🖨️ Stampa e PDF» li salvi in archivio o li stampi, mese per mese. Scegli il cliente e spunta quello che vuoi mandare: schede di controllo, rapportini, DDT ed elenco sottoganci possono partire insieme nella stessa email. Nell\'elenco dei clienti ci sono anche i fornitori, per mandare loro i DDT. L\'app crea i PDF (gli stessi della stampa) e li spedisce dalla tua casella Gmail. Se le schede sono tante puoi mandare una email per ogni data di controllo; se una email supera il limite di Gmail l\'app la divide da sola in più parti.')}</h1></div>
        ${segVista(st)}
        <div class="card form"><div class="due">
          <label>Cliente<select id="selSede">${soloClienti.map(({ c, s }) => `<option value="${s.id}" ${s.id === st.sede ? 'selected' : ''}>${esc(nomeSede(c, s))}</option>`).join('')}
            ${ghoVoce.length ? `<optgroup label="GHO ELIGIO"><option value="${GHO_ID}" ${st.sede === GHO_ID ? 'selected' : ''}>GHO ELIGIO · schede di controllo (modello GHO)</option></optgroup>` : ''}
            ${forn.length ? `<optgroup label="🏭 Fornitori (solo DDT)">${forn.map(({ c, s }) => `<option value="${s.id}" ${s.id === st.sede ? 'selected' : ''}>${esc(c.ragioneSociale)}</option>`).join('')}</optgroup>` : ''}</select></label>
          <label>Anno<select id="selAnno">${anni.map((a) => `<option ${a === st.anno ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
        </div></div>

        ${eForn ? '' : `<div class="card">
          <div class="card-head"><h2>📋 Schede di controllo ${st.anno}</h2>${sch.length > 1 ? '<button type="button" class="link" data-tutti="imp">Tutte / nessuna</button>' : ''}</div>
          ${date.length > 1 ? `<div class="inv-date"><span class="muted small">Scegli per data di controllo:</span>${date.map((d) => { const n = sch.filter((x) => x.data === d).length, tutteOn = sch.filter((x) => x.data === d).every((x) => st.imp.has(x.id));
            return `<button type="button" class="inv-chip ${tutteOn ? 'on' : ''}" data-data="${d}">${esc(fmt(d))} <small>${n}</small></button>`; }).join('')}</div>` : ''}
          <div class="spunte inv-lista">${sch.map((d) => voce('imp', d, st.imp.has(d.id))).join('') || `<p class="muted">Nessuna scheda di controllo nel ${st.anno}.</p>`}</div>
        </div>

        <div class="card">
          <div class="card-head"><h2>🧾 Rapportini</h2>${rap.length > 1 ? '<button type="button" class="link" data-tutti="rap">Tutti / nessuno</button>' : ''}</div>
          <div class="spunte inv-lista">${rap.map((d) => voce('rap', d, st.rap.has(d.id))).join('') || '<p class="muted">Nessun rapportino da inviare.</p>'}</div>
        </div>`}
        ${eGho ? `<div class="card">
          <div class="card-head"><h2>📋 Schede di controllo GHO</h2>${gho.length > 1 ? '<button type="button" class="link" data-tutti="gho">Tutte / nessuna</button>' : ''}</div>
          <div class="spunte inv-lista">${gho.map((d) => voce('gho', d, st.gho.has(d.id))).join('') || '<p class="muted">Nessuna scheda da inviare.</p>'}</div>
        </div>` : ''}
        ${UT.puo('sez.ddt') && !eGho ? `<div class="card">
          <div class="card-head"><h2>🚚 DDT</h2>${ddt.length > 1 ? '<button type="button" class="link" data-tutti="ddt">Tutti / nessuno</button>' : ''}</div>
          <div class="spunte inv-lista">${ddt.map((d) => voce('ddt', d, st.ddt.has(d.id))).join('') || `<p class="muted">Nessun DDT da inviare${eForn ? ' a questo fornitore' : ''}.</p>`}</div>
        </div>` : ''}

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

    const totale = () => ({ rap: [...st.rap], ddt: [...st.ddt], gho: [...st.gho], imp: [...st.imp], sg: st.sg });
    const vuoto = () => !st.rap.size && !st.ddt.size && !st.gho.size && !st.imp.size && !st.sg;
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
        <ol class="inv-piano">${pp.map((p) => `<li>${[p.imp.length && `${p.imp.length} ${p.imp.length === 1 ? 'scheda' : 'schede'}${p.data ? ' del ' + fmt(p.data) : ''}`, p.rap.length && `${p.rap.length} ${p.rap.length === 1 ? 'rapportino' : 'rapportini'}`, (p.ddt || []).length && `${p.ddt.length} DDT`, (p.gho || []).length && `${p.gho.length} ${p.gho.length === 1 ? 'scheda GHO' : 'schede GHO'}`, p.sg && 'elenco sottoganci'].filter(Boolean).join(' · ')}</li>`).join('')}</ol>
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
    el.querySelectorAll('[data-vista]').forEach((b) => (b.onclick = () => { st.vista = b.dataset.vista; App.ridisegna(); }));
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
        if (p.imp.length && (p.rap.length || p.ddt.length || p.sg)) { coda.unshift({ ...p, rap: [], ddt: [], sg: false }, { ...p, imp: [], data: '' }); continue; }
        if (p.rap.length && p.ddt.length) { coda.unshift({ ...p, ddt: [] }, { ...p, imp: [], rap: [], sg: false }); continue; }
        if (p.gho.length > 1) { const m = Math.ceil(p.gho.length / 2); coda.unshift({ ...p, gho: p.gho.slice(0, m) }, { ...p, imp: [], rap: [], ddt: [], gho: p.gho.slice(m), sg: false }); continue; }
        if (p.ddt.length > 1) { const m = Math.ceil(p.ddt.length / 2); coda.unshift({ ...p, ddt: p.ddt.slice(0, m) }, { ...p, imp: [], rap: [], ddt: p.ddt.slice(m), sg: false }); continue; }
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
          await UI.salva('invii', { id: uid(), tipo: 'misto', tipi: [p.imp.length && 'controlli', p.rap.length && 'rapportini', p.ddt.length && 'ddt', p.gho.length && 'schede GHO', p.sg && 'sottoganci'].filter(Boolean), sedeId: st.sede, clienteId: eForn0 ? '' : c?.id || '', fornitoreId: eForn0 ? c.id : '', anno: st.anno,
            docIds: [...p.imp, ...p.rap, ...p.ddt, ...p.gho, ...(p.sg ? [st.sede] : [])], a, da: acc.email, oggetto: ogg, data: ora, utente: io?.id || '', allegati: al.map((x) => x.nome) });
          for (const id of p.rap) { const r = S.rapportini.find((x) => x.id === id); if (r) await UI.salva('rapportini', { ...r, inviatoIl: ora, inviatoA: a }); }
          for (const id of p.ddt) { const d = (S.ddt || []).find((x) => x.id === id); if (d) await UI.salva('ddt', { ...d, inviatoIl: ora, inviatoA: a }); }
          for (const id of p.gho) { const d = (S.ghoControlli || []).find((x) => x.id === id); if (d) await UI.salva('ghoControlli', { ...d, inviatoIl: ora, inviatoA: a }); }
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
    return { titolo: 'Invia e archivia', indietro: '#/', live: false };
  }

  return { route: (el, S, parti, query) => pagina(el, S, query) };
})();
