# Implementation Roadmap

1. **Authentication hardening**
   - Wire credential hydration to real password hashes and rotate legacy credentials.
   - Implement RSA key management for signed cookies/tokens.
   - Add integration tests that cover admin/editor/user flows and cookie policies.

2. **Corpus enrichment**
   - Migrate remaining legacy SQL (multi-token queries, advanced filters) into the new service layer.
   - Add pagination UI controls, saved searches, and export options on the frontend.
   - Extend snippet handling with background jobs plus rate limiting and automatic cleanup.

3. **Atlas experience**
   - Cache country/file datasets and add map markers per corpus location.
   - Surface drill-down cards with direct links into the corpus search for each locale.
   - Offer CSV/JSON exports for public metadata.

4. **Media services**
   - Persist mp3-temp toggle state (database or config) so it survives restarts.
   - Add transcript/audo checksum validation and detailed 403 messaging.
   - Build admin UI controls, including runtime toggle and recent snippet activity log.

5. **Observability**
   - Extend counters with daily aggregates, sparkline charts, and error tracking.
   - Ship structured logs and health probes suitable for Docker/Kubernetes deployments.

6. **CI/CD and quality**
   - Configure Ruff, mypy, pytest, and ESLint in the toolchain with pre-commit hooks.
   - Update the Dockerfile/CI pipeline to build static assets and run the full test matrix before deployments.
