// ===== BACKEND INTERCAMBIABILE =====
// Stesse funzioni per locale e cloud: init / subscribe / save / remove.
// Il resto dell'app usa SOLO window.Backend, quindi passare al cloud
// significa solo compilare firebaseConfig in config.js.
(function () {
  const PREFIX = 'gid_demo_';

  function LocalBackend(PREFIX, MODO) {
    const listeners = {};
    const read = (col) => {
      try { return JSON.parse(localStorage.getItem(PREFIX + col) || '[]'); }
      catch (e) { return []; }
    };
    const write = (col, arr) => {
      localStorage.setItem(PREFIX + col, JSON.stringify(arr)); // può lanciare "memoria piena"
      (listeners[col] || []).forEach((cb) => cb(arr.slice()));
    };
    return {
      mode: MODO || 'locale',
      async init() {},
      subscribe(col, cb) {
        (listeners[col] = listeners[col] || []).push(cb);
        cb(read(col));
        return () => { listeners[col] = listeners[col].filter((f) => f !== cb); };
      },
      async save(col, doc) {
        const arr = read(col);
        doc.aggiornato = new Date().toISOString();
        const i = arr.findIndex((d) => d.id === doc.id);
        if (i >= 0) arr[i] = doc; else arr.push(doc);
        write(col, arr);
        return doc;
      },
      async saveMany(col, docs) {
        const arr = read(col);
        docs.forEach((doc) => {
          doc.aggiornato = doc.aggiornato || new Date().toISOString();
          const i = arr.findIndex((d) => d.id === doc.id);
          if (i >= 0) arr[i] = doc; else arr.push(doc);
        });
        write(col, arr);
      },
      async remove(col, id) {
        write(col, read(col).filter((d) => d.id !== id));
      },
      async removeMany(col, ids) { const via = new Set(ids); write(col, read(col).filter((d) => !via.has(d.id))); },
      // aggiunge in fondo senza avvisare l'app (usato per il registro attività); tiene solo gli ultimi "max"
      append(col, doc, max) {
        const arr = read(col); arr.push(doc);
        localStorage.setItem(PREFIX + col, JSON.stringify(max && arr.length > max ? arr.slice(arr.length - max) : arr));
      },
      async leggiTutti(col) { return read(col); },
      async svuota(col) { write(col, []); },
      // solo per la demo
      isSeeded() { return localStorage.getItem(PREFIX + '_seed') === '1'; },
      markSeeded() { localStorage.setItem(PREFIX + '_seed', '1'); },
      wipe() {
        Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
      },
      dumpAll(cols) { const o = {}; cols.forEach((c) => (o[c] = read(c))); return o; }
    };
  }

  function FirebaseBackend(cfg) {
    const V = '10.12.2';
    let db, auth, utenteAuth = null, accessoAppenaFatto = false;
    const load = (src) => new Promise((ok, ko) => {
      const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = ko;
      document.head.appendChild(s);
    });
    // Firestore non accetta liste dentro liste: le incapsulo e le ricostruisco in lettura
    const A = '_lista_';
    const codifica = (v) => {
      if (Array.isArray(v)) return v.map((x) => (Array.isArray(x) ? { [A]: codifica(x) } : codifica(x)));
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        const o = {}; Object.keys(v).forEach((k) => { if (v[k] !== undefined) o[k] = codifica(v[k]); }); return o;
      }
      return v;
    };
    const decodifica = (v) => {
      if (Array.isArray(v)) return v.map(decodifica);
      if (v && typeof v === 'object') {
        const k = Object.keys(v);
        if (k.length === 1 && k[0] === A) return decodifica(v[A]);
        const o = {}; k.forEach((x) => (o[x] = decodifica(v[x]))); return o;
      }
      return v;
    };
    const daDoc = (d) => ({ ...decodifica(d.data()), id: d.id });
    const aPezzi = (arr, n) => { const r = []; for (let i = 0; i < arr.length; i += n) r.push(arr.slice(i, i + n)); return r; };
    // ---- contatore dei consumi (letture, scritture, cancellazioni) per la pagina del Developer ----
    // Firebase non dà i consumi all'app: li conto io, operazione per operazione, e ogni tanto li sommo nel cloud
    // (raccolta "consumi", un documento per giorno). Il giorno è quello di Firebase: si azzera a mezzanotte ora della California.
    const giornoFb = () => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); } };
    const inSospeso = { r: 0, w: 0, d: 0 };
    const conta = (k, n = 1) => {
      inSospeso[k] += n;
      try { const g = 'gid_cons_' + giornoFb(), o = JSON.parse(localStorage.getItem(g) || '{"r":0,"w":0,"d":0}'); o[k] += n; localStorage.setItem(g, JSON.stringify(o)); } catch (e) {}
    };
    const nomeDisp = () => (utenteAuth?.email || 'sconosciuto').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    async function versaConsumi() {
      if (!db || !utenteAuth || !navigator.onLine) return;
      const { r, w, d } = inSospeso; if (!r && !w && !d) return;
      inSospeso.r = inSospeso.w = inSospeso.d = 0;
      const inc = firebase.firestore.FieldValue.increment;
      try {
        await db.collection('consumi').doc(giornoFb()).set({ letture: inc(r), scritture: inc(w + 1), cancellazioni: inc(d),
          dispositivi: { [nomeDisp()]: { letture: inc(r), scritture: inc(w + 1), cancellazioni: inc(d), ultimo: new Date().toISOString() } } }, { merge: true });
        try { const g = 'gid_cons_' + giornoFb(), o = JSON.parse(localStorage.getItem(g) || '{"r":0,"w":0,"d":0}'); o.w += 1; localStorage.setItem(g, JSON.stringify(o)); } catch (e) {}   // la scrittura del contatore stesso
      } catch (e) { inSospeso.r += r; inSospeso.w += w; inSospeso.d += d; }
    }
    setInterval(versaConsumi, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') versaConsumi(); });

    const scriviMolti = async (col, docs) => {
      conta('w', docs.length);
      for (const pezzo of aPezzi(docs, 400)) {
        const b = db.batch();
        pezzo.forEach((d) => b.set(db.collection(col).doc(d.id), codifica(d)));
        await b.commit();
      }
    };

    return {
      mode: 'cloud',
      async init() {
        await load(`https://www.gstatic.com/firebasejs/${V}/firebase-app-compat.js`);
        await load(`https://www.gstatic.com/firebasejs/${V}/firebase-auth-compat.js`);
        await load(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore-compat.js`);
        firebase.initializeApp(cfg);
        auth = firebase.auth();
        db = firebase.firestore();
        try { db.settings({ ignoreUndefinedProperties: true, merge: true }); } catch (e) {}
        // lavoro anche senza rete: i dati restano in copia sul dispositivo e si sincronizzano al ritorno della rete
        try { await db.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* non disponibile su questo browser */ }
        try { await auth.getRedirectResult(); } catch (e) {}
        utenteAuth = await new Promise((ok) => { const stop = auth.onAuthStateChanged((u) => { stop(); ok(u); }); });
      },
      // account Google collegato a questo dispositivo (null se non ancora fatto)
      account() { return utenteAuth ? (utenteAuth.email || '').toLowerCase() : null; },
      appenaEntrato() { return accessoAppenaFatto; },
      async loginGoogle() {
        const p = new firebase.auth.GoogleAuthProvider();
        p.setCustomParameters({ prompt: 'select_account' });
        let r;
        try { r = await auth.signInWithPopup(p); }
        catch (e) {
          if (/popup-blocked|operation-not-supported/.test(e.code || '')) { await auth.signInWithRedirect(p); return new Promise(() => {}); }
          throw e;
        }
        utenteAuth = r.user; accessoAppenaFatto = true;
        return (r.user.email || '').toLowerCase();
      },
      async esciGoogle() { await auth.signOut(); utenteAuth = null; },
      // tablet condiviso: accesso con il codice di attivazione (account tecnico, nessun account Google)
      dominioDispositivi: '@dispositivi.gruimpianti.app',
      isDispositivo(email) { return /@dispositivi\.gruimpianti\.app$/.test(email || this.account() || ''); },
      async loginDispositivo(codice) {
        const c = String(codice || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (c.length !== 12) throw new Error('codice');
        const r = await auth.signInWithEmailAndPassword(c.slice(0, 8).toLowerCase() + this.dominioDispositivi, c);
        utenteAuth = r.user; return (r.user.email || '').toLowerCase();
      },
      // il Master crea l'account del tablet (con un'app Firebase separata, così non esce dal suo account)
      async creaDispositivo() {
        const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const c = Array.from(crypto.getRandomValues(new Uint8Array(12)), (n) => A[n % A.length]).join('');
        const email = c.slice(0, 8).toLowerCase() + this.dominioDispositivi;
        const app2 = firebase.apps.find((a) => a.name === 'dispositivi') || firebase.initializeApp(cfg, 'dispositivi');
        await app2.auth().createUserWithEmailAndPassword(email, c);
        await app2.auth().signOut();
        return { email, codice: c.match(/.{4}/g).join('-') };
      },
      // livello dell'account Google secondo il cloud (o null se non autorizzato)
      async ruoloAccount(email) {
        try {
          const d = await db.collection('ruoli').doc(email).get(); if (!d.metadata.fromCache) conta('r');
          if (d.exists && d.data().nome) try { localStorage.setItem('gid_nome_disp', d.data().nome); } catch (e) {}
          return d.exists ? d.data().ruolo : (d.metadata && d.metadata.fromCache ? undefined : null);
        }
        catch (e) { return undefined; }   // senza risposta (es. offline): l'app usa l'ultimo livello noto
      },
      async impostaRuolo(email, ruolo, nome) { conta('w'); await db.collection('ruoli').doc(email).set({ ruolo, nome: nome || '', aggiornato: new Date().toISOString() }); },
      async togliRuolo(email) { conta('d'); await db.collection('ruoli').doc(email).delete(); },
      async elencoRuoli() { const q = await db.collection('ruoli').get(); conta('r', Math.max(1, q.size)); return q.docs.map((d) => ({ email: d.id, ...d.data() })); },
      // quanti documenti ci sono davvero sul server (per capire se il cloud è vuoto)
      async contaServer(col) { const q = await db.collection(col).limit(1).get({ source: 'server' }); conta('r'); return q.size; },
      subscribe(col, cb, errore) {
        return db.collection(col).onSnapshot((s) => {
          // si pagano solo i documenti arrivati dal server (non quelli già in copia sul dispositivo)
          if (!s.metadata.fromCache && !s.metadata.hasPendingWrites) conta('r', Math.max(1, s.docChanges().length));
          cb(s.docs.map(daDoc));
        }, (e) => { console.error(col, e); errore && errore(e); });
      },
      async save(col, doc) {
        doc.aggiornato = new Date().toISOString(); conta('w');
        // senza rete la scrittura resta in coda: non aspetto la conferma del server
        const p = db.collection(col).doc(doc.id).set(codifica(doc));
        if (navigator.onLine) await p; else p.catch((e) => console.error(e));
        return doc;
      },
      async saveMany(col, docs) {
        docs.forEach((d) => (d.aggiornato = d.aggiornato || new Date().toISOString()));
        await scriviMolti(col, docs);
      },
      caricaMolti: scriviMolti,
      // numero progressivo del rapportino assegnato dal cloud (contatore unico per anno, mai doppio)
      async assegnaNumero(anno, id, maxNoto) {
        const cRef = db.collection('contatori').doc('rapportini-' + anno), rRef = db.collection('rapportini').doc(id);
        conta('r', 2); conta('w', 2);
        return db.runTransaction(async (t) => {
          const c = await t.get(cRef), r = await t.get(rRef);
          if (!r.exists) return null;
          const rd = decodifica(r.data());
          if (rd.numero) return rd.numero;                       // già assegnato da un altro dispositivo
          const n = Math.max(c.exists ? +c.data().ultimo || 0 : 0, +maxNoto || 0) + 1;
          t.set(cRef, { ultimo: n, aggiornato: new Date().toISOString() });
          t.update(rRef, { numero: n, numeroInAttesa: false });
          return n;
        });
      },
      // cancella più documenti insieme (a blocchi di 400)
      async removeMany(col, ids) {
        conta('d', ids.length);
        for (const pezzo of aPezzi(ids, 400)) { const b = db.batch(); pezzo.forEach((id) => b.delete(db.collection(col).doc(id))); const p = b.commit(); if (navigator.onLine) await p; else p.catch((e) => console.error(e)); }
      },
      async remove(col, id) { conta('d'); const p = db.collection(col).doc(id).delete(); if (navigator.onLine) await p; },
      append(col, doc) { conta('w'); db.collection(col).doc(doc.id).set(codifica(doc)).catch(() => {}); },
      // cancella tutti i documenti di una raccolta (a blocchi di 400)
      async svuota(col) {
        const r = await db.collection(col).get(); conta('r', Math.max(1, r.size)); conta('d', r.size);
        for (const pezzo of aPezzi(r.docs, 400)) { const b = db.batch(); pezzo.forEach((d) => b.delete(db.collection(col).doc(d.id))); await b.commit(); }
      },
      async leggiTutti(col) {
        let q = db.collection(col);
        if (col === 'log') q = q.orderBy('t', 'desc').limit(10000);
        const r = await q.get(); conta('r', Math.max(1, r.size));
        return r.docs.map(daDoc);
      },
      // consumi: quelli di oggi di questo dispositivo e gli ultimi giorni di tutti (dal cloud)
      giornoFirebase: giornoFb,
      consumiDispositivo() { try { return JSON.parse(localStorage.getItem('gid_cons_' + giornoFb()) || '{"r":0,"w":0,"d":0}'); } catch (e) { return { r: 0, w: 0, d: 0 }; } },
      async consumiCloud(giorni = 30) {
        await versaConsumi();
        // dal giorno di inizio in avanti (ordine crescente: non serve un indice apposta)
        const da = new Date(giornoFb() + 'T12:00:00'); da.setDate(da.getDate() - giorni + 1);
        const q = await db.collection('consumi').where(firebase.firestore.FieldPath.documentId(), '>=', da.toISOString().slice(0, 10)).get();
        conta('r', Math.max(1, q.size));
        return q.docs.map((d) => ({ giorno: d.id, ...d.data() }));
      },
      progetto: () => cfg.projectId,
      isSeeded() { return true; }, markSeeded() {}, wipe() {}, dumpAll() { return {}; }
    };
  }

  // dati rimasti sul dispositivo dalla versione "solo su questo dispositivo" (per caricarli nel cloud)
  window.DatiLocali = {
    leggi(col) { try { return JSON.parse(localStorage.getItem(PREFIX + col) || '[]'); } catch (e) { return []; } },
    conta(cols) { const o = {}; cols.forEach((c) => (o[c] = this.leggi(c).length)); return o; }
  };

  // la vecchia modalità dimostrazione non c'è più: se su questo dispositivo era rimasta attiva, cancello i suoi dati inventati
  try {
    if (localStorage.getItem('gid_modo_prova') !== null || Object.keys(localStorage).some((k) => k.startsWith('gid_prova_') || k.startsWith('lavagna_prova_'))) {
      Object.keys(localStorage).filter((k) => k.startsWith('gid_prova_') || k.startsWith('lavagna_prova_')).forEach((k) => localStorage.removeItem(k));
      localStorage.removeItem('gid_modo_prova');
    }
  } catch (e) {}
  const base = window.firebaseConfig ? FirebaseBackend(window.firebaseConfig) : LocalBackend(PREFIX, 'locale');
  window.Backend = inTest() ? ModoTest(base) : base;

  // ===== MODALITÀ TEST (tasto 🧪 del Developer) =====
  // Si vedono i dati veri, ma tutto quello che si salva o si cancella resta solo su questo dispositivo
  // (in un «foglio trasparente» sopra i dati veri): il cloud non viene mai toccato.
  function inTest() { try { return localStorage.getItem('gid_test') === '1'; } catch (e) { return false; } }
  function ModoTest(B) {
    const K = 'gid_test_dati';
    let ov = {}; try { ov = JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) {}
    const ultimi = {}, cbs = {};
    const copia = (d) => JSON.parse(JSON.stringify(d));
    const salvaOv = () => { try { localStorage.setItem(K, JSON.stringify(ov)); } catch (e) { try { UI.toast('Modalità test: memoria del dispositivo piena', 'err'); } catch (x) {} } };
    const unisci = (col, lista) => {
      const o = ov[col]; if (!o) return lista;
      const m = new Map((lista || []).map((d) => [d.id, d]));
      for (const [id, d] of Object.entries(o)) { if (d === null) m.delete(id); else m.set(id, copia(d)); }
      return [...m.values()];
    };
    const avvisa = (col) => (cbs[col] || []).forEach((cb) => cb(unisci(col, ultimi[col] || [])));
    const metti = (col, doc) => { (ov[col] = ov[col] || {})[doc.id] = copia(doc); };
    const W = Object.create(B);
    return Object.assign(W, {
      test: true,
      subscribe(col, cb, errore) {
        (cbs[col] = cbs[col] || []).push(cb);
        return B.subscribe(col, (lista) => { ultimi[col] = lista; cb(unisci(col, lista)); }, errore);
      },
      async save(col, doc) { doc.aggiornato = new Date().toISOString(); metti(col, doc); salvaOv(); avvisa(col); return doc; },
      async saveMany(col, docs) { docs.forEach((d) => { d.aggiornato = d.aggiornato || new Date().toISOString(); metti(col, d); }); salvaOv(); avvisa(col); },
      async caricaMolti(col, docs) { docs.forEach((d) => metti(col, d)); salvaOv(); avvisa(col); },
      async remove(col, id) { (ov[col] = ov[col] || {})[id] = null; salvaOv(); avvisa(col); },
      async removeMany(col, ids) { ids.forEach((id) => ((ov[col] = ov[col] || {})[id] = null)); salvaOv(); avvisa(col); },
      append() { /* registro attività: in test non si scrive */ },
      async leggiTutti(col) { let l = []; try { l = await B.leggiTutti(col); } catch (e) { l = ultimi[col] || []; } return unisci(col, l); },
      async svuota(col) { (await this.leggiTutti(col)).forEach((d) => ((ov[col] = ov[col] || {})[d.id] = null)); salvaOv(); avvisa(col); },
      async assegnaNumero(anno, id, maxNoto) {
        const r = unisci('rapportini', ultimi.rapportini || []).find((x) => x.id === id); if (!r) return null;
        if (r.numero) return r.numero;
        const n = (+maxNoto || 0) + 1; metti('rapportini', { ...r, numero: n, numeroInAttesa: false }); salvaOv(); avvisa('rapportini'); return n;
      },
      async impostaRuolo() {}, async togliRuolo() {},
      async creaDispositivo() { throw new Error('In modalità test non si attivano tablet'); },
      // quante modifiche di prova ci sono
      modificheTest() { return Object.values(ov).reduce((t, o) => t + Object.keys(o).length, 0); },
      svuotaTest() { ov = {}; try { localStorage.removeItem(K); } catch (e) {} }
    });
  }
})();
