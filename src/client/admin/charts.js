// Lightweight SVG charts for the CNM Group OS (no library): trend line with comparison, sparkline, bars, funnel.
// Every chart has an accessible label and a "View as table" fallback.
import { escapeHtml as e, formatMoney } from '../../shared/format.mjs';

const W = 720;
const H = 220;
const P = { t: 16, r: 12, b: 26, l: 56 };
const short = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const compactMoney = (n) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `₦${(n / 1e9).toFixed(1)}bn`;
  if (a >= 1e6) return `₦${(n / 1e6).toFixed(1)}m`;
  if (a >= 1e3) return `₦${(n / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`;
  return `₦${Math.round(n)}`;
};
const niceMax = (m) => { if (m <= 0) return 1; const p = 10 ** Math.floor(Math.log10(m)); return Math.ceil(m / p) * p; };

/** Trend line: current period (solid) vs comparison period (dashed), aligned by day index. Hover shows both values. */
export function trendChart(cur, prev, { key, label, money = true }) {
  const fmt = money ? formatMoney : (n) => String(n);
  const max = niceMax(Math.max(1, ...cur.map((d) => d[key]), ...(prev || []).map((d) => d[key])));
  const n = cur.length;
  const x = (i) => P.l + (n <= 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (n - 1));
  const y = (v) => P.t + (H - P.t - P.b) * (1 - v / max);
  const path = (s) => s.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join('');
  const area = `${path(cur)}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => max * t);
  const every = Math.max(1, Math.ceil(n / 7));
  const cols = cur.map((d, i) => `<g class="tc-col" tabindex="0" data-i="${i}"><rect x="${(x(i) - (W - P.l - P.r) / Math.max(1, n - 1) / 2).toFixed(1)}" y="${P.t}" width="${((W - P.l - P.r) / Math.max(1, n - 1)).toFixed(1)}" height="${H - P.t - P.b}" fill="transparent"/><line x1="${x(i).toFixed(1)}" x2="${x(i).toFixed(1)}" y1="${P.t}" y2="${H - P.b}" class="tc-guide"/><circle cx="${x(i).toFixed(1)}" cy="${y(d[key]).toFixed(1)}" r="4" class="tc-dot"/></g>`).join('');
  return `<figure class="tc" data-trend>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${e(label)}" preserveAspectRatio="none">
      <defs><linearGradient id="tc-fill-${key}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--os-accent)" stop-opacity=".22"/><stop offset="1" stop-color="var(--os-accent)" stop-opacity="0"/></linearGradient></defs>
      ${ticks.map((t) => `<line x1="${P.l}" x2="${W - P.r}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" class="tc-grid"/><text x="${P.l - 8}" y="${(y(t) + 4).toFixed(1)}" text-anchor="end" class="tc-tick">${money ? compactMoney(t) : Math.round(t)}</text>`).join('')}
      ${cur.map((d, i) => (i % every === 0 || i === n - 1 ? `<text x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="tc-tick">${short(d.date)}</text>` : '')).join('')}
      <path d="${area}" fill="url(#tc-fill-${key})"/>
      ${prev ? `<path d="${path(prev.slice(0, n))}" class="tc-prev"/>` : ''}
      <path d="${path(cur)}" class="tc-cur"/>
      ${cols}
    </svg>
    <div class="tc-tip" hidden></div>
    <details class="os-table-fallback"><summary>View as table</summary><table class="table"><thead><tr><th>Date</th><th>${e(label)}</th>${prev ? '<th>Comparison</th>' : ''}</tr></thead><tbody>${cur.map((d, i) => `<tr><td>${e(d.date)}</td><td>${e(fmt(d[key]))}</td>${prev ? `<td>${prev[i] ? `${e(prev[i].date)} · ${e(fmt(prev[i][key]))}` : '—'}</td>` : ''}</tr>`).join('')}</tbody></table></details>
  </figure>`;
}

/** Wire hover / focus tooltips for every trend chart inside `root`. */
export function bindTrend(root, cur, prev, { key, money = true }) {
  const fmt = money ? formatMoney : (n) => String(n);
  root.querySelectorAll('[data-trend]').forEach((fig) => {
    const tip = fig.querySelector('.tc-tip');
    const show = (g) => {
      const i = Number(g.dataset.i);
      fig.querySelectorAll('.tc-col.is-on').forEach((x) => x.classList.remove('is-on'));
      g.classList.add('is-on');
      tip.innerHTML = `<strong>${e(short(cur[i].date))}</strong> ${e(fmt(cur[i][key]))}${prev?.[i] ? `<br><span>${e(short(prev[i].date))} ${e(fmt(prev[i][key]))}</span>` : ''}`;
      const svg = fig.querySelector('svg').getBoundingClientRect();
      const r = g.querySelector('circle').getBoundingClientRect();
      tip.hidden = false;
      tip.style.left = `${Math.min(svg.width - tip.offsetWidth, Math.max(0, r.left - svg.left - tip.offsetWidth / 2))}px`;
      tip.style.top = `${Math.max(0, r.top - svg.top - tip.offsetHeight - 10)}px`;
    };
    fig.querySelectorAll('.tc-col').forEach((g) => { g.addEventListener('pointerenter', () => show(g)); g.addEventListener('focus', () => show(g)); });
    fig.addEventListener('pointerleave', () => { tip.hidden = true; fig.querySelectorAll('.tc-col.is-on').forEach((x) => x.classList.remove('is-on')); });
  });
}

export function sparkline(values, color = 'var(--os-accent)') {
  if (!values?.length) return '';
  const max = Math.max(1, ...values);
  const w = 96; const h = 28;
  const pts = values.map((v, i) => `${((i * w) / Math.max(1, values.length - 1)).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${e(color)}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

/** Stacked daily bars: gross (light) with net (solid) inside — shows the gap discounts and refunds make. */
export function grossNetBars(series) {
  const max = niceMax(Math.max(1, ...series.map((d) => d.gross)));
  return `<div class="gn" role="img" aria-label="Gross versus net sales per day">${series.map((d) => `<div class="gn__col" title="${e(short(d.date))} — gross ${e(formatMoney(d.gross))}, net ${e(formatMoney(d.net))}"><span class="gn__gross" style="height:${((d.gross / max) * 100).toFixed(1)}%"><span class="gn__net" style="height:${d.gross ? Math.max(0, (d.net / d.gross) * 100).toFixed(1) : 0}%"></span></span></div>`).join('')}</div>
  <div class="gn__legend"><span><i class="gn__k gn__k--gross"></i>Gross</span><span><i class="gn__k gn__k--net"></i>Net</span></div>`;
}

export function hbars(rows, { label, value, fmt = (n) => n, color }) {
  const max = Math.max(1, ...rows.map((r) => r[value]));
  return `<ul class="hb">${rows.map((r) => `<li><span class="hb__label">${e(r[label])}</span><span class="hb__track"><span style="width:${((r[value] / max) * 100).toFixed(1)}%${color ? `;background:${e(color(r))}` : ''}"></span></span><span class="hb__val">${e(fmt(r[value]))}</span></li>`).join('')}</ul>`;
}

export function funnel(steps) {
  const top = Math.max(1, steps[0]?.count || 0);
  return `<ol class="fn">${steps.map((s, i) => {
    const prev = i ? steps[i - 1].count : null;
    const rate = prev ? Math.round((s.count / prev) * 1000) / 10 : null;
    return `<li><span class="fn__label">${e(s.label)}</span><span class="fn__track"><span style="width:${Math.max(s.count ? 2 : 0, (s.count / top) * 100).toFixed(1)}%"></span></span><span class="fn__val">${s.count.toLocaleString('en-NG')}${rate != null ? `<small>${rate}%</small>` : ''}</span></li>`;
  }).join('')}</ol>`;
}
