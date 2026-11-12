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
- [Security (M1)](#security-m1)
  - [Database design](#database-design)
  - [Authentication flow](#authentication-flow)
  - [JWT ID and token version use-case architecture](#jwt-id-and-token-version-use-case-architecture)
  - [Rate limiting strategy](#rate-limiting-strategy)
  - [Rate limiter](#rate-limiter)
  - [Redis keys for rate limiting](#redis-keys-for-rate-limiting)
- [Upload & storage (M2)](#upload--storage-m2)
  - [Upload architecture](#upload-architecture)
  - [Why AWS S3](#why-aws-s3)
  - [Pros and cons](#pros-and-cons)
  - [CDN notes](#cdn-notes)
  - [`video_tasks` schema](#video_tasks-schema)
- [Queue & status (M3)](#queue--status-m3)
  - [Global concurrency](#global-concurrency)
  - [API vs worker connections](#api-vs-worker-connections)
  - [Enqueue after upload](#enqueue-after-upload)
  - [How BullMQ stores jobs in Redis](#how-bullmq-stores-jobs-in-redis)
  - [How the worker picks up a job](#how-the-worker-picks-up-a-job)
  - [Status cache vs BullMQ](#status-cache-vs-bullmq)
- [FFmpeg worker (M4)](#ffmpeg-worker-m4)
  - [Processing pipeline](#processing-pipeline)
  - [S3 layout](#s3-layout)
  - [Status and cache during processing](#status-and-cache-during-processing)
- [Module changelog](#module-changelog)
- [Project layout](#project-layout)

## Status / progress

| Module | Name | Status |
|--------|------|--------|
| **M0** | Scaffold (health, config, Docker API) | Done |
| **M1** | Auth & security | Done |
| **M2** | Upload & AWS S3 | Done |
| **M3** | Queue & status (+ worker in Compose) | Done |
| **M4** | FFmpeg worker | Done |
| M5 | Email notifications | Pending |
| M6 | Analytics | Pending |
| M7 | Ops, tests, submission polish | Pending |
| M8 | Bonus features | Pending (after core) |

## Tech stack

| Layer | Choice |
|--------|--------|
| API | NestJS + TypeScript |
| Auth | JWT + Passport, bcrypt, Redis JWT ID denylist, token version |
| Database | **Cloud MongoDB** via `MONGODB_URI` (Mongoose) |
| Cache / rate limit / denylist | Redis in Docker Compose |
| Queue | BullMQ + Redis (shared queue; worker concurrency **1**) |
| Storage | **AWS S3** (upload originals in M2) |
| Media | **FFprobe** at upload (ETA); **FFmpeg** in worker (MP4 + thumbnail) |
| Email | Nodemailer → SMTP (M5) |
| Containers | Compose: **`api` + `redis` + `worker`** |

## Architecture

**M4 (current):** upload → FFprobe → S3 original → Mongo + status cache → BullMQ enqueue → worker (concurrency **1**) downloads, FFmpeg transcodes to MP4, writes thumbnail, updates status/progress.

```text
Client ──► NestJS API (Compose: api)
              ├── MongoDB (users + video_tasks)
              ├── Redis (denylist + rate limits + task:status cache)
              ├── FFprobe (duration → etaSeconds)
              ├── AWS S3 (originals/ + thumbnails/)
              └── BullMQ producer (enqueue process-video, jobId=taskId)

         NestJS Worker (Compose: worker, concurrency 1)
              └── VideoProcessingService (FFmpeg MP4 + thumb + status updates)
```

## Prerequisites

- **Node.js 24.22.x** — pinned in [`.nvmrc`](.nvmrc) / [`.node-version`](.node-version)
- **npm 11.19.1** — `packageManager` in `package.json` (`corepack enable`)
- Docker + Docker Compose (API + Redis + worker)
- **cloud MongoDB** URI
- **AWS S3** bucket + credentials
- **FFprobe** on PATH for local `npm run start:dev` (Compose API image installs `ffmpeg`)

## Setup & run

1. Copy env and fill secrets:

```bash
cp .env.example .env
# MONGODB_URI, JWT_SECRET
# AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET
```

2. Allow your machine in the MongoDB network access list; ensure the IAM user can `s3:PutObject` on the bucket.

### Local API + Compose Redis (+ local worker)

```bash
corepack enable
npm install
docker compose up redis -d
npm run start:dev
# other terminal:
npm run start:worker:dev
```

### Full Compose (API + Redis + worker)

```bash
docker compose up --build
```

Health: [http://localhost:3000/health](http://localhost:3000/health)

### Tests

```bash
npm run test
```

## Environment variables

See [`.env.example`](.env.example).

| Variable | Example | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Runtime environment |
| `PORT` | `3000` | HTTP port |
| `MONGODB_URI` | `mongodb+srv://...` | **Your** cloud MongoDB URI (required) |
| `REDIS_URL` | `redis://localhost:6379` | Redis URL (Compose overrides to `redis://redis:6379` for `api`) |
| `JWT_SECRET` | long random string | JWT signing secret |
| `JWT_EXPIRES_IN` | `5h` | Access token lifetime |
| `BCRYPT_COST` | `12` | bcrypt cost factor |
| `THROTTLE_TTL_MS` | `60000` | Rate-limit window |
| `THROTTLE_LIMIT` | `60` | Default requests per window |
| `THROTTLE_AUTH_LIMIT` | `10` | Documented public-auth limit (wired via `@Throttle` on routes) |
| `THROTTLE_USER_LIMIT` | `20` | Documented protected-auth limit |
| `AWS_REGION` | e.g. `ap-south-1` | S3 region |
| `AWS_ACCESS_KEY_ID` | — | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | — | IAM secret |
| `S3_BUCKET` | — | Bucket for originals |
| `S3_ORIGINAL_PREFIX` | `originals/` | Original + processed MP4 prefix |
| `S3_THUMBNAIL_PREFIX` | `thumbnails/` | Thumbnail JPEG prefix |
| `MAX_UPLOAD_BYTES` | `524288000` | 500MB cap |
| `FFPROBE_PATH` | `ffprobe` | FFprobe binary |
| `FFMPEG_PATH` | `ffmpeg` | FFmpeg binary (worker) |
| `VIDEO_QUEUE_NAME` | `video-processing` | Shared BullMQ queue (all users) |
| `VIDEO_WORKER_CONCURRENCY` | `1` | **System-wide** processing concurrency |
| `TASK_STATUS_CACHE_TTL_SEC` | `86400` | Redis `task:status:*` TTL |

Never commit real credentials. `.env` is gitignored.

## API reference

### `GET /health`

Liveness probe for the API process.

```json
{ "status": "ok" }
```

### Auth

#### `POST /api/auth/register`

Body: `{ "email", "password" }`  
`201` → `{ id, email, createdAt }` (no token; login next). Email is the unique identifier.

#### `POST /api/auth/login`

Body: `{ "email", "password" }`  
`200` → `{ accessToken, tokenType: "Bearer", expiresIn, user }`

#### `POST /api/auth/change-password` (Bearer JWT)

Body: `{ "currentPassword", "newPassword" }`  
Increments **token version** (invalidates all sessions) and denylists current **JWT ID**.

#### `POST /api/auth/logout` (Bearer JWT)

Denylists current **JWT ID** in Redis. `200` → `{ "message": "Logged out" }`

### Videos

#### `POST /api/videos/upload` (Bearer JWT)

- Body: `multipart/form-data` field **`file`**
- Allowlist: MP4, AVI, MOV, WMV, FLV; max **500MB**
- Rate limit: **5 / minute / user**
- `201`:

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

Upload also **enqueues** a BullMQ job (`jobId = taskId`) and writes a Redis status snapshot. Multiple uploads are allowed (rate-limited); **processing** is system-wide concurrency **1** (not per-user). The worker runs FFmpeg (MP4 + thumbnail) and updates progress.

#### `GET /api/videos/tasks` (Bearer JWT)

Query: `limit` (default 20, max 50), `skip` (default 0).  
Returns the current user’s tasks (newest first) as status snapshots.

#### `GET /api/videos/tasks/:taskId` (Bearer JWT)

Owner-only task status (Redis cache with Mongo fallback). `404` if missing or not owned.

#### `GET /api/videos/tasks/:taskId/progress` (Bearer JWT)

```json
{
  "taskId": "uuid",
  "status": "processing",
  "progress": 45,
  "etaSeconds": 30
}
```

Progress is updated by the worker during FFmpeg (~every 5%).

#### `GET /api/videos/tasks/:taskId/thumbnail` (Bearer JWT)

Returns `image/jpeg` when the task is `completed` and a thumbnail exists. `404` otherwise.

---

## Security (M1)

M1 implements registration/login, JWT access tokens (5h), logout via Redis JWT ID denylist, password change with token version bump, and Redis-backed rate limits.

### Database design

`users` collection in cloud MongoDB:

```mermaid
erDiagram
  users {
    ObjectId _id PK
    string email UK
    string passwordHash
    int tokenVersion
    date createdAt
    date updatedAt
  }
```

- `email` — unique identifier (lowercase, trimmed)  
- `passwordHash` — bcrypt; never returned in API responses  
- `tokenVersion` — starts at `0`; incremented on password change  

Public user shape: `{ id, email, createdAt }`.

### Authentication flow

```mermaid
sequenceDiagram
  participant C as Client
  participant A as AuthAPI
  participant M as MongoDB
  participant R as Redis

  C->>A: POST /api/auth/register
  A->>M: insert user token version 0
  A-->>C: 201 user

  C->>A: POST /api/auth/login
  A->>M: verify bcrypt password
  A->>A: sign access token with JWT ID and token version
  A-->>C: 200 accessToken user

  C->>A: Bearer access token on protected route
  A->>A: verify signature and expiry
  A->>R: check JWT ID denylist
  A->>M: load user by subject
  A->>A: token version must match MongoDB
  A-->>C: 200 or 401

  C->>A: POST /api/auth/change-password
  A->>M: new hash and token version plus 1
  A->>R: denylist current JWT ID
  Note over A,R: All older access tokens fail token version check

  C->>A: POST /api/auth/logout
  A->>R: denylist JWT ID until token expiry
  A-->>C: 200
```

### JWT ID and token version use-case architecture

| Claim in JWT | Full name | Role | Use case |
|--------------|-----------|------|----------|
| `jti` | **JWT ID** | Unique id per issued access token | **Logout** — revoke **this** session only via Redis denylist |
| `tv` | **Token version** | Integer on the user document, copied into every new JWT | **Change password** — increment MongoDB token version so **all** older access tokens fail |

```mermaid
flowchart TB
  Login[Login issues access token] --> Claims["Token claims include JWT ID and token version"]
  Claims --> Guard[JWT guard on each request]

  Guard --> DenyCheck{"JWT ID present in Redis denylist?"}
  DenyCheck -->|yes| Reject401[401 Unauthorized]
  DenyCheck -->|no| VersionCheck{"Token version matches user token version in MongoDB?"}
  VersionCheck -->|no| Reject401
  VersionCheck -->|yes| Allow[Allow request]

  Logout[Logout] --> DenyOne["Add JWT ID to Redis denylist\nrevokes this session only"]
  ChangePw[Change password] --> BumpVersion["Increment user token version in MongoDB\ninvalidates all older access tokens"]
  ChangePw --> DenyOneAlso["Also denylist current JWT ID"]

  DenyOne --> Guard
  BumpVersion --> Guard
  DenyOneAlso --> Guard
```

1. **Logout** — store this token’s JWT ID in Redis until the access token would expire; other devices keep working.  
2. **Change password** — bump token version + denylist current JWT ID; every older token fails the version check.  
3. **Normal request** — denylist check, then token version match; both must pass.

### Rate limiting strategy

Public auth routes are limited **per client IP**. Authenticated auth routes are limited **per user** (JWT guard runs before the user throttler). Other routes use the default window limit.

```mermaid
flowchart LR
  Request[API request] --> PublicAuth["Public auth\nregister login\n10 per minute per IP"]
  Request --> ProtectedAuth["Protected auth\nchange-password logout\n20 per minute per user"]
  Request --> DefaultLimit["All other routes\n60 per minute"]
  PublicAuth --> Outcome{Allowed?}
  ProtectedAuth --> Outcome
  DefaultLimit --> Outcome
  Outcome -->|yes| OK[Handle request]
  Outcome -->|no| Blocked[HTTP 429]
```

| Category | Routes | Scoped by | Limit |
|----------|--------|-----------|--------|
| Public auth | register, login | Client IP | 10 / minute |
| Protected auth | change-password, logout | Authenticated user | 20 / minute |
| Default | other routes | Client IP | 60 / minute |

### Rate limiter

```mermaid
flowchart LR
  Ctrl[AuthController] --> Guard[ThrottlerGuard]
  Guard --> Store[RedisThrottleStore]
  Store --> Redis[(Redis)]
  Store -->|INCR and EXPIRE window| Redis
  Guard -->|over limit| R429[429]
  Guard -->|ok| Auth[AuthService]
```

**How the route is wired**

- `@UseGuards(ThrottlerGuard)` (or `UserThrottlerGuard`) — runs the rate-limit check before the handler.
- `@Throttle({ default: { limit, ttl } })` — sets **this route’s** limit/window (overrides the module default from `ThrottlerModule` in `AppModule`).
- `ThrottlerModule.forRootAsync({ storage: RedisThrottlerStorage })` — the guard’s `storage.increment(...)` is our Redis implementation (there is no separate Redis “lookup” API; check = `INCR` then `count > limit`).

### Redis keys for rate limiting

**What is stored (rate limit only — not the JWT or user session)**

| | |
|--|--|
| **Redis key** | `rl:<throttlerName>:<hash>` e.g. `rl:default:4f8fe074e4e8...` |
| **Value** | Integer hit **counter** (`INCR`) |
| **TTL** | Window length (~60s); key auto-deletes when TTL expires (bucket resets) |

**How `<hash>` is generated** (Nest `ThrottlerGuard`, deterministic):

1. **Tracker** — public auth: client IP (`req.ip`); protected auth: `user:<userId>` (fallback IP if no user).
2. **Key material** — `AuthController-<handlerName>-default-<tracker>`  
   Examples: `AuthController-login-default-127.0.0.1`, `AuthController-register-default-127.0.0.1`
3. **Hash** — SHA-256 of that string → the hex suffix in Redis.
4. **Our prefix** — `RedisThrottlerStorage` stores `rl:default:` + that hash.

Same IP + same endpoint → **same Redis key** → shared counter.  
Different endpoints (`login` vs `register`) → **different** handler name in step 2 → **different** keys (separate buckets).

**Other Redis keys (not rate limiting)**

| Key | Value | When |
|-----|--------|------|
| `jwt:deny:<jwt-id>` | `1` | Logout or change-password (TTL = remaining access-token life) |

---

## Upload & storage (M2)

### Upload architecture

```mermaid
flowchart LR
  Client --> API[NestJS API]
  API --> Probe[FFprobe]
  API --> S3[AWS S3]
  API --> Mongo[(MongoDB video_tasks)]
```

- Client uploads multipart to the API with a JWT.
- API validates type/size, probes **duration** with FFprobe, computes `etaSeconds = ceil(durationSec/60)*30`.
- Original bytes go to **S3**; MongoDB stores a minimal `video_tasks` row (`s3Key` at root, `metadata.durationSec` only).
- M3 enqueues BullMQ and caches status; M4 replaces the worker stub with FFmpeg (still concurrency 1).

### Why AWS S3

- Durable object storage without growing disks on API/worker containers.
- Better fit for large video blobs (up to 500MB) than MongoDB or local container FS.
- Same SDK path for originals now and processed outputs/thumbnails later (M4).
- Keeps Compose lean (`api` + `redis`); S3 stays cloud-hosted like MongoDB.

### Pros and cons

| Pros | Cons |
|------|------|
| Scalable blob storage; no disk growth on API containers | Needs AWS credentials, bucket IAM, and network to AWS |
| Clear split: DB = task state, S3 = bytes | Upload + later FFmpeg download add latency/cost |
| Easy key prefixes per user/task | Local/dev needs real (or compatible) S3 access |
| Ready for CDN in front of delivery later | Bad bucket policies can leak or block objects |

### CDN notes

Not implemented in M2 — planned delivery layer after processing:

- S3 remains the **origin**; a CDN (e.g. CloudFront) can cache processed MP4s/thumbnails at edge POPs.
- Repeat viewers hit the CDN instead of S3 (lower latency, lower egress).
- Prefer **signed URLs** or private bucket + CDN origin access — avoid public-read buckets by default.
- **Uploads stay API → S3**; CDN is for **read/delivery**, not ingest.

### `video_tasks` schema

Minimal document:

| Field | Purpose |
|--------|---------|
| `taskId` | Public UUID |
| `userId` | Owner |
| `status` | `queued` \| `processing` \| `completed` \| `failed` \| `cancelled` |
| `s3Key` | S3 object key (root field) |
| `metadata` | `{ durationSec }` only |
| `progress` | `0–100` (worker updates) |
| `etaSeconds` | Estimate at submit |
| `failureReason` | Enqueue/processing failure message |
| `outputKey` | Processed MP4 S3 key |
| `thumbnailKey` | Thumbnail JPEG S3 key |
| `startedAt` / `completedAt` | Processing timing |
| `createdAt` / `updatedAt` | Timestamps |

---

## Queue & status (M3)

### Global concurrency

Processing is **one video at a time for the whole system** (not per-user):

1. Single shared queue `video-processing`
2. Exactly **one** Compose `worker` service (do not scale replicas)
3. BullMQ `{ concurrency: 1 }` (`VIDEO_WORKER_CONCURRENCY`)

Upload/auth rate limits remain per-IP / per-user; they do not control processing concurrency.

### API vs worker connections

- **API** (`node dist/main.js`) — HTTP + BullMQ **producer** (`VideoQueueService`)
- **Worker** (`node dist/worker.main.js`) — BullMQ **consumer** (`VideoProcessingProcessor`)
- Both use the same `REDIS_URL`, each with its **own** TCP connections
- BullMQ uses a dedicated connection (`maxRetriesPerRequest: null`); `RedisService` (rate limits / JWT denylist / status cache) stays separate

```mermaid
flowchart LR
  subgraph apiProc [API_process]
    Upload[VideosService.handleUpload]
    Enq[VideoQueueService.enqueue]
    Upload --> Enq
  end
  subgraph redisBox [Redis]
    BullKeys[BullMQ_lists_and_hashes]
    StatusKey["task:status:taskId"]
  end
  subgraph workerProc [Worker_process]
    Proc[VideoProcessingProcessor]
  end
  Enq -->|Queue.add| BullKeys
  Proc -->|BRPOPLPUSH_style_claim| BullKeys
  Upload --> StatusKey
```

### Enqueue after upload

After S3 put + Mongo `video_tasks` create (`status: queued`):

1. Write Redis status snapshot `task:status:{taskId}`.
2. `videoQueue.add('process-video', { taskId, userId, s3Key }, { jobId: taskId })`.

`jobId = taskId` keeps **one BullMQ job per task** (idempotent if the same id is added again).

```mermaid
sequenceDiagram
  participant C as Client
  participant A as API
  participant M as Mongo
  participant R as Redis
  participant B as BullMQ_in_Redis

  C->>A: POST /api/videos/upload
  A->>M: create video_tasks queued
  A->>R: SET task:status:taskId
  A->>B: add process-video jobId=taskId
  A-->>C: taskId status queued etaSeconds
  Note over B: Job sits in waiting until a worker claims it
```

### How BullMQ stores jobs in Redis

BullMQ does **not** use our `task:status:*` keys for the queue. It manages its own keyspace for queue `video-processing` (prefix typically `bull:video-processing:`), including:

| Concept | Role |
|---------|------|
| Job hash | Payload + metadata for one job (`taskId`, `userId`, `s3Key`, attempts, …) |
| **Waiting** list | Jobs ready to run, ordered so the next claim is FIFO |
| **Active** list | Jobs currently locked by a worker |
| Delayed / completed / failed | Other lifecycle sets/lists |

When the API calls `Queue.add`, BullMQ creates the job record and **pushes the job id onto the waiting list**. That is the “enqueue into Redis” step.

### How the worker picks up a job

The worker process boots Nest `WorkerModule`, which registers `@Processor('video-processing', { concurrency: 1 })`. Under the hood BullMQ’s **Worker**:

1. Connects to the same Redis with a dedicated client.
2. **Blocks / polls** the queue’s waiting structure (atomic move waiting → active with a lock token).
3. With `concurrency: 1`, it only holds **one** active job at a time for the whole system.
4. Deserializes the job and calls `VideoProcessingProcessor` → `VideoProcessingService.processJob`.
5. On success → BullMQ completed; on failure → Mongo `failed` + UnrecoverableError (no endless retries; enqueue uses `attempts: 1`).

Important: the worker does **not** “subscribe to the latest upload HTTP request.” It only watches Redis. New uploads become visible as soon as they appear on the waiting list; the next free concurrency slot claims the **oldest waiting** job (FIFO).

```mermaid
sequenceDiagram
  participant W as Worker
  participant Redis as Redis_BullMQ
  participant P as VideoProcessingProcessor
  participant S as VideoProcessingService

  loop While_worker_running
    W->>Redis: claim next waiting job atomic
    alt Slot free concurrency 1
      Redis-->>W: jobId plus payload
      W->>P: process job
      P->>S: processJob payload
      Note over S: FFmpeg MP4 plus thumbnail
      S-->>P: done or failed
      P-->>W: resolve or throw
      W->>Redis: move job to completed or failed
    else Already busy
      Redis-->>W: wait until active job finishes
    end
  end
```

```mermaid
stateDiagram-v2
  [*] --> waiting: API_Queue.add
  waiting --> active: Worker_claims
  active --> completed: FFmpeg_success
  active --> failed: processing_error
```

### Status cache vs BullMQ

| Redis use | Key pattern | Purpose |
|-----------|-------------|---------|
| Status cache (ours) | `task:status:{taskId}` | Fast `GET` status/progress for the API |
| BullMQ (library) | `bull:video-processing:*` | Waiting/active job orchestration |

Mongo `video_tasks` remains the durable task record. Cache TTL: `TASK_STATUS_CACHE_TTL_SEC` (default 24h).

---

## FFmpeg worker (M4)

One shared queue, one worker replica, BullMQ `{ concurrency: 1 }`. All pipeline logic lives in `VideoProcessingService`; the processor is only the BullMQ adapter.

### Processing pipeline

```mermaid
sequenceDiagram
  participant Q as BullMQ
  participant S as VideoProcessingService
  participant M as Mongo
  participant R as Redis
  participant S3 as AWS_S3
  participant FF as FFmpeg

  Q->>S: processJob taskId userId s3Key
  S->>M: status processing progress 0 startedAt
  S->>R: SET task:status:taskId
  S->>S3: GetObject original
  S->>FF: transcode H264 AAC output.mp4
  loop Progress about every 5 percent
    S->>M: progress N
    S->>R: refresh cache
  end
  S->>FF: extract thumb.jpg
  S->>S3: PutObject originals/.../output.mp4
  S->>S3: PutObject thumbnails/.../thumb.jpg
  S->>M: status completed progress 100 keys
  S->>R: refresh cache
```

### S3 layout

Same `userId` / `taskId`, **separate** thumbnail prefix:

```text
originals/{userId}/{taskId}/{originalFilename}
originals/{userId}/{taskId}/output.mp4
thumbnails/{userId}/{taskId}/thumb.jpg
```

```mermaid
flowchart TB
  taskId[taskId]
  taskId --> orig["originals/userId/taskId/"]
  taskId --> thumbs["thumbnails/userId/taskId/"]
  orig --> file[original upload]
  orig --> mp4[output.mp4]
  thumbs --> jpg[thumb.jpg]
```

### Status and cache during processing

| Step | Mongo | Redis `task:status:{taskId}` |
|------|--------|------------------------------|
| Job start | `processing`, `progress: 0`, `startedAt` | Refreshed |
| FFmpeg progress | `progress` ~every 5% | Refreshed |
| Success | `completed`, `100`, `outputKey`, `thumbnailKey`, `completedAt` | Refreshed |
| Failure | `failed`, `failureReason` | Refreshed |

Poll `GET /api/videos/tasks/:taskId/progress` while processing; fetch `GET .../thumbnail` after `completed`.

**Note:** Jobs delayed by the old M3 stub may still sit in BullMQ delayed until the delay expires; flush the Redis BullMQ keys or wait before retesting locally.

---

## Module changelog

### M4 — FFmpeg worker

- Worker runs FFmpeg: download original → MP4 + JPEG thumbnail → S3
- Progress updates (~5%) on Mongo + status cache; `GET .../thumbnail`
- Single `VideoProcessingService`; global concurrency still 1

### M3 — Queue & status

- BullMQ enqueue after upload (`jobId = taskId`); Redis `task:status:*` cache
- `GET /api/videos/tasks`, `GET /api/videos/tasks/:taskId`, `GET .../progress`
- Compose **`worker`** + `start:worker` / `start:worker:dev`; global concurrency **1**

### M2 — Upload & AWS S3

- `POST /api/videos/upload` (JWT, multipart `file`, 500MB, format allowlist)
- FFprobe duration → ETA; S3 `PutObject`; minimal `video_tasks` in MongoDB
- API Docker image installs `ffmpeg` (FFprobe); README architecture / S3 / CDN notes

### M1 — Auth & security

- Cloud MongoDB via `MONGODB_URI`; Compose **`redis`** + **`api`**
- `POST /api/auth/register|login|change-password|logout`
- JWT access tokens (5h) with JWT ID + token version claims
- Redis denylist on logout; token version bump on password change
- Redis-backed rate limits (IP / user)
- Security section diagrams in this README

### M0 — Scaffold

- NestJS + ConfigModule, `GET /health`, Dockerfile, Compose api, living README, Node/npm pins

## Project layout

```text
videoProcessAssignment/
├── src/
│   ├── main.ts
│   ├── worker.main.ts          # worker process entry
│   ├── app.module.ts
│   ├── health/
│   ├── redis/
│   ├── queue/                  # shared BullMQ connection + job types
│   ├── worker/                 # consumer + VideoProcessingService (FFmpeg)
│   │   └── processing/
│   ├── users/
│   ├── auth/
│   ├── s3/                     # AWS S3 client
│   └── videos/                 # upload, status APIs, enqueue, cache, ffprobe
│       └── queue/              # VideoQueueService (producer)
├── Dockerfile                  # includes ffmpeg/ffprobe
├── docker-compose.yml          # api + redis + worker
├── .env.example
├── package.json
└── README.md
```
