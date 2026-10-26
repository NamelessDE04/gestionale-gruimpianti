import { firebaseConfig } from './config.js?v=27';

/* ============================================================
   COSTANTI
   ============================================================ */
const APP_VERSION = '33';   // versione mostrata in fondo alla lavagna
const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const GG = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
const GG_LUNGHI = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];
const COLORI = {
  yellow: { nome: 'Giallo', mese: '1° mese del trimestre', mesi: 'Gen · Apr · Lug · Ott' },
  green:  { nome: 'Verde',  mese: '2° mese del trimestre', mesi: 'Feb · Mag · Ago · Nov' },
  red:    { nome: 'Rosso',  mese: '3° mese del trimestre', mesi: 'Mar · Giu · Set · Dic' },
  none:   { nome: 'Senza colore', mese: 'mese dei controlli non impostato', mesi: '' }
};

/* ============================================================
   ANAGRAFICHE DAL GESTIONALE
   Clienti (= sedi), persone e mezzi NON si inseriscono più qui:
   arrivano dalle anagrafiche del gestionale.
   - nome sulla lavagna = nome breve della sede (es. GCV)
   - colore = mese dei controlli nel trimestre (1° giallo, 2° verde, 3° rosso)
   - persone = utenti del gestionale (tranne Risorse Umane)
   - mezzi = anagrafica mezzi del gestionale (quelli in uso)
   Con il cloud queste letture passeranno alle collezioni Firestore del gestionale.
   ============================================================ */
const GEST = '../index.html#/';
const MESE_COLORE = { 1: 'yellow', 2: 'green', 3: 'red' };
// con il cloud le anagrafiche arrivano in tempo reale dalle raccolte del gestionale; senza, dalla copia sul dispositivo
const gestCloud = {};
// modalità dimostrazione del gestionale: dati inventati in uno spazio separato
const leggiG = k => { if (gestCloud[k]) return gestCloud[k]; try { return JSON.parse(localStorage.getItem('gid_demo_' + k)) || []; } catch { return []; } };
function anagraficaGestionale() {
  const clients = leggiG('clienti').flatMap(c => (c.sedi || []).map(s => ({
    id: s.id,
    name: (s.sigla || `${c.ragioneSociale || ''} ${s.nome || ''}`).trim().toUpperCase(),
    full: [c.ragioneSociale, s.nome].filter(Boolean).join(' · ').toUpperCase(),   // nome completo, per i menu a tendina
    color: MESE_COLORE[s.pianoControlli?.mese1] || 'none',
    contacts: (c.referenti || []).filter(r => r.telefono).map(r => ({ id: r.id, name: [r.nome, r.cognome].filter(Boolean).join(' '), phone: r.telefono }))
  })));
  const ruolo = u => (u.ruolo === 'admin' ? 'master' : u.ruolo);
  const staff = leggiG('utenti').filter(u => u.attivo !== false && ruolo(u) !== 'ru').map(u => ({ id: u.id, name: u.nome }));
  // mezzi: marca e modello, senza targa; le piattaforme aeree non compaiono sulla lavagna
  const vehicles = leggiG('mezzi').filter(m => !m.dismesso && m.categoria !== 'piattaforma').map(m => ({ id: m.id, name: [m.marca, m.modello].filter(Boolean).join(' ') || 'Mezzo' }));
  return { clients, staff, vehicles };
}
const ORDINE = ['yellow', 'green', 'red'];
const TIPI = { check: 'Controllo periodico', extra: 'Lavoro extra', pers: 'Impegno / assenza' };

/* ============================================================
   UTILITY
   ============================================================ */
const $ = (s, r = document) => r.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const isoDate = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parseIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const toIso = dt => isoDate(dt.getFullYear(), dt.getMonth(), dt.getDate());
const addDays = (s, n) => { const dt = parseIso(s); dt.setDate(dt.getDate() + n); return toIso(dt); };
const todayIso = () => toIso(new Date());
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtShort = d => `${+d.slice(8)} ${MESI[+d.slice(5, 7) - 1].slice(0, 3).toLowerCase()}`;
const dateLabel = s => { const dt = parseIso(s); return `${GG_LUNGHI[dt.getDay()]} ${dt.getDate()} ${MESI[dt.getMonth()]} ${dt.getFullYear()}`; };
const coloreDelMese = m => ORDINE[m % 3];
const telHref = p => 'tel:' + String(p || '').replace(/[^\d+]/g, '');
const byName = a => [...a].sort((x, y) => (x.name || '').localeCompare(y.name || '', 'it'));
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

/* ============================================================
   STATO
   ============================================================ */
const now = new Date();
const state = {
  year: now.getFullYear(),
  month: now.getMonth(),
  view: 'month',                                   // all'avvio si parte sempre dal mese
  dayMode: lsGet('lavagna_daymode') === 'list' ? 'list' : 'box',   // giorno: 'box' = casella ingrandita, 'list' = elenco
  menuOpen: false, drawerOpen: false, addOpen: false, info: null,
  editContact: null, zoomFrom: null, user: null, unsigned: [],
  selDate: todayIso(),
  clients: [], staff: [], vehicles: [], events: [],
  placing: null,
  modal: null,          // 'edit' | 'anag' | 'client'
  edit: null,           // bozza della voce in modifica
  anagTab: 'clients',
  clientOpen: null,
  newColor: 'yellow'
};
let db = null;
let unsubEvents = null;
let unsubLists = [];
let dataStarted = false;
let currentEmail = '';

const clientById = id => state.clients.find(c => c.id === id);
const staffById = id => state.staff.find(s => s.id === id);
const vehicleById = id => state.vehicles.find(v => v.id === id);
const eventById = id => state.events.find(e => e.id === id);
const staffOf = e => (e.staffIds || []).map(staffById).filter(Boolean);
const staffNames = e => staffOf(e).map(s => s.name).join(', ');
// più mezzi per intervento (compatibile con le voci salvate quando era previsto un solo mezzo)
const vehIdsOf = e => e.type === 'pers' ? [] : (Array.isArray(e.vehicleIds) ? e.vehicleIds : (e.vehicleId ? [e.vehicleId] : []));
const vehiclesOf = e => vehIdsOf(e).map(vehicleById).filter(Boolean);
const vehicleName = e => vehiclesOf(e).map(v => v.name).join(', ');
const RANK = { check: 0, extra: 1, pers: 2 };
function sortEv(a, b) {
  if (RANK[a.type] !== RANK[b.type]) return RANK[a.type] - RANK[b.type];
  const t = (a.time || '99').localeCompare(b.time || '99');
  if (t) return t;
  if (a.type === 'check') return (clientById(a.clientId)?.name || '').localeCompare(clientById(b.clientId)?.name || '', 'it');
  return 0;
}
const visible = e => e.type !== 'check' || clientById(e.clientId);
const eventsOn = d => state.events.filter(e => e.date === d && visible(e)).sort(sortEv);
const inMonth = e => e.date.slice(0, 7) === `${state.year}-${pad(state.month + 1)}`;

/* --- Voci che durano più giorni --- */
const MAX_DAYS = 31;
const isWeekend = d => { const w = parseIso(d).getDay(); return w === 0 || w === 6; };
function spanDates(e) {
  const n = Math.max(1, Math.min(MAX_DAYS, Math.round(+e.days || 1)));
  const out = [e.date];
  let d = e.date;
  while (out.length < n) {
    d = addDays(d, 1);
    if (!e.weekend && isWeekend(d)) continue;
    out.push(d);
  }
  return out;
}
// Prosecuzioni (giorno 2, 3, …) di voci iniziate nei giorni precedenti
function contOn(d) {
  return state.events
    .filter(e => visible(e) && (+e.days || 1) > 1 && e.date < d)
    .map(e => { const s = spanDates(e); const i = s.indexOf(d); return i > 0 ? { e, i, n: s.length } : null; })
    .filter(Boolean)
    .sort((a, b) => sortEv(a.e, b.e));
}
// un controllo è "fatto" quando i suoi giorni sono passati (nessuna spunta da mettere)
// asterisco cerchiato rosso = rapportino d'intervento non ancora firmato
const astHtml = e => e.unsigned && e.type !== 'pers' ? '<span class="ast" title="Rapportino da firmare">✱</span>' : '';
const noteTxt = t => String(t || '').replace(/^\s*\+\s*/, '');
const isPast = e => spanDates(e).slice(-1)[0] < todayIso();
const lineCls = e => e.type === 'check' ? (clientById(e.clientId)?.color || '') : e.type === 'extra' ? 'pen' : 'ink';
// lavoro extra con un cliente: sulla lavagna la sigla del cliente in rosso davanti al testo (niente magnetino)
const extraCli = e => (e.type === 'extra' && e.extraClientId ? clientById(e.extraClientId) : null);
const notaTxt = e => { const c = extraCli(e); return (c ? c.name + ' · ' : '') + (e.text || ''); };
const notaHtml = e => { const c = extraCli(e); return (c ? `<b class="x-cli">${esc(c.name)}</b> ` : '') + esc(e.text || ''); };
const evLabel = e => e.type === 'check' ? (clientById(e.clientId)?.name || '') : notaTxt(e);
function contHtml({ e, i, n }, cls = 'cont') {
  const last = i === n - 1;
  return `<div class="${cls} ${lineCls(e)} ${last ? 'last' : ''}" data-ev="${e.id}" title="${esc(evLabel(e))} · giorno ${i + 1} di ${n}">
    <span class="ln"></span>${last ? '<span class="hd"></span>' : ''}
  </div>`;
}

/* ============================================================
   BACKEND LOCALE (nessuna sincronizzazione)
   ============================================================ */
function lavagnaTest(B) {
  const K = 'gid_test_lav';
  let ov = {}; try { ov = JSON.parse(localStorage.getItem(K) || '{}'); } catch {}
  const salva = () => { try { localStorage.setItem(K, JSON.stringify(ov)); } catch {} };
  const regs = [];
  const unisci = (col, l) => { const o = ov[col]; if (!o) return l; const m = new Map((l || []).map(d => [d.id, d])); Object.entries(o).forEach(([id, d]) => { if (d === null) m.delete(id); else m.set(id, d); }); return [...m.values()]; };
  const emit = () => regs.forEach(r => r.last && r.cb(unisci(r.col, r.last).filter(r.filtro)));
  const reg = (col, filtro, cb, sub) => { const r = { col, filtro, cb, last: null }; regs.push(r); const un = sub(l => { r.last = l; cb(unisci(col, l).filter(filtro)); }); return () => { regs.splice(regs.indexOf(r), 1); if (typeof un === 'function') un(); }; };
  const W = Object.create(B);
  return Object.assign(W, {
    test: true,
    subscribe(col, cb) { return reg(col, () => true, cb, f => B.subscribe(col, f)); },
    subscribeEvents(s, e, cb) { return reg('events', x => x.date >= s && x.date <= e, cb, f => B.subscribeEvents(s, e, f)); },
    subscribeUnsigned(cb) { return reg('events', x => x.unsigned, cb, f => B.subscribeUnsigned(f)); },
    async save(col, obj) { (ov[col] = ov[col] || {})[obj.id] = JSON.parse(JSON.stringify(obj)); salva(); emit(); },
    async remove(col, id) { (ov[col] = ov[col] || {})[id] = null; salva(); emit(); },
    async addLog() {}
  });
}

function localBackend() {
  const key = c => 'lavagna_' + c;
  const read = c => { try { return JSON.parse(localStorage.getItem(key(c))) || []; } catch { return []; } };
  const write = (c, v) => { try { localStorage.setItem(key(c), JSON.stringify(v)); } catch {} };
  const subs = new Map();
  let eCb = null, range = null, uCb = null;
  const emit = () => {
    subs.forEach((cb, c) => cb(read(c)));
    if (eCb && range) eCb(read('events').filter(e => e.date >= range[0] && e.date <= range[1]));
    if (uCb) uCb(read('events').filter(e => e.unsigned));
  };
  window.addEventListener('storage', emit);
  return {
    mode: 'local',
    onStatus(cb) { cb('local'); },
    subscribe(col, cb) { subs.set(col, cb); cb(read(col)); return () => subs.delete(col); },
    subscribeEvents(s, e, cb) { range = [s, e]; eCb = cb; emit(); return () => { eCb = null; }; },
    subscribeUnsigned(cb) { uCb = cb; emit(); return () => { uCb = null; }; },
    async save(col, obj) { write(col, [...read(col).filter(x => x.id !== obj.id), obj]); emit(); },
    async remove(col, id) {
      write(col, read(col).filter(x => x.id !== id));
      if (col === 'clients') write('events', read('events').filter(e => e.clientId !== id));
      emit();
    },
    async addLog(entry) { write('log', [entry, ...read('log')].slice(0, 2000)); },
    subscribeLog(cb) {
      const f = () => cb(read('log'));
      f();
      const t = setInterval(f, 1500);
      return () => clearInterval(t);
    }
  };
}

/* ============================================================
   BACKEND FIREBASE (tempo reale + login Google)
   ============================================================ */
