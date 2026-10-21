# Lavagna Officina – Regole e specifiche (versione 20)

Documento di riferimento per integrare la **Lavagna Officina** di Gru Impianti in un'altra app (es. il gestionale demo) **senza perdere nessun comportamento**. Descrive cosa fa la lavagna, come lo fa e quali regole vanno rispettate.

---

## 1. Cos'è

È l'equivalente digitale della lavagna magnetica dell'officina: un **calendario mensile** dove il titolare pianifica:

- i **controlli periodici** presso i clienti → "magneti" colorati per trimestre;
- i **lavori extra** → testo **rosso** (come il pennarello rosso);
- gli **impegni / assenze** in orario di lavoro (permessi, visite mediche…) → testo **nero**.

È una PWA (si installa sul telefono/tablet/PC dal browser), funziona anche offline e, collegata a Firebase, si sincronizza in tempo reale tra tutti i dispositivi.

---

## 2. File del progetto

| File | Contenuto |
|---|---|
| `index.html` | Struttura della pagina: barra in alto, calendario, cassetto magneti, finestre, login |
| `app.js` | Tutta la logica (≈1.700 righe, JavaScript senza framework, modulo ES) |
| `style.css` | Grafica, versione telefono, stampa PDF |
| `config.js` | Configurazione Firebase. **Se `firebaseConfig = null` l'app va in modalità locale** |
| `sw.js` | Service worker: funzionamento offline e aggiornamenti (`CACHE = 'lavagna-vNN'`) |
| `manifest.json` | Dati per l'installazione come app (nome, colori, icone) |
| `logo.png` | Logo Gru Impianti (barra in alto, login, PDF) |
| `icons/` | Icone app: `icon-192/512`, `maskable-192/512` (Android), `apple-touch-icon` (iPhone), `favicon-64` |
| `README.md` | Guida rapida di pubblicazione |

**Versione:** costante `APP_VERSION` in `app.js` (mostrata in fondo al menu ☰) e `CACHE` in `sw.js`. **A ogni modifica vanno aumentate entrambe**, altrimenti i dispositivi tengono la versione vecchia.

---

## 3. Architettura

- **Backend intercambiabile**: `localBackend()` (localStorage, solo questo dispositivo) e `firebaseBackend()` (Firestore + login Google) espongono **le stesse funzioni**:
  `subscribe(collezione, cb)`, `subscribeEvents(da, a, cb)`, `subscribeUnsigned(cb)`, `save(collezione, oggetto)`, `remove(collezione, id)`, `addLog(voce)`, `subscribeLog(cb)` + per Firebase `login()`, `logout()`, `onAuth()`, `onStatus()`, `onDenied()`.
  → Il resto dell'app non sa dove sono i dati. Per passare da locale a cloud basta compilare `config.js`.
- **Tempo reale**: ogni modifica di un dispositivo arriva agli altri in pochi secondi (listener `onSnapshot`).
- **Offline**: Firestore con cache persistente; le modifiche fatte senza rete partono da sole al ritorno della connessione. Il service worker rende l'app apribile anche senza rete.
- **Registro modifiche**: ogni `save`/`remove` passa da `attachLog()` che scrive automaticamente nello storico (vedi §12).
- **Librerie**: solo Firebase JS SDK 10.12.2 caricato da `gstatic.com`. Nessuna altra dipendenza; il PDF si fa con la stampa del browser.

---

## 4. Dati (collezioni)

### `clients` – Clienti
| Campo | Tipo | Note |
|---|---|---|
| `name` | testo | Nome ditta (mostrato in MAIUSCOLO) |
| `color` | `yellow` / `green` / `red` | Trimestre di controllo (vedi §5) |
| `contacts` | lista `{id, name, phone}` | Referenti, modificabili, con pulsante 📞 Chiama |

### `staff` – Dipendenti
`{ name }` — compaiono in **blu**.

### `vehicles` – Mezzi
`{ name }` — compaiono in **verde**.

