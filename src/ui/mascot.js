/* ==================================================================
   THE CAST — Munni the baby elephant and Gauri the chalk sparrow.
   Original characters, drawn in SVG, zero assets.

   munniSmall() is the idle-pose Munni who stands at whichever jungle-map
   place she is suggesting (ui/jungle-map.js). gauriSmall() is Gauri, used
   wherever she appears on screen — including inside the cartoon
   keyframes (core/generative-brain.js), which is why it takes optional
   extra attributes and class: nested inside another <svg> it needs a
   position and size, and must not pick up .hm-gauri's standalone sizing.
   The ask-page Munni with moods is a
   separate, larger drawing in ui/elephant.js.
   ================================================================== */

function munniSmall(){
  return `<svg class="hm-munni" viewBox="0 0 340 250" aria-hidden="true">
    <g class="hm-body">
      <path class="hm-tail" d="M56 152c-13 4-17 14-12 24" stroke="#B9A7C9"
            stroke-width="9" stroke-linecap="round" fill="none"/>
      <ellipse cx="150" cy="150" rx="96" ry="62" fill="#B9A7C9"/>
      <circle cx="248" cy="122" r="58" fill="#B9A7C9"/>
      <ellipse class="hm-ear" cx="228" cy="112" rx="26" ry="32" fill="#A692B8"/>
      <circle class="hm-eye" cx="272" cy="106" r="7" fill="#2A2118"/>
      <g class="hm-legs">
        <rect x="86"  y="196" width="30" height="46" rx="14" fill="#B9A7C9"/>
        <rect x="130" y="196" width="30" height="46" rx="14" fill="#B9A7C9"/>
        <rect x="172" y="196" width="30" height="46" rx="14" fill="#B9A7C9"/>
        <rect x="214" y="196" width="30" height="46" rx="14" fill="#B9A7C9"/>
      </g>
      <path class="hm-trunk" d="M282 160c6 26 0 44-14 56" stroke="#B9A7C9"
            stroke-width="26" stroke-linecap="round" fill="none"/>
      <path d="M292 148c9 4 14 10 15 18" stroke="#F6F1E2" stroke-width="7"
            stroke-linecap="round" fill="none"/>
    </g>
  </svg>`;
}

function gauriSmall(attrs, cls){
  return `<svg class="${cls || 'hm-gauri'}" viewBox="0 0 60 60" aria-hidden="true" ${attrs || ''}>
    <g class="hm-hop">
      <ellipse cx="30" cy="38" rx="15" ry="14" fill="#EDE6D2"/>
      <path class="hm-wing" d="M25 34c-6 1-9 6-8 10 5 1 9-2 12-7z" fill="#C9BFA4"/>
      <circle cx="35" cy="23" r="10" fill="#EDE6D2"/>
      <path d="M44 23l7 3-7 3z" fill="#F0A02A"/>
      <circle class="hm-eye" cx="37" cy="22" r="2.4" fill="#16302B"/>
      <path d="M23 48l3 7M35 48l3 7" stroke="#F0A02A" stroke-width="2.4" stroke-linecap="round"/>
    </g>
  </svg>`;
}
