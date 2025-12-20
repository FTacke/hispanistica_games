import { showError, showSuccess, clearAlert } from '/static/js/md3/alert-utils.js';

// Helper function to get CSRF token from cookie
function getCsrfToken() {
  const match = document.cookie.match(/csrf_access_token=([^;]+)/);
  return match ? match[1] : '';
}

document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('chg');
  if (!form) return;

  // Toggle visibility logic
  document.querySelectorAll('.md3-outlined-textfield__icon--trailing').forEach(btn => {
    btn.addEventListener('click', () => {
      const inputId = btn.dataset.toggle;
      const input = document.getElementById(inputId);
      const icon = btn.querySelector('.material-symbols-rounded');
      if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = 'visibility_off';
      } else {
        input.type = 'password';
        icon.textContent = 'visibility';
      }
    });
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const status = document.getElementById('status');
    clearAlert(status);

    const oldPassword = document.getElementById('old').value;
    const newPassword = document.getElementById('new').value;
    const confirmPassword = document.getElementById('confirm').value;

    if (newPassword !== confirmPassword) {
      showError(status, 'Die neuen Passwörter stimmen nicht überein.');
      return;
    }

    // Client-side password strength validation
    if (newPassword.length < 8) {
      showError(status, 'Das Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      showError(status, 'Das Passwort muss mindestens einen Großbuchstaben enthalten.');
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      showError(status, 'Das Passwort muss mindestens einen Kleinbuchstaben enthalten.');
      return;
    }
    if (!/\d/.test(newPassword)) {
      showError(status, 'Das Passwort muss mindestens eine Ziffer enthalten.');
      return;
    }

    try {
      const r = await fetch('/auth/change-password', { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-TOKEN': getCsrfToken()
        },
        credentials: 'same-origin',
        body: JSON.stringify({ oldPassword, newPassword }) 
      });
      
      const j = await r.json();
      
      if (j.ok) {
        showSuccess(status, 'Passwort erfolgreich geändert.');
        form.reset();
      } else {
        showError(status, j.message || 'Fehler beim Ändern des Passworts.');
      }
    } catch (error) {
      console.error('[Password Change] Error:', error);
      showError(status, 'Error de conexión. Por favor, inténtelo de nuevo.');
    }
  });
});
