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
RUN pip install --user --no-cache-dir -r requirements.txt gunicorn>=21.2.0

# Copy and run dependency check script
COPY scripts/check_python_deps.py ./scripts/check_python_deps.py
RUN python scripts/check_python_deps.py


# Stage 2: Runtime - Minimal production image
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/home/gamesapp/.local/bin:$PATH

# Install runtime dependencies only (including libpq for psycopg2 runtime)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    curl \
    libpq5 \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

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
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
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