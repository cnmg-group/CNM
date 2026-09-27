// Applies light/dark before first paint. Follows the device setting until the visitor chooses; the choice is remembered.
(function () {
  var d = document.documentElement;
  var stored = null;
  try { stored = localStorage.getItem('cnm.theme'); } catch (e) { /* storage blocked */ }
  var mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  function apply(t) {
    d.setAttribute('data-theme', t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'dark' ? '#0f0f0e' : '#23221e');
  }
  apply(stored === 'dark' || stored === 'light' ? stored : (mq && mq.matches ? 'dark' : 'light'));
  if (mq && mq.addEventListener) mq.addEventListener('change', function (e) {
    var s = null; try { s = localStorage.getItem('cnm.theme'); } catch (err) { /* ignore */ }
    if (!s) apply(e.matches ? 'dark' : 'light');
  });
  window.cnmSetTheme = function (t) { try { localStorage.setItem('cnm.theme', t); } catch (e) { /* ignore */ } apply(t); };
})();
