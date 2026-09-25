// Butterfly loader: appears only when real latency exceeds the threshold, and disappears the moment work completes.
const THRESHOLD_MS = 250;
let pending = 0;
let timer = null;

const el = () => document.querySelector('[data-loader]');

function show() {
  const l = el();
  if (!l) return;
  l.classList.add('is-on');
  l.setAttribute('aria-hidden', 'false');
}
function hide() {
  clearTimeout(timer);
  timer = null;
  const l = el();
  if (!l) return;
  l.classList.remove('is-on');
  l.setAttribute('aria-hidden', 'true');
}

/** Wrap a promise: loader shows only if it is still pending after THRESHOLD_MS. */
export async function withLoader(promise) {
  pending++;
  if (!timer && pending === 1) timer = setTimeout(show, THRESHOLD_MS);
  try {
    return await promise;
  } finally {
    pending = Math.max(0, pending - 1);
    if (!pending) hide();
  }
}

export function demoLoader(ms = 2000) {
  show();
  setTimeout(hide, ms);
}
