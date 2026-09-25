// Illustrated placeholders shown until CNM supplies original photography.
// They are deliberately abstract (vessel silhouettes) and carry an on-image note so nobody mistakes them for product photos.

const G = '#23221e';
const G2 = '#4a4843';
const CREAM = '#f6f5f0';
const SAND = '#e9ece4';

const defs = (id) => `<defs>
  <linearGradient id="v${id}" x1="0" x2="1"><stop offset="0" stop-color="${G}"/><stop offset=".55" stop-color="${G2}"/><stop offset="1" stop-color="${G}"/></linearGradient>
  <linearGradient id="g${id}" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".0"/><stop offset=".5" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <radialGradient id="s${id}"><stop offset="0" stop-color="#000" stop-opacity=".16"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
</defs>`;

const label = (x, y, size = 14) =>
  `<text x="${x}" y="${y}" fill="${CREAM}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="700" letter-spacing="${size * 0.3}" text-anchor="middle">CNM</text>`;

// Each shape is drawn around x=400, standing on y=760, in an 800x1000 canvas.
const SHAPES = {
  dropper: (id) => `
    <rect x="370" y="330" width="60" height="70" fill="${G}"/><rect x="382" y="250" width="36" height="84" rx="18" fill="#121110"/>
    <path d="M320 420 q0 -24 24 -24 h112 q24 0 24 24 v320 q0 20 -20 20 h-120 q-20 0 -20 -20z" fill="url(#v${id})"/>
    <rect x="336" y="420" width="18" height="320" fill="url(#g${id})"/>${label(400, 600)}`,
  bottle: (id) => `
    <rect x="372" y="300" width="56" height="80" fill="#121110"/>
    <path d="M300 420 q0 -40 40 -40 h120 q40 0 40 40 v320 q0 20 -20 20 h-160 q-20 0 -20 -20z" fill="url(#v${id})"/>
    <rect x="318" y="410" width="20" height="330" fill="url(#g${id})"/>${label(400, 600)}`,
  machine: (id) => `
    <rect x="300" y="250" width="200" height="510" rx="100" fill="url(#v${id})"/>
    <rect x="330" y="300" width="22" height="420" rx="11" fill="url(#g${id})"/>
    <circle cx="400" cy="330" r="14" fill="${CREAM}" opacity=".55"/>
    <rect x="360" y="700" width="80" height="4" fill="${CREAM}" opacity=".4"/>${label(400, 540, 16)}`,
  jar: (id) => `
    <rect x="280" y="560" width="240" height="46" rx="6" fill="#121110"/>
    <path d="M270 612 h260 v128 q0 20 -20 20 h-220 q-20 0 -20 -20z" fill="url(#v${id})"/>
    <rect x="290" y="620" width="18" height="130" fill="url(#g${id})"/>${label(400, 690)}`,
  reed: (id) => `
    <g stroke="#6b5a40" stroke-width="3"><path d="M392 470 L330 150"/><path d="M398 470 L380 120"/><path d="M402 470 L420 130"/><path d="M406 470 L470 160"/><path d="M396 470 L350 190"/><path d="M404 470 L452 200"/></g>
    <rect x="370" y="440" width="60" height="40" fill="#121110"/>
    <path d="M300 520 q0 -40 50 -40 h100 q50 0 50 40 v220 q0 20 -20 20 h-160 q-20 0 -20 -20z" fill="url(#v${id})"/>
    <rect x="318" y="510" width="18" height="240" fill="url(#g${id})"/>${label(400, 650)}`,
  car: (id) => `
    <rect x="386" y="440" width="28" height="80" fill="#121110"/>
    <circle cx="400" cy="620" r="110" fill="url(#v${id})"/>
    <path d="M320 560 a110 110 0 0 1 60 -48" stroke="#fff" stroke-opacity=".25" stroke-width="10" fill="none"/>${label(400, 628)}`,
  pump: (id) => `
    <path d="M400 230 h90 v22 h-68 v40 h-22z" fill="#121110"/><rect x="384" y="290" width="32" height="70" fill="#121110"/>
    <path d="M320 380 q0 -20 20 -20 h120 q20 0 20 20 v360 q0 20 -20 20 h-120 q-20 0 -20 -20z" fill="url(#v${id})"/>
    <rect x="336" y="370" width="18" height="380" fill="url(#g${id})"/>${label(400, 580)}`,
  spray: (id) => `
    <rect x="360" y="300" width="80" height="60" fill="#121110"/><rect x="340" y="290" width="40" height="18" fill="#121110"/>
    <path d="M330 390 q0 -30 30 -30 h80 q30 0 30 30 v350 q0 20 -20 20 h-100 q-20 0 -20 -20z" fill="url(#v${id})"/>
    <rect x="346" y="380" width="18" height="370" fill="url(#g${id})"/>${label(400, 590)}`,
};

