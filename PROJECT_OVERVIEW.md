# Repolio — Complete Project & Business Analysis

_Last compiled: 2026-07-07 · Source: full codebase read (Next.js 16 app, Prisma schema, cron jobs, Zernio integration, AI engine, dashboard UI)._

---

## 1. Executive Summary

**Repolio is a B2B SaaS product that automates AI-written advertising performance reports for marketing agencies.**

The core promise: an agency connects a client's ad accounts once, and Repolio then automatically pulls the ad data every day, and on a recurring cadence (default monthly) generates a polished, AI-authored performance report — executive summary, trend analysis, a 0–100 performance score, and prioritized recommendations — and holds it for an agency admin to validate. Once validated, the client receives **one email** covering all of their ad accounts, each report attached as a PDF, and the reports appear in their in-app dashboard. No analyst has to assemble the report by hand.

**The problem it solves:** Marketing agencies spend hours every reporting cycle exporting numbers from Meta/Google/etc., interpreting them, and writing up a narrative for each client. Repolio turns that recurring manual labor into an automated pipeline.

**Who uses it (two audiences):**
| Audience | Role | What they do |
|----------|------|--------------|
| **Agency admin** (Repolio operator) | Internal staff | Enrolls new clients, sets each client's report schedule, and validates generated report batches before they reach the client — all protected by a shared admin password |
| **Client** (the end user) | The agency's advertising client | Logs in, connects ad accounts, reads validated reports, sets report cadence and start date, designs their own report template |

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
   ├──< Notification                                              │
   ├──< ReportBatch ───────────────────────────────────────────< ─┘
   └──1 Recurrence                                (validation + delivery unit)