async function firebaseBackend(cfg) {
  const V = '10.12.2';
  const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
  const f = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`);
  const a = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`);
  const app = initializeApp(cfg);
  const auth = a.getAuth(app);
  auth.languageCode = 'it';
  a.getRedirectResult(auth).catch(err => {
    if (err.code !== 'auth/no-auth-event') { console.error(err); toast('Accesso non riuscito: ' + (err.code || err.message)); }
  });
  let fdb;
  try {
    fdb = f.initializeFirestore(app, { localCache: f.persistentLocalCache({ tabManager: f.persistentMultipleTabManager() }) });
  } catch {
    fdb = f.getFirestore(app);
  }
  let statusCb = () => {};
  let deniedCb = () => {};
  const report = snap => statusCb(snap.metadata.fromCache || !navigator.onLine ? 'offline' : 'online');
  let quotaDetta = false;
  const onErr = err => {
    console.error(err);
    statusCb('error');
    if (err.code === 'permission-denied') { deniedCb(); return; }
    if (err.code === 'resource-exhausted') { if (!quotaDetta) { quotaDetta = true; toast('Limite giornaliero gratuito di Firebase finito: le modifiche restano su questo dispositivo e partono dopo le 9:00'); } return; }
    toast('Errore di sincronizzazione: ' + (err.code || err.message));
  };
  // se il cloud interrompe l'ascolto (limite finito, rete) lo riapro da solo dopo un po'
  // (conta anche le letture come Firebase: dopo più di 30 minuti di pausa, alla ripartenza paga tutti i documenti)
  const ascolta = (ref, opz, avanti, errore, nome = '') => {
    let stop = null, attesa = 30000, finito = false, t = null;
    const K = 'lav_ultsrv_' + nome;
    const segna = s => { if (s.metadata.fromCache || !nome) return; let u = 0; try { u = +localStorage.getItem(K) || 0; } catch {} if (primo && Date.now() - u > 1800000) s.__tutti = true; primo = false; try { localStorage.setItem(K, String(Date.now())); } catch {} };
    let primo = true;
    const apri = () => { primo = true; stop = opz ? f.onSnapshot(ref, opz, s => { attesa = 30000; quotaDetta = false; segna(s); avanti(s); }, e => fallito(e)) : f.onSnapshot(ref, s => { attesa = 30000; segna(s); avanti(s); }, e => fallito(e)); };
    const fallito = e => { errore(e); if (finito || e.code === 'permission-denied') return; clearTimeout(t); t = setTimeout(apri, attesa); attesa = Math.min(attesa * 2, 600000); };
    apri();
    return () => { finito = true; clearTimeout(t); stop && stop(); };
  };
  // contatore dei consumi (come nel gestionale): finisce nello stesso documento "consumi" del giorno di Firebase
  const giornoFb = () => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date()); } catch { return new Date().toISOString().slice(0, 10); } };
  const sosp = { r: 0, w: 0, d: 0 };
  const conta = (k, n = 1) => { sosp[k] += n; };
  const contaSnap = snap => { if (!snap.metadata.fromCache && !snap.metadata.hasPendingWrites) conta('r', Math.max(1, snap.__tutti ? snap.size : snap.docChanges().length)); };
  async function versa() {
    const u = auth.currentUser; if (!u || !navigator.onLine) return;
    const { r, w, d } = sosp; if (!r && !w && !d) return;
    sosp.r = sosp.w = sosp.d = 0;
    const inc = f.increment, k = (u.email || 'sconosciuto').toLowerCase().replace(/[^a-z0-9]+/g, '_') + '_lavagna';
    try { await f.setDoc(f.doc(fdb, 'consumi', giornoFb()), { letture: inc(r), scritture: inc(w + 1), cancellazioni: inc(d), dispositivi: { [k]: { letture: inc(r), scritture: inc(w + 1), cancellazioni: inc(d), ultimo: new Date().toISOString() } } }, { merge: true }); }
    catch { sosp.r += r; sosp.w += w; sosp.d += d; }
  }
  setInterval(versa, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') versa(); });
  const toList = snap => { contaSnap(snap); return snap.docs.map(d => ({ id: d.id, ...d.data() })); };
  const strip = o => { const { id, ...rest } = o; return rest; };
  // nel database del gestionale le raccolte della lavagna hanno un nome loro, per non mescolarsi
  const C = col => ({ events: 'lavagnaEventi', log: 'lavagnaLog' }[col] || col);

  return {
    mode: 'cloud',
    onStatus(cb) { statusCb = cb; },
    onDenied(cb) { deniedCb = cb; },
    onAuth(cb) { return a.onAuthStateChanged(auth, cb); },
    async login() {
      const p = new a.GoogleAuthProvider();
      p.setCustomParameters({ prompt: 'select_account' });
      try {
        await a.signInWithPopup(auth, p);
      } catch (err) {
        if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') {
          await a.signInWithRedirect(auth, p);
        } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
          throw err;
        }
      }
    },
    logout() { return a.signOut(auth); },
    // anagrafiche del gestionale (clienti/sedi, utenti, mezzi)
    subscribeGest(cb) {
      return ['clienti', 'utenti', 'mezzi'].map(k => ascolta(f.collection(fdb, k), null, snap => cb(k, toList(snap)), onErr, 'g_' + k));
    },
    subscribe(col, cb) {
      return ascolta(f.collection(fdb, C(col)), { includeMetadataChanges: true },
        snap => { report(snap); cb(toList(snap)); }, onErr, col);
    },
    subscribeEvents(s, e, cb) {
      const q = f.query(f.collection(fdb, C('events')), f.where('date', '>=', s), f.where('date', '<=', e));
      return ascolta(q, { includeMetadataChanges: true },
        snap => { report(snap); cb(toList(snap)); }, onErr, 'mese_' + s);
    },
    subscribeUnsigned(cb) {
      const q = f.query(f.collection(fdb, C('events')), f.where('unsigned', '==', true));
      return ascolta(q, null, snap => cb(toList(snap)), err => console.error(err), 'nonfirmati');
    },
    save(col, obj) { conta('w'); return f.setDoc(f.doc(fdb, C(col), obj.id), strip(obj)); },
    async remove(col, id) {
      if (col === 'clients') {
        const snap = await f.getDocs(f.query(f.collection(fdb, C('events')), f.where('clientId', '==', id))); conta('r', Math.max(1, snap.size)); conta('d', snap.size + 1);
        const b = f.writeBatch(fdb);
        snap.forEach(d => b.delete(d.ref));
        b.delete(f.doc(fdb, 'clients', id));
        return b.commit();
      }
      conta('d'); return f.deleteDoc(f.doc(fdb, C(col), id));
    },
    addLog(entry) { conta('w'); return f.setDoc(f.doc(fdb, C('log'), entry.id), strip(entry)); },
    subscribeLog(cb) {
      const q = f.query(f.collection(fdb, C('log')), f.orderBy('ts', 'desc'), f.limit(500));
      return f.onSnapshot(q, snap => cb(toList(snap)), err => { console.error(err); cb(null, err); });
    }
  };
}

/* ============================================================
   STORICO MODIFICHE (visibile solo all'amministratore)
   ============================================================ */
const ADMIN_EMAILS = ['vaisittiluca@gmail.com', 'cau.gruimpianti@gmail.com'];
// PDF del mese: come nel gestionale, solo Master e Risorse Umane (l'utente è quello entrato col PIN)
const puoStampare = () => {
  let id = ''; try { id = sessionStorage.getItem('gid_sessione') || ''; } catch { }
  const u = leggiG('utenti').find(x => x.id === id.split('|')[0]);
  if (u && id.endsWith('|dev') && u.accessoDev) return true;   // in modalità Developer (tasto ⇄)
  return !!u && ['admin', 'developer', 'master', 'ru'].includes(u.ruolo);
};
const isAdmin = () => db?.mode === 'local' || ADMIN_EMAILS.includes((currentEmail || '').toLowerCase());
const COL_NOMI = { events: 'Voce', clients: 'Cliente', staff: 'Dipendente', vehicles: 'Mezzo' };
const clean = o => o ? JSON.parse(JSON.stringify(o)) : null;

function findCurrent(col, id) {
  if (col === 'events') return state.events.find(e => e.id === id) || state.unsigned.find(e => e.id === id) || null;
  return (state[col] || []).find(x => x.id === id) || null;
}
// descrizione leggibile di una voce
function describe(col, o, clientsHint) {
  if (!o) return '';
  if (col === 'events') {
    const c = o.clientId ? (clientById(o.clientId) || (clientsHint || []).find(x => x.id === o.clientId)) : null;
    const what = o.type === 'check' ? `Controllo ${c ? c.name : '(cliente eliminato)'}` : `${TIPI[o.type] || 'Voce'} “${o.text || ''}”`;
    return `${what} del ${fmtShort(o.date)}`;
  }
  return `${COL_NOMI[col] || ''} ${o.name || ''}`.trim();
}
const nomi = (ids, fn) => (ids || []).map(fn).filter(Boolean).map(x => x.name).join(', ') || 'nessuno';
// elenco dei cambiamenti tra prima e dopo
function diffText(col, a, b) {
  const out = [];
  if (!a || !b) return out;
  if (col === 'events') {
    if (a.date !== b.date) out.push(`spostato dal ${fmtShort(a.date)} al ${fmtShort(b.date)}`);
    if ((a.time || '') !== (b.time || '')) out.push(`ora: ${a.time || '—'} → ${b.time || '—'}`);
    if ((a.text || '') !== (b.text || '')) out.push(`${a.type === 'check' ? 'nota' : 'testo'}: “${a.text || ''}” → “${b.text || ''}”`);
    if ((+a.days || 1) !== (+b.days || 1)) out.push(`durata: ${+a.days || 1} → ${+b.days || 1} giorni`);
    if (!!a.weekend !== !!b.weekend) out.push(b.weekend ? 'conta anche il weekend' : 'non conta più il weekend');
    if ((a.staffIds || []).join() !== (b.staffIds || []).join()) out.push(`persone: ${nomi(a.staffIds, staffById)} → ${nomi(b.staffIds, staffById)}`);
    if (vehIdsOf(a).join() !== vehIdsOf(b).join()) out.push(`mezzi: ${nomi(vehIdsOf(a), vehicleById)} → ${nomi(vehIdsOf(b), vehicleById)}`);
    if (!!a.unsigned !== !!b.unsigned) out.push(b.unsigned ? 'segnato ✱ rapportino da firmare' : 'rapportino firmato (✱ tolto)');
    if (a.clientId !== b.clientId) out.push('cambiato cliente');
  } else {
    if (a.name !== b.name) out.push(`nome: “${a.name}” → “${b.name}”`);
    if (a.color !== b.color) out.push(`colore: ${COLORI[a.color]?.nome || a.color} → ${COLORI[b.color]?.nome || b.color}`);
    const ka = (a.contacts || []).map(k => `${k.name} ${k.phone}`).join(' | '), kb = (b.contacts || []).map(k => `${k.name} ${k.phone}`).join(' | ');
    if (ka !== kb) out.push(`referenti: ${ka || 'nessuno'} → ${kb || 'nessuno'}`);
  }
  return out;
}
function writeLog(action, col, before, after, extra = {}) {
  const u = state.user;
  const entry = clean({
    id: uid(), ts: Date.now(), action, col,
    docId: (after || before)?.id || '',
    by: currentEmail || (db?.mode === 'local' ? 'questo dispositivo' : ''), byName: u?.name || '',
    label: describe(col, after || before),
    changes: action === 'update' ? diffText(col, before, after) : [],
    before, after, ...extra
  });
  if (action === 'update' && !entry.changes.length) return;   // nessun cambiamento reale
  Promise.resolve(db.addLog(entry)).catch(err => console.warn('Storico non salvato', err));
}
// ogni salvataggio e cancellazione passa da qui e viene registrato
function attachLog(d) {
  const save = d.save.bind(d), remove = d.remove.bind(d);
  d.save = async (col, obj, opts = {}) => {
    const before = clean(findCurrent(col, obj.id));
    await save(col, obj);
    writeLog(opts.restore ? 'restore' : (before ? 'update' : 'create'), col, before, clean(obj));
  };
  d.remove = async (col, id) => {
    const before = clean(findCurrent(col, id));
    const extra = col === 'clients' ? { clientEvents: clean(state.events.filter(e => e.clientId === id)) } : {};
    await remove(col, id);
    writeLog('delete', col, before || { id }, null, extra);
  };
  return d;
}

/* ============================================================
   OPERAZIONI SUI DATI
   ============================================================ */
function run(p) {
  Promise.resolve(p).catch(err => { console.error(err); toast('Errore nel salvataggio: ' + (err.message || err)); });
}
function addCheck(clientId, date) {
  run(db.save('events', { id: uid(), type: 'check', clientId, date, time: '', text: '', staffIds: [], vehicleIds: [], updatedAt: Date.now() }));
}
function updateEvent(ev, patch) {
  run(db.save('events', { ...ev, ...patch, updatedAt: Date.now() }));
}

