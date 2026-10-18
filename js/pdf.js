// ===== PDF DAI FOGLI DI STAMPA (senza librerie esterne) =====
// Fotografa i fogli già impaginati per la stampa (scheda di controllo, elenco sottoganci, rapportino)
// e li mette in un file PDF A4, pronto da allegare a una email. Funziona anche senza rete.
window.PDFX = (function () {
  const MM = 96 / 25.4;   // pixel per millimetro (CSS)

  let cssCache = null;
  function css() {
    if (cssCache) return cssCache;
    let t = '';
    for (const sh of document.styleSheets) { try { for (const r of sh.cssRules) t += r.cssText + '\n'; } catch (e) { /* foglio non leggibile */ } }
    // sulla "foto" nessuno zoom da telefono, niente ombre
    t += '.recap,.fogli,.fogli-pv{zoom:1!important}.recap,.foglio,.foglio-p{box-shadow:none!important;margin:0!important}';
    return (cssCache = t);
  }
  const daUrl = (src) => fetch(src).then((r) => r.blob()).then((b) => new Promise((ok) => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(b); })).catch(() => src);

  // un elemento della pagina -> canvas (alla risoluzione richiesta)
  async function foto(el, scala = 2) {
    const r = el.getBoundingClientRect();
    const w = Math.ceil(el.offsetWidth || r.width), h = Math.ceil(el.scrollHeight || r.height);
    const copia = el.cloneNode(true);
    // tolgo le immagini che non si sono caricate (es. timbro non presente)
    const orig = [...el.querySelectorAll('img')];
    [...copia.querySelectorAll('img')].forEach((im, k) => { if (!orig[k] || !orig[k].naturalWidth) im.remove(); });
    // immagini incorporate (logo, firme) e valori dei campi
    await Promise.all([...copia.querySelectorAll('img')].map(async (im) => { if (im.src && !im.src.startsWith('data:')) im.setAttribute('src', await daUrl(im.src)); }));
    const st = getComputedStyle(document.body);
    const html = new XMLSerializer().serializeToString(copia);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject x="0" y="0" width="100%" height="100%">` +
      `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;font-family:${st.fontFamily.replace(/"/g, "'")};font-size:${st.fontSize};color:#111;font-feature-settings:'calt' 0;background:#fff">` +
      `<style>${css().replace(/</g, '\\3c ')}</style>${html}</div></foreignObject></svg>`;
    const img = new Image();
    await new Promise((ok, ko) => { img.onload = ok; img.onerror = () => ko(new Error('Impossibile creare l\'immagine della pagina')); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
    const cv = document.createElement('canvas'); cv.width = Math.round(w * scala); cv.height = Math.round(h * scala);
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.scale(scala, scala); ctx.drawImage(img, 0, 0);
    return cv;
  }

  // taglia un canvas troppo alto in più pagine A4
  function aPagine(cv, verticale) {
    const rapp = verticale ? 297 / 210 : 210 / 297, hPag = Math.round(cv.width * rapp);
    if (cv.height <= hPag * 1.02) return [cv];
    const out = [];
    for (let y = 0; y < cv.height; y += hPag) {
      const p = document.createElement('canvas'); p.width = cv.width; p.height = hPag;
      const x = p.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, p.width, p.height); x.drawImage(cv, 0, -y);
      out.push(p);
    }
    return out;
  }

  // ---------- scrittore PDF minimo: una immagine JPEG per pagina ----------
  const b64aByte = (b64) => { const s = atob(b64), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; };
  function pdf(canvases, verticale) {
    const enc = new TextEncoder(), parti = [], offs = [];
    let len = 0;
    const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parti.push(b); len += b.length; };
    const W = verticale ? 595.28 : 841.89, H = verticale ? 841.89 : 595.28;
    const n = canvases.length, kids = [];
    push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    const obj = (id, body) => { offs[id] = len; push(`${id} 0 obj\n`); body(); push('\nendobj\n'); };
    obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
    for (let i = 0; i < n; i++) kids.push(`${3 + i * 3} 0 R`);
    obj(2, () => push(`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${n} >>`));
    canvases.forEach((cv, i) => {
      const pid = 3 + i * 3, iid = pid + 1, cid = pid + 2;
      const jpg = b64aByte(cv.toDataURL('image/jpeg', 0.88).split(',')[1]);
      // l'immagine riempie la pagina mantenendo le proporzioni
      const k = Math.min(W / cv.width, H / cv.height), iw = cv.width * k, ih = cv.height * k;
      const stream = `q ${iw.toFixed(2)} 0 0 ${ih.toFixed(2)} 0 ${(H - ih).toFixed(2)} cm /Im${i} Do Q`;
      obj(pid, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im${i} ${iid} 0 R >> >> /Contents ${cid} 0 R >>`));
      obj(iid, () => { push(`<< /Type /XObject /Subtype /Image /Width ${cv.width} /Height ${cv.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`); push(jpg); push('\nendstream'); });
      obj(cid, () => push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`));
    });
    const tot = 3 + n * 3, xref = len;
    let x = `xref\n0 ${tot}\n0000000000 65535 f \n`;
    for (let i = 1; i < tot; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
    push(x + `trailer\n<< /Size ${tot} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    const out = new Uint8Array(len); let o = 0; parti.forEach((p) => { out.set(p, o); o += p.length; });
    return out;
  }

  // prepara i fogli fuori dallo schermo con la funzione di stampa del modulo e li trasforma in PDF
  async function daStampa(disegna, selettore, verticale) {
    const box = document.createElement('div');
    box.className = 'pdf-fuori';
    box.style.cssText = 'position:fixed;left:-20000px;top:0;width:1400px;background:#fff;';
    document.body.appendChild(box);
    try {
      disegna(box);
      await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
      box.querySelectorAll('.fogli,.fogli-pv').forEach((x) => (x.style.zoom = '1'));
      await Promise.all([...box.querySelectorAll('img')].map((im) => (im.complete ? 0 : new Promise((ok) => { im.onload = im.onerror = ok; }))));
      const fogli = [...box.querySelectorAll(selettore)];
      if (!fogli.length) throw new Error('Niente da stampare');
      const canvases = [];
      for (const f of fogli) canvases.push(...aPagine(await foto(f), verticale));
      return pdf(canvases, verticale);
    } finally { box.remove(); }
  }

  return { daStampa, foto, pdf };
})();