```

**Core entities:**

- **`Client`** — an advertising client of the agency. `account_id` links 1:1 to a Supabase auth user. Owns connections, notifications, a recurrence setting, and (lazily) a `zernio_profile_id`.
- **`PlatformConnection`** — one OAuth connection per `(client, platform)`. Holds *references* to Zernio account IDs (`zernio_account_id` = ads grant, `zernio_posting_account_id` = parent posting grant) and a `CONNECTED`/`DISCONNECTED` status. **Repolio never stores the actual OAuth tokens** — Zernio holds them.
- **`AdAccount`** — a specific ad account under a connection (e.g. a Meta `act_<id>`). One connection can expose many. Stores `external_id`, `currency`, `timezone`, `name`, `active`, plus `context_note` — standing background fed into the AI prompt for **every** report on this account (business model, what to judge it on, seasonality). Read at prompt-build time, which is what makes it reach the model.
- **`Snapshot`** — **one row per ad account per calendar day**, storing that day's raw Zernio metrics as JSON (`spend`, `impressions`, `clicks`, `reach`, the `actions`/`actionValues` maps, plus Zernio's derived scalars kept as provenance only) and a stamped `currency`. Uniqueness enforced on `(start_date, ad_account_id)`. Indexed on `(ad_account_id, start_date)` for the hot dashboard/report query path. KPI-relevant facts (purchases, leads, revenue, link clicks) are derived from the action maps at compute time — see §5.3.
- **`Report`** — an AI-generated write-up covering a set of snapshots. **Stores only the AI text**: `executive_summary`, `recommendations` (JSON), `trend_explanation`, plus snapshotted user inputs (`target_cpa`, `target_roas`, `context_comment` — a note about that one period; note it is written *after* generation, so it affects the rendered document but not the model) and its delivery state (`report_batch_id`, `approved`, `released_at`). **A report is invisible to its client until `released_at` is stamped by batch validation** — every client-facing query filters on it. **KPIs and scores are NOT stored** — they are recomputed live from the linked snapshots every time.
- **`ReportBatch`** — one client's reports from a single generation run, and the unit of validation and delivery. Reports are generated into an unsent batch; an admin approves or excludes each one, and validating the batch sends the client **one** email and stamps `Report.released_at`. `sent_at` is the state (null = pending validation).
- **`ReportTemplate`** — a client-authored layout for the report *deliverable* (the PDF attachment and the standalone HTML render), as HTML with Supabase-style `{{ .variable }}` placeholders. One row per owner: `client_id` set = the client's default, `ad_account_id` set = an override for one account. Resolution is account override → client default → the built-in preset in `lib/report/template/presets.ts`, so an empty table means every client keeps the layout they already had.
- **Language** — `Client.locale` is always a concrete language (`de`/`en`/`it`) because the report cron has no request to detect from; `Client.locale_auto` marks a client who follows their browser instead of an explicit choice. Detection (`lib/i18n/detect.ts`) reads `Accept-Language` first and the CDN country header second — a stated preference beats an inferred location. It runs in middleware when the locale cookie is absent, and again at login for automatic clients (writing the result back so their reports follow). Switcher lives in the dashboard header and in `/dashboard/account`.
- **`Recurrence`** — per-client report schedule: cadence in days (`ndays`, default 30) plus `start_date`, the anchor day the first report is due. Slots are phase-locked to the anchor (`anchor + k × ndays`), so a client anchored to a Saturday stays on Saturdays. Null anchor falls back to the client's `created_at`.
- **`Notification`** — in-app notifications: `REPORT_READY`, `CONNECTION_EXPIRING`, `CONNECTION_EXPIRED`.

**Enums:** `Platform` (META, GOOGLE, TIKTOK, LINKEDIN, PINTEREST, X), `ConnectionStatus`, `ScoreLabel` (STRONG / MODERATE / NEEDS_IMPROVEMENT), `NotificationType`.

**Key architectural decision — "compute live, store raw":** The only things persisted are (1) raw daily snapshots and (2) the AI narrative. Every derived metric (ROAS, CPA, CTR, performance score) is recomputed on demand from snapshots. This means there is no aggregation lag or stale-KPI problem, and users can re-window a report to any date range and see fresh numbers.

---

## 5. Key Subsystems

### 5.1 Authentication & Onboarding

**Two separate auth systems:**

1. **Client auth — Supabase.** Email/password sessions via `@supabase/ssr` (HTTP-only cookies). Clients don't self-register; they're invited.
2. **Admin auth — shared password.** The agency operator authenticates at `/admin/*` with the password in `ADMIN_PASSWORD`, compared as SHA-256 digests via `timingSafeEqual` (uniform length, so a wrong-length guess neither crashes nor leaks the real length). On success, an HMAC-signed `admin_session` cookie (8-hour TTL, signed with `SESSION_SECRET`) is set. No Supabase user for the admin. A password shorter than 16 characters is refused outright, and login is rate-limited per IP *and* globally — a static secret stays guessable until rotated, unlike the rotating TOTP code this replaced.

**Enrollment flow:**
1. Admin authenticates with the shared password → `/admin/enrollment`.
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

**Metrics & scoring (`lib/metrics/compute.ts` + `lib/metrics/extract.ts`):**
- **Conversion facts come from the raw Meta action maps** (`actions` / `actionValues` stored in each snapshot), never from Zernio's derived scalars: `conversions`/`costPerConversion` mirror Meta's pixel-config-dependent rollup and `purchaseValue`/`roas` mix non-purchase values into "revenue" (lead values once produced a fake 74.5× ROAS). `lib/metrics/extract.ts` filters by explicit action types with roll-up-aware dedup: **purchases** (`omni_purchase`/`purchase`, else per-channel pixel/app/Shops/offline keys), **leads** (`lead`, else pixel/instant-forms/offline keys), **link clicks** (`link_click`).
- **Conversions = purchases + leads** (breakdown reported alongside); **revenue is purchase-attributed only**; **CPL = spend/leads**.
- Raw daily values are summed; rates are derived from the sums: `CTR = link clicks/impressions` and `CPC = spend/link clicks` (falls back to all clicks for windows without a `link_click` breakdown — matches Ads Manager's CTR (link)), `CPM = spend/impressions·1000`, `CPA = spend/conversions`, `ROAS = revenue/spend`.
- **Null policy:** unmeasured metrics are `null` (rendered "—" / "n/a"), never 0 — a 0 CPA/ROAS would imply "free" and pollute averages. Counts are 0 when measured-zero.
- **Performance score (0–100):** e-commerce accounts (measured purchase revenue) are driven by ROAS (`roas/5 × 100`, i.e. 5× ROAS = 100), plus a +10 boost for CTR ≥ 1.5%, minus a 15-point penalty for frequency > 3.5 (ad fatigue), clamped 0–100. Lead-gen accounts (conversions but no purchase revenue) anchor at 55 and move with the same CTR/frequency signals. Accounts with nothing measurable get a neutral 50.
- **Label:** STRONG ≥ 70, MODERATE 40–69, NEEDS_IMPROVEMENT < 40.
- **KPI card sets are focus-aware** (`lib/metrics/cards.ts`): lead-gen accounts lead with Leads/CPL, e-commerce with ROAS/CPA — shared by the report page, the email and the dashboard.
- **Known limitation:** period reach is summed over daily reach (over-counts unique users) — an accepted tradeoff of the daily-snapshot model; frequency derives from it.

### 5.4 Automation Engine (Vercel Cron)

Two daily cron jobs, authenticated with a timing-safe Bearer `CRON_SECRET` check (skipped in dev):

| Job | Schedule (UTC) | Purpose |
|-----|----------------|---------|
| `/api/cron/daily` | `0 0 * * *` (midnight) | Snapshot pull for every active client, then report submission for "due" clients |
| `/api/cron/collect` | `0 5 * * *` (5 AM) | Retrieve finished Anthropic batch results and write AI sections back (delivers nothing — that waits on admin validation) |

(`/api/cron/snapshots` and `/api/cron/poll` remain live, unscheduled, for manual triggering.)

**Snapshots phase:** for each active client (max 10 concurrent), syncs connection health from Zernio (flips `DISCONNECTED` and fires a rate-limited — once per 7 days — connection-expired email + notification), then pulls the Zernio timeline for each healthy ad account (max 6 concurrent per client, with retry/backoff on 429/5xx honoring `Retry-After`) and **upserts one snapshot per day**. First-ever pull backfills up to 730 days of history; every later pull **re-pulls the trailing 3 days** (so partial days and Meta's ~72h attribution restatements are overwritten daily), widening to 7 days on the Monday reconcile. Failures are recorded per account/stage in the internal **`SyncError`** table (30-day retention) and successful accounts get `AdAccount.last_synced_at` stamped — a silent skip is a one-query diagnosis. Reports connect **complete days only** — the just-started UTC day's near-empty row stays out of report KPIs and the AI narrative (the dashboard still shows live today).

**Poll job:** calls the Postgres RPC **`due_clients()`** — a client is due when the *current slot* (the latest `Recurrence.start_date + k × ndays` on or before today, falling back to the client's creation date when no anchor is set) has been reached and no report has been generated for it yet. Comparing against the slot rather than "today minus the cadence" makes the schedule drift-proof: a missed run is still owed the next day, and catching up late does not move the following slot off the anchor's weekday. The rule is mirrored in TypeScript by `lib/recurrence/schedule.ts` (unit-tested) for the UI's schedule previews — change one, change the other.

For each due client it self-heals missing snapshots, groups snapshots since the last report by ad account, creates **one `ReportBatch` per client** and one empty `Report` per account inside it, and submits the AI sections to the Anthropic Batches API (50% cheaper than live calls). Zero-activity accounts (no spend, impressions or conversions) get a report row but skip the AI call entirely. **Nothing is emailed and nothing becomes client-visible here** — the batch waits for an admin at `/admin/validation`. Every side-effect is best-effort: a failed AI call never aborts the run (the report still exists and renders live KPIs).

### 5.5 Email & Notifications

- **Resend** for transactional email; sender defaults to `Repolio <team@gj-automate.com>`.
- **Batched report email** — the single email a client gets when an admin validates their batch: a compact summary row per ad account (score, three headline KPIs, what the AI flagged) plus **one PDF attachment per report** carrying the full write-up. PDFs are generated server-side with `@react-pdf/renderer` (no headless browser). Rendered in the client's language; sent by `lib/report/send-batch.ts`, which only releases the reports once Resend accepts the email. The covering email's own layout is fixed — only the attached report document is templated.
- **Single-report HTML render** — the same per-report layout as an HTML document, still served at `/api/reports/[id]/email` to power the client's in-page "Download PDF" button (printed in the browser).
- **Admin PDF preview** — `/api/admin/reports/[id]/pdf` serves the byte-identical attachment for a not-yet-released report, so validation reviews the real artifact.
- **Connection-expired email** — inline-styled HTML (email clients don't load external CSS) prompting the client to reconnect; rate-limited to once per 7 days.
- **In-app notifications** — a bell in the header with unread count; a notifications page listing the latest 50, auto-marked read on view.

### 5.6 Report templates

The report **deliverable** is rendered from a client-authored template, not a hardcoded layout. A
template is plain text with `{{ .variable }}` placeholders plus a handful of line prefixes (`#`, `##`,
`###`, `>`, `---`), parsed into blocks by `lib/report/template/parse.ts`.

- **It's HTML**, so a report need not look like Repolio at all. The HTML document is rendered directly;
  the PDF maps the same markup onto react-pdf primitives via `react-pdf-html`.
- **Two placeholder kinds** — *scalars* (`{{ .spend }}`, `{{ .roasChange }}`, `{{ .accountName }}`),
  HTML-escaped and substituted anywhere, and *sections* (`{{ .metricsTable }}`, `{{ .recommendations }}`,
  …) which expand to a pre-built markup fragment. Catalogue: `lib/report/template/variables.ts`.
- **Sanitized, and the order is the security property** (`lib/report/template/render.ts`): the client's
  HTML is sanitized FIRST, then placeholders are substituted. Sanitizing afterwards would strip our own
  section fragments; substituting first would let a client smuggle markup in through a value. Scripts,
  event handlers, frames, `javascript:` URLs, remote images and `@import`/remote `url()` in CSS are all
  removed — this markup is served as `text/html` from our own origin, so a script in a template would run
  there, and an admin previewing a client's template would run it against an admin session.
- **Page colours** — a template declares `--rp-page-bg` / `--rp-page-fg` in its CSS to colour the page
  itself. Neither renderer can reach that from inside the template (the PDF page is a react-pdf `Page`
  style, the HTML document is `body`), so dark designs opt in through those two properties.
- **Numbers follow the recipient's locale** — a German report reads "€3.460,45" and "210 Tsd.", not
  "€3,460.45" / "210.2K". `metricFormatters` takes the locale; the web dashboard keeps en-US by default.
- **The PDF honours only a CSS subset** — no grid, floats, positioning or `@media`. Worse, some CSS makes
  react-pdf *throw* rather than degrade (em units on `letter-spacing`), which would drop the report from
  its batch. Two defences: `checkTemplate` warns in the editor about the known offenders, and
  `renderReportPdf` catches a failed render and falls back to the built-in template so delivery still
  happens.
- **Scope** — account override → client default → built-in preset. Presets live in code (no migration to
  add one, always available, and applying one COPIES its body so editing a preset never rewrites what an
  existing client receives).
- **Not the dashboard** — the interactive report view at `/dashboard/reports/[id]` is untouched by
  templates. It stays a live React surface with a re-windowable date range; templating it would mean
  giving that up. The batch covering email is also fixed — only the attached report document is templated.
- **Editing** — clients at `/dashboard/template`, admins for any client at `/admin/templates`. Both use
  the same editor component and the same server-side renderer for the live preview, so the preview is the
  real output. Parse issues (unknown placeholder, section used inline) are advisory: a template still
  saves, and an unknown placeholder renders verbatim rather than vanishing, so a typo is self-diagnosing.

### 5.7 Dashboard UI/UX (what the client sees)

- **Home (`/dashboard`)** — a grid of ad-account cards, each showing platform badge, live 30-day spend/ROAS/conversions, a big performance score, and the last report time. Empty state prompts "Connect Meta."
- **Sidebar** — accounts grouped by platform, an "add connection" affordance, and a user menu (Account, Notifications, Logout).
- **Reports (`/dashboard/reports?account=…`)** — resolver that redirects to the latest report; the canonical view is a single report.
- **Single report (`/dashboard/reports/[id]`)** — the flagship screen:
  - **Overview:** large 0–100 score + label, a gradient rating scale, and the AI trend explanation.
  - **6 live KPI cards** (spend, ROAS, CPA, conversions, CTR, reach) with period-over-period delta indicators colored by whether "up" is good for that metric.
  - **AI Insights:** executive summary + a grid of prioritized, color-coded recommendation cards.
  - **Controls:** a **date-range picker** that re-windows the metrics live (SWR against `/api/metrics`), a report switcher (paginated history), a context editor, and a print-to-PDF button.
- **Report template (`/dashboard/template`)** — the template editor: source on the left, server-rendered live preview on the right, preset library and clickable variable reference underneath. Tabs switch between the client default and a per-ad-account override.
- **Account (`/dashboard/account`)** — profile (name/avatar), lifetime stats, **report schedule** (cadence presets Weekly / Bi-weekly / Monthly / Quarterly, any custom whole-day cadence, and the start date that anchors the cycle, with a preview of the next dates), language, and per-platform connection management (status, reconnect, delete, list of ad accounts).

---

## 6. End-to-End Lifecycle

```
1. Agency admin (password) enrolls a client  →  Supabase invite email
2. Client sets password, logs in
3. Client connects Meta  →  Zernio OAuth  →  ad accounts imported
4. Daily 00:00 UTC: snapshots cron pulls each ad account's timeline → Snapshot rows
5. On each scheduled slot (start_date + k × ndays), 00:00 UTC: poll cron finds the client "due"
        → creates one ReportBatch for the client, one Report per ad account inside it
        → Claude writes summary / trends / recommendations (Batches API, collected at 05:00)
        → nothing is sent; the batch is invisible to the client
6. Agency admin opens /admin/validation, reviews each report (PDF preview), excludes any that
   shouldn't go out, and clicks "Validate & send"
        → ONE email to the client, one PDF attached per approved report
        → approved reports are released and appear in the dashboard
7. Client opens the report: live KPIs + AI narrative, re-windowable, printable
8. If a connection breaks: health sync flips it DISCONNECTED + reconnect email (≤1/week)
```

---

## 7. Security & Trust Posture

- **No platform tokens on Repolio's servers** — Zernio is the token custodian; Repolio holds only opaque Zernio account references + one `ZERNIO_API_KEY`.
- **Ownership checks** — report/metrics access is authorized against the signed-in client; the OAuth callback resolves ownership by non-guessable `profileId` rather than a post-redirect session cookie.
- **Admin surface** is password-gated (`ADMIN_PASSWORD`, min 16 chars) with a short-lived, HMAC-signed session and timing-safe comparisons, rate-limited per IP and globally; cron endpoints require a secret Bearer token compared in constant time. Note this is a single shared, non-rotating secret — weaker than the TOTP it replaced, and worth rotating when anyone with access leaves.
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
| AI engine | `lib/ai/report-prompt.ts` (system prompt, schema, prompt assembly — pure and unit-tested), `lib/ai/generate-report.ts` (orchestration), `lib/ai/anthropic.ts` |
| Account context | `AdAccount.context_note`, `actions/account/update-account-context.ts`, `actions/admin/account-context.ts` |
| Metrics/scoring | `lib/metrics/compute.ts`, `lib/metrics/window.ts` |
| Zernio | `lib/zernio/**`, `app/api/connect/**` |
| Cron/automation | `app/api/cron/poll/route.ts`, `app/api/cron/snapshots/route.ts`, `actions/snapshot/**`, `vercel.json` |
| `due_clients()` | `prisma/migrations/20260730130000_recurrence_start_date/migration.sql` (+ TS twin `lib/recurrence/schedule.ts`) |
| Validation & delivery | `app/admin/validation/`, `actions/admin/validation.ts`, `lib/report/send-batch.ts`, `lib/report/visibility.ts` |
| Scheduling | `app/admin/schedule/`, `actions/admin/schedule.ts`, `actions/account/update-recurrence.ts`, `lib/recurrence/**` |
| Auth/admin | `actions/admin/**`, `actions/auth/**`, `lib/admin/auth.ts`, `lib/supabase/**` |
| Email | `lib/email/**`, `lib/resend.ts`, `components/email/report-email.tsx`, `components/email/batch-email.tsx`, `lib/email/report-pdf.tsx` |
| Report templates | `lib/report/template/**`, `app/dashboard/template/`, `app/admin/templates/`, `components/report/template-editor.tsx` |
| Dashboard UI | `app/dashboard/**`, `components/report/**`, `components/sidebar/**`, `components/account/**` |
| Site metadata & link previews | `lib/site.ts` (the titles and descriptions, plus `metadataBase`), `lib/og/social-card.tsx` (the 1200x630 card), `app/opengraph-image.tsx`, `app/twitter-image.tsx`, `app/layout.tsx` |

**Query shape:** list pages resolve their per-row data in one grouped query, never one query per row — `HomeOverview` (the client's landing page) and `/admin/schedule`'s roster table both use a `$queryRaw` GROUP BY for "newest report per account/client", which Prisma can't express as a max over a relation. Keep that shape when adding columns to either.
| Legal | `app/(legal)/**`, `app/data-deletion/page.tsx` |
