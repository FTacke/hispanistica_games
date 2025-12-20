import { showError, showSuccess, clearAlert } from '/static/js/md3/alert-utils.js';

document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('del');
  if (!form) return;
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const status = document.getElementById('status');
    clearAlert(status);
    
    try {
      const password = document.getElementById('pw').value;
      const r = await fetch('/auth/account/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      const j = await r.json();
      
      if (r.status === 202) {
        showSuccess(status, 'Löschanfrage akzeptiert. Du wirst weitergeleitet...');
        window.location = '/';
      } else {
        showError(status, j.message || 'Fehler beim Löschen des Kontos.');
      }
    } catch (error) {
      console.error('[Account Delete] Error:', error);
      showError(status, 'Error de conexión. Por favor, inténtelo de nuevo.');
    }
  });
});
