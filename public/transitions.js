/**
 * AHP — Transiciones compartidas y pantalla de bienvenida
 *
 * • Inserta un #page-out-overlay en cada página para que funcionen los desvanecimientos.
 * • Expone ahpNavigate(url) para salidas de página suaves.
 * • En index.html gestiona el cierre de #ahp-splash.
 */

(function () {
  'use strict';

  /* ── 1. Insertar la capa de desvanecimiento de salida ───── */
  var overlay = document.createElement('div');
  overlay.id  = 'page-out-overlay';
  document.documentElement.appendChild(overlay);

  /* ── 2. Navegar con transición de desvanecimiento ────────── */
  window.ahpNavigate = function (url) {
    overlay.classList.add('fading');
    setTimeout(function () {
      window.location.href = url;
    }, 300);
  };

  /* ── 3. Pantalla de bienvenida (solo index.html) ────────── */
  document.addEventListener('DOMContentLoaded', function () {
    var splash = document.getElementById('ahp-splash');
    if (splash) {
      /* Cerrar después de que termine la barra de progreso (~1.8 s) */
      setTimeout(function () {
        splash.classList.add('splash-hide');
        /* Eliminar del DOM cuando termine la transición */
        splash.addEventListener('transitionend', function () {
          splash.remove();
        }, { once: true });
      }, 1800);
    }
  });

})();
