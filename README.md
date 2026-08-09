# AI Outbound Calling & Client Sales Management System

A production-ready SaaS application for digital marketing / web-development agencies to run **AI-powered outbound sales calls** using [Retell AI](https://www.retellai.com/). Upload clients, launch calling campaigns, and let an AI agent qualify leads — then review full transcripts, recordings, AI summaries, lead scores, and follow-ups from a modern dashboard.

Built with **Next.js 15 (App Router) · TypeScript · Prisma · PostgreSQL · Tailwind CSS** and designed to deploy to **Vercel**.

---

## ✨ Features

- **Client management** — CRUD, search, filter, sort, pagination, bulk actions
- **CSV / XLSX import** — column mapping, preview, validation, dedupe
- **Calling campaigns** — start / pause / stop, concurrency, retries, calling hours
- **Backend job queue** — DB-backed queue driven by Vercel Cron (runs even when the browser is closed)
- **Retell AI integration** — outbound calls, signed webhooks, transcripts, recordings
- **Live call status** — auto-refreshing Active Calls page
- **AI analysis** — automatic summary, lead score (0–100), interest level, outcome classification
- **Call reports** — chat-style transcript, recording player, services discussed, next action
- **Follow-ups** — auto-created after qualifying calls, optional automated callbacks
- **Do Not Call list** — mandatory suppression, honored everywhere
- **Dashboard analytics** — KPI cards + activity charts with date filters
- **AI Agent config** — edit the agent's knowledge and copy a ready-to-use Retell prompt
- **Security** — JWT auth (httpOnly cookies), webhook signature verification, audit log, input validation
- **Fully responsive** — desktop → mobile, collapsible sidebar, horizontally-scrolling tables

---

## 🏗️ Architecture

```
Browser (Next.js UI)
   → Backend API (Next.js Route Handlers)   ← auth, validation, business logic
      → Retell AI REST API                  ← RETELL_API_KEY stays server-side only
      → PostgreSQL (Prisma)

Retell AI webhook
   → /api/webhooks/retell (signature verified)
      → finalize call → transcript + recording + AI analysis
      → update Client / Campaign / Follow-up / Do-Not-Call

Vercel Cron (every minute)
   → /api/cron/process-queue → dequeue eligible clients → place calls
Vercel Cron (every 5 min)
   → /api/cron/process-followups → place due auto-call follow-ups
```

> **Why a DB-backed queue instead of BullMQ/Redis?** Vercel's serverless runtime can't host a long-lived worker process. The queue state lives in Postgres and is advanced by a cron ping — the production-correct pattern for Vercel. Concurrency, retries, calling-hours and per-client limits are all enforced in `src/lib/queue.ts`.

> **Free plan note:** Vercel's **Hobby (free)** plan runs cron jobs only **once per day**, which is too slow for the queue. A free **GitHub Actions** workflow ([`.github/workflows/cron.yml`](./.github/workflows/cron.yml)) pings the queue every 5 minutes instead. Add two repo secrets — `APP_URL` and `CRON_SECRET` (Settings → Secrets and variables → Actions) — and it just works. On Vercel **Pro**, raise the `vercel.json` cron schedules back to `* * * * *` and you can drop the workflow.

### MOCK mode
If `RETELL_API_KEY` is **not** set, the system runs in **MOCK mode**: calls are simulated with generated transcripts so you can exercise the entire flow (campaign → call → transcript → analysis → report) without placing real calls. Set the key to switch to **LIVE** calls.

---

## 🚀 Deploy to Vercel

### 1. Create a Postgres database
Use **Vercel Postgres**, **Neon**, or **Supabase**. Grab the connection string(s).

### 2. Push this repo to GitHub and import it into Vercel
Framework preset: **Next.js** (auto-detected). Build command is already set in `vercel.json`.

### 3. Set Environment Variables (Vercel → Project → Settings → Environment Variables)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Pooled Postgres URL |
| `DIRECT_URL` | ✅ | Direct Postgres URL (for migrations) |
| `AUTH_SECRET` | ✅ | `openssl rand -base64 48` |
| `APP_URL` | ✅ | e.g. `https://your-app.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | ✅ | same as `APP_URL` |
| `CRON_SECRET` | ✅ | `openssl rand -base64 48` — protects cron endpoints |
| `RETELL_API_KEY` |  | Leave empty for MOCK mode; set for LIVE calls |
| `RETELL_AGENT_ID` |  | Your Retell agent id |
| `RETELL_PHONE_NUMBER` |  | Your Retell number (E.164) |
| `RETELL_FROM_NUMBER` |  | Caller ID / from number |
| `RETELL_WEBHOOK_SECRET` |  | Retell webhook signing secret |

See [`.env.example`](./.env.example) for the full list.

### 4. Run the database migration
After the first deploy (or locally with production env), create the schema:

```bash
npx prisma db push        # or: npx prisma migrate deploy
npm run db:seed           # optional: seeds services + demo clients
```

### 5. Configure the Retell webhook
In the Retell dashboard, set your agent/webhook URL to:

```
https://your-app.vercel.app/api/webhooks/retell
```

Copy the signing secret into `RETELL_WEBHOOK_SECRET`.

### 6. Configure your Retell agent prompt
Open **AI Agent** in the app, edit the agency knowledge, and **Copy** the generated prompt into your Retell agent's system prompt. It uses `{{dynamic_variable}}` placeholders that the backend fills per client on every call.

### 7. First run
Visit the app — the first visit shows a **setup screen** to create your admin account. Vercel Cron (defined in `vercel.json`) starts advancing the queue automatically.

---

## 💻 Local development

```bash
cp .env.example .env          # fill in DATABASE_URL, DIRECT_URL, AUTH_SECRET
npm install
npx prisma db push
npm run db:seed               # optional
npm run dev                   # http://localhost:3000
```

Leave `RETELL_API_KEY` empty locally to use MOCK mode. To advance the queue locally, hit
`GET /api/cron/process-queue` (an authenticated admin session is accepted in place of `CRON_SECRET`), or just use **Call now** / **Start Calling**, which kick the queue immediately.

---

## 🔐 Security notes

- `RETELL_API_KEY` is only ever read on the server (`src/lib/retell.ts`); it is never sent to the browser or prefixed with `NEXT_PUBLIC_`.
- Sessions are signed JWTs stored in `httpOnly`, `secure`, `sameSite=lax` cookies.
- All API routes require an authenticated session (enforced in `middleware.ts` + per-route guards).
- Webhooks are signature-verified; duplicate events are deduped for idempotency.
- Cron endpoints require the `CRON_SECRET` bearer token in production.
- All admin actions are recorded in the audit log.

> ⚠️ **Compliance:** Configure calling hours, recording/transcription disclosure, and the Do-Not-Call list to comply with the telemarketing, privacy, and consent laws of the jurisdictions you call. This software must not be used to bypass those requirements.

> **Note:** `xlsx` (SheetJS) on npm has known advisories with no npm-registry fix. It is used only for client-side parsing of admin-uploaded files. Review before processing untrusted files.

---

## 📁 Project structure

```
prisma/schema.prisma      # DB models (users, clients, calls, campaigns, follow-ups, DNC, audit…)
src/lib/                  # prisma, auth, retell, queue, analysis, settings, callProcessing
src/middleware.ts         # auth gate (edge-safe)
src/app/api/              # REST API route handlers
src/app/(dashboard)/      # dashboard pages (clients, campaigns, reports, settings…)
src/components/           # UI primitives, AppShell, ClientForm, TranscriptView
vercel.json               # cron schedules + build command
```

## 🔌 Key API endpoints

`/api/clients` · `/api/clients/import` · `/api/clients/:id/report` · `/api/campaigns` ·
`/api/campaigns/:id/{start,pause,stop}` · `/api/calls` · `/api/calls/start` · `/api/followups` ·
`/api/do-not-call` · `/api/settings` · `/api/dashboard/stats` · `/api/webhooks/retell` ·
`/api/cron/process-queue`
