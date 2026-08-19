# Repolio — AI reporting tools for marketing agencies

Repolio turns recurring ad-reporting labour into an automated pipeline. An agency connects a client's ad
accounts once; Repolio then pulls the ad data every day and, on a recurring cadence, generates a polished
performance report — executive summary, trend analysis, a 0–100 performance score and prioritised
recommendations — written by Claude and grounded in real trend data. Nothing reaches the client until an
agency admin validates the batch, at which point the client gets one email covering all of their ad
accounts, each report attached as a PDF.

**Status:** `0.1.1`, private / pre-release. The full pipeline works end-to-end for **Meta**; the other
platforms exist in the data model and UI but are not yet wired.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, React 19, React Compiler) |
| Database | PostgreSQL via Prisma 7, hosted on Supabase |
| Auth | Supabase Auth (clients) + a shared-password admin surface |
| AI | Anthropic Claude, via the Batches API |
| Ad data | [Zernio](https://zernio.com) — third-party OAuth + ads aggregation |
| Email | Resend, with server-rendered PDFs (`@react-pdf/renderer`) |
| UI | Tailwind CSS 4, shadcn/ui, Base UI, next-intl (de/en/it), SWR |
| Hosting | Vercel, with Vercel Cron |

## Getting started

Requires Node 22 and pnpm 11.

```bash
pnpm install
cp .env.example .env.local     # then fill it in
pnpm db:generate               # generated/prisma is gitignored
pnpm dev
```

`.env.example` documents every variable, what it is for, and whether it is required. The app **validates
its environment at boot** (`instrumentation.ts`), so a missing variable stops the server with a list of
everything that is wrong rather than failing later on whichever code path needed it.

> [!WARNING]
> There is no separate development database — `.env.local` points at **production** Supabase. Do not run
> `prisma migrate dev`, `migrate deploy`, or `db push` locally. Write migration SQL under
> `prisma/migrations/` and apply it deliberately.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` | `prisma generate && next build` |
| `pnpm start` | Production server |
| `pnpm typecheck` | `next typegen && tsc --noEmit` (Next's route types are gitignored) |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest (all tests) |
| `pnpm db:generate` | Regenerate the Prisma client |
| `pnpm db:migrate` | `prisma migrate dev` — see the warning above |

Tests live under `lib/` only (`vitest.config.ts` includes `lib/**/*.test.ts`). Run one file or one case:

```bash
pnpm vitest run lib/metrics/score.test.ts
pnpm vitest run -t "rejects an inverted range"
```

CI (`.github/workflows/ci.yml`) runs schema validation, codegen, typecheck, lint and the test suite on
every push to `main` and every pull request. It holds no database credentials.

## Deployment notes

- **Cron.** `vercel.json` schedules two jobs, the maximum on Vercel Hobby: `/api/cron/daily` (snapshots
  then report generation) and `/api/cron/collect` (retrieve finished AI batches). `/api/cron/snapshots`
  and `/api/cron/poll` remain live for manual triggering, and the daily route documents how to split back
  into three jobs on Vercel Pro.
- **Cron work is bounded by wall clock**, not by the function timeout: Vercel kills a function at
  `maxDuration` without unwinding, so a run stops starting new work before that and records what it
  deferred. `CronRun` rows with `finished_at IS NULL` are killed runs; `skipped > 0` means a run ran out of
  time and deferred its tail to the next one.
- **Rate limiting is required in production.** `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` must
  be set, or the app refuses to boot. Outside production their absence just disables rate limiting so
  local dev and previews keep working.
- **Migrations are applied by hand** — see the warning above. `prisma migrate status` will show anything
  pending.

## Further reading

- **[PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)** — the deep reference: data model, every subsystem, the
  end-to-end lifecycle, and a file map of where things live.
- **[CLAUDE.md](CLAUDE.md)** — architecture summary and the invariants worth knowing before changing code.
- `TODO.md` is **stale** (pre-Zernio architecture) and kept only for history.
