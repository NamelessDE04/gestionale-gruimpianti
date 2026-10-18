// ===== MODALITÀ DIMOSTRAZIONE =====
// Tocca «DEMO» in alto: l'app si riempie di dati inventati (clienti, impianti, controlli, sottoganci,
// mezzi, rapportini, collaudi, lavagna) salvati SOLO su questo dispositivo, in uno spazio separato.
// I dati veri (e il cloud) non vengono toccati. «Torna ai nostri dati» riporta tutto com'era.
window.DEMO = (function () {
  const CHIAVE = 'gid_modo_prova';
  const P = 'gid_prova_', PL = 'lavagna_prova_';
  const attiva = () => { try { return localStorage.getItem(CHIAVE) === '1'; } catch (e) { return false; } };

  // ---------- utilità casuali ----------
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const prob = (p) => Math.random() < p;
  const uid = () => UI.uid();
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const giorno = (y, m, d) => iso(new Date(y, m - 1, d));
  const feriale = (y, m, dmin = 1, dmax = 28) => { for (let k = 0; k < 30; k++) { const d = new Date(y, m - 1, rnd(dmin, dmax)); if (d.getDay() > 0 && d.getDay() < 6) return iso(d); } return giorno(y, m, dmin); };
  const OGGI = new Date(), ANNO = OGGI.getFullYear(), MESE = OGGI.getMonth() + 1;

  // firma finta (scarabocchio diverso per ogni nome), PNG trasparente
  function firma(seed) {
    const c = document.createElement('canvas'); c.width = 260; c.height = 80;
    const x = c.getContext('2d'); x.scale(.6, .6); x.strokeStyle = '#10243a'; x.lineWidth = 2.6; x.lineCap = 'round'; x.lineJoin = 'round';
    let s = 0; for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) % 9973;
    const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    x.beginPath(); let px = 12, py = 48; x.moveTo(px, py);
    for (let i = 0; i < 11; i++) { const nx = px + 14 + r() * 12, ny = 18 + r() * 46; x.quadraticCurveTo(px + (nx - px) / 2, py + (r() - .5) * 60, nx, ny); px = nx; py = ny; }
    x.stroke(); x.beginPath(); x.moveTo(20, 62 + r() * 6); x.quadraticCurveTo(120, 70, 230, 56 + r() * 8); x.stroke();
    const o = document.createElement('canvas'); o.width = 156; o.height = 48; o.getContext('2d').drawImage(c, 0, 0);   // piccola: occupa poco spazio
    return o.toDataURL('image/png');
  }

  // ---------- nomi inventati ----------
  const DITTE = ['OFFICINE MECCANICHE ALFIERI', 'CARPENTERIA BORGONUOVO', 'ACCIAI MONTEROSA', 'TORNERIA DEL CANAVESE', 'LAMIERE PIEMONTESI', 'FONDERIA SAN GRATO',
    'METALTECNICA ORBASSANO', 'STAMPI E PRESSE VALLETTA', 'LOGISTICA PO SUD', 'PREFABBRICATI COLLINA', 'IDRAULICA MONVISO', 'CARTIERA DELLA DORA'];
  const FORME = ['SRL', 'SPA', 'SNC', 'SRL'];
  const LUOGHI = [['TORINO', '10100'], ['VINOVO', '10048'], ['NICHELINO', '10042'], ['MONCALIERI', '10024'], ['CHIERI', '10023'], ['CARMAGNOLA', '10022'],
    ['PINEROLO', '10064'], ['RIVOLI', '10098'], ['ORBASSANO', '10043'], ['SETTIMO TORINESE', '10036'], ['IVREA', '10015'], ['AVIGLIANA', '10051'], ['ASTI', '14100'], ['BRA', '12042']];
  const VIE = ['VIA DELL\'INDUSTRIA', 'VIA DEI MESTIERI', 'CORSO EUROPA', 'STRADA PROVINCIALE', 'VIA DELLE OFFICINE', 'VIA TORINO', 'VIA DEL LAVORO', 'STRADA DEL PORTO'];
  const NOMI = ['MARIO', 'GIUSEPPE', 'LAURA', 'PAOLO', 'ELENA', 'STEFANO', 'CHIARA', 'ROBERTO', 'SILVIA', 'FRANCO', 'MARTA', 'ALBERTO'];
  const COGNOMI = ['BIANCO', 'GALLO', 'COSTA', 'FONTANA', 'RICCI', 'MARINO', 'GRECO', 'BRUNO', 'CONTI', 'GIORDANO', 'RINALDI', 'LOMBARDO'];
  const MARCHE = ['SOLLEVA', 'ALZATECH', 'GRUMEC', 'ELEVA', 'TRAVEX'];
  const TIPOLOGIE = ['Bitrave', 'Bitrave', 'Monotrave', 'Monotrave', 'Bitrave tralicciata', 'Cavalletto', 'Bandiera a colonna', 'Bandiera a mensola'];
  const ANOMALIE = ['FUNE CON FILI ROTTI, DA SOSTITUIRE', 'SICURA GANCIO DANNEGGIATA', 'FRENO DA REGISTRARE', 'FINECORSA SALITA DA REGOLARE', 'PULSANTIERA CON TASTO DANNEGGIATO', 'PERDITA OLIO RIDUTTORE', 'TARGA PORTATA NON LEGGIBILE'];
  const PARTI_SG = [['BRACA IN POLIESTERE', () => `${pick([1, 2, 3, 5])}T ${pick([1000, 2000, 3000, 4000])}`], ['FUNE ACCIAIO A.A.', () => `${pick([12, 14, 16, 18, 20])}x${pick([2000, 3000, 4000])}`],
    ['CATENA 2 BRACCI', () => `${pick([8, 10, 13])}x${pick([1500, 2000])}`], ['CATENA 4 BRACCI', () => `${pick([10, 13])}x${pick([2000, 2500])}`], ['BILANCINO', () => `${pick([2, 5, 10])} T`], ['GRILLO', () => `${pick([2, 3.25, 4.75, 6.5])} T`]];

  // ---------- generazione ----------
  function genera(realiUtenti) {
    const D = { clienti: [], impianti: [], schedeControllo: [], sottoganci: [], giriSottoganci: [], mezzi: [], rapportini: [], collaudi: [], impostazioni: [], log: [] };
    // utenti: i vostri (per poter entrare col PIN) + due tecnici e una persona RU inventati
    const utenti = (realiUtenti || []).map((u) => ({ ...u, firma: u.firma || (u.ruolo !== 'ru' ? firma(u.nome) : null) }));
    [['MARCO BERTOLA', 'MARCO B.', 'tecnico'], ['DAVIDE FERRERO', 'DAVIDE', 'tecnico'], ['ANNA ROSSO', 'ANNA', 'ru']].forEach(([nome, nb, ruolo]) => {
      if (!utenti.some((u) => u.nome === nome)) utenti.push({ id: uid(), nome, nomeBreve: nb, ruolo, google: '', firma: ruolo !== 'ru' ? firma(nome) : null, attivo: true });
    });
    const tecnici = utenti.filter((u) => u.ruolo !== 'ru' && u.attivo !== false);
    const breve = (u) => u.nomeBreve || u.nome;
    const squadra = () => { const a = pick(tecnici), b = pick(tecnici.filter((x) => x.id !== a.id)) || a; return a.id === b.id ? [a] : [a, b]; };

    // clienti e sedi
    const ditte = DITTE.slice().sort(() => Math.random() - .5).slice(0, 10);
    ditte.forEach((nome, ci) => {
      const nSedi = ci < 3 ? rnd(2, 3) : 1;
      const breveC = nome.split(' ').filter((w) => w.length > 3).slice(-1)[0];
      const c = { id: uid(), ragioneSociale: `${nome} ${pick(FORME)}`, nomeBreve: breveC, piva: String(rnd(10000000000, 99999999999)), cf: '', sdi: pick(['M5UXCR1', 'KRRH6B9', 'T9K4ZHO']),
        telefono: `011 ${rnd(200, 999)} ${rnd(1000, 9999)}`, email: `info@${breveC.toLowerCase()}.esempio.it`, pec: `${breveC.toLowerCase()}@pec.esempio.it`, sedi: [], referenti: [] };
      for (let k = 0; k < nSedi; k++) {
        const [citta, cap] = pick(LUOGHI);
        const sigla = (breveC.slice(0, 3) + (nSedi > 1 ? k + 1 : '')).toUpperCase();
        const mese1 = rnd(1, 3);
        c.sedi.push({ id: uid(), nome: nSedi > 1 ? `STABILIMENTO ${citta}` : 'SEDE', sigla, indirizzo: `${pick(VIE)} ${rnd(1, 120)}`, cap, citta, provincia: cap.startsWith('14') ? 'AT' : cap.startsWith('12') ? 'CN' : 'TO',
          km: rnd(4, 70), viaggio: rnd(10, 75), pianoControlli: { mese1, annuale: rnd(1, 4) } });
      }
      for (let k = 0; k < rnd(1, 2); k++) c.referenti.push({ id: uid(), nome: pick(NOMI), cognome: pick(COGNOMI), telefono: `3${rnd(20, 49)} ${rnd(100, 999)} ${rnd(1000, 9999)}`, email: `ufficio.tecnico${k || ''}@${breveC.toLowerCase()}.esempio.it` });
      D.clienti.push(c);
    });
    const sedi = D.clienti.flatMap((c) => c.sedi.map((s) => ({ c, s })));

    // impianti
    let nInt = 1;
    sedi.forEach(({ c, s }) => {
      for (let k = 0; k < rnd(2, 5); k++) {
        const tip = pick(TIPOLOGIE), bandiera = /bandiera/i.test(tip), doppio = !bandiera && prob(.25);
        const portata = bandiera ? pick([250, 500, 1000, 2000]) : pick([2000, 3200, 5000, 6300, 10000, 12500, 16000, 20000]);
        const par = (ruolo, kg) => ({ ruolo, portata: kg, tipo: 'Paranco', marcaModello: `${pick(MARCHE)} ${pick(['DH', 'PX', 'SL', 'MR'])} ${rnd(2, 9)}00`, velocita: pick(['5/0,8', '8/1,3', '4/0,6']),
          classeFem: pick(['1Am', '2m', '3m']), classeIso: pick(['M4', 'M5', 'M6']), corsa: rnd(6, 12),
          fune: { conformazione: pick(['6x36 WS + IWRC', '8x19', 'Antigirevole 35x7']), diametro: pick([8, 10, 12, 14, 16, 18, 20]), tratti: pick([2, 4]), lunghezza: rnd(30, 90) },
          motore: { marca: pick(MARCHE), potenza: pick(['3/0,75', '6,3/1,6', '9/2,2']), tensione: '400', frenoPresente: true, frenoTipo: 'Elettromagnetico a disco' },
          carrello: bandiera ? undefined : { tipologia: pick(['Birotaia', 'Monorotaia']), velocita: pick(['20/5', '25/6']), motore: { potenza: '0,37/0,09', tensione: '400', frenoPresente: true } } });
        const i = { id: uid(), clienteId: c.id, sedeId: s.id, tipologia: tip, marca: pick(MARCHE), annoCostruzione: rnd(1988, ANNO - 1),
          matricola: `${pick(['GR', 'MT', 'CP'])}${rnd(10000, 99999)}`, numeroSerie: String(rnd(100000, 999999)), numeroInterno: String(nInt++), scartamento: bandiera ? '' : rnd(8, 28) * 1000,
          paranchi: doppio ? [par('Primario', portata), par('Secondario', Math.round(portata / 4))] : [par('Primario', portata)],
          ponte: bandiera ? undefined : { numeroMotori: 2, velocita: pick(['40/10', '32/8']), motore: { potenza: '0,75/0,18', tensione: '400', frenoPresente: true } },
          elettrico: { tensionePrimaria: '400 V 50 HZ TRIFASE', tensioniSecondarie: ['48 V CA'], alimTipo: pick(['Linea a festone', 'Blindosbarra']), comando: pick(['Pulsantiera', 'Radiocomando', 'Pulsantiera e radiocomando']) },
          storico: prob(.3) ? [{ id: uid(), data: giorno(ANNO - 1, rnd(1, 12), rnd(1, 28)), componente: 'Fune di sollevamento', note: 'FUNE SOSTITUITA PER USURA', tecnico: breve(pick(tecnici)) }] : [] };
        D.impianti.push(i);
      }
    });

    // controlli carriponte dell'anno: quelli dei mesi passati fatti (tranne qualche sede "in ritardo")
    const finti = { impostazioni: [] };
    const ritardo = new Set(sedi.filter(() => prob(.2)).map(({ s }) => s.id));
    D.impianti.forEach((i) => {
      const { s } = sedi.find((x) => x.s.id === i.sedeId);
      const p = CTR.piano(s), np = i.paranchi.length;
      const sc = { id: i.id + '-' + ANNO, impiantoId: i.id, sedeId: i.sedeId, clienteId: i.clienteId, anno: ANNO, voci: CTR.vociPerImpianto(finti, i).map((v) => ({ ...v })), visite: {}, osservazioni: [] };
      let lettera = 0;
      for (let n = 1; n <= 4; n++) {
        const mese = CTR.meseVisita(p, n);
        if (mese > MESE || (mese === MESE && prob(.5))) break;
        if (ritardo.has(i.sedeId) && (mese >= MESE - 2)) break;
        const per = CTR.periodiDi(CTR.tipoVisita(p, n));
        const sq = squadra(), fd = sq[0];
        const data = feriale(ANNO, mese, 3, mese === MESE ? Math.max(3, Math.min(28, OGGI.getDate() - 1)) : 26);
        const vis = { dataScheda: data, dataEsecuzione: data, tecnici: sq.map((u) => ({ id: u.id, nome: breve(u) })), tecnico: sq.map(breve).join(' e '), firmaDi: fd.id, firma: fd.firma, esiti: {}, valori: {} };
        sc.voci.filter((v) => per.includes(v.per)).forEach((v) => {
          vis.esiti[v.id] = Array.from({ length: np }, (_, k) => {
            const aperta = sc.osservazioni.find((o) => o.vocId === v.id && (o.p || 1) === k + 1 && !o.risoltaIl);
            if (aperta) return aperta.lettera;
            // campo valore: non sempre si prende (qui circa 2 volte su 3), il codice X c'è comunque
            if (CTR.haValore(v) && prob(.65)) (vis.valori[v.id] = vis.valori[v.id] || Array(np).fill(''))[k] = String((+i.paranchi[k].fune.diametro - Math.random() * .6).toFixed(1)).replace('.', ',');
            if (prob(.04) && lettera < 6) {
              const l = String.fromCharCode(65 + lettera++);
              sc.osservazioni.push({ lettera: l, testo: pick(ANOMALIE), vocId: v.id, p: k + 1, visita: n, data, ...(prob(.5) ? { risoltaIl: feriale(ANNO, Math.min(MESE, mese + 1)) } : {}) });
              return l;
            }
            return prob(.85) ? 'X' : pick(['L', 'P', 'R', 'S']);
          });
        });
        sc.visite[n] = vis;
      }
      if (Object.keys(sc.visite).length) D.schedeControllo.push(sc);
    });

    // sottoganci: cartelle per alcune sedi, con i controlli trimestrali fatti
    sedi.filter((_, k) => k % 2 === 0).slice(0, 6).forEach(({ c, s }) => {
      s.cartellaSottoganci = true; s.titoloElenco = pick(['ELENCO SOTTOGANCI', 'ELENCO FUNI', 'ELENCO ACCESSORI DI SOLLEVAMENTO']);
      const items = [];
      for (let n = 1; n <= rnd(8, 16); n++) {
        const nParti = prob(.2) ? 2 : 1;
        const parti = Array.from({ length: nParti }, () => { const [d, m] = pick(PARTI_SG); return { denominazione: d, dimensioni: m() }; });
        const sg = { id: uid(), sedeId: s.id, numero: String(n), parti, portata: `${pick([1000, 2000, 3150, 5000])} KG`, ubicazione: `CP${rnd(1, 6)}`, certificato: prob(.6) ? `C${rnd(1000, 9999)}` : '' };
        items.push(sg); D.sottoganci.push(sg);
      }
      const fatti = Math.max(1, Math.ceil(MESE / 3) - (prob(.3) ? 1 : 0));
      for (let slot = 1; slot <= Math.min(4, fatti); slot++) {
        const sq = squadra(), fd = sq[0];
        const g = { id: uid(), sedeId: s.id, clienteId: c.id, anno: ANNO, slot, data: feriale(ANNO, Math.min(MESE, slot * 3 - 1)), tecnici: sq.map((u) => ({ id: u.id, nome: breve(u) })), tecnico: sq.map(breve).join(' e '),
          firmaDi: fd.id, firmaTecnico: fd.firma, noteGenerali: '', righe: {} };
        items.forEach((sg) => (g.righe[sg.id] = { codici: sg.parti.map(() => (prob(.88) ? 'B' : pick(['D', 'D', 'DE', 'S']))), note: sg.parti.map(() => (prob(.05) ? 'LEGGERA USURA' : '')) }));
        D.giriSottoganci.push(g);
      }
    });

    // mezzi e piattaforme (uno con il bollo in scadenza per far vedere l'avviso)
    const fra = (gg) => iso(new Date(OGGI.getTime() + gg * 864e5));
    [['FURGONE', 'GRANDE', 15], ['FURGONE', 'MEDIO', 180], ['FURGONE', 'ATTREZZATO', 260], ['AUTO', 'DI SERVIZIO', 400]].forEach(([marca, modello, gg]) =>
      D.mezzi.push({ id: uid(), marca, modello, targa: `${String.fromCharCode(65 + rnd(0, 7))}${String.fromCharCode(65 + rnd(0, 25))}${rnd(100, 999)}${String.fromCharCode(65 + rnd(0, 25))}${String.fromCharCode(65 + rnd(0, 25))}`,
        immatricolazione: giorno(rnd(2015, 2023), rnd(1, 12), rnd(1, 28)), bollo: fra(gg), revisione: fra(gg + rnd(30, 300)), assicurazione: fra(rnd(40, 330)), documenti: [] }));
    [['MOBILE CON STABILIZZATORI', 'PIATTAFORMA', 'SPIDER 17', 25], ['SEMOVENTE ARTICOLATA', 'PIATTAFORMA', 'ART 16', 200]].forEach(([tipo, marca, modello, gg]) =>
      D.mezzi.push({ id: uid(), categoria: 'piattaforma', tipoPiattaforma: tipo, marca, modello, matricola: `PL${rnd(1000, 9999)}`, anno: rnd(2012, 2022), altezza: rnd(14, 20), portata: 200, controllo: fra(gg), documenti: [] }));
    const furgoni = D.mezzi.filter((m) => !m.categoria), piatt = D.mezzi.filter((m) => m.categoria);

    // rapportini degli ultimi mesi
    const FRASI = ['ESEGUITO CONTROLLO PERIODICO DEI CARRIPONTE AI SENSI DEL D.LGS. 81/08. ESITI RIPORTATI SULLE RELATIVE SCHEDE DI CONTROLLO.',
      'ESEGUITA VERIFICA TRIMESTRALE DI FUNI, CATENE, BRACHE E ACCESSORI DI SOLLEVAMENTO AI SENSI DEL D.LGS. 81/08, ALLEGATO VI, PUNTO 3.1.2.',
      'SOSTITUITA FUNE DI SOLLEVAMENTO E ESEGUITA PROVA DI FUNZIONAMENTO.', 'REGISTRAZIONE FRENO DI SOLLEVAMENTO E PROVE DI FUNZIONAMENTO A VUOTO.',
      'SOSTITUITA PULSANTIERA DI COMANDO E VERIFICATI I FINECORSA.', 'ESEGUITO SOPRALLUOGO TECNICO PER LA VALUTAZIONE DELL\'INTERVENTO RICHIESTO.'];
    const DA = ['', '', 'SOSTITUZIONE DELLA FUNE DI SOLLEVAMENTO.', 'SEGUIRÀ NOSTRA OFFERTA PER GLI INTERVENTI NECESSARI.', 'NESSUN LAVORO DA ESEGUIRE.'];
    const rap = [];
    for (let k = 0; k < 24; k++) {
      const { c, s } = pick(sedi), mese = Math.max(1, MESE - rnd(0, 4));
      const d1 = feriale(ANNO, mese, 1, mese === MESE ? Math.max(1, OGGI.getDate() - 1) : 26);
      const nGiorni = prob(.2) ? 2 : 1, sq = squadra(), usaP = prob(.25);
      const giorni = Array.from({ length: nGiorni }, (_, gi) => {
        const data = gi ? iso(new Date(new Date(d1).getTime() + 864e5)) : d1, solo = prob(.25);
        return { id: uid(), data, mattDa: solo ? '' : '08:00', mattA: solo ? '' : pick(['12:00', '12:30']), pomDa: pick(['13:30', '14:00']), pomA: pick(['17:00', '17:30', '18:00']),
          tratta: 'AR', km: String(s.km * 2), viaggio: String(s.viaggio * 2), persone: String(sq.length), tecnici: sq.map((u) => u.id),
          piattaforme: usaP ? [pick(piatt).id] : [], piattaformeTipi: usaP ? [piatt[0].tipoPiattaforma] : [], note: prob(.2) ? 'ACCESSO DA CANCELLO 2' : '' };
      });
      const ref = pick(c.referenti), firmato = !(mese === MESE && prob(.35));
      rap.push({ id: uid(), clienteId: c.id, sedeId: s.id, giorni, eseguiti: pick(FRASI), daEseguire: pick(DA), dataConsegna: giorni[giorni.length - 1].data, ...(prob(.5) ? { ordine: "ODA " + (4000 + Math.floor(Math.random() * 900)) } : {}), ...(prob(.4) ? { offerta: "OFF. " + (100 + Math.floor(Math.random() * 200)) + "/" + giorni[0].data.slice(0, 4) } : {}), ...(prob(.3) ? { ddtNumero: String(10 + Math.floor(Math.random() * 300)), ddtData: giorni[giorni.length - 1].data } : {}),
        referenteId: ref.id, referenteNome: `${ref.nome} ${ref.cognome}`, firmaReferente: firmato ? firma(ref.nome + ref.cognome) : null,
        firmaDi: sq[0].id, firmaTecnico: sq[0].firma, firmatarioTecnico: breve(sq[0]), anno: ANNO, creato: d1 + 'T18:00:00.000Z' });
    }
    rap.sort((a, b) => a.giorni[0].data.localeCompare(b.giorni[0].data)).forEach((r, k) => (r.numero = k + 1));
    D.rapportini = rap;

    // rapporti di collaudo del configuratore
    for (let k = 0; k < 4; k++) {
      const { c } = pick(sedi), t = pick(tecnici), ok = prob(.75);
      D.collaudi.push({ id: uid(), nome: `GHO-DEMO${k + 1}.pdf`, cliente: c.ragioneSociale, matricola: `GR${rnd(10000, 99999)}`, note: '', configurazione: pick(['monotrave-donati', 'monotrave-misia-conico']),
        carrello: pick(['SINGOLA VELOCITÀ', 'DOPPIA VELOCITÀ']), sollevamento: 'DOPPIA VELOCITÀ', motore: '', esiti: Array(14).fill('v').map((x) => (ok || prob(.8) ? x : 'x')), completo: ok,
        data: new Date(ANNO, Math.max(0, MESE - 1 - rnd(0, 3)), rnd(1, 27), 15).toISOString(), tecnicoId: t.id, tecnico: breve(t), fileId: null });
    }

    // lavagna: controlli del mese, lavori extra e impegni
    const ev = [], COLORE = (m) => ((m - 1) % 3) + 1;
    [MESE, MESE === 12 ? 1 : MESE + 1].forEach((m, mi) => {
      const y = mi && MESE === 12 ? ANNO + 1 : ANNO;
      sedi.filter(({ s }) => s.pianoControlli.mese1 === COLORE(m)).forEach(({ s }) => {
        if (prob(.15)) return;   // qualcuno ancora da posizionare
        ev.push({ id: uid(), type: 'check', clientId: s.id, date: feriale(y, m, 2, 27), time: '', text: prob(.15) ? '+ FUNE SCORTA' : '', days: 1, weekend: false,
          staffIds: squadra().map((u) => u.id), vehicleIds: [pick(furgoni).id], vehicleId: '', updatedAt: Date.now() });
      });
      ['SOPRALLUOGO NUOVA GRU', 'SOSTITUZIONE FUNE', 'MONTAGGIO PARANCO', 'COLLAUDO GRU A BANDIERA'].forEach((t) => {
        if (prob(.3)) return;
        ev.push({ id: uid(), type: 'extra', date: feriale(y, m, 2, 26), time: pick(['08:00', '09:00', '14:00']), text: `${t} – ${pick(D.clienti).nomeBreve}`, days: prob(.25) ? 2 : 1, weekend: false,
          staffIds: squadra().map((u) => u.id), vehicleIds: [pick(furgoni).id], vehicleId: '', updatedAt: Date.now() });
      });
      ev.push({ id: uid(), type: 'pers', date: feriale(y, m, 5, 20), time: '', text: pick(['FERIE', 'CORSO SICUREZZA', 'VISITA MEDICA']), days: rnd(1, 3), weekend: false, staffIds: [pick(tecnici).id], vehicleIds: [], vehicleId: '', updatedAt: Date.now() });
    });

    return { D, utenti, eventi: ev };
  }

  // ---------- scrittura nello spazio separato ----------
  function pulisci() {
    try { Object.keys(localStorage).filter((k) => k.startsWith(P) || k.startsWith(PL)).forEach((k) => localStorage.removeItem(k)); } catch (e) {}
  }
  function avvia(S) {
    const { D, utenti, eventi } = genera(S.utenti);
    pulisci();
    const ora = new Date().toISOString();
    try {
      Object.entries({ ...D, utenti }).forEach(([k, v]) => localStorage.setItem(P + k, JSON.stringify(v.map((d) => ({ ...d, aggiornato: d.aggiornato || ora })))));
      localStorage.setItem(PL + 'events', JSON.stringify(eventi));
      localStorage.setItem(PL + 'gest_ok', '1');
      localStorage.setItem(CHIAVE, '1');
    } catch (e) { pulisci(); UI.toast('Memoria del dispositivo piena: non riesco a preparare la dimostrazione', 'err'); return; }
    location.hash = '#/'; location.reload();
  }
  function esci() {
    try { localStorage.removeItem(CHIAVE); } catch (e) {}
    pulisci(); location.hash = '#/'; location.reload();
  }

  // ---------- finestra del pulsante DEMO ----------
  function apri(S) {
    const ov = document.createElement('div'); ov.className = 'modal-ov';
    ov.innerHTML = attiva() ? `
      <div class="modal demo-modal"><div class="modal-head"><h2>🎬 Dimostrazione in corso</h2><button type="button" class="modal-x" data-x>×</button></div>
        <div class="modal-body uno"><p>Stai guardando l'app con <b>dati inventati</b>. Puoi provare tutto liberamente: niente di quello che fai qui finisce nei vostri dati o nel cloud.</p></div>
        <div class="modal-foot"><button type="button" class="btn ghost" data-rigenera>🔄 Nuovi dati di esempio</button><span class="grow"></span><button type="button" class="btn big" data-esci>Torna ai nostri dati</button></div></div>` : `
      <div class="modal demo-modal"><div class="modal-head"><h2>🎬 Modalità dimostrazione</h2><button type="button" class="modal-x" data-x>×</button></div>
        <div class="modal-body uno">
          <p>Riempie l'app di <b>dati inventati</b> per far vedere tutte le funzioni: clienti con più sedi, impianti, controlli con anomalie, sottoganci, mezzi con scadenze, rapportini, collaudi e lavagna.</p>
          <p>I <b>vostri dati non vengono toccati</b>: la dimostrazione vive in uno spazio separato su questo dispositivo. Quando vuoi, tocca di nuovo «DEMO» e scegli «Torna ai nostri dati».</p>
        </div>
        <div class="modal-foot"><button type="button" class="btn ghost" data-x>Annulla</button><span class="grow"></span><button type="button" class="btn big" data-avvia>Avvia la dimostrazione</button></div></div>`;
    document.body.appendChild(ov); document.body.classList.add('modal-aperto');
    const chiudi = () => { ov.remove(); document.body.classList.remove('modal-aperto'); };
    ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-x]')) chiudi(); });
    ov.querySelector('[data-avvia]')?.addEventListener('click', () => avvia(S));
    ov.querySelector('[data-esci]')?.addEventListener('click', esci);
    ov.querySelector('[data-rigenera]')?.addEventListener('click', () => avvia(S));
  }

  return { attiva, apri, esci };
})();
