[![CI](https://github.com/tcanaud/productOS/actions/workflows/ci.yml/badge.svg)](https://github.com/tcanaud/productOS/actions/workflows/ci.yml)

# Productos

AI-powered product management platform.

## Getting Started

### Option 1: Docker Compose (Recommended)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed.

```bash
# 1. Clone the repo
git clone <repo-url>
cd productos

# 2. Set up environment
cp .env.example .env
# Edit .env if needed (defaults work out of the box)

# 3. Start all services (Postgres + pgvector, Redis, Next.js app)
docker compose up
```

The first run will:

- Pull the `pgvector/pgvector:pg16` and `redis:7-alpine` images
- Build the dev container (Node.js 20)
- Wait for Postgres and Redis to be healthy
- Run Prisma migrations automatically
- Apply seed data (dev user + dev workspace)
- Start Next.js dev server on port 3000

Open [http://localhost:3000](http://localhost:3000) to see the app.

**Hot reload** works out of the box — source files are volume-mounted.

#### Useful commands

```bash
# Start in background
docker compose up -d

# View logs
docker compose logs -f app

# Stop all services
docker compose down

# Stop and remove volumes (clean slate)
docker compose down -v

# Run migrations manually inside app container
docker compose exec app npx prisma migrate deploy

# Open Prisma Studio
docker compose exec app npm run db:studio
```

#### Troubleshooting

| Problem                        | Solution                                               |
| ------------------------------ | ------------------------------------------------------ |
| Port 5432 already in use       | Stop local Postgres: `brew services stop postgresql`   |
| Port 3000 already in use       | Change the port in `docker-compose.yml`: `"3001:3000"` |
| Port 6379 already in use       | Stop local Redis: `brew services stop redis`           |
| Migrations fail on first start | Run `docker compose down -v` then `docker compose up`  |
| node_modules out of sync       | Run `docker compose build --no-cache app`              |

---

### Option 2: Local Development (without Docker)

Requires Node.js 20+, PostgreSQL 16 with pgvector, and Redis 7.

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env: change DATABASE_URL to use localhost instead of postgres hostname

# 3. Run migrations
npm run db:migrate

# 4. Seed the database
npm run db:seed

# 5. Start dev server
npm run dev
```

---

## Available Scripts

| Script                  | Description                       |
| ----------------------- | --------------------------------- |
| `npm run dev`           | Start Next.js dev server          |
| `npm run build`         | Build for production              |
| `npm run lint`          | Run ESLint                        |
| `npm run test`          | Run Vitest test suite             |
| `npm run test:coverage` | Run tests with coverage report    |
| `npm run db:migrate`    | Run Prisma migrations (dev)       |
| `npm run db:seed`       | Seed the database                 |
| `npm run db:reset`      | Reset and re-migrate the database |
| `npm run db:studio`     | Open Prisma Studio                |

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS v4
- **ORM**: Prisma 7 with PostgreSQL + pgvector
- **Auth**: NextAuth v5
- **Cache/Queue**: Redis 7
- **UI**: shadcn/ui (new-york style)
- **Tests**: Vitest + Testing Library
