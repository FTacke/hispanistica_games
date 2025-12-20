import { showError, showSuccess, clearAlert } from '/static/js/md3/alert-utils.js';

document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('forgot');
  if (!form) return;
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const status = document.getElementById('status');
    clearAlert(status);
    
    try {
      const email = document.getElementById('email').value;
      const resp = await fetch('/auth/reset-password/request', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email }) 
      });
      const data = await resp.json();
      
      if (data.ok) {
        showSuccess(status, 'Anfrage gesendet (sofern Konto existiert).');
      } else {
        showError(status, data.message || 'Fehler bei der Anfrage.');
      }
    } catch (error) {
      console.error('[Password Forgot] Error:', error);
      showError(status, 'Error de conexión. Por favor, inténtelo de nuevo.');
    }
  });
});
