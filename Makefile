.PHONY: help install dev test clean index bls proxy-test

help:
	@echo "CO.RA.PAN Development Targets"
	@echo "===================================="
	@echo ""
	@echo "Setup:"
	@echo "  make install          - Install Python dependencies"
	@echo ""
	@echo "Development:"
	@echo "  make dev              - Start Flask dev server (port 8000)"
	@echo "  make test             - Run pytest suite"
	@echo "  make clean            - Clean cache/build artifacts"
	@echo ""
	@echo "BlackLab Indexing:"
	@echo "  make index            - Build BlackLab index from corpus"
	@echo "  make index-dry        - Dry-run export (show sample)"
	@echo "  make bls              - Start BlackLab Server (port 8081)"
	@echo "  make proxy-test       - Quick proxy health check"
	@echo ""
	@echo "Docs:"
	@echo "  make docs             - Open documentation locally"
	@echo ""

install:
	@echo "Installing dependencies..."
	pip install -r requirements.txt
	@echo "✓ Dependencies installed"

dev:
	@echo "Starting Flask dev server (http://localhost:8000)..."
	FLASK_ENV=development python -m src.app.main

test:
	@echo "Running tests..."
	pytest -v

clean:
	@echo "Cleaning build artifacts..."
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .ruff_cache -exec rm -rf {} + 2>/dev/null || true
	@echo "✓ Cleaned"

# BlackLab Index Build
index:
	@echo "Building BlackLab index..."
	@echo "This will:"
	@echo "  1. Export JSON corpus to TSV"
	@echo "  2. Generate docmeta.jsonl"
	@echo "  3. Build index → /data/blacklab_index"
	@echo ""
	bash scripts/build_blacklab_index.sh tsv 4

index-dry:
	@echo "Dry-run export (showing sample)..."
	python -m src.scripts.blacklab_index_creation \
		--in media/transcripts \
		--out /data/bl_input \
		--format tsv \
		--docmeta /data/bl_input/docmeta.jsonl \
		--workers 4 \
		--limit 3 \
		--dry-run

# BlackLab Server Control
bls:
	@echo "Starting BlackLab Server (http://127.0.0.1:8081)..."
	@echo "This will run in background. View logs: tail -f logs/bls/server.log"
	@echo ""
	bash scripts/run_bls.sh 8081 2g 512m

proxy-test:
	@echo "Testing BlackLab proxy connection..."
	@curl -s http://localhost:8000/bls/ | python -m json.tool || echo "Proxy not responding"

docs:
	@echo "Opening documentation at docs/index.md..."
	@echo "Rendered markdown available in browser (if running live server)"
	@python -c "import webbrowser; webbrowser.open('file://$(PWD)/docs/index.md')" 2>/dev/null || echo "Manual: open docs/index.md"


# Dev convenience targets for auth flows
.PHONY: dev-sqlite dev-postgres auth-migrate-sqlite auth-seed-e2e auth-create-admin


# Run a local sqlite-based dev server with auth DB migration and seed
dev-sqlite: auth-migrate-sqlite auth-create-admin
	@echo "Starting Flask dev server (sqlite auth) (http://localhost:8000)..."
	FLASK_ENV=development python -m src.app.main


# Start a development Postgres DB (docker-compose.dev-postgres.yml), apply SQL, create admin
dev-postgres:
	@echo "Bringing up dev Postgres (docker-compose.dev-postgres.yml)..."
	docker compose -f docker-compose.dev-postgres.yml up -d authdb
	@echo "Waiting for DB to be ready..."
	# simple wait/check loop
	python - <<'PY'
import time, sys, subprocess
for i in range(20):
    try:
        subprocess.check_call(['docker','exec','corapan_auth_db','pg_isready','-U','postgres'], stdout=subprocess.DEVNULL)
        print('Postgres ready')
        sys.exit(0)
    except Exception:
        time.sleep(1)
print('DB did not become ready in time', file=sys.stderr)
sys.exit(1)
PY
	@echo "Applying Postgres SQL migration..."
	docker exec -i corapan_auth_db psql -U postgres -d corapan_auth -f /app/migrations/0001_create_auth_schema_postgres.sql
	@echo "Creating initial admin..."
	# ensure the admin can be created — uses env or defaults
	AUTH_DATABASE_URL=postgresql://corapan_auth:corapan_auth@localhost:54320/corapan_auth START_ADMIN_PASSWORD=admin123 python scripts/create_initial_admin.py
	@echo "Now start the Flask dev server (you can use make dev or run locally)"
	@echo "Starting Flask dev server (postgres auth) (http://localhost:8000)..."
	@echo "If you want to use a custom JWT_SECRET, set it before running this target."
	AUTH_DATABASE_URL=postgresql://corapan_auth:corapan_auth@localhost:54320/corapan_auth FLASK_ENV=development python -m src.app.main


auth-migrate-sqlite:
	@echo "Migrating sqlite auth DB (data/db/auth.db)..."
	python scripts/apply_auth_migration.py --db data/db/auth.db
	@echo "✓ sqlite migration applied"

auth-seed-e2e:
	@echo "Seeding E2E user in data/db/auth_e2e.db"
	python scripts/seed_e2e_db.py --db data/db/auth_e2e.db --user e2e_user --password password123
	@echo "✓ Seeded E2E user"

auth-create-admin:
	@echo "Creating initial admin user (db default: data/db/auth.db)"
	python scripts/create_initial_admin.py
	@echo "✓ Created/updated admin user"


.PHONY: auth-reset-dev
auth-reset-dev:
	@echo "Resetting sqlite auth DB (data/db/auth.db) and creating admin user"
	python scripts/apply_auth_migration.py --db data/db/auth.db --reset
	@echo "Creating initial admin user 'admin' (password from START_ADMIN_PASSWORD or 'change-me')"
	# Set a fallback dev password if START_ADMIN_PASSWORD not provided
	START_ADMIN_PASSWORD="${START_ADMIN_PASSWORD:-change-me}"; \
	python scripts/create_initial_admin.py --db data/db/auth.db --username admin --password "$$START_ADMIN_PASSWORD"
	@echo "✓ auth DB reset and admin created (username: admin)"
