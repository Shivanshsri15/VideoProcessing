# Video Processing Platform

NestJS backend for authenticated video upload, async FFmpeg processing (BullMQ), AWS S3 storage, and analytics APIs. **API-only** — no web UI.

## Table of contents

- [Status / progress](#status--progress)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Setup & run](#setup--run)
- [Environment variables](#environment-variables)
- [API reference](#api-reference)
- [Module changelog](#module-changelog)
- [Project layout](#project-layout)

## Status / progress

| Module | Name | Status |
|--------|------|--------|
| **M0** | Scaffold (health, config, Docker API) | Done |
| M1 | Auth & security (design → then implement) | Next — design session first |
| M2 | Upload & AWS S3 | Pending |
| M3 | Queue & status (+ worker in Compose) | Pending |
| M4 | FFmpeg worker | Pending |
| M5 | Email notifications | Pending |
| M6 | Analytics | Pending |
| M7 | Ops, tests, submission polish | Pending |
| M8 | Bonus features | Pending (after core) |

## Tech stack

| Layer | Choice |
|--------|--------|
| API | NestJS + TypeScript |
| Auth | JWT + Passport (M1) |
| Database | MongoDB + Mongoose — external (M1) |
| Queue | BullMQ + Redis — external (M3+) |
| Storage | AWS S3 (M2) |
| Media | FFmpeg / FFprobe (M2/M4) |
| Email | Nodemailer → SMTP (M5) |
| Containers | Docker Compose: **API only** in M0; worker added in M3 |

## Architecture

**M0 (current):** a single NestJS API process. Liveness via `GET /health`. Configuration via env / `.env`.

```text
Client ──► NestJS API (Compose: api)
              └── GET /health
```

Later modules introduce MongoDB, Redis, AWS S3, BullMQ worker, and FFmpeg. Compose will never host Mongo/Redis/S3 — only `api` and (from M3) `worker`.

## Prerequisites

- **Node.js 24.22.x** — pinned in [`.nvmrc`](.nvmrc) / [`.node-version`](.node-version) (same major/minor as the API Docker image)
- **npm 11.19.1** — pinned via `packageManager` in `package.json` (enable with `corepack enable`)
- Docker + Docker Compose (to run the API container)

External MongoDB / Redis / AWS S3 / SMTP are **not** required for M0.

Node and npm are pinned so `package-lock.json` and Docker `npm ci` stay aligned; collaborators should not need lockfile repair steps.

## Setup & run

### Local (without Docker)

```bash
# nvm / fnm / asdf will pick up .nvmrc
corepack enable
cp .env.example .env
npm install
npm run start:dev
```

Health check: [http://localhost:3000/health](http://localhost:3000/health)

### Docker Compose (API only)

```bash
cp .env.example .env
docker compose up --build
```

Same health URL: [http://localhost:3000/health](http://localhost:3000/health)

### Tests

```bash
npm run test
```

## Environment variables

Copy [`.env.example`](.env.example). Variables introduced so far:

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Runtime environment |
| `PORT` | `3000` | HTTP port (host mapping uses this for Compose publish) |

## API reference

### `GET /health`

Liveness probe. Does not check Mongo, Redis, or S3 (those come later).

**Response `200`**

```json
{ "status": "ok" }
```

## Module changelog

### M0 — Scaffold

- NestJS root app wired with `@nestjs/config`
- `GET /health` liveness endpoint
- `.env.example` (`PORT`, `NODE_ENV`)
- `Dockerfile` for the API (`node:24.22` + Corepack npm `11.19.1`; lockfile committed in sync)
- `.nvmrc` / `engines` / `packageManager` pin Node+npm for local and Docker
- `docker-compose.yml` with **`api` service only**
- This living README (TOC + progress tracker)

## Project layout

```text
videoProcessAssignment/
├── src/
│   ├── main.ts                 # bootstrap; reads PORT from ConfigService
│   ├── app.module.ts           # ConfigModule + HealthModule
│   └── health/
│       ├── health.module.ts
│       ├── health.controller.ts
│       └── health.controller.spec.ts
├── Dockerfile                  # API image (Node 24.22 + npm 11.19.1)
├── docker-compose.yml          # api only (M0)
├── .nvmrc / .node-version      # Node 24.22.2
├── .npmrc                      # engine-strict
├── .env.example
├── package.json
└── README.md
```

