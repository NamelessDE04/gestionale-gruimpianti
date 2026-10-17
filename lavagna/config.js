// ============================================================
//  CONFIGURAZIONE SINCRONIZZAZIONE (Firebase)
// ------------------------------------------------------------
//  Dentro il GESTIONALE la lavagna usa lo STESSO cloud del gestionale
//  (progetto Firebase "gestionale-gruimpianti"): stesso accesso Google,
//  stesse anagrafiche, voci condivise tra tutti i dispositivi.
//  NON tocca la lavagna vera dell'officina ("lavagna-officina"),
//  la cui configurazione resta qui sotto solo come promemoria.
// ============================================================

export const firebaseConfig = {
  apiKey: 'AIzaSyCt_bBq9_4jJiNH1Gyl1cTd8_3RJC_0WV0',
  authDomain: 'gestionale-gruimpianti.firebaseapp.com',
  projectId: 'gestionale-gruimpianti',
  storageBucket: 'gestionale-gruimpianti.firebasestorage.app',
  messagingSenderId: '724677009917',
  appId: '1:724677009917:web:518fbe827adadf595b7994'
};

/* Configurazione della lavagna VERA dell'officina (NON usarla qui):
{
  apiKey: "AIzaSyBqOhEWfIuuCHgRN8ohrczETO34rq3Gea8",
  authDomain: "lavagna-officina.firebaseapp.com",
  projectId: "lavagna-officina",
  storageBucket: "lavagna-officina.firebasestorage.app",
  messagingSenderId: "657601992823",
  appId: "1:657601992823:web:a9b627a7d3753728f58e72"
}
*/
