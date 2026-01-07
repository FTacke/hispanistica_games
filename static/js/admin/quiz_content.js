/**
 * Quiz Content Admin Dashboard
 * 
 * Handles:
 * - Unit uploads (JSON + media files)
 * - Release management (import, publish, unpublish)
 * - Unit metadata editing (is_active, order_index)
 */

// =============================================================================
// State Management
// =============================================================================

const state = {
  releases: [],
  units: [],
  selectedRelease: null,
  pendingChanges: new Map(), // slug -> {is_active, order_index}
  includeInactive: false,
  searchQuery: '',
};

// =============================================================================
// DOM Elements
// =============================================================================

const DOM = {
  // Upload section
  uploadForm: document.getElementById('upload-form'),
  unitJsonInput: document.getElementById('unit-json'),
  mediaFilesInput: document.getElementById('media-files'),
  jsonPreview: document.getElementById('json-preview'),
  previewSlug: document.getElementById('preview-slug'),
  previewTitle: document.getElementById('preview-title'),
  previewQuestions: document.getElementById('preview-questions'),
  mediaRefs: document.getElementById('media-refs'),
  mediaRefsList: document.getElementById('media-refs-list'),
  uploadErrors: document.getElementById('upload-errors'),
  uploadErrorMessage: document.getElementById('upload-error-message'),
  resetUpload: document.getElementById('reset-upload'),
  submitUpload: document.getElementById('submit-upload'),

  // Release section
  releaseSelect: document.getElementById('release-select'),
  refreshReleases: document.getElementById('refresh-releases'),
  releaseInfo: document.getElementById('release-info'),
  releaseIdDisplay: document.getElementById('release-id-display'),
  releaseStatusBadge: document.getElementById('release-status-badge'),
  releaseUnitsCount: document.getElementById('release-units-count'),
  releaseQuestionsCount: document.getElementById('release-questions-count'),
  releaseAudioCount: document.getElementById('release-audio-count'),
  releaseImportedAt: document.getElementById('release-imported-at'),
  releasePublishedAt: document.getElementById('release-published-at'),
  releaseActionResult: document.getElementById('release-action-result'),
  btnImport: document.getElementById('btn-import'),
  btnPublish: document.getElementById('btn-publish'),
  btnUnpublish: document.getElementById('btn-unpublish'),
  logViewer: document.getElementById('log-viewer'),
  logContent: document.getElementById('log-content'),

  // Units section
  unitsSearch: document.getElementById('units-search'),
  refreshUnits: document.getElementById('refresh-units'),
  saveUnits: document.getElementById('save-units'),
  filterInactive: document.getElementById('filter-inactive'),
  unitsBody: document.getElementById('units-body'),
  unitsActionResult: document.getElementById('units-action-result'),

  // Dialogs
  confirmDialog: document.getElementById('confirm-dialog'),
  confirmTitle: document.getElementById('confirm-title'),
  confirmMessage: document.getElementById('confirm-message'),
  confirmCancel: document.getElementById('confirm-cancel'),
  confirmOk: document.getElementById('confirm-ok'),
};

// =============================================================================
// API Functions
// =============================================================================

/**
 * Get CSRF token from cookie.
 * Required for POST/PATCH/PUT/DELETE requests with JWT-in-cookies.
 */
function getCsrfToken() {
  const match = document.cookie.match(/csrf_access_token=([^;]+)/);
  const token = match ? match[1] : '';
  
  // DEBUG: Log CSRF token availability (only in dev)
  if (!token && console && console.warn) {
    console.warn('[CSRF Debug] csrf_access_token cookie not found! Available cookies:', 
      document.cookie.split(';').map(c => c.trim().split('=')[0]).join(', '));
  }
  
  return token;
}

/**
 * Debug log for mutating requests (only in dev).
 * Helps diagnose missing CSRF tokens.
 */
function debugLogRequest(method, url, headers) {
  if (!console || !console.log) return;
  
  const hasCsrf = headers && headers['X-CSRF-TOKEN'];
  const csrfValue = hasCsrf ? headers['X-CSRF-TOKEN'].substring(0, 20) + '...' : 'MISSING';
  
  console.log(`[Admin API] ${method} ${url} | X-CSRF-TOKEN: ${hasCsrf ? '✓' : '✗'} (${csrfValue})`);
}

