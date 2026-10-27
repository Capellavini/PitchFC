// Presentation mode only — invented flat-style portraits (SVG data URIs) so
// the demo has "photos" without using anyone's real face. Deterministic per
// seed: same name → same face. Swap for real images by dropping JPGs in
// public/demo/ and pointing `photo` at them.
const SKINS = ["#F6D5B8", "#EBBF98", "#D9A074", "#C28458", "#A86B43", "#7C4B2F", "#5B3623"];
const HAIRS = ["#14100E", "#2A1B12", "#4A3020", "#6B4A2B", "#9A6B34", "#C9A15A", "#8C8C8C", "#B5482A"];
const KITS = ["#C8FF00", "#4895FF", "#FF9F0A", "#FF3B5C", "#A78BFA", "#00D08A", "#E8ECF4", "#1E2A3E"];
const BGS = [["#1B2A44", "#0E1626"], ["#233A2E", "#0F1A15"], ["#3A2A44", "#17101E"], ["#443A2A", "#1E1810"], ["#2A3F44", "#10191C"]];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const pick = (arr, h, shift) => arr[(h >>> shift) % arr.length];

function hairPath(style, color) {
  switch (style) {
    case 0: return `<path d="M62 84c-2-30 20-46 38-46s40 16 38 46c-6-14-16-20-38-20s-32 6-38 20z" fill="${color}"/>`; // short
    case 1: return `<path d="M60 90c-6-38 18-54 40-54s46 16 40 54c-2-18-10-30-40-30s-38 12-40 30z" fill="${color}"/><rect x="60" y="80" width="10" height="26" rx="5" fill="${color}"/><rect x="130" y="80" width="10" height="26" rx="5" fill="${color}"/>`; // long sides
    case 2: return `<path d="M64 80c0-26 16-40 36-40s36 14 36 40c-8-8-14-12-36-12s-28 4-36 12z" fill="${color}" opacity=".92"/>`; // buzz
    case 3: return `<g fill="${color}"><circle cx="70" cy="66" r="16"/><circle cx="88" cy="54" r="18"/><circle cx="110" cy="52" r="18"/><circle cx="128" cy="64" r="16"/><circle cx="100" cy="46" r="18"/></g>`; // curly
    case 4: return `<path d="M62 86c-4-34 16-50 38-50 20 0 42 14 38 50-6-10-12-26-30-30-14 8-30 18-46 30z" fill="${color}"/>`; // swept
    case 5: return ""; // bald
    default: return `<path d="M62 84c-2-30 20-46 38-46s40 16 38 46c-4-10-10-14-20-16l-10-8-10 8c-20 0-30 6-36 16z" fill="${color}"/>`;
  }
}

/** spec: { seed, skin?, hair?, hairColor?, beard?, kit? } → data URI (square). */
export function demoPortrait(spec) {
  const h = hash(String(spec.seed));
  const skin = spec.skin ?? pick(SKINS, h, 3);
  const hairColor = spec.hairColor ?? pick(HAIRS, h, 7);
  const style = spec.hair ?? (h >>> 11) % 6;
  const kit = spec.kit ?? pick(KITS, h, 15);
  const beard = spec.beard ?? ((h >>> 19) % 4 === 0);
  const [bg1, bg2] = pick(BGS, h, 21);
  const id = `g${h}`;
  const kitDark = kit === "#E8ECF4" ? "#B9C2D4" : kit;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient>
<radialGradient id="${id}s" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<rect width="200" height="200" fill="url(#${id})"/><rect width="200" height="200" fill="url(#${id}s)"/>
<path d="M24 200c2-34 28-52 76-52s74 18 76 52z" fill="${kitDark}"/>
<path d="M82 148l18 20 18-20" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="5" stroke-linejoin="round"/>
<rect x="88" y="118" width="24" height="34" rx="10" fill="${skin}"/><rect x="88" y="132" width="24" height="12" fill="rgba(0,0,0,.14)"/>
<ellipse cx="62" cy="96" rx="7" ry="11" fill="${skin}"/><ellipse cx="138" cy="96" rx="7" ry="11" fill="${skin}"/>
${style === 3 || style === 1 ? hairPath(style, hairColor) : ""}
<ellipse cx="100" cy="92" rx="38" ry="46" fill="${skin}"/>
${style !== 3 && style !== 1 ? hairPath(style, hairColor) : ""}
${beard ? `<path d="M64 98c2 34 18 50 36 50s34-16 36-50c-6 14-16 18-36 18s-30-4-36-18z" fill="${hairColor}" opacity=".9"/><path d="M84 124c10 6 22 6 32 0" stroke="${skin}" stroke-width="5" fill="none" stroke-linecap="round" opacity=".0"/>` : ""}
<ellipse cx="86" cy="94" rx="4.2" ry="5" fill="#16110D"/><ellipse cx="114" cy="94" rx="4.2" ry="5" fill="#16110D"/>
<circle cx="87.4" cy="92.4" r="1.4" fill="#fff"/><circle cx="115.4" cy="92.4" r="1.4" fill="#fff"/>
<path d="M78 84c4-3 10-3 15 0M107 84c5-3 11-3 15 0" stroke="${hairColor}" stroke-width="3.4" stroke-linecap="round" fill="none"/>
<path d="M100 98c-2 8-4 12-1 13" stroke="rgba(0,0,0,.22)" stroke-width="3" stroke-linecap="round" fill="none"/>
<path d="M89 117c7 5 15 5 22 0" stroke="${beard ? "#fff" : "#7A3B2E"}" stroke-opacity="${beard ? ".85" : "1"}" stroke-width="3.6" stroke-linecap="round" fill="none"/>
<path d="M82 112c0 0 2-6 18-6s18 6 18 6" stroke="none" fill="none"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