function subscribeMonth() {
  if (unsubEvents) { unsubEvents(); unsubEvents = null; }
  state.events = [];
  if (!dataStarted) return;
  // si parte un mese prima per vedere anche i lavori iniziati il mese precedente che proseguono
  const s = addDays(isoDate(state.year, state.month, 1), -MAX_DAYS - 10);
  const e = isoDate(state.year, state.month, 31);
  unsubEvents = db.subscribeEvents(s, e, list => { state.events = list; render(); });
}
function syncMonthToSel() {
  const dt = parseIso(state.selDate);
  if (dt.getFullYear() !== state.year || dt.getMonth() !== state.month) {
    state.year = dt.getFullYear();
    state.month = dt.getMonth();
    subscribeMonth();
  }
}
function shiftMonth(d) {
  let m = state.month + d, y = state.year;
  if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
  state.month = m; state.year = y;
  subscribeMonth(); render();
}
function setView(v) {
  state.view = v;
  state.addOpen = false;
  if (v === 'day') {
    const dt = parseIso(state.selDate);
    if (dt.getFullYear() !== state.year || dt.getMonth() !== state.month) {
      const t = new Date();
      state.selDate = (t.getFullYear() === state.year && t.getMonth() === state.month) ? todayIso() : isoDate(state.year, state.month, 1);
    }
  }
  render();
}
function goDay(d, fromEl) {
  state.selDate = d;
  // punto da cui parte l'effetto "zoom" (la casella toccata)
  if (fromEl) {
    const r = fromEl.getBoundingClientRect(), b = $('.board').getBoundingClientRect();
    state.zoomFrom = `${Math.round(((r.left + r.width / 2) - b.left) / b.width * 100)}% ${Math.round(((r.top + r.height / 2) - b.top) / b.height * 100)}%`;
  } else state.zoomFrom = 'center 20%';
  syncMonthToSel();
  setView('day');
  window.scrollTo({ top: 0 });
}
function setDayMode(m) {
  state.dayMode = m;
  lsSet('lavagna_daymode', m);
  render();
}

/* ============================================================
   RENDER
   ============================================================ */
function render() {
  renderHeader();
  renderPanel();
  renderMenu();
  const isMonth = state.view === 'month';
  $('#grid').hidden = !isMonth;
  $('#dayView').hidden = isMonth;
  if (isMonth) renderGrid(); else renderDay();
  renderPlacingBar();
  if (state.modal === 'anag') renderAnagList();
  if (state.modal === 'client') renderClientSheet();
  syncHistory();
}

/* ============================================================
   TASTO INDIETRO DEL TELEFONO
   Un passo alla volta: chiude la scheda aperta → annulla il
   posizionamento → dalla vista giorno torna al mese → esce.
   ============================================================ */
let ignorePop = false;
const isDeep = () => !!(state.info || state.menuOpen || state.addOpen || state.modal || state.drawerOpen || state.placing || state.view === 'day');
function syncHistory() {
  const has = !!(history.state && history.state.lavagna);
  if (isDeep() && !has) history.pushState({ lavagna: 1 }, '');
  else if (!isDeep() && has && !ignorePop) { ignorePop = true; history.back(); }
}
window.addEventListener('popstate', () => {
  if (ignorePop) { ignorePop = false; syncHistory(); return; }
  stepBack();
});
function stepBack() {
  if (state.info) closeInfo();
  else if (state.menuOpen || state.addOpen) { state.menuOpen = false; state.addOpen = false; }
  else if (state.modal) closeModal();
  else if (state.drawerOpen) state.drawerOpen = false;
  else if (state.placing) state.placing = null;
  else if (state.view === 'day') state.view = 'month';
  render();
}
function renderHeader() {
  if (state.view === 'month') {
    $('#monthLabel').textContent = `${MESI[state.month]} ${state.year}`;
  } else {
    const dt = parseIso(state.selDate);
    $('#monthLabel').textContent = `${GG[(dt.getDay() + 6) % 7]} ${dt.getDate()} ${MESI[dt.getMonth()].slice(0, 3)} ${dt.getFullYear()}`;
  }
  const col = coloreDelMese(state.month);
  const magBtn = `<button class="btn mag-btn" data-action="drawer">Magneti${state.dueCount ? ` <span class="badge">${state.dueCount}</span>` : ''}</button>`;
  const info = t => `<button class="info-btn" data-action="info" data-topic="${t}" aria-label="Informazioni">i</button>`;
  if (state.view === 'month') {
    $('#boardBar').innerHTML = `
      <div class="bar-l"><span class="muted">Controlli del mese:</span> <span class="tag ${col}">${COLORI[col].nome}</span></div>
      <div class="bar-r">${magBtn}${info('month')}</div>`;
  } else {
    const add = `<div class="pop-wrap"><button class="btn primary" data-action="add">+ Aggiungi</button>
      ${state.addOpen ? `<div class="pop">
        <button data-action="new" data-type="check"><i class="sw ${col}"></i>Controllo periodico</button>
        <button data-action="new" data-type="extra"><i class="pen-dot"></i>Lavoro extra</button>
        <button data-action="new" data-type="pers"><i class="ink-dot"></i>Impegno / assenza</button>
      </div>` : ''}</div>`;
    $('#boardBar').innerHTML = `
      <div class="bar-l"><button class="btn ghost" data-action="to-month">‹ Mese</button></div>
      <div class="seg" role="tablist">
        <button class="seg-btn ${state.dayMode === 'box' ? 'on' : ''}" data-action="daymode" data-mode="box">Casella</button>
        <button class="seg-btn ${state.dayMode === 'list' ? 'on' : ''}" data-action="daymode" data-mode="list">Elenco</button>
      </div>
      <div class="bar-r">${add}${magBtn}${info('day')}</div>`;
  }
  $('#prevBtn').setAttribute('aria-label', state.view === 'month' ? 'Mese precedente' : 'Giorno precedente');
  $('#nextBtn').setAttribute('aria-label', state.view === 'month' ? 'Mese successivo' : 'Giorno successivo');
}

function magPanel(c) {
  return `<button class="mag ${c.color} ${state.placing === c.id ? 'selected' : ''}" draggable="true" data-client="${c.id}" title="${esc(c.name)}">${esc(c.name)}</button>`;
}

function renderPanel() {
  const col = coloreDelMese(state.month);
  const panel = $('#panel');
  panel.classList.toggle('open', state.drawerOpen);
  $('#drawerBack').hidden = !state.drawerOpen;
  const head = `<div class="panel-head"><h2>Magneti del mese</h2>
      <span class="tag ${col}">${COLORI[col].nome}</span><span class="spacer"></span>
      <button class="info-btn" data-action="info" data-topic="magnets" aria-label="Informazioni">i</button>
      <button class="icon-btn sm" data-action="drawer-close" aria-label="Chiudi">✕</button></div>`;
  if (!state.clients.length) {
    state.dueCount = 0;
    panel.innerHTML = `${head}
      <p class="empty mt">Non ci sono ancora clienti.</p>
      <button class="btn primary full mt" data-action="gest" data-href="${GEST}clienti">Aggiungili nel gestionale</button>`;
    return;
  }
  const due = byName(state.clients.filter(c => c.color === col));
  const others = byName(state.clients.filter(c => c.color !== col));
  const checks = state.events.filter(e => e.type === 'check' && inMonth(e));
  const da = [], pian = [], fatti = [];
  due.forEach(c => {
    const ev = checks.filter(e => e.clientId === c.id).sort((a, b) => a.date.localeCompare(b.date));
    if (!ev.length) da.push(c);
    else if (ev.every(isPast)) fatti.push([c, ev]);
    else pian.push([c, ev]);
  });
  state.dueCount = da.length;
  const li = ([c, ev]) => `<li data-open-day="${ev[0].date}"><span class="mag sm ${c.color}">${esc(c.name)}</span><span>${ev.map(e => fmtShort(e.date)).join(', ')}</span></li>`;

  panel.innerHTML = `${head}
    <div class="stats"><b>${da.length}</b> da pianificare · <b>${pian.length}</b> pianificati · <b>${fatti.length}</b> fatti</div>
    <h3>Da pianificare</h3>
    <div class="mags">${da.map(magPanel).join('') || '<p class="empty">Tutti pianificati 👍</p>'}</div>
    ${pian.length ? `<h3>Pianificati</h3><ul class="plist">${pian.map(li).join('')}</ul>` : ''}
    ${fatti.length ? `<h3>Fatti</h3><ul class="plist done">${fatti.map(li).join('')}</ul>` : ''}
    ${others.length ? `<details><summary>Altri clienti (${others.length})</summary><div class="mags">${others.map(magPanel).join('')}</div></details>` : ''}`;
}

function whoHtml(e) {
  const st = staffNames(e), vh = vehicleName(e);
  if (!st && !vh) return '';
  return `<div class="who">${st ? `<span class="st">${esc(st)}</span>` : ''}${vh ? `<span class="vh">${esc(vh)}</span>` : ''}</div>`;
}

function itemHtml(e) {
  let head;
  const multi = (+e.days || 1) > 1;
  let below = '';
  if (e.type === 'check') {
    const c = clientById(e.clientId);
    const mag = `<div class="mag ${c.color}" title="${esc(c.name)}">${e.time ? esc(e.time) + ' ' : ''}${esc(c.name)}</div>${astHtml(e)}`;
    const nota = e.text ? `<span class="mnote">${esc(noteTxt(e.text))}</span>` : '';
    // nota rossa accanto al magnete; se il lavoro dura più giorni va subito sotto, così la freccia resta dritta
    if (multi) { head = `<div class="mag-line">${mag}</div>`; below = nota ? `<div class="mnote-below">${nota}</div>` : ''; }
    else head = `<div class="mag-line">${mag}${nota}</div>`;
  } else {
    const nt = `<div class="note ${e.type}">${e.time ? `<b>${esc(e.time)}</b> ` : ''}${notaHtml(e)}</div>`;
    head = e.unsigned && e.type !== 'pers' ? `<div class="mag-line">${nt}${astHtml(e)}</div>` : nt;
  }
  // se dura più giorni, dal magnete parte la freccia verso il giorno dopo
  if (multi) {
    const sp = spanDates(e);
    head = `<div class="head-row" data-origin="${e.id}">${head}<span class="tail ${lineCls(e)}" title="Dura ${sp.length} giorni"></span><span class="tail-lbl">fino al ${fmtShort(sp[sp.length - 1])}</span></div>${below}`;
  }
  return `<div class="it ${multi ? 'multi' : ''}" draggable="true" data-ev="${e.id}">${head}${whoHtml(e)}</div>`;
}

function renderGrid() {
  const { year: y, month: m } = state;
  const days = new Date(y, m + 1, 0).getDate();
  const off = (new Date(y, m, 1).getDay() + 6) % 7;
  const total = Math.ceil((off + days) / 7) * 7;
  const today = todayIso();
  let h = GG.map((g, i) => `<div class="dow ${i > 4 ? 'we' : ''}">${g}</div>`).join('');
  for (let i = 0; i < total; i++) {
    const d = i - off + 1;
    if (d < 1 || d > days) { h += `<div class="cell blank"></div>`; continue; }
    const date = isoDate(y, m, d);
    h += `<div class="cell ${i % 7 > 4 ? 'we' : ''} ${date === today ? 'today' : ''} ${state.placing ? 'placing' : ''}" data-date="${date}">
      <div class="num">${d}</div>
      <div class="items">${contOn(date).map(x => contHtml(x)).join('')}${eventsOn(date).map(itemHtml).join('')}</div>
    </div>`;
  }
  $('#grid').innerHTML = h;
  requestAnimationFrame(() => alignArrows($('#grid'), '.cell', '.cont'));
}

/* Allinea le frecce: nella stessa settimana la freccia sta sempre alla stessa
   altezza del magnete da cui parte (se serve, sposta in basso le voci). */
function alignArrows(root, cellSel, contSel) {
  if (!root || root.hidden) return;
  const origins = new Map();
  root.querySelectorAll('[data-origin]').forEach(o => origins.set(o.dataset.origin, o));
  const conts = [...root.querySelectorAll(contSel)];
  const pushBox = el => el.closest('.it') || el;
  conts.forEach(c => { c.style.marginTop = ''; c.style.height = ''; });
  origins.forEach(o => { pushBox(o).style.marginTop = ''; });
  conts.forEach(c => { const o = origins.get(c.dataset.ev); if (o) c.style.height = o.offsetHeight + 'px'; });
  const groups = new Map();
  const add = (id, el) => { if (!groups.has(id)) groups.set(id, []); groups.get(id).push(el); };
  origins.forEach((o, id) => add(id, o));
  conts.forEach(c => add(c.dataset.ev, c));
  for (let pass = 0; pass < 10; pass++) {
    let changed = false;
    groups.forEach(list => {
      const rows = new Map();
      list.forEach(el => {
        const cell = el.closest(cellSel);
        if (!cell) return;
        const k = Math.round(cell.getBoundingClientRect().top);
        if (!rows.has(k)) rows.set(k, []);
        rows.get(k).push(el);
      });
      rows.forEach(els => {
        if (els.length < 2) return;
        const tops = els.map(el => el.getBoundingClientRect().top);
        const maxTop = Math.max(...tops);
        els.forEach((el, i) => {
          const d = maxTop - tops[i];
          if (d > 0.5) {
            const b = pushBox(el);
            b.style.marginTop = ((parseFloat(b.style.marginTop) || 0) + d) + 'px';
            changed = true;
          }
        });
      });
    });
    if (!changed) break;
  }
}
let resizeT;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { if (state.view === 'month') alignArrows($('#grid'), '.cell', '.cont'); }, 150);
});

