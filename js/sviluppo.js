// ===== STRUMENTI DEL DEVELOPER: consumi del cloud e stato dell'app =====
// Firebase non permette all'app di leggere i propri consumi: l'app li conta da sola (vedi backend.js)
// e li somma nel cloud, un documento al giorno. Sono una stima molto vicina al vero; il dato ufficiale
// resta quello della console di Firebase (link in fondo alla pagina).
window.DEV = (function () {
  const { esc, info } = UI;
  const REPO = 'NamelessDE04/gestionale-gruimpianti';
  // piano gratuito di Firebase (Spark)
  const QUOTE = { letture: 50000, scritture: 20000, cancellazioni: 20000, archivio: 1024 ** 3, doc: 1024 ** 2 };
  const n = (x) => Math.round(x || 0).toLocaleString('it-IT');
  const kb = (b) => (b >= 1024 ** 2 ? (b / 1024 ** 2).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
  const pct = (a, b) => Math.min(100, (a / b) * 100);
  const colore = (p) => (p >= 80 ? 'var(--ko, #c62828)' : p >= 50 ? '#e09b00' : 'var(--ok, #2e9e5b)');
  const barra = (lab, val, max, sotto = '') => { const p = pct(val, max);
    return `<div class="dv-barra"><div class="dv-barra-t"><span>${lab}</span><b>${n(val)} <small>/ ${n(max)}</small></b></div>
      <div class="dv-track"><i style="width:${p.toFixed(1)}%;background:${colore(p)}"></i></div>${sotto ? `<small class="muted">${sotto}</small>` : ''}</div>`; };
  const peso = (x) => { try { return new Blob([JSON.stringify(x)]).size; } catch (e) { return 0; } };

  function pagina(el, S) {
    const cloud = Backend.mode === 'cloud';
    // archivio: stima dalla copia dei dati che ha l'app
    const cols = Object.keys(S).filter((k) => Array.isArray(S[k]));
    const righe = cols.map((c) => ({ c, n: S[c].length, b: peso(S[c]) })).sort((a, b) => b.b - a.b);
    const tot = righe.reduce((t, r) => t + r.b, 0);
    const grossi = cols.flatMap((c) => S[c].map((d) => ({ c, id: d.id, b: peso(d), nome: d.nome || d.ragioneSociale || d.numero || d.cliente || d.data || d.id }))).sort((a, b) => b.b - a.b).slice(0, 6);
    const io = Backend.consumiDispositivo ? Backend.consumiDispositivo() : null;
    el.innerHTML = `
      <section class="cli dv">
        <div class="sez-head"><h1>Consumi e stato dell'app ${info('Pagina riservata al Developer. I consumi di Firebase li conta l\'app stessa (Firebase non li fornisce alle app): sono una stima molto vicina al vero, ma il dato ufficiale è nella console di Firebase. Il giorno di Firebase finisce a mezzanotte ora della California (le 9 del mattino in Italia).')}</h1></div>

        ${cloud ? `<div class="card"><h2>✅ Consumi ufficiali Google · oggi ${info('Il totale vero di tutto il progetto Firebase, letto da Google (Cloud Monitoring): conta tutti i dispositivi, la Lavagna e anche la console. Si sceglie l\'account Google proprietario del progetto Firebase (può essere diverso da quello con cui usi l\'app, che non cambia): la prima volta Google chiede il permesso di leggere i dati di monitoraggio, poi se lo ricorda. Il dato arriva con qualche minuto di ritardo.')}</h2>
          <div id="dvUff"><button type="button" class="btn" id="btnUff">Leggi da Google</button></div></div>` : ''}

        <div class="card"><h2>☁️ Conteggio dell'app · oggi ${cloud ? `<small class="muted">(giorno ${esc(Backend.giornoFirebase())})</small>` : ''} ${info('Somma di quello che contano da soli tutti i dispositivi con l\'app aggiornata. Non conta la Lavagna, la console di Firebase e i dispositivi con versioni vecchie: per il totale vero usa «Consumi ufficiali Google».')}</h2>
          <div id="dvOggi">${cloud ? '<p class="muted">Carico i consumi…</p>' : '<p class="muted">L\'app è in modalità «solo su questo dispositivo»: nessun consumo sul cloud.</p>'}</div></div>

        ${cloud ? `<div class="card"><h2>📈 Ultimi 30 giorni</h2><div id="dvStorico"><p class="muted">Carico…</p></div></div>` : ''}

        <div class="card"><h2>📱 Questo dispositivo · oggi</h2>
          ${io ? `<div class="dv-tre"><div><b>${n(io.r)}</b><span>letture</span></div><div><b>${n(io.w)}</b><span>scritture</span></div><div><b>${n(io.d)}</b><span>cancellazioni</span></div></div>` : '<p class="muted">Nessun dato.</p>'}
          <div id="dvDisp" class="dv-info"></div></div>

        <div class="card"><h2>🗄️ Dati archiviati ${info('Stima dello spazio occupato dai documenti (senza indici di Firebase, che aggiungono un po\'). Ogni documento può essere al massimo 1 MB: oltre non si salva più. Le firme e le foto sono le parti più pesanti.')}</h2>
          <div class="dv-barra"><div class="dv-barra-t"><span>Totale (stima)</span><b>${kb(tot)} <small>/ 1 GB gratuito</small></b></div>
            <div class="dv-track"><i style="width:${Math.max(0.5, pct(tot, QUOTE.archivio)).toFixed(1)}%;background:${colore(pct(tot, QUOTE.archivio))}"></i></div></div>
          <table class="dv-tab"><tr><th>Raccolta</th><th>Documenti</th><th>Peso</th></tr>
            ${righe.filter((r) => r.n).map((r) => `<tr><td>${esc(r.c)}</td><td class="d">${n(r.n)}</td><td class="d">${kb(r.b)}</td></tr>`).join('')}</table>
          <h3 class="dv-h3">Documenti più pesanti</h3>
          ${grossi.map((g) => { const p = pct(g.b, QUOTE.doc); return `<div class="dv-barra"><div class="dv-barra-t"><span>${esc(g.c)} · ${esc(String(g.nome).slice(0, 40))}</span><b>${kb(g.b)} <small>/ 1 MB</small></b></div><div class="dv-track"><i style="width:${p.toFixed(1)}%;background:${colore(p)}"></i></div></div>`; }).join('')}</div>

        <div class="card"><h2>🐙 GitHub</h2><div id="dvGit"><p class="muted">Controllo il repository…</p></div></div>

        <div class="card"><h2>🔗 Collegamenti utili</h2><div class="azioni-lista">
          ${cloud ? `<a class="btn ghost" target="_blank" rel="noopener" href="https://console.firebase.google.com/project/${esc(Backend.progetto())}/usage">Consumi ufficiali Firebase</a>
          <a class="btn ghost" target="_blank" rel="noopener" href="https://console.firebase.google.com/project/${esc(Backend.progetto())}/firestore/databases/-default-/rules">Regole Firestore</a>` : ''}
          <a class="btn ghost" target="_blank" rel="noopener" href="https://github.com/${REPO}">Repository GitHub</a>
          <a class="btn ghost" target="_blank" rel="noopener" href="https://github.com/${REPO}/actions">Pubblicazioni (Actions)</a></div></div>
      </section>`;
    caricaCloud(el); caricaDisp(el); caricaGit(el);
    el.querySelector('#btnUff')?.addEventListener('click', () => ufficiali(el));
    return { titolo: 'Consumi e stato', indietro: '#/profilo', live: false };
  }

  // ---------- consumi ufficiali (Cloud Monitoring di Google) ----------
  let tokenMon = null, scadeMon = 0, accountMon = '';
  async function permessoMonitoraggio() {
    if (tokenMon && Date.now() < scadeMon) return tokenMon;
    const app = firebase.apps.find((a) => a.name === 'monitor') || firebase.initializeApp(window.firebaseConfig, 'monitor');
    if (!firebase.auth) throw new Error('auth');
    const p = new firebase.auth.GoogleAuthProvider();
    p.addScope('https://www.googleapis.com/auth/monitoring.read');
    // l'account proprietario del progetto Firebase può essere diverso da quello dell'app: si sceglie qui e si ricorda
    let ult = ''; try { ult = localStorage.getItem('gid_account_monitor') || ''; } catch (e) {}
    p.setCustomParameters(ult ? { login_hint: ult } : { prompt: 'select_account' });
    const r = await app.auth().signInWithPopup(p);
    try { localStorage.setItem('gid_account_monitor', (r.user.email || '').toLowerCase()); } catch (e) {}
    tokenMon = r.credential && r.credential.accessToken; scadeMon = Date.now() + 50 * 60 * 1000;
    if (!tokenMon) throw new Error('token');
    // con il consenso "a caselle" di Google il permesso extra va spuntato: controllo che ci sia davvero
    try {
      const ti = await (await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(tokenMon))).json();
      if (ti.scope && !/monitoring/.test(ti.scope)) { tokenMon = null; const e = new Error('scope'); e.account = r.user.email; throw e; }
    } catch (e) { if (e.message === 'scope') throw e; }
    accountMon = r.user.email || '';
    return tokenMon;
  }
  // inizio del giorno di Firebase (mezzanotte in California) in ora UTC
  function inizioGiornoFb() {
    const ora = new Date();
    const pz = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(ora).map((x) => [x.type, x.value]));
    const sec = ((+pz.hour % 24) * 3600) + (+pz.minute * 60) + (+pz.second);
    return new Date(ora.getTime() - sec * 1000);
  }
  async function serie(token, metrica, da, a) {
    const per = Math.max(60, Math.ceil((a - da) / 1000)) + 's';
    const q = new URLSearchParams({ filter: `metric.type="firestore.googleapis.com/document/${metrica}"`, 'interval.startTime': da.toISOString(), 'interval.endTime': a.toISOString(),
      'aggregation.alignmentPeriod': per, 'aggregation.perSeriesAligner': 'ALIGN_SUM', 'aggregation.crossSeriesReducer': 'REDUCE_SUM' });
    const r = await fetch(`https://monitoring.googleapis.com/v3/projects/${encodeURIComponent(Backend.progetto())}/timeSeries?${q}`, { headers: { Authorization: 'Bearer ' + token } });
    if (r.status === 401) { tokenMon = null; throw new Error('scaduto'); }
    if (!r.ok) {
      const t = await r.text().catch(() => ''); let msg = ''; try { msg = JSON.parse(t).error.message || ''; } catch (e) { msg = t.slice(0, 200); }
      const er = new Error(/has not been used|is disabled|SERVICE_DISABLED/i.test(t) ? 'api' : /SCOPE_INSUFFICIENT|insufficient authentication scopes/i.test(t) ? 'scope' : r.status === 403 ? 'permesso' : 'errore ' + r.status);
      er.google = msg; throw er;
    }
    const j = await r.json();
    return (j.timeSeries || []).reduce((t, s) => t + (s.points || []).reduce((u, p) => u + +(p.value.int64Value || p.value.doubleValue || 0), 0), 0);
  }
  async function ufficiali(el) {
    const box = el.querySelector('#dvUff'), b = el.querySelector('#btnUff');
    b.disabled = true; b.textContent = '🔐 Permesso di Google…';
    try {
      const t = await permessoMonitoraggio();
      b.textContent = '⏳ Leggo i consumi…';
      const da = inizioGiornoFb(), a = new Date();
      const [rd, wr, dl] = await Promise.all(['read_count', 'write_count', 'delete_count'].map((m) => serie(t, m, da, a)));
      box.innerHTML = `${barra('Letture', rd, QUOTE.letture)}${barra('Scritture', wr, QUOTE.scritture)}${barra('Cancellazioni', dl, QUOTE.cancellazioni)}
        <p class="muted small">Restano oggi <b>${n(Math.max(0, QUOTE.letture - rd))}</b> letture e <b>${n(Math.max(0, QUOTE.scritture - wr))}</b> scritture del piano gratuito · letto alle ${esc(a.toTimeString().slice(0, 5))}.</p>
        <div class="azioni-form"><button type="button" class="link" id="btnUffAcc">Usa un altro account Google</button><span class="grow"></span><button type="button" class="btn ghost small" id="btnUff">↻ Aggiorna</button></div>`;
      el.querySelector('#btnUffAcc').onclick = () => { try { localStorage.removeItem('gid_account_monitor'); } catch (e) {} tokenMon = null; ufficiali(el); };
      el.querySelector('#btnUff').onclick = () => ufficiali(el);
    } catch (e) {
      console.error(e);
      const m = String(e && (e.code || e.message) || '');
      const spiega = /popup-closed|cancelled/.test(m) ? 'Accesso a Google annullato.'
        : m === 'scope' ? 'Google non ha dato il permesso di leggere i consumi. Nella finestra di Google, dopo aver scelto l\'account, <b>spunta la casella</b> «Visualizzare i dati di monitoraggio…» prima di premere Continua.'
        : m === 'api' ? 'Su Google va attivata la <b>Cloud Monitoring API</b> per questo progetto (una volta sola): apri il link qui sotto con l\'account proprietario e premi «Abilita».'
        : m === 'permesso' ? `L'account <b>${esc(accountMon || '')}</b> non ha il permesso di leggere i consumi del progetto <b>${esc(Backend.progetto())}</b>.`
        : 'Non riesco a leggere i consumi (' + esc(m) + ').';
      box.innerHTML = `<p class="txt-ko">${spiega}</p>${e.google ? `<p class="muted small">Risposta di Google: ${esc(e.google)}</p>` : ''}
        <p class="muted small">Progetto: ${esc(Backend.progetto())}${accountMon ? ' · account usato: ' + esc(accountMon) : ''}</p>
        <div class="azioni-lista"><a class="btn ghost small" target="_blank" rel="noopener" href="https://console.cloud.google.com/apis/library/monitoring.googleapis.com?project=${esc(Backend.progetto())}">Cloud Monitoring API</a>
          <a class="btn ghost small" target="_blank" rel="noopener" href="https://console.cloud.google.com/iam-admin/iam?project=${esc(Backend.progetto())}">Permessi del progetto (IAM)</a></div>
        <div class="azioni-form"><button type="button" class="link" id="btnUffAcc">Usa un altro account Google</button><span class="grow"></span><button type="button" class="btn small" id="btnUff">Riprova</button></div>`;
      el.querySelector('#btnUff').onclick = () => ufficiali(el);
      el.querySelector('#btnUffAcc').onclick = () => { try { localStorage.removeItem('gid_account_monitor'); } catch (e) {} tokenMon = null; ufficiali(el); };
    }
  }

  async function caricaCloud(el) {
    if (Backend.mode !== 'cloud') return;
    let giorni = [];
    try { giorni = await Backend.consumiCloud(30); }
    catch (e) { el.querySelector('#dvOggi').innerHTML = `<p class="txt-ko">Non riesco a leggere i consumi (${esc(e.code || e.message)}). Controlla la connessione.</p>`; el.querySelector('#dvStorico') && (el.querySelector('#dvStorico').innerHTML = ''); return; }
    const oggi = giorni.find((g) => g.giorno === Backend.giornoFirebase()) || { letture: 0, scritture: 0, cancellazioni: 0, dispositivi: {} };
    const disp = Object.entries(oggi.dispositivi || {}).sort((a, b) => (b[1].letture || 0) - (a[1].letture || 0));
    el.querySelector('#dvOggi').innerHTML = `
      ${barra('Letture', oggi.letture, QUOTE.letture)}${barra('Scritture', oggi.scritture, QUOTE.scritture)}${barra('Cancellazioni', oggi.cancellazioni, QUOTE.cancellazioni)}
      <p class="muted small">Restano oggi circa <b>${n(Math.max(0, QUOTE.letture - oggi.letture))}</b> letture e <b>${n(Math.max(0, QUOTE.scritture - oggi.scritture))}</b> scritture del piano gratuito.</p>
      ${disp.length ? `<table class="dv-tab"><tr><th>Dispositivo / account</th><th>Letture</th><th>Scritture</th><th>Ultimo invio</th></tr>
        ${disp.map(([k, v]) => `<tr><td>${esc(k.replace(/_/g, '.').replace(/\.gmail\.com$/, '@gmail.com'))}</td><td class="d">${n(v.letture)}</td><td class="d">${n(v.scritture)}</td><td class="d">${esc((v.ultimo || '').slice(11, 16))}</td></tr>`).join('')}</table>` : ''}`;
    const st = el.querySelector('#dvStorico');
    if (!giorni.length) { st.innerHTML = '<p class="muted">Ancora nessun dato: i consumi si accumulano da oggi.</p>'; return; }
    // sempre 30 colonne (i giorni senza dati restano vuoti)
    const fine = new Date(Backend.giornoFirebase() + 'T12:00:00');
    const ord = Array.from({ length: 30 }, (_, i) => { const d = new Date(fine); d.setDate(d.getDate() - 29 + i); const k = d.toISOString().slice(0, 10); return giorni.find((g) => g.giorno === k) || { giorno: k, letture: 0, scritture: 0 }; });
    const max = Math.max(1, ...ord.map((g) => g.letture || 0));
    const conDati = ord.filter((g) => g.letture || g.scritture); const media = conDati.reduce((t, g) => t + (g.letture || 0), 0) / Math.max(1, conDati.length);
    st.innerHTML = `<div class="dv-grafico">${ord.map((g) => `<div class="dv-col" title="${esc(g.giorno)}: ${n(g.letture)} letture, ${n(g.scritture)} scritture">
        <i style="height:${(pct(g.letture || 0, max)).toFixed(1)}%"></i><em style="height:${(pct(g.scritture || 0, max)).toFixed(1)}%"></em><span>${+g.giorno.slice(8) % 5 === 0 || +g.giorno.slice(8) === 1 ? +g.giorno.slice(8) : ''}</span></div>`).join('')}</div>
      <p class="muted small"><span class="dv-leg l"></span> letture <span class="dv-leg s"></span> scritture · media ${n(media)} letture al giorno (${pct(media, QUOTE.letture).toFixed(0)}% del limite giornaliero) · massimo ${n(max)}</p>`;
  }

  async function caricaDisp(el) {
    const box = el.querySelector('#dvDisp'); const r = [];
    r.push(['Versione app', 'v' + App.VERSIONE]);
    r.push(['Modalità', Backend.mode === 'cloud' ? 'cloud (Firebase)' : 'solo su questo dispositivo']);
    if (Backend.account && Backend.account()) r.push(['Account', Backend.account()]);
    r.push(['Connessione', navigator.onLine ? 'online' : 'offline']);
    try { const k = await caches.keys(); r.push(['Copia offline (cache)', k.join(', ') || 'nessuna']); } catch (e) {}
    try { const e = await navigator.storage.estimate(); r.push(['Spazio usato sul dispositivo', `${kb(e.usage || 0)} su ${kb(e.quota || 0)}`]); } catch (e) {}
    try { let t = 0; for (const k of Object.keys(localStorage)) t += (localStorage.getItem(k) || '').length * 2; r.push(['Memoria locale (localStorage)', kb(t)]); } catch (e) {}
    box.innerHTML = r.map(([a, b]) => `<div><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('');
  }

  async function caricaGit(el) {
    const box = el.querySelector('#dvGit');
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/commits?per_page=6`, { headers: { Accept: 'application/vnd.github+json' } });
      const resto = res.headers.get('x-ratelimit-remaining'), limite = res.headers.get('x-ratelimit-limit');
      if (res.status === 404) { box.innerHTML = '<p class="muted">Il repository è privato: per vederlo da qui servirebbe un token di accesso GitHub.</p>'; return; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const lista = await res.json();
      const ver = (m) => (m.match(/v(\d+\.\d+\.\d+)/) || [])[1];
      const ultima = lista.map((c) => ver(c.commit.message)).find(Boolean);
      const cmp = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
      const stato = !ultima ? '' : cmp(ultima, App.VERSIONE) > 0 ? `<p class="avviso-m st-b-scadenza"><span class="av-ico">⬆️</span><span class="grow"><b>Su GitHub c'è la v${esc(ultima)}</b><span>Questo dispositivo ha la v${esc(App.VERSIONE)}: chiudi e riapri l'app per aggiornarla.</span></span></p>`
        : `<p class="txt-ok"><b>✓ Questo dispositivo ha l'ultima versione pubblicata (v${esc(App.VERSIONE)}).</b></p>`;
      box.innerHTML = `${stato}
        <table class="dv-tab"><tr><th>Quando</th><th>Modifica</th></tr>${lista.map((c) => `<tr><td class="d">${esc(new Date(c.commit.author.date).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))}</td><td>${esc(c.commit.message.split('\n')[0].slice(0, 110))}</td></tr>`).join('')}</table>
        ${resto ? `<p class="muted small">Richieste GitHub rimaste a questo dispositivo: ${esc(resto)}/${esc(limite)} l'ora.</p>` : ''}`;
    } catch (e) { box.innerHTML = `<p class="muted">GitHub non raggiungibile ora (${esc(e.message)}).</p>`; }
  }

  return { pagina };
})();