### `events` – Voci della lavagna
| Campo | Tipo | Note |
|---|---|---|
| `type` | `check` / `extra` / `pers` | Controllo periodico / Lavoro extra / Impegno-assenza |
| `date` | `AAAA-MM-GG` | Giorno di inizio |
| `time` | `HH:MM` o vuoto | Ora facoltativa |
| `clientId` | id cliente | Solo per `check` |
| `text` | testo | Per `check` = nota facoltativa; per `extra`/`pers` = descrizione obbligatoria |
| `staffIds` | lista id | Chi va (più persone) |
| `vehicleIds` | lista id | Con quali mezzi (più mezzi). Non usato per `pers` |
| `days` | numero ≥1 | Durata in giorni (max 31) |
| `weekend` | sì/no | Se sì, sabato e domenica contano nella durata |
| `unsigned` | sì / assente | ✱ Rapportino da firmare (solo `check` ed `extra`) |
| `updatedAt` | timestamp | Ultima modifica |

Compatibilità: le voci vecchie possono avere `vehicleId` (un solo mezzo) o `done` (spunta eseguito, ora ignorata). L'app le legge correttamente.

### `log` – Storico modifiche
`{ ts, action (create/update/delete/restore), col, docId, by (email), byName, label, changes[], before, after, clientEvents? }`

---

## 5. Regole dei colori (trimestri)

| Colore | Mese del trimestre | Mesi |
|---|---|---|
| **Giallo** | 1° | Gen · Apr · Lug · Ott |
| **Verde** | 2° | Feb · Mag · Ago · Nov |
| **Rosso** | 3° | Mar · Giu · Set · Dic |

Calcolo: `colore del mese = ['yellow','green','red'][mese % 3]` (mese 0 = gennaio).

---

## 6. Calendario mensile

- **All'avvio si apre sempre il mese corrente** (vista mese), qualunque vista si usasse prima.
- Griglia Lun→Dom, settimane del mese, giorno di oggi evidenziato, weekend leggermente grigio.
- In alto: frecce ‹ › per cambiare mese, **Oggi**, menu **☰**. Sopra il calendario: "Controlli del mese: [colore]", pulsante **Magneti** (con il numero dei clienti da pianificare) e **i**.
- Ordine dentro una casella: prima le prosecuzioni di lavori iniziati nei giorni precedenti, poi controlli, lavori extra, impegni (ordinati per ora).
- **Tocca un giorno** → si apre la vista giorno (§8). **Tocca una voce** → si apre la sua scheda (§9).

