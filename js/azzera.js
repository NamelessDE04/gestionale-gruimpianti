// ===== AZZERA DATI (solo Master) =====
// Cancella in un colpo i dati scelti (es. clienti, impianti, controlli, rapportini, lavagna) per ripartire puliti.
// Prima scarica SEMPRE un backup completo di quello che sta per cancellare. Utenti, firme e PIN non si toccano.
window.AZZ = (function () {
  const { esc } = UI;
  const GRUPPI = [
    { k: 'clienti', t: 'Clienti e sedi', col: ['clienti'], si: true },
    { k: 'impianti', t: 'Impianti', col: ['impianti'], si: true },
    { k: 'controlli', t: 'Controlli carriponte e gru a bandiera', col: ['schedeControllo'], si: true },
    { k: 'sottoganci', t: 'Sottoganci e loro controlli', sotto: 'sono legati alle sedi dei clienti', col: ['sottoganci', 'giriSottoganci'], si: true },
    { k: 'rapportini', t: 'Rapportini', sotto: 'la numerazione riparte da 1, si cancella anche lo storico degli invii', col: ['rapportini', 'invii', 'contatori'], si: true },
    { k: 'lavagna', t: 'Lavagna (impegni e storico)', col: ['lavagnaEventi', 'lavagnaLog'], lavagna: true, si: true },
    { k: 'collaudi', t: 'Collaudi del configuratore cablaggio', col: ['collaudi'], si: false },
    { k: 'mezzi', t: 'Mezzi e piattaforme', col: ['mezzi'], si: false }
  ];
  // lavagna senza cloud: sta nella memoria del dispositivo
  const LAV_LOCALE = { lavagnaEventi: 'lavagna_events', lavagnaLog: 'lavagna_log' };

  async function leggi(S, col) {
    if (Backend.mode !== 'cloud' && LAV_LOCALE[col]) { try { return JSON.parse(localStorage.getItem(LAV_LOCALE[col]) || '[]'); } catch (e) { return []; } }
    if (S[col] && Backend.mode !== 'cloud') return S[col];
    return Backend.leggiTutti(col);
  }
  async function svuota(col) {
    if (Backend.mode !== 'cloud' && LAV_LOCALE[col]) { localStorage.removeItem(LAV_LOCALE[col]); return; }
    await Backend.svuota(col);
  }

  function pagina(el, S) {
    if (Backend.mode === 'prova') {
      el.innerHTML = '<section class="vuoto"><h1>🎬 Sei nella dimostrazione</h1><p>Esci prima dalla dimostrazione («Torna ai nostri dati»): l\'azzeramento lavora sui vostri dati veri.</p></section>';
      return { titolo: 'Azzera dati', indietro: '#/profilo', live: false };
    }
    el.innerHTML = `
      <section class="cli azz">
        <div class="avviso-altro azz-avviso"><b>⚠️ Operazione definitiva.</b> I dati scelti vengono cancellati ${Backend.mode === 'cloud' ? 'dal cloud, quindi spariscono da <b>tutti i dispositivi</b>' : 'da questo dispositivo'}.
          Prima della cancellazione l'app scarica in automatico un <b>file di backup</b> con tutto quello che sta per togliere: conservalo.</div>
        <form class="card form" id="fAzz" novalidate>
          <h2>Cosa vuoi cancellare?</h2>
          <div class="azz-lista">
            ${GRUPPI.map((g) => `<label class="azz-voce"><input type="checkbox" name="${g.k}" ${g.si ? 'checked' : ''}><span><b>${esc(g.t)}</b>${g.sotto ? `<small>${esc(g.sotto)}</small>` : ''}</span><em class="azz-n" data-n="${g.k}"></em></label>`).join('')}
          </div>
          <p class="muted small">Non si toccano mai: utenti, PIN, firme, tablet collegati, modelli delle schede, frasi pronte e registro attività.</p>
          <label>Per confermare scrivi <b>AZZERA</b><input name="conferma" autocomplete="off" placeholder="AZZERA"></label>
          <div class="azioni-form"><a class="btn ghost" href="#/profilo">Annulla</a><span class="grow"></span><button class="btn big btn-azz" type="submit">🧹 Scarica backup e cancella</button></div>
        </form>
        <div id="azzStato"></div>
      </section>`;
    const f = el.querySelector('#fAzz');
    // quanti documenti ci sono adesso per ogni voce
    GRUPPI.forEach(async (g) => {
      try { let n = 0; for (const c of g.col) if (c !== 'contatori' && c !== 'invii' && c !== 'lavagnaLog') n += (await leggi(S, c)).length; const x = el.querySelector(`[data-n="${g.k}"]`); if (x) x.textContent = n; } catch (e) {}
    });
    f.onsubmit = async (e) => {
      e.preventDefault();
      const scelti = GRUPPI.filter((g) => f[g.k].checked);
      if (!scelti.length) return UI.toast('Scegli almeno una voce', 'err');
      if (f.conferma.value.trim().toUpperCase() !== 'AZZERA') { f.conferma.focus(); return UI.toast('Scrivi AZZERA per confermare', 'err'); }
      if (Backend.mode === 'cloud' && !navigator.onLine) return UI.toast('Serve internet per cancellare dal cloud', 'err');
      if (!UI.conferma(`Ultima conferma: cancello ${scelti.map((g) => g.t.toLowerCase()).join(', ')}?`)) return;
      const stato = el.querySelector('#azzStato'), btn = f.querySelector('[type=submit]');
      btn.disabled = true;
      const scrivi = (t) => (stato.innerHTML = `<div class="card"><p>${t}</p></div>`);
      try {
        // 1. backup di tutto quello che sta per sparire
        scrivi('💾 Preparo il backup…');
        const backup = { app: 'gestionale-gruimpianti', tipo: 'backup prima di azzeramento', versione: App.VERSIONE, esportato: new Date().toISOString() };
        for (const g of scelti) for (const c of g.col) backup[c] = await leggi(S, c);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' }));
        a.download = `backup-prima-di-azzerare-${UI.oggi()}.json`; document.body.appendChild(a); a.click(); a.remove();
        // 2. cancellazione
        for (const g of scelti) {
          scrivi(`🧹 Cancello: ${esc(g.t)}…`);
          for (const c of g.col) await svuota(c);
        }
        // conflitti in sospeso riferiti a documenti cancellati: non servono più
        await svuota('conflitti');
        UT.registra('eliminazione', 'Azzeramento dati: ' + scelti.map((g) => g.t.toLowerCase()).join(', '));
        scrivi('✅ Fatto. Il backup è nei download del dispositivo.');
        UI.toast('Dati azzerati', 'ok');
        setTimeout(() => (location.hash = '#/'), 1500);
      } catch (er) {
        console.error(er); btn.disabled = false;
        scrivi(`❌ Non sono riuscito a finire (${esc(er.message || er)}). Il backup scaricato contiene comunque i dati: riprova.`);
      }
    };
    return { titolo: 'Azzera dati', indietro: '#/profilo', live: false };
  }
  return { pagina };
})();
