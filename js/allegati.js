// ===== ALLEGATI (schemi elettrici, PDF, foto…) =====
// I file sono pesanti: non vanno nel localStorage ma in IndexedDB del dispositivo.
// Nel documento dell'impianto resta solo l'elenco (nome, tipo, dimensione).
// Con il cloud, queste tre funzioni verranno sostituite da Firebase Storage.
window.ALLEGATI = (function () {
  let dbp;
  const db = () => dbp || (dbp = new Promise((ok, ko) => {
    const r = indexedDB.open('gid_allegati', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('file');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  }));
  const tx = async (modo, fn) => {
    const d = await db();
    return new Promise((ok, ko) => {
      const t = d.transaction('file', modo); const req = fn(t.objectStore('file'));
      t.oncomplete = () => ok(req && req.result); t.onerror = () => ko(t.error); t.onabort = () => ko(t.error);
    });
  };
  const MAX = 25 * 1024 * 1024; // 25 MB per file

  return {
    MAX,
    salva: (id, blob) => tx('readwrite', (s) => s.put(blob, id)),
    leggi: (id) => tx('readonly', (s) => s.get(id)),
    elimina: (id) => tx('readwrite', (s) => s.delete(id)),
    async apri(id, nome) {
      const b = await this.leggi(id);
      if (!b) return UI.toast('File non trovato su questo dispositivo', 'err');
      const url = URL.createObjectURL(b);
      const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener';
      if (!/pdf|image/.test(b.type)) a.download = nome || 'allegato';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    },
    dimensione: (n) => (n > 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB')
  };
})();
