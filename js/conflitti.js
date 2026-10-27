// ===== CONFLITTI TRA DISPOSITIVI (lavoro offline) =====
// Ogni salvataggio ricorda da quale versione è partito (_base) e la sua "storia" (_storia).
// Quando arriva dal cloud una versione che NON discende da quella che questo dispositivo aveva,
// vuol dire che due dispositivi hanno lavorato in parallelo sullo stesso documento:
//  - schede di controllo: se i controlli non si sovrappongono, le due versioni si uniscono da sole;
//  - altrimenti la versione "persa" viene conservata in "conflitti" e il Master sceglie cosa tenere.
// Niente viene buttato via senza che qualcuno lo decida.
window.CONF = (function () {
  const { esc, fmt, uid, info } = UI;
  const SENZA_VERSIONI = new Set(['utenti', 'log', 'conflitti', 'contatori', 'invii', 'impostazioni']);
  const META = ['_rev', '_base', '_storia', '_da', '_disp', '_quando', 'aggiornato'];

  const nomeDisp = () => {
    if (Backend.mode !== 'cloud') return 'QUESTO DISPOSITIVO';
    if (Backend.isDispositivo()) { try { return localStorage.getItem('gid_nome_disp') || 'TABLET'; } catch (e) { return 'TABLET'; } }
    const io = UT.attuale();
    return 'DISPOSITIVO DI ' + (io ? UT.breve(io) : (Backend.account() || '').split('@')[0].toUpperCase());
  };
  const STORIA = 150;   // quante versioni precedenti ricorda ogni documento
  const unione = (...liste) => [...new Set(liste.flat().filter(Boolean))].slice(-STORIA);

  // ---------- versioni fatte da QUESTO dispositivo ----------
  // Un conflitto vero c'è solo se una versione fatta qui (magari senza rete) viene scavalcata da una
  // che non la contiene. Le versioni arrivate dagli altri, per quanto vecchie, non sono mai un conflitto.
  // Le ricordo anche dopo aver chiuso l'app (le modifiche fatte offline restano in coda finché torna la rete).
  const KMIE = 'gid_mierev';
  let mie = new Map();
  try { mie = new Map(JSON.parse(localStorage.getItem(KMIE) || '[]')); } catch (e) {}
  let tSalvaMie = null;
  const ricordaMia = (rev) => {
    mie.set(rev, Date.now());
    if (mie.size > 3000) mie = new Map([...mie].sort((a, b) => a[1] - b[1]).slice(-2500));
    clearTimeout(tSalvaMie); tSalvaMie = setTimeout(() => { try { localStorage.setItem(KMIE, JSON.stringify([...mie])); } catch (e) {} }, 300);
  };
  const mia = (rev) => !!rev && mie.has(rev);
  // da quando questo dispositivo ricorda le sue versioni (prima di allora: mie se fatte con lo stesso nome dispositivo)
  let ricordaDa = ''; try { ricordaDa = localStorage.getItem(KMIE + '_da') || ''; if (!ricordaDa) { ricordaDa = new Date().toISOString(); localStorage.setItem(KMIE + '_da', ricordaDa); } } catch (e) {}
  const versioneMia = (d) => mia(d._rev) || (!!ricordaDa && (d._quando || '') < ricordaDa && d._disp === nomeDisp());

  // ---------- al salvataggio: nuova versione ----------
  function marca(col, doc) {
    if (SENZA_VERSIONI.has(col) || !doc) return doc;
    const io = UT.attuale(), prima = doc._rev;
    doc._storia = unione(doc._storia || [], [prima]);
    doc._base = prima || null;
    doc._rev = uid(); ricordaMia(doc._rev);
    doc._da = io ? UT.breve(io) : '';
    doc._disp = nomeDisp();
    doc._quando = new Date().toISOString();
    return doc;
  }

  // ---------- prima di salvare ----------
  // doc parte da una versione più vecchia di quella che c'è adesso (attuale):
  //  - se tutte le versioni nel mezzo le ho fatte io (es. salvataggio automatico e poi «Concludi»), è solo il seguito: lo aggancio;
  //  - se nel mezzo c'è una versione di un altro dispositivo, la sto scavalcando: la conservo tra i conflitti (o unisco le schede).
  function primaDiSalvare(col, doc, attuale) {
    if (SENZA_VERSIONI.has(col) || !doc || !attuale || !attuale._rev || doc._rev === attuale._rev || doc.copiaDi) return;
    const st = attuale._storia || [], i = doc._rev ? st.indexOf(doc._rev) : -1;
    const nelMezzo = i >= 0 ? [...st.slice(i + 1), attuale._rev] : [attuale._rev];
    const altri = Backend.mode === 'cloud' && doc._rev && !nelMezzo.every(mia) && !versioneMia(attuale);
    if (altri && !uguali(doc, attuale)) {
      if (col === 'schedeControllo') {
        const m = unisciSchede(doc, attuale);
        if (m) { const meta = {}; META.forEach((k) => (meta[k] = doc[k])); Object.keys(doc).forEach((k) => delete doc[k]); Object.assign(doc, m, meta); }
        else conflitto(col, JSON.parse(JSON.stringify(attuale)), { ...doc, _rev: '(questo salvataggio)' }, true);
      } else conflitto(col, JSON.parse(JSON.stringify(attuale)), { ...doc, _rev: '(questo salvataggio)' }, true);
    }
    doc._storia = unione(doc._storia || [], st, [attuale._rev]);
    doc._rev = attuale._rev;   // la nuova versione discenderà da quella attuale
  }

  // ---------- quando arrivano i dati dal cloud ----------
  const inCorso = new Set();
  function verifica(col, prima, dopo) {
    if (Backend.mode !== 'cloud' || SENZA_VERSIONI.has(col) || !prima || !prima.length) return;
    const vecchi = new Map(prima.map((d) => [d.id, d]));
    dopo.forEach((n) => {
      const o = vecchi.get(n.id);
      if (!o || !o._rev || !n._rev || o._rev === n._rev) return;
      if (o.copiaDi || n.copiaDi) return;   // copie di sicurezza (es. layout di prima): non sono lavoro di nessuno
      if (!mia(o._rev)) return;             // quella che avevo arrivava da un altro dispositivo: la nuova la sostituisce e basta
      if (mia(n._rev)) return;              // anche la nuova è mia (es. due salvataggi di fila)
      if ((n._storia || []).includes(o._rev)) return;   // normale: la nuova discende da quella che avevo
      if ((o._storia || []).includes(n._rev)) return;   // ritorno a una versione precedente (salvataggio rifiutato)
      conflitto(col, o, n);
    });
  }

  const pulito = (d) => { const c = JSON.parse(JSON.stringify(d)); META.forEach((k) => delete c[k]); return c; };
  // confronto del contenuto che non dipende dall'ordine dei campi
  const ordinato = (v) => (Array.isArray(v) ? v.map(ordinato) : v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => ((o[k] = ordinato(v[k])), o), {}) : v);
  const uguali = (a, b) => JSON.stringify(ordinato(pulito(a))) === JSON.stringify(ordinato(pulito(b)));

  async function conflitto(col, perso, attuale, dalSalvataggio) {
    const chiave = `${col}__${perso.id}__${perso._rev}`;
    if (inCorso.has(chiave)) return; inCorso.add(chiave);
    if (uguali(perso, attuale)) return;   // stesso contenuto: niente da scegliere
    try {
      if (col === 'schedeControllo' && !dalSalvataggio) {
        const m = unisciSchede(attuale, perso);
        if (m) {                                   // controlli diversi: si uniscono da soli
          if (!uguali(m, attuale)) {
            m._storia = unione(attuale._storia || [], perso._storia || [], [perso._rev]);
            await UI.salva(col, m);
            UT.registra('modifica', 'Unione automatica di due versioni: ' + UT.descrivi(col, m), { col, docId: m.id });
          }
          return;
        }
      }
      await Backend.save('conflitti', {
        id: chiave, col, docId: perso.id, perso, attuale: { rev: attuale._rev, da: dalSalvataggio ? (UT.breve(UT.attuale()) || '') : attuale._da || '', disp: dalSalvataggio ? nomeDisp() : attuale._disp || '', quando: dalSalvataggio ? new Date().toISOString() : attuale._quando || attuale.aggiornato || '' },
        rilevato: new Date().toISOString(), rilevatoDa: nomeDisp()
      });
    } catch (e) { console.error('conflitto', e); }
  }

  // ---------- unione di due versioni della stessa scheda di controllo ----------
  // null = gli stessi controlli sono stati compilati in modo diverso: deve scegliere il Master
  function unisciSchede(a, p, forza) {
    const m = JSON.parse(JSON.stringify(a));
    m.visite = m.visite || {}; m.osservazioni = m.osservazioni || [];
    const daP = new Set();
    for (const [n, v] of Object.entries(p.visite || {})) {
      if (!m.visite[n]) { m.visite[n] = JSON.parse(JSON.stringify(v)); daP.add(+n); }
      else if (JSON.stringify(pulito(m.visite[n])) !== JSON.stringify(pulito(v)) && !forza) return null;
    }
    const lettere = new Set(m.osservazioni.map((o) => o.lettera));
    const libera = () => { let k = 0, l; do { l = k < 26 ? String.fromCharCode(65 + k) : 'A' + String.fromCharCode(65 + k - 26); k++; } while (lettere.has(l)); lettere.add(l); return l; };
    for (const o of p.osservazioni || []) {
      const uguale = m.osservazioni.find((x) => x.visita === o.visita && x.vocId === o.vocId && (x.p || 1) === (o.p || 1) && x.testo === o.testo);
      if (uguale) { if (o.risoltaIl && !uguale.risoltaIl) uguale.risoltaIl = o.risoltaIl; continue; }
      const nuova = JSON.parse(JSON.stringify(o));
      if (lettere.has(nuova.lettera)) {           // lettera già usata dall'altra versione: le do la prossima libera
        const vecchia = nuova.lettera; nuova.lettera = libera();
        for (const n of Object.keys(m.visite)) if (daP.has(+n) || +n === o.visita) {
          const es = m.visite[n].esiti?.[o.vocId]; if (es && es[(o.p || 1) - 1] === vecchia) es[(o.p || 1) - 1] = nuova.lettera;
        }
      } else lettere.add(nuova.lettera);
      m.osservazioni.push(nuova);
    }
    return m;
  }

  // ---------- doppioni che non sono conflitti dello stesso documento ----------
  // due controlli sottoganci nello stesso trimestre (fascetta) per la stessa sede
  const doppioniSottoganci = (S) => {
    const g = new Map();
    S.giriSottoganci.forEach((x) => { const k = `${x.sedeId}|${x.anno}|${x.slot}`; g.set(k, [...(g.get(k) || []), x]); });
    return [...g.values()].filter((l) => l.length > 1);
  };
  // conflitti che non servono più: copie di sicurezza, o la versione "persa" è uguale a quella attuale
  const inutile = (S, c) => String(c.docId || '').endsWith('~copia') || c.perso?.copiaDi
    || (() => { const cor = (S[c.col] || []).find((x) => x.id === c.docId); return cor && c.perso && uguali(c.perso, cor); })();
  const validi = (S) => S.conflitti.filter((c) => !inutile(S, c));
  const conta = (S) => validi(S).length + doppioniSottoganci(S).length;

  // ---------- pagina del Master ----------
  const quando = (t) => (t ? `${fmt(t.slice(0, 10))} ${t.slice(11, 16)}` : '—');
  const NOMI = { schedeControllo: 'Scheda di controllo', rapportini: 'Rapportino', giriSottoganci: 'Controllo sottoganci', sottoganci: 'Sottogancio', clienti: 'Cliente', impianti: 'Impianto', mezzi: 'Mezzo', collaudi: 'Rapporto di collaudo' };
  function differenze(col, a, p) {
    if (col === 'schedeControllo') {
      const va = Object.keys(a.visite || {}), vp = Object.keys(p.visite || {});
      const diverse = vp.filter((n) => a.visite?.[n] && JSON.stringify(pulito(a.visite[n])) !== JSON.stringify(pulito(p.visite[n])));
      return `Controlli nella versione attuale: ${va.join(', ') || 'nessuno'} · nell'altra: ${vp.join(', ') || 'nessuno'}${diverse.length ? ` · compilati in modo diverso: ${diverse.map((n) => n + '°').join(', ')}` : ''}`;
    }
    const campi = [...new Set([...Object.keys(a), ...Object.keys(p)])].filter((k) => !META.includes(k) && k !== 'id' && JSON.stringify(a[k]) !== JSON.stringify(p[k]));
    return campi.length ? 'Cambiano: ' + campi.slice(0, 8).join(', ') : 'Stesso contenuto';
  }
  // ---------- confronto affiancato delle due versioni ----------
  // appiattisce un documento in righe "percorso -> valore leggibile"
  function piatto(o, pre = '', out = {}) {
    if (o === null || o === undefined || o === '') return out;
    if (typeof o === 'string' && o.startsWith('data:')) { out[pre] = '🖼 immagine/firma'; return out; }
    if (Array.isArray(o) && o.every((x) => x === null || typeof x !== 'object')) { out[pre] = o.map((x) => x || '·').join('  '); return out; }
    if (typeof o === 'object') { for (const [k, v] of Object.entries(o)) if (!META.includes(k) && k !== 'id') piatto(v, pre ? pre + '.' + k : k, out); return out; }
    out[pre] = typeof o === 'boolean' ? (o ? 'sì' : 'no') : String(o);
    return out;
  }
  // nome comprensibile di un percorso
  function nomeCampo(col, path, d, S) {
    const p = path.split('.');
    if (col === 'schedeControllo') {
      const voc = (id) => (d.voci || []).find((v) => v.id === id)?.testo || 'voce';
      if (p[0] === 'visite') {
        const n = p[1] + '° controllo';
        if (p[2] === 'esiti') return `${n} · ${voc(p[3])}`;
        if (p[2] === 'valori') return `${n} · valore ${voc(p[3])}`;
        return `${n} · ${p.slice(2).map((x) => /^\d+$/.test(x) ? +x + 1 : NOMI_CAMPI[x] || x).join(' · ')}`;
      }
      if (p[0] === 'osservazioni') { const o = d.osservazioni?.[+p[1]]; return `Osservazione ${o?.lettera || +p[1] + 1} · ${p.slice(2).map((x) => NOMI_CAMPI[x] || x).join(' · ')}`; }
      if (p[0] === 'voci') return null;   // l'elenco delle voci non interessa
    }
    if (col === 'giriSottoganci' && p[0] === 'righe') {
      const sg = S.sottoganci.find((x) => x.id === p[1]);
      return `Sottogancio ${sg ? sg.numero : '?'} · ${p[2] === 'codici' ? 'giudizi' : 'note'}`;
    }
    return p.map((x) => /^\d+$/.test(x) ? String(+x + 1) : NOMI_CAMPI[x] || x).join(' · ');
  }
  const NOMI_CAMPI = { noteInterne: 'Note Gru Impianti', noteVecchie: 'Note vecchio programma', tecnico: 'tecnico', tecnici: 'tecnici', firmaDi: 'firma di', firma: 'firma',
    dataScheda: 'data scheda', dataEsecuzione: 'data esecuzione', fs: 'fuori servizio', testo: 'testo', risoltaIl: 'OK il', lettera: 'lettera', data: 'data',
    ragioneSociale: 'Ragione sociale', anagrafica: 'Anagrafica', telefono: 'telefono', email: 'email', altreEmail: 'altre email', sedi: 'Sede', nome: 'nome', sigla: 'sigla',
    indirizzo: 'indirizzo', note: 'note', noteGenerali: 'Note generali', numero: 'numero', parti: 'componente', denominazione: 'denominazione', dimensioni: 'dimensioni',
    portata: 'portata', ubicazione: 'ubicazione', certificato: 'certificato', chiuso: 'chiuso', righe: 'righe', voci: 'voce', descrizione: 'descrizione', ore: 'ore' };
  function _vecchio(path) {
    return path.replace(/\.(\d+)\./g, (m, n) => ` ${+n + 1} · `).replace(/\./g, ' · ');
  }
  function confronta(c, cor, S) {
    const A = piatto(cor), P = piatto(c.perso);
    const righe = [...new Set([...Object.keys(A), ...Object.keys(P)])].filter((k) => A[k] !== P[k])
      .map((k) => ({ nome: nomeCampo(c.col, k, A[k] !== undefined ? cor : c.perso, S) ?? nomeCampo(c.col, k, c.perso, S), a: A[k], p: P[k] }))
      .filter((r) => r.nome).sort((x, y) => x.nome.localeCompare(y.nome, 'it', { numeric: true }));
    const cella = (v) => v === undefined ? '<em class="muted">— vuoto —</em>' : esc(v);
    const ov = document.createElement('div'); ov.className = 'modal-ov';
    ov.innerHTML = `<div class="modal largo conf-modal"><div class="modal-head"><h2>Confronto delle due versioni</h2><button type="button" class="modal-x" aria-label="Chiudi">×</button></div>
      <div class="modal-body">
        <p class="muted small">${esc(UT.descrivi(c.col, cor))} · solo quello che cambia (${righe.length})</p>
        <table class="conf-tab"><thead><tr><th></th>
          <th><span>Versione attuale</span>${esc(c.attuale.da || '—')}<small>${esc(c.attuale.disp || '')} · ${quando(c.attuale.quando)}</small></th>
          <th class="alt"><span>Versione non tenuta</span>${esc(c.perso._da || '—')}<small>${esc(c.perso._disp || '')} · ${quando(c.perso._quando || c.perso.aggiornato)}</small></th></tr></thead>
        <tbody>${righe.map((r) => `<tr><td class="nome">${esc(r.nome)}</td><td>${cella(r.a)}</td><td class="alt">${cella(r.p)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Nessuna differenza nei contenuti.</td></tr>'}</tbody></table>
      </div>
      <div class="modal-foot"><button type="button" class="btn ghost" data-x>Chiudi</button><span class="grow"></span>
        <button type="button" class="btn ghost" data-ct>✓ Tieni l'attuale</button><button type="button" class="btn" data-ca>↺ Usa l'altra</button></div></div>`;
    const chiudi = () => { ov.remove(); document.body.classList.remove('modal-aperto'); };
    ov.onclick = (e) => { if (e.target === ov) chiudi(); };
    ov.querySelector('.modal-x').onclick = chiudi; ov.querySelector('[data-x]').onclick = chiudi;
    ov.querySelector('[data-ct]').onclick = () => { chiudi(); document.querySelector(`[data-tieni="${CSS.escape(c.id)}"]`)?.click(); };
    ov.querySelector('[data-ca]').onclick = () => { chiudi(); document.querySelector(`[data-altra="${CSS.escape(c.id)}"]`)?.click(); };
    document.body.appendChild(ov); document.body.classList.add('modal-aperto');
  }

  const apri = (col, d) => ({ schedeControllo: `#/controlli/i/${d.impiantoId}/${d.anno}`, rapportini: `#/rapportini/r/${d.id}`, giriSottoganci: `#/sottoganci/c/${d.sedeId}`, sottoganci: `#/sottoganci/c/${d.sedeId}`, clienti: `#/clienti/${d.id}`, impianti: `#/impianti/i/${d.id}`, mezzi: `#/mezzi/${d.id}` }[col] || '#/');

  const giaTolti = new Set();
  function pagina(el, S) {
    if (!UT.puo('conflitti')) { el.innerHTML = '<p class="nessuno">Risolvere i conflitti non è abilitato per te.</p>'; return { titolo: 'Conflitti', indietro: '#/' }; }
    // pulizia: tolgo da soli quelli inutili
    S.conflitti.filter((c) => inutile(S, c) && !giaTolti.has(c.id)).forEach((c) => { giaTolti.add(c.id); Backend.remove('conflitti', c.id).catch(() => giaTolti.delete(c.id)); });
    const lista = validi(S).sort((a, b) => (b.rilevato || '').localeCompare(a.rilevato || ''));
    const doppi = doppioniSottoganci(S);
    el.innerHTML = `
      <section class="cli">
        <div class="sez-head"><h1>Conflitti tra dispositivi ${info('Succede quando due dispositivi senza rete modificano lo stesso documento: quando tornano online le versioni non coincidono. L\'app non butta via niente: qui scegli quale versione tenere. Con «⇆ Confronta le due versioni» le vedi affiancate, solo con quello che cambia. Le schede di controllo con controlli diversi si uniscono da sole e non compaiono qui.')}</h1></div>
        ${!lista.length && !doppi.length ? '<p class="nessuno">✅ Nessun conflitto. Tutti i dispositivi sono d\'accordo.</p>' : ''}
        ${lista.length > 1 ? `<div class="azioni-form"><span class="grow"></span><button type="button" class="btn ghost" id="btnTieniTutti">✓ Tieni l'attuale per tutti (${lista.length})</button></div>` : ''}
        ${lista.map((c) => {
          const cor = (S[c.col] || []).find((x) => x.id === c.docId);
          const titolo = UT.descrivi(c.col, cor || c.perso);
          return `<div class="card conf">
            <div class="conf-tit"><span class="pill st-ko">${esc(NOMI[c.col] || c.col)}</span> <b>${esc(titolo)}</b></div>
            <div class="conf-due">
              <div class="conf-v ${cor ? '' : 'via'}"><span>Versione attuale</span><b>${cor ? esc(c.attuale.da || '—') : 'eliminata'}</b><small>${cor ? esc(c.attuale.disp || '') + ' · ' + quando(c.attuale.quando) : ''}</small></div>
              <div class="conf-v alt"><span>Versione non tenuta</span><b>${esc(c.perso._da || '—')}</b><small>${esc(c.perso._disp || '')} · ${quando(c.perso._quando || c.perso.aggiornato)}</small></div>
            </div>
            <p class="muted small">${esc(cor ? differenze(c.col, cor, c.perso) : 'Il documento è stato eliminato da un altro dispositivo.')}</p>
            <div class="azioni-lista">
              ${cor ? `<button class="btn small" data-confronta="${esc(c.id)}">⇆ Confronta le due versioni</button><a class="btn ghost small" href="${apri(c.col, cor)}">👁 Apri l'attuale</a>` : ''}
              <button class="btn ghost small" data-tieni="${esc(c.id)}">✓ Tieni l'attuale</button>
              ${c.col === 'schedeControllo' && cor ? `<button class="btn ghost small" data-unisci="${esc(c.id)}">⇄ Unisci (i controlli dell'altra si aggiungono)</button>` : ''}
              <button class="btn ghost small" data-altra="${esc(c.id)}">↺ Usa l'altra versione</button>
            </div>
          </div>`;
        }).join('')}
        ${doppi.map((l) => {
          const c = SG.cliente(S, l[0].sedeId);
          return `<div class="card conf">
            <div class="conf-tit"><span class="pill st-ko">Controllo sottoganci doppio</span> <b>${esc(SG.nomeCliente(c))} · ${l[0].slot}° controllo ${l[0].anno}</b></div>
            <p class="muted small">Lo stesso controllo (fascetta ${esc(SG.SLOT[l[0].slot - 1]?.nome || '')}) è stato fatto su ${l.length} dispositivi. Scegli quale tenere: gli altri vengono eliminati.</p>
            ${l.map((g) => `<div class="riga-tab"><span><b>${esc(g.tecnico || '—')}</b><small>${fmt(g.data)} · ${Object.values(g.righe || {}).reduce((t, r) => t + r.codici.filter(Boolean).length, 0)} esiti · ${esc(g._disp || '')}</small></span>
              <button class="btn small" data-tienigiro="${esc(g.id)}" data-gruppo="${esc(l.map((x) => x.id).join(','))}">Tieni questo</button></div>`).join('')}
          </div>`;
        }).join('')}
      </section>`;
    const trova = (id) => S.conflitti.find((x) => x.id === id);
    const chiudi = async (c, testo) => { await Backend.remove('conflitti', c.id); UT.registra('modifica', `Conflitto risolto (${testo}): ${UT.descrivi(c.col, c.perso)}`); };
    el.querySelectorAll('[data-confronta]').forEach((b) => (b.onclick = () => { const c = trova(b.dataset.confronta); confronta(c, (S[c.col] || []).find((x) => x.id === c.docId), S); }));
    el.querySelector('#btnTieniTutti')?.addEventListener('click', async () => {
      if (!UI.conferma(`Tenere la versione attuale per tutti i ${lista.length} conflitti?\n\nLe altre versioni vengono scartate.`)) return;
      for (const c of lista) await chiudi(c, 'tenuta la versione attuale (tutti)');
      UI.toast('Tenute tutte le versioni attuali', 'ok');
    });
    el.querySelectorAll('[data-tieni]').forEach((b) => (b.onclick = async () => { await chiudi(trova(b.dataset.tieni), 'tenuta la versione attuale'); UI.toast('Tenuta la versione attuale', 'ok'); }));
    el.querySelectorAll('[data-altra]').forEach((b) => (b.onclick = async () => {
      const c = trova(b.dataset.altra), cor = (S[c.col] || []).find((x) => x.id === c.docId);
      if (!UI.conferma('Sostituire la versione attuale con quella non tenuta?')) return;
      const d = JSON.parse(JSON.stringify(c.perso));
      d._rev = cor?._rev || d._rev; d._storia = unione(cor?._storia || [], c.perso._storia || [], [c.perso._rev]);
      await UI.salva(c.col, d); await chiudi(c, 'usata l\'altra versione'); UI.toast('Ripristinata l\'altra versione', 'ok');
    }));
    el.querySelectorAll('[data-unisci]').forEach((b) => (b.onclick = async () => {
      const c = trova(b.dataset.unisci), cor = (S[c.col] || []).find((x) => x.id === c.docId);
      const m = unisciSchede(cor, c.perso, true);
      m._storia = unione(cor._storia || [], c.perso._storia || [], [c.perso._rev]);
      await UI.salva(c.col, m); await chiudi(c, 'unione'); UI.toast('Versioni unite: dove i controlli coincidevano resta quello attuale', 'ok');
    }));
    el.querySelectorAll('[data-tienigiro]').forEach((b) => (b.onclick = async () => {
      if (!UI.conferma('Tenere questo controllo ed eliminare gli altri doppioni?')) return;
      for (const id of b.dataset.gruppo.split(',')) if (id !== b.dataset.tienigiro) await Backend.remove('giriSottoganci', id);
      UI.toast('Doppione eliminato', 'ok');
    }));
    return { titolo: 'Conflitti tra dispositivi', indietro: '#/', live: true };
  }

  // avviso nei moduli: questo documento è stato compilato da un altro dispositivo
  function avvisoAltro(meta, cosa) {
    if (!meta || !meta._disp || meta._disp === nomeDisp()) return '';
    return `<div class="avviso-altro">⚠️ ${esc(cosa)} è già stato compilato da <b>${esc(meta._da || '—')}</b> su <b>${esc(meta._disp)}</b> il ${quando(meta._quando)}. Se lo salvi, aggiorni quello.</div>`;
  }

  return { marca, verifica, primaDiSalvare, mia, conta, pagina, avvisoAltro, nomeDisp, unisciSchede };
})();
