/**
 * Tests for Story 1.2: Docker Compose Dev Environment
 *
 * These tests validate:
 * - Docker Compose file structure and service definitions
 * - Dockerfile.dev exists and references entrypoint script
 * - Entrypoint script exists and is executable-ready
 * - .env.example contains all required environment variables
 * - package.json contains all required db scripts
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../..');

function readFile(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), 'utf-8');
}

function fileExists(relPath: string): boolean {
  return existsSync(resolve(ROOT, relPath));
}

describe('Docker Compose configuration', () => {
  it('docker-compose.yml exists at project root', () => {
    expect(fileExists('docker-compose.yml')).toBe(true);
  });

  it('defines a postgres service with pgvector image', () => {
    const content = readFile('docker-compose.yml');
    expect(content).toContain('pgvector/pgvector:pg16');
  });

  it('defines a redis service', () => {
    const content = readFile('docker-compose.yml');
    expect(content).toContain('redis:7-alpine');
  });

  it('defines an app service', () => {
    const content = readFile('docker-compose.yml');
    expect(content).toContain('Dockerfile.dev');
  });

  it('app service depends on postgres and redis', () => {
    const content = readFile('docker-compose.yml');
    expect(content).toContain('depends_on');
    expect(content).toContain('service_healthy');
  });

  it('postgres healthcheck is configured', () => {
    const content = readFile('docker-compose.yml');
    expect(content).toContain('pg_isready');
  });

  it('redis healthcheck is configured', () => {
    const content = readFile('docker-compose.yml');
    expect(content).toContain('redis-cli');
    expect(content).toContain('ping');
  });

  it('defines a named volume for postgres persistence', () => {
    const content = readFile('docker-compose.yml');
    expect(content).toContain('pgdata');
  });

  it('defines productos-net network', () => {
    const content = readFile('docker-compose.yml');
    expect(content).toContain('productos-net');
  });

  it('source code is volume-mounted for hot reload', () => {
    const content = readFile('docker-compose.yml');
    expect(content).toContain('.:/app');
  });

  it('node_modules are excluded from volume mount', () => {
    const content = readFile('docker-compose.yml');
    expect(content).toContain('/app/node_modules');
  });

  it('app exposes port 3000', () => {
    const content = readFile('docker-compose.yml');
    expect(content).toContain('3000:3000');
  });
});

describe('Dockerfile.dev', () => {
  it('Dockerfile.dev exists at project root', () => {
    expect(fileExists('Dockerfile.dev')).toBe(true);
  });

  it('uses Node.js 20 LTS base image', () => {
    const content = readFile('Dockerfile.dev');
    expect(content).toContain('node:20');
  });

  it('sets /app as working directory', () => {
    const content = readFile('Dockerfile.dev');
    expect(content).toContain('WORKDIR /app');
  });

  it('exposes port 3000', () => {
    const content = readFile('Dockerfile.dev');
    expect(content).toContain('EXPOSE 3000');
  });

  it('references entrypoint script', () => {
    const content = readFile('Dockerfile.dev');
    expect(content).toContain('entrypoint.dev.sh');
  });
});

describe('Entrypoint script', () => {
  it('scripts/entrypoint.dev.sh exists', () => {
    expect(fileExists('scripts/entrypoint.dev.sh')).toBe(true);
  });

  it('waits for postgres readiness', () => {
    const content = readFile('scripts/entrypoint.dev.sh');
    expect(content).toContain('pg_isready');
  });

  it('runs prisma migrate deploy', () => {
    const content = readFile('scripts/entrypoint.dev.sh');
    expect(content).toContain('prisma migrate deploy');
  });

  it('runs prisma db seed', () => {
    const content = readFile('scripts/entrypoint.dev.sh');
    expect(content).toContain('prisma db seed');
  });

  it('starts next.js dev server', () => {
    const content = readFile('scripts/entrypoint.dev.sh');
    expect(content).toContain('npm run dev');
  });
});

describe('.env.example', () => {
  it('.env.example exists at project root', () => {
    expect(fileExists('.env.example')).toBe(true);
  });

  it('documents DATABASE_URL variable', () => {
    const content = readFile('.env.example');
    expect(content).toContain('DATABASE_URL');
  });

  it('DATABASE_URL points to postgres service', () => {
    const content = readFile('.env.example');
    expect(content).toContain('@postgres:5432/productos');
  });

  it('documents REDIS_URL variable', () => {
    const content = readFile('.env.example');
    expect(content).toContain('REDIS_URL');
  });

  it('documents ANTHROPIC_API_KEY variable', () => {
    const content = readFile('.env.example');
    expect(content).toContain('ANTHROPIC_API_KEY');
  });

  it('documents NEXTAUTH_SECRET variable', () => {
    const content = readFile('.env.example');
    expect(content).toContain('NEXTAUTH_SECRET');
  });

  it('documents NEXTAUTH_URL variable', () => {
    const content = readFile('.env.example');
    expect(content).toContain('NEXTAUTH_URL');
  });
});

describe('package.json scripts', () => {
  it('package.json exists', () => {
    expect(fileExists('package.json')).toBe(true);
  });

  const pkg = JSON.parse(readFile('package.json'));

  it('has dev script', () => {
    expect(pkg.scripts).toHaveProperty('dev');
  });

  it('has build script', () => {
    expect(pkg.scripts).toHaveProperty('build');
  });

  it('has db:migrate script', () => {
    expect(pkg.scripts).toHaveProperty('db:migrate');
  });

  it('has db:seed script', () => {
    expect(pkg.scripts).toHaveProperty('db:seed');
  });

  it('has db:reset script', () => {
    expect(pkg.scripts).toHaveProperty('db:reset');
  });
});

describe('Prisma schema', () => {
  it('prisma/schema.prisma exists', () => {
    expect(fileExists('prisma/schema.prisma')).toBe(true);
  });

  it('schema has Workspace model', () => {
    const content = readFile('prisma/schema.prisma');
    expect(content).toContain('model Workspace');
  });

  it('prisma/seed.ts exists', () => {
    expect(fileExists('prisma/seed.ts')).toBe(true);
  });
});

describe('.gitignore protects sensitive files', () => {
  it('.env is in .gitignore', () => {
    const content = readFile('.gitignore');
    expect(content).toContain('.env');
  });

  it('.env.local is in .gitignore', () => {
    const content = readFile('.gitignore');
    expect(content).toContain('.env.local');
  });
});
