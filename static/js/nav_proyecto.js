// nav_proyecto.js
// Minimal JS to toggle the Proyecto menu (desktop) and keep mobile burger behavior.
document.addEventListener("DOMContentLoaded", () => {
  // Triggers can be either the old .md3-nav__submenu-toggle or the new .md3-nav__trigger
  const submenuToggles = document.querySelectorAll(
    ".md3-nav__submenu-toggle, .md3-nav__trigger",
  );
  const navToggle = document.querySelector(
    ".md3-nav__mobile-toggle, .nav-toggle",
  );

  // Helper: close all submenus
  function closeAllSubmenus() {
    document.querySelectorAll(".md3-nav__submenu").forEach((s) => {
      s.hidden = true;
    });
    // Reset aria-expanded for any submenu toggles or triggers
    document
      .querySelectorAll(".md3-nav__submenu-toggle, .md3-nav__trigger")
      .forEach((t) => t.setAttribute("aria-expanded", "false"));
  }

  if (submenuToggles.length === 0) return;

  submenuToggles.forEach((toggle) => {
    const menuId = toggle.getAttribute("aria-controls");
    const menu = menuId ? document.getElementById(menuId) : null;
    if (!menu) return;

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      closeAllSubmenus();
      if (!expanded) {
        toggle.setAttribute("aria-expanded", "true");
        // Positioning: show menu and anchor it under the trigger using parent-relative coordinates
        menu.hidden = false;
        try {
          // place submenu at left:0 relative to its positioned parent and right below the trigger
          menu.style.position = "absolute";
          menu.style.left = "0px";
          // small gap of 6px
          menu.style.top = toggle.offsetHeight + 6 + "px";
        } catch (err) {
          // ignore in environments without layout
        }
        const items = Array.from(menu.querySelectorAll("a"));
        if (items.length) {
          items[0].focus();
        }
      }
    });

    // Keyboard navigation inside submenu
    menu.addEventListener("keydown", (e) => {
      const items = Array.from(menu.querySelectorAll("a"));
      if (!items.length) return;
      const currentIndex = items.indexOf(document.activeElement);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = items[(currentIndex + 1) % items.length];
        next.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = items[(currentIndex - 1 + items.length) % items.length];
        prev.focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        items[0].focus();
      } else if (e.key === "End") {
        e.preventDefault();
        items[items.length - 1].focus();
      }
    });
  });

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (
      !e.target.closest(".md3-nav__links") &&
      !e.target.closest(".md3-nav__submenu")
    ) {
      closeAllSubmenus();
    }
  });

  // Close on Esc
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllSubmenus();
    }
  });

  // If nav toggle (mobile) is used, ensure submenus hidden to avoid overlap
  navToggle &&
    navToggle.addEventListener("click", () => {
      closeAllSubmenus();
    });

  // Mobile accordion behavior
  document.querySelectorAll(".md3-mobile-accordion__trigger").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("aria-controls");
      const panel = id ? document.getElementById(id) : null;
      if (!panel) return;
      const expanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!expanded));
      if (expanded) {
        panel.hidden = true;
      } else {
        panel.hidden = false;
      }
    });
  });

  // Mobile bottom-sheet triggers (if present)
  document
    .querySelectorAll(".md3-mobile-bottomsheet-trigger")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("aria-controls");
        const panel = id ? document.getElementById(id) : null;
        if (!panel) return;
        panel.removeAttribute("hidden");
        document.body.style.overflow = "hidden";
      });
    });

  // Close bottom-sheet on backdrop or close button
  document.querySelectorAll(".md3-bottomsheet").forEach((sheet) => {
    const backdrop = sheet.querySelector(".md3-bottomsheet__backdrop");
    const closeBtn = sheet.querySelector(".md3-bottomsheet__close");
    const panel = sheet.querySelector(".md3-bottomsheet__panel");
    backdrop &&
      backdrop.addEventListener("click", () => {
        sheet.setAttribute("hidden", "");
        document.body.style.overflow = "";
      });
    closeBtn &&
      closeBtn.addEventListener("click", () => {
        sheet.setAttribute("hidden", "");
        document.body.style.overflow = "";
      });
  });
  const mobileSheetButtons = document.querySelectorAll(".md3-bottomsheet-open");
  function openBottomSheet(sheet) {
    sheet.removeAttribute("hidden");
    document.body.style.overflow = "hidden";
    // set focus to first focusable element inside
    const first = sheet.querySelector("a, button, [tabindex]");
    if (first) first.focus();
  }
  function closeBottomSheet(sheet) {
    sheet.setAttribute("hidden", "");
    document.body.style.overflow = "";
    // return focus to the trigger if stored
    const triggerId = sheet.dataset.triggerId;
    if (triggerId) {
      const trig = document.getElementById(triggerId);
      if (trig) trig.focus();
    }
  }
  mobileSheetButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const target = btn.dataset.target;
      const sheet = document.getElementById(target);
      if (!sheet) return;
      // store trigger id for focus return
      const triggerId =
        btn.id ||
        "md3-bsheet-trigger-" + Math.random().toString(36).slice(2, 8);
      btn.id = triggerId;
      sheet.dataset.triggerId = triggerId;
      openBottomSheet(sheet);
    });
  });

  // close handlers: backdrop buttons
  document.querySelectorAll(".md3-bottomsheet").forEach((sheet) => {
    const backdrop = sheet.querySelector(".md3-bottomsheet__backdrop");
    if (backdrop)
      backdrop.addEventListener("click", () => closeBottomSheet(sheet));
    const closeBtn = sheet.querySelector(".md3-bottomsheet__close");
    if (closeBtn)
      closeBtn.addEventListener("click", () => closeBottomSheet(sheet));
    // trap Escape
    sheet.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") closeBottomSheet(sheet);
    });
  });

  // New: mobile subdrawer (left sliding panel) handlers
  const subdrawerTriggers = document.querySelectorAll(
    ".md3-mobile-subdrawer-trigger",
  );
  function openSubdrawer(drawer, trigger) {
    drawer.removeAttribute("hidden");
    drawer.setAttribute("aria-hidden", "false");
    // store trigger id for focus return
    const triggerId =
      trigger.id ||
      "md3-subdrawer-trigger-" + Math.random().toString(36).slice(2, 8);
    trigger.id = triggerId;
    drawer.dataset.triggerId = triggerId;
    // set aria-expanded on trigger
    trigger.setAttribute("aria-expanded", "true");
    // focus first link inside
    const first = drawer.querySelector("a, button, [tabindex]");
    if (first) first.focus();
  }
  function closeSubdrawer(drawer) {
    drawer.setAttribute("hidden", "");
    drawer.setAttribute("aria-hidden", "true");
    // restore focus to trigger
    const triggerId = drawer.dataset.triggerId;
    if (triggerId) {
      const trig = document.getElementById(triggerId);
      if (trig) trig.setAttribute("aria-expanded", "false");
      if (trig) trig.focus();
    }
  }
  subdrawerTriggers.forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("aria-controls");
      const drawer = id ? document.getElementById(id) : null;
      if (!drawer) return;
      openSubdrawer(drawer, btn);
    });
  });

  document.querySelectorAll(".md3-subdrawer").forEach((drawer) => {
    const backdrop = drawer.querySelector(".md3-subdrawer__backdrop");
    const backBtn = drawer.querySelector(".md3-subdrawer__back");
    if (backdrop)
      backdrop.addEventListener("click", () => closeSubdrawer(drawer));
    if (backBtn)
      backBtn.addEventListener("click", () => closeSubdrawer(drawer));
    drawer.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") closeSubdrawer(drawer);
    });
  });

  // NEW: nested subpanel inside mobile menu (mkdocs-like)
  const mobilePanel = document.querySelector(".md3-mobile-menu__panel");
  const subpanelTriggers = document.querySelectorAll(
    ".md3-mobile-subdrawer-trigger",
  );
  subpanelTriggers.forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      const id = btn.getAttribute("aria-controls");
      const panel = id ? document.getElementById(id) : null;
      if (!panel || !mobilePanel) return;
      // if mobile menu is closed, open it first (there may be a different handler); try to trigger mobile toggle
      const mobileRoot = document.querySelector("[data-mobile-menu]");
      const mobileToggleBtn = document.querySelector("[data-mobile-toggle]");
      const ensureMenuOpen = () => {
        // compute child links count to decide compact vs scroll
        const links = panel.querySelectorAll("a, button");
        const linkCount = Array.from(links).filter((l) =>
          l.matches("a, button"),
        ).length;
        if (linkCount <= 8) {
          panel.classList.add("md3-mobile-subpanel--compact");
          panel.classList.remove("md3-mobile-subpanel--scroll");
        } else {
          panel.classList.remove("md3-mobile-subpanel--compact");
          panel.classList.add("md3-mobile-subpanel--scroll");
        }

        // show nested panel
        mobilePanel.classList.add("has-subpanel");
        panel.removeAttribute("hidden");
        panel.setAttribute("aria-hidden", "false");
        // store trigger id for focus return
        const tid =
          btn.id ||
          "md3-subpanel-trigger-" + Math.random().toString(36).slice(2, 8);
        btn.id = tid;
        panel.dataset.triggerId = tid;
        // set aria-expanded
        btn.setAttribute("aria-expanded", "true");
        // focus first link inside
        const first = panel.querySelector("a, button, [tabindex]");
        if (first) first.focus();
      };

      if (mobileRoot && mobileRoot.hasAttribute("hidden") && mobileToggleBtn) {
        // open mobile menu and wait for it to be visible before showing subpanel
        const onMenuOpen = () => {
          mobileToggleBtn.removeEventListener("click", onMenuOpen);
          // micro-delay to allow transitions to settle
          setTimeout(ensureMenuOpen, 60);
        };
        // if click handler on mobileToggleBtn will open the menu synchronously, call it and schedule
        mobileToggleBtn.click();
        // fallback: wait until mobileRoot no longer has hidden attribute
        const waitUntil = Date.now() + 1000;
        const poll = () => {
          if (!mobileRoot.hasAttribute("hidden")) return ensureMenuOpen();
          if (Date.now() > waitUntil) return ensureMenuOpen();
          requestAnimationFrame(poll);
        };
        poll();
      } else {
        ensureMenuOpen();
      }
    });
  });

  // back buttons inside subpanels
  document.querySelectorAll(".md3-subpanel__back").forEach((back) => {
    back.addEventListener("click", (ev) => {
      const panel = back.closest(".md3-mobile-subpanel");
      if (!panel || !mobilePanel) return;
      // hide panel and return to main menu
      panel.setAttribute("hidden", "");
      panel.setAttribute("aria-hidden", "true");
      mobilePanel.classList.remove("has-subpanel");
      // restore focus to trigger
      const tid = panel.dataset.triggerId;
      if (tid) {
        const t = document.getElementById(tid);
        if (t) {
          t.setAttribute("aria-expanded", "false");
          t.focus();
        }
      }
      // cleanup inline styles fallback
      try {
        panel.style.zIndex = "";
        panel.style.pointerEvents = "";
        const inner = mobilePanel.querySelector(".md3-mobile-menu__inner");
        if (inner) inner.style.pointerEvents = "";
      } catch (e) {}
    });
  });

  // when mobile menu closes, reset any open subpanels
  const mobileClose = document.querySelector("[data-mobile-close]");
  const mobileMenuRoot = document.querySelector("[data-mobile-menu]");
  if (mobileClose && mobileMenuRoot && mobilePanel) {
    mobileClose.addEventListener("click", () => {
      mobilePanel.classList.remove("has-subpanel");
      document.querySelectorAll(".md3-mobile-subpanel").forEach((p) => {
        p.setAttribute("hidden", "");
        p.setAttribute("aria-hidden", "true");
      });
      // remove any inline fallback styles added when panels were opened
      try {
        document.querySelectorAll(".md3-mobile-subpanel").forEach((p) => {
          p.style.zIndex = "";
          p.style.pointerEvents = "";
        });
        const inner = mobilePanel.querySelector(".md3-mobile-menu__inner");
        if (inner) inner.style.pointerEvents = "";
      } catch (e) {}
    });
  }

  // When the mobile menu opens, ensure subpanels are hidden and mobilePanel has no residual state
  const mobileToggle = document.querySelector("[data-mobile-toggle]");
  if (mobileToggle && mobileMenuRoot && mobilePanel) {
    mobileToggle.addEventListener("click", () => {
      // toggle mobile menu visibility is handled elsewhere; here we just clear subpanel state when opening
      setTimeout(() => {
        if (mobileMenuRoot.hasAttribute("hidden")) return; // menu closed
        mobilePanel.classList.remove("has-subpanel");
        document.querySelectorAll(".md3-mobile-subpanel").forEach((p) => {
          p.setAttribute("hidden", "");
          p.setAttribute("aria-hidden", "true");
        });
      }, 120);
    });
  }

  // Client-side active-link marking as a fallback: mark submenu and subdrawer links when href matches location.pathname
  (function markActiveLinks() {
    try {
      const current = window.location.pathname || "/";
      document
        .querySelectorAll(".md3-nav__submenu-link, .md3-subdrawer__link")
        .forEach((a) => {
          try {
            const href = a.getAttribute("href");
            if (!href) return;
            // normalize
            const norm = href.split("?")[0].split("#")[0];
            if (current === norm || current.startsWith(norm + "/")) {
              a.classList.add("md3-nav__link--active");
              a.setAttribute("aria-current", "page");
            }
          } catch (_e) {}
        });
    } catch (e) {
      console.warn("active-link marker failed", e);
    }
  })();
});
