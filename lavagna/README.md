# Lavagna Officina – Gru Impianti

Calendario mensile condiviso dell'officina: controlli periodici (magneti giallo/verde/rosso per trimestre), lavori extra (rosso), impegni e assenze (nero). PWA installabile, offline, sincronizzata in tempo reale con Firebase.

Tutte le regole e le specifiche sono in **REGOLE-LAVAGNA.md**.

## Pubblicazione rapida (GitHub Pages)
1. Carica tutti i file (con le cartelle `icons`) nella radice del repository.
2. Settings → Pages → Deploy from a branch → `main` / `(root)` → Save.
3. Apri `https://UTENTE.github.io/NOME-REPO/` e installala dal menu del browser ("Aggiungi a schermata Home").

## Cloud o locale
- `config.js` con la configurazione Firebase → sincronizzazione tra dispositivi + login Google.
- `config.js` con `export const firebaseConfig = null;` → modalità locale (solo questo dispositivo).

## Aggiornamenti
A ogni modifica aumentare `APP_VERSION` in `app.js` e `CACHE` in `sw.js`, poi caricare i file cambiati. Sul telefono chiudere e riaprire l'app.
