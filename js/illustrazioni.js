// ===== ILLUSTRAZIONI DELLE CASELLE (SVG disegnati a mano, nessun file esterno) =====
window.ILL = (function () {
  const N = '#16324f', Y = '#f2b705', O = '#e07a1f', G = '#9fb0c3', L = '#dfe7f0', W = '#ffffff', V = '#2e9e5b', R = '#d6453d';
  const svg = (inner) => `<svg viewBox="0 0 160 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;

  return {

    // GHO ELIGIO: il loro logo (immagine fornita da loro, usata con il loro permesso)
    gho: '<img class="tile-logo" src="img/gho-logo.png" alt="GHO ELIGIO">',
    // registro delle ore: cartellina con orologio
    registroOre: svg(`
      <ellipse cx="80" cy="110" rx="52" ry="5" fill="${L}"/>
      <rect x="30" y="14" width="66" height="88" rx="6" fill="${W}" stroke="${N}" stroke-width="3"/>
      <rect x="48" y="8" width="30" height="12" rx="4" fill="${G}" stroke="${N}" stroke-width="3"/>
      <g stroke="${N}" stroke-width="3" stroke-linecap="round"><line x1="42" y1="36" x2="84" y2="36"/><line x1="42" y1="50" x2="76" y2="50"/><line x1="42" y1="64" x2="70" y2="64"/></g>
      <circle cx="104" cy="76" r="24" fill="${Y}" stroke="${N}" stroke-width="4"/><circle cx="104" cy="76" r="18" fill="${W}" stroke="${N}" stroke-width="2"/>
      <path d="M104 64 v12 l9 6" fill="none" stroke="${O}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`),

    // controlli approfonditi: cartella con lente
    approfonditi: svg(`
      <ellipse cx="80" cy="110" rx="52" ry="5" fill="${L}"/>
      <rect x="34" y="14" width="66" height="88" rx="6" fill="${W}" stroke="${N}" stroke-width="3"/>
      <rect x="52" y="8" width="30" height="12" rx="4" fill="${Y}" stroke="${N}" stroke-width="3"/>
      <g stroke="${N}" stroke-width="3" stroke-linecap="round"><line x1="46" y1="36" x2="86" y2="36"/><line x1="46" y1="50" x2="80" y2="50"/><line x1="46" y1="64" x2="72" y2="64"/></g>
      <circle cx="104" cy="74" r="20" fill="${L}" stroke="${N}" stroke-width="5"/><circle cx="104" cy="74" r="11" fill="${W}" stroke="${O}" stroke-width="3"/>
      <line x1="118" y1="89" x2="134" y2="105" stroke="${N}" stroke-width="8" stroke-linecap="round"/>`),
    // gancio a C / pinza
    pinza: svg(`
      <ellipse cx="80" cy="110" rx="50" ry="5" fill="${L}"/>
      <line x1="80" y1="2" x2="80" y2="14" stroke="${G}" stroke-width="3"/>
      <circle cx="80" cy="20" r="8" fill="none" stroke="${N}" stroke-width="5"/>
      <path d="M56 30 h52 v14 h-36 v38 h36 v14 h-52 z" fill="${O}" stroke="${N}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M108 82 h10 v14 h-10" fill="${Y}" stroke="${N}" stroke-width="3" stroke-linejoin="round"/>
      <rect x="80" y="54" width="44" height="18" rx="3" fill="${G}" stroke="${N}" stroke-width="3"/>
      <text x="102" y="67" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="9" fill="${N}">C</text>`),
    // magnete a leva
    magnete: svg(`
      <ellipse cx="80" cy="110" rx="52" ry="5" fill="${L}"/>
      <line x1="80" y1="2" x2="80" y2="14" stroke="${G}" stroke-width="3"/>
      <path d="M68 34 v-14 a12 12 0 0 1 24 0 v14" fill="none" stroke="${N}" stroke-width="5"/>
      <rect x="40" y="34" width="80" height="44" rx="5" fill="${N}"/>
      <rect x="40" y="78" width="80" height="14" fill="${G}" stroke="${N}" stroke-width="3"/>
      <line x1="80" y1="78" x2="80" y2="92" stroke="${N}" stroke-width="3"/>
      <path d="M112 44 l26 -18" stroke="${Y}" stroke-width="7" stroke-linecap="round"/><circle cx="112" cy="44" r="5" fill="${Y}" stroke="${N}" stroke-width="2"/>
      <text x="60" y="62" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="12" fill="${R}">N</text>
      <text x="100" y="62" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="12" fill="${W}">S</text>`),
    // carrucola e fune
    fune: svg(`
      <ellipse cx="80" cy="110" rx="50" ry="5" fill="${L}"/>
      <rect x="54" y="6" width="52" height="10" rx="3" fill="${G}" stroke="${N}" stroke-width="3"/>
      <line x1="64" y1="16" x2="64" y2="30" stroke="${N}" stroke-width="4"/><line x1="96" y1="16" x2="96" y2="30" stroke="${N}" stroke-width="4"/>
      <circle cx="80" cy="46" r="24" fill="${W}" stroke="${N}" stroke-width="4"/><circle cx="80" cy="46" r="16" fill="none" stroke="${O}" stroke-width="5"/><circle cx="80" cy="46" r="4" fill="${N}"/>
      <path d="M56 46 V104 M104 46 V104" stroke="${Y}" stroke-width="5" fill="none"/>
      <g stroke="${N}" stroke-width="1.5"><line x1="54" y1="60" x2="58" y2="64"/><line x1="54" y1="72" x2="58" y2="76"/><line x1="54" y1="84" x2="58" y2="88"/><line x1="102" y1="60" x2="106" y2="64"/><line x1="102" y1="72" x2="106" y2="76"/><line x1="102" y1="84" x2="106" y2="88"/></g>`),
    // bozzello con gancio
    bozzello: svg(`
      <ellipse cx="80" cy="110" rx="50" ry="5" fill="${L}"/>
      <line x1="66" y1="2" x2="66" y2="22" stroke="${Y}" stroke-width="4"/><line x1="94" y1="2" x2="94" y2="22" stroke="${Y}" stroke-width="4"/>
      <rect x="50" y="18" width="60" height="38" rx="10" fill="${O}" stroke="${N}" stroke-width="3"/>
      <circle cx="80" cy="37" r="11" fill="${W}" stroke="${N}" stroke-width="3"/><circle cx="80" cy="37" r="3" fill="${N}"/>
      <rect x="74" y="56" width="12" height="12" fill="${G}" stroke="${N}" stroke-width="3"/>
      <path d="M80 68 v10 c0 22 -28 22 -28 4 l8 -2 c0 9 12 9 12 -4 v-8" fill="${N}" stroke="${N}" stroke-width="3" stroke-linejoin="round"/>`),
    // indagine: foglio e lente
    indagine: svg(`
      <ellipse cx="80" cy="110" rx="52" ry="5" fill="${L}"/>
      <path d="M36 10 h52 l18 18 v74 h-70 z" fill="${W}" stroke="${N}" stroke-width="3" stroke-linejoin="round"/><path d="M88 10 v18 h18" fill="${L}" stroke="${N}" stroke-width="3" stroke-linejoin="round"/>
      <g font-family="system-ui,sans-serif" font-weight="800" font-size="9" fill="${N}"><text x="44" y="44">a)</text><text x="44" y="60">b)</text><text x="44" y="76">c)</text></g>
      <g stroke="${G}" stroke-width="3" stroke-linecap="round"><line x1="58" y1="41" x2="84" y2="41"/><line x1="58" y1="57" x2="80" y2="57"/><line x1="58" y1="73" x2="76" y2="73"/></g>
      <circle cx="104" cy="70" r="18" fill="none" stroke="${O}" stroke-width="6"/><line x1="117" y1="83" x2="134" y2="100" stroke="${N}" stroke-width="8" stroke-linecap="round"/>`),
    // raccoglitore con dentro le altre sezioni
    altro: svg(`
      <ellipse cx="80" cy="108" rx="54" ry="6" fill="${L}"/>
      <path d="M26 30a6 6 0 0 1 6-6h28l8 8h60a6 6 0 0 1 6 6v58a6 6 0 0 1-6 6H32a6 6 0 0 1-6-6z" fill="${Y}" stroke="${N}" stroke-width="3" stroke-linejoin="round"/>
      <rect x="40" y="44" width="34" height="22" rx="4" fill="${W}" stroke="${N}" stroke-width="2.5"/><rect x="86" y="44" width="34" height="22" rx="4" fill="${W}" stroke="${N}" stroke-width="2.5"/>
      <rect x="40" y="72" width="34" height="18" rx="4" fill="${W}" stroke="${N}" stroke-width="2.5"/><rect x="86" y="72" width="34" height="18" rx="4" fill="${W}" stroke="${N}" stroke-width="2.5"/>
      <circle cx="57" cy="55" r="5" fill="${O}"/><path d="M96 60 l7 -9 l7 9z" fill="${G}"/><rect x="48" y="78" width="18" height="6" rx="2" fill="${V}"/><rect x="94" y="78" width="18" height="6" rx="2" fill="${N}"/>`),

    // pianta dall'alto: capannone a campate, corsia, carriponte e gru a bandiera
    layout: svg(`
      <ellipse cx="80" cy="108" rx="54" ry="6" fill="${L}"/>
      <rect x="30" y="10" width="100" height="92" rx="3" fill="${W}" stroke="${N}" stroke-width="3"/>
      <g stroke="${N}" stroke-width="2"><line x1="55" y1="10" x2="55" y2="102"/><line x1="80" y1="10" x2="80" y2="102"/><line x1="105" y1="10" x2="105" y2="102"/></g>
      <rect x="31.5" y="52" width="97" height="9" fill="${L}"/>
      <g fill="${Y}" stroke="${N}" stroke-width="1.6"><rect x="34" y="24" width="18" height="4"/><rect x="33" y="21" width="2.5" height="10"/><rect x="50.5" y="21" width="2.5" height="10"/>
        <rect x="84" y="78" width="18" height="4"/><rect x="83" y="75" width="2.5" height="10"/><rect x="100.5" y="75" width="2.5" height="10"/></g>
      <path d="M112 90 L112 72 L124 72" fill="none" stroke="${O}" stroke-width="3"/>
      <circle cx="68" cy="32" r="6" fill="${W}" stroke="${N}" stroke-width="2"/><path d="M68 28 v8 M64 32 h8" stroke="${R}" stroke-width="2"/>
      <path d="M80 2 v8" stroke="${V}" stroke-width="3"/><path d="M75 6 l5 6 l5 -6z" fill="${V}"/>`),

    rapportini: svg(`
      <ellipse cx="80" cy="108" rx="52" ry="6" fill="${L}"/>
      <rect x="44" y="16" width="64" height="88" rx="7" fill="${W}" stroke="${N}" stroke-width="3"/>
      <rect x="62" y="9" width="28" height="15" rx="4" fill="${N}"/>
      <circle cx="76" cy="16" r="2.5" fill="${Y}"/>
      <g stroke="${G}" stroke-width="3.5" stroke-linecap="round">
        <line x1="54" y1="38" x2="98" y2="38"/><line x1="54" y1="49" x2="92" y2="49"/>
        <line x1="54" y1="60" x2="98" y2="60"/><line x1="54" y1="71" x2="84" y2="71"/>
      </g>
      <path d="M54 92 c4 -12 8 -12 10 -2 s6 6 9 -4 s5 -6 8 2 l10 -3" fill="none" stroke="${O}" stroke-width="3" stroke-linecap="round"/>
      <g transform="rotate(38 120 64)">
        <rect x="114" y="30" width="12" height="50" rx="3" fill="${Y}" stroke="${N}" stroke-width="2.5"/>
        <rect x="114" y="30" width="12" height="9" rx="2" fill="${N}"/>
        <path d="M114 80 l6 12 l6 -12z" fill="${W}" stroke="${N}" stroke-width="2.5" stroke-linejoin="round"/>
      </g>`),

    schede: svg(`
      <ellipse cx="80" cy="108" rx="54" ry="6" fill="${L}"/>
      <rect x="34" y="14" width="70" height="90" rx="6" fill="${W}" stroke="${N}" stroke-width="3"/>
      <g stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <rect x="44" y="27" width="12" height="12" rx="2" stroke="${N}"/><path d="M46 33 l3 3 l6 -8" stroke="${V}"/>
        <rect x="44" y="47" width="12" height="12" rx="2" stroke="${N}"/><path d="M46 53 l3 3 l6 -8" stroke="${V}"/>
        <rect x="44" y="67" width="12" height="12" rx="2" stroke="${N}"/><path d="M47 70 l6 6 M53 70 l-6 6" stroke="${R}"/>
        <line x1="63" y1="33" x2="92" y2="33" stroke="${G}" stroke-width="3.5"/>
        <line x1="63" y1="53" x2="88" y2="53" stroke="${G}" stroke-width="3.5"/>
        <line x1="63" y1="73" x2="92" y2="73" stroke="${G}" stroke-width="3.5"/>
      </g>
      <circle cx="108" cy="76" r="17" fill="${W}" fill-opacity=".75" stroke="${N}" stroke-width="5"/>
      <line x1="120" y1="88" x2="134" y2="102" stroke="${N}" stroke-width="8" stroke-linecap="round"/>
      <line x1="122" y1="90" x2="133" y2="101" stroke="${Y}" stroke-width="3.5" stroke-linecap="round"/>`),

    invio: svg(`
      <ellipse cx="80" cy="108" rx="60" ry="6" fill="${L}"/>
      <rect x="40" y="14" width="44" height="56" rx="3" fill="${W}" stroke="${N}" stroke-width="3" transform="rotate(-10 62 42)"/>
      <rect x="62" y="10" width="44" height="56" rx="3" fill="${W}" stroke="${N}" stroke-width="3" transform="rotate(8 84 38)"/>
      <g stroke="${G}" stroke-width="3" stroke-linecap="round" transform="rotate(8 84 38)"><path d="M70 22h28M70 31h28M70 40h18"/></g>
      <rect x="28" y="50" width="104" height="56" rx="6" fill="${Y}" stroke="${N}" stroke-width="3"/>
      <path d="M30 54 L80 86 L130 54" fill="none" stroke="${N}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M30 104 L66 77 M130 104 L94 77" stroke="${N}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="128" cy="52" r="13" fill="${V}" stroke="${N}" stroke-width="3"/>
      <path d="M121 52 l5 5 9 -10" fill="none" stroke="${W}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`),

    clienti: svg(`
      <ellipse cx="80" cy="108" rx="60" ry="6" fill="${L}"/>
      <path d="M22 104 V58 l18 -12 v12 l18 -12 v12 l18 -12 v12 l18 -12 V104z" fill="${W}" stroke="${N}" stroke-width="3" stroke-linejoin="round"/>
      <rect x="96" y="26" width="10" height="36" fill="${N}"/>
      <path d="M99 22 c-4 -6 6 -8 3 -14 M104 22 c3 -5 -4 -8 1 -13" fill="none" stroke="${G}" stroke-width="2.5" stroke-linecap="round"/>
      <g fill="${Y}"><rect x="30" y="70" width="12" height="10" rx="1.5"/><rect x="48" y="70" width="12" height="10" rx="1.5"/><rect x="66" y="70" width="12" height="10" rx="1.5"/></g>
      <rect x="44" y="88" width="20" height="16" fill="${N}"/>
      <circle cx="122" cy="62" r="11" fill="${Y}" stroke="${N}" stroke-width="3"/>
      <path d="M102 104 c0 -18 8 -27 20 -27 s20 9 20 27z" fill="${N}"/>
      <rect x="116" y="84" width="12" height="9" rx="2" fill="${W}"/>`),

    impianti: svg(`
      <ellipse cx="80" cy="110" rx="62" ry="5" fill="${L}"/>
      <rect x="18" y="20" width="8" height="88" fill="${N}"/><rect x="134" y="20" width="8" height="88" fill="${N}"/>
      <rect x="12" y="20" width="136" height="14" rx="2" fill="${Y}" stroke="${N}" stroke-width="3"/>
      <g stroke="${N}" stroke-width="2"><line x1="28" y1="22" x2="38" y2="32"/><line x1="48" y1="22" x2="58" y2="32"/><line x1="102" y1="22" x2="112" y2="32"/><line x1="122" y1="22" x2="132" y2="32"/></g>
      <rect x="66" y="34" width="28" height="13" rx="2" fill="${N}"/>
      <circle cx="72" cy="34" r="3" fill="${W}"/><circle cx="88" cy="34" r="3" fill="${W}"/>
      <line x1="76" y1="47" x2="76" y2="74" stroke="${G}" stroke-width="2.5"/><line x1="84" y1="47" x2="84" y2="74" stroke="${G}" stroke-width="2.5"/>
      <rect x="71" y="72" width="18" height="9" rx="2" fill="${O}" stroke="${N}" stroke-width="2"/>
      <path d="M80 81 v6 c0 8 -10 8 -10 2" fill="none" stroke="${N}" stroke-width="4" stroke-linecap="round"/>`),

    lavagna: svg(`
      <ellipse cx="80" cy="110" rx="56" ry="5" fill="${L}"/>
      <line x1="48" y1="96" x2="38" y2="110" stroke="${N}" stroke-width="4" stroke-linecap="round"/>
      <line x1="112" y1="96" x2="122" y2="110" stroke="${N}" stroke-width="4" stroke-linecap="round"/>
      <rect x="22" y="14" width="116" height="84" rx="5" fill="${W}" stroke="${N}" stroke-width="4"/>
      <rect x="22" y="14" width="116" height="15" rx="5" fill="${N}"/>
      <g stroke="${L}" stroke-width="2">
        <line x1="22" y1="50" x2="138" y2="50"/><line x1="22" y1="72" x2="138" y2="72"/>
        <line x1="45" y1="29" x2="45" y2="98"/><line x1="68" y1="29" x2="68" y2="98"/><line x1="91" y1="29" x2="91" y2="98"/><line x1="114" y1="29" x2="114" y2="98"/>
      </g>
      <rect x="27" y="35" width="14" height="9" rx="2" fill="${Y}"/><rect x="72" y="35" width="15" height="9" rx="2" fill="${V}"/>
      <rect x="96" y="56" width="14" height="9" rx="2" fill="${R}"/><rect x="50" y="78" width="14" height="9" rx="2" fill="${Y}"/>
      <path d="M118 80 h15" stroke="${R}" stroke-width="3" stroke-linecap="round"/><path d="M118 88 h10" stroke="${N}" stroke-width="3" stroke-linecap="round"/>`),

    magazzino: svg(`
      <ellipse cx="80" cy="110" rx="58" ry="5" fill="${L}"/>
      <rect x="26" y="12" width="6" height="96" fill="${N}"/><rect x="128" y="12" width="6" height="96" fill="${N}"/>
      <g fill="${N}"><rect x="26" y="40" width="108" height="5"/><rect x="26" y="72" width="108" height="5"/><rect x="26" y="102" width="108" height="5"/></g>
      <rect x="38" y="20" width="26" height="20" rx="2" fill="${Y}" stroke="${N}" stroke-width="2.5"/><path d="M38 28h26" stroke="${N}" stroke-width="2"/>
      <rect x="70" y="26" width="20" height="14" rx="2" fill="${O}" stroke="${N}" stroke-width="2.5"/>
      <circle cx="110" cy="31" r="8" fill="${W}" stroke="${N}" stroke-width="3"/><circle cx="110" cy="31" r="3" fill="${G}"/>
      <rect x="38" y="54" width="20" height="18" rx="2" fill="${W}" stroke="${N}" stroke-width="2.5"/>
      <rect x="62" y="50" width="30" height="22" rx="2" fill="${Y}" stroke="${N}" stroke-width="2.5"/><path d="M77 50v22" stroke="${N}" stroke-width="2"/>
      <g stroke="${N}" stroke-width="3" fill="none"><path d="M100 70 l8 -14 l8 14z" fill="${O}"/></g>
      <rect x="40" y="86" width="32" height="16" rx="2" fill="${O}" stroke="${N}" stroke-width="2.5"/>
      <rect x="78" y="82" width="22" height="20" rx="2" fill="${W}" stroke="${N}" stroke-width="2.5"/><path d="M83 88h12M83 94h8" stroke="${G}" stroke-width="2.5"/>
      <rect x="106" y="90" width="18" height="12" rx="2" fill="${Y}" stroke="${N}" stroke-width="2.5"/>`),

    // configuratore cablaggio: carroponte visto dall'alto con le sue zone (quadro, carrello, pulsantiera, motori del ponte)
    cablaggio: svg(`
      <ellipse cx="80" cy="112" rx="62" ry="5" fill="${L}"/>
      <line x1="8" y1="22" x2="152" y2="22" stroke="${G}" stroke-width="3"/><line x1="8" y1="96" x2="152" y2="96" stroke="${G}" stroke-width="3"/>
      <rect x="14" y="16" width="16" height="86" rx="3" fill="${G}" stroke="${N}" stroke-width="3"/>
      <rect x="130" y="16" width="16" height="86" rx="3" fill="${G}" stroke="${N}" stroke-width="3"/>
      <rect x="30" y="44" width="100" height="8" fill="${Y}" stroke="${N}" stroke-width="2.5"/>
      <rect x="30" y="66" width="100" height="8" fill="${Y}" stroke="${N}" stroke-width="2.5"/>
      <rect x="17" y="24" width="10" height="12" rx="2" fill="${N}"/><rect x="133" y="24" width="10" height="12" rx="2" fill="${N}"/>
      <rect x="84" y="38" width="28" height="42" rx="4" fill="${O}" stroke="${N}" stroke-width="3"/>
      <circle cx="98" cy="59" r="8" fill="${W}" stroke="${N}" stroke-width="2.5"/><circle cx="98" cy="59" r="2.5" fill="${N}"/>
      <rect x="36" y="78" width="22" height="16" rx="2" fill="${W}" stroke="${N}" stroke-width="2.5"/>
      <path d="M49 80 l-6 7 h5 l-3 6 l8 -9 h-5 l3 -4z" fill="${Y}" stroke="${N}" stroke-width="1"/>
      <path d="M58 84 C70 84 66 60 84 60" fill="none" stroke="${R}" stroke-width="2.5" stroke-dasharray="4 2"/>
      <path d="M104 80 v16 c0 6 8 6 8 10" fill="none" stroke="${N}" stroke-width="2"/>
      <rect x="106" y="102" width="12" height="14" rx="2" fill="${N}"/>
      <circle cx="112" cy="107" r="1.8" fill="${V}"/><circle cx="112" cy="112" r="1.8" fill="${R}"/>`),

    // furgone a tetto alto (tipo furgone grande da cantiere)
    furgone: svg(`
      <ellipse cx="80" cy="104" rx="68" ry="5" fill="${L}"/>
      <path d="M12 92 V30 q0 -8 8 -8 H108 q6 0 9 5 L132 54 L145 61 q4 2 4 7 V92 z" fill="${W}" stroke="${N}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M108 28 L122 52 H104 V28 z" fill="${L}" stroke="${N}" stroke-width="2.5" stroke-linejoin="round"/>
      <line x1="100" y1="26" x2="100" y2="90" stroke="${N}" stroke-width="2"/>
      <line x1="62" y1="26" x2="62" y2="90" stroke="${N}" stroke-width="1.5" stroke-dasharray="3 2"/>
      <rect x="12" y="70" width="137" height="6" fill="${O}"/>
      <text x="56" y="54" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="900" font-size="10" fill="${N}">GRU IMPIANTI</text>
      <rect x="139" y="66" width="8" height="4" rx="1" fill="${Y}" stroke="${N}" stroke-width="1"/>
      <rect x="106" y="58" width="7" height="2.5" rx="1" fill="${N}"/>
      <circle cx="36" cy="94" r="10" fill="${N}"/><circle cx="36" cy="94" r="4" fill="${G}"/>
      <circle cx="124" cy="94" r="10" fill="${N}"/><circle cx="124" cy="94" r="4" fill="${G}"/>`),

    piattaforma: svg(`
      <ellipse cx="80" cy="108" rx="66" ry="5" fill="${L}"/>
      <path d="M22 104 l12 -16 M138 104 l-12 -16" stroke="${N}" stroke-width="4" stroke-linecap="round"/>
      <rect x="14" y="101" width="18" height="5" rx="1.5" fill="${N}"/><rect x="128" y="101" width="18" height="5" rx="1.5" fill="${N}"/>
      <rect x="34" y="78" width="92" height="14" rx="3" fill="${Y}" stroke="${N}" stroke-width="3"/>
      <rect x="54" y="66" width="30" height="13" rx="2" fill="${O}" stroke="${N}" stroke-width="3"/>
      <path d="M70 68 L108 34" stroke="${N}" stroke-width="7" stroke-linecap="round"/>
      <path d="M70 68 L108 34" stroke="${G}" stroke-width="3" stroke-linecap="round"/>
      <path d="M100 16 h34 v16 h-34 z" fill="${W}" stroke="${N}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M100 22 h34" stroke="${N}" stroke-width="2"/>
      <circle cx="48" cy="94" r="6" fill="${N}"/><circle cx="112" cy="94" r="6" fill="${N}"/>`),

    sottoganci: svg(`
      <ellipse cx="80" cy="110" rx="50" ry="5" fill="${L}"/>
      <line x1="80" y1="2" x2="80" y2="18" stroke="${G}" stroke-width="3"/>
      <rect x="70" y="16" width="20" height="10" rx="3" fill="${N}"/>
      <path d="M80 26 v8 c0 13 -15 13 -15 3" fill="none" stroke="${N}" stroke-width="6" stroke-linecap="round"/>
      <circle cx="80" cy="40" r="5" fill="none" stroke="${Y}" stroke-width="4"/>
      <g fill="none" stroke="${Y}" stroke-width="4">
        <ellipse cx="73" cy="51" rx="3.5" ry="6" transform="rotate(32 73 51)"/><ellipse cx="66" cy="62" rx="3.5" ry="6" transform="rotate(32 66 62)"/><ellipse cx="59" cy="73" rx="3.5" ry="6" transform="rotate(32 59 73)"/>
        <ellipse cx="87" cy="51" rx="3.5" ry="6" transform="rotate(-32 87 51)"/><ellipse cx="94" cy="62" rx="3.5" ry="6" transform="rotate(-32 94 62)"/><ellipse cx="101" cy="73" rx="3.5" ry="6" transform="rotate(-32 101 73)"/>
      </g>
      <path d="M50 80 c-6 0 -6 8 0 8 M110 80 c6 0 6 8 0 8" fill="none" stroke="${N}" stroke-width="4" stroke-linecap="round"/>
      <rect x="44" y="84" width="72" height="22" rx="3" fill="${O}" stroke="${N}" stroke-width="3"/>
      <text x="80" y="101" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="9" fill="${W}">2 t</text>`)
  };
})();
