// ============================================================
//  CONFIGURAZIONE SINCRONIZZAZIONE (Firebase)
// ------------------------------------------------------------
//  Dentro il GESTIONALE DEMO la lavagna lavora in MODALITÀ LOCALE
//  (dati solo su questo dispositivo), come il resto della demo,
//  così le prove non toccano la lavagna vera dell'officina.
//
//  Per collegarla alla lavagna vera (Firebase "lavagna-officina")
//  basta sostituire "null" con la configurazione qui sotto.
// ============================================================

export const firebaseConfig = null;

/* Configurazione della lavagna vera, da usare quando si passa al cloud:
{
  apiKey: "AIzaSyBqOhEWfIuuCHgRN8ohrczETO34rq3Gea8",
  authDomain: "lavagna-officina.firebaseapp.com",
  projectId: "lavagna-officina",
  storageBucket: "lavagna-officina.firebasestorage.app",
  messagingSenderId: "657601992823",
  appId: "1:657601992823:web:a9b627a7d3753728f58e72"
}
*/
