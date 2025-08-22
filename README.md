# Rune

A lightweight AI orchestration dev stack: FastAPI backend + Next.js dashboard, backed by Postgres and Redis. Spin it up in one command with Docker.

## Quick start

Prerequisites:
- Docker Desktop (with Compose v2)

From the repo root, either:

```zsh
# Option A: run from the docker folder (shortest command)
cd docker
docker compose up --build
```

or:

```zsh
# Option B: run from repo root with an explicit compose file
docker compose -f docker/docker-compose.yml up --build
```

Then visit:
- Frontend (Next.js): http://localhost:3000
- Backend (FastAPI docs): http://localhost:8000/docs
- Postgres: localhost:5432 (user: rune, password: rune, db: rune)
- Redis: localhost:6379

To stop everything:

```zsh
# If you ran from the docker folder, stop there
docker compose down
# Remove volumes (drops the Postgres data volume)
docker compose down -v
```

## What gets started

Compose file: `docker/docker-compose.yml`

Services:
- db: `postgres:16-alpine` exposed on 5432 with a persistent volume
- redis: `redis:7-alpine` exposed on 6379
- backend: FastAPI app on http://localhost:8000
- frontend: Next.js dashboard on http://localhost:3000

## Project layout

```
apps/
  backend/            # FastAPI app (Python, uv, Uvicorn)
  frontend/           # Next.js app (Node)
docker/
  docker-compose.yml  # One-command local stack
scripts/
  db-init.sh          # Optional DB migration/init helper
```

## Environment variables

Create minimal env files for local development (optional — defaults are baked into Compose):

- `apps/backend/.env`
  - DATABASE_URL=postgresql+psycopg://rune:rune@db:5432/rune
  - REDIS_URL=redis://redis:6379/0

- `apps/frontend/.env.local`
  - NEXT_PUBLIC_API_URL=http://localhost:8000

These are not strictly required if you use the provided docker-compose, but are handy when running services outside Docker.

## Database init / migrations

If you use Alembic, run the helper script to apply migrations:

```zsh
./scripts/db-init.sh
```

The script will:
- Ensure `uv` is available and dependencies are synced
- Run `alembic upgrade head` if Alembic is configured
- Otherwise, skip gracefully with a helpful message

## Development tips

- First run can take a few minutes as images and dependencies are built.
- Rebuild after code or Dockerfile changes:
  ```zsh
  docker compose -f docker/docker-compose.yml up --build
  ```
- Tail logs for a single service (example: backend):
  ```zsh
  docker compose -f docker/docker-compose.yml logs -f backend
  ```

- Run apps outside Docker (hot reload):
  - Backend:
    ```zsh
    cd apps/backend
    uv sync
    uv run uvicorn rune.api.main:app --reload
    ```
  - Frontend:
    ```zsh
    cd apps/frontend
    npm install
    npm run dev
    ```

## Optional enhancements

- Add a Makefile for shorter commands (e.g., `make dev`, `make down`, `make clean`).
- Add healthchecks to services for faster, more reliable startup sequencing.
 - Add Alembic + models to enable real migrations if not present yet.

## License

TBD