/* ---------------- Vista giornaliera ---------------- */
function contactLinks(c) {
  return (c?.contacts || []).map(k => `<a class="call" href="${telHref(k.phone)}">📞 <span>${esc(k.name)}</span><small>${esc(k.phone)}</small></a>`).join('');
}

function cardHtml(e, cont) {
  const c = e.type === 'check' ? clientById(e.clientId) : null;
  const span = spanDates(e);
  const banner = cont
    ? `<div class="cont-banner ${lineCls(e)}"><span class="ln"></span>Continua dal ${fmtShort(e.date)} · giorno ${cont.i + 1} di ${cont.n}</div>`
    : (span.length > 1 ? `<div class="cont-banner ${lineCls(e)}"><span class="ln"></span>Dura ${span.length} giorni · fino al ${fmtShort(span[span.length - 1])}</div>` : '');
  const st = staffOf(e), vhs = vehiclesOf(e);
  const head = e.type === 'check'
    ? `<span class="mag ${c.color}">${esc(c.name)}</span>${astHtml(e)}${e.time ? `<span class="time">${esc(e.time)}</span>` : ''}`
    : `<span class="note ${e.type}">${e.time ? `<b>${esc(e.time)}</b> ` : ''}${notaHtml(e)}${astHtml(e)}</span>`;
  const who = (st.length || vhs.length)
    ? `<div class="who big">${st.map(s => `<span class="st">${esc(s.name)}</span>`).join('')}${vhs.map(v => `<span class="vh">${esc(v.name)}</span>`).join('')}</div>`
    : (e.type !== 'pers' ? `<div class="who-empty">Tecnico e mezzo da assegnare</div>` : '');
  return `<div class="card ${e.type} ${cont ? 'is-cont' : ''}" ${cont ? '' : 'draggable="true"'} data-ev="${e.id}">
    ${banner}
    <div class="card-top">${head}</div>
    ${e.type === 'check' && e.text ? `<div class="card-note mnote">${esc(noteTxt(e.text))}</div>` : ''}
    ${e.unsigned && e.type !== 'pers' ? '<div class="unsigned-txt"><span class="ast">✱</span> Rapportino da firmare</div>' : ''}
    ${who}
    ${c && c.contacts?.length ? `<div class="contacts">${contactLinks(c)}</div>` : ''}
  </div>`;
}

function renderDay() {
  const d = state.selDate;
  const evs = eventsOn(d);
  const conts = contOn(d);
  const dt = parseIso(d);
  const dv = $('#dayView');
  if (state.dayMode === 'box') {
    // la casella del mese, ingrandita
    const zc = ({ e, i, n }) => `<div class="zcont ${lineCls(e)}" data-ev="${e.id}">
        <span class="ln"></span>${i === n - 1 ? '<span class="hd"></span>' : '<span class="ln end"></span>'}
        <span class="zl">${esc(evLabel(e))} · dal ${fmtShort(e.date)}</span></div>`;
    const items = conts.map(zc).join('') + evs.map(itemHtml).join('');
    dv.innerHTML = `
      <div class="zoom ${isWeekend(d) ? 'we' : ''} ${d === todayIso() ? 'today' : ''} ${state.placing ? 'placing' : ''} ${state.zoomFrom ? 'zoom-in' : ''}"
           style="${state.zoomFrom ? `transform-origin:${state.zoomFrom}` : ''}" data-date="${d}">
        <div class="zoom-head"><div class="num">${dt.getDate()}</div>
          <div class="zoom-date">${GG_LUNGHI[dt.getDay()]}<br><span>${MESI[dt.getMonth()]} ${dt.getFullYear()}</span></div></div>
        <div class="items">${items || '<p class="empty">Nessuna attività in questo giorno.</p>'}</div>
      </div>`;
  } else {
    const sec = (type, label) => {
      const list = evs.filter(e => e.type === type).map(e => cardHtml(e));
      const cl = conts.filter(x => x.e.type === type).map(x => cardHtml(x.e, x));
      return `<section class="day-sec sec-${type}">
        <header><h3>${label}</h3></header>
        ${[...cl, ...list].join('') || '<p class="empty">Niente in programma.</p>'}
      </section>`;
    };
    dv.innerHTML = `
      <div class="day-cols ${state.placing ? 'placing' : ''} ${state.zoomFrom ? 'zoom-in' : ''}" style="${state.zoomFrom ? `transform-origin:${state.zoomFrom}` : ''}" data-date="${d}">
        ${sec('check', 'Controlli periodici')}
        ${sec('extra', 'Lavori extra')}
        ${sec('pers', 'Impegni e assenze')}
      </div>`;
  }
  state.zoomFrom = null;   // l'animazione si fa solo all'apertura
}

function renderPlacingBar() {
  const pb = $('#placingBar');
  const c = state.placing && clientById(state.placing);
  if (!c) { state.placing = null; pb.hidden = true; return; }
  pb.hidden = false;
  pb.innerHTML = `<span>Tocca un giorno per posizionare</span> <span class="mag sm ${c.color}">${esc(c.name)}</span>
    <button class="btn sm light" data-action="cancel-place">Annulla</button>`;
}

/* ============================================================
   EDITOR DI UNA VOCE (controllo, lavoro extra, impegno)
   ============================================================ */
function openEditor(id, opts = {}) {
  const ev = id ? eventById(id) : null;
  if (id && !ev) return;
  state.edit = ev
    ? { ...ev, staffIds: [...(ev.staffIds || [])], vehicleIds: [...vehIdsOf(ev)], text: ev.text || '', time: ev.time || '' }
    : { id: null, type: opts.type || 'extra', date: opts.date || state.selDate, clientId: '', extraClientId: '', text: '', time: '', staffIds: [], vehicleIds: [] };
  state.modal = 'edit';
  buildEditor();
}

function clientOptions(sel) {
  const col = coloreDelMese(parseIso(state.edit.date).getMonth());
  const perNome = a => [...a].sort((x, y) => (x.full || x.name || '').localeCompare(y.full || y.name || '', 'it'));
  const due = perNome(state.clients.filter(c => c.color === col));
  const others = perNome(state.clients.filter(c => c.color !== col));
  // nel menu il nome completo (ditta · sede) con la sigla; sulla lavagna resta solo la sigla
  const opt = c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.full && c.full !== c.name ? `${c.full} (${c.name})` : c.name)}</option>`;
  return `<option value="">Scegli cliente…</option>`
    + (due.length ? `<optgroup label="Da controllare questo mese">${due.map(opt).join('')}</optgroup>` : '')
    + (others.length ? `<optgroup label="Altri clienti">${others.map(opt).join('')}</optgroup>` : '');
}

function buildEditor() {
  const e = state.edit, isNew = !e.id;
  const c = e.type === 'check' ? clientById(e.clientId) : null;
  const title = e.type === 'check' ? (isNew ? 'Nuovo controllo' : 'Controllo periodico') : (isNew ? 'Nuova annotazione' : TIPI[e.type]);
  const staff = byName(state.staff);
  const veh = byName(state.vehicles);
  const staffPicks = staff.length
    ? staff.map(s => `<button type="button" class="pick st ${e.staffIds.includes(s.id) ? 'on' : ''}" data-action="ed-staff" data-id="${s.id}">${esc(s.name)}</button>`).join('')
    : `<span class="empty">Nessuna persona. <button type="button" class="linkish" data-action="gest" data-href="${GEST}utenti">Aggiungile nel gestionale</button></span>`;
  const vehPicks = veh.length
    ? veh.map(v => `<button type="button" class="pick vh ${e.vehicleIds.includes(v.id) ? 'on' : ''}" data-action="ed-veh" data-id="${v.id}">${esc(v.name)}</button>`).join('')
    : `<span class="empty">Nessun mezzo. <button type="button" class="linkish" data-action="gest" data-href="${GEST}mezzi">Aggiungili nel gestionale</button></span>`;
  const typeSeg = (isNew && e.type !== 'check')
    ? `<div class="seg">${['extra', 'pers'].map(t => `<button type="button" class="seg-btn ${e.type === t ? 'on' : ''}" data-action="ed-type" data-type="${t}">${TIPI[t]}</button>`).join('')}</div>`
    : '';
  const clientField = e.type === 'pers' ? '' : e.type === 'extra'
    ? `<label class="fld"><span>Cliente (facoltativo)</span><select id="edXClient">${clientOptions(e.extraClientId).replace('Scegli cliente…', 'Nessun cliente')}</select></label>`
    : (isNew
    ? `<label class="fld"><span>Cliente</span><select id="edClient">${clientOptions(e.clientId)}</select></label>`
    : `<div class="ed-client"><span class="mag ${c?.color || ''}">${esc(c?.name || '?')}</span>
         </div>`);
  const placeholder = e.type === 'check' ? 'Es. chiamare il giorno prima' : e.type === 'extra' ? 'Es. Sostituzione fune paranco' : 'Es. Luca permesso / visita medica';

  $('#modal').innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true">
      <header class="sheet-head">
        <div><div class="eyebrow">${esc(dateLabel(e.date))}</div><h2>${title}</h2></div>
        <div class="head-btns">
          ${e.type !== 'pers' ? `<button type="button" class="info-btn xs" data-action="info" data-topic="unsigned" aria-label="Cos'è l'asterisco">i</button><button type="button" class="ast-toggle ${e.unsigned ? 'on' : ''}" data-action="ed-unsigned" title="Rapportino da firmare" aria-pressed="${e.unsigned ? 'true' : 'false'}">✱</button>` : ''}
          <button class="icon-btn sm" data-action="close" aria-label="Chiudi">✕</button>
        </div>
      </header>
      ${e.unsigned && e.type !== 'pers' ? '<div class="unsigned-bar"><span class="ast">✱</span> Rapportino da firmare <button type="button" class="linkish" data-action="ed-unsigned">Firmato, togli</button></div>' : ''}
      <form id="editorForm" class="ed" autocomplete="off">
        ${typeSeg}
        ${clientField}
        <div class="row">
          <label class="fld"><span>Data</span><input type="date" id="edDate" value="${e.date}" required></label>
          <label class="fld narrow"><span>Ora</span><input type="time" id="edTime" value="${esc(e.time)}"></label>
        </div>
        <div class="row dur-row">
          <label class="fld narrow"><span>Durata (giorni) <button type="button" class="info-btn xs" data-action="info" data-topic="duration" aria-label="Informazioni">i</button></span>
            <div class="stepper">
              <button type="button" data-action="ed-days" data-d="-1" aria-label="Meno un giorno">−</button>
              <input type="number" id="edDays" min="1" max="${MAX_DAYS}" value="${Math.max(1, +e.days || 1)}" inputmode="numeric">
              <button type="button" data-action="ed-days" data-d="1" aria-label="Più un giorno">+</button>
            </div></label>
          <div class="fld"><span>&nbsp;</span>
            <small class="muted span-txt" id="edSpanTxt"></small>
            <label class="check-lbl small" id="edWeekendLbl"><input type="checkbox" id="edWeekend" ${e.weekend ? 'checked' : ''}> Conta anche sabato e domenica</label></div>
        </div>
        <label class="fld"><span>${e.type === 'check' ? 'Nota (facoltativa)' : 'Descrizione'}</span>
          <input id="edText" value="${esc(e.text)}" placeholder="${placeholder}"></label>
        <div class="fld"><span>${e.type === 'pers' ? 'Persona' : 'Chi va'}</span><div class="picks">${staffPicks}</div></div>
        ${e.type !== 'pers' ? `<div class="fld"><span>Mezzo</span><div class="picks">${vehPicks}</div></div>` : ''}
        ${c?.contacts?.length ? `<div class="fld"><span>Referenti</span><div class="contacts">${contactLinks(c)}</div></div>` : ''}
        <div class="row ed-foot">
          ${isNew ? '' : '<button type="button" class="btn danger" data-action="ed-delete">Elimina</button>'}
          <span class="spacer"></span>
          <button type="button" class="btn ghost" data-action="close">Annulla</button>
          <button type="submit" class="btn primary">Salva</button>
        </div>
      </form>
    </div>`;
  showModal();
  updateSpanTxt();
}

function updateSpanTxt() {
  const t = $('#edSpanTxt');
  if (!t || !state.edit) return;
  syncEdit();
  const s = spanDates(state.edit);
  t.textContent = s.length > 1 ? `Dal ${fmtShort(s[0])} al ${fmtShort(s[s.length - 1])}` : 'Un solo giorno';
  const wl = $('#edWeekendLbl');
  if (wl) wl.hidden = s.length < 2;
}

function syncEdit() {
  const e = state.edit;
  if (!e || !$('#edDate')) return;
  e.date = $('#edDate').value || e.date;
  e.time = $('#edTime').value;
  e.days = Math.max(1, Math.min(MAX_DAYS, Math.round(+$('#edDays').value || 1)));
  e.weekend = $('#edWeekend').checked;
  e.text = $('#edText').value;
  if ($('#edClient')) e.clientId = $('#edClient').value;
  if ($('#edXClient')) e.extraClientId = $('#edXClient').value;
}

