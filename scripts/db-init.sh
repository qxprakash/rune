#!/usr/bin/env bash
# Initialize the database schema and apply migrations for the backend service.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/apps/backend"

cd "$BACKEND_DIR"

if ! command -v uv >/dev/null 2>&1; then
	echo "Installing uv (user-local)..."
	python3 -m pip install --user --no-cache-dir uv
	export PATH="$HOME/.local/bin:$PATH"
fi

# Ensure dependencies are available
uv sync

# Run Alembic migrations if Alembic is configured; otherwise, no-op with a friendly message.
if [ -d "alembic" ] || [ -f "alembic.ini" ]; then
	echo "📦 Running Alembic migrations..."
	uv run alembic upgrade head
	echo "✅ Database initialized!"
else
	echo "ℹ️ Alembic not configured (no alembic/ or alembic.ini found). Skipping migrations."
	echo "   Add Alembic and models to enable migrations."
fi