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
    const out = { nuoviClienti: 0, nuoveSedi: 0, aggiornati: 0, docs: [], impianti: [], tipologie: [], sottoganci: [], giri: [], schede: [], schedeSenzaGru: 0, schedeGia: 0, schedeRifatte: 0, modelli: [], attrezzi: [], ctrAttrezzi: [] };
    const tipiNoti = new Set(IMP.TIPOLOGIE_BASE.concat((S.impostazioni.find((x) => x.id === 'tipologieGru') || {}).voci || []).map(norm));
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
        if (si.km && !sd.km) { sd.km = +si.km; cambiato = true; }
        if (si.mese1 && !sd.pianoControlli) { sd.pianoControlli = { mese1: +si.mese1, annuale: +si.annuale || 1 }; cambiato = true; }
        // sottoganci della sede (elenchi funi): la sede diventa una cartella sottoganci; stesso numero = già presente
        if ((si.sottoganci || []).length) {
          if (!sd.cartellaSottoganci) { sd.cartellaSottoganci = true; cambiato = true; }
          if (si.titoloElenco && !sd.titoloElenco) { sd.titoloElenco = String(si.titoloElenco).toUpperCase(); cambiato = true; }
        }
        (si.sottoganci || []).forEach((g) => {
          if (S.sottoganci.some((x) => x.sedeId === sd.id && norm(x.numero) === norm(g.numero))) return;
          out.sottoganci.push({ id: uid(), sedeId: sd.id, clienteId: doc.id, numero: String(g.numero), portata: g.portata || '', ubicazione: g.ubicazione || '', certificato: g.certificato || '', dismesso: !!g.dismesso,
            parti: (g.parti || []).map((p) => ({ denominazione: String(p.denominazione || '').toUpperCase(), dimensioni: String(p.dimensioni || '').toUpperCase() })) });
          cambiato = true;
        });
        // controlli sottoganci già fatti (giri): righe indicate per numero; uno per anno+fascetta, mai doppioni
        (si.giri || []).forEach((gi) => {
          const anno = +gi.anno, slot = +gi.slot;
          if (!anno || !(slot >= 1 && slot <= 4)) return;
          if (S.giriSottoganci.some((x) => x.sedeId === sd.id && x.anno === anno && x.slot === slot)) return;
          const tutti = S.sottoganci.filter((x) => x.sedeId === sd.id).concat(out.sottoganci.filter((x) => x.sedeId === sd.id));
          const righe = {};
          Object.entries(gi.righe || {}).forEach(([num, r]) => {
            const sg = tutti.find((x) => norm(x.numero) === norm(num));
            if (!sg) return;
            righe[sg.id] = { codici: sg.parti.map((_, i) => String((r.codici || [])[i] || '').toUpperCase()), note: sg.parti.map((_, i) => String((r.note || [])[i] || '')) };
          });
          if (!Object.keys(righe).length) return;
          out.giri.push({ id: uid(), sedeId: sd.id, clienteId: doc.id, anno, slot, data: gi.data || '', tecnici: [], tecnico: gi.tecnico || '', righe, noteGenerali: gi.noteGenerali || '', firmaTecnico: null });
        });
        // sottoganci composti: se la prima riga (senza dimensioni) non ha mai il giudizio e gli altri componenti sì,
        // è solo il nome dell'insieme (es. TIRANTE 2 BRACCI) → resta come titolo, senza giudizio
        out.sottoganci.filter((x) => x.sedeId === sd.id && x.parti.length > 1 && !x.parti[0].dimensioni).forEach((x) => {
          const r = out.giri.filter((gi) => gi.sedeId === sd.id).map((gi) => gi.righe[x.id]).filter(Boolean);
          if (r.length && r.every((y) => !y.codici[0]) && r.some((y) => y.codici.slice(1).some(Boolean))) x.primaTitolo = true;
        });
        // attrezzi sottogancio dei controlli approfonditi (pinze/ganci a C, magneti) con i loro controlli
        (si.attrezzi || []).forEach((ai) => {
          const stesso = (x) => x.sedeId === sd.id && x.tipo === ai.tipo && ((ai.nFabbrica && norm(x.nFabbrica) === norm(ai.nFabbrica)) || (ai.nInterno && norm(x.nInterno) === norm(ai.nInterno)) || (ai.matricola && norm(x.matricola) === norm(ai.matricola)));
          let a = (S.attrezzi || []).find(stesso) || out.attrezzi.find(stesso);
          if (!a) {
            const { controlli, ...dati } = ai;
            a = { id: uid(), sedeId: sd.id, clienteId: doc.id, casa: '', nInterno: '', portata: '', nFabbrica: '', matricola: '', tipoDesc: '', anno: '', classe: '', accessori: '', componenti: [], ...dati, dismesso: !!ai.dismesso };
            out.attrezzi.push(a); cambiato = true;
          }
          (ai.controlli || []).forEach((ci) => {
            const gia = (x) => x.attrezzoId === a.id && x.anno === +ci.anno && x.slot === +ci.slot;
            if ((S.controlliAttrezzi || []).some(gia) || out.ctrAttrezzi.some(gia)) return;
            out.ctrAttrezzi.push({ id: uid(), attrezzoId: a.id, tipo: a.tipo, sedeId: sd.id, clienteId: doc.id, anno: +ci.anno, slot: +ci.slot, data: ci.data || '', righe: ci.righe || [], note: ci.note || '', fuoriServizio: !!ci.fuoriServizio, tecnici: [], tecnico: '', firmaTecnico: null });
          });
        });
        // impianti della sede (dal programma vecchio): non si duplicano (stesso codice vecchio o stessa matricola + n° interno)
        (si.impianti || []).forEach((ii) => {
          const gia = S.impianti.some((x) => (ii.vecchioCodice && x.vecchioCodice === ii.vecchioCodice)
            || (x.sedeId === sd.id && norm(x.matricola) && norm(x.matricola) === norm(ii.matricola) && norm(x.numeroInterno) === norm(ii.numeroInterno)));
          const giaNelFile = out.impianti.some((x) => (ii.vecchioCodice && x.vecchioCodice === ii.vecchioCodice)
            || (x.sedeId === sd.id && norm(x.matricola) && norm(x.matricola) === norm(ii.matricola) && norm(x.numeroInterno) === norm(ii.numeroInterno)));
          if (gia || giaNelFile) return;
          out.impianti.push({ id: uid(), clienteId: doc.id, sedeId: sd.id, dismesso: false, ...ii });
          if (ii.tipologia && !tipiNoti.has(norm(ii.tipologia))) { tipiNoti.add(norm(ii.tipologia)); out.tipologie.push(ii.tipologia); }
          cambiato = true;
        });
        Object.entries(si.ordini || {}).forEach(([a, n]) => { if (n && !(sd.ordini || {})[a]) { sd.ordini = { ...(sd.ordini || {}), [a]: String(n).toUpperCase() }; cambiato = true; } });
      });
      (ci.referenti || []).forEach((ri) => {
        const nomeR = norm([ri.nome, ri.cognome].join(' '));
        if (!nomeR || doc.referenti.some((r) => norm([r.nome, r.cognome].join(' ')) === nomeR)) return;
        doc.referenti.push({ id: uid(), ...ri }); cambiato = true;
      });
      if (!cambiato && !out.giri.some((g) => g.clienteId === doc.id) && !out.ctrAttrezzi.some((g) => g.clienteId === doc.id)) return;
      if (es) out.aggiornati++; else out.nuoviClienti++;
      out.docs.push({ doc, nuovo: !es });
    });
    storico(S, dati, out);
    // modelli di scheda (voci di controllo): uno con lo stesso nome non si duplica
    const nomiMod = ((S.impostazioni.find((x) => x.id === 'modelliScheda') || {}).modelli || []).map((m) => norm(m.nome));
    (dati.modelliScheda || []).forEach((m) => { if (m.nome && (m.voci || []).length && !nomiMod.includes(norm(m.nome))) out.modelli.push(m); });
    return out;
  }

  // storico controlli gru (programma vecchio): una scheda per impianto e per anno. La gru si trova dal codice vecchio;
  // le voci si abbinano per nome a quelle del modello (così i controlli nuovi dello stesso anno continuano sulla stessa riga).
  // Una scheda che c'è già non viene mai toccata.
  function storico(S, dati, out) {
    const nt = (t) => norm(t).replace(/ /g, '');
    const perCodice = {};
    S.impianti.slice().sort((a, b) => String(a.id).localeCompare(String(b.id))).forEach((i) => { if (i.vecchioCodice && !perCodice[i.vecchioCodice]) perCodice[i.vecchioCodice] = i; });
    const utenteDi = (nome) => { const n = nt(nome); return n ? (S.utenti || []).find((u) => nt(u.nome) && (nt(u.nome) === n || n.includes(nt(u.nome)) || nt(u.nome).includes(n))) : null; };
    (dati.storicoControlli || []).forEach((x) => {
      const i = perCodice[x.vecchioCodice];
      if (!i) { out.schedeSenzaGru++; return; }
      const anno = +x.anno;
      // una scheda già importata dal programma vecchio e non ancora toccata in app si può rifare (es. file rigenerato)
      const es = S.schedeControllo.find((sc) => sc.impiantoId === i.id && sc.anno === anno);
      const rifacibile = es && es.importato && Object.values(es.visite || {}).every((v) => v._da === 'programma vecchio');
      if ((es && !rifacibile) || out.schede.some((sc) => sc.impiantoId === i.id && sc.anno === anno)) { out.schedeGia++; return; }
      if (rifacibile) out.schedeRifatte++;
      const modello = CTR.vociPerImpianto(S, i), usate = new Set(), mappa = {};
      const voci = x.voci.map((ov) => {
        const a = nt(ov.testo);
        const m = modello.find((v) => !usate.has(v.id) && (nt(v.testo) === a || (a.length >= 8 && (nt(v.testo).startsWith(a) || a.startsWith(nt(v.testo))))));
        const v = m ? { ...m } : { id: uid(), per: ov.per, testo: String(ov.testo).toUpperCase(), tipo: 'codice', ...(/DIAMETRO/i.test(ov.testo) ? { valore: true, unita: 'mm' } : {}) };
        usate.add(v.id); mappa[ov.k] = v.id; return v;
      });
      const np = Math.max(1, (i.paranchi || []).length), giusta = (arr) => Array.from({ length: Math.max(np, (arr || []).length) }, (_, k) => (arr || [])[k] || '');
      const visite = {};
      Object.entries(x.visite || {}).forEach(([n, ov]) => {
        const u = utenteDi(ov.tecnico), esiti = {}, valori = {};
        Object.entries(ov.esiti || {}).forEach(([k, e]) => { if (mappa[k]) esiti[mappa[k]] = giusta(e); });
        Object.entries(ov.valori || {}).forEach(([k, e]) => { if (mappa[k]) valori[mappa[k]] = giusta(e); });
        visite[n] = { dataScheda: ov.data, dataEsecuzione: ov.data, tecnici: ov.tecnico ? [{ id: u?.id || '', nome: u ? u.nome : ov.tecnico }] : [], tecnico: u ? u.nome : (ov.tecnico || ''),
          firmaDi: u?.id || null, firma: ov.firma || null, esiti, valori, _da: 'programma vecchio' };
      });
      const osservazioni = (x.osservazioni || []).map((o) => ({ lettera: o.lettera, testo: o.testo, vocId: mappa[o.vocK] || '', p: o.p || 1, visita: +o.visita, data: o.data, ...(o.risoltaIl ? { risoltaIl: o.risoltaIl } : {}) }));
      out.schede.push({ id: i.id + '-' + anno, impiantoId: i.id, sedeId: i.sedeId, clienteId: i.clienteId, anno, voci, visite, osservazioni, ...(x.note ? { noteVecchie: x.note } : {}), importato: true });
    });
  }

  // impianti doppi: stessa sede e stesso codice del programma vecchio. Si tiene quello con più cose collegate;
  // si eliminano solo le copie senza niente collegato (controlli, schede approfondite, posizione nel layout).
  function doppi(S) {
    const usi = (i) => S.schedeControllo.filter((x) => x.impiantoId === i.id).length
      + (S.schedeApprofondite || []).filter((x) => x.impiantoId === i.id).length
      + (S.layouts || []).filter((L) => (L.impianti || []).some((p) => p.impId === i.id)).length;
    const gruppi = {};
    S.impianti.forEach((i) => { if (i.vecchioCodice) (gruppi[i.sedeId + '|' + i.vecchioCodice] = gruppi[i.sedeId + '|' + i.vecchioCodice] || []).push(i); });
    const via = []; let restano = 0;
    Object.values(gruppi).filter((g) => g.length > 1).forEach((g) => {
      const ord = g.map((i) => ({ i, u: usi(i) })).sort((a, b) => b.u - a.u);
      ord.slice(1).forEach((x) => { if (x.u) restano++; else via.push(x.i); });
    });
    return { via, restano };
  }

  function pagina(el, S) {
    el.innerHTML = `
      <section class="cli">
        <div class="sez-head"><h1>Importa dati ${UI.info('Carica il file .json che ti ho preparato. Prima di salvare vedi cosa verrà aggiunto. I clienti già presenti (stessa ragione sociale) vengono completati e non duplicati; le sedi vengono riconosciute dalla sigla o dal nome. Non viene cancellato niente.')}</h1></div>
        <div class="card form">
          <label>File da importare (.json)<input type="file" id="fImp"></label>
          <div id="anteprima"></div>
        </div>
        ${(() => { const d = doppi(S); return d.via.length || d.restano ? `<div class="card form">
          <h2>🧹 Impianti doppi</h2>
          <p>${d.via.length ? `Trovati <b>${d.via.length}</b> impianti doppi (stessa gru importata due volte nella stessa sede).` : ''}${d.restano ? ` <span class="muted small">${d.restano} doppi hanno già controlli o layout collegati: quelli vanno guardati a mano.</span>` : ''}</p>
          ${d.via.length ? '<div class="azioni-form"><span class="grow"></span><button type="button" class="btn danger" id="btnDoppi">🧹 Elimina i doppi</button></div>' : ''}
        </div>` : ''; })()}
      </section>`;
    el.querySelector('#btnDoppi')?.addEventListener('click', async (ev) => {
      const d = doppi(S);
      if (!UI.conferma(`Eliminare ${d.via.length} impianti doppi?\n\nResta una sola copia di ogni gru. Vengono eliminati solo i doppi senza controlli, layout o schede collegati.`)) return;
      if (Backend.mode === 'cloud' && !navigator.onLine) return UI.toast('Serve internet', 'err');
      ev.target.disabled = true; ev.target.textContent = 'Elimino…';
      await Backend.removeMany('impianti', d.via.map((x) => x.id));
      UT.registra('eliminazione', `Eliminati ${d.via.length} impianti doppi (importazione)`);
      UI.toast(`Eliminati ${d.via.length} impianti doppi`, 'ok'); App.ridisegna();
    });
    el.querySelector('#fImp').onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      let dati;
      try { dati = JSON.parse(await file.text()); } catch (er) { return UI.toast('Il file non è valido', 'err'); }
      // file di un layout (es. preparato da un PDF): chiedo di quale sede è e lo carico lì
      if (dati.formato === 'gid-layout') {
        const sedi = CTR.sediConImpianti(S).map(({ c, s }) => ({ id: s.id, nome: CTR.nomeSede(c, s) }));
        const parole = String(dati.titolo || '').toUpperCase().split(/[^A-Z0-9]+/).filter((w) => w.length > 2);
        const punti = (x) => parole.filter((w) => x.nome.toUpperCase().includes(w)).length;
        const meglio = sedi.slice().sort((a, b) => punti(b) - punti(a))[0];
        return UI.modal({
          titolo: 'Layout · di quale sede?', testoSalva: 'Avanti',
          infoTxt: 'Questo file è un layout (capannoni e posizione delle gru). Scegli la sede: poi ti chiedo se mettere solo le gru nel tuo disegno o sostituirlo, e prima salvo una copia del layout di adesso.',
          valori: { sede: meglio && punti(meglio) ? meglio.nome : '' },
          campi: [{ k: 'sede', label: 'Sede', tipo: 'select', opzioni: sedi.map((x) => x.nome) }],
          onSalva: (v) => { const sd = sedi.find((x) => x.nome.toUpperCase() === String(v.sede).toUpperCase()); if (!sd) { UI.toast('Scegli la sede', 'err'); return false; }
            setTimeout(() => LAY.applica(S, sd.id, dati, () => (location.hash = '#/layout/s/' + sd.id)), 50); }
        });
      }
      if (dati.tipo !== 'gestionale-gruimpianti-import') return UI.toast('Questo file non è un file di importazione del gestionale', 'err');
      const p = piano(S, dati), box = el.querySelector('#anteprima');
      box.innerHTML = `
        <div class="imp-ris">
          <p><b>${p.nuoviClienti}</b> clienti nuovi · <b>${p.nuoveSedi}</b> sedi nuove · <b>${p.aggiornati}</b> clienti già presenti da completare · <b>${p.impianti.length}</b> impianti nuovi${p.sottoganci.length ? ` · <b>${p.sottoganci.length}</b> sottoganci nuovi` : ''}${p.giri.length ? ` · <b>${p.giri.length}</b> controlli sottoganci` : ''}${p.attrezzi.length || p.ctrAttrezzi.length ? ` · <b>${p.attrezzi.length}</b> pinze/ganci a C o magneti con <b>${p.ctrAttrezzi.length}</b> controlli` : ''}${p.modelli.length ? ` · <b>${p.modelli.length}</b> ${p.modelli.length === 1 ? 'modello' : 'modelli'} di scheda (${p.modelli.map((m) => esc(m.nome)).join(', ')})` : ''}${p.schede.length ? ` · <b>${p.schede.length}</b> schede controlli gru (${p.schede.reduce((n, x) => n + Object.keys(x.visite).length, 0)} controlli)` : ''}</p>
          ${p.schedeGia || p.schedeSenzaGru || p.schedeRifatte ? `<p class="muted small">${p.schedeRifatte ? `${p.schedeRifatte} schede importate prima vengono rifatte con i dati nuovi. ` : ''}${p.schedeGia ? `${p.schedeGia} schede ci sono già (compilate in app) e non vengono toccate. ` : ''}${p.schedeSenzaGru ? `${p.schedeSenzaGru} schede sono di gru che non ci sono nell'anagrafica (eliminate o non importate): saltate.` : ''}</p>` : ''}
          ${p.tipologie.length ? `<p class="muted small">Tipologie di gru nuove da aggiungere all'elenco: ${p.tipologie.map(esc).join(', ')}</p>` : ''}
          <div class="imp-lista">${p.docs.map(({ doc, nuovo }) => { const ni = p.impianti.filter((x) => x.clienteId === doc.id).length, ns = p.sottoganci.filter((x) => x.clienteId === doc.id).length, ng = p.giri.filter((x) => x.clienteId === doc.id).length; return `<div><span class="pill ${nuovo ? 'st-ok' : 'st-mai'}">${nuovo ? 'nuovo' : 'completa'}</span> <b>${esc(doc.ragioneSociale)}</b> <span class="muted small">${doc.sedi.map((s) => esc(s.sigla || s.nome)).join(' · ')}${ni ? ` · ${ni} impianti` : ''}${ns ? ` · ${ns} sottoganci` : ''}${ng ? ` · ${ng} controlli` : ''}</span></div>`; }).join('') || (p.schede.length || p.modelli.length ? '' : '<p class="muted">Niente da importare: è già tutto presente.</p>')}</div>
          ${p.docs.length || p.schede.length || p.modelli.length ? '<div class="azioni-form"><span class="grow"></span><button class="btn big" id="btnImp">📥 Importa</button></div>' : ''}
        </div>`;
      box.querySelector('#btnImp')?.addEventListener('click', async (ev) => {
        if (Backend.mode === 'cloud' && !navigator.onLine) return UI.toast('Serve internet', 'err');
        ev.target.disabled = true;
        let n = 0;
        const tot = p.docs.length + p.impianti.length + p.sottoganci.length + p.giri.length + p.schede.length + p.attrezzi.length + p.ctrAttrezzi.length;
        for (const { doc } of p.docs) { await UI.salva('clienti', doc); n++; ev.target.textContent = `Importo… ${n}/${tot}`; }
        if (p.tipologie.length) {
          const voci = [...((S.impostazioni.find((x) => x.id === 'tipologieGru') || {}).voci || IMP.TIPOLOGIE_BASE), ...p.tipologie];
          await UI.salva('impostazioni', { id: 'tipologieGru', voci });
        }
        // gli impianti a blocchi (molto più veloce di uno per volta)
        for (let i = 0; i < p.impianti.length; i += 200) {
          const pezzo = p.impianti.slice(i, i + 200).map((x) => ({ ...x, creato: new Date().toISOString() }));
          await Backend.saveMany('impianti', pezzo); n += pezzo.length; ev.target.textContent = `Importo… ${n}/${tot}`;
        }
        for (let i = 0; i < p.sottoganci.length; i += 200) {
          const pezzo = p.sottoganci.slice(i, i + 200);
          await Backend.saveMany('sottoganci', pezzo); n += pezzo.length; ev.target.textContent = `Importo… ${n}/${tot}`;
        }
        for (const m of p.modelli) await CTR.aggiungiModello(S, m.nome, m.voci);
        if (p.attrezzi.length) { await Backend.saveMany('attrezzi', p.attrezzi); n += p.attrezzi.length; }
        if (p.ctrAttrezzi.length) { await Backend.saveMany('controlliAttrezzi', p.ctrAttrezzi); n += p.ctrAttrezzi.length; }
        // le schede hanno dentro le firme: blocchi piccoli
        for (let i = 0; i < p.schede.length; i += 60) {
          const pezzo = p.schede.slice(i, i + 60);
          await Backend.saveMany('schedeControllo', pezzo); n += pezzo.length; ev.target.textContent = `Importo… ${n}/${tot}`;
        }
        for (const g of p.giri) { await UI.salva('giriSottoganci', g); n++; ev.target.textContent = `Importo… ${n}/${tot}`; }
        UT.registra('creazione', `Importazione dati: ${p.nuoviClienti} clienti nuovi, ${p.nuoveSedi} sedi nuove, ${p.aggiornati} completati, ${p.impianti.length} impianti, ${p.sottoganci.length} sottoganci, ${p.giri.length} controlli sottoganci, ${p.schede.length} schede controlli gru`);
        UI.toast('Importazione completata', 'ok'); location.hash = '#/clienti';
      });
    };
    return { titolo: 'Importa dati', indietro: '#/profilo', live: false };
  }
  return { pagina, piano };
})();