const API = {
  baseUrl: '/quiz-admin/api',

  /**
   * Parse JSON response with proper error handling.
   * Throws descriptive error if response is not OK or not JSON.
   */
  async _handleResponse(response) {
    // Handle 204 No Content (successful empty response)
    if (response.status === 204) {
      return { ok: true };
    }

    // Check HTTP status first
    if (!response.ok) {
      // For non-JSON responses (e.g., 401 redirects), extract text
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
        throw new Error(`HTTP ${response.status}: Server returned non-JSON response (likely authentication redirect)`);
      }
      
      // Try to parse JSON error response
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
  },

  async get(endpoint) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Accept': 'application/json',
      },
      credentials: 'same-origin',
    });
    return this._handleResponse(response);
  },

  async post(endpoint, data = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-CSRF-TOKEN': getCsrfToken(),
    };
    
    debugLogRequest('POST', `${this.baseUrl}${endpoint}`, headers);
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      credentials: 'same-origin',
      body: JSON.stringify(data),
    });
    return this._handleResponse(response);
  },

  async patch(endpoint, data = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-CSRF-TOKEN': getCsrfToken(),
    };
    
    debugLogRequest('PATCH', `${this.baseUrl}${endpoint}`, headers);
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PATCH',
      headers,
      credentials: 'same-origin',
      body: JSON.stringify(data),
    });
    return this._handleResponse(response);
  },

  async delete(endpoint) {
    const headers = {
      'Accept': 'application/json',
      'X-CSRF-TOKEN': getCsrfToken(),
    };
    
    debugLogRequest('DELETE', `${this.baseUrl}${endpoint}`, headers);
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers,
      credentials: 'same-origin',
    });
    return this._handleResponse(response);
  },

  async upload(formData) {
    const headers = {
      'X-CSRF-TOKEN': getCsrfToken(),
      // NOTE: Do NOT set Content-Type for FormData - browser sets it with boundary
    };
    
    debugLogRequest('POST', `${this.baseUrl}/upload-unit`, headers);
    
    const response = await fetch(`${this.baseUrl}/upload-unit`, {
      method: 'POST',
      headers,
      credentials: 'same-origin',
      body: formData,
    });
    return this._handleResponse(response);
  },
};

// =============================================================================
// Releases
// =============================================================================

async function loadReleases() {
  try {
    const data = await API.get('/releases');
    state.releases = data.items || [];
    renderReleasesDropdown();
  } catch (error) {
    console.error('Failed to load releases:', error);
    showReleaseActionResult(`Fehler beim Laden: ${error.message}`, 'error');
  }
}

function renderReleasesDropdown() {
  const select = DOM.releaseSelect;
  select.innerHTML = '';

  if (state.releases.length === 0) {
    select.innerHTML = '<option value="">-- Keine Releases vorhanden --</option>';
    return;
  }

  select.innerHTML = '<option value="">-- Release auswählen --</option>';
  
  for (const release of state.releases) {
    const option = document.createElement('option');
    option.value = release.release_id;
    const statusIcon = release.status === 'published' ? '✓' : release.status === 'draft' ? '○' : '×';
    option.textContent = `${statusIcon} ${release.release_id} (${release.status})`;
    select.appendChild(option);
  }
}

function selectRelease(releaseId) {
  state.selectedRelease = state.releases.find(r => r.release_id === releaseId) || null;
  renderReleaseInfo();
  updateReleaseButtons();
  loadReleaseLogs();
}

function renderReleaseInfo() {
  if (!state.selectedRelease) {
    DOM.releaseInfo.style.display = 'none';
    return;
  }

  const r = state.selectedRelease;
  DOM.releaseInfo.style.display = 'block';
  DOM.releaseIdDisplay.textContent = r.release_id;
  
  // Status badge
  DOM.releaseStatusBadge.textContent = r.status;
  DOM.releaseStatusBadge.className = `md3-badge md3-badge--status-${r.status}`;

  // Counts
  DOM.releaseUnitsCount.textContent = r.units_count || 0;
  DOM.releaseQuestionsCount.textContent = r.questions_count || 0;
  DOM.releaseAudioCount.textContent = r.audio_count || 0;

  // Timestamps
  DOM.releaseImportedAt.textContent = r.imported_at 
    ? `Importiert: ${formatDateTime(r.imported_at)}` 
    : 'Noch nicht importiert';
  DOM.releasePublishedAt.textContent = r.published_at 
    ? `Veröffentlicht: ${formatDateTime(r.published_at)}` 
    : '';
}

