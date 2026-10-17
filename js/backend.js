// ===== BACKEND INTERCAMBIABILE =====
// Stesse funzioni per locale e cloud: init / subscribe / save / remove.
// Il resto dell'app usa SOLO window.Backend, quindi passare al cloud
// significa solo compilare firebaseConfig in config.js.
(function () {
  const PREFIX = 'gid_demo_';

  function LocalBackend() {
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
      mode: 'locale',
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
      // aggiunge in fondo senza avvisare l'app (usato per il registro attività); tiene solo gli ultimi "max"
      append(col, doc, max) {
        const arr = read(col); arr.push(doc);
        localStorage.setItem(PREFIX + col, JSON.stringify(max && arr.length > max ? arr.slice(arr.length - max) : arr));
      },
      async leggiTutti(col) { return read(col); },
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
    const scriviMolti = async (col, docs) => {
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
      // livello dell'account Google secondo il cloud (o null se non autorizzato)
      async ruoloAccount(email) {
        try { const d = await db.collection('ruoli').doc(email).get(); return d.exists ? d.data().ruolo : null; }
        catch (e) { return null; }
      },
      async impostaRuolo(email, ruolo, nome) { await db.collection('ruoli').doc(email).set({ ruolo, nome: nome || '', aggiornato: new Date().toISOString() }); },
      async togliRuolo(email) { await db.collection('ruoli').doc(email).delete(); },
      async elencoRuoli() { const q = await db.collection('ruoli').get(); return q.docs.map((d) => ({ email: d.id, ...d.data() })); },
      // quanti documenti ci sono davvero sul server (per capire se il cloud è vuoto)
      async contaServer(col) { const q = await db.collection(col).limit(1).get({ source: 'server' }); return q.size; },
      subscribe(col, cb, errore) {
        return db.collection(col).onSnapshot((s) => cb(s.docs.map(daDoc)), (e) => { console.error(col, e); errore && errore(e); });
      },
      async save(col, doc) {
        doc.aggiornato = new Date().toISOString();
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
      async remove(col, id) { const p = db.collection(col).doc(id).delete(); if (navigator.onLine) await p; },
      append(col, doc) { db.collection(col).doc(doc.id).set(codifica(doc)).catch(() => {}); },
      async leggiTutti(col) {
        let q = db.collection(col);
        if (col === 'log') q = q.orderBy('t', 'desc').limit(10000);
        const r = await q.get();
        return r.docs.map(daDoc);
      },
      isSeeded() { return true; }, markSeeded() {}, wipe() {}, dumpAll() { return {}; }
    };
  }

  // dati rimasti sul dispositivo dalla versione "solo su questo dispositivo" (per caricarli nel cloud)
  window.DatiLocali = {
    leggi(col) { try { return JSON.parse(localStorage.getItem(PREFIX + col) || '[]'); } catch (e) { return []; } },
    conta(cols) { const o = {}; cols.forEach((c) => (o[c] = this.leggi(c).length)); return o; }
  };

  window.Backend = window.firebaseConfig ? FirebaseBackend(window.firebaseConfig) : LocalBackend();
})();
