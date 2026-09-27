// Builds the transparent CNM Group logo (public/assets/brand/cnm-group-logo.svg).
// The globe-and-hand emblem is the original artwork, upscaled with Real-ESRGAN and cut out from its background
// (public/assets/brand/cnm-group-emblem.webp). The small lettering was unreadable in the 480 px source, so
// "CNM GROUP" and the tagline are redrawn as vector outlines in Cinzel (classical Roman capitals), in the
// original layout and gold colouring.
// Run in a scratch folder: npm i opentype.js @fontsource/cinzel && node make-group-logo.mjs <repoRoot>
import opentype from 'opentype.js';
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = process.argv[2] || '.';
const load = (p) => { const b = readFileSync(p); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const medium = load('node_modules/@fontsource/cinzel/files/cinzel-latin-500-normal.woff');
const bold = load('node_modules/@fontsource/cinzel/files/cinzel-latin-600-normal.woff');

// Centred text as a path, scaled so capitals are `cap` tall, with the baseline at y.
function text(font, str, cx, y, cap, spacing) {
  const size = cap / ((font.charToGlyph('H').getBoundingBox().y2) / font.unitsPerEm);
  const p = font.getPath(str, 0, 0, size, { letterSpacing: spacing, kerning: false });
  const bb = p.getBoundingBox();
  const w = bb.x2 - bb.x1;
  const q = font.getPath(str, cx - w / 2 - bb.x1, y, size, { letterSpacing: spacing, kerning: false });
  return { d: q.toPathData(2), x1: cx - w / 2, x2: cx + w / 2 };
}

const EW = 1145, EH = 1202;                 // emblem size (px)
const W = 1600, cx = W / 2;
const emblemY = 0;
const wordBase = EH + 42 + 118;             // "CNM GROUP" baseline
const tagBase = wordBase + 96;              // tagline baseline
const H = tagBase + 30;
const word = text(medium, 'CNM GROUP', cx, wordBase, 118, 0.12);
const tag = text(bold, 'DRIVEN BY EXCELLENCE. DEFINED BY TRUST.', cx, tagBase, 26, 0.16);
const emblem = readFileSync(`${ROOT}/public/assets/brand/cnm-group-emblem.webp`).toString('base64');
const ruleY = tagBase - 13, gap = 26, len = 150;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="CNM Group — Driven by Excellence. Defined by Trust.">
<title>CNM Group</title>
<defs>
<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a5620"/><stop offset=".42" stop-color="#c89b4f"/><stop offset=".58" stop-color="#e8c888"/><stop offset="1" stop-color="#8a6326"/></linearGradient>
<linearGradient id="goldFlat" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9a7337" stop-opacity="0"/><stop offset=".5" stop-color="#b58a45"/><stop offset="1" stop-color="#9a7337" stop-opacity="0"/></linearGradient>
</defs>
<image x="${(W - EW) / 2}" y="${emblemY}" width="${EW}" height="${EH}" href="data:image/webp;base64,${emblem}"/>
<path fill="url(#gold)" d="${word.d}"/>
<path fill="#a47c3b" d="${tag.d}"/>
<rect x="${tag.x1 - gap - len}" y="${ruleY}" width="${len}" height="3" fill="url(#goldFlat)"/>
<rect x="${tag.x2 + gap}" y="${ruleY}" width="${len}" height="3" fill="url(#goldFlat)"/>
</svg>
`;
if (svg.includes('NaN')) throw new Error('Invalid path data (NaN) in generated logo');
writeFileSync(`${ROOT}/public/assets/brand/cnm-group-logo.svg`, svg);
console.log(`cnm-group-logo.svg ${W}x${H}, ${(svg.length / 1024).toFixed(0)} KB`);
