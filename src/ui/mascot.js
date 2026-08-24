/* ---- Gauri: an original chalk sparrow, drawn in SVG, zero assets ---- */
function mascotSVG(cls){
  return `<svg class="mascot ${cls||''}" viewBox="0 0 52 52" fill="none" aria-hidden="true">
    <g class="body">
      <ellipse cx="26" cy="33" rx="13" ry="12" fill="#EDE6D2" opacity=".93"/>
      <path class="wing" d="M22 29c-5 1-8 5-7 9 4 1 8-2 10-6z" fill="#C9BFA4"/>
      <circle cx="30" cy="20" r="9" fill="#EDE6D2"/>
      <path d="M38 20l6 3-6 3z" fill="#F0A02A"/>
      <circle class="eye" cx="32" cy="19" r="2.1" fill="#16302B"/>
      <path d="M24 12c1-4 5-5 7-3" stroke="#C9BFA4" stroke-width="2" stroke-linecap="round"/>
      <path d="M20 43l3 6M31 43l3 6" stroke="#F0A02A" stroke-width="2.2" stroke-linecap="round"/>
    </g></svg>`;
}
