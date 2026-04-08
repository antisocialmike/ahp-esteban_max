/**
 * AHP — Shared transitions & splash screen
 *
 * • Injects a #page-out-overlay into every page so fades work.
 * • Exposes  ahpNavigate(url)  for smooth page exits.
 * • On index.html manages the #ahp-splash dismissal.
 */

(function () {
  'use strict';

  /* ── 1. Inject the fade-out overlay ─────────────────────── */
  var overlay = document.createElement('div');
  overlay.id  = 'page-out-overlay';
  document.documentElement.appendChild(overlay);

  /* ── 2. Navigate with fade-out transition ─────────────────── */
  window.ahpNavigate = function (url) {
    overlay.classList.add('fading');
    setTimeout(function () {
      window.location.href = url;
    }, 300);
  };

  /* ── 3. Splash screen (index.html only) ─────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    var splash = document.getElementById('ahp-splash');
    if (splash) {
      /* Dismiss after progress bar finishes (~1.8 s) */
      setTimeout(function () {
        splash.classList.add('splash-hide');
        /* Remove from DOM after transition ends */
        splash.addEventListener('transitionend', function () {
          splash.remove();
        }, { once: true });
      }, 1800);
    }
  });

})();
