# Repolio — Complete Project & Business Analysis

_Last compiled: 2026-07-07 · Source: full codebase read (Next.js 16 app, Prisma schema, cron jobs, Zernio integration, AI engine, dashboard UI)._

---

## 1. Executive Summary

**Repolio is a B2B SaaS product that automates AI-written advertising performance reports for marketing agencies.**

The core promise: an agency connects a client's ad accounts once, and Repolio then automatically pulls the ad data every day, and on a recurring cadence (default monthly) generates a polished, AI-authored performance report — executive summary, trend analysis, a 0–100 performance score, and prioritized recommendations — and delivers it to the client by email and in an in-app dashboard. No analyst has to assemble the report by hand.

**The problem it solves:** Marketing agencies spend hours every reporting cycle exporting numbers from Meta/Google/etc., interpreting them, and writing up a narrative for each client. Repolio turns that recurring manual labor into an automated pipeline.

**Who uses it (two audiences):**
| Audience | Role | What they do |
|----------|------|--------------|
| **Agency admin** (Repolio operator) | Internal staff | Enrolls new clients, protected by a TOTP code |
| **Client** (the end user) | The agency's advertising client | Logs in, connects ad accounts, reads reports, sets report cadence |

**Current maturity:** Version `0.1.0`, private/pre-release. Only the **Meta** ad platform is wired end-to-end today; Google, TikTok, LinkedIn, Pinterest, and X are declared in the data model and UI but not yet connected.

---

## 2. Business Model & Value Proposition

- **Value delivered:** Recurring, automated, per-ad-account performance reports with genuine narrative analysis (not just a metrics dump), written by Claude and grounded in real trend data across prior reporting periods.
- **Automation is the moat:** Once set up, the entire cycle — data pull → AI analysis → email + notification — runs unattended on a daily cron. Human effort per report trends toward zero.
- **Positioning:** "AI reporting tools for marketing agencies" (per the README). The agency is the customer/operator; each of the agency's advertising clients is a "Client" user in the system.
- **Differentiation vs. raw platform dashboards:** Repolio adds (a) a normalized cross-platform data layer, (b) an opinionated 0–100 performance score, (c) an AI narrative that compares the current period against up to 3 prior reports, and (d) actionable, categorized recommendations.

---

## 3. Technology Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router, React 19, React Compiler) |
| **Language** | TypeScript |
| **Database** | PostgreSQL via Prisma 7 (`@prisma/adapter-pg`) |
| **Auth & DB host** | Supabase (Auth + Postgres + RPC functions) |
| **AI** | Anthropic Claude (`claude-sonnet-4-6`) via `@anthropic-ai/sdk`, structured JSON output |
| **Ad data source** | **Zernio** — third-party OAuth + ads-data aggregation API |
| **Email** | Resend (transactional email) |
| **UI** | Tailwind CSS 4, shadcn/ui, Base UI, lucide/react-icons, next-themes (dark mode), SWR (live data) |
| **Hosting** | Vercel (with Vercel Cron for scheduled jobs) |
| **Forms/validation** | react-hook-form + zod |

---

## 4. Data Model (Prisma Schema)

The whole system revolves around this chain:

```
Client ──< PlatformConnection ──< AdAccount ──< Snapshot >── Report
   │                                                            (AI narrative)
   ├──< Notification
   └──1 Recurrence
```

**Core entities:**

- **`Client`** — an advertising client of the agency. `account_id` links 1:1 to a Supabase auth user. Owns connections, notifications, a recurrence setting, and (lazily) a `zernio_profile_id`.
- **`PlatformConnection`** — one OAuth connection per `(client, platform)`. Holds *references* to Zernio account IDs (`zernio_account_id` = ads grant, `zernio_posting_account_id` = parent posting grant) and a `CONNECTED`/`DISCONNECTED` status. **Repolio never stores the actual OAuth tokens** — Zernio holds them.
- **`AdAccount`** — a specific ad account under a connection (e.g. a Meta `act_<id>`). One connection can expose many. Stores `external_id`, `currency`, `timezone`, `name`, `active`.
- **`Snapshot`** — **one row per ad account per calendar day**, storing that day's raw Zernio metrics as JSON (`spend`, `impressions`, `clicks`, `conversions`, `purchaseValue`, `reach`, `roas`, etc.) plus a stamped `currency`. Uniqueness enforced on `(start_date, ad_account_id)`. Indexed on `(ad_account_id, start_date)` for the hot dashboard/report query path.
- **`Report`** — an AI-generated write-up covering a set of snapshots. **Stores only the AI text**: `executive_summary`, `recommendations` (JSON), `trend_explanation`, plus snapshotted user inputs (`target_cpa`, `target_roas`, `context_comment`). **KPIs and scores are NOT stored** — they are recomputed live from the linked snapshots every time.
- **`Recurrence`** — per-client report cadence (`ndays`, default 30).
- **`Notification`** — in-app notifications: `REPORT_READY`, `CONNECTION_EXPIRING`, `CONNECTION_EXPIRED`.

