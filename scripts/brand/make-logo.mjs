// Generates the vector CNM Essentials logo (public/assets/brand/cnm-logo.svg, cnm-mark.svg).
// Redrawn from the original logo shown on cnm-group.net, with CNM's approval: petal geometry measured from the source,
// lettering converted to outlines (Jost Light for the wordmark, Open Sans SemiBold for the tagline).
// Run in a scratch folder with: npm i opentype.js @fontsource/jost @fontsource/open-sans && node make-logo.mjs
import opentype from 'opentype.js';
import { readFileSync, writeFileSync } from 'node:fs';
const load = (p) => { const b = readFileSync(p); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const thin = load('node_modules/@fontsource/jost/files/jost-latin-300-normal.woff');
const semi = load('node_modules/@fontsource/open-sans/files/open-sans-latin-600-normal.woff');

// Fit a string into a box: returns an SVG path whose ink spans [x0,x1] with the cap/x top at yTop and baseline at yBase.
function fitText(font, text, x0, x1, yBase, capHeight, { letterSpacing = 0 } = {}) {
  const probe = font.getPath(text, 0, 0, 1000, { letterSpacing });
  const bb = probe.getBoundingBox();
  const refH = font.charToGlyph('H').getBoundingBox().y2 - font.charToGlyph('H').getBoundingBox().y1;
  const sy = capHeight / (refH);           // scale from font units (at size 1000 => units*1000/upm)
  const size = 1000 * sy * font.unitsPerEm / 1000;
  const p1 = font.getPath(text, 0, 0, size * 1000 / font.unitsPerEm, { letterSpacing });
  const b1 = p1.getBoundingBox();
  const sx = (x1 - x0) / (b1.x2 - b1.x1);
  const hb = font.getPath('H', 0, 0, size * 1000 / font.unitsPerEm).getBoundingBox();
  const syy = capHeight / (hb.y2 - hb.y1);
  return { d: p1.toPathData(2), tx: x0 - b1.x1 * sx, ty: yBase, sx, sy: syy };
}
const g = (t, fill) => `<path fill="${fill}" transform="translate(${t.tx.toFixed(2)} ${t.ty.toFixed(2)}) scale(${t.sx.toFixed(4)} ${t.sy.toFixed(4)})" d="${t.d}"/>`;

// Petal: rounded "drop" with a sharp inner corner (inner = corner facing the centre of the mark).
function petal(x, y, s, inner, rOuter = 0.5, rSide = 0.5, rInner = 0.02) {
  const R = { tl: 0, tr: 0, br: 0, bl: 0 };
  const opp = { tl: 'br', tr: 'bl', br: 'tl', bl: 'tr' };
  for (const k of Object.keys(R)) R[k] = (k === inner ? rInner : k === opp[inner] ? rOuter : rSide) * s;
  const { tl, tr, br, bl } = R;
  return `M${x + tl},${y} H${x + s - tr} A${tr},${tr} 0 0 1 ${x + s},${y + tr} V${y + s - br} A${br},${br} 0 0 1 ${x + s - br},${y + s} H${x + bl} A${bl},${bl} 0 0 1 ${x},${y + s - bl} V${y + tl} A${tl},${tl} 0 0 1 ${x + tl},${y} Z`;
}

export function logo({ W = 702, H = 801, bg = true } = {}) {
  const mx = 203, my = 181, M = 297, gap = 19, s = (M - gap) / 2;
  const SAGE = '#d3dbce', YEL = '#fbcc39', INK = '#262321';
  const mark = [
    `<path fill="${SAGE}" d="${petal(mx, my, s, 'br')}"/>`,
    `<path fill="${YEL}" d="${petal(mx + s + gap, my, s, 'bl')}"/>`,
    `<path fill="${SAGE}" d="${petal(mx, my + s + gap, s, 'tr')}"/>`,
    `<path fill="${SAGE}" d="${petal(mx + s + gap, my + s + gap, s, 'tl')}"/>`,
    `<circle fill="${INK}" cx="${(mx + s + gap + s * 0.39).toFixed(2)}" cy="${(my + s * 0.48).toFixed(2)}" r="${(s * 0.235).toFixed(2)}"/>`,
    `<circle fill="${INK}" cx="${(mx + s + gap + s * 0.70).toFixed(2)}" cy="${(my + s * 0.265).toFixed(2)}" r="${(s * 0.085).toFixed(2)}"/>`,
  ].join('');
  const cnm = fitText(thin, 'CNM', 76, 214, 578, 49);
  const ess = fitText(thin, 'ESSENTIALS', 232, 628, 578, 49);
  const tag = fitText(semi, 'crafting serenity, pioneering comfort', 168, 645, 610, 17);
  const text = g(cnm, '#e2e3df') + g(ess, '#d6b05a') + `<rect x="100" y="600" width="58" height="2.4" fill="#c9a24a"/>` + g(tag, '#c9a24a');
  const back = bg ? `<defs><radialGradient id="cnmbg" cx="0" cy="0" r="1.25" gradientUnits="objectBoundingBox"><stop offset="0" stop-color="#57534f"/><stop offset=".55" stop-color="#2b2826"/><stop offset="1" stop-color="#191615"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#cnmbg)"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="CNM Essentials — crafting serenity, pioneering comfort"><title>CNM Essentials</title>${back}${mark}${text}</svg>`;
}
export function markOnly({ bg = true } = {}) {
  const full = logo({ bg: false });
  const inner = full.replace(/^<svg[^>]*><title>[^<]*<\/title>/, '').replace(/<\/svg>$/, '').split('<path fill="#e2e3df"')[0];
  const pad = 40;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${203 - pad} ${181 - pad} ${297 + pad * 2} ${297 + pad * 2}" role="img" aria-label="CNM Essentials"><title>CNM Essentials</title>${bg ? `<rect x="${203 - pad}" y="${181 - pad}" width="${297 + pad * 2}" height="${297 + pad * 2}" fill="#23221e"/>` : ''}${inner}</svg>`;
}
writeFileSync('cnm-logo.svg', logo());
writeFileSync('cnm-logo-transparent.svg', logo({ bg: false }));
writeFileSync('cnm-mark.svg', markOnly());
console.log('ok');
