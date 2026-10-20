// ===== CONFIGURAZIONE =====
// firebaseConfig = null  → i dati restano SOLO su questo dispositivo (localStorage).
// firebaseConfig compilato → i dati sono nel cloud (Firebase) e si sincronizzano tra tutti i dispositivi.
window.firebaseConfig = {
  apiKey: 'AIzaSyCt_bBq9_4jJiNH1Gyl1cTd8_3RJC_0WV0',
  authDomain: 'gestionale-gruimpianti.firebaseapp.com',
  projectId: 'gestionale-gruimpianti',
  storageBucket: 'gestionale-gruimpianti.firebasestorage.app',
  messagingSenderId: '724677009917',
  appId: '1:724677009917:web:518fbe827adadf595b7994'
};

// Account Google con cui si prepara il cloud la prima volta.
// Il primo è Developer, il secondo Master: lo sono anche nelle regole di sicurezza di Firebase (servono per partire).
// Dopo, i livelli si cambiano dall'app: Utenti → scegli la persona.
window.UTENTI_INIZIALI = [
  { google: 'vaisittiluca@gmail.com', ruolo: 'developer' },
  { google: 'cau.gruimpianti@gmail.com', ruolo: 'master' },
  { google: 'andretricca@gmail.com', ruolo: 'tecnico' },
  { google: 'fabiorosa004@gmail.com', ruolo: 'tecnico' }
];

// La Lavagna Officina è dentro il gestionale (cartella "lavagna/").
// Lasciare null; mettere un indirizzo solo per aprire una lavagna esterna.
window.LAVAGNA_URL = null;