**Enums:** `Platform` (META, GOOGLE, TIKTOK, LINKEDIN, PINTEREST, X), `ConnectionStatus`, `ScoreLabel` (STRONG / MODERATE / NEEDS_IMPROVEMENT), `NotificationType`.

**Key architectural decision — "compute live, store raw":** The only things persisted are (1) raw daily snapshots and (2) the AI narrative. Every derived metric (ROAS, CPA, CTR, performance score) is recomputed on demand from snapshots. This means there is no aggregation lag or stale-KPI problem, and users can re-window a report to any date range and see fresh numbers.

---

## 5. Key Subsystems

### 5.1 Authentication & Onboarding

**Two separate auth systems:**

1. **Client auth — Supabase.** Email/password sessions via `@supabase/ssr` (HTTP-only cookies). Clients don't self-register; they're invited.
2. **Admin auth — TOTP.** The agency operator authenticates at `/admin/*` with a 6-digit TOTP code (`@otp-lib/authenticator`, secret in `TOTP_SECRET`). On success, an HMAC-signed `admin_session` cookie (8-hour TTL, signed with `SESSION_SECRET`) is set. No Supabase user for the admin.

**Enrollment flow:**
1. Admin authenticates via TOTP → `/admin/enrollment`.
2. Admin submits name + email + company (`enrollClient`).
3. Server calls Supabase `auth.admin.inviteUserByEmail()` with the metadata, using the service-role key.
4. Supabase sends an invite email → client clicks → `/auth/confirm` verifies the OTP → `/auth/set-password`.
5. A **Supabase database trigger on `auth.users`** creates the `Client` row (with `account_id` = Supabase user id and the invite metadata) and keeps it in sync (e.g. name changes propagate via the trigger — confirmed by the comment in `actions/account/update-name.ts`). This trigger lives in Supabase, not in the Prisma migrations.
6. On each request, `authorize()` maps the Supabase session's `user.id` → `Client` via `account_id`; the dashboard layout redirects unauthenticated users to `/auth/login`.

### 5.2 Zernio Integration (the ad-data gateway)

**Zernio is a third-party service (`https://zernio.com/api`) that abstracts away per-platform OAuth and ads reporting.** Repolio talks only to Zernio (Bearer `ZERNIO_API_KEY`); Zernio holds all the real platform tokens.

**Object hierarchy:**
```
Client → Zernio Profile (one per client, lazily created)
           → Social Account [ads]     (zernio_account_id — the ads API grant)
              → Ad Account act_123, act_456 ...
           → Social Account [posting]  (zernio_posting_account_id — for same-token platforms)
```

**Connection flow:**
1. Client clicks "Connect Meta" → `GET /api/connect/meta`.
2. Server ensures a Zernio **Profile** exists for the client (idempotent, race-safe), then requests an OAuth `authUrl` from Zernio and redirects the user.
3. User authorizes with Meta *on Zernio's side*; Zernio stores the token and redirects back to `/api/connect/callback?connected=metaads&profileId=…&accountId=…`.
4. Callback resolves ownership by `profileId` (not the session cookie, which is unreliable after an external redirect), lists the visible ad accounts via `/v1/ads/accounts`, and upserts the `PlatformConnection` + `AdAccount` rows.

**Data fetch:** `GET /v1/ads/timeline` returns daily rows (spend, impressions, clicks, conversions, ctr, cpc, cpm, roas, purchaseValue, reach…). These become `Snapshot` rows.

**Two connection models** are supported in code: **standalone** (Meta today — the `/ads` OAuth is independent) and **same-token** (a posting grant whose token is copied into an ads grant — built but currently unused). Adding a platform is roughly one config entry in `ZERNIO_PLATFORMS` plus two reverse-map entries.

### 5.3 The AI Report Engine (core value prop)