function saveEditor() {
  syncEdit();
  const e = state.edit;
  if (e.type === 'check' && !clientById(e.clientId)) { toast('Scegli un cliente'); return; }
  if (e.type !== 'check' && !e.text.trim()) { toast('Scrivi una descrizione'); $('#edText').focus(); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) { toast('Data non valida'); return; }
  const obj = {
    id: e.id || uid(), type: e.type, date: e.date, time: e.time || '', text: e.text.trim(),
    days: e.days || 1, weekend: !!e.weekend,
    staffIds: e.staffIds.filter(staffById),
    vehicleIds: e.type === 'pers' ? [] : e.vehicleIds.filter(vehicleById),
    vehicleId: '',
    updatedAt: Date.now()
  };
  if (e.type === 'check') obj.clientId = e.clientId;
  if (e.type === 'extra' && clientById(e.extraClientId)) obj.extraClientId = e.extraClientId;
  if (e.unsigned && e.type !== 'pers') obj.unsigned = true;
  const old = e.id && eventById(e.id);
  run(db.save('events', obj));
  closeModal();
  if (old && old.date !== obj.date) toast(`Spostato a ${dateLabel(obj.date)}`);
}

/* ============================================================
   ANAGRAFICA (clienti, dipendenti, mezzi)
   ============================================================ */
function openAnag(tab) {
  state.modal = 'anag';
  if (tab) state.anagTab = tab;
  const t = state.anagTab;
  let form = '';
  if (t === 'clients') {
    form = `<form id="clientForm" class="row wrap" autocomplete="off">
        <input id="clientName" placeholder="Nome ditta" required>
        <div class="swatches" id="newSwatches">
          ${ORDINE.map(c => `<button type="button" class="swatch ${c}" data-action="new-color" data-color="${c}" title="${COLORI[c].nome} – ${COLORI[c].mese}"></button>`).join('')}
        </div>
        <button class="btn primary" type="submit">Aggiungi</button>
      </form>`;
  } else if (t === 'staff') {
    form = `<form id="staffForm" class="row" autocomplete="off">
        <input id="staffName" placeholder="Nome (es. Luca)" required>
        <button class="btn primary" type="submit">Aggiungi</button>
      </form>`;
  } else {
    form = `<form id="vehForm" class="row" autocomplete="off">
        <input id="vehName" placeholder="Es. Ducato AB123CD" required>
        <button class="btn primary" type="submit">Aggiungi</button>
      </form>`;
  }
  const tabs = [['clients', 'Clienti'], ['staff', 'Dipendenti'], ['vehicles', 'Mezzi']];
  $('#modal').innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true">
      <header class="sheet-head">
        <div><div class="eyebrow">Anagrafica</div><h2>${tabs.find(x => x[0] === t)[1]}</h2></div>
        <div class="head-btns"><button class="info-btn" data-action="info" data-topic="anag-${t}" aria-label="Informazioni">i</button>
        <button class="icon-btn sm" data-action="close" aria-label="Chiudi">✕</button></div>
      </header>
      <div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${k === t ? 'on' : ''}" data-action="anag" data-tab="${k}">${l} <span data-count="${k}"></span></button>`).join('')}</div>
      ${form}
      <section><div id="anagList"></div></section>
    </div>`;
  showModal();
  if (t === 'clients') setNewColor(state.newColor);
  renderAnagList();
}

function setNewColor(c) {
  state.newColor = c;
  document.querySelectorAll('#newSwatches .swatch').forEach(b => b.classList.toggle('on', b.dataset.color === c));
}

function renderAnagList() {
  const el = $('#anagList');
  if (!el) return;
  document.querySelectorAll('[data-count]').forEach(s => { s.textContent = state[s.dataset.count].length || ''; });
  const t = state.anagTab;
  if (t === 'clients') {
    const list = [...state.clients].sort((a, b) => ORDINE.indexOf(a.color) - ORDINE.indexOf(b.color) || a.name.localeCompare(b.name, 'it'));
    el.innerHTML = list.length ? list.map(c => {
      const n = (c.contacts || []).length;
      return `<button class="list-row" data-action="open-client" data-id="${c.id}">
        <i class="sw ${c.color}"></i><span class="client-name">${esc(c.name)}</span>
        <span class="sub">${n ? `${n} referent${n === 1 ? 'e' : 'i'}` : 'nessun referente'}</span><span class="chev">›</span>
      </button>`;
    }).join('') : '<p class="empty">Nessun cliente inserito.</p>';
  } else {
    const list = byName(state[t]);
    const cls = t === 'staff' ? 't-st' : 't-vh';
    el.innerHTML = list.length ? list.map(x => `
      <div class="client-row">
        <span class="client-name ${cls}" data-action="rename-item" data-col="${t}" data-id="${x.id}" title="Tocca per rinominare">${esc(x.name)}</span>
        <button class="icon-btn sm" data-action="del-item" data-col="${t}" data-id="${x.id}" title="Elimina">✕</button>
      </div>`).join('') : `<p class="empty">${t === 'staff' ? 'Nessun dipendente inserito.' : 'Nessun mezzo inserito.'}</p>`;
  }
}

/* ---------------- Scheda cliente con referenti ---------------- */
function openClient(id) {
  const c = clientById(id);
  if (!c) return;
  state.modal = 'client';
  state.clientOpen = id;
  state.editContact = null;
  $('#modal').innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true">
      <header class="sheet-head">
        <div><div class="eyebrow">Cliente</div><h2 id="clTitle"></h2></div>
        <button class="icon-btn sm" data-action="close" aria-label="Chiudi">✕</button>
      </header>
      <label class="fld"><span>Nome ditta</span><input id="clName" value="${esc(c.name)}" autocomplete="off"></label>
      <div class="fld"><span>Colore del trimestre</span>
        <div class="row tight"><div class="swatches" id="clSwatches">
          ${ORDINE.map(k => `<button type="button" class="swatch ${k}" data-action="cl-color" data-color="${k}" title="${COLORI[k].nome}"></button>`).join('')}
        </div><small id="clColorTxt" class="muted"></small></div>
      </div>
      <section>
        <h3>Referenti</h3>
        <div id="clContacts"></div>
        <form id="contactForm" class="contact-form" autocomplete="off">
          <input id="ctName" placeholder="Nome (es. Mario – manutenzione)" required>
          <input id="ctPhone" type="tel" placeholder="Telefono" required>
          <button class="btn primary" type="submit">Aggiungi</button>
        </form>
      </section>
      <div class="row ed-foot">
        <button class="btn ghost" data-action="anag" data-tab="clients">‹ Elenco clienti</button>
        <span class="spacer"></span>
        <button class="btn danger" data-action="del-client" data-id="${c.id}">Elimina cliente</button>
      </div>
    </div>`;
  showModal();
  renderClientSheet();
}

function renderClientSheet() {
  const c = clientById(state.clientOpen);
  if (!c) { openAnag('clients'); return; }
  $('#clTitle').textContent = c.name;
  if (document.activeElement !== $('#clName')) $('#clName').value = c.name;
  document.querySelectorAll('#clSwatches .swatch').forEach(b => b.classList.toggle('on', b.dataset.color === c.color));
  $('#clColorTxt').textContent = `${COLORI[c.color].mese} (${COLORI[c.color].mesi})`;
  const list = c.contacts || [];
  if (document.activeElement && document.activeElement.closest('#contactEditForm')) return;  // non disturbare chi sta scrivendo
  $('#clContacts').innerHTML = list.length ? list.map(k => state.editContact === k.id ? `
    <form id="contactEditForm" class="contact-form edit" data-id="${k.id}" autocomplete="off">
      <input id="ceName" value="${esc(k.name)}" placeholder="Nome" required>
      <input id="cePhone" type="tel" value="${esc(k.phone)}" placeholder="Telefono" required>
      <div class="ce-btns"><button type="button" class="btn ghost" data-action="cancel-contact">Annulla</button>
      <button class="btn primary" type="submit">Salva</button></div>
    </form>` : `
    <div class="contact-row">
      <div class="ct-main"><b>${esc(k.name)}</b><span>${esc(k.phone)}</span></div>
      <a class="btn sm call-btn" href="${telHref(k.phone)}">📞 Chiama</a>
      <button class="icon-btn sm" data-action="edit-contact" data-id="${k.id}" title="Modifica referente">✎</button>
      <button class="icon-btn sm" data-action="del-contact" data-id="${k.id}" title="Elimina referente">✕</button>
    </div>`).join('') : '<p class="empty">Nessun referente inserito.</p>';
}

/* ============================================================
   PDF DEL MESE (tramite stampa → "Salva come PDF") ed EXCEL
   ============================================================ */
function monthRows() {
  return state.events.filter(e => visible(e) && inMonth(e))
    .sort((a, b) => a.date.localeCompare(b.date) || sortEv(a, b))
    .map(e => {
      const c = clientById(e.clientId);
      const dt = parseIso(e.date);
      return {
        e,
        data: (() => {
          const s = spanDates(e), f = x => { const t = parseIso(x); return `${pad(t.getDate())}/${pad(t.getMonth() + 1)}/${t.getFullYear()}`; };
          return s.length > 1 ? `${f(s[0])} → ${f(s[s.length - 1])} (${s.length} gg)` : f(e.date);
        })(),
        giorno: GG_LUNGHI[dt.getDay()],
        tipo: e.type === 'check' ? `Controllo (${COLORI[c.color].nome.toLowerCase()})` : TIPI[e.type],
        descr: (e.type === 'check' ? c.name + (e.text ? ' + ' + noteTxt(e.text) : '') : notaTxt(e)) + (e.unsigned && e.type !== 'pers' ? ' ✱ (rapportino da firmare)' : ''),
        ora: e.time || '',
        tecnici: staffNames(e),
        mezzo: vehicleName(e)
      };
    });
}

function buildReport() {
  const { year: y, month: m } = state;
  const col = coloreDelMese(m);
  const days = new Date(y, m + 1, 0).getDate();
  const off = (new Date(y, m, 1).getDay() + 6) % 7;
  const weeks = Math.ceil((off + days) / 7);

  let cells = GG.map(g => `<div class="rp-dow">${g}</div>`).join('');
  for (let i = 0; i < weeks * 7; i++) {
    const d = i - off + 1;
    if (d < 1 || d > days) { cells += '<div class="rp-cell blank"></div>'; continue; }
    const conts = contOn(isoDate(y, m, d)).map(x => contHtml(x, 'rp-cont')).join('');
    const items = conts + eventsOn(isoDate(y, m, d)).map(e => {
      const who = [staffNames(e) && `<span class="st">${esc(staffNames(e))}</span>`, vehicleName(e) && `<span class="vh">${esc(vehicleName(e))}</span>`].filter(Boolean).join(' ');
      const head = e.type === 'check'
        ? `<div class="rp-magline"><div class="rp-mag ${clientById(e.clientId).color} done">${e.time ? esc(e.time) + ' ' : ''}${esc(clientById(e.clientId).name)}</div>${astHtml(e)}${e.text && !((+e.days || 1) > 1) ? `<span class="rp-mnote">${esc(noteTxt(e.text))}</span>` : ''}</div>`
        : `<div class="rp-note ${e.type}">${e.time ? `<b>${esc(e.time)}</b> ` : ''}${notaHtml(e)}${astHtml(e)}</div>`;
      const tail = (+e.days || 1) > 1 ? `<span class="tail ${lineCls(e)}"></span>` : '';
      const below = tail && e.type === 'check' && e.text ? `<div class="rp-mnote">${esc(noteTxt(e.text))}</div>` : '';
      return (tail ? `<div class="head-row" data-origin="${e.id}">${head}${tail}</div>${below}` : head) + (who ? `<div class="rp-who">${who}</div>` : '');
    }).join('');
    cells += `<div class="rp-cell ${i % 7 > 4 ? 'we' : ''}"><div class="rp-num">${d}</div>${items}</div>`;
  }

  // Riepilogo controlli del mese
  const due = byName(state.clients.filter(c => c.color === col));
  const checks = state.events.filter(e => e.type === 'check' && inMonth(e));
  const pianificati = due.filter(c => checks.some(e => e.clientId === c.id));
  const nonPian = due.filter(c => !checks.some(e => e.clientId === c.id));
  const names = a => a.length ? a.map(c => esc(c.name)).join(', ') : '—';

  const rows = monthRows();
  const tbody = rows.length ? rows.map(r => `<tr class="t-${r.e.type}">
      <td>${r.data}</td><td>${r.giorno}</td><td>${esc(r.tipo)}</td><td>${esc(r.descr)}</td><td>${esc(r.ora)}</td>
      <td class="st">${esc(r.tecnici)}</td><td class="vh">${esc(r.mezzo)}</td></tr>`).join('')
    : '<tr><td colspan="7" class="center">Nessuna attività registrata nel mese.</td></tr>';

  const gen = new Date().toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
  $('#printArea').innerHTML = `
    <section class="rp-page rp-cal">
      <header class="rp-head">
        <div class="rp-title"><img class="rp-logo" src="logo.png" alt=""><div>
          <h1>Lavagna Officina · ${MESI[m]} ${y}</h1>
          <p>Controlli del mese: clienti <b>${COLORI[col].nome.toLowerCase()}</b> (${COLORI[col].mese}) · Stampato il ${gen}</p>
        </div></div>
        <div class="rp-legend">
          <span class="rp-note extra">Lavoro extra</span>
          <span class="rp-note pers">Impegno</span>
          <span class="st">Tecnico</span>
          <span class="vh">Mezzo</span>
        </div>
      </header>
      <div class="rp-grid" style="grid-template-rows:max-content repeat(${weeks},auto)">${cells}</div>
    </section>
    <section class="rp-page rp-reg">
      <header class="rp-head"><div class="rp-title"><img class="rp-logo" src="logo.png" alt=""><div><h1>Registro attività · ${MESI[m]} ${y}</h1><p>Stampato il ${gen}</p></div></div></header>
      <div class="rp-summary">
        <div><b>Controlli del mese (${COLORI[col].nome.toLowerCase()}):</b> ${due.length} clienti · <span class="ok">${pianificati.length} in calendario</span> · ${nonPian.length ? `<span class="ko">${nonPian.length} non pianificati</span>` : 'tutti pianificati'}</div>
        ${nonPian.length ? `<div><b>Non pianificati:</b> ${names(nonPian)}</div>` : ''}
      </div>
      <table class="rp-table">
        <thead><tr><th>Data</th><th>Giorno</th><th>Tipo</th><th>Cliente / descrizione</th><th>Ora</th><th>Tecnici</th><th>Mezzo</th></tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </section>`;
}

