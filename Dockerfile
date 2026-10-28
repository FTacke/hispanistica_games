# ============================================
# Multi-Stage Build for optimized image size
# ============================================
# NOTE: This Dockerfile is BuildKit-independent.
# It works with both legacy Docker build and BuildKit.

# Stage 1: Builder - Install dependencies
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install build dependencies (including libpq-dev for psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies to user site-packages
COPY requirements.txt ./
COPY requirements/runtime-constraints.txt ./requirements/runtime-constraints.txt
RUN pip install --user --no-cache-dir -c requirements/runtime-constraints.txt \
    -r requirements.txt gunicorn>=21.2.0

# Copy and run dependency check script
COPY scripts/check_python_deps.py ./scripts/check_python_deps.py
RUN python scripts/check_python_deps.py


# Stage 2: Runtime - Minimal production image
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/home/gamesapp/.local/bin:$PATH

# Security floor for libbrotli1 (CVE-2026-111497, DSA-6582-1). Installing it
# explicitly and checking the version invalidates any cached apt layer and makes
# the build fail instead of silently shipping a vulnerable library.
ARG LIBBROTLI1_MIN_VERSION=1.1.0-2+deb13u1

# Install runtime dependencies only (including libpq for psycopg2 runtime)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    curl \
    libpq5 \
    postgresql-client \
    libbrotli1 \
    && rm -rf /var/lib/apt/lists/* \
    && installed="$(dpkg-query -W -f='${Version}' libbrotli1)" \
    && echo "libbrotli1 ${installed} (required >= ${LIBBROTLI1_MIN_VERSION})" \
    && dpkg --compare-versions "${installed}" ge "${LIBBROTLI1_MIN_VERSION}"

# Create non-root user for security
RUN useradd -m -u 1000 -s /bin/bash gamesapp

WORKDIR /app

# Copy Python dependencies from builder (then fix ownership)
COPY --from=builder /root/.local /home/gamesapp/.local
RUN chown -R gamesapp:gamesapp /home/gamesapp/.local

# Copy application code (then fix ownership)
COPY . .
RUN chown -R gamesapp:gamesapp /app

# Install app as package
USER gamesapp
RUN pip install --user --no-cache-dir -e .

# Final dependency check in runtime stage
RUN python scripts/check_python_deps.py

# Copy entrypoint script and make it executable
# Note: We copy as root first, then set permissions, then switch back to gamesapp user
USER root
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh
USER gamesapp

# Healthcheck endpoint (requires /health route in app)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -f http://localhost:5000/health || exit 1

EXPOSE 5000

# Use entrypoint for DB initialization, CMD for the actual server
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Production server: Gunicorn with 2 workers (for 1 vCPU server)
CMD ["gunicorn", \
     "--bind", "0.0.0.0:5000", \
     "--workers", "2", \
     "--worker-class", "sync", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--log-level", "info", \
     "src.app.main:app"]