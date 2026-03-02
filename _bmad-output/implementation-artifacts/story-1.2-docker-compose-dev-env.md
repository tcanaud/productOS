# Story 1.2: Docker Compose Dev Environment

Status: ready-for-dev

## Story

As a Developer,
I want a docker-compose setup that provisions the complete dev environment (Postgres, Redis, app),
so that I can start developing immediately with a single command.

## Acceptance Criteria

1. `docker compose up` starts all services: Postgres (with pgvector), Redis, Next.js app in dev mode (AC:1)
2. Hot reload works instantly via volume-mounted source code (AC:2)
3. Database migrations run automatically on first start, seed data applied (AC:3)
4. `.env.example` provided with all required environment variables documented (AC:4)
5. `docker compose down -v` cleanly tears down everything including volumes (AC:5)

## Tasks / Subtasks

- [ ] Task 1: docker-compose.yml (AC: 1, 5)
  - [ ] Service: `postgres` — PostgreSQL 16 + pgvector extension
    - Port: 5432
    - Volume: persistent data volume
    - Healthcheck: pg_isready
  - [ ] Service: `redis` — Redis 7 (for cache + future session/queue)
    - Port: 6379
    - Healthcheck: redis-cli ping
  - [ ] Service: `app` — Next.js dev server
    - Port: 3000
    - Volume mount: source code for hot reload
    - depends_on: postgres (healthy), redis (healthy)
    - Command: `npm run dev`
  - [ ] Network: shared `productos-net` bridge
  - [ ] Named volumes for postgres data persistence
- [ ] Task 2: Dockerfile.dev (AC: 1, 2)
  - [ ] Node.js 20 LTS base image
  - [ ] Install dependencies (npm ci)
  - [ ] Working directory setup
  - [ ] Expose port 3000
  - [ ] Dev command with hot reload (next dev)
- [ ] Task 3: Database init scripts (AC: 3)
  - [ ] `scripts/init-db.sh` — create database, enable pgvector extension
  - [ ] Prisma migration on app startup (or entrypoint script)
  - [ ] Seed script: `prisma db seed` with minimal dev data
  - [ ] Entrypoint script: wait for postgres → run migrations → start app
- [ ] Task 4: Environment configuration (AC: 4)
  - [ ] `.env.example` with all variables:
    - `DATABASE_URL=postgresql://productos:productos@postgres:5432/productos`
    - `REDIS_URL=redis://redis:6379`
    - `ANTHROPIC_API_KEY=your-key-here`
    - `NEXTAUTH_SECRET=dev-secret`
    - `NEXTAUTH_URL=http://localhost:3000`
  - [ ] `.env.local` in .gitignore
  - [ ] `docker-compose.yml` references `.env` file
- [ ] Task 5: Project scaffolding (AC: 1, 3)
  - [ ] Initialize Next.js project (if not already done)
  - [ ] Initialize Prisma with PostgreSQL provider
  - [ ] Initial schema: workspace table (from Story 1.1)
  - [ ] package.json scripts: `dev`, `build`, `db:migrate`, `db:seed`, `db:reset`
- [ ] Task 6: Documentation (AC: 1-5)
  - [ ] README section: "Getting Started" with docker compose instructions
  - [ ] Troubleshooting: common issues (port conflicts, volume permissions)
- [ ] Task 7: Tests (AC: 1, 3)
  - [ ] Verify all services start and pass healthchecks
  - [ ] Verify database is accessible from app container
  - [ ] Verify migrations run successfully on clean start
  - [ ] Verify hot reload: modify file → change reflected without restart

## Dev Notes

- **This is the first story to implement.** All other stories depend on a working dev env.
- Use multi-stage Dockerfile if needed, but keep Dockerfile.dev simple for dev speed
- pgvector is needed from day 1 (will be used for RAG in future, but schema should be ready)
- Redis is lightweight to add now and avoids re-doing docker-compose later (session store, cache, queues)
- Keep postgres credentials simple for dev: `productos:productos@postgres/productos`
- Entrypoint pattern:
  ```bash
  #!/bin/sh
  echo "Waiting for postgres..."
  until pg_isready -h postgres -p 5432; do sleep 1; done
  echo "Running migrations..."
  npx prisma migrate deploy
  echo "Starting app..."
  exec npm run dev
  ```

### docker-compose.yml skeleton

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: productos
      POSTGRES_PASSWORD: productos
      POSTGRES_DB: productos
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U productos"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

volumes:
  pgdata:
```

### Project Structure Notes

- `/docker-compose.yml` — dev orchestration
- `/Dockerfile.dev` — dev container
- `/scripts/entrypoint.dev.sh` — startup script (migrations + dev server)
- `/.env.example` — documented env vars template
- `/prisma/schema.prisma` — database schema
- `/prisma/seed.ts` — seed data script

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1 — Story 1.2]
- [Source: Architecture#Deployment Architecture]
- [Source: Architecture#Database Architecture — Postgres + PGVector]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
