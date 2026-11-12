// ===== DOCUMENTI DI TRASPORTO (DDT) =====
// Stanno nella sezione «Rapportini e DDT» (sotto-scheda DDT). Numero progressivo/anno/revisione, es. 100/26/A:
// il progressivo riparte da 1 ogni anno (nel 2026 l'app parte da 93: gli altri sono stati fatti a mano), la revisione
// è quasi sempre A. Il PDF ricalca il modulo cartaceo di Gru Impianti (A4, misure in mm).
// Rapportini e DDT sono indipendenti: un rapportino dello stesso cliente può «abbinare» un DDT (r.ddtId sul rapportino).
// Le righe scelte dal magazzino scalano la quantità (vedi MAG.usi). I prezzi non compaiono mai.
window.DDT = (function () {
  // prezzi: solo per noi (permesso «ddt.prezzi»), mai sulla copia del cliente
  const vediPrezzi = () => UT.puo('ddt.prezzi');
  const nu = (x) => { const v = parseFloat(String(x ?? '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(v) ? v : null; };
  const nuQ = (x) => { const v = parseFloat(String(x ?? '').replace(',', '.')); return Number.isFinite(v) ? v : null; };
  const due = (v) => (v == null ? '' : (Math.round(v * 100) / 100).toFixed(2).replace('.', ','));
  const euroD = (v) => (v == null ? '' : '€ ' + (Math.round(v * 100) / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  // sconto anche a cascata: «10+5» = 10% e poi 5%
  const fattSc = (sc) => String(sc || '').split('+').map((x) => nuQ(x) || 0).reduce((f, x) => f * (1 - x / 100), 1);
  const importo = (r) => { const p = nuQ(r.prezzo), q = nuQ(r.qta); return p == null ? null : p * (q == null ? 1 : q) * fattSc(r.sconto); };
  const importoTxt = (r) => euroD(importo(r)) || '—';
  const { esc, uid, oggi, fmt, info } = UI;
  const PRIMO = { 2026: 93 };   // da che numero parte l'app in un anno (gli altri anni da 1)
  const CAUSALI = [['fornitura', 'FORNITURA E MONTAGGIO'], ['lavorazione', 'CONTO LAVORAZIONE'], ['visione', 'VISIONE'], ['riparato', 'RESO RIPARATO'], ['nonRiparato', 'NON RIPARATO'], ['nonConforme', 'RESO NON CONFORME']];
  const CURA = [['mittente', 'MITTENTE'], ['destinatario', 'DESTINATARIO'], ['vettore', 'VETTORE']];
  const UM = ['PZ', 'NR', 'MT', 'KG', 'LT', 'CF', 'KIT', 'CORPO'];
  const ASPETTI = ['A VISTA', 'BOBINA', 'SCATOLA', 'BANCALE', 'BUSTA', 'SFUSO'];

  const elenco = (S) => S.ddt || [];
  const aa = (anno) => String(anno || '').slice(-2);
  const numeroDi = (d) => (d.numero ? `${d.numero}/${aa(d.anno)}/${d.rev || 'A'}` : '—');
  const prossimo = (S, anno) => Math.max((PRIMO[anno] || 1) - 1, ...elenco(S).filter((d) => +d.anno === +anno).map((d) => +d.numero || 0)) + 1;
  // la sede può essere di un cliente (anche congelato) o di un fornitore (anagrafica fornitori, solo per i DDT)
  const trovaSede = (S, sedeId) => { for (const c of CLI.tutti(S)) { const s = (c.sedi || []).find((x) => x.id === sedeId); if (s) return { c, s }; } return FORN.trovaSede(S, sedeId); };
  const firmato = (d) => !!d.firmaDestinatario;
  // a quale rapportino è abbinato (il collegamento sta sul rapportino)
  const rapportinoDi = (S, id) => (S.rapportini || []).find((r) => r.ddtId === id);
  // DDT dello stesso cliente non ancora abbinati a nessun rapportino (tranne quello che sto modificando)
  const abbinabili = (S, clienteId, rapId) => elenco(S).filter((d) => d.clienteId === clienteId && !(S.rapportini || []).some((r) => r.ddtId === d.id && r.id !== rapId))
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  const indirizzoSede = (s) => (s ? [s.indirizzo, [s.cap, s.citta].filter(Boolean).join(' ') + (s.provincia ? ' - ' + s.provincia : '')].filter((x) => x && x.trim()) : []);
  // destinatario = sede legale del cliente (se c'è in anagrafica), destinazione = la sede dove va la merce
  const legale = (c) => (c?.sedeLegale && (c.sedeLegale.indirizzo || c.sedeLegale.citta) ? c.sedeLegale : null);
  // solo nome del cliente e indirizzo (il nome della sede non serve)
  const testoDest = (c, s, conSede) => c ? [CLI.nome(c), ...indirizzoSede(!conSede && legale(c) ? legale(c) : s)].join('\n') : '';

  // ---------- sotto-schede «Rapportini | DDT» ----------
  const tabs = (att) => UT.puo('sez.ddt') ? `<nav class="tabs tabs-scheda tabs-rapddt"><a class="tab ${att === 'rap' ? 'on' : ''}" href="#/rapportini"><b>📝 Rapportini</b></a><a class="tab ${att === 'ddt' ? 'on' : ''}" href="#/rapportini/ddt"><b>🚚 DDT</b></a></nav>` : '';

  // ---------- ELENCO ----------
  let cercaT = '';
  function lista(el, S) {
    const t = cercaT.trim().toLowerCase();
    const righe = elenco(S).filter((d) => {
      if (!t) return true;
      const { c } = trovaSede(S, d.sedeId);
      return [numeroDi(d), c && CLI.nome(c), d.destinatario, d.destinazione, d.ordine, ...(d.righe || []).map((r) => r.descrizione)].join(' ').toLowerCase().includes(t);
    }).sort((a, b) => (+b.anno - +a.anno) || (+b.numero - +a.numero));
    const scrive = UT.puo('ddt.scrivere') && !UT.solaLettura();
    el.innerHTML = `
      <section class="cli">
        ${tabs('ddt')}
        <div class="sez-head"><h1>Documenti di trasporto ${info('Il numero (es. 100/26/A = progressivo / anno / revisione) lo propone l\'app: si può cambiare a mano. Le righe prese dal magazzino scalano la quantità. Un DDT si può abbinare a un rapportino dello stesso cliente: lo propone il rapportino. Sulla copia del cliente i prezzi non compaiono mai.')}</h1>
          ${scrive ? '<a class="btn fab" href="#/rapportini/ddt/nuovo"><span class="fab-piu">+</span><span class="fab-txt"> Nuovo DDT</span></a>' : ''}</div>
        <div class="barra-cerca"><input type="search" class="cerca" data-f="q" placeholder="Cerca numero, cliente, materiale, ordine…" value="${esc(cercaT)}"></div>
        <div class="elenco">${righe.map((d) => { const { c, s } = trovaSede(S, d.sedeId), rp = rapportinoDi(S, d.id), nr = (d.righe || []).filter((r) => r.descrizione).length;
          return `<a class="riga cli-riga" href="#/rapportini/ddt/${d.id}">
            ${c ? CLI.avatar(c) : '<span class="avatar">🚚</span>'}
            <div class="riga-main"><div class="riga-top"><b>N° ${esc(numeroDi(d))}</b> · ${esc(c ? CLI.nome(c) : (d.destinatario || '').split('\n')[0] || '—')}${s?.sigla ? ` <span class="muted">${esc(s.sigla)}</span>` : ''}
              <span class="pill ${firmato(d) ? 'st-ok' : 'st-ko'}">${firmato(d) ? 'Firmato' : 'Da firmare'}</span>${d.inviatoIl ? `<span class="pill st-inv" title="Inviato a ${esc((d.inviatoA || []).join(', '))}">✉️ Inviato</span>` : ''}${rp ? `<span class="pill st-inv">🔗 Rapp. ${esc(rp.numero ? rp.numero + '/' + rp.anno : '')}</span>` : ''}</div>
              <div class="muted small">${fmt(d.data)} · ${nr} ${nr === 1 ? 'riga' : 'righe'}${(d.righe || [])[0]?.descrizione ? ' · ' + esc(d.righe[0].descrizione.split('\n')[0].slice(0, 50)) : ''}</div></div>›</a>`; }).join('')
          || `<p class="nessuno">${elenco(S).length ? 'Nessun DDT trovato.' : 'Ancora nessun DDT. Crea il primo con «+ Nuovo DDT».'}</p>`}</div>
      </section>`;
    const c = el.querySelector('[data-f="q"]');
    c.addEventListener('input', () => { cercaT = c.value; clearTimeout(lista.t); lista.t = setTimeout(() => App.ridisegna(), 300); });
    return { titolo: 'Rapportini e DDT', indietro: '#/', live: true };
  }

  // ---------- NUOVO / MODIFICA ----------
  function form(el, S, d0, query) {
    const nuovo = !d0, anno0 = new Date().getFullYear();
    const d = d0 ? JSON.parse(JSON.stringify(d0)) : { id: uid(), numero: prossimo(S, anno0), anno: anno0, rev: 'A', data: oggi(), clienteId: '', sedeId: '', ordine: '', dataOrdine: '', offerta: '', riferimento: '',
      destinazione: '', destinatario: '', righe: [{ qta: '', um: 'PZ', descrizione: '' }], cura: 'mittente', vettore: '', causale: 'fornitura', aspetto: '', colli: '', dataTrasporto: oggi() };
    if (!d.righe?.length) d.righe = [{ qta: '', um: 'PZ', descrizione: '' }];
    let sporco = false;
    // riga presa dal magazzino: descrizione, codice fornitore [codice GI]
    const rigaArt = (a, r) => { const pc = MAG.prezzoCliente(S, a, trovaSede(S, d.sedeId).c);
      return { articoloId: a.id, codice: a.codice || '', descrizione: [a.descrizione, a.codCostruttore].filter(Boolean).join(', '), qta: r.qta || '1', um: r.um || 'PZ', prezzo: r.prezzo || (pc != null ? due(pc) : ''), sconto: r.sconto || '' }; };
    const sedi = () => S.clienti.flatMap((c) => (c.sedi || []).map((s) => ({ c, s }))).concat((S.fornitori || []).flatMap((c) => FORN.sediDi(c).map((s) => ({ c, s, forn: true }))))
      .sort((a, b) => CLI.nome(a.c).localeCompare(CLI.nome(b.c)) || (a.s.nome || '').localeCompare(b.s.nome || ''));
    const etichettaCli = () => { const { c, s } = trovaSede(S, d.sedeId); return c ? `<b>${esc(CLI.nome(c))}</b><small>${esc([s?.nome, indirizzoSede(s).join(', ')].filter(Boolean).join(' · '))}</small>` : '<span class="muted">— tocca per scegliere —</span>'; };
    el.innerHTML = `
      <section class="cli ddt-form">
        <form id="fDdt" class="form" novalidate>
          <div class="card">
            <h2>${nuovo ? 'Nuovo DDT' : 'DDT N° ' + esc(numeroDi(d))}</h2>
            <div class="ddt-num">
              <label>N°<input name="numero" inputmode="numeric" value="${esc(d.numero)}"></label><span>/</span>
              <label>Anno<input name="anno" inputmode="numeric" value="${esc(d.anno)}"></label><span>/</span>
              <label>Rev.<input name="rev" maxlength="2" value="${esc(d.rev || 'A')}"></label>
              <label class="grow">Data documento<input type="date" name="data" value="${esc(d.data)}"></label>
            </div>
            <label>Cliente o fornitore ${info('Tocca e scrivi per cercare: ci sono i clienti e i fornitori (🏭). Scegliendo la sede si compilano il destinatario (con la sede legale, se è scritta in anagrafica) e la destinazione (la sede scelta): puoi cambiarli a mano.')}
              <div class="cli-pick"><button type="button" class="cli-btn" id="btnCli">${etichettaCli()}</button>
                <div class="cli-pop" hidden><input type="search" class="cli-q" placeholder="🔍 Cerca cliente, fornitore o sede" autocomplete="off"><div class="cli-list"></div></div></div></label>
            <div class="due">
              <label>Destinazione<textarea name="destinazione" rows="4" placeholder="Dove va la merce">${esc(d.destinazione)}</textarea></label>
              <label>Destinatario<textarea name="destinatario" rows="4" placeholder="Ragione sociale e indirizzo">${esc(d.destinatario)}</textarea></label>
            </div>
            <details class="rif-rap" ${d.ordine || d.offerta || d.riferimento || d.dataOrdine ? 'open' : ''}><summary>📎 Ordine, offerta e riferimento</summary>
              <div class="due"><label>Ordine n°<input name="ordine" value="${esc(d.ordine)}"></label><label>Data vs ordine<input type="date" name="dataOrdine" value="${esc(d.dataOrdine)}"></label></div>
              <div class="due"><label>Ns offerta<input name="offerta" value="${esc(d.offerta)}"></label><label>Riferimento<input name="riferimento" value="${esc(d.riferimento)}"></label></div>
            </details>
          </div>
          <div class="card">
            <div class="card-head"><h2>Merce ${info('Per il materiale del magazzino usa «📦 Dal magazzino»: scrivi codice o descrizione e tocca l\'articolo, si aggiunge una riga collegata (📦) e quando salvi la quantità a magazzino scende. Per tutto il resto scrivi la riga a mano. Vai a capo per una seconda riga (es. «per CP14»). Codice e prezzo arrivano da soli con gli articoli del magazzino; per ritoccarli tocca ✏️ sotto la riga. I prezzi li vede solo chi ha il permesso e vanno solo sulla copia nostra: al cliente non arrivano mai.')}</h2></div>
            <div id="righe"></div>
            ${UT.puo('sez.magazzino') ? '<label class="art-cerca">📦 Dal magazzino<input id="ddtMag" placeholder="🔍 Cerca codice o descrizione" autocomplete="off"></label>' : ''}
            <button type="button" class="btn ghost aggiungi-riga" id="btnRiga">+ Riga scritta a mano</button>
            <datalist id="dlUm">${UM.map((u) => `<option value="${u}">`).join('')}</datalist>
          </div>
          <div class="card">
            <h2>Trasporto</h2>
            <span class="lab">Trasporto a cura del</span>
            <div class="chip-tecnici" data-scelta="cura">${CURA.map(([k, l]) => `<button type="button" class="chip-t ${d.cura === k ? 'on' : ''}" data-v="${k}">${l}</button>`).join('')}</div>
            <span class="lab">Causale del trasporto</span>
            <div class="chip-tecnici" data-scelta="causale">${CAUSALI.map(([k, l]) => `<button type="button" class="chip-t ${d.causale === k ? 'on' : ''}" data-v="${k}">${l}</button>`).join('')}</div>
            <label>Dati vettore<textarea name="vettore" rows="2" placeholder="Solo se il trasporto è a cura del vettore">${esc(d.vettore)}</textarea></label>
            <div class="tre">
              <label>Aspetto esteriore<input name="aspetto" list="dlAsp" value="${esc(d.aspetto)}"><datalist id="dlAsp">${ASPETTI.map((a) => `<option value="${a}">`).join('')}</datalist></label>
              <label>Colli n°<input name="colli" inputmode="numeric" value="${esc(d.colli)}"></label>
              <label>Data trasporto<input type="date" name="dataTrasporto" value="${esc(d.dataTrasporto)}"></label>
            </div>
          </div>
          <div class="card">
            <h2>Firme</h2>
            <div class="due ddt-firme">
              <div><span class="lab">Firma del conducente</span><div id="fCond"></div></div>
              <div><span class="lab">Firma del destinatario</span><div id="fDest"></div></div>
            </div>
          </div>
          <div class="azioni-form barra-salva">
            ${nuovo ? '' : '<button type="button" class="btn danger ghost" id="btnElimina">Elimina</button>'}
            <span class="grow"></span>
            <a class="btn ghost" href="${nuovo ? '#/rapportini/ddt' : '#/rapportini/ddt/' + d.id}">Annulla</a>
            <button class="btn big" type="submit">Salva</button>
          </div>
        </form>
      </section>`;
    const f = el.querySelector('#fDdt');
    f.addEventListener('input', () => (sporco = true));
    App.proteggi(() => sporco);

    // --- cliente: ricerca come sulla lavagna (nome in evidenza, sede piccola, ordine alfabetico)
    const pop = el.querySelector('.cli-pop'), cq = el.querySelector('.cli-q'), cl = el.querySelector('.cli-list');
    const disegnaCli = () => {
      const parole = cq.value.toLowerCase().split(/\s+/).filter(Boolean);
      const tutte = sedi().filter(({ c, s }) => parole.every((p) => [CLI.nome(c), s.nome, s.sigla, s.citta, s.indirizzo].join(' ').toLowerCase().includes(p)));
      cl.innerHTML = tutte.slice(0, 60).map(({ c, s, forn }) => `<button type="button" data-s="${s.id}"><b>${forn ? '🏭 ' : ''}${esc(CLI.nome(c))}</b><small>${esc([forn ? 'fornitore' : '', s.legale ? 'sede legale' : '', s.nome, s.sigla, indirizzoSede(s).join(', ')].filter(Boolean).join(' · '))}</small></button>`).join('') || '<p class="muted small">Nessun cliente o fornitore trovato.</p>';
      cl.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => scegliSede(b.dataset.s)));
    };
    const scegliSede = (sid) => {
      const vecchio = trovaSede(S, d.sedeId), { c, s } = trovaSede(S, sid);
      // destinatario e destinazione si riscrivono solo se erano vuoti o compilati dall'app
      if (!f.destinatario.value.trim() || f.destinatario.value === testoDest(vecchio.c, vecchio.s, false)) f.destinatario.value = testoDest(c, s, false);
      if (!f.destinazione.value.trim() || f.destinazione.value === testoDest(vecchio.c, vecchio.s, true)) f.destinazione.value = testoDest(c, s, true);
      const forn = (S.fornitori || []).some((x) => x.id === c?.id);
      d.sedeId = sid; d.clienteId = forn ? '' : c?.id || ''; d.fornitoreId = forn ? c.id : ''; sporco = true;
      el.querySelector('#btnCli').innerHTML = etichettaCli(); pop.hidden = true;
    };
    el.querySelector('#btnCli').onclick = () => { pop.hidden = !pop.hidden; if (!pop.hidden) { cq.value = ''; disegnaCli(); cq.focus(); } };
    cq.oninput = disegnaCli;
    cq.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); cl.querySelector('[data-s]')?.click(); } };
    document.addEventListener('pointerdown', function fuori(e) { if (!document.body.contains(pop)) return document.removeEventListener('pointerdown', fuori); if (!e.target.closest('.cli-pick')) pop.hidden = true; });

    // --- righe della merce
    const leggiRighe = () => el.querySelectorAll('.ddt-r').forEach((b, i) => { const r = d.righe[i]; b.querySelectorAll('[data-k]').forEach((x) => (r[x.dataset.k] = x.value)); });
    function disegnaRighe() {
      el.querySelector('#righe').innerHTML = d.righe.map((r, i) => {
        const a = r.articoloId && MAG.trova(S, r.articoloId);
        // riga snella: descrizione, U.M., q.tà. Codice e prezzo arrivano dal magazzino; si ritoccano da «dettagli»
        const pr = vediPrezzi() && (r.prezzo || r.sconto) ? ` · 🔒 ${esc(r.prezzo || '—')} €${r.sconto ? ' −' + esc(r.sconto) + '%' : ''} = <b>${importoTxt(r)}</b>` : '';
        const det = r.codice || pr ? `<span class="ddt-det-txt">${r.codice ? 'Cod. ' + esc(r.codice) : ''}${pr}</span>` : '';
        return `<div class="ddt-r" data-i="${i}">
          <label class="ddt-d">Descrizione${a ? ' <span class="art-tag">📦 dal magazzino <button type="button" class="link" data-scolle="' + i + '" title="Scollega dal magazzino">✕</button></span>' : ''}<textarea data-k="descrizione" rows="${Math.max(1, (r.descrizione || '').split('\n').length)}" placeholder="es. CAVO PIATTO 16 X 1,5 MMQ">${esc(r.descrizione)}</textarea></label>
          <label class="ddt-um">U.M.<input data-k="um" list="dlUm" value="${esc(r.um)}"></label>
          <label class="ddt-q">Q.tà<input data-k="qta" inputmode="decimal" value="${esc(r.qta)}"></label>
          ${d.righe.length > 1 ? `<button type="button" class="btn ghost small danger ddt-x" data-rm="${i}" aria-label="Togli riga">×</button>` : ''}
          <div class="ddt-det">${det}<button type="button" class="link" data-det="${i}">${det ? '✏️' : '+ codice' + (vediPrezzi() ? ' / prezzo' : '')}</button></div>
        </div>`; }).join('');
      el.querySelectorAll('[data-det]').forEach((b) => (b.onclick = () => {
        leggiRighe(); const r = d.righe[+b.dataset.det], scrive = UT.puo('ddt.prezzi.modifica');
        UI.modal({ titolo: 'Dettagli della riga', infoTxt: 'Il codice è il nostro interno e va anche sulla copia del cliente. Prezzo e sconto vanno solo sulla copia nostra. Per gli articoli del magazzino si mettono da soli.',
          valori: { codice: r.codice || '', prezzo: r.prezzo || '', sconto: r.sconto || '' },
          campi: [{ k: 'codice', label: 'Codice interno', maiuscolo: true }, ...(vediPrezzi() && scrive ? [{ k: 'prezzo', label: 'Prezzo €', mezza: true }, { k: 'sconto', label: 'Sconto % (es. 10+5)', mezza: true }] : [])],
          onSalva: (v) => { r.codice = String(v.codice || '').trim().toUpperCase(); if (vediPrezzi() && scrive) { r.prezzo = String(v.prezzo || '').trim().replace('.', ','); r.sconto = String(v.sconto || '').trim().replace('.', ','); } sporco = true; disegnaRighe(); } });
      }));
      el.querySelectorAll('.ddt-r').forEach((b) => {
        const i = +b.dataset.i, ta = b.querySelector('textarea');
        ta.addEventListener('input', () => { ta.rows = Math.max(1, ta.value.split('\n').length); });
        MAG.collegaRicerca(ta, (a) => {
          leggiRighe(); const r = d.righe[i];
          Object.assign(r, rigaArt(a, r)); sporco = true; disegnaRighe();
        }, { soloSe: () => !d.righe[i]?.articoloId });
      });
      el.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { leggiRighe(); d.righe.splice(+b.dataset.rm, 1); sporco = true; disegnaRighe(); }));
      el.querySelectorAll('[data-scolle]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); leggiRighe(); delete d.righe[+b.dataset.scolle].articoloId; sporco = true; disegnaRighe(); }));
    }
    disegnaRighe();
    // «Dal magazzino»: aggiunge una riga collegata all'articolo (o riempie l'ultima se è vuota)
    MAG.collegaRicerca(el.querySelector('#ddtMag'), (a) => {
      leggiRighe(); const ult = d.righe[d.righe.length - 1];
      if (ult && !ult.descrizione && !ult.articoloId) Object.assign(ult, rigaArt(a, ult)); else d.righe.push(rigaArt(a, {}));
      el.querySelector('#ddtMag').value = ''; sporco = true; disegnaRighe(); UI.toast(`${a.codice} aggiunto: controlla la quantità`, '');
    });
    el.querySelector('#btnRiga').onclick = () => { leggiRighe(); d.righe.push({ qta: '', um: 'PZ', descrizione: '' }); disegnaRighe(); el.querySelector('.ddt-r:last-child textarea')?.focus(); };

    // --- scelte a chip (una sola)
    el.querySelectorAll('[data-scelta]').forEach((g) => g.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => {
      d[g.dataset.scelta] = b.dataset.v; sporco = true; g.querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('on', x === b));
    })));

    // --- firme (a tutto schermo)
    const io = UT.attuale();
    // firma del conducente: quella del profilo di chi compila (si può rifare a mano)
    if (!d.firmaConducente && io?.firma) d.firmaConducente = io.firma;
    function disegnaFirma(box, k, titolo, conMia) {
      const b = el.querySelector(box);
      b.innerHTML = d[k] ? `<div class="firma-salvata"><img src="${d[k]}" alt="${esc(titolo)}"></div><div class="ddt-fbt"><button type="button" class="btn ghost small" data-fa>✍️ Rifai</button><button type="button" class="link txt-ko" data-fx>Togli</button></div>`
        : `<button type="button" class="btn btn-firma" data-fa>✍️ Firma</button>${conMia && !io?.firma ? '<p class="muted small">Salva la tua firma nel profilo: così il conducente firma da solo.</p>' : ''}`;
      b.querySelector('[data-fa]').onclick = async () => {
        const img = UT.puo('firma.grande') ? await UI.firmaGrande({ titolo, sotto: 'DDT N° ' + numeroDi({ numero: f.numero.value, anno: f.anno.value, rev: f.rev.value }) }) : await firmaPiccola(b, titolo);
        if (img) { d[k] = img; sporco = true; disegnaFirma(box, k, titolo, conMia); }
      };
      b.querySelector('[data-fx]')?.addEventListener('click', () => { d[k] = null; sporco = true; disegnaFirma(box, k, titolo, conMia); });
      b.querySelector('[data-fm]')?.addEventListener('click', () => { d[k] = io.firma; sporco = true; disegnaFirma(box, k, titolo, conMia); });
    }
    // firma nel riquadro (per chi non ha la firma a tutto schermo)
    const firmaPiccola = (b, titolo) => new Promise((ok) => {
      b.innerHTML = `<div class="firma"><div class="firma-head"><b>${esc(titolo)}</b><button type="button" class="link" data-p>Cancella</button></div><canvas></canvas><span class="firma-hint">Firma qui col dito</span></div>
        <div class="azioni-form"><button type="button" class="btn ghost small" data-n>Annulla</button><button type="button" class="btn small" data-o>✓ Fatto</button></div>`;
      const pad = UI.firmaPad(b.querySelector('canvas'));
      b.querySelector('[data-p]').onclick = () => pad.pulisci();
      b.querySelector('[data-n]').onclick = () => ok(null);
      b.querySelector('[data-o]').onclick = () => ok(pad.vuota() ? null : pad.immagine());
    });
    disegnaFirma('#fCond', 'firmaConducente', 'Firma del conducente', true);
    disegnaFirma('#fDest', 'firmaDestinatario', 'Firma del destinatario', false);

    el.querySelector('#btnElimina')?.addEventListener('click', async () => {
      const rp = rapportinoDi(S, d.id);
      if (!UI.conferma(`Eliminare il DDT N° ${numeroDi(d)}?${rp ? '\n\nÈ abbinato a un rapportino: l\'abbinamento si toglie.' : ''}\n\nLa merce presa dal magazzino torna a magazzino.`)) return;
      if (rp) await UI.salva('rapportini', { ...rp, ddtId: null });
      sporco = false; await Backend.remove('ddt', d.id); UI.toast('DDT eliminato', 'ok'); location.hash = '#/rapportini/ddt';
    });
    f.onsubmit = async (e) => {
      e.preventDefault(); leggiRighe();
      const up = (x) => String(x || '').trim().toUpperCase();
      Object.assign(d, {
        numero: parseInt(f.numero.value, 10) || null, anno: parseInt(f.anno.value, 10) || anno0, rev: up(f.rev.value) || 'A', data: f.data.value || oggi(),
        destinatario: up(f.destinatario.value), destinazione: up(f.destinazione.value), ordine: up(f.ordine.value), dataOrdine: f.dataOrdine.value || '', offerta: up(f.offerta.value), riferimento: up(f.riferimento.value),
        vettore: up(f.vettore.value), aspetto: up(f.aspetto.value), colli: f.colli.value.trim(), dataTrasporto: f.dataTrasporto.value || ''
      });
      d.righe = d.righe.map((r) => ({ ...r, qta: String(r.qta || '').trim().replace('.', ','), um: up(r.um), codice: up(r.codice || '').trim(), prezzo: String(r.prezzo || '').trim().replace('.', ','), sconto: String(r.sconto || '').trim().replace('.', ','), descrizione: up(r.descrizione).replace(/\n{3,}/g, '\n\n') })).filter((r) => r.descrizione || r.qta);
      if (!d.numero) { f.numero.focus(); return UI.toast('Manca il numero del DDT', 'err'); }
      if (!d.destinatario) return UI.toast('Scegli il cliente o scrivi il destinatario', 'err');
      if (!d.righe.length) { d.righe = [{ qta: '', um: 'PZ', descrizione: '' }]; disegnaRighe(); return UI.toast('Scrivi almeno una riga di merce', 'err'); }
      const doppio = elenco(S).find((x) => x.id !== d.id && +x.anno === +d.anno && +x.numero === +d.numero && (x.rev || 'A') === d.rev);
      if (doppio && !UI.conferma(`Esiste già un DDT N° ${numeroDi(d)}. Salvare lo stesso?`)) return;
      if (nuovo) { d.creato = new Date().toISOString(); d.creatoDa = io?.id || ''; }
      sporco = false;
      await UI.salva('ddt', d);
      UI.toast(firmato(d) ? 'DDT salvato e firmato' : 'DDT salvato', 'ok');
      location.hash = '#/rapportini/ddt/' + d.id;
    };
    return { titolo: nuovo ? 'Nuovo DDT' : 'Modifica DDT', indietro: nuovo ? '#/rapportini/ddt' : '#/rapportini/ddt/' + d.id, live: false };
  }

  // ---------- STAMPA: come il modulo cartaceo ----------
  const RIGHE_PAG = 20;
  function pagine(d) {
    // ogni «a capo» della descrizione occupa una riga del modulo
    const linee = [];
    (d.righe || []).forEach((r) => String(r.descrizione || '').split('\n').forEach((t, k) => linee.push(k === 0 ? { qta: r.qta, um: r.um, cod: r.codice || '', prezzo: r.prezzo, sconto: r.sconto, imp: importo(r), t } : { t })));
    const out = []; for (let i = 0; i < Math.max(1, linee.length); i += RIGHE_PAG) out.push(linee.slice(i, i + RIGHE_PAG));
    return out;
  }
  function foglio(d, linee, pag, tot, interna) {
    const box = (x0, y0, x1, y1, cls = '') => `<div class="r2-b ${cls}" style="left:${x0}mm;top:${y0}mm;width:${(x1 - x0).toFixed(2)}mm;height:${(y1 - y0).toFixed(2)}mm"></div>`;
    const t = (x0, y0, x1, y1, txt, cls = '') => `<div class="r2-t ${cls}" data-adatta="0.5" style="left:${x0}mm;top:${y0}mm;width:${(x1 - x0).toFixed(2)}mm;height:${(y1 - y0).toFixed(2)}mm">${txt}</div>`;
    const lin = (x0, x1, y) => `<div class="dd-l" style="left:${x0}mm;top:${y}mm;width:${(x1 - x0).toFixed(2)}mm"></div>`;
    const seg = (on) => `<span class="dd-o">${on ? '⊗' : 'O'}</span>`;
    const L = 10, R = 200;
    let h = '';
    // intestazione
    h += '<img class="dd-logo" src="img/logo-grande.png" alt="Gru Impianti">';
    h += `<div class="dd-intest">GRU IMPIANTI S.a.s. di CAU Alessandro &amp; C.<br>Via Avigliana 4/H - 10057 S. AMBROGIO DI TORINO (TO)<br>P.I. 07256110011<br>Tel. 011 93.65.379<br>e-mail: cau.gruimpianti@gmail.com</div>`;
    h += '<img class="dd-30" src="img/logo-30.png" alt="" onerror="this.remove()">';
    // riquadri in alto
    const Y = [46, 51.9, 57.8, 63.7];
    h += box(L, Y[0], 100, Y[3]) + box(109, Y[0], R, Y[3]);
    [['ordine n°', esc(d.ordine)], ['data vs ordine', d.dataOrdine ? fmt(d.dataOrdine) : ''], ['ns offerta', esc(d.offerta)]].forEach(([l, v], k) => {
      if (k) h += lin(L, 100, Y[k]);
      h += t(L, Y[k], 44.8, Y[k + 1], l, 'dd-lab dx') + t(45.6, Y[k], 99.4, Y[k + 1], v, 'dd-val');
    });
    h += `<div class="dd-v" style="left:44.8mm;top:${Y[0]}mm;height:${Y[3] - Y[0]}mm"></div>`;
    [['DOCUMENTO DI TRASPORTO', esc(numeroDi(d)), 'dd-forte'], ['Data documento', fmt(d.data), ''], ['Riferimento', esc(d.riferimento), '']].forEach(([l, v, cls], k) => {
      if (k) h += lin(109, R, Y[k]);
      h += t(109.6, Y[k], 164.4, Y[k + 1], l, 'dd-lab c ' + cls) + t(165, Y[k], R - 0.6, Y[k + 1], v, 'dd-val c ' + cls);
    });
    h += `<div class="dd-v" style="left:165mm;top:${Y[0]}mm;height:${Y[3] - Y[0]}mm"></div>`;
    // destinazione / destinatario
    const blocco = (x0, x1, tit, testo) => {
      let s = box(x0, 68, x1, 100) + t(x0 + 0.6, 68.6, x1 - 0.6, 73.4, `<b>${tit}</b>&nbsp;Spett.le`, 'dd-lab');
      String(testo || '').split('\n').slice(0, 4).forEach((r, k) => (s += t(x0 + 0.6, 73.6 + k * 6.2, x1 - 0.6, 79.4 + k * 6.2, esc(r), 'dd-val dd-dest')));
      return s;
    };
    h += blocco(L, 100, 'destinazione:', d.destinazione) + blocco(107, R, 'destinatario:', d.destinatario);
    // righe della merce: codice, descrizione, U.M., quantità (+ prezzo, sconto, importo solo sulla copia interna)
    const C = interna ? [L, 32, 122, 132, 145, 163, 173, R] : [L, 34, 162, 176, R], T0 = 103, TH = 5, RH = 6, TF = T0 + TH + RIGHE_PAG * RH;
    const TIT = ['Codice', 'Descrizione', 'UM', 'Quantità', 'Prezzo', 'Sc. %', 'Importo'];
    h += box(L, T0, R, TF + RH) + lin(L, R, T0 + TH) + lin(L, R, TF);
    C.slice(1, -1).forEach((x) => (h += `<div class="dd-v" style="left:${x}mm;top:${T0}mm;height:${TF - T0}mm"></div>`));
    C.slice(0, -1).forEach((x, k) => (h += t(x, T0, C[k + 1], T0 + TH, `<b>${TIT[k]}</b>`, 'dd-lab c dd-tit')));
    for (let k = 1; k < RIGHE_PAG; k++) h += `<div class="dd-l dd-pt" style="left:${L}mm;top:${T0 + TH + k * RH}mm;width:${R - L}mm"></div>`;
    linee.forEach((x, k) => {
      const y = T0 + TH + k * RH;
      h += t(C[1] + 0.6, y, C[2] - 0.6, y + RH, esc(x.t), 'dd-val' + (x.qta === undefined ? ' dd-sotto' : ''));
      if (x.qta === undefined) return;
      h += t(C[0] + 0.6, y, C[1] - 0.6, y + RH, esc(x.cod), 'dd-val dd-cod') + t(C[2], y, C[3], y + RH, esc(x.um || ''), 'dd-val c') + t(C[3], y, C[4], y + RH, esc(x.qta), 'dd-val c');
      if (interna) h += t(C[4], y, C[5] - 0.8, y + RH, x.prezzo ? esc(due(nuQ(x.prezzo))) : '', 'dd-val dx') + t(C[5], y, C[6], y + RH, esc(x.sconto || ''), 'dd-val c') + t(C[6], y, C[7] - 0.8, y + RH, x.imp != null ? esc(euroD(x.imp)) : '', 'dd-val dx');
    });
    if (interna && pag === tot) {
      const totale = (d.righe || []).reduce((s2, r) => s2 + (importo(r) || 0), 0);
      h += `<div class="dd-v" style="left:${C[6]}mm;top:${TF}mm;height:${RH}mm"></div>`;
      h += t(C[4], TF, C[6] - 0.8, TF + RH, '<b>TOTALE</b>', 'dd-lab dx') + t(C[6], TF, C[7] - 0.8, TF + RH, esc(euroD(totale)), 'dd-val dx');
    }
    if (interna) h += `<div class="r2-t dd-interna" style="left:109mm;top:40mm;width:91mm;height:5mm">COPIA NOSTRA CON PREZZI · NON CONSEGNARE AL CLIENTE</div>`;
    // piede: trasporto, vettore, causale
    const P = [237, 241.6, 246.2, 250.8, 255.4, 260, 264.6, 284];
    const A = 48, B = 124.8;
    h += box(L, P[0], R, P[7]);
    h += lin(L, R, P[1]) + lin(L, A, P[2]) + lin(L, A, P[3]) + lin(L, A, P[4]) + lin(L, B, P[5]) + lin(L, R, P[5]) + lin(L, R, P[6]);
    h += `<div class="dd-v" style="left:${A}mm;top:${P[0]}mm;height:${P[4] - P[0]}mm"></div><div class="dd-v" style="left:${B}mm;top:${P[0]}mm;height:${P[7] - P[0]}mm"></div>`;
    h += t(L, P[0], A, P[1], '<b>Trasporto a cura del</b>', 'dd-lab') + t(A, P[0], B, P[1], '<b>Dati vettore</b>', 'dd-lab c') + t(B, P[0], R, P[1], '<b>Causale del trasporto</b>', 'dd-lab c');
    CURA.forEach(([k, l], i) => (h += t(L, P[i + 1], A - 7, P[i + 2], l, 'dd-lab dd-pic') + t(A - 7, P[i + 1], A, P[i + 2], seg(d.cura === k), 'c')));
    h += `<div class="r2-testo dd-vett" style="left:${A + 0.8}mm;top:${P[1] + 0.6}mm;width:${B - A - 1.6}mm;height:${P[4] - P[1] - 1}mm">${esc(d.vettore || '')}</div>`;
    h += t(L, P[4], 41, P[5], 'ASPETTO ESTERIORE', 'dd-lab dd-pic') + t(41, P[4], B - 0.6, P[5], esc(d.aspetto || ''), 'dd-val');
    const cau = (k) => d.causale === k;
    h += t(B + 0.6, P[1], R - 0.6, P[2], `FORNITURA E MONTAGGIO ${seg(cau('fornitura'))}`, 'dd-lab dd-pic');
    h += t(B + 0.6, P[2], 165, P[3], `CONTO LAVORAZIONE ${seg(cau('lavorazione'))}`, 'dd-lab dd-pic') + t(165, P[2], R - 0.6, P[3], `VISIONE ${seg(cau('visione'))}`, 'dd-lab dd-pic c');
    h += t(B + 0.6, P[3], 165, P[4], `RESO RIPARATO ${seg(cau('riparato'))}`, 'dd-lab dd-pic') + t(165, P[3], R - 0.6, P[4], `NON RIPARATO ${seg(cau('nonRiparato'))}`, 'dd-lab dd-pic c');
    h += t(B + 0.6, P[4], R - 0.6, P[5], `RESO NON CONFORME ${seg(cau('nonConforme'))}`, 'dd-lab dd-pic');
    // data trasporto, colli, firme
    const F = [L, 44.8, 71.9, B, R];
    h += `<div class="dd-v" style="left:${F[1]}mm;top:${P[5]}mm;height:${P[7] - P[5]}mm"></div><div class="dd-v" style="left:${F[2]}mm;top:${P[5]}mm;height:${P[7] - P[5]}mm"></div>`;
    ['Data trasporto', 'Colli n°', 'Firma del conducente', 'Firma del destinatario'].forEach((l, k) => (h += t(F[k], P[5], F[k + 1], P[6], `<b>${l}</b>`, 'dd-lab c')));
    h += t(F[0], P[6], F[1], P[7], d.dataTrasporto ? fmt(d.dataTrasporto) : '', 'dd-val c dd-gr') + t(F[1], P[6], F[2], P[7], esc(d.colli || ''), 'dd-val c dd-gr');
    if (d.firmaConducente) h += `<img class="r2-firma" src="${d.firmaConducente}" alt="" style="left:${F[2] + 2}mm;top:${P[6] + 1}mm;width:${F[3] - F[2] - 4}mm;height:${P[7] - P[6] - 2}mm">`;
    if (d.firmaDestinatario) h += `<img class="r2-firma" src="${d.firmaDestinatario}" alt="" style="left:${F[3] + 2}mm;top:${P[6] + 1}mm;width:${F[4] - F[3] - 4}mm;height:${P[7] - P[6] - 2}mm">`;
    if (tot > 1) h += `<div class="r2-t r2-piede" style="left:170mm;top:286mm;width:30mm;text-align:right">Pag. ${pag}/${tot}</div>`;
    return `<article class="recap rap2 ddt-pag">${h}</article>`;
  }

  function vista(el, S, d, query) {
    const { c } = trovaSede(S, d.sedeId), rp = rapportinoDi(S, d.id), pp = pagine(d);
    const interna = false;   // a video la copia cliente; la copia nostra si sceglie quando si stampa
    el.innerHTML = `
      <section class="stampa-recap">
        <div class="azioni-lista no-print">
          ${UT.puo('stampa') ? '<button class="btn" id="btnStampa">🖨️ Stampa / salva PDF</button>' : ''}
          ${UT.puo('ddt.scrivere') && !UT.solaLettura() ? `<a class="btn ghost" href="#/rapportini/ddt/${d.id}/modifica">${firmato(d) ? '✏️ Modifica' : '✍️ Completa e firma'}</a>` : ''}
          <a class="btn ghost" href="#/rapportini/ddt">Elenco</a>
          ${firmato(d) ? '' : '<span class="pill st-ko">Da firmare</span>'}
          ${rp ? `<a class="pill st-inv" href="#/rapportini/r/${rp.id}">🔗 Rapportino N° ${esc(rp.numero ? rp.numero + '/' + rp.anno : 'in arrivo')}</a>` : '<span class="muted small">Non abbinato a nessun rapportino</span>'}
          ${info('Scegli «Salva come PDF» nella finestra di stampa, formato A4 verticale, margini «Nessuno».')}
        </div>
        <div class="recap-wrap">${pp.map((l, i) => foglio(d, l, i + 1, pp.length, interna)).join('')}</div>
      </section>`;
    const fogli = [...el.querySelectorAll('.ddt-pag')];
    fogli.forEach((x) => { x.style.zoom = 1; UI.adattaTesti(x); });
    const scala = () => fogli.forEach((x) => { const w = x.parentElement.clientWidth; if (w < 50) return; x.style.zoom = Math.min(1, (w - 4) / x.offsetWidth).toFixed(3); });
    scala(); window.addEventListener('resize', scala);
    const wrap = el.querySelector('.recap-wrap');
    const stampa = (cosa) => {
      // cosa: 'cliente' | 'nostra' | 'entrambe'
      const set = (cosa === 'entrambe' ? [false, true] : [cosa === 'nostra']).flatMap((int) => pp.map((l, i) => foglio(d, l, i + 1, pp.length, int)));
      const prima = wrap.innerHTML; wrap.innerHTML = set.join('');
      wrap.querySelectorAll('.ddt-pag').forEach((x) => { x.style.zoom = 1; UI.adattaTesti(x); });
      const t0 = document.title; document.title = `DDT_${d.numero}-${aa(d.anno)}-${d.rev || 'A'}_${c ? CLI.nome(c) : ''}${cosa === 'nostra' ? '_COPIA_NOSTRA' : cosa === 'entrambe' ? '_CLIENTE_E_NOSTRA' : ''}`.replace(/[^\w\-]+/g, '_');
      window.print();
      setTimeout(() => { document.title = t0; wrap.innerHTML = prima; const f = [...wrap.querySelectorAll('.ddt-pag')]; f.forEach((x) => { x.style.zoom = 1; UI.adattaTesti(x); }); fogli.splice(0, fogli.length, ...f); scala(); }, 1000);
    };
    el.querySelector('#btnStampa')?.addEventListener('click', () => {
      if (!vediPrezzi()) return stampa('cliente');
      const m = document.createElement('div'); m.className = 'modal-ov';
      m.innerHTML = `<div class="modal ddt-scelta"><div class="modal-head"><h2>🖨️ Cosa stampo?</h2><button type="button" class="modal-x" aria-label="Chiudi">×</button></div>
        <div class="modal-body"><div class="ddt-scelte">
          <button type="button" class="btn" data-c="entrambe">Copia cliente + copia nostra</button>
          <button type="button" class="btn ghost" data-c="cliente">Solo copia cliente <small>senza prezzi</small></button>
          <button type="button" class="btn ghost" data-c="nostra">Solo copia nostra <small>🔒 con prezzi e totale</small></button></div></div></div>`;
      document.body.appendChild(m);
      m.querySelector('.modal-x').onclick = () => m.remove();
      m.addEventListener('click', (e) => { if (UI.toccoFuori(e, m)) m.remove(); });
      m.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { m.remove(); setTimeout(() => stampa(b.dataset.c), 50); }));
    });
    return { titolo: 'DDT N° ' + numeroDi(d), indietro: '#/rapportini/ddt', live: true };
  }

  function route(el, S, parti, query) {
    if (parti[2] === 'nuovo') return form(el, S, null, query);
    if (parti[2]) {
      const d = elenco(S).find((x) => x.id === parti[2]);
      if (!d) { el.innerHTML = '<p class="nessuno">DDT non trovato.</p>'; return { titolo: 'DDT', indietro: '#/rapportini/ddt' }; }
      if (parti[3] === 'modifica') return form(el, S, d, query);
      return vista(el, S, d, query);
    }
    return lista(el, S);
  }

  return { route, tabs, numeroDi, abbinabili, rapportinoDi, firmato };
})();
