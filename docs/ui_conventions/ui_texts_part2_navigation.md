# UI-Texte Teil 2: Navigation & Partials

Diese Datei enthält alle UI-Texte aus Navigation, Footer und anderen Partials.

> **Hinweis:** Diese Datei ist Teil einer vierteiligen Übersicht. Siehe auch:
> - `ui_texts_part1_auth.md` - Auth-Templates
> - `ui_texts_part3_pages.md` - Seiten-Templates
> - `ui_texts_part4_search.md` - Suche & Fehlerseiten

---

| id | context_area | file_path | location_hint | ui_element_type | original_text | language_planned | new_text |
| --- | --- | --- | --- | --- | --- | --- | --- |
| nav.drawer.main.inicio | navigation/drawer | templates/partials/_navigation_drawer.html | Main nav item | menu_item | Inicio | ES | |
| nav.drawer.main.proyecto | navigation/drawer | templates/partials/_navigation_drawer.html | Main nav item | menu_item | Proyecto | ES | |
| nav.drawer.main.proyecto.overview | navigation/drawer | templates/partials/_navigation_drawer.html | Submenu item | menu_item | El proyecto | ES | |
| nav.drawer.main.proyecto.diseno | navigation/drawer | templates/partials/_navigation_drawer.html | Submenu item | menu_item | Diseño | ES | |
| nav.drawer.main.proyecto.quienes | navigation/drawer | templates/partials/_navigation_drawer.html | Submenu item | menu_item | Quiénes somos | ES | |
| nav.drawer.main.proyecto.citar | navigation/drawer | templates/partials/_navigation_drawer.html | Submenu item | menu_item | Cómo citar | ES | |
| nav.drawer.main.proyecto.referencias | navigation/drawer | templates/partials/_navigation_drawer.html | Submenu item | menu_item | Referencias | ES | |
| nav.drawer.main.corpus | navigation/drawer | templates/partials/_navigation_drawer.html | Main nav item | menu_item | Corpus | ES | |
| nav.drawer.main.corpus.consultar | navigation/drawer | templates/partials/_navigation_drawer.html | Submenu item | menu_item | Consultar | ES | |
| nav.drawer.main.corpus.guia | navigation/drawer | templates/partials/_navigation_drawer.html | Submenu item | menu_item | Guía | ES | |
| nav.drawer.main.corpus.composicion | navigation/drawer | templates/partials/_navigation_drawer.html | Submenu item | menu_item | Composición | ES | |
| nav.drawer.main.corpus.metadatos | navigation/drawer | templates/partials/_navigation_drawer.html | Submenu item | menu_item | Metadatos | ES | |
| nav.drawer.main.atlas | navigation/drawer | templates/partials/_navigation_drawer.html | Main nav item | menu_item | Atlas | ES | |
| nav.drawer.main.player | navigation/drawer | templates/partials/_navigation_drawer.html | Player nav item (auth only) | menu_item | Player | EN | |
| nav.drawer.footer.editor | navigation/drawer | templates/partials/_navigation_drawer.html | Editor link (editor/admin) | menu_item | Editor | EN | |
| nav.drawer.footer.profil | navigation/drawer | templates/partials/_navigation_drawer.html | Profile link | menu_item | Profil | DE | |
| nav.drawer.footer.dashboard | navigation/drawer | templates/partials/_navigation_drawer.html | Dashboard link (admin) | menu_item | Dashboard | EN | |
| nav.drawer.footer.benutzer | navigation/drawer | templates/partials/_navigation_drawer.html | Users link (admin) | menu_item | Benutzer | DE | |
| nav.drawer.footer.logout | navigation/drawer | templates/partials/_navigation_drawer.html | Logout link | menu_item | Logout | EN | |
| nav.drawer.footer.login | navigation/drawer | templates/partials/_navigation_drawer.html | Login link (unauth) | menu_item | Login | EN | |
| nav.topbar.burger.aria | navigation/topbar | templates/partials/_top_app_bar.html | Burger menu aria-label | button_label | Menú | ES | |
| nav.topbar.title.site | navigation/topbar | templates/partials/_top_app_bar.html | Site title | page_title | CO.RA.PAN | ES | |
| nav.topbar.theme.aria | navigation/topbar | templates/partials/_top_app_bar.html | Theme toggle aria-label | button_label | Darstellung umschalten | DE | |
| nav.topbar.theme.title | navigation/topbar | templates/partials/_top_app_bar.html | Theme toggle title | tooltip | Darstellung: Hell | DE | |
| nav.topbar.user.aria | navigation/topbar | templates/partials/_top_app_bar.html | User menu aria-label template | button_label | Angemeldet als {{ user_name }}, Rolle: {{ role_value }} | DE | |
| nav.topbar.menu.profil | navigation/topbar | templates/partials/_top_app_bar.html | User menu profile item | menu_item | Profil | DE | |
| nav.topbar.menu.dashboard | navigation/topbar | templates/partials/_top_app_bar.html | User menu dashboard item | menu_item | Dashboard | EN | |
| nav.topbar.menu.benutzer | navigation/topbar | templates/partials/_top_app_bar.html | User menu users item | menu_item | Benutzer | DE | |
| nav.topbar.menu.logout | navigation/topbar | templates/partials/_top_app_bar.html | User menu logout item | menu_item | Logout | EN | |
| nav.topbar.login.aria | navigation/topbar | templates/partials/_top_app_bar.html | Login button aria-label | button_label | Login | EN | |
| nav.topbar.login.title | navigation/topbar | templates/partials/_top_app_bar.html | Login button title | tooltip | Login | EN | |
| nav.footer.brand.aria | navigation/footer | templates/partials/footer.html | Brand link aria-label | link_label | Hispanistica – @ Marburg | EN | |
| nav.footer.nav.aria | navigation/footer | templates/partials/footer.html | Footer nav aria-label | menu_item | Rechtliches | DE | |
| nav.footer.link.impressum | navigation/footer | templates/partials/footer.html | Impressum link | link_label | Impressum | DE | |
| nav.footer.link.datenschutz | navigation/footer | templates/partials/footer.html | Privacy link | link_label | Datenschutz | DE | |
| nav.footer.copyright | navigation/footer | templates/partials/footer.html | Copyright text | paragraph | © {{ year }} Philipps-Universität Marburg · Felix Tacke | DE | |
| nav.page.prev.label | navigation/page | templates/partials/page_navigation.html | Previous page label | link_label | Anterior | ES | |
| nav.page.next.label | navigation/page | templates/partials/page_navigation.html | Next page label | link_label | Siguiente | ES | |
| nav.status.welcome | navigation/status | templates/partials/status_banner.html | Welcome message (auth) | paragraph | Willkommen, {{ user_name }}. | DE | |
| nav.status.not_logged_in | navigation/status | templates/partials/status_banner.html | Not logged in message | paragraph | Noch nicht angemeldet | DE | |
| base.page_title | base | templates/base.html | Default page title | page_title | CO.RA.PAN | ES | |
