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
    let db;
    const load = (src) => new Promise((ok, ko) => {
      const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = ko;
      document.head.appendChild(s);
    });
    return {
      mode: 'cloud',
      async init() {
        const v = '10.12.2';
        await load(`https://www.gstatic.com/firebasejs/${v}/firebase-app-compat.js`);
        await load(`https://www.gstatic.com/firebasejs/${v}/firebase-firestore-compat.js`);
        firebase.initializeApp(cfg);
        db = firebase.firestore();
        try { await db.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* offline non disponibile */ }
      },
      subscribe(col, cb) {
        return db.collection(col).onSnapshot((s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
      },
      async save(col, doc) {
        doc.aggiornato = new Date().toISOString();
        await db.collection(col).doc(doc.id).set(doc);
        return doc;
      },
      async saveMany(col, docs) {
        const b = db.batch();
        docs.forEach((d) => b.set(db.collection(col).doc(d.id), d));
        await b.commit();
      },
      remove(col, id) { return db.collection(col).doc(id).delete(); },
      append(col, doc) { db.collection(col).doc(doc.id).set(doc); },
      async leggiTutti(col) { const q = await db.collection(col).get(); return q.docs.map((d) => ({ id: d.id, ...d.data() })); },
      // accesso con Google (solo online): restituisce l'email dell'account scelto
      async loginGoogle() {
        if (!firebase.auth) await load(`https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js`);
        const r = await firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider());
        return r.user.email;
      },
      isSeeded() { return true; }, markSeeded() {}, wipe() {}, dumpAll() { return {}; }
    };
  }

  window.Backend = window.firebaseConfig ? FirebaseBackend(window.firebaseConfig) : LocalBackend();
})();