/* PDF del mese già in A4 orizzontale: la pagina viene "fotografata" e messa in un PDF
   (così non dipende da come il browser imposta la stampa: verticale, margini, scala…) */
const MMPX = 96 / 25.4;
/* il mese deve stare tutto nel foglio: se le caselle piene allungano le righe e le ultime settimane
   escono dal foglio, rimpicciolisco il testo un poco alla volta finché ci sta (sotto i 4pt non scendo) */
function fitLavagna(root) {
  root.querySelectorAll('.rp-cal .rp-grid').forEach(g => {
    let pt = 6.5;
    g.style.setProperty('--rpf', pt + 'pt');
    const fuori = () => g.scrollHeight > g.clientHeight + 1;
    while (fuori() && pt > 4) { pt = Math.round((pt - .25) * 100) / 100; g.style.setProperty('--rpf', pt + 'pt'); }
    // se ancora non ci sta, tolgo gli spazi tra le righe
    if (fuori()) g.classList.add('stretta');
  });
}
function impagina(box) {
  box.innerHTML = $('#printArea').innerHTML;
  const pagine = [...box.querySelectorAll('.rp-page')];
  pagine.forEach(p => p.classList.add('pdf'));
  fitLavagna(box);
  alignArrows(box, '.rp-cell', '.rp-cont');
  // il registro può essere lungo: lo divido in più fogli orizzontali senza tagliare le righe
  const reg = box.querySelector('.rp-reg');
  if (reg) {
    const max = 210 * MMPX - 2;
    const righe = [...reg.querySelectorAll('tbody tr')];
    const modello = reg.cloneNode(true);
    modello.querySelector('tbody').innerHTML = ''; modello.querySelector('.rp-summary')?.remove();
    let pag = reg, tb = reg.querySelector('tbody'), dopo = reg;
    righe.forEach(r => r.remove());
    righe.forEach(r => {
      tb.appendChild(r);
      if (pag.offsetHeight > max && tb.children.length > 1) {
        r.remove();
        pag = modello.cloneNode(true); dopo.after(pag); dopo = pag;
        tb = pag.querySelector('tbody'); tb.appendChild(r);
      }
    });
  }
  box.querySelectorAll('.rp-page').forEach((p, i, tutte) => {
    p.classList.add('fissa');
    if (tutte.length > 2 && p.classList.contains('rp-reg')) {
      const h1 = p.querySelector('.rp-head h1');
      const n = [...tutte].filter(x => x.classList.contains('rp-reg')).indexOf(p) + 1, tot = tutte.length - 1;
      h1.insertAdjacentHTML('beforeend', ` <small>(${n}/${tot})</small>`);
    }
  });
}

async function exportPdf() {
  if (window.PDFX) {
    const nome = `Lavagna_${MESI[state.month]}_${state.year}.pdf`;
    toast('Preparo il PDF…');
    try {
      buildReport();
      const bytes = await window.PDFX.daStampa(impagina, '.rp-page', false);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      // il PDF si scarica direttamente (poi lo apri, lo stampi o lo invii)
      const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
      toast('PDF scaricato: ' + nome);
      setTimeout(() => URL.revokeObjectURL(url), 120000);
      return;
    } catch (er) {
      console.warn('PDF non riuscito, uso la stampa del browser', er);
    }
  }
  buildReport();
  const pa = $('#printArea');
  await Promise.all([...pa.querySelectorAll('img')].map(i => (i.decode ? i.decode() : Promise.resolve()).catch(() => {})));
  pa.style.cssText = 'display:block;position:absolute;left:-10000px;top:0';
  fitLavagna(pa);
  alignArrows(pa, '.rp-cell', '.rp-cont');
  pa.style.cssText = '';
  if (!document.getElementById('pageLandscape')) {
    const st = document.createElement('style');
    st.id = 'pageLandscape';
    st.media = 'print';
    st.textContent = '@page{size:297mm 210mm;margin:8mm}';
    document.head.appendChild(st);
  }
  const old = document.title;
  document.title = `Lavagna_${MESI[state.month]}_${state.year}`;
  const restore = () => { document.title = old; window.removeEventListener('afterprint', restore); };
  window.addEventListener('afterprint', restore);
  setTimeout(() => { window.print(); setTimeout(restore, 1500); }, 60);
}

/* ============================================================
   MODALI, TOAST, STATO CONNESSIONE
   ============================================================ */
function showModal() { $('#modal').hidden = false; document.body.classList.add('modal-open'); syncHistory(); }
function closeModal() {
  closeLogSub();
  state.modal = null; state.edit = null; state.clientOpen = null;
  $('#modal').hidden = true; $('#modal').innerHTML = '';
  document.body.classList.remove('modal-open');
  syncHistory();
}

let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.hidden = true; }, 2800);
}
function setStatus(s) {
  const map = {
    local: ['Solo questo dispositivo', 'grey'],
    connecting: ['Connessione…', 'grey'],
    online: ['Sincronizzato', 'ok'],
    offline: ['Offline · in attesa', 'warn'],
    error: ['Errore sincronizzazione', 'err']
  };
  const [txt, cls] = map[s] || map.connecting;
  state.status = { txt, cls };
  const dot = $('#statusDot');
  dot.className = 'dot ' + cls;
  $('#menuBtn').title = txt;
  if (state.menuOpen) renderMenu();
}

/* ============================================================
   MENU (si apre solo quando serve)
   ============================================================ */
function renderMenu() {
  const m = $('#menu');
  m.hidden = !state.menuOpen;
  $('#menuBtn').classList.toggle('on', state.menuOpen);
  if (!state.menuOpen) { m.innerHTML = ''; return; }
  const u = state.user;
  const st = state.status || { txt: '', cls: 'grey' };
  m.innerHTML = `
    <div class="menu-user">
      ${u ? (u.photo ? `<img src="${esc(u.photo)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${esc((u.name || u.email || '?').charAt(0).toUpperCase())}</span>`) : '<span class="avatar">·</span>'}
      <div><b>${esc(u ? (u.name || u.email) : 'Lavagna Officina')}</b><span class="status ${st.cls}"><i></i>${esc(st.txt)}</span></div>
    </div>
    <div class="menu-sec">Anagrafiche (nel gestionale)</div>
    <button data-action="gest" data-href="${GEST}clienti">Clienti e sedi</button>
    <button data-action="gest" data-href="${GEST}utenti">Persone</button>
    <button data-action="gest" data-href="${GEST}mezzi">Mezzi</button>
    ${state.unsigned.length ? `<div class="menu-sec">Da sistemare</div>
    <button data-action="unsigned"><span class="ast">✱</span> Rapportini da firmare <span class="badge red">${state.unsigned.length}</span></button>` : ''}
    ${puoStampare() ? `<div class="menu-sec">${MESI[state.month]} ${state.year}</div>
    <button data-action="pdf">⬇️ Scarica il PDF del mese</button>` : ''}
    ${isAdmin() ? '<div class="menu-sep"></div><button data-action="log">Storico modifiche</button>' : ''}
    ${u ? '<div class="menu-sep"></div><button data-action="logout" class="danger-txt">Esci</button>' : ''}
    <div class="menu-ver">Versione ${APP_VERSION}</div>`;
}

/* ---------------- finestra Storico ---------------- */
let unsubLog = null;
function openLog() {
  if (!isAdmin()) return;
  state.modal = 'log';
  state.logFilter = state.logFilter || 'all';
  state.logQuery = '';
  state.logList = null;
  $('#modal').innerHTML = `
    <div class="sheet wide" role="dialog" aria-modal="true">
      <header class="sheet-head">
        <div><div class="eyebrow">Solo amministratore</div><h2>Storico modifiche</h2></div>
        <div class="head-btns"><button class="info-btn" data-action="info" data-topic="log" aria-label="Informazioni">i</button>
        <button class="icon-btn sm" data-action="close" aria-label="Chiudi">✕</button></div>
      </header>
      <div class="log-tools">
        <input id="logSearch" type="search" placeholder="Cerca (cliente, persona, testo…)" autocomplete="off">
        <div class="seg" id="logSeg"></div>
      </div>
      <div id="logList" class="log-list"><p class="empty">Caricamento…</p></div>
    </div>`;
  showModal();
  if (unsubLog) unsubLog();
  unsubLog = db.subscribeLog((list, err) => {
    state.logList = list;
    state.logErr = err || null;
    renderLogList();
  });
}
function closeLogSub() { if (unsubLog) { unsubLog(); unsubLog = null; } }

const LOG_ICO = { create: ['+', 'Aggiunto', 'c'], update: ['✎', 'Modificato', 'u'], delete: ['🗑', 'Eliminato', 'd'], restore: ['↺', 'Ripristinato', 'r'] };
function renderLogList() {
  const el = $('#logList');
  if (!el) return;
  const seg = $('#logSeg');
  seg.innerHTML = [['all', 'Tutto'], ['delete', 'Eliminazioni'], ['update', 'Modifiche']]
    .map(([k, l]) => `<button class="seg-btn ${state.logFilter === k ? 'on' : ''}" data-action="log-filter" data-f="${k}">${l}</button>`).join('');
  if (state.logErr) { el.innerHTML = `<p class="empty">Non riesco a leggere lo storico: controlla le regole di Firestore (vedi istruzioni).</p>`; return; }
  if (!state.logList) return;
  const q = (state.logQuery || '').toLowerCase();
  const list = state.logList
    .filter(x => state.logFilter === 'all' || x.action === state.logFilter)
    .filter(x => !q || [x.label, x.by, x.byName, ...(x.changes || [])].join(' ').toLowerCase().includes(q));
  if (!list.length) { el.innerHTML = '<p class="empty">Nessuna modifica registrata.</p>'; return; }
  let lastDay = '';
  el.innerHTML = list.map(x => {
    const d = new Date(x.ts);
    const day = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const hh = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const [ico, verb, cls] = LOG_ICO[x.action] || ['•', x.action, ''];
    const who = x.byName ? `${esc(x.byName)} <small>${esc(x.by)}</small>` : esc(x.by || 'sconosciuto');
    const canRestore = (x.action === 'delete' && x.before && x.before.id && (x.before.date || x.before.name))
      || (x.action === 'update' && x.before);
    const sep = day !== lastDay ? `<div class="log-day">${day}</div>` : '';
    lastDay = day;
    return `${sep}<div class="log-row ${cls}">
      <span class="log-ico">${ico}</span>
      <div class="log-main">
        <div class="log-top"><b>${verb}</b> ${esc(x.label || '')}</div>
        ${(x.changes || []).length ? `<ul class="log-ch">${x.changes.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
        ${x.action === 'delete' && x.clientEvents?.length ? `<div class="log-sub">insieme a ${x.clientEvents.length} controlli del mese</div>` : ''}
        <div class="log-who">${hh} · ${who}</div>
      </div>
      ${canRestore ? `<button class="btn sm" data-action="log-restore" data-id="${x.id}">${x.action === 'delete' ? 'Ripristina' : 'Torna com’era'}</button>` : ''}
    </div>`;
  }).join('');
}
function restoreLog(logId) {
  const x = (state.logList || []).find(l => l.id === logId);
  if (!x || !x.before) return;
  const msg = x.action === 'delete' ? `Ripristinare “${x.label}”?` : `Riportare “${x.label}” com’era prima di questa modifica?`;
  if (!confirm(msg)) return;
  run(db.save(x.col, { ...x.before, updatedAt: Date.now() }, { restore: true }));
  if (x.action === 'delete' && x.col === 'clients' && x.clientEvents?.length && confirm(`Ripristinare anche i ${x.clientEvents.length} controlli di questo cliente?`)) {
    x.clientEvents.forEach(e => run(db.save('events', { ...e, updatedAt: Date.now() }, { restore: true })));
  }
  toast('Ripristinato');
}
document.addEventListener('input', e => { if (e.target.id === 'logSearch') { state.logQuery = e.target.value; renderLogList(); } });

