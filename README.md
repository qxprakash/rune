# Rune AI Playground

A self-hosted AI inference platform that turns your spare hardware into a mini-Replicate. Run, queue, and automate AI models locally with a clean API interface.

## 🚀 Features

- **Multi-Model Support**: Ollama, MLX (coming soon), and custom backends
- **REST API**: Auto-generated endpoints for every registered model
- **Job Management**: Queue, track, and retry inference jobs
- **Model Registry**: Manage model configurations and metadata
- **History Tracking**: Complete audit trail of all inference runs
- **Database Persistence**: PostgreSQL for reliable data storage
- **Auto Documentation**: Interactive API docs via FastAPI

## Quick Start

Prerequisites:
- Docker Desktop (with Compose v2)
- Ollama running locally (for Ollama backend)

### Option 1: Full Stack with Docker

```bash
# Start all services
cd docker
docker compose up --build

# Visit:
# - API Documentation: http://localhost:8000/docs
# - Backend Health: http://localhost:8000/api/health
```

### Option 2: Backend Only (Development)

```bash
cd apps/backend

# Setup environment
uv sync
uv run alembic upgrade head

# Start backend
uv run python main.py

# API will be available at http://localhost:8000
```

## 🔧 API Usage

### 1. Health Check
```bash
curl http://localhost:8000/api/health
```

### 2. Register a Model
```bash
curl -X POST http://localhost:8000/api/models \
  -H "Content-Type: application/json" \
  -d '{
    "name": "llama3.2:3b",
    "backend": "ollama",
    "description": "Llama 3.2 3B model via Ollama",
    "config": {
      "temperature": 0.7,
      "max_tokens": 2000
    }
  }'
```

### 3. Run Inference
```bash
curl -X POST http://localhost:8000/api/run/llama3.2:3b \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Hello! Please introduce yourself.",
    "parameters": {
      "temperature": 0.8,
      "max_tokens": 150
    }
  }'
```

### 4. Check Job Status
```bash
curl http://localhost:8000/api/jobs/{job_id}
```

### 5. List Jobs & Models
```bash
# List all jobs
curl http://localhost:8000/api/jobs

# List all models
curl http://localhost:8000/api/models
```

## 📁 Project Structure

```
apps/
  backend/
    api/
      routes.py         # FastAPI route handlers
    db/
      models.py         # SQLAlchemy database models
      ai_crud.py        # Database operations
      session.py        # DB connection & config
    runners/
      base.py           # Abstract runner interface
      ollama.py         # Ollama backend implementation
    alembic/            # Database migrations
    schemas.py          # Pydantic request/response models
    main.py             # FastAPI application entry point
  frontend/             # Next.js frontend (coming soon)
docker/
  docker-compose.yml    # Full stack orchestration
```

## 🗄️ Database Schema

The system uses PostgreSQL with two main tables:

- **`models`**: Registry of available AI models
  - `name`, `backend`, `config`, `description`
  - Support for multiple backends (Ollama, MLX, etc.)

- **`jobs`**: Inference job tracking
  - `prompt`, `parameters`, `result`, `status`
  - Execution times, error messages, timestamps

## 🔌 Backend Architecture

### Model Runners
Abstract `ModelRunner` interface supports multiple backends:
- **OllamaRunner**: Direct API integration with Ollama
- **MLXRunner**: Coming soon for Apple Silicon
- **CustomRunner**: Extensible for any model backend

### Job Lifecycle
1. **Create**: Job submitted via API
2. **Queue**: Added to processing queue (currently sync)
3. **Execute**: Runner processes the job
4. **Complete**: Results stored with execution metadata

## 🛠️ Development

### Database Migrations
```bash
cd apps/backend

# Create new migration
uv run alembic revision --autogenerate -m "Description"

# Apply migrations
uv run alembic upgrade head
```

### Adding New Model Backends

1. Implement `ModelRunner` interface in `runners/`
2. Add backend enum to `db/models.py`
3. Register in `api/routes.py` RUNNERS dict
4. Create migration for new enum values

### Environment Variables

Create `apps/backend/.env`:
```env
DATABASE_URL=postgresql+psycopg://rune:rune@localhost:5432/rune
REDIS_URL=redis://localhost:6379/0
SQLALCHEMY_ECHO=0
```


## 🐛 Troubleshooting

### Backend won't start
```bash
# Check database connection
curl http://localhost:8000/api/health

# Check logs
cd apps/backend && uv run python main.py
```

### Ollama models not working
```bash
# Verify Ollama is running
curl http://localhost:11434/api/tags

# Pull a model if needed
ollama pull llama3.2:3b
```

### Database migration issues
```bash
cd apps/backend

# Reset database (⚠️ destroys data)
uv run alembic downgrade base
uv run alembic upgrade head
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make changes and add tests
4. Run linting: `cd apps/backend && uv run ruff format . && uv run ruff check .`
5. Commit changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📝 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- [FastAPI](https://fastapi.tiangolo.com/) for the excellent API framework
- [Ollama](https://ollama.com/) for local LLM inference
- [SQLAlchemy](https://sqlalchemy.org/) for database management
- Inspired by [RunPod](https://runpod.io/)