const note = (color) =>
  `<text x="400" y="960" fill="${color}" fill-opacity=".55" font-family="Helvetica, Arial, sans-serif" font-size="15" letter-spacing="3" text-anchor="middle">ILLUSTRATION · ORIGINAL PHOTOGRAPHY AWAITING CNM</text>`;

export function productPlaceholder(key, alt = false) {
  const id = `${key}${alt ? 'a' : 'm'}`;
  const bg = alt ? SAND : CREAM;
  const shape = SHAPES[key] || SHAPES.bottle;
  const transform = alt ? 'translate(-200 -300) scale(1.5)' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">${defs(id)}
<rect width="800" height="1000" fill="${bg}"/>
${alt ? `<circle cx="620" cy="220" r="260" fill="${CREAM}" opacity=".7"/>` : `<rect x="0" y="760" width="800" height="240" fill="${SAND}" opacity=".6"/>`}
<g transform="${transform}"><ellipse cx="400" cy="762" rx="190" ry="18" fill="url(#s${id})"/>${shape(id)}</g>
${note(G)}</svg>`;
}

export const PLACEHOLDER_KEYS = Object.keys(SHAPES);

/** Abstract atmosphere art for editorial tiles (no product claims). */
export function atmosphere(seed, { tone = 'green' } = {}) {
  const palettes = {
    green: ['#121110', '#23221e', '#4a4843', '#f6f5f0'],
    cream: ['#e9ece4', '#f6f5f0', '#d3dbce', '#23221e'],
    stone: ['#d3dbce', '#e9ece4', '#b8c2b2', '#23221e'],
  };
  const [a, b, c, d] = palettes[tone] || palettes.green;
  const r = (n) => ((Math.sin(seed * 9301 + n * 49297) + 1) / 2);
  const blobs = Array.from({ length: 4 }, (_, i) =>
    `<circle cx="${Math.round(r(i) * 900)}" cy="${Math.round(r(i + 7) * 1200)}" r="${Math.round(220 + r(i + 3) * 320)}" fill="${[b, c, b, d][i]}" opacity="${[0.9, 0.55, 0.7, 0.12][i]}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1200" preserveAspectRatio="xMidYMid slice"><defs><filter id="blur${seed}"><feGaussianBlur stdDeviation="90"/></filter></defs><rect width="900" height="1200" fill="${a}"/><g filter="url(#blur${seed})">${blobs}</g></svg>`;
}

/** Hero vessel silhouette (editorial, not a product photo). */
export function heroVessel() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 800" aria-hidden="true"><defs>
<linearGradient id="hv" x1="0" x2="1"><stop offset="0" stop-color="#f6f5f0" stop-opacity=".92"/><stop offset=".5" stop-color="#fff" stop-opacity=".98"/><stop offset="1" stop-color="#e3dccd" stop-opacity=".9"/></linearGradient>
<linearGradient id="hl" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
<rect x="165" y="120" width="70" height="110" fill="#121110"/><rect x="150" y="90" width="100" height="40" fill="#121110"/>
<path d="M80 300 q0 -70 70 -70 h100 q70 0 70 70 v500 h-240z" fill="url(#hv)"/>
<rect x="104" y="280" width="26" height="520" fill="url(#hl)"/>
<text x="200" y="520" fill="#23221e" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="700" letter-spacing="10" text-anchor="middle">CNM</text></svg>`;
}
