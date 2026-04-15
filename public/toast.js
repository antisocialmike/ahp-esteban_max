/**
 * Sistema de notificaciones emergentes (toast)
 * Proporciona retroalimentación no bloqueante a los usuarios
 */

(function() {
  // Asegura que el contenedor exista
  function getToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  // Crear y mostrar notificacion
  window.Toast = {
    show: function(message, type = 'info', duration = 4000) {
      const container = getToastContainer();
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');

      const iconMap = { success: '✓', error: '✕', warning: '!', info: 'ℹ' };
      const icon = iconMap[type] || 'ℹ';

      toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" type="button" aria-label="Cerrar notificación">×</button>
      `;

      container.appendChild(toast);

      const closeBtn = toast.querySelector('.toast-close');
      const remove = () => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
      };

      closeBtn.addEventListener('click', remove);

      if (duration > 0) {
        setTimeout(remove, duration);
      }

      return toast;
    },

    success: function(message, duration) {
      return this.show(message, 'success', duration);
    },

    error: function(message, duration) {
      return this.show(message, 'error', duration !== undefined ? duration : 6000);
    },

    warning: function(message, duration) {
      return this.show(message, 'warning', duration);
    },

    info: function(message, duration) {
      return this.show(message, 'info', duration);
    }
  };
})();