**Model:** `claude-sonnet-4-6`, `max_tokens: 8192`, adaptive extended thinking, **server-enforced JSON schema output**, and **ephemeral prompt caching** on the system prompt (so a batch of reports in one poll run reuses the cached prompt for cost/latency).

**Generation pipeline (`generateReportContent`):**
1. Load the report + its snapshots (reports are one-per-ad-account).
2. Fetch up to **3 prior reports** for the same account (`HISTORY_DEPTH = 3`) for trend context.
3. `computeMetrics()` aggregates the current window and each historical window.
4. Build a prompt: current KPIs + optional target CPA/ROAS + optional account-manager context note + the historical reports (their metrics, summaries, and prior recommendations).
5. Claude returns validated JSON: `executive_summary` (2–4 paragraphs), `trend_explanation` (1–2 paragraphs), and 2–5 `recommendations` each tagged with a **priority** (`IMMEDIATE` / `THIS_WEEK` / `MONITOR`) and **category** (`BUDGET` / `CREATIVE` / `TARGETING` / `BIDDING`).
6. Persist only the text to the `Report` row.

**Prompt discipline:** The system prompt casts Claude as a senior performance-marketing analyst, forbids inventing metrics, tells it to judge against targets, handles the first-report case explicitly, and demands specificity over platitudes.

**Metrics & scoring (`lib/metrics/compute.ts`):**
- Raw daily values are summed; rates are derived from the sums: `CTR = clicks/impressions`, `CPM = spend/impressions·1000`, `CPA = spend/conversions`, `CPC = spend/clicks`, `ROAS = revenue/spend`.
- **Performance score (0–100):** for conversion/revenue accounts, driven by ROAS (`roas/5 × 100`, i.e. 5× ROAS = 100), plus a +10 boost for CTR ≥ 1.5%, minus a 15-point penalty for frequency > 3.5 (ad fatigue), clamped 0–100. Non-conversion accounts get a neutral 50.
- **Label:** STRONG ≥ 70, MODERATE 40–69, NEEDS_IMPROVEMENT < 40.
- **Known limitation:** period reach is summed over daily reach (over-counts unique users) — an accepted tradeoff of the daily-snapshot model.

### 5.4 Automation Engine (Vercel Cron)

Two daily cron jobs, authenticated with a timing-safe Bearer `CRON_SECRET` check (skipped in dev):

| Job | Schedule (UTC) | Purpose |
|-----|----------------|---------|
| `/api/cron/snapshots` | `0 0 * * *` (midnight) | Pull yesterday's ad data for every active client |
| `/api/cron/poll` | `0 2 * * *` (2 AM) | Generate reports for clients that are "due" |

