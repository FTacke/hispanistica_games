/**
 * Editor Overview Functionality
 * Handles tab switching for country tables.
 */

export function initEditorOverview() {
  // Tab-Switching
  document.querySelectorAll('.md3-country-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const country = tab.dataset.country;
      
      // Update active tab
      document.querySelectorAll('.md3-country-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      
      // Show corresponding table
      document.querySelectorAll('.md3-files-table-container').forEach(container => {
        container.classList.toggle('active', container.id === 'table-' + country);
      });
    });
  });
}

// Auto-init
document.addEventListener('DOMContentLoaded', initEditorOverview);