function updateReleaseButtons() {
  const r = state.selectedRelease;
  const hasSelection = !!r;
  
  DOM.btnImport.disabled = !hasSelection;
  DOM.btnPublish.disabled = !hasSelection || r.status === 'published' || !r.imported_at;
  DOM.btnUnpublish.disabled = !hasSelection || r.status !== 'published';
}

async function loadReleaseLogs() {
  if (!state.selectedRelease) {
    DOM.logContent.textContent = 'Kein Release ausgewählt.';
    return;
  }

  try {
    const data = await API.get(`/logs/${state.selectedRelease.release_id}`);
    DOM.logContent.textContent = data.logs || 'Kein Log vorhanden.';
  } catch (error) {
    DOM.logContent.textContent = `Fehler beim Laden: ${error.message}`;
  }
}

async function importRelease() {
  if (!state.selectedRelease) return;

  const releaseId = state.selectedRelease.release_id;
  showReleaseActionResult('Import wird ausgeführt...', 'loading');
  
  DOM.btnImport.disabled = true;
  DOM.btnImport.innerHTML = '<span class="material-symbols-rounded md3-spinner">progress_activity</span> Importiere...';

  try {
    const result = await API.post(`/releases/${releaseId}/import`);
    
    if (result.ok) {
      showReleaseActionResult(
        `✓ Import erfolgreich: ${result.units_imported} Units, ${result.questions_imported} Fragen`,
        'success'
      );
      await loadReleases();
      selectRelease(releaseId);
      loadUnits();
    } else {
      showReleaseActionResult(`Fehler: ${result.errors?.join(', ') || result.error}`, 'error');
    }
  } catch (error) {
    showReleaseActionResult(`Fehler: ${error.message}`, 'error');
  } finally {
    DOM.btnImport.innerHTML = '<span class="material-symbols-rounded md3-button__icon">download</span> Import (Draft)';
    updateReleaseButtons();
  }
}

async function publishRelease() {
  if (!state.selectedRelease) return;

  const confirmed = await showConfirmDialog(
    'Release veröffentlichen?',
    `Möchten Sie "${state.selectedRelease.release_id}" wirklich veröffentlichen? Dies ersetzt den aktuell veröffentlichten Content.`
  );
  if (!confirmed) return;

  const releaseId = state.selectedRelease.release_id;
  showReleaseActionResult('Veröffentlichung wird ausgeführt...', 'loading');

  DOM.btnPublish.disabled = true;
  DOM.btnPublish.innerHTML = '<span class="material-symbols-rounded md3-spinner">progress_activity</span> Veröffentliche...';

  try {
    const result = await API.post(`/releases/${releaseId}/publish`);
    
    if (result.ok) {
      showReleaseActionResult(`✓ Veröffentlicht: ${result.units_affected} Units aktiv`, 'success');
      await loadReleases();
      selectRelease(releaseId);
      loadUnits();
    } else {
      showReleaseActionResult(`Fehler: ${result.errors?.join(', ') || result.error}`, 'error');
    }
  } catch (error) {
    showReleaseActionResult(`Fehler: ${error.message}`, 'error');
  } finally {
    DOM.btnPublish.innerHTML = '<span class="material-symbols-rounded md3-button__icon">publish</span> Publish';
    updateReleaseButtons();
  }
}

async function unpublishRelease() {
  if (!state.selectedRelease) return;

  const confirmed = await showConfirmDialog(
    'Release zurückziehen?',
    `Möchten Sie "${state.selectedRelease.release_id}" wirklich zurückziehen? Die zugehörigen Units werden nicht mehr angezeigt.`
  );
  if (!confirmed) return;

  const releaseId = state.selectedRelease.release_id;
  showReleaseActionResult('Wird zurückgezogen...', 'loading');

  try {
    const result = await API.post(`/releases/${releaseId}/unpublish`);
    
    if (result.ok) {
      showReleaseActionResult(`✓ Zurückgezogen: ${result.units_affected} Units betroffen`, 'success');
      await loadReleases();
      selectRelease(releaseId);
      loadUnits();
    } else {
      showReleaseActionResult(`Fehler: ${result.errors?.join(', ') || result.error}`, 'error');
    }
  } catch (error) {
    showReleaseActionResult(`Fehler: ${error.message}`, 'error');
  } finally {
    updateReleaseButtons();
  }
}

function showReleaseActionResult(message, type) {
  DOM.releaseActionResult.style.display = 'block';
  DOM.releaseActionResult.className = `md3-action-result md3-action-result--${type}`;
  DOM.releaseActionResult.textContent = message;
  
  if (type !== 'loading') {
    setTimeout(() => {
      DOM.releaseActionResult.style.display = 'none';
    }, 5000);
  }
}

