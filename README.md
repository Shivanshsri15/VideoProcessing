# Video Processing Platform

API-only NestJS backend for authenticated video upload, async FFmpeg processing (one job at a time), AWS S3 storage, and task status APIs.

## Table of contents

- [What it does](#what-it-does)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [End-to-end flow](#end-to-end-flow)
- [Prerequisites](#prerequisites)
- [Setup and run](#setup-and-run)
- [Environment variables](#environment-variables)
- [API reference](#api-reference)
- [Authentication and security](#authentication-and-security)
- [Upload, storage, and processing](#upload-storage-and-processing)
- [Processing optimizations](#processing-optimizations)
- [Email notifications](#email-notifications)
- [Analytics (DevOps)](#analytics-devops)
- [Queue and worker](#queue-and-worker)
- [Data model](#data-model)
- [Project layout](#project-layout)

## What it does

| Capability | Behavior |
|------------|----------|
| Auth | Register, login, logout, change password (JWT) |
| Upload | Multipart video → S3 original, duration via FFprobe, ETA |
| Queue | BullMQ job per task; worker concurrency **1** (system-wide) |
| Process | Stream S3 ↔ temp disk → H.264/AAC MP4 + JPEG thumb → stream to S3; retries with resumable download |
| Email | Notify task owner on `completed` / final `failed` (Nodemailer → Mailhog/SMTP) |
| Analytics | JWT DevOps JSON: processing stats, queue snapshot, API process resources |
| Status | List/get task, progress polling, thumbnail download |
| Security | bcrypt, JWT ID denylist, token version, Redis rate limits |

## Tech stack

| Layer | Choice |
|--------|--------|
| Runtime | Node.js **24.22.x**, npm **11.19.1** |
| API | NestJS + TypeScript (ESM) |
| DB | Cloud MongoDB (Mongoose) |
| Redis | Rate limits, JWT denylist, task status cache, BullMQ |
| Queue | BullMQ (`video-processing`, concurrency 1) |
| Storage | AWS S3 |
| Media | FFprobe (upload ETA), FFmpeg (worker) |
| Email | Nodemailer → Mailhog (Compose) or real SMTP |
| Deploy | Docker Compose: `api` + `redis` + `worker` + `mailhog` |

## Architecture

```mermaid
flowchart TB
  Client[Client] --> API[NestJS_API]
  API --> Mongo[(MongoDB)]
  API --> Redis[(Redis)]
  API --> S3[AWS_S3]
  API --> Probe[FFprobe]
  API -->|enqueue| Bull[BullMQ]
  Worker[NestJS_Worker] -->|claim job| Bull
  Worker --> S3
  Worker --> FF[FFmpeg]
  Worker --> Mongo
  Worker --> Redis
  Worker --> Mail[Nodemailer]
  Mail --> SMTP[Mailhog_or_SMTP]
```

- **API process** (`node dist/main.js`) — HTTP, upload, enqueue, status reads.
- **Worker process** (`node dist/worker.main.js`) — BullMQ consumer; FFmpeg + S3 + status writes + outcome email.
- Same `REDIS_URL` and Mongo URI; separate process connections. BullMQ uses its own Redis client (`maxRetriesPerRequest: null`), separate from app `RedisService`.

## End-to-end flow

```mermaid
sequenceDiagram
  participant C as Client
  participant A as API
  participant M as Mongo
  participant R as Redis
  participant S3 as S3
  participant Q as BullMQ
  participant W as Worker

  C->>A: POST login
  A-->>C: accessToken
  C->>A: POST upload file
  A->>A: FFprobe duration and ETA
  A->>S3: PutObject original
  A->>M: create task queued
  A->>R: SET task status cache
  A->>Q: add job jobId equals taskId
  A-->>C: taskId status queued etaSeconds
  Q->>W: claim next job concurrency 1
  W->>M: status processing
  W->>S3: stream download original to temp
  W->>W: FFmpeg MP4 plus thumbnail
  W->>S3: stream upload output and thumb
  W->>M: status completed progress 100
  W->>R: refresh status cache
  W->>W: email owner via SMTP
  C->>A: GET progress or thumbnail
  A-->>C: progress or JPEG
```

## Prerequisites

- Node.js 24.22.x and npm 11.19.1 (`corepack enable`)
- Docker + Docker Compose
- Cloud MongoDB URI (allow your IP)
- AWS S3 bucket + IAM rights for `PutObject` / `GetObject` / `HeadObject` / `DeleteObject`
- For local (non-Compose) API/worker: `ffprobe` and `ffmpeg` on `PATH`

## Setup and run

```bash
cp .env.example .env
# Fill MONGODB_URI, JWT_SECRET, AWS_* , S3_BUCKET
```

**Compose (recommended):**

```bash
docker compose up --build
```

Health: [http://localhost:3000/health](http://localhost:3000/health)  
Mailhog UI: [http://localhost:8025](http://localhost:8025)

**Local API + Redis + worker:**

```bash
docker compose up redis -d
npm install
npm run start:dev
# other terminal
npm run start:worker:dev
```

**Tests:**

```bash
npm run test
```

### Docker `npm ci` / lockfile sync

Compose builds use **Node 24.22** + **npm 11.19.1** (`npm ci`). If your machine uses a different Node/npm (or `npm install --force`), `package-lock.json` can drift and the image build fails with errors like `Missing: @emnapi/core@… from lock file`.

**Fix — regenerate the lockfile with the same toolchain as Docker, then rebuild:**

```bash
# From the repo root (PowerShell / bash)
docker run --rm -v "${PWD}:/app" -w /app node:24.22-bookworm-slim bash -lc "corepack enable && corepack prepare npm@11.19.1 --activate && rm -rf node_modules && npm install && npm ci"

docker compose up --build
```

Commit the updated `package-lock.json`. For day-to-day local installs, match prerequisites (`corepack enable` → npm **11.19.1**, Node **24.22.x**) so the lockfile stays compatible with Compose.

## Environment variables

See [`.env.example`](.env.example). Do not commit real secrets.

| Variable | Purpose |
|----------|---------|
| `PORT` | API port (default `3000`) |
| `MONGODB_URI` | Cloud MongoDB connection string |
| `REDIS_URL` | Redis (`localhost` locally; Compose sets `redis://redis:6379`) |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Access token signing (default lifetime `5h`) |
| `BCRYPT_COST` | Password hash cost |
| `THROTTLE_*` | Rate-limit window and limits |
| `AWS_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | S3 credentials |
| `S3_BUCKET` | Bucket name |
| `S3_ORIGINAL_PREFIX` | Original + processed MP4 prefix (`originals/`) |
| `S3_THUMBNAIL_PREFIX` | Thumbnail prefix (`thumbnails/`) |
| `MAX_UPLOAD_BYTES` | Max upload size (default 500MB) |
| `FFPROBE_PATH` / `FFMPEG_PATH` | Media binaries |
| `VIDEO_QUEUE_NAME` | BullMQ queue name |
| `VIDEO_WORKER_CONCURRENCY` | Must stay `1` for one-at-a-time processing |
| `TASK_STATUS_CACHE_TTL_SEC` | Status cache TTL (default 24h) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | SMTP server (Compose sets host to `mailhog`) |
| `SMTP_USER` / `SMTP_PASS` | Optional auth (leave empty for Mailhog) |
| `MAIL_FROM` | From header for outcome emails |

## API reference

Base URL: `http://localhost:3000`

### Health

`GET /health` → `{ "status": "ok" }`

### Auth

| Method | Path | Auth | Notes |
|--------|------|------|--------|
| `POST` | `/api/auth/register` | No | Body `{ email, password }` → user (no token) |
| `POST` | `/api/auth/login` | No | → `{ accessToken, tokenType, expiresIn, user }` |
| `POST` | `/api/auth/change-password` | Bearer | `{ currentPassword, newPassword }` — bumps token version |
| `POST` | `/api/auth/logout` | Bearer | Denylists this JWT ID |

### Videos

| Method | Path | Auth | Notes |
|--------|------|------|--------|
| `POST` | `/api/videos/upload` | Bearer | Multipart field **`file`**; MP4/AVI/MOV/WMV/FLV; max 500MB; 5/min/user |
| `GET` | `/api/videos/tasks` | Bearer | `limit` (default 20, max 50), `skip` |
| `GET` | `/api/videos/tasks/:taskId` | Bearer | Owner-only status snapshot |
| `GET` | `/api/videos/tasks/:taskId/progress` | Bearer | `{ taskId, status, progress, etaSeconds }` |
| `GET` | `/api/videos/tasks/:taskId/thumbnail` | Bearer | `image/jpeg` when completed |
| `GET` | `/api/videos/analytics` | Bearer | System-wide processing stats + caller `userActivity` |
| `GET` | `/api/videos/queue` | Bearer | BullMQ counts, concurrency, estimated wait |
| `GET` | `/api/videos/system` | Bearer | API process memory/CPU/uptime + worker config |

**Upload response example:**

```json
{
  "taskId": "uuid",
  "status": "queued",
  "s3Key": "originals/userId/taskId/clip.mp4",
  "etaSeconds": 90,
  "progress": 0,
  "metadata": { "durationSec": 125.4 }
}
```

**ETA:** `etaSeconds = ceil(durationSec / 60) * 30` (estimated processing seconds, not video length).

### Quick test (PowerShell)

```powershell
curl -X POST http://localhost:3000/api/auth/login `
  -H "Content-Type: application/json" `
  -d "{\"email\":\"you@example.com\",\"password\":\"password123\"}"

curl -X POST http://localhost:3000/api/videos/upload `
  -H "Authorization: Bearer YOUR_TOKEN" `
  -F "file=@D:\path\to\video.mp4"

curl http://localhost:3000/api/videos/tasks/TASK_ID/progress `
  -H "Authorization: Bearer YOUR_TOKEN"

curl http://localhost:3000/api/videos/tasks/TASK_ID/thumbnail `
  -H "Authorization: Bearer YOUR_TOKEN" `
  -o thumb.jpg
```

## Authentication and security

### Users

MongoDB `users`: unique `email`, `passwordHash` (bcrypt, never returned), `tokenVersion` (default `0`).

### JWT access tokens

Payload includes `sub` (user id), `email`, **`jti`** (JWT ID), **`tv`** (token version), `exp`.

```mermaid
flowchart TB
  Guard[JWT_guard] --> Deny{"jti in Redis denylist?"}
  Deny -->|yes| R401[401]
  Deny -->|no| TV{"tv matches user.tokenVersion?"}
  TV -->|no| R401
  TV -->|yes| OK[Allow]
  Logout[Logout] --> DenySet["SET jwt:deny:jti TTL"]
  ChangePw[Change_password] --> Bump["tokenVersion plus 1"]
  ChangePw --> DenySet
```

| Action | Effect |
|--------|--------|
| Logout | Denylist this `jti` until token expiry — other sessions keep working |
| Change password | Increment `tokenVersion` + denylist current `jti` — all older tokens fail |

### Rate limits (Redis)

| Routes | Scope | Limit |
|--------|--------|--------|
| register, login | Client IP | 10 / minute |
| change-password, logout | User id | 20 / minute |
| video upload | User id | 5 / minute |
| Default | Client IP | 60 / minute |

Counters live under `rl:default:<hash>` (TTL = window). Denylist keys: `jwt:deny:<jti>`.

## Upload, storage, and processing

### Upload path

1. Validate format/size  
2. FFprobe duration → ETA  
3. `PutObject` original to S3  
4. Create `video_tasks` (`queued`)  
5. Cache status in Redis  
6. Enqueue BullMQ job (`jobId = taskId`)

### S3 layout

```text
originals/{userId}/{taskId}/{originalFilename}
originals/{userId}/{taskId}/output.mp4
thumbnails/{userId}/{taskId}/thumb.jpg
```

```mermaid
flowchart LR
  task[taskId] --> orig[originals_prefix]
  task --> thumbs[thumbnails_prefix]
  orig --> raw[original_file]
  orig --> mp4[output.mp4]
  thumbs --> jpg[thumb.jpg]
```

S3 holds bytes; Mongo holds task state. A CDN can sit in front of processed objects later; uploads always go API → S3.

### Worker pipeline

```mermaid
sequenceDiagram
  participant W as Worker
  participant S3 as S3
  participant Disk as TempDisk
  participant FF as FFmpeg
  participant M as Mongo
  participant R as Redis

  W->>M: processing progress 0
  W->>R: refresh cache
  W->>S3: GetObject stream plus optional Range
  S3-->>Disk: pipe chunks to input file
  Note over W,Disk: wait until input is complete
  W->>FF: -i input path file to file
  FF-->>Disk: write output.mp4 while encoding
  W->>FF: extract thumb.jpg
  W->>S3: multipart stream upload output and thumb
  W->>M: completed progress 100
  W->>R: refresh cache
  W->>Disk: rm work dir
```

Order is still **download complete → FFmpeg → upload**. Streaming means low-RAM I/O to/from disk, not overlapping encode while the download is still in progress.

## Processing optimizations

### Stream to disk (not into Node RAM)

| Before | Now |
|--------|-----|
| `GetObject` → full `Buffer` in heap → `writeFile` | `GetObject` body **piped** to a temp file |
| `readFile` entire MP4/JPEG into `Buffer` → `PutObject` | `@aws-sdk/lib-storage` **streams** file reads to S3 (multipart for large outputs) |

FFmpeg still needs a **seekable** local file (`-i` path), so the worker materializes `tmpdir()/process-{taskId}/input` first, then runs file→file transcode/thumbnail, then streams results up.

### Resumable original download

If download fails mid-transfer, the partial `input` is **kept**. The next BullMQ attempt:

1. `HeadObject` → expected size  
2. If local size already matches → skip download  
3. If `0 < size < expected` → `GetObject` with `Range: bytes=N-` and **append**  
4. If oversized/corrupt local size → delete and start fresh  

### Retries and failure cleanup

| Failure | Behavior |
|---------|----------|
| S3 download | Retry; resume from partial `input` |
| FFmpeg transcode / thumbnail | Retry; delete temp `output.mp4` / `thumb.jpg`; **keep** complete `input` (no mid-encode resume — FFmpeg restarts from 0) |
| S3 upload | Retry; next attempt overwrites the same keys |
| Final attempt failed | `status: failed` + `failureReason`; **delete** orphaned `output.mp4` / `thumb.jpg` on S3; wipe temp dir; **keep** original upload |
| Task missing | Immediate `UnrecoverableError` (no retries) |

- **Attempts:** 3 (`PROCESS_JOB_ATTEMPTS`)  
- **Backoff:** exponential from 5s (`PROCESS_JOB_BACKOFF_MS`) → ~5s, 10s, 20s  
- Between retries status stays `processing` (no user-facing `failed` until the last attempt)  
- No manual retry API — upload again for a new task  

```mermaid
flowchart TD
  Start[processJob_attempt] --> Run[resume_download_then_FFmpeg_then_upload]
  Run -->|ok| Done[markCompleted_wipe_temp]
  Run -->|error| Last{final_attempt?}
  Last -->|no| Keep[keep_input_drop_temp_outputs]
  Keep --> Wait[BullMQ_exponential_backoff]
  Wait --> Start
  Last -->|yes| Fail[markFailed_delete_S3_orphans_wipe_temp]
```

## Email notifications

After a durable terminal status (`completed`, or `failed` on the **final** BullMQ attempt), the worker emails the task owner (`users.email`).

```mermaid
sequenceDiagram
  participant W as Worker
  participant M as Mongo
  participant U as Users
  participant E as EmailService
  participant S as Mailhog_SMTP

  W->>M: markCompleted_or_markFailed
  W->>U: findById_userId
  W->>E: sendTaskOutcome
  E->>S: SMTP_send
  W->>M: set_emailNotifiedAt
```

- **Local inbox:** Mailhog UI at [http://localhost:8025](http://localhost:8025) (SMTP `1025`). Compose sets `SMTP_HOST=mailhog` for `api`/`worker`.
- **Idempotency:** skip if `emailNotifiedAt` is already set; set it only after a successful send.
- **Isolation:** SMTP/mail errors are logged only — they do **not** change task status or fail a successful job.
- **Auth:** `SMTP_USER` / `SMTP_PASS` stay empty for Mailhog; fill them for real SMTP providers.

## Analytics (DevOps)

JWT-only JSON metrics for operators (no web UI). Bonus features (cancel, priority, multi-format, readiness probes beyond `GET /health`) are out of scope.

```mermaid
flowchart LR
  Client --> API[AnalyticsController]
  API --> Mongo[video_tasks]
  API --> Bull[BullMQ_counts]
  API --> Proc[API_process_metrics]
```

| Endpoint | Source |
|----------|--------|
| `GET /api/videos/analytics` | Mongo aggregates: status totals, failure rate, processing-time avg/p50/p95/distribution (from `startedAt`/`completedAt`), ETA vs actual, caller upload activity |
| `GET /api/videos/queue` | BullMQ `getJobCounts`; `estimatedWaitSeconds ≈ waiting × avg recent completed duration`; concurrency from `VIDEO_WORKER_CONCURRENCY` |
| `GET /api/videos/system` | **API** Node process: `process.memoryUsage()`, `process.uptime()`, `os.loadavg()`, `process.cpuUsage()`; worker concurrency/queue name from shared constants (not live FFmpeg RSS in the worker container) |

## Queue and worker

- **One queue** for all users: `video-processing`
- **One worker** container/process; **concurrency 1** → one video processed at a time globally (uploads can still arrive in parallel)
- API **produces** jobs; worker **consumes** them from Redis (FIFO waiting list)
- `jobId = taskId` avoids duplicate jobs for the same task
- Jobs use **3 attempts** + exponential backoff; see [Processing optimizations](#processing-optimizations)

```mermaid
stateDiagram-v2
  [*] --> waiting: Queue_add
  waiting --> active: Worker_claim
  active --> completed: pipeline_ok
  active --> delayed: transient_error_backoff
  delayed --> waiting: retry_up_to_3
  active --> failed: final_attempt_or_unrecoverable
```

### Redis: status cache vs BullMQ

| Key pattern | Purpose |
|-------------|---------|
| `task:status:{taskId}` | JSON snapshot for fast status/progress GETs (TTL configurable) |
| `bull:video-processing:*` | BullMQ waiting/active/completed job data |

Mongo remains the source of truth for tasks. Cache miss → read Mongo → refill cache. Ownership is always checked for status APIs.

## Data model

### `users`

| Field | Role |
|--------|------|
| `email` | Unique login id |
| `passwordHash` | bcrypt |
| `tokenVersion` | Invalidates old JWTs on password change |

### `video_tasks`

| Field | Role |
|--------|------|
| `taskId` | Public UUID |
| `userId` | Owner |
| `status` | `queued` \| `processing` \| `completed` \| `failed` \| `cancelled` |
| `s3Key` | Original object key |
| `outputKey` / `thumbnailKey` | Processed artifacts |
| `metadata.durationSec` | From FFprobe at upload |
| `progress` | 0–100 |
| `etaSeconds` | Estimate at submit |
| `failureReason` | Optional |
| `startedAt` / `completedAt` | Processing timing |
| `emailNotifiedAt` | Set after successful outcome email |

## Project layout

```text
src/
  main.ts                 # API entry
  worker.main.ts          # Worker entry
  app.module.ts
  auth/                   # JWT auth, guards, rate-limit by user
  users/
  videos/                 # upload, status APIs, enqueue, FFprobe, status cache, analytics
  email/                  # Nodemailer + templates
  queue/                  # shared BullMQ connection
  worker/                 # consumer + VideoProcessingService (FFmpeg + notify)
  s3/
  redis/
  health/
docker-compose.yml        # api, redis, worker, mailhog
Dockerfile                # Node image + ffmpeg/ffprobe
.env.example
```