### Come appare una voce
- **Controllo**: magnete colorato con il nome del cliente (eventuale ora davanti).
  - Se ha una **nota** → subito dopo il magnete compare **"+ nota" in rosso**. Il **"+" rosso è automatico** (l'utente scrive solo la nota; se scrive già "+" non viene raddoppiato). Se la nota è lunga va a capo sotto; il magnete non viene mai tagliato.
- **Lavoro extra**: testo rosso (grassetto). **Impegno**: testo nero.
- Sotto la voce: **persone in blu**, **mezzi in verde** (su telefono nascosti nel mese per spazio, visibili nel giorno).
- **✱ cerchiato rosso** subito dopo il nome del cliente o del lavoro extra = rapportino non ancora firmato (§11).

### Controlli "fatti"
Non esiste una spunta "eseguito": **un controllo in un giorno già passato si considera fatto** automaticamente (per i lavori di più giorni: dopo l'ultimo giorno).

---

## 7. Lavori su più giorni (frecce)

- Nella scheda di una voce: **Durata (giorni)** con − / + (1–31). Sotto compare "Dal X al Y".
- **Sabato e domenica vengono saltati** salvo spunta "Conta anche sabato e domenica" (che compare solo se la durata è ≥ 2).
- Sulla lavagna: dal magnete (o dal testo) parte una **linea dello stesso colore** (giallo/verde/rosso per i controlli, rosso per lavori extra, nero per impegni).
- Nei giorni successivi compare **solo la freccia, senza ripetere il nome**.
- La freccia è **sempre allineata in altezza** al magnete di partenza (le altre voci di quel giorno scendono se serve). Funzione `alignArrows()`, rieseguita a ogni ridisegno e al ridimensionamento.
- Nei giorni intermedi la linea attraversa tutta la casella; **nell'ultimo giorno si ferma a metà casella con la punta ▶**, così non sembra proseguire.
- Se il lavoro va oltre la settimana, riparte dall'inizio della riga sotto. Funziona a cavallo tra due mesi (si caricano anche ~41 giorni prima del mese visibile).
- Se la voce ha una nota ed è di più giorni, la nota va **sotto** il magnete (per tenere la freccia dritta).
- Spostando il giorno di partenza, tutta la freccia si sposta.

---

## 8. Vista giorno

Si apre toccando un giorno (con effetto **zoom** dalla casella toccata). In alto le frecce passano al giorno prima/dopo.

Barra: **‹ Mese** · selettore **Casella / Elenco** · **+ Aggiungi** · **Magneti** · **i**. La scelta Casella/Elenco viene ricordata sul dispositivo.

- **Casella**: la casella del mese ingrandita, identica alla lavagna ma leggibile. Le frecce in arrivo mostrano un piccolo testo grigio "NOME · dal X" (solo qui); i lavori che proseguono mostrano "fino al X".
- **Elenco**: tre sezioni (Controlli periodici / Lavori extra / Impegni e assenze) con schede: persone e mezzi come etichette, nota, ✱, "Dura N giorni" o "Continua dal X · giorno 2 di 3", **pulsanti 📞 dei referenti** del cliente, "Tecnico e mezzo da assegnare" se mancano.
- **+ Aggiungi** apre la scelta: Controllo periodico / Lavoro extra / Impegno-assenza.

---

## 9. Scheda di una voce (editor)

Campi: (tipo, solo per nuove annotazioni) · cliente (per controlli nuovi; elenco con prima "Da controllare questo mese") · Data · Ora · Durata · Nota/Descrizione · **Chi va** (più persone, blu) · **Mezzo** (più mezzi, verde; non per impegni) · Referenti cliccabili · Elimina / Annulla / Salva.

In alto a destra (solo controlli e lavori extra): **i** + pulsante **✱** (grigio tratteggiato → rosso cerchiato quando attivo). Con ✱ attivo compare la fascia "Rapportino da firmare · Firmato, togli".

---

## 10. Magneti del mese (cassetto)

Si apre con il pulsante **Magneti** (da sinistra su PC, dal basso su telefono). Contiene i clienti del colore del mese:

- **Da pianificare** (nessun controllo nel mese) → magneti da posizionare;
- **Pianificati** (con data futura) → con le date;
- **Fatti** (tutte le date passate);
- **Altri clienti** (altri colori, per controlli fuori programma).

Posizionare: **tocca il magnete → il cassetto si chiude → tocca il giorno** (barra "Tocca un giorno per posizionare · Annulla"). Da PC anche **trascinamento**. Trascinare una voce su un altro giorno la sposta; trascinare un controllo nel cassetto lo toglie.

---

## 11. Rapportini da firmare (✱)

- Si attiva dalla scheda della voce (pulsante ✱), solo per controlli e lavori extra. Non è un campo da compilare ogni volta: è un'eccezione.
- Sulla lavagna, nel giorno, nel PDF e nel registro compare l'**asterisco rosso cerchiato** (nel registro: "✱ (rapportino da firmare)").
- Nel menu ☰ compare **"✱ Rapportini da firmare (N)"** solo se ce n'è almeno uno: elenco di **tutti** quelli in sospeso (anche mesi passati), con **Firmato** per toglierlo o tocco per aprire la voce.

---

## 12. Storico modifiche (solo amministratore)

- Visibile **solo** all'account `vaisittiluca@gmail.com` (costante `ADMIN_EMAILS` in `app.js`; in modalità locale è sempre visibile).
- Ogni aggiunta/modifica/spostamento/eliminazione (voci, clienti, referenti, dipendenti, mezzi) viene registrata con **chi, quando, cosa è cambiato** (es. "spostato dal 13 ott al 15 ott", "persone: nessuno → Luca").
- Ricerca per testo, filtro Eliminazioni/Modifiche, raggruppamento per giorno.
- **Ripristina** (voce eliminata, anche cliente + suoi controlli) e **Torna com'era** (annulla una modifica).
- Le regole Firestore impediscono a chiunque di modificare o cancellare lo storico.

---

## 13. Menu ☰ e interfaccia

- Il menu si apre solo quando richiesto: account e stato sincronizzazione · Anagrafica (Clienti e referenti, Dipendenti, Mezzi) · ✱ Rapportini da firmare (se presenti) · PDF del mese · Registro per Excel · Storico modifiche (solo admin) · Esci · Versione.
- **Pallino stato** sull'angolo del pulsante ☰: verde = sincronizzato, giallo = offline in attesa, rosso = errore, grigio = locale.
- **Nessuna scritta di istruzioni sempre visibile**: tutte le spiegazioni stanno dietro le **i** (calendario, giorno, magneti, durata, ✱, anagrafiche, storico). Le spiegazioni sono nell'oggetto `INFO` in `app.js`.
- **Anagrafica**: Clienti (nome + colore; tocco → scheda con nome, colore, referenti aggiungibili/modificabili ✎/eliminabili, Elimina cliente) · Dipendenti · Mezzi (tocco sul nome = rinomina, ✕ = elimina).
- **Tasto indietro del telefono**, un passo alla volta: chiude info → menu → scheda aperta → cassetto → annulla posizionamento → dal giorno torna al mese → esce dall'app. Esc da tastiera fa lo stesso (senza uscire dal giorno).

---

## 14. PDF del mese ed Excel

- **PDF** (menu ☰ → PDF del mese): finestra di stampa del browser → "Salva come PDF". **A4 orizzontale**, nome file `Lavagna_Mese_Anno`, logo in alto su ogni pagina.
  1. **Pagina 1 – Lavagna**: calendario del mese come sullo schermo (magneti pieni, note "+", ✱, persone blu, mezzi verdi, frecce allineate che si fermano a metà dell'ultimo giorno), legenda.
  2. **Pagina 2 – Registro attività**: riepilogo controlli del mese (clienti in calendario / non pianificati con nomi) + tabella: Data · Giorno · Tipo · Cliente/descrizione · Ora · Tecnici · Mezzo.
- **Excel** (Registro per Excel): file CSV (separatore `;`, UTF-8 con BOM) con le stesse colonne del registro. Le voci di più giorni riportano "dal → al (N gg)".

---

## 15. Accesso e sicurezza (Firebase)

- Dentro il gestionale usa il progetto Firebase `gestionale-gruimpianti` (lo stesso del gestionale), login con Google.
- Utenti ammessi (regole Firestore): `vaisittiluca@gmail.com`, `cau.gruimpianti@gmail.com`, `andretricca@gmail.com`, `fabiorosa004@gmail.com`. Un account non in elenco vede "account non autorizzato".
- Regole in vigore:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function squadra() {
      return request.auth != null && request.auth.token.email in [
        'vaisittiluca@gmail.com', 'cau.gruimpianti@gmail.com',
        'andretricca@gmail.com', 'fabiorosa004@gmail.com'
      ];
    }
    function admin() {
      return request.auth != null && request.auth.token.email == 'vaisittiluca@gmail.com';
    }
    match /clients/{id}  { allow read, write: if squadra(); }
    match /staff/{id}    { allow read, write: if squadra(); }
    match /vehicles/{id} { allow read, write: if squadra(); }
    match /events/{id}   { allow read, write: if squadra(); }
    match /log/{id} {
      allow create: if squadra();
      allow read: if admin();
      allow update, delete: if false;
    }
  }
}
```

- **Per la demo locale** (un solo dispositivo, senza cloud): mettere `export const firebaseConfig = null;` in `config.js`. Niente login, dati nel browser del dispositivo, storico sempre visibile.
- Limiti gratuiti indicativi: 1 GB dati, 50.000 letture e 20.000 scritture al giorno. Nessun addebito possibile senza piano Blaze.

---

## 16. Grafica

- Colori: barra `#1f2a37`; giallo `#f3c623`, verde `#2e9b5b`, rosso `#e0464b`; pennarello rosso `#d1242f`; tecnici `#1f5fbf` (blu); mezzi `#1b8a4b` (verde); accento `#1f5fbf`.
- Font di sistema, angoli arrotondati, magneti con leggera ombra in basso, testo magneti MAIUSCOLO.
- Telefono (≤ 600 px): calendario compatto, persone/mezzi nascosti nel mese, cassetto e finestre dal basso.

---

## 17. Regole di lavoro con Luca

- Spiegazioni in italiano, passo passo, semplici.
- **Lavagna**: a ogni modifica consegnare **solo i file cambiati** (non lo zip), indicando la cartella e il numero di versione da controllare nel menu ☰.
- **Gestionale demo**: a ogni modifica consegnare **lo zip completo**.
- Prima di consegnare: provare su PC e telefono e mostrare un'anteprima.
- Ogni pacchetto contiene già tutte le modifiche precedenti: aumentare sempre `APP_VERSION` e `CACHE`.
