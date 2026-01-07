/**
 * Admin User Management
 * 
 * Handles user listing, creation, editing, and password reset.
 * MD3-conform implementation with filter chips and edit dialog.
 */
document.addEventListener('DOMContentLoaded', function () {
  // Helper function to get CSRF token from cookie
  function getCsrfToken() {
    const match = document.cookie.match(/csrf_access_token=([^;]+)/);
    return match ? match[1] : '';
  }

  /**
   * Parse JSON response with proper error handling.
   * Throws descriptive error if response is not OK or not JSON.
   */
  async function handleJsonResponse(response) {
    // Handle 204 No Content (successful empty response)
    if (response.status === 204) {
      return { ok: true };
    }

    // Check HTTP status first
    if (!response.ok) {
      const contentType = response.headers.get('Content-Type') || '';
      if (!contentType.includes('application/json')) {
        // Debug: Log first 500 chars of response for diagnosis
        try {
          const text = await response.text();
          const preview = text.substring(0, 500);
          console.error(`[Auth Debug] HTTP ${response.status} non-JSON response preview:`, preview);
        } catch (e) {
          console.error(`[Auth Debug] HTTP ${response.status} - could not read response body`);
        }
        throw new Error(`HTTP ${response.status}: Server returned non-JSON (likely auth redirect)`);
      }
      
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
      } catch (jsonError) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }

    // Verify Content-Type for successful responses
    const contentType = response.headers.get('Content-Type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Expected JSON but received ${contentType}`);
    }

    return response.json();
  }

  // DOM Elements - List
  const listBody = document.getElementById('list-body');
  const refreshBtn = document.getElementById('refresh');
  const searchInput = document.getElementById('admin-search');
  const filterInactiveBtn = document.getElementById('filter-inactive');
  
  // DOM Elements - Create Dialog
  const createBtn = document.getElementById('create');
  const createDialog = document.getElementById('create-user-dialog');
  const createForm = document.getElementById('create-user-form');
  const cancelCreateBtn = document.getElementById('cancel-create');
  
  // DOM Elements - Invite Dialog
  const inviteDialog = document.getElementById('invite-dialog');
  const inviteLinkCode = document.getElementById('invite-link');
  const closeInviteBtn = document.getElementById('close-invite');
  const copyInviteBtn = document.getElementById('copy-invite');
  const inviteMeta = document.getElementById('invite-meta');
  
  // DOM Elements - Edit Dialog
  const editDialog = document.getElementById('user-edit-dialog');
  const cancelEditBtn = document.getElementById('cancel-edit');
  const saveEditBtn = document.getElementById('save-edit');
  const editUserId = document.getElementById('edit-user-id');
  const editUsername = document.getElementById('edit-username');
  const editEmail = document.getElementById('edit-email');
  const editEmailError = document.getElementById('edit-email-error');
  const editRole = document.getElementById('edit-role');
  const editIsActive = document.getElementById('edit-is-active');
  const editResetPasswordBtn = document.getElementById('edit-reset-password');
  const editError = document.getElementById('user-edit-error');

  // State
  let includeInactive = false;
  let searchDebounce = null;

  // Utility functions
  function formatDate(isoString) {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleString('de-DE');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Role icon mapping for badges
  const roleIcons = {
    admin: 'verified_user',
    editor: 'edit',
    user: 'person'
  };

  function renderRoleBadge(role) {
    const icon = roleIcons[role] || 'person';
    return `
      <span class="md3-badge md3-badge--small md3-badge--role-${role}">
        <span class="material-symbols-rounded md3-badge__icon" aria-hidden="true">${icon}</span>
        ${role}
      </span>
    `;
  }

  function renderStatusBadge(isActive) {
    if (isActive) {
      return `
        <span class="md3-badge md3-badge--small md3-badge--status-active">
          <span class="material-symbols-rounded md3-badge__icon" aria-hidden="true">check_circle</span>
          Aktiv
        </span>
      `;
    }
    return `
      <span class="md3-badge md3-badge--small md3-badge--status-inactive">
        <span class="material-symbols-rounded md3-badge__icon" aria-hidden="true">cancel</span>
        Inaktiv
      </span>
    `;
  }

  function renderRow(user) {
    const tr = document.createElement('tr');
    tr.dataset.userId = user.id;
    tr.innerHTML = `
      <td><span class="md3-body-medium">${escapeHtml(user.username)}</span></td>
      <td><span class="md3-body-small">${escapeHtml(user.email || '-')}</span></td>
      <td>${renderRoleBadge(user.role)}</td>
      <td>${renderStatusBadge(user.is_active)}</td>
      <td class="md3-hide-mobile"><span class="md3-body-small">${formatDate(user.created_at)}</span></td>
      <td class="md3-table__actions">
        <button class="md3-button md3-button--icon edit-user-btn" data-id="${user.id}" title="Benutzer bearbeiten" aria-label="Benutzer bearbeiten">
          <span class="material-symbols-rounded">edit</span>
        </button>
      </td>
    `;
    return tr;
  }

  function reload() {
    listBody.innerHTML = '<tr class="md3-table__empty-row"><td colspan="6"><div class="md3-empty-inline"><span class="material-symbols-rounded" aria-hidden="true">hourglass_empty</span><span>Lade...</span></div></td></tr>';
    
    const params = new URLSearchParams();
    if (includeInactive) {
      params.set('include_inactive', '1');
    }
    const q = searchInput?.value?.trim();
    if (q) {
      params.set('q', q);
    }
    
    const url = '/api/admin/users' + (params.toString() ? '?' + params.toString() : '');
    
    fetch(url, { credentials: 'same-origin' })
      .then(handleJsonResponse)
      .then((data) => {
        listBody.innerHTML = '';
        if (!data.items || data.items.length === 0) {
          listBody.innerHTML = `
            <tr class="md3-table__empty-row">
              <td colspan="6">
                <div class="md3-empty-inline">
                  <span class="material-symbols-rounded" aria-hidden="true">person_off</span>
                  <span>Keine Benutzer gefunden.</span>
                </div>
              </td>
            </tr>
          `;
          return;
        }
        data.items.forEach(user => {
          listBody.appendChild(renderRow(user));
        });
        
        attachRowEventListeners();
      })
      .catch((err) => {
        console.error(err);
        listBody.innerHTML = '<tr><td colspan="6" class="md3-text-center md3-text-error">Fehler beim Laden der Benutzer.</td></tr>';
      });
  }

  function attachRowEventListeners() {
    // Edit button handlers
    document.querySelectorAll('.edit-user-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const uid = e.currentTarget.dataset.id;
        openEditDialog(uid);
      });
    });
  }

  // Edit Dialog Functions
  function openEditDialog(userId) {
    // Reset form state
    if (editError) editError.hidden = true;
    if (editEmailError) editEmailError.textContent = '';
    if (editEmail) editEmail.classList.remove('md3-outlined-textfield__input--error');
    
    // Fetch user data
    fetch(`/api/admin/users/${encodeURIComponent(userId)}`, { credentials: 'same-origin' })
      .then(handleJsonResponse)
      .then(data => {
        if (data.error) {
          throw new Error(data.error);
        }
        
        // Populate form
        if (editUserId) editUserId.value = data.id;
        if (editUsername) editUsername.value = data.username;
        if (editEmail) editEmail.value = data.email || '';
        if (editRole) editRole.value = data.role;
        if (editIsActive) editIsActive.checked = data.is_active;
        
        // Add floating label class if email has value
        updateFloatingLabel(editEmail);
        
        // Open dialog
        if (editDialog) {
          try { editDialog.showModal(); } catch (e) { editDialog.setAttribute('open', 'true'); }
        }
      })
      .catch(err => {
        console.error('Error loading user:', err);
        showSnackbar('Fehler beim Laden der Benutzerdaten.', 'error');
      });
  }

  function updateFloatingLabel(input) {
    if (!input) return;
    const textfield = input.closest('.md3-outlined-textfield');
    const label = textfield?.querySelector('.md3-outlined-textfield__label');
    if (label) {
      if (input.value) {
        label.classList.add('md3-outlined-textfield__label--floating');
      } else {
        label.classList.remove('md3-outlined-textfield__label--floating');
      }
    }
  }

  function validateEmail(email) {
    if (!email) return true; // Empty is valid (optional)
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(email);
  }

  function saveEdit() {
    const userId = editUserId?.value;
    const email = editEmail?.value?.trim() || '';
    const role = editRole?.value;
    const isActive = editIsActive?.checked;
    
    // Client-side validation
    if (email && !validateEmail(email)) {
      if (editEmailError) editEmailError.textContent = 'Ungültiges E-Mail-Format';
      if (editEmail) editEmail.classList.add('md3-outlined-textfield__input--error');
      return;
    }
    
    if (editEmailError) editEmailError.textContent = '';
    if (editEmail) editEmail.classList.remove('md3-outlined-textfield__input--error');
    if (editError) editError.hidden = true;
    
    // Disable save button during request
    if (saveEditBtn) {
      saveEditBtn.disabled = true;
      saveEditBtn.innerHTML = '<span class="material-symbols-rounded md3-button__icon md3-button__icon--loading" aria-hidden="true">progress_activity</span>Speichern...';
    }
    
    fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json', 
        'Accept': 'application/json',
        'X-CSRF-TOKEN': getCsrfToken()
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        email: email || null,
        role: role,
        is_active: isActive
      })
    })
    .then(handleJsonResponse)
    .then(resp => {
      if (saveEditBtn) {
        saveEditBtn.disabled = false;
        saveEditBtn.innerHTML = 'Speichern';
      }
      
      if (resp.ok) {
        if (editDialog) {
          try { editDialog.close(); } catch (e) { editDialog.removeAttribute('open'); }
        }
        reload();
        showSnackbar('Benutzer wurde aktualisiert.', 'success');
      } else {
        // Show error in dialog
        const errorMsg = resp.message || resp.error || 'Unbekannter Fehler';
        if (editError) {
          const msgEl = editError.querySelector('.md3-alert__message');
          if (msgEl) msgEl.textContent = errorMsg;
          editError.hidden = false;
        }
      }
    })
    .catch(err => {
      if (saveEditBtn) {
        saveEditBtn.disabled = false;
        saveEditBtn.innerHTML = 'Speichern';
      }
      console.error('Save error:', err);
      if (editError) {
        const msgEl = editError.querySelector('.md3-alert__message');
        if (msgEl) msgEl.textContent = 'Netzwerkfehler beim Speichern.';
        editError.hidden = false;
      }
    });
  }

  function resetPasswordFromEditDialog() {
    const userId = editUserId?.value;
    if (!userId) return;
    
    // Disable button during request
    if (editResetPasswordBtn) {
      editResetPasswordBtn.disabled = true;
      editResetPasswordBtn.innerHTML = '<span class="material-symbols-rounded md3-button__icon md3-button__icon--loading" aria-hidden="true">progress_activity</span>Wird gesendet...';
    }
    
    fetch(`/api/admin/users/${encodeURIComponent(userId)}/reset-password`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Accept': 'application/json',
        'X-CSRF-TOKEN': getCsrfToken()
      },
      credentials: 'same-origin'
    })
    .then(handleJsonResponse)
    .then(resp => {
      if (editResetPasswordBtn) {
        editResetPasswordBtn.disabled = false;
        editResetPasswordBtn.innerHTML = '<span class="material-symbols-rounded md3-button__icon" aria-hidden="true">mail</span>Passwort zurücksetzen';
      }
      
      if (resp.ok && resp.inviteLink) {
        // Show the invite link dialog
        if (inviteLinkCode) inviteLinkCode.textContent = resp.inviteLink;
        if (inviteMeta && resp.inviteExpiresAt) {
          inviteMeta.textContent = `Gültig bis: ${new Date(resp.inviteExpiresAt).toLocaleString('de-DE')}`;
        } else if (inviteMeta) {
          inviteMeta.textContent = '';
        }
        // Close edit dialog first, then show invite dialog
        if (editDialog) {
          try { editDialog.close(); } catch (e) { editDialog.removeAttribute('open'); }
        }
        if (inviteDialog) inviteDialog.showModal();
      } else if (resp.ok) {
        showSnackbar('Passwort-Reset wurde erstellt.', 'success');
      } else {
        showSnackbar('Fehler: ' + (resp.error || 'Unbekannter Fehler'), 'error');
      }
    })
    .catch(err => {
      if (editResetPasswordBtn) {
        editResetPasswordBtn.disabled = false;
        editResetPasswordBtn.innerHTML = '<span class="material-symbols-rounded md3-button__icon" aria-hidden="true">mail</span>Passwort zurücksetzen';
      }
      console.error('Reset error:', err);
      showSnackbar('Netzwerkfehler beim Zurücksetzen.', 'error');
    });
  }

  // Snackbar function (fallback if core module not available)
  function showSnackbar(message, type = 'success') {
    // Check if the core snackbar module is available
    if (window.showSnackbar) {
      window.showSnackbar(message, type);
      return;
    }
    
    // Fallback: create a basic snackbar
    const existing = document.querySelector('.md3-snackbar');
    if (existing) existing.remove();
    
    const snackbar = document.createElement('div');
    snackbar.className = `md3-snackbar md3-snackbar--${type}`;
    snackbar.setAttribute('role', 'status');
    snackbar.setAttribute('aria-live', 'polite');
    
    const iconMap = { success: 'check_circle', error: 'error', info: 'info' };
    snackbar.innerHTML = `
      <span class="material-symbols-rounded md3-snackbar__icon" aria-hidden="true">${iconMap[type] || 'info'}</span>
      <span class="md3-snackbar__message">${escapeHtml(message)}</span>
      <button class="md3-snackbar__action" type="button" aria-label="Schließen">OK</button>
    `;
    
    document.body.appendChild(snackbar);
    requestAnimationFrame(() => snackbar.classList.add('visible'));
    
    const dismiss = () => {
      snackbar.classList.remove('visible');
      setTimeout(() => snackbar.remove(), 300);
    };
    
    snackbar.querySelector('.md3-snackbar__action').addEventListener('click', dismiss);
    setTimeout(dismiss, 4000);
  }

  // Event Listeners
  if (refreshBtn) refreshBtn.addEventListener('click', reload);
  
  // Filter chip toggle
  if (filterInactiveBtn) {
    filterInactiveBtn.addEventListener('click', () => {
      includeInactive = !includeInactive;
      filterInactiveBtn.classList.toggle('md3-chip--selected', includeInactive);
      filterInactiveBtn.setAttribute('aria-pressed', includeInactive.toString());
      
      // Update icon
      const icon = filterInactiveBtn.querySelector('.md3-chip__icon');
      if (icon) {
        icon.textContent = includeInactive ? 'visibility' : 'visibility_off';
      }
      
      reload();
    });
  }
  
  // Search input with debounce
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(reload, 300);
    });
  }
  
  // Copy invite link
  if (copyInviteBtn && inviteLinkCode) {
    copyInviteBtn.addEventListener('click', () => {
      const text = inviteLinkCode.textContent || inviteLinkCode.innerText || '';
      navigator.clipboard.writeText(text).then(() => {
        const originalIcon = copyInviteBtn.innerHTML;
        copyInviteBtn.innerHTML = '<span class="material-symbols-rounded">check</span>';
        const status = document.getElementById('invite-copy-status');
        if (status) status.textContent = 'Invite-Link in die Zwischenablage kopiert.';
        setTimeout(() => {
          copyInviteBtn.innerHTML = originalIcon;
          if (status) status.textContent = '';
        }, 2000);
      }).catch(err => {
        const status = document.getElementById('invite-copy-status');
        if (status) status.textContent = 'Kopieren fehlgeschlagen.';
        console.error('Clipboard error', err);
      });
    });
  }
  
  // Create user dialog
  if (createBtn && createDialog) {
    createBtn.addEventListener('click', () => {
      createForm.reset();
      createDialog.showModal();
      const first = document.getElementById('new-username');
      if (first) {
        setTimeout(() => first.focus(), 40);
      }
    });
  }

  if (cancelCreateBtn && createDialog) {
    cancelCreateBtn.addEventListener('click', () => {
      createDialog.close();
    });
  }

  if (createForm) {
    createForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(createForm);
      const data = Object.fromEntries(formData.entries());

      fetch('/api/admin/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Accept': 'application/json',
          'X-CSRF-TOKEN': getCsrfToken()
        },
        credentials: 'same-origin',
        body: JSON.stringify(data),
      })
      .then(handleJsonResponse)
      .then(resp => {
        if (resp.ok) {
          createDialog.close();
          reload();
          if (resp.inviteLink) {
            inviteLinkCode.textContent = resp.inviteLink;
            if (resp.inviteExpiresAt) {
              inviteMeta.textContent = `Gültig bis: ${new Date(resp.inviteExpiresAt).toLocaleString('de-DE')}`;
            } else {
              inviteMeta.textContent = '';
            }
            inviteDialog.showModal();
          } else {
            showSnackbar('Benutzer angelegt.', 'success');
          }
        } else {
          showSnackbar('Fehler: ' + (resp.error || 'Unbekannter Fehler'), 'error');
        }
      })
      .catch(err => {
        console.error(err);
        showSnackbar('Netzwerkfehler beim Anlegen des Benutzers.', 'error');
      });
    });
  }

  if (closeInviteBtn && inviteDialog) {
    closeInviteBtn.addEventListener('click', () => {
      inviteDialog.close();
      inviteLinkCode.textContent = '';
      if (inviteMeta) inviteMeta.textContent = '';
    });
  }

  // Edit dialog handlers
  if (cancelEditBtn && editDialog) {
    cancelEditBtn.addEventListener('click', () => {
      try { editDialog.close(); } catch (e) { editDialog.removeAttribute('open'); }
    });
  }

  if (saveEditBtn) {
    saveEditBtn.addEventListener('click', saveEdit);
  }

  if (editResetPasswordBtn) {
    editResetPasswordBtn.addEventListener('click', resetPasswordFromEditDialog);
  }

  // Update floating labels on input
  if (editEmail) {
    editEmail.addEventListener('input', () => updateFloatingLabel(editEmail));
    editEmail.addEventListener('focus', () => {
      const label = editEmail.closest('.md3-outlined-textfield')?.querySelector('.md3-outlined-textfield__label');
      if (label) label.classList.add('md3-outlined-textfield__label--floating');
    });
    editEmail.addEventListener('blur', () => updateFloatingLabel(editEmail));
  }

  // Close dialogs on backdrop click
  [createDialog, inviteDialog, editDialog].forEach(dialog => {
    if (dialog) {
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
          dialog.close();
        }
      });
    }
  });

  // Initial load
  reload();
});
