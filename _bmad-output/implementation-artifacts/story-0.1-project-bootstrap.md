# Story 0.1: Project Bootstrap

Status: ready-for-dev

## Story

As a Developer,
I want a fully scaffolded Next.js project with TypeScript, Prisma, linting, and dev tooling,
so that I can start writing feature code immediately on a solid foundation.

## Acceptance Criteria

1. Next.js 14+ App Router initialized with TypeScript strict mode (AC:1)
2. ESLint + Prettier configured and enforcing consistent code style (AC:2)
3. Tailwind CSS installed and configured with base styles (AC:3)
4. Prisma initialized with PostgreSQL provider, initial schema (users, workspaces), migrations working (AC:4)
5. Path aliases (`@/`) configured in tsconfig.json (AC:5)
6. Git hooks (husky + lint-staged) enforce quality on commit (AC:6)

## Tasks / Subtasks

- [ ] Task 1: Next.js project initialization (AC: 1, 5)
  - [ ] `npx create-next-app@latest` with App Router, TypeScript, Tailwind, ESLint
  - [ ] Configure `tsconfig.json` with strict mode
  - [ ] Set up path aliases: `@/` → `./src/`
  - [ ] Configure `next.config.js` (output, images, experimental features if needed)
  - [ ] Create base directory structure:
    ```
    src/
    ├── app/           # Next.js App Router pages
    ├── components/    # Shared React components
    ├── lib/           # Business logic, utilities, services
    ├── hooks/         # Custom React hooks
    └── types/         # Shared TypeScript types
    ```
- [ ] Task 2: Linting & formatting (AC: 2, 6)
  - [ ] Configure ESLint with Next.js recommended + TypeScript rules
  - [ ] Install and configure Prettier (semi, singleQuote, trailingComma)
  - [ ] Add `.eslintrc.json` and `.prettierrc`
  - [ ] Add `lint` and `format` scripts to package.json
  - [ ] Install husky + lint-staged
  - [ ] Configure pre-commit hook: lint-staged runs ESLint + Prettier on staged files
- [ ] Task 3: Tailwind CSS setup (AC: 3)
  - [ ] Verify Tailwind configuration (content paths, theme)
  - [ ] Add base CSS variables for design tokens (colors, spacing)
  - [ ] Configure `tailwind.config.ts` with project-specific theme extensions
  - [ ] Add global styles in `src/app/globals.css`
- [ ] Task 4: Prisma initialization (AC: 4)
  - [ ] `npx prisma init` with PostgreSQL datasource
  - [ ] Configure `DATABASE_URL` in `.env` / `.env.example`
  - [ ] Create initial schema:
    ```prisma
    model User {
      id        String   @id @default(cuid())
      email     String   @unique
      name      String?
      password  String
      createdAt DateTime @default(now())
      updatedAt DateTime @updatedAt
      workspaces WorkspaceMember[]
    }

    model Workspace {
      id          String   @id @default(cuid())
      name        String
      description String?
      ownerId     String
      createdAt   DateTime @default(now())
      updatedAt   DateTime @updatedAt
      owner       User     @relation("WorkspaceOwner", fields: [ownerId], references: [id])
      members     WorkspaceMember[]
    }

    model WorkspaceMember {
      id          String   @id @default(cuid())
      workspaceId String
      userId      String
      role        String   @default("owner")
      workspace   Workspace @relation(fields: [workspaceId], references: [id])
      user        User      @relation(fields: [userId], references: [id])
      @@unique([workspaceId, userId])
    }
    ```
  - [ ] Run first migration: `npx prisma migrate dev --name init`
  - [ ] Generate Prisma client
  - [ ] Create `src/lib/prisma.ts` — singleton Prisma client instance
  - [ ] Create `prisma/seed.ts` — basic seed script with test user + workspace
  - [ ] Add to package.json: `"prisma": { "seed": "ts-node prisma/seed.ts" }`
- [ ] Task 5: Environment configuration (AC: 1)
  - [ ] `.env.example` with all variables documented
  - [ ] `.env.local` in `.gitignore`
  - [ ] `.env.test` for test database URL
- [ ] Task 6: Package.json scripts (AC: 1)
  - [ ] `dev` — Next.js dev server
  - [ ] `build` — production build
  - [ ] `start` — production server
  - [ ] `lint` — ESLint check
  - [ ] `format` — Prettier format
  - [ ] `db:migrate` — prisma migrate dev
  - [ ] `db:seed` — prisma db seed
  - [ ] `db:reset` — prisma migrate reset
  - [ ] `db:studio` — prisma studio
  - [ ] `test` — run tests (placeholder until Story 0.4)

## Dev Notes

- **This is the very first story to implement** (parallel with Story 1.2 Docker)
- Use Node.js 20 LTS
- Prisma over Drizzle — better ecosystem, migrations, and studio for MVP pace
- Keep Tailwind config minimal — extend only as needed
- The User model uses password field for MVP; switch to OAuth adapters in post-MVP
- `src/lib/prisma.ts` must handle hot-reload in dev (prevent multiple instances)
- Seed data should create a default dev user: `dev@productoOs.local` / `devpassword`

### Project Structure Notes

- `/src/app/` — Next.js App Router pages and layouts
- `/src/components/` — Shared UI components
- `/src/lib/` — Business logic (prisma client, utilities)
- `/src/hooks/` — Custom React hooks
- `/src/types/` — Shared TypeScript types
- `/prisma/` — Schema, migrations, seed
- `/.husky/` — Git hooks

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 0 — Story 0.1]
- [Source: Architecture#Frontend Architecture — Stack]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
