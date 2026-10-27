// ===== CONFIGURATORE CABLAGGIO GRU (modulo esterno dentro il gestionale) =====
// Il modulo (js/configuratore-gru.js) si carica solo quando serve, perché è grande.
// - utenti: quelli del gestionale; solo il Master può modificare i valori delle schede
// - modifiche ai valori: salvate nel gestionale (impostazioni/modificheCablaggio), uguali per tutti i dispositivi
// - rapporti di collaudo: elenco nel gestionale (raccolta "collaudi"), PDF salvato sul dispositivo
window.CAB = (function () {
  const { esc, uid, info, fmt } = UI;
  let caricato = null, istanza = null;

  const carica = () => caricato || (caricato = new Promise((ok, ko) => {
    if (window.ConfiguratoreGru) return ok();
    const s = document.createElement('script');
    s.src = 'js/configuratore-gru.js?v=' + App.VERSIONE; s.onload = ok; s.onerror = () => { caricato = null; ko(); };
    document.head.appendChild(s);
  }));

  const modificheSalvate = (S) => {
    const d = S.impostazioni.find((x) => x.id === 'modificheCablaggio');
    try { return d?.json ? JSON.parse(d.json) : {}; } catch (e) { return {}; }
  };

  // aspetto uguale al resto dell'app (il modulo vive in uno Shadow DOM, si personalizza da qui)
  const CSS_APP = `
    #cg { font-family: inherit; }
    h1 { color: #16324f; letter-spacing: .02em; }
    h2 { color: #16324f; }
    .btn { border-radius: 14px; border-width: 1.5px; min-height: 58px; letter-spacing: .03em; }
    .btn:not(.ghost):not(:disabled) { border-color: #16324f; }
    .btn.solid, .btn:active { background: #16324f; color: #fff; }
    .btn.ghost { border-color: #c9d2dc; }
    #start { background: #f2b705; border-color: #f2b705; color: #14202e; font-size: 1.15rem; }
    .item { border-radius: 12px; border-width: 1.5px; }
    .search, .mbox input, .mbox textarea, .fcsel select { border-radius: 12px; border-width: 1.5px; }
    .mbox { border-radius: 18px; }
    .back { font-weight: 700; color: #16324f; opacity: 1; }`;

  function pagina(el, S) {
    const n = S.collaudi.length;
    el.innerHTML = `
      <section class="cab">
        <div class="cab-barra">
          <a class="btn ghost small" href="#/cablaggio/rapporti">📄 Rapporti di collaudo${n ? ` (${n})` : ''}</a>
          ${info('Il configuratore guida il cablaggio della gru con domande a bivi e mostra gli schemi. Alla fine c\'è la checklist di collaudo con il rapporto PDF: ogni rapporto creato viene registrato nel gestionale. Solo il Master può modificare i valori delle schede, e le modifiche valgono per tutti.')}
        </div>
        <div id="gru" class="cab-modulo"><p class="nessuno">Caricamento del configuratore…</p></div>
      </section>`;
    const box = el.querySelector('#gru');
    carica().then(() => {
      if (!document.body.contains(box)) return;   // nel frattempo si è cambiata pagina
      box.innerHTML = '';
      const io = UT.attuale();
      istanza = ConfiguratoreGru.mount(box, {
        utente: { nome: UT.breve(io), ruolo: UT.puo('cablaggio.modifica') ? 'admin' : 'operatore' },
        canEdit: UT.puo('cablaggio.modifica'),
        logo: 'img/logo-grande.png',
        css: CSS_APP,
        modifiche: modificheSalvate(S),
        scrollTop: () => window.scrollTo({ top: 0 }),
        onModifica: (m) => {
          if (!UT.puo('cablaggio.modifica')) return;
          UI.salva('impostazioni', { id: 'modificheCablaggio', json: JSON.stringify(m) }).catch(() => {});
        },
        onRapporto: (r) => salvaRapporto(S, r)
      });
    }).catch(() => {
      box.innerHTML = '<p class="nessuno">Impossibile caricare il configuratore. Controlla la connessione e riprova.</p>';
    });
    return { titolo: 'Configuratore cablaggio gru', indietro: '#/gho', live: false };
  }

  async function salvaRapporto(S, r) {
    const id = uid(), io = UT.attuale();
    let fileId = null;
    try { fileId = uid(); await ALLEGATI.salva(fileId, new Blob([r.bytes], { type: 'application/pdf' })); } catch (e) { fileId = null; }
    const esiti = r.esiti || [];
    const doc = {
      id, nome: r.nome, cliente: (r.cliente || '').toUpperCase(), matricola: (r.matricola || '').toUpperCase(), note: r.note || '',
      configurazione: r.configurazione || '', carrello: r.carrello || '', sollevamento: r.sollevamento || '', motore: r.motore || '',
      esiti, completo: esiti.length > 0 && esiti.every((x) => x === 'v' || x === 'np'),
      data: new Date(r.data || Date.now()).toISOString(), tecnicoId: io?.id || '', tecnico: UT.breve(io),
      fileId, size: r.bytes?.length || 0
    };
    try { await UI.salva('collaudi', doc); UI.toast('Rapporto di collaudo registrato', 'ok'); } catch (e) {}
  }

  function rapporti(el, S) {
    const lista = [...S.collaudi].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    el.innerHTML = `
      <section class="cli">
        <div class="sez-head"><h1>Rapporti di collaudo ${info('Qui trovi tutti i rapporti di collaudo creati con il configuratore. Il PDF si apre sul dispositivo dove è stato creato; dagli altri dispositivi vedi i dati del collaudo.')}</h1></div>
        <div class="elenco">
          ${lista.map((c) => `
            <div class="riga cli-riga">
              <span class="avatar ${c.completo ? 'ok' : ''}">${c.completo ? '✓' : '!'}</span>
              <div class="riga-main">
                <div class="riga-top"><b>${esc(c.cliente || 'Cliente non indicato')}</b>${c.matricola ? ` · matr. ${esc(c.matricola)}` : ''}</div>
                <div class="muted small">${fmt(c.data.slice(0, 10))} · ${esc(c.tecnico || '—')} · ${esc([c.configurazione, c.motore].filter(Boolean).join(' · ').replace(/-/g, ' ').toUpperCase())}</div>
                ${c.note ? `<div class="small">${esc(c.note)}</div>` : ''}
              </div>
              ${c.fileId ? `<button class="btn small" data-apri="${c.id}">PDF</button>` : ''}
              ${UT.puo('cablaggio.modifica') ? `<button class="btn ghost small danger" data-del="${c.id}" aria-label="Elimina">×</button>` : ''}
            </div>`).join('') || '<p class="nessuno">Ancora nessun rapporto di collaudo. Li crei alla fine della checklist del configuratore.</p>'}
        </div>
      </section>`;
    el.querySelectorAll('[data-apri]').forEach((b) => (b.onclick = () => { const c = S.collaudi.find((x) => x.id === b.dataset.apri); ALLEGATI.apri(c.fileId, c.nome); }));
    el.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
      const c = S.collaudi.find((x) => x.id === b.dataset.del);
      if (!UI.conferma(`Eliminare il rapporto di collaudo ${c.nome}?`)) return;
      if (c.fileId) await ALLEGATI.elimina(c.fileId).catch(() => {});
      await Backend.remove('collaudi', c.id);
    }));
    return { titolo: 'Rapporti di collaudo', indietro: '#/cablaggio', live: true };
  }

  function route(el, S, parti) { return parti[1] === 'rapporti' ? rapporti(el, S) : pagina(el, S); }
  return { route };
})();
