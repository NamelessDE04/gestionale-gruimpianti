// ===== INVIO AI CLIENTI PER EMAIL (solo Master) =====
// Si scelgono cliente e documenti (rapportini, schede di controllo o elenco sottoganci), l'app crea il PDF
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
  const documenti = (S, tipo, sedeId, anno) => {
    if (tipo === 'rapportini') return S.rapportini.filter((r) => r.sedeId === sedeId).sort((a, b) => (b.anno - a.anno) || (b.numero - a.numero))
      .map((r) => ({ id: r.id, t: `Rapportino N° ${r.numero}/${r.anno}`, sub: `${fmt((r.giorni || [])[0]?.data || r.dataConsegna)} · ${r.firmaReferente ? 'firmato' : 'da firmare'}${r.inviatoIl ? ' · ✉️ inviato il ' + fmt(r.inviatoIl.slice(0, 10)) : ''}`, on: !r.inviatoIl && !!r.firmaReferente }));
    if (tipo === 'controlli') return S.impianti.filter((i) => i.sedeId === sedeId).sort((a, b) => String(a.numeroInterno).localeCompare(String(b.numeroInterno), 'it', { numeric: true }))
      .map((i) => { const sc = CTR.schedaDi(S, i.id, anno); const n = sc ? Object.keys(sc.visite || {}).length : 0;
        return { id: i.id, t: `${i.numeroInterno ? 'N° ' + i.numeroInterno + ' · ' : ''}${IMP.titolo(i)}`, sub: `${i.matricola ? 'matr. ' + i.matricola + ' · ' : ''}${n ? n + (n === 1 ? ' controllo' : ' controlli') + ' nel ' + anno : 'nessun controllo nel ' + anno}`, on: n > 0 }; });
    if (tipo === 'sottoganci') { const c = SG.cliente(S, sedeId); const n = S.sottoganci.filter((x) => x.sedeId === sedeId).length;
      return n ? [{ id: sedeId, t: `${c?.titoloElenco || 'ELENCO SOTTOGANCI'} ${anno}`, sub: `${n} sottoganci`, on: true }] : []; }
    return [];
  };
  const testoBase = (S, tipo, c, docs, anno) => {
    const io = UT.attuale(), firma = `\n\nCordiali saluti\n${io?.nome || ''}\nGru Impianti`;
    if (tipo === 'rapportini') {
      const rr = docs.map((id) => S.rapportini.find((r) => r.id === id)).filter(Boolean);
      return { oggetto: rr.length === 1 ? `Rapportino di intervento N° ${rr[0].numero}/${rr[0].anno}` : `Rapportini di intervento (${rr.length})`,
        testo: `Buongiorno,\nin allegato ${rr.length === 1 ? `il rapportino di intervento N° ${rr[0].numero}/${rr[0].anno}` : 'i rapportini di intervento ' + rr.map((r) => `N° ${r.numero}/${r.anno}`).join(', ')}.${firma}` };
    }
    if (tipo === 'controlli') return { oggetto: `Schede di controllo apparecchi di sollevamento ${anno}`, testo: `Buongiorno,\nin allegato le schede di controllo degli apparecchi di sollevamento (D.Lgs. 81/08) relative all'anno ${anno}.${firma}` };
    return { oggetto: `Elenco accessori di sollevamento ${anno}`, testo: `Buongiorno,\nin allegato l'elenco aggiornato degli accessori di sollevamento (funi, catene, brache) relativo all'anno ${anno}.${firma}` };
  };

  // ---------- PDF ----------
  const pulito = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  async function creaPdf(S, tipo, sedeId, anno, ids) {
    const { c, s } = CTR.trovaSede(S, sedeId), nome = pulito(c ? CLI.nome(c) : 'cliente') + (s?.sigla ? '_' + pulito(s.sigla) : '');
    if (tipo === 'rapportini') {
      const out = [];
      for (const id of ids) {
        const r = S.rapportini.find((x) => x.id === id);
        out.push({ nome: `Rapportino_${r.numero}-${r.anno}_${nome}.pdf`, bytes: await PDFX.daStampa((el) => RAP.route(el, S, ['rapportini', 'r', id], new URLSearchParams()), '.recap', true) });
      }
      return out;
    }
    if (tipo === 'controlli') return [{ nome: `Schede_controllo_${anno}_${nome}.pdf`, bytes: await PDFX.daStampa((el) => CTRS.render(el, S, ids, anno, '#/'), '.foglio-p', true) }];
    const cs = SG.cliente(S, sedeId);
    return [{ nome: `${pulito(cs?.titoloElenco || 'ELENCO_SOTTOGANCI')}_${anno}_${nome}.pdf`, bytes: await PDFX.daStampa((el) => SGStampa.render(el, S, sedeId, anno), '.foglio', false) }];
  }
  const scarica = (x) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([x.bytes], { type: 'application/pdf' })); a.download = x.nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); };

  // ---------- pagina ----------
  const stato = {};
  function pagina(el, S, query) {
    if (!UT.isMaster()) { el.innerHTML = '<p class="nessuno">Solo il Master può inviare i documenti ai clienti.</p>'; return { titolo: 'Invio', indietro: '#/' }; }
    const st = Object.assign(stato, {
      tipo: query.get('tipo') || stato.tipo || 'rapportini', sede: query.get('sede') || stato.sede || '',
      anno: +(query.get('anno') || stato.anno || new Date().getFullYear()), da: query.get('da') || (query.get('tipo') ? '#/' : stato.da || '#/')
    });
    if (query.get('tipo')) history.replaceState(null, '', '#/invio');   // i parametri servono solo all'apertura
    const tutte = sedi(S);
    if (!tutte.some((x) => x.s.id === st.sede)) st.sede = tutte[0]?.s.id || '';
    const { c } = tutte.find((x) => x.s.id === st.sede) || {};
    const docs = st.sede ? documenti(S, st.tipo, st.sede, st.anno) : [];
    const pre = (query.get('ids') || '').split(',').filter(Boolean);
    if (pre.length) docs.forEach((d) => (d.on = pre.includes(d.id)));
    const ind = c ? indirizzi(c) : [];
    const io = UT.attuale(), da = io?.google || '';
    const storico = S.invii.filter((x) => x.sedeId === st.sede).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 6);
    const anni = [...new Set([new Date().getFullYear(), new Date().getFullYear() - 1, st.anno])].sort().reverse();
    el.innerHTML = `
      <section class="cli invio">
        <div class="sez-head"><h1>Invia ai clienti ${info('Scegli il cliente e i documenti: l\'app crea i PDF (gli stessi della stampa) e li spedisce dalla tua casella Gmail. Al cliente arriva una mail normale da te, e la trovi anche tra i tuoi «Inviati». La prima volta Google ti chiede il permesso di inviare email per conto tuo.')}</h1></div>
        <div class="seg">${Object.entries(TIPI).map(([k, l]) => `<button type="button" class="${k === st.tipo ? 'on' : ''}" data-tipo="${k}">${l}</button>`).join('')}</div>
        <div class="card form">
          <div class="${st.tipo === 'rapportini' ? '' : 'due'}">
            <label>Cliente<select id="selSede">${tutte.map(({ c, s }) => `<option value="${s.id}" ${s.id === st.sede ? 'selected' : ''}>${esc(nomeSede(c, s))}</option>`).join('')}</select></label>
            ${st.tipo === 'rapportini' ? '' : `<label>Anno<select id="selAnno">${anni.map((a) => `<option ${a === st.anno ? 'selected' : ''}>${a}</option>`).join('')}</select></label>`}
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h2>Documenti da inviare</h2>${docs.length > 1 ? '<button type="button" class="link" id="btnTutti">Tutti / nessuno</button>' : ''}</div>
          <div class="spunte" id="docs">${docs.map((d) => `<label class="spunta"><input type="checkbox" value="${d.id}" ${d.on ? 'checked' : ''}><span><b>${esc(d.t)}</b><small>${esc(d.sub)}</small></span></label>`).join('') || '<p class="muted">Nessun documento per questo cliente.</p>'}</div>
          ${docs.length ? '<button type="button" class="btn ghost small" id="btnAnteprima">👁 Scarica il PDF da controllare</button>' : ''}
        </div>
        <div class="card">
          <h2>A chi inviarli</h2>
          <div class="spunte" id="dest">${ind.map((x, k) => `<label class="spunta"><input type="checkbox" value="${esc(x.e)}" ${k === 0 ? 'checked' : ''}><span><b>${esc(x.e)}</b><small>${esc(x.l)}</small></span></label>`).join('') || '<p class="muted small">Il cliente non ha indirizzi email in anagrafica: scrivine uno qui sotto.</p>'}</div>
          <label>Altri indirizzi <span class="unita">(separati da virgola)</span><input type="email" id="altri" multiple placeholder="nome@azienda.it"></label>
        </div>
        <div class="card form">
          <h2>Messaggio</h2>
          <label>Oggetto<input id="oggetto" data-libero></label>
          <label>Testo<textarea id="testo" rows="7" data-libero></textarea></label>
          <p class="muted small">${Backend.mode === 'prova' ? '🎬 In dimostrazione la mail non viene spedita davvero: puoi provare tutto il percorso.' : `Parte dalla tua casella Gmail${da ? ': <b>' + esc(da) + '</b>' : ''}.`}</p>
        </div>
        <div class="azioni-form barra-salva"><span class="grow"></span><button class="btn big" id="btnInvia">📧 Invia</button></div>
        ${storico.length ? `<div class="card"><h2>Ultimi invii a questo cliente</h2>${storico.map((x) => `<p class="small">✉️ <b>${fmt(x.data.slice(0, 10))}</b> · ${esc(TIPI[x.tipo].replace(/^\S+\s/, ''))} · ${esc(x.oggetto)}<br><span class="muted">a ${esc(x.a.join(', '))} · da ${esc(x.da)}${x.simulato ? ' (dimostrazione)' : ''}</span></p>`).join('')}</div>` : ''}
      </section>`;
    const scelti = () => [...el.querySelectorAll('#docs input:checked')].map((x) => x.value);
    const testi = () => { const t = testoBase(S, st.tipo, c, scelti(), st.anno); el.querySelector('#oggetto').value = t.oggetto; el.querySelector('#testo').value = t.testo; };
    testi();
    el.querySelectorAll('#docs input').forEach((x) => (x.onchange = testi));
    el.querySelector('#btnTutti')?.addEventListener('click', () => { const bs = [...el.querySelectorAll('#docs input')]; const tutti = bs.every((b) => b.checked); bs.forEach((b) => (b.checked = !tutti)); testi(); });
    el.querySelectorAll('[data-tipo]').forEach((b) => (b.onclick = () => { st.tipo = b.dataset.tipo; App.ridisegna(); }));
    el.querySelector('#selSede').onchange = (e) => { st.sede = e.target.value; App.ridisegna(); };
    el.querySelector('#selAnno')?.addEventListener('change', (e) => { st.anno = +e.target.value; App.ridisegna(); });
    const destinatari = () => [...el.querySelectorAll('#dest input:checked')].map((x) => x.value)
      .concat(el.querySelector('#altri').value.split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean));
    const bAnte = el.querySelector('#btnAnteprima');
    if (bAnte) bAnte.onclick = async () => {
      const ids = scelti(); if (!ids.length) return UI.toast('Scegli almeno un documento', 'err');
      bAnte.disabled = true; bAnte.textContent = '⏳ Preparo il PDF…';
      try { (await creaPdf(S, st.tipo, st.sede, st.anno, ids)).forEach(scarica); } catch (e) { console.error(e); UI.toast('Non riesco a creare il PDF', 'err'); }
      bAnte.disabled = false; bAnte.textContent = '👁 Scarica il PDF da controllare';
    };
    const bInv = el.querySelector('#btnInvia');
    bInv.onclick = async () => {
      const ids = scelti(), a = destinatari();
      if (!ids.length) return UI.toast('Scegli almeno un documento', 'err');
      if (!a.length) return UI.toast('Scegli o scrivi almeno un indirizzo', 'err');
      const errato = a.find((x) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)); if (errato) return UI.toast('Indirizzo non valido: ' + errato, 'err');
      const oggetto = el.querySelector('#oggetto').value.trim(), testo = el.querySelector('#testo').value;
      const prova = Backend.mode === 'prova';
      const fase = (t) => (bInv.textContent = t);
      bInv.disabled = true;
      try {
        // prima il permesso di Google (deve partire subito dal tocco, altrimenti il popup viene bloccato)
        let acc = { email: da || 'tu@gmail.com' };
        if (!prova) { fase('🔐 Accesso a Gmail…'); acc = await MAIL.accedi(da); }
        fase('⏳ Preparo i PDF…');
        const allegati = await creaPdf(S, st.tipo, st.sede, st.anno, ids);
        if (!prova) { fase('📤 Invio…'); await MAIL.invia({ da: acc.email, nome: `${io?.nome || ''} – Gru Impianti`, a, oggetto, testo, allegati }); }
        const ora = new Date().toISOString();
        await UI.salva('invii', { id: uid(), tipo: st.tipo, sedeId: st.sede, clienteId: c?.id || '', anno: st.anno, docIds: ids, a, da: acc.email, oggetto, data: ora, utente: io?.id || '', allegati: allegati.map((x) => x.nome), ...(prova ? { simulato: true } : {}) });
        if (st.tipo === 'rapportini') for (const id of ids) { const r = S.rapportini.find((x) => x.id === id); if (r) await UI.salva('rapportini', { ...r, inviatoIl: ora, inviatoA: a }); }
        UI.toast(prova ? `Dimostrazione: mail pronta per ${a.join(', ')} (non spedita)` : `Email inviata a ${a.join(', ')}`, 'ok');
        App.ridisegna();
      } catch (e) {
        console.error(e);
        const m = String(e && (e.code || e.message) || '');
        UI.toast(/popup-closed|cancelled/.test(m) ? 'Accesso a Gmail annullato'
          : m === 'config' ? 'Per inviare email serve il collegamento al cloud'
          : m === 'api' ? 'Su Google va attivata la «Gmail API» per questo progetto (vedi istruzioni)'
          : m === 'permesso' || m === 'token' ? 'Google non ha dato il permesso di inviare: riprova e accetta'
          : m === 'incerto' ? 'Google non ha confermato l\'invio: controlla tra gli «Inviati» di Gmail prima di rimandarla'
          : m === 'rete' ? 'Serve la connessione a internet per inviare'
          : /^invio 4(13|00)/.test(m) ? 'Allegati troppo grandi per una sola email: invia meno documenti alla volta' : 'Invio non riuscito (' + m + ')', 'err');
      }
      bInv.disabled = false; fase('📧 Invia');
    };
    return { titolo: 'Invia ai clienti', indietro: st.da, live: false };
  }

  return { route: (el, S, parti, query) => pagina(el, S, query) };
})();
