// ===== ILLUSTRAZIONI DELLE CASELLE (SVG disegnati a mano, nessun file esterno) =====
window.ILL = (function () {
  const N = '#16324f', Y = '#f2b705', O = '#e07a1f', G = '#9fb0c3', L = '#dfe7f0', W = '#ffffff', V = '#2e9e5b', R = '#d6453d';
  const svg = (inner) => `<svg viewBox="0 0 160 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;

  return {
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

    cablaggio: svg(`
      <ellipse cx="80" cy="110" rx="58" ry="5" fill="${L}"/>
      <rect x="18" y="14" width="56" height="88" rx="5" fill="${W}" stroke="${N}" stroke-width="3"/>
      <rect x="25" y="22" width="42" height="10" rx="2" fill="${N}"/>
      <g fill="${Y}" stroke="${N}" stroke-width="2"><rect x="26" y="40" width="9" height="16" rx="1.5"/><rect x="38" y="40" width="9" height="16" rx="1.5"/><rect x="50" y="40" width="9" height="16" rx="1.5"/></g>
      <g fill="${G}"><rect x="26" y="64" width="40" height="4" rx="1"/><rect x="26" y="72" width="40" height="4" rx="1"/></g>
      <circle cx="31" cy="90" r="4" fill="${V}"/><circle cx="43" cy="90" r="4" fill="${R}"/>
      <path d="M74 44 C96 44 92 30 112 30" fill="none" stroke="${O}" stroke-width="4" stroke-linecap="round"/>
      <path d="M74 54 C100 54 96 46 118 46" fill="none" stroke="${N}" stroke-width="4" stroke-linecap="round"/>
      <path d="M74 64 C104 64 100 62 124 62" fill="none" stroke="${Y}" stroke-width="4" stroke-linecap="round"/>
      <rect x="110" y="24" width="32" height="46" rx="6" fill="${N}"/>
      <circle cx="126" cy="47" r="10" fill="${W}" stroke="${Y}" stroke-width="3"/>
      <text x="126" y="51" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="900" font-size="11" fill="${N}">M</text>
      <path d="M126 70 v14 c0 8 -9 8 -9 2" fill="none" stroke="${N}" stroke-width="4" stroke-linecap="round"/>`),

    furgone: svg(`
      <ellipse cx="80" cy="104" rx="66" ry="5" fill="${L}"/>
      <path d="M14 38 h82 v54 h-82 z" fill="${W}" stroke="${N}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M96 52 h24 l18 18 v22 h-42 z" fill="${Y}" stroke="${N}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M102 58 h16 l12 12 h-28 z" fill="${L}" stroke="${N}" stroke-width="2.5" stroke-linejoin="round"/>
      <rect x="14" y="64" width="82" height="7" fill="${O}"/>
      <text x="55" y="58" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="900" font-size="10" fill="${N}">GRU IMPIANTI</text>
      <rect x="132" y="80" width="8" height="5" rx="1" fill="${O}"/>
      <circle cx="38" cy="94" r="10" fill="${N}"/><circle cx="38" cy="94" r="4" fill="${G}"/>
      <circle cx="116" cy="94" r="10" fill="${N}"/><circle cx="116" cy="94" r="4" fill="${G}"/>`),

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
