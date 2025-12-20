// ============================================
// Swipe Gestures für Modal Drawer
// ============================================
// Wisch-Öffnen vom linken Rand (> 0px und ≤ 24px Touch-Zone)
// → Verhindert Konflikte mit iOS/Android System-Back-Gesten am äußersten Rand
// Wisch-Schließen auf Scrim oder im Drawer nach links

export class SwipeGestureHandler {
  constructor(drawer, mediaQuery) {
    this.drawer = drawer;
    this.mediaQuery = mediaQuery;
    this.isSwipeActive = false;
    this.swipeDirection = null; // 'open' | 'close' | null
    this.startX = null;
    this.startY = null;
    this.currentX = null;
    this.currentY = null;
    
    // Edge-Zone: 0px < startX <= 24px
    // Damit bleibt der äußerste Rand (0-2px) für System-Gesten frei
    this.edgeZoneMin = 2;   // Minimum vom linken Rand (System-Gesten frei lassen)
    this.edgeZoneMax = 24;  // Maximum vom linken Rand für Swipe-Erkennung
    this.threshold = 40;    // Mindest-Swipe-Distanz nach rechts
    this.verticalTolerance = 1.0; // deltaY darf maximal deltaX * factor sein

    this.init();
  }

  init() {
    // Touch Start: Detect edge swipe
    document.addEventListener("touchstart", (e) => this.handleTouchStart(e), {
      passive: true, // passive: true für bessere Scroll-Performance
    });

    // Touch Move: Track swipe
    document.addEventListener("touchmove", (e) => this.handleTouchMove(e), {
      passive: false, // passive: false um preventDefault() zu ermöglichen
    });

    // Touch End: Complete swipe
    document.addEventListener("touchend", () => this.handleTouchEnd());

    // Touch Cancel: Reset
    document.addEventListener("touchcancel", () => this.reset());
  }

  handleTouchStart(e) {
    // Nur auf Compact/Medium (< 840px) aktiv
    if (!this.mediaQuery.matches) return;

    const touch = e.touches[0];
    this.startX = touch.clientX;
    this.startY = touch.clientY;
    this.currentX = this.startX;
    this.currentY = this.startY;

    // Wisch-Öffnen: Nur wenn Drawer geschlossen und Touch im Edge-Bereich
    // Edge-Bereich: > edgeZoneMin und <= edgeZoneMax (System-Gesten am Rand frei)
    if (!this.drawer.open && 
        this.startX > this.edgeZoneMin && 
        this.startX <= this.edgeZoneMax) {
      this.isSwipeActive = true;
      this.swipeDirection = 'open';
    }

    // Wisch-Schließen: Wenn Drawer offen
    if (this.drawer.open) {
      this.isSwipeActive = true;
      this.swipeDirection = 'close';
    }
  }

  handleTouchMove(e) {
    if (!this.isSwipeActive) return;

    const touch = e.touches[0];
    this.currentX = touch.clientX;
    this.currentY = touch.clientY;

    const deltaX = this.currentX - this.startX;
    const deltaY = Math.abs(this.currentY - this.startY);

    // Vertikales Scrollen: Geste abbrechen wenn mehr vertikal als horizontal
    // Das ermöglicht normales Scrollen und verhindert versehentliche Drawer-Öffnung
    if (deltaY > Math.abs(deltaX) * this.verticalTolerance) {
      this.reset();
      return;
    }

    // Für Öffnen: Nur bei Rechtswisch preventDefault
    if (this.swipeDirection === 'open' && deltaX > 10) {
      e.preventDefault();
    }

    // Für Schließen: Nur bei Linkswisch preventDefault
    if (this.swipeDirection === 'close' && deltaX < -10) {
      e.preventDefault();
    }
  }

  handleTouchEnd() {
    if (!this.isSwipeActive || this.startX === null || this.currentX === null) {
      this.reset();
      return;
    }

    const deltaX = this.currentX - this.startX;
    const deltaY = Math.abs(this.currentY - this.startY);

    // Final Check: Geste muss eher horizontal als vertikal sein
    if (deltaY > Math.abs(deltaX)) {
      this.reset();
      return;
    }

    // Wisch nach rechts (öffnen) - nur wenn Drawer geschlossen
    if (this.swipeDirection === 'open' && !this.drawer.open && deltaX > this.threshold) {
      this.openDrawer();
    }

    // Wisch nach links (schließen) - nur wenn Drawer offen
    if (this.swipeDirection === 'close' && this.drawer.open && deltaX < -this.threshold) {
      this.closeDrawer();
    }

    this.reset();
  }

  reset() {
    this.isSwipeActive = false;
    this.swipeDirection = null;
    this.startX = null;
    this.startY = null;
    this.currentX = null;
    this.currentY = null;
  }

  openDrawer() {
    // Direkt die Drawer-Instanz nutzen wenn verfügbar
    if (window.__drawerInstance && typeof window.__drawerInstance.open === 'function') {
      window.__drawerInstance.open();
      return;
    }
    
    // Fallback: Open-Button triggern
    const openButton = document.querySelector('[data-action="open-drawer"]');
    if (openButton) {
      openButton.click();
    }
  }

  closeDrawer() {
    // Direkt die Drawer-Instanz nutzen wenn verfügbar
    if (window.__drawerInstance && typeof window.__drawerInstance.close === 'function') {
      window.__drawerInstance.close();
      return;
    }
    
    // Fallback: Dialog direkt schließen
    if (this.drawer.open) {
      // Trigger click auf den Dialog selbst (Light Dismiss)
      this.drawer.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  }
}

/**
 * Initialize swipe gestures
 * @param {HTMLDialogElement} drawer - The modal drawer dialog element
 * @param {MediaQueryList} mediaQuery - Media query for mobile breakpoint
 * @returns {SwipeGestureHandler} The gesture handler instance
 */
export function initSwipeGestures(drawer, mediaQuery) {
  return new SwipeGestureHandler(drawer, mediaQuery);
}
