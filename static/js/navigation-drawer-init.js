/* Navigation drawer initialization - Accordion functionality */

/**
 * Initialize collapsible accordion functionality in both modal and standard drawers
 * Direct approach - attach event listeners to both drawer elements
 */
document.addEventListener('DOMContentLoaded', function() {
  console.log('[Drawer] Initializing accordion...');
  
  // Find both drawer elements
  const drawers = [
    document.querySelector('#navigation-drawer-modal .drawer__panel'),
    document.querySelector('#navigation-drawer-standard')
  ].filter(Boolean);
  
  if (drawers.length === 0) {
    console.error('[Drawer] ERROR: No drawers found!');
    return;
  }
  
  console.log('[Drawer] Found', drawers.length, 'drawer(s)');
  
  // Initialize each drawer
  drawers.forEach((drawer, index) => {
    console.log('[Drawer] Setting up drawer', index + 1, drawer);
    
    // Event Delegation: One listener per drawer for all triggers
    drawer.addEventListener('click', (e) => {
      const trigger = e.target.closest('.md3-navigation-drawer__trigger');
      if (!trigger) return;
      
      console.log('[Drawer] ✓ Trigger clicked:', trigger.id || trigger);
      
      const submenuId = trigger.getAttribute('aria-controls');
      if (!submenuId) return;
      
      const submenu = drawer.querySelector(`#${submenuId}`);
      if (!submenu) {
        console.error('[Drawer] ERROR: Submenu not found:', submenuId);
        return;
      }
      
      const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
      console.log('[Drawer] Current state:', isExpanded ? 'EXPANDED' : 'COLLAPSED');
      
      // Close all other submenus in this drawer (single-open mode)
      drawer.querySelectorAll('.md3-navigation-drawer__trigger[aria-expanded="true"]')
        .forEach(otherTrigger => {
          if (otherTrigger === trigger) return;
          
          const otherSubmenuId = otherTrigger.getAttribute('aria-controls');
          const otherSubmenu = otherSubmenuId ? drawer.querySelector(`#${otherSubmenuId}`) : null;
          
          if (otherSubmenu && otherSubmenu.hasAttribute('data-open')) {
            otherTrigger.setAttribute('aria-expanded', 'false');
            otherSubmenu.removeAttribute('data-open');
            otherSubmenu.setAttribute('aria-hidden', 'true');
          }
        });
      
      // Toggle current submenu
      if (!isExpanded) {
        // Open
        console.log('[Drawer] → OPENING submenu:', submenuId);
        trigger.setAttribute('aria-expanded', 'true');
        submenu.setAttribute('data-open', '');
        submenu.setAttribute('aria-hidden', 'false');
      } else {
        // Close
        console.log('[Drawer] → CLOSING submenu:', submenuId);
        trigger.setAttribute('aria-expanded', 'false');
        submenu.removeAttribute('data-open');
        submenu.setAttribute('aria-hidden', 'true');
      }
    });
  });
  
  console.log('[Drawer] ✅ Accordion initialization complete');
});