/* ============================================================
   RAPPORTINI DA FIRMARE
   ============================================================ */
function openUnsigned() {
  state.modal = 'unsigned';
  $('#modal').innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true">
      <header class="sheet-head">
        <div><div class="eyebrow">Da sistemare</div><h2><span class="ast big">✱</span> Rapportini da firmare</h2></div>
        <div class="head-btns"><button class="info-btn" data-action="info" data-topic="unsigned" aria-label="Informazioni">i</button>
        <button class="icon-btn sm" data-action="close" aria-label="Chiudi">✕</button></div>
      </header>
      <section><div id="unsignedList"></div></section>
    </div>`;
  showModal();
  renderUnsignedList();
}
function renderUnsignedList() {
  const el = $('#unsignedList');
  if (!el) return;
  const list = [...state.unsigned].filter(e => e.type !== 'check' || clientById(e.clientId)).sort((a, b) => a.date.localeCompare(b.date));
  el.innerHTML = list.length ? list.map(e => {
    const c = clientById(e.clientId);
    const label = e.type === 'check' ? `<span class="mag ${c.color}">${esc(c.name)}</span>${e.text ? `<span class="mnote">${esc(noteTxt(e.text))}</span>` : ''}` : `<span class="note extra">${notaHtml(e)}</span>`;
    return `<div class="uns-row">
      <button class="uns-main" data-action="uns-open" data-id="${e.id}" data-date="${e.date}"><small>${esc(dateLabel(e.date))}</small><span class="uns-lbl">${label}</span></button>
      <button class="btn sm" data-action="uns-sign" data-id="${e.id}">Firmato</button>
    </div>`;
  }).join('') : '<p class="empty">Tutti i rapportini sono firmati 👍</p>';
}

/* ============================================================
   INFO: le istruzioni compaiono solo toccando la "i"
   ============================================================ */
const INFO = {
  month: ['Come si legge la lavagna', `
    <p><b>Tocca un giorno</b> per vederlo ingrandito. Da lì puoi aggiungere controlli, lavori e impegni.</p>
    <p><b>Magneti:</b> apri “Magneti” per vedere i clienti da controllare nel mese e posizionarli sui giorni.</p>
    <ul class="legend">
      <li><span class="mag yellow">Giallo</span> 1° mese del trimestre (Gen · Apr · Lug · Ott)</li>
      <li><span class="mag green">Verde</span> 2° mese (Feb · Mag · Ago · Nov)</li>
      <li><span class="mag red">Rosso</span> 3° mese (Mar · Giu · Set · Dic)</li>
      <li><span class="note extra">Testo rosso</span> lavoro extra</li>
      <li><span class="note pers">Testo nero</span> impegno o assenza</li>
      <li><span class="t-st">Blu</span> chi va · <span class="t-vh">Verde</span> con quale mezzo</li>
      <li><span class="arrow-demo"></span> il lavoro continua nei giorni successivi</li>
      <li><span class="mag yellow">Cliente</span><span class="mnote">nota</span> nota del controllo</li>
      <li><span class="ast">✱</span> rapportino ancora da firmare</li>
    </ul>
    <p>Dal menu <b>☰</b> in alto a destra trovi anagrafica e PDF del mese da scaricare.</p>`],
  magnets: ['Magneti del mese', `
    <p>Qui ci sono i clienti da controllare nel mese, divisi in <b>da pianificare</b>, <b>pianificati</b> e <b>fatti</b> (quelli in giorni già passati: si considerano eseguiti automaticamente).</p>
    <p><b>Per posizionare un magnete:</b> toccalo e poi tocca il giorno sul calendario. Dal computer puoi anche trascinarlo sul giorno.</p>
    <p><b>Per spostarlo:</b> trascinalo su un altro giorno, oppure aprilo e cambia la data.</p>
    <p><b>Per toglierlo:</b> aprilo e premi “Elimina”, oppure trascinalo dentro questo pannello.</p>
    <p>In “Altri clienti” trovi le ditte degli altri mesi, se serve un controllo fuori programma.</p>`],
  day: ['Il giorno', `
    <p><b>Casella:</b> la casella del calendario ingrandita, così com'è sulla lavagna.</p>
    <p><b>Elenco:</b> le attività divise in controlli, lavori extra e impegni, con chi va, i mezzi e i numeri dei referenti da chiamare.</p>
    <p>Tocca una voce per modificarla, segnarla come fatta o eliminarla. Con <b>+ Aggiungi</b> inserisci una nuova voce.</p>
    <p>Le frecce <b>‹ ›</b> in alto passano al giorno prima o dopo. <b>‹ Mese</b> (o il tasto indietro) torna al calendario.</p>`],
  log: ['Storico modifiche', `
    <p>Qui c'è l'elenco di <b>tutte le modifiche</b> fatte alla lavagna: chi le ha fatte, quando e cosa è cambiato. Lo vede solo l'amministratore.</p>
    <p><b>+</b> aggiunto · <b>✎</b> modificato · <b>🗑</b> eliminato · <b>↺</b> ripristinato</p>
    <p>Con <b>Ripristina</b> rimetti in lavagna una voce eliminata. Con <b>Torna com'era</b> annulli una modifica.</p>
    <p>Usa la ricerca per trovare un cliente, una persona o un testo.</p>`],
  unsigned: ['Rapportini da firmare', `
    <p>L'<span class="ast">✱</span> rosso accanto a un controllo o a un lavoro extra indica che il <b>rapportino d'intervento non è ancora stato firmato</b>.</p>
    <p><b>Per metterlo:</b> apri la voce e tocca il pulsante <span class="ast-toggle demo">✱</span> in alto, accanto alla ✕.</p>
    <p><b>Per toglierlo:</b> riapri la voce e tocca “Firmato, togli”, oppure premi “Firmato” in questo elenco.</p>
    <p>Qui trovi tutti i rapportini ancora da firmare, anche dei mesi passati.</p>`],
  duration: ['Durata in giorni', `
    <p>Se un lavoro dura più di un giorno, aumenta la durata con <b>+</b>: sulla lavagna dal magnete partirà una freccia fino all'ultimo giorno.</p>
    <p>Sabato e domenica vengono saltati, a meno che spunti <b>“Conta anche sabato e domenica”</b>.</p>
    <p>Per togliere la freccia riporta la durata a 1.</p>`],
  'anag-clients': ['Clienti', `
    <p>Scrivi il nome della ditta, scegli il colore e premi <b>Aggiungi</b>.</p>
    <ul class="legend">
      <li><span class="mag yellow">Giallo</span> controlli nel 1° mese del trimestre (Gen · Apr · Lug · Ott)</li>
      <li><span class="mag green">Verde</span> 2° mese (Feb · Mag · Ago · Nov)</li>
      <li><span class="mag red">Rosso</span> 3° mese (Mar · Giu · Set · Dic)</li>
    </ul>
    <p>Tocca un cliente per cambiare nome o colore e per aggiungere, modificare o chiamare i <b>referenti</b>.</p>`],
  'anag-staff': ['Dipendenti', `
    <p>Le persone che puoi assegnare agli interventi. Sulla lavagna compaiono in <b class="t-st">blu</b>.</p>
    <p>Tocca un nome per rinominarlo, ✕ per eliminarlo.</p>`],
  'anag-vehicles': ['Mezzi', `
    <p>I mezzi che puoi assegnare agli interventi (anche più di uno). Sulla lavagna compaiono in <b class="t-vh">verde</b>.</p>
    <p>Tocca un nome per rinominarlo, ✕ per eliminarlo.</p>`]
};
function openInfo(topic) {
  const t = INFO[topic];
  if (!t) return;
  state.info = topic;
  const p = $('#infoPop');
  p.innerHTML = `<div class="info-card" role="dialog" aria-modal="true">
      <header><span class="info-ico">i</span><h3>${t[0]}</h3><button class="icon-btn sm" data-action="info-close" aria-label="Chiudi">✕</button></header>
      <div class="info-body">${t[1]}</div>
      <button class="btn primary full" data-action="info-close">Ho capito</button>
    </div>`;
  p.hidden = false;
  syncHistory();
}
function closeInfo() {
  state.info = null;
  $('#infoPop').hidden = true;
  $('#infoPop').innerHTML = '';
  syncHistory();
}

/* ============================================================
   AZIONI
   ============================================================ */
function handleAction(act, el) {
  const id = el.dataset.id;
  switch (act) {
    case 'prev':
      if (state.view === 'month') shiftMonth(-1);
      else { state.selDate = addDays(state.selDate, -1); syncMonthToSel(); render(); }
      break;
    case 'next':
      if (state.view === 'month') shiftMonth(1);
      else { state.selDate = addDays(state.selDate, 1); syncMonthToSel(); render(); }
      break;
    case 'today': state.selDate = todayIso(); syncMonthToSel(); render(); break;
    case 'to-month': setView('month'); break;
    case 'daymode': setDayMode(el.dataset.mode); break;
    case 'menu': state.menuOpen = !state.menuOpen; state.addOpen = false; render(); break;
    case 'add': state.addOpen = !state.addOpen; render(); break;
    case 'drawer': state.drawerOpen = !state.drawerOpen; state.menuOpen = false; render(); break;
    case 'drawer-close': state.drawerOpen = false; render(); break;
    case 'info': openInfo(el.dataset.topic); break;
    case 'info-close': closeInfo(); break;
    case 'pdf': if (puoStampare()) exportPdf(); break;
    case 'log': openLog(); break;
    case 'log-filter': state.logFilter = el.dataset.f; renderLogList(); break;
    case 'log-restore': restoreLog(id); break;
    case 'close': closeModal(); break;
    case 'cancel-place': state.placing = null; render(); break;

    case 'login': {
      const b = $('#loginBtn');
      b.disabled = true;
      Promise.resolve(db.login())
        .catch(err => { console.error(err); toast('Accesso non riuscito: ' + (err.code || err.message)); })
        .finally(() => { b.disabled = false; });
      break;
    }
    case 'logout':
      if (el.id !== 'loginLogout' && !confirm(`Connesso come ${currentEmail}.\nVuoi uscire?`)) break;
      run(db.logout());
      break;

    /* voci */
    case 'new': state.addOpen = false; openEditor(null, { type: el.dataset.type, date: state.selDate }); break;
    case 'ed-type': syncEdit(); state.edit.type = el.dataset.type; buildEditor(); break;
    case 'ed-unsigned': syncEdit(); state.edit.unsigned = !state.edit.unsigned; buildEditor(); break;
    case 'unsigned': openUnsigned(); break;
    case 'uns-sign': {
      const ev = state.unsigned.find(x => x.id === id);
      if (ev) { const { unsigned, ...rest } = ev; run(db.save('events', { ...rest, updatedAt: Date.now() })); toast('Rapportino segnato come firmato'); }
      break;
    }
    case 'uns-open': {
      closeModal();
      goDay(el.dataset.date);
      const tryOpen = n => { if (eventById(id)) openEditor(id); else if (n > 0) setTimeout(() => tryOpen(n - 1), 150); };
      tryOpen(20);
      break;
    }
    case 'ed-staff': {
      const ids = state.edit.staffIds;
      const i = ids.indexOf(id);
      if (i >= 0) ids.splice(i, 1); else ids.push(id);
      el.classList.toggle('on', i < 0);
      break;
    }
    case 'ed-veh': {
      const ids = state.edit.vehicleIds;
      const i = ids.indexOf(id);
      if (i >= 0) ids.splice(i, 1); else ids.push(id);
      el.classList.toggle('on', i < 0);
      break;
    }
    case 'ed-days': {
      const inp = $('#edDays');
      inp.value = Math.max(1, Math.min(MAX_DAYS, (+inp.value || 1) + (+el.dataset.d)));
      updateSpanTxt();
      break;
    }
    case 'ed-delete': {
      const ev = eventById(state.edit?.id);
      if (ev && confirm('Eliminare questa voce?')) { run(db.remove('events', ev.id)); closeModal(); }
      break;
    }

    /* anagrafica */
    case 'anag': location.href = GEST + ({ clients: 'clienti', staff: 'utenti', vehicles: 'mezzi' }[el.dataset.tab] || 'clienti'); break;
    case 'gest': location.href = el.dataset.href; break;
    case 'new-color': setNewColor(el.dataset.color); break;
    case 'open-client': openClient(id); break;
    case 'cl-color': {
      const c = clientById(state.clientOpen);
      if (c && c.color !== el.dataset.color) run(db.save('clients', { ...c, color: el.dataset.color }));
      break;
    }
    case 'edit-contact': state.editContact = id; renderClientSheet(); setTimeout(() => $('#cePhone')?.focus(), 30); break;
    case 'cancel-contact': state.editContact = null; if (document.activeElement) document.activeElement.blur(); renderClientSheet(); break;
    case 'del-contact': {
      const c = clientById(state.clientOpen);
      if (c && confirm('Eliminare questo referente?')) run(db.save('clients', { ...c, contacts: (c.contacts || []).filter(k => k.id !== id) }));
      break;
    }
    case 'del-client': {
      const c = clientById(id);
      if (c && confirm(`Eliminare ${c.name}?\nVerranno tolti anche i suoi controlli dal calendario.`)) {
        run(db.remove('clients', c.id));
        openAnag('clients');
      }
      break;
    }
    case 'rename-item': {
      const col = el.dataset.col;
      const x = state[col].find(i => i.id === id);
      const n = x && prompt('Nuovo nome', x.name);
      if (n && n.trim() && n.trim() !== x.name) run(db.save(col, { ...x, name: n.trim() }));
      break;
    }
    case 'del-item': {
      const col = el.dataset.col;
      const x = state[col].find(i => i.id === id);
      if (x && confirm(`Eliminare ${x.name}?`)) run(db.remove(col, x.id));
      break;
    }
  }
}

// tocco fuori da una finestra: vale solo se anche la pressione è partita fuori
// (selezionando un testo col mouse e uscendo dal riquadro la finestra non si chiude più)
let premutoSu = null;
document.addEventListener('pointerdown', e => { premutoSu = e.target; }, true);
document.addEventListener('click', e => {
  if ((e.target.id === 'infoPop' || e.target.id === 'modal') && premutoSu !== e.target) return;
  if (e.target.id === 'infoPop') { closeInfo(); return; }
  if (state.menuOpen && !e.target.closest('#menu, #menuBtn')) {
    state.menuOpen = false; render();
    if (!e.target.closest('[data-action]')) return;
  }
  if (state.addOpen && !e.target.closest('.pop-wrap')) {
    state.addOpen = false; render();
    if (!e.target.closest('[data-action]')) return;
  }
  if (e.target.closest('#menu [data-action]')) { state.menuOpen = false; renderMenu(); syncHistory(); }
  if (e.target.id === 'modal') { closeModal(); return; }
  if (e.target.closest('a[href]')) return;  // link "Chiama"
  const a = e.target.closest('[data-action]');
  if (a) { handleAction(a.dataset.action, a); return; }

  const pc = e.target.closest('#panel [data-client]');
  if (pc) {
    state.placing = state.placing === pc.dataset.client ? null : pc.dataset.client;
    if (state.placing) state.drawerOpen = false;   // si chiude il cassetto: ora si tocca il giorno
    render();
    return;
  }
  const od = e.target.closest('[data-open-day]');
  if (od) { state.drawerOpen = false; goDay(od.dataset.openDay); return; }

  const target = e.target.closest('#grid .cell[data-date], #dayView [data-date]');
  if (state.placing && target) {
    const c = clientById(state.placing);
    addCheck(state.placing, target.dataset.date);
    state.placing = null;
    render();
    if (c) toast(`${c.name} posizionato il ${fmtShort(target.dataset.date)}`);
    return;
  }
  const ev = e.target.closest('#grid [data-ev], #dayView [data-ev]');
  if (ev) { openEditor(ev.dataset.ev); return; }
  const cell = e.target.closest('#grid .cell[data-date]');
  if (cell) goDay(cell.dataset.date, cell);
});

document.addEventListener('submit', e => {
  const id = e.target.id;
  if (!['editorForm', 'clientForm', 'staffForm', 'vehForm', 'contactForm', 'contactEditForm'].includes(id)) return;
  e.preventDefault();
  if (id === 'editorForm') { saveEditor(); return; }
  if (id === 'clientForm') {
    const name = $('#clientName').value.trim();
    if (!name) return;
    if (state.clients.some(c => c.name.toLowerCase() === name.toLowerCase())) { toast('Cliente già presente'); return; }
    run(db.save('clients', { id: uid(), name, color: state.newColor, contacts: [] }));
    $('#clientName').value = '';
    $('#clientName').focus();
  }
  if (id === 'staffForm' || id === 'vehForm') {
    const col = id === 'staffForm' ? 'staff' : 'vehicles';
    const inp = id === 'staffForm' ? $('#staffName') : $('#vehName');
    const name = inp.value.trim();
    if (!name) return;
    if (state[col].some(x => x.name.toLowerCase() === name.toLowerCase())) { toast('Già presente'); return; }
    run(db.save(col, { id: uid(), name }));
    inp.value = '';
    inp.focus();
  }
  if (id === 'contactEditForm') {
    const c = clientById(state.clientOpen);
    const cid = e.target.dataset.id;
    const name = $('#ceName').value.trim(), phone = $('#cePhone').value.trim();
    if (!c || !name || !phone) return;
    state.editContact = null;
    document.activeElement?.blur();
    run(db.save('clients', { ...c, contacts: (c.contacts || []).map(k => k.id === cid ? { ...k, name, phone } : k) }));
    renderClientSheet();
    toast('Referente aggiornato');
    return;
  }
  if (id === 'contactForm') {
    const c = clientById(state.clientOpen);
    const name = $('#ctName').value.trim(), phone = $('#ctPhone').value.trim();
    if (!c || !name || !phone) return;
    run(db.save('clients', { ...c, contacts: [...(c.contacts || []), { id: uid(), name, phone }] }));
    $('#ctName').value = ''; $('#ctPhone').value = '';
    $('#ctName').focus();
  }
});

document.addEventListener('change', e => {
  if (e.target.id === 'clName') {
    const c = clientById(state.clientOpen);
    const n = e.target.value.trim();
    if (c && n && n !== c.name) run(db.save('clients', { ...c, name: n }));
  }
  if (e.target.id === 'edDate' && state.edit) {
    syncEdit();
    const eb = $('.sheet .eyebrow');
    if (eb) eb.textContent = dateLabel(state.edit.date);
  }
  if (['edDate', 'edDays', 'edWeekend'].includes(e.target.id)) updateSpanTxt();
});
document.addEventListener('input', e => { if (e.target.id === 'edDays') updateSpanTxt(); });

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (state.view === 'day' && !state.info && !state.menuOpen && !state.addOpen && !state.modal && !state.drawerOpen && !state.placing) return; // Esc non esce dal giorno
  stepBack();
});

/* ---------------- Drag & drop (computer) ---------------- */
let drag = null;
const dropTarget = el => el.closest('#grid .cell[data-date], #dayView [data-date], [data-tray]');
const clearOver = keep => document.querySelectorAll('.over').forEach(x => x !== keep && x.classList.remove('over'));

document.addEventListener('dragstart', e => {
  const ev = e.target.closest('#grid [data-ev], #dayView [data-ev]');
  const cl = e.target.closest('#panel [data-client]');
  if (ev) drag = { ev: ev.dataset.ev };
  else if (cl) drag = { client: cl.dataset.client };
  else return;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', 'lavagna');
  document.body.classList.add('dragging');
});
document.addEventListener('dragend', () => {
  drag = null;
  document.body.classList.remove('dragging');
  clearOver();
});
document.addEventListener('dragover', e => {
  if (!drag) return;
  const t = dropTarget(e.target);
  if (!t) { clearOver(); return; }
  if (t.hasAttribute('data-tray') && !(drag.ev && eventById(drag.ev)?.type === 'check')) return;
  e.preventDefault();
  clearOver(t);
  t.classList.add('over');
});
document.addEventListener('drop', e => {
  if (!drag) return;
  const t = dropTarget(e.target);
  if (!t) return;
  e.preventDefault();
  if (t.dataset.date) {
    if (drag.client) addCheck(drag.client, t.dataset.date);
    else {
      const ev = eventById(drag.ev);
      if (ev && ev.date !== t.dataset.date) updateEvent(ev, { date: t.dataset.date });
    }
  } else if (drag.ev) {
    const ev = eventById(drag.ev);
    if (ev && ev.type === 'check') run(db.remove('events', ev.id));
  }
  clearOver();
});

window.addEventListener('offline', () => { if (db?.mode === 'cloud') setStatus('offline'); });
window.addEventListener('online', () => { if (db?.mode === 'cloud') setStatus('connecting'); });

/* ============================================================
   AVVIO
   ============================================================ */
function showLogin(msg, denied) {
  closeModal();
  $('#loginMsg').innerHTML = msg;
  $('#loginBtn').hidden = denied;
  $('#loginLogout').hidden = !denied;
  $('#loginScreen').hidden = false;
}
function startData() {
  if (dataStarted) return;
  dataStarted = true;
  const carica = () => { Object.assign(state, anagraficaGestionale()); render(); };
  carica();
  // controlli rimasti legati a vecchi clienti della lavagna (non più esistenti): li tolgo una volta sola
  if (db.mode === 'local' && !lsGet('lavagna_gest_ok')) {
    try {
      const ids = new Set(state.clients.map(c => c.id));
      const ev = JSON.parse(localStorage.getItem('lavagna_events') || '[]');
      localStorage.setItem('lavagna_events', JSON.stringify(ev.filter(e => e.type !== 'check' || ids.has(e.clientId))));
    } catch {}
    lsSet('lavagna_gest_ok', '1');
  }
  const onStorage = e => { if (!e.key || e.key.startsWith('gid_demo_')) carica(); };
  window.addEventListener('storage', onStorage);
  unsubLists = [() => window.removeEventListener('storage', onStorage)];
  if (db.subscribeGest) unsubLists.push(...db.subscribeGest((k, list) => { gestCloud[k] = list; carica(); }));
  unsubLists.push(db.subscribeUnsigned(list => { state.unsigned = list; if (state.menuOpen) renderMenu(); if (state.modal === 'unsigned') renderUnsignedList(); }));
  subscribeMonth();
  render();
}
function stopData() {
  dataStarted = false;
  unsubLists.forEach(u => u && u());
  unsubLists = [];
  if (unsubEvents) { unsubEvents(); unsubEvents = null; }
  state.clients = []; state.staff = []; state.vehicles = []; state.events = []; state.unsigned = []; state.placing = null;
  render();
}

async function init() {
  render();
  const useCloud = !!(firebaseConfig && firebaseConfig.apiKey);
  setStatus(useCloud ? 'connecting' : 'local');
  try {
    db = useCloud ? await firebaseBackend(firebaseConfig) : localBackend();
  } catch (err) {
    console.error(err);
    toast('Impossibile collegarsi al cloud: uso la modalità locale');
    db = localBackend();
  }
  // modalità test del gestionale (tasto 🧪): si vedono i dati veri ma le modifiche restano su questo dispositivo
  let inTest = false; try { inTest = localStorage.getItem('gid_test') === '1'; } catch {}
  if (inTest) { db = lavagnaTest(db); const tb = $('#testBanner'); if (tb) tb.hidden = false; }
  attachLog(db);
  db.onStatus(setStatus);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  controllaVersione(); setInterval(controllaVersione, 10 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) controllaVersione(); });

  if (db.mode === 'local') {
    $('#localBanner').hidden = false;
    startData();
    return;
  }

  db.onDenied(() => {
    stopData();
    showLogin(`L'account <b>${esc(currentEmail)}</b> non è autorizzato ad usare la lavagna. Chiedi all'amministratore di aggiungerlo oppure accedi con un altro account.`, true);
  });
  db.onAuth(user => {
    if (user) {
      currentEmail = user.email || '';
      state.user = { email: currentEmail, name: user.displayName || '', photo: user.photoURL || '' };
      $('#loginScreen').hidden = true;
      startData();
    } else {
      currentEmail = '';
      state.user = null;
      state.menuOpen = false;
      stopData();
      showLogin('Accedi con il tuo account Google per vedere la lavagna.', false);
    }
  });
}
init();

/* ============================================================
   VERSIONE NUOVA: avviso a tutti con il pulsante «Aggiorna»
   (la versione pubblicata è il numero della cache in sw.js, quella in uso è il ?v= di app.js)
   ============================================================ */
var ultimoControlloVer = 0;   // var: la funzione può essere chiamata prima di questa riga
async function controllaVersione() {
  if (!location.protocol.startsWith('http') || Date.now() - ultimoControlloVer < 60000) return;
  ultimoControlloVer = Date.now();
  const mia = +((document.querySelector('script[src*="app.js?v="]')?.getAttribute('src') || '').match(/v=(\d+)/) || [])[1] || 0;
  try {
    const t = await (await fetch('./sw.js?c=' + Date.now(), { cache: 'no-store' })).text();
    const nuova = +(t.match(/lavagna-v(\d+)/) || [])[1] || 0;
    if (mia && nuova > mia) mostraAggiorna();
  } catch (e) { /* senza rete */ }
}
function mostraAggiorna() {
  if (document.getElementById('avvisoAgg')) return;
  const b = document.createElement('div'); b.id = 'avvisoAgg'; b.setAttribute('role', 'status');
  b.innerHTML = '<span class="agg-ico">⬆️</span><span class="agg-txt"><b>È uscita una versione nuova della lavagna</b><small>Tocca «Aggiorna» per usarla</small></span><button type="button" class="agg-btn">Aggiorna</button>';
  document.body.appendChild(b);
  b.querySelector('.agg-btn').onclick = async () => {
    b.querySelector('.agg-btn').textContent = 'Aggiorno…';
    try {
      const reg = await navigator.serviceWorker?.getRegistration('./');
      if (reg) await reg.update().catch(() => {});
      if (window.caches) for (const k of await caches.keys()) if (k.startsWith('lavagna')) await caches.delete(k);
    } catch (e) {}
    location.replace(location.pathname + '?agg=' + Date.now() + location.hash);
  };
}