// =============================================================================
// Units
// =============================================================================

async function loadUnits() {
  try {
    const params = new URLSearchParams();
    if (state.includeInactive) params.set('include_inactive', '1');
    if (state.searchQuery) params.set('search', state.searchQuery);
    
    const data = await API.get(`/units?${params}`);
    state.units = data.items || [];
    renderUnitsTable();
  } catch (error) {
    console.error('Failed to load units:', error);
    DOM.unitsBody.innerHTML = `<tr><td colspan="7" class="md3-table__loading">Fehler: ${error.message}</td></tr>`;
  }
}

function renderUnitsTable() {
  if (state.units.length === 0) {
    DOM.unitsBody.innerHTML = '<tr><td colspan="7" class="md3-table__loading">Keine Units gefunden.</td></tr>';
    return;
  }

  DOM.unitsBody.innerHTML = state.units.map(unit => {
    const isInactive = !unit.is_active;
    const pending = state.pendingChanges.get(unit.slug) || {};
    const isActiveChecked = pending.is_active !== undefined ? pending.is_active : unit.is_active;
    const orderIndex = pending.order_index !== undefined ? pending.order_index : unit.order_index;

    return `
      <tr class="${isInactive ? 'md3-table__row--inactive' : ''}" data-slug="${escapeHtml(unit.slug)}">
        <td><code>${escapeHtml(unit.slug)}</code></td>
        <td>${escapeHtml(unit.title || '-')}</td>
        <td>
          <span class="md3-badge md3-badge--small ${unit.release_id ? 'md3-badge--status-draft' : ''}">
            ${unit.questions_count || 0} Fragen
          </span>
        </td>
        <td>
          <input type="checkbox" 
                 class="md3-checkbox" 
                 data-field="is_active" 
                 data-slug="${escapeHtml(unit.slug)}"
                 ${isActiveChecked ? 'checked' : ''}
                 aria-label="Aktiv">
        </td>
        <td>
          <input type="number" 
                 class="md3-input--small" 
                 data-field="order_index" 
                 data-slug="${escapeHtml(unit.slug)}"
                 value="${orderIndex}"
                 min="0"
                 aria-label="Reihenfolge">
        </td>
        <td class="md3-hide-mobile">
          <code class="md3-text-small">${unit.release_id ? escapeHtml(unit.release_id.substring(0, 20)) : 'Legacy'}</code>
        </td>
        <td>
          <button type="button" 
                  class="md3-button md3-button--text md3-button--danger md3-button--small"
                  data-action="delete"
                  data-slug="${escapeHtml(unit.slug)}"
                  ${isInactive ? 'disabled' : ''}>
            <span class="material-symbols-rounded">delete</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Add event listeners
  DOM.unitsBody.querySelectorAll('input[data-field]').forEach(input => {
    input.addEventListener('change', handleUnitFieldChange);
  });

  DOM.unitsBody.querySelectorAll('button[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', handleDeleteUnit);
  });
}

function handleUnitFieldChange(event) {
  const input = event.target;
  const slug = input.dataset.slug;
  const field = input.dataset.field;
  
  if (!state.pendingChanges.has(slug)) {
    state.pendingChanges.set(slug, {});
  }
  
  const pending = state.pendingChanges.get(slug);
  
  if (field === 'is_active') {
    pending.is_active = input.checked;
  } else if (field === 'order_index') {
    pending.order_index = parseInt(input.value, 10) || 0;
  }
  
  updateSaveButton();
}

function updateSaveButton() {
  DOM.saveUnits.disabled = state.pendingChanges.size === 0;
}

async function saveUnitChanges() {
  if (state.pendingChanges.size === 0) return;

  const updates = [];
  for (const [slug, changes] of state.pendingChanges) {
    updates.push({ slug, ...changes });
  }

  DOM.saveUnits.disabled = true;
  DOM.saveUnits.innerHTML = '<span class="material-symbols-rounded md3-spinner">progress_activity</span> Speichern...';

  try {
    const result = await API.patch('/units', { updates });
    
    if (result.ok) {
      showUnitsActionResult(`✓ ${result.updated_count} Änderungen gespeichert`, 'success');
      state.pendingChanges.clear();
      loadUnits();
    } else {
      showUnitsActionResult(`Fehler: ${result.error}`, 'error');
    }
  } catch (error) {
    showUnitsActionResult(`Fehler: ${error.message}`, 'error');
  } finally {
    DOM.saveUnits.innerHTML = '<span class="material-symbols-rounded md3-button__icon">save</span> Änderungen speichern';
    updateSaveButton();
  }
}

async function handleDeleteUnit(event) {
  const btn = event.currentTarget;
  const slug = btn.dataset.slug;

  const confirmed = await showConfirmDialog(
    'Unit deaktivieren?',
    `Möchten Sie "${slug}" wirklich deaktivieren? (Soft-Delete: is_active=false)`
  );
  if (!confirmed) return;

  try {
    const result = await API.delete(`/units/${slug}`);
    
    if (result.ok) {
      showUnitsActionResult(`✓ Unit "${slug}" deaktiviert`, 'success');
      loadUnits();
    } else {
      showUnitsActionResult(`Fehler: ${result.error}`, 'error');
    }
  } catch (error) {
    showUnitsActionResult(`Fehler: ${error.message}`, 'error');
  }
}

function showUnitsActionResult(message, type) {
  DOM.unitsActionResult.style.display = 'block';
  DOM.unitsActionResult.className = `md3-action-result md3-action-result--${type}`;
  DOM.unitsActionResult.textContent = message;
  
  setTimeout(() => {
    DOM.unitsActionResult.style.display = 'none';
  }, 5000);
}

// =============================================================================
// Upload
// =============================================================================

let uploadedJson = null;
let uploadedMediaFiles = [];

function handleJsonFileSelect(event) {
  const file = event.target.files[0];
  if (!file) {
    resetUploadPreview();
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      uploadedJson = JSON.parse(e.target.result);
      renderUploadPreview();
    } catch (error) {
      showUploadError(`JSON ungültig: ${error.message}`);
      uploadedJson = null;
      resetUploadPreview();
    }
  };
  reader.readAsText(file);
}

function handleMediaFilesSelect(event) {
  uploadedMediaFiles = Array.from(event.target.files).map(f => f.name);
  renderUploadPreview();
}

function renderUploadPreview() {
  if (!uploadedJson) {
    DOM.jsonPreview.style.display = 'none';
    DOM.submitUpload.disabled = true;
    DOM.resetUpload.disabled = true;
    return;
  }

  // Validate slug
  const slug = uploadedJson.slug || '';
  if (!slug) {
    showUploadError('Missing required field: slug');
    return;
  }

  if (!/^[a-z0-9_]+$/.test(slug)) {
    showUploadError(`Invalid slug format: "${slug}". Must be lowercase alphanumeric + underscore.`);
    return;
  }

  hideUploadError();
  DOM.jsonPreview.style.display = 'block';
  DOM.previewSlug.textContent = slug;
  DOM.previewTitle.textContent = uploadedJson.title || slug;
  DOM.previewQuestions.textContent = (uploadedJson.questions || []).length;

  // Extract audio references
  const audioRefs = extractAudioRefs(uploadedJson);
  
  if (audioRefs.length > 0) {
    DOM.mediaRefs.style.display = 'block';
    DOM.mediaRefsList.innerHTML = audioRefs.map(ref => {
      const filename = ref.split('/').pop();
      const found = uploadedMediaFiles.includes(filename);
      return `
        <li class="md3-media-ref ${found ? 'md3-media-ref--found' : 'md3-media-ref--missing'}">
          <span class="material-symbols-rounded">${found ? 'check_circle' : 'warning'}</span>
          <span>${escapeHtml(filename)}</span>
        </li>
      `;
    }).join('');
  } else {
    DOM.mediaRefs.style.display = 'none';
  }

  DOM.submitUpload.disabled = false;
  DOM.resetUpload.disabled = false;
}

function extractAudioRefs(json) {
  const refs = [];
  const questions = json.questions || [];
  
  for (const q of questions) {
    for (const media of q.media || []) {
      if (media.type === 'audio' && media.seed_src) {
        refs.push(media.seed_src);
      }
    }
    for (const answer of q.answers || []) {
      for (const media of answer.media || []) {
        if (media.type === 'audio' && media.seed_src) {
          refs.push(media.seed_src);
        }
      }
    }
  }
  
  return refs;
}

function resetUploadPreview() {
  uploadedJson = null;
  uploadedMediaFiles = [];
  DOM.jsonPreview.style.display = 'none';
  DOM.mediaRefs.style.display = 'none';
  DOM.submitUpload.disabled = true;
  DOM.resetUpload.disabled = true;
  DOM.uploadForm.reset();
  hideUploadError();
}

async function submitUpload(event) {
  event.preventDefault();
  
  if (!uploadedJson) return;

  const formData = new FormData(DOM.uploadForm);
  
  DOM.submitUpload.disabled = true;
  DOM.submitUpload.innerHTML = '<span class="material-symbols-rounded md3-spinner">progress_activity</span> Wird hochgeladen...';

  try {
    const result = await API.upload(formData);
    
    if (result.ok) {
      showUploadSuccess(`✓ Upload erfolgreich: Release "${result.release_id}" erstellt`);
      resetUploadPreview();
      loadReleases();
    } else {
      showUploadError(result.message || result.error);
    }
  } catch (error) {
    showUploadError(`Upload fehlgeschlagen: ${error.message}`);
  } finally {
    DOM.submitUpload.innerHTML = '<span class="material-symbols-rounded md3-button__icon">cloud_upload</span> Upload speichern';
    DOM.submitUpload.disabled = !uploadedJson;
  }
}

function showUploadError(message) {
  DOM.uploadErrors.style.display = 'flex';
  DOM.uploadErrorMessage.textContent = message;
  DOM.submitUpload.disabled = true;
}

function hideUploadError() {
  DOM.uploadErrors.style.display = 'none';
}

function showUploadSuccess(message) {
  // Reuse error container for success (styled differently)
  DOM.uploadErrors.style.display = 'flex';
  DOM.uploadErrors.classList.remove('md3-alert--error');
  DOM.uploadErrors.classList.add('md3-alert--success');
  DOM.uploadErrors.querySelector('.material-symbols-rounded').textContent = 'check_circle';
  DOM.uploadErrorMessage.textContent = message;
  
  setTimeout(() => {
    DOM.uploadErrors.style.display = 'none';
    DOM.uploadErrors.classList.add('md3-alert--error');
    DOM.uploadErrors.classList.remove('md3-alert--success');
    DOM.uploadErrors.querySelector('.material-symbols-rounded').textContent = 'error';
  }, 5000);
}

// =============================================================================
// Confirmation Dialog
// =============================================================================

function showConfirmDialog(title, message) {
  return new Promise((resolve) => {
    DOM.confirmTitle.textContent = title;
    DOM.confirmMessage.textContent = message;
    DOM.confirmDialog.showModal();

    const handleCancel = () => {
      DOM.confirmDialog.close();
      cleanup();
      resolve(false);
    };

    const handleOk = () => {
      DOM.confirmDialog.close();
      cleanup();
      resolve(true);
    };

    const cleanup = () => {
      DOM.confirmCancel.removeEventListener('click', handleCancel);
      DOM.confirmOk.removeEventListener('click', handleOk);
    };

    DOM.confirmCancel.addEventListener('click', handleCancel);
    DOM.confirmOk.addEventListener('click', handleOk);
  });
}

// =============================================================================
// Utilities
// =============================================================================

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateTime(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// =============================================================================
// Event Listeners
// =============================================================================

function initEventListeners() {
  // Upload section
  DOM.unitJsonInput.addEventListener('change', handleJsonFileSelect);
  DOM.mediaFilesInput.addEventListener('change', handleMediaFilesSelect);
  DOM.uploadForm.addEventListener('submit', submitUpload);
  DOM.resetUpload.addEventListener('click', resetUploadPreview);

  // Release section
  DOM.releaseSelect.addEventListener('change', (e) => selectRelease(e.target.value));
  DOM.refreshReleases.addEventListener('click', loadReleases);
  DOM.btnImport.addEventListener('click', importRelease);
  DOM.btnPublish.addEventListener('click', publishRelease);
  DOM.btnUnpublish.addEventListener('click', unpublishRelease);

  // Units section
  DOM.refreshUnits.addEventListener('click', loadUnits);
  DOM.saveUnits.addEventListener('click', saveUnitChanges);
  
  DOM.filterInactive.addEventListener('click', () => {
    state.includeInactive = !state.includeInactive;
    DOM.filterInactive.setAttribute('aria-pressed', state.includeInactive);
    DOM.filterInactive.classList.toggle('md3-chip--selected', state.includeInactive);
    loadUnits();
  });

  DOM.unitsSearch.addEventListener('input', debounce((e) => {
    state.searchQuery = e.target.value.trim();
    loadUnits();
  }, 300));
}

// =============================================================================
// Initialize
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadReleases();
  loadUnits();
});
