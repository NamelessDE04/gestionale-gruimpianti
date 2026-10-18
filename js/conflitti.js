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
    if (Backend.mode !== 'cloud') return Backend.mode === 'prova' ? 'DIMOSTRAZIONE' : 'QUESTO DISPOSITIVO';
    if (Backend.isDispositivo()) { try { return localStorage.getItem('gid_nome_disp') || 'TABLET'; } catch (e) { return 'TABLET'; } }
    const io = UT.attuale();
    return 'DISPOSITIVO DI ' + (io ? UT.breve(io) : (Backend.account() || '').split('@')[0].toUpperCase());
  };
  const unione = (...liste) => [...new Set(liste.flat().filter(Boolean))].slice(-60);

  // ---------- al salvataggio: nuova versione ----------
  function marca(col, doc) {
    if (SENZA_VERSIONI.has(col) || !doc) return doc;
    const io = UT.attuale(), prima = doc._rev;
    doc._storia = unione(doc._storia || [], [prima]).slice(-40);
    doc._base = prima || null;
    doc._rev = uid();
    doc._da = io ? UT.breve(io) : '';
    doc._disp = nomeDisp();
    doc._quando = new Date().toISOString();
    return doc;
  }

  // ---------- quando arrivano i dati dal cloud ----------
  const inCorso = new Set();
  function verifica(col, prima, dopo) {
    if (Backend.mode !== 'cloud' || SENZA_VERSIONI.has(col) || !prima || !prima.length) return;
    const vecchi = new Map(prima.map((d) => [d.id, d]));
    dopo.forEach((n) => {
      const o = vecchi.get(n.id);
      if (!o || !o._rev || !n._rev || o._rev === n._rev) return;
      if ((n._storia || []).includes(o._rev)) return;   // normale: la nuova discende da quella che avevo
      if ((o._storia || []).includes(n._rev)) return;   // ritorno a una versione precedente (salvataggio rifiutato)
      conflitto(col, o, n);
    });
  }

  const pulito = (d) => { const c = JSON.parse(JSON.stringify(d)); META.forEach((k) => delete c[k]); return c; };
  const uguali = (a, b) => JSON.stringify(pulito(a)) === JSON.stringify(pulito(b));

  async function conflitto(col, perso, attuale) {
    const chiave = `${col}__${perso.id}__${perso._rev}`;
    if (inCorso.has(chiave)) return; inCorso.add(chiave);
    try {
      if (col === 'schedeControllo') {
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
        id: chiave, col, docId: perso.id, perso, attuale: { rev: attuale._rev, da: attuale._da || '', disp: attuale._disp || '', quando: attuale._quando || attuale.aggiornato || '' },
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
  const conta = (S) => S.conflitti.length + doppioniSottoganci(S).length;

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
  const apri = (col, d) => ({ schedeControllo: `#/controlli/i/${d.impiantoId}/${d.anno}`, rapportini: `#/rapportini/r/${d.id}`, giriSottoganci: `#/sottoganci/c/${d.sedeId}`, sottoganci: `#/sottoganci/c/${d.sedeId}`, clienti: `#/clienti/${d.id}`, impianti: `#/impianti/i/${d.id}`, mezzi: `#/mezzi/${d.id}` }[col] || '#/');

  function pagina(el, S) {
    if (!UT.isMaster()) { el.innerHTML = '<p class="nessuno">Solo il Master gestisce i conflitti.</p>'; return { titolo: 'Conflitti', indietro: '#/' }; }
    const lista = [...S.conflitti].sort((a, b) => (b.rilevato || '').localeCompare(a.rilevato || ''));
    const doppi = doppioniSottoganci(S);
    el.innerHTML = `
      <section class="cli">
        <div class="sez-head"><h1>Conflitti tra dispositivi ${info('Succede quando due dispositivi senza rete modificano lo stesso documento: quando tornano online le versioni non coincidono. L\'app non butta via niente: qui scegli quale versione tenere. Le schede di controllo con controlli diversi si uniscono da sole e non compaiono qui.')}</h1></div>
        ${!lista.length && !doppi.length ? '<p class="nessuno">✅ Nessun conflitto. Tutti i dispositivi sono d\'accordo.</p>' : ''}
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
              ${cor ? `<a class="btn ghost small" href="${apri(c.col, cor)}">👁 Vedi l'attuale</a>` : ''}
              <button class="btn ghost small" data-tieni="${esc(c.id)}">✓ Tieni l'attuale</button>
              ${c.col === 'schedeControllo' && cor ? `<button class="btn ghost small" data-unisci="${esc(c.id)}">⇄ Unisci (i controlli dell'altra si aggiungono)</button>` : ''}
              <button class="btn small" data-altra="${esc(c.id)}">↺ Usa l'altra versione</button>
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

  return { marca, verifica, conta, pagina, avvisoAltro, nomeDisp, unisciSchede };
})();