**Snapshots job:** for each active client (max 10 concurrent), syncs connection health from Zernio (flips `DISCONNECTED` and fires a rate-limited — once per 7 days — connection-expired email + notification), then pulls the Zernio timeline for each healthy ad account and **upserts one snapshot per day**. First-ever pull backfills up to 730 days of history; later pulls only re-fetch a trailing 7-day window (to absorb Meta's late attribution corrections).

**Poll job:** calls the Postgres RPC **`due_clients()`** — a client is due when *calendar days* since its most recent report ≥ its `Recurrence.ndays` (default 30), falling back to the client's creation date if no report exists yet. For each due client it: self-heals missing snapshots, groups snapshots since the last report by ad account, creates one empty `Report` per account, runs `generateReportContent()` to fill the AI text, then sends a `REPORT_READY` in-app notification **and** a rendered HTML email via Resend. Every side-effect is best-effort — a failed AI call or email never aborts the run (the report still exists and renders live KPIs).

### 5.5 Email & Notifications

- **Resend** for transactional email; sender defaults to `Repolio <team@gj-automate.com>`.
- **Report email** — React component rendered to static HTML, includes live KPIs for the report period + prior period, the AI summary, and recommendations, with a deep link to the report page.
- **Connection-expired email** — inline-styled HTML (email clients don't load external CSS) prompting the client to reconnect; rate-limited to once per 7 days.
- **In-app notifications** — a bell in the header with unread count; a notifications page listing the latest 50, auto-marked read on view.

### 5.6 Dashboard UI/UX (what the client sees)

- **Home (`/dashboard`)** — a grid of ad-account cards, each showing platform badge, live 30-day spend/ROAS/conversions, a big performance score, and the last report time. Empty state prompts "Connect Meta."
- **Sidebar** — accounts grouped by platform, an "add connection" affordance, and a user menu (Account, Notifications, Logout).
- **Reports (`/dashboard/reports?account=…`)** — resolver that redirects to the latest report; the canonical view is a single report.
- **Single report (`/dashboard/reports/[id]`)** — the flagship screen:
  - **Overview:** large 0–100 score + label, a gradient rating scale, and the AI trend explanation.
  - **6 live KPI cards** (spend, ROAS, CPA, conversions, CTR, reach) with period-over-period delta indicators colored by whether "up" is good for that metric.
  - **AI Insights:** executive summary + a grid of prioritized, color-coded recommendation cards.
  - **Controls:** a **date-range picker** that re-windows the metrics live (SWR against `/api/metrics`), a report switcher (paginated history), a context editor, and a print-to-PDF button.
- **Account (`/dashboard/account`)** — profile (name/avatar), lifetime stats, **report cadence** picker (Weekly / Bi-weekly / Monthly / Quarterly), and per-platform connection management (status, reconnect, delete, list of ad accounts).

---

## 6. End-to-End Lifecycle

```
1. Agency admin (TOTP) enrolls a client  →  Supabase invite email
2. Client sets password, logs in
3. Client connects Meta  →  Zernio OAuth  →  ad accounts imported
4. Daily 00:00 UTC: snapshots cron pulls each ad account's timeline → Snapshot rows
5. Every ndays (default 30), 02:00 UTC: poll cron finds the client "due"
        → creates a Report per ad account
        → Claude writes summary / trends / recommendations
        → REPORT_READY notification + Resend email
6. Client opens the report: live KPIs + AI narrative, re-windowable, printable
7. If a connection breaks: health sync flips it DISCONNECTED + reconnect email (≤1/week)
```

---

## 7. Security & Trust Posture

- **No platform tokens on Repolio's servers** — Zernio is the token custodian; Repolio holds only opaque Zernio account references + one `ZERNIO_API_KEY`.
- **Ownership checks** — report/metrics access is authorized against the signed-in client; the OAuth callback resolves ownership by non-guessable `profileId` rather than a post-redirect session cookie.
- **Admin surface** is TOTP-gated with a short-lived, HMAC-signed session and timing-safe comparisons; cron endpoints require a secret Bearer token compared in constant time.
- **Legal** — privacy policy, terms of service, and a data-deletion page are present, describing Supabase-managed credentials and OAuth-based ad-account access.

---

## 8. Current State, Gaps & Risks

**Wired today:** Meta only. Full pipeline (connect → snapshot → report → notify) works for Meta.

**Declared but not implemented:** Google, TikTok, LinkedIn, Pinterest, X (UI badges + enum exist; no Zernio wiring). The same-token OAuth flow is built but unused.

**Notable dependencies / risks:**
- **Single point of failure on Zernio** — all ad data and OAuth flow through one third party; its plan limits (402/403 on profile creation) and auth errors are handled but constrain scale.
- **`CONNECTION_EXPIRING` notification type** exists in the enum but only `EXPIRED`/`READY` appear to be emitted — an early-warning path may be unbuilt.
- **Reach over-counting** in multi-day windows is a known, accepted metric imprecision.
- **Report-per-ad-account granularity** means a client with many ad accounts receives many reports/emails per cycle — worth watching for notification fatigue.
- **AI cost/latency** scales with client count on each poll run; mitigated by prompt caching and concurrency limits.

---

## 9. File Map (where to look)

| Area | Key paths |
|------|-----------|
| Data model | `prisma/schema.prisma`, `prisma/migrations/**` |
| AI engine | `lib/ai/generate-report.ts`, `lib/ai/anthropic.ts` |
| Metrics/scoring | `lib/metrics/compute.ts`, `lib/metrics/window.ts` |
| Zernio | `lib/zernio/**`, `app/api/connect/**` |
| Cron/automation | `app/api/cron/poll/route.ts`, `app/api/cron/snapshots/route.ts`, `actions/snapshot/**`, `vercel.json` |
| `due_clients()` | `prisma/migrations/20260602120000_due_clients_calendar_days/migration.sql` |
| Auth/admin | `actions/admin/**`, `actions/auth/**`, `lib/admin/auth.ts`, `lib/supabase/**` |
| Email | `lib/email/**`, `lib/resend.ts`, `components/email/report-email.tsx` |
| Dashboard UI | `app/dashboard/**`, `components/report/**`, `components/sidebar/**`, `components/account/**` |
| Legal | `app/(legal)/**`, `app/data-deletion/page.tsx` |
