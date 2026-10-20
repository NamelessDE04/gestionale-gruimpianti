// ===== IMPORTA DATI (solo Master) =====
// Carica un file .json preparato apposta (es. dal registro clienti o dal database del programma vecchio).
// Prima mostra cosa cambierà, poi salva. Non crea doppioni: clienti uguali (stessa ragione sociale) e sedi uguali
// (stessa sigla o stesso nome) vengono completati, non duplicati. Non cancella mai niente.
window.IMPORTA = (function () {
  const { esc, uid } = UI;
  const norm = (t) => String(t || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  // stessa sede: stesso nome; se uno dei due nomi manca, conta la sigla (due sedi possono avere la stessa sigla, es. FINDER)
  const stessaSede = (a, b) => (norm(a.nome) && norm(b.nome) ? norm(a.nome) === norm(b.nome) : !!(a.sigla && b.sigla && norm(a.sigla) === norm(b.sigla)));

  // calcola cosa succede, senza salvare niente
  function piano(S, dati) {
    const out = { nuoviClienti: 0, nuoveSedi: 0, aggiornati: 0, docs: [] };
    (dati.clienti || []).forEach((ci) => {
      if (!ci.ragioneSociale) return;
      const es = S.clienti.find((c) => norm(c.ragioneSociale) === norm(ci.ragioneSociale));
      const doc = es ? JSON.parse(JSON.stringify(es)) : { id: uid(), ragioneSociale: ci.ragioneSociale.toUpperCase(), sedi: [], referenti: [] };
      let cambiato = !es;
      ['piva', 'cf', 'sdi', 'telefono', 'email', 'pec', 'note'].forEach((k) => { if (ci[k] && !doc[k]) { doc[k] = ci[k]; cambiato = true; } });
      (ci.sedi || []).forEach((si) => {
        let sd = doc.sedi.find((x) => stessaSede(x, si));
        if (!sd) { sd = { id: uid() }; doc.sedi.push(sd); out.nuoveSedi++; cambiato = true; }
        ['nome', 'sigla', 'indirizzo', 'cap', 'citta', 'provincia', 'note'].forEach((k) => { if (si[k] && !sd[k]) { sd[k] = String(si[k]).toUpperCase(); cambiato = true; } });
        if (si.mese1 && !sd.pianoControlli) { sd.pianoControlli = { mese1: +si.mese1, annuale: 1 }; cambiato = true; }
        Object.entries(si.ordini || {}).forEach(([a, n]) => { if (n && !(sd.ordini || {})[a]) { sd.ordini = { ...(sd.ordini || {}), [a]: String(n).toUpperCase() }; cambiato = true; } });
      });
      (ci.referenti || []).forEach((ri) => {
        const nomeR = norm([ri.nome, ri.cognome].join(' '));
        if (!nomeR || doc.referenti.some((r) => norm([r.nome, r.cognome].join(' ')) === nomeR)) return;
        doc.referenti.push({ id: uid(), ...ri }); cambiato = true;
      });
      if (!cambiato) return;
      if (es) out.aggiornati++; else out.nuoviClienti++;
      out.docs.push({ doc, nuovo: !es });
    });
    return out;
  }

  function pagina(el, S) {
    el.innerHTML = `
      <section class="cli">
        <div class="sez-head"><h1>Importa dati ${UI.info('Carica il file .json che ti ho preparato. Prima di salvare vedi cosa verrà aggiunto. I clienti già presenti (stessa ragione sociale) vengono completati e non duplicati; le sedi vengono riconosciute dalla sigla o dal nome. Non viene cancellato niente.')}</h1></div>
        <div class="card form">
          <label>File da importare (.json)<input type="file" id="fImp" accept=".json,application/json"></label>
          <div id="anteprima"></div>
        </div>
      </section>`;
    el.querySelector('#fImp').onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      let dati;
      try { dati = JSON.parse(await file.text()); } catch (er) { return UI.toast('Il file non è valido', 'err'); }
      if (dati.tipo !== 'gestionale-gruimpianti-import') return UI.toast('Questo file non è un file di importazione del gestionale', 'err');
      const p = piano(S, dati), box = el.querySelector('#anteprima');
      box.innerHTML = `
        <div class="imp-ris">
          <p><b>${p.nuoviClienti}</b> clienti nuovi · <b>${p.nuoveSedi}</b> sedi nuove · <b>${p.aggiornati}</b> clienti già presenti da completare</p>
          <div class="imp-lista">${p.docs.map(({ doc, nuovo }) => `<div><span class="pill ${nuovo ? 'st-ok' : 'st-mai'}">${nuovo ? 'nuovo' : 'completa'}</span> <b>${esc(doc.ragioneSociale)}</b> <span class="muted small">${doc.sedi.map((s) => esc(s.sigla || s.nome)).join(' · ')}</span></div>`).join('') || '<p class="muted">Niente da importare: è già tutto presente.</p>'}</div>
          ${p.docs.length ? '<div class="azioni-form"><span class="grow"></span><button class="btn big" id="btnImp">📥 Importa</button></div>' : ''}
        </div>`;
      box.querySelector('#btnImp')?.addEventListener('click', async (ev) => {
        if (Backend.mode === 'cloud' && !navigator.onLine) return UI.toast('Serve internet', 'err');
        ev.target.disabled = true;
        let n = 0;
        for (const { doc } of p.docs) { await UI.salva('clienti', doc); n++; ev.target.textContent = `Importo… ${n}/${p.docs.length}`; }
        UT.registra('creazione', `Importazione dati: ${p.nuoviClienti} clienti nuovi, ${p.nuoveSedi} sedi nuove, ${p.aggiornati} completati`);
        UI.toast('Importazione completata', 'ok'); location.hash = '#/clienti';
      });
    };
    return { titolo: 'Importa dati', indietro: '#/profilo', live: false };
  }
  return { pagina, piano };
})();
