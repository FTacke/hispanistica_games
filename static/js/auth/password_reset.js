import { showError, showSuccess, clearAlert } from '/static/js/md3/alert-utils.js';

document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('reset');
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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = document.getElementById('status');
    clearAlert(status);

    const token = document.getElementById('token').value;
    const newPassword = document.getElementById('new').value;
    const confirmPassword = document.getElementById('confirm').value;

    if (newPassword !== confirmPassword) {
      showError(status, 'Las contraseñas no coinciden.');
      return;
    }

    // Client-side password strength validation
    if (newPassword.length < 8) {
      showError(status, 'La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      showError(status, 'La contraseña debe contener al menos una letra mayúscula.');
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      showError(status, 'La contraseña debe contener al menos una letra minúscula.');
      return;
    }
    if (!/\d/.test(newPassword)) {
      showError(status, 'La contraseña debe contener al menos un número.');
      return;
    }

    try {
      const resp = await fetch('/auth/reset-password/confirm', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ resetToken: token, newPassword }) 
      });
      
      const data = await resp.json();
      
      if (data.ok) {
        showSuccess(status, 'Contraseña establecida correctamente. Ya puede iniciar sesión.');
        form.reset();
        // Optional: Redirect to login after a delay
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        showError(status, data.message || 'Error al establecer la contraseña.');
      }
    } catch (error) {
      console.error('[Password Reset] Error:', error);
      showError(status, 'Error de conexión. Por favor, inténtelo de nuevo.');
    }
  });
});
