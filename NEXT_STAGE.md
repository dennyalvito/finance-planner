# Coin Next-Stage Handoff

Status: Reliability implemented; authenticated verification execution pending

Baseline date: 2026-08-05

## Purpose

This document preserves the implementation context needed to continue Coin in
a new session. `PRD.md` remains the product source of truth; this file is the
ordered execution handoff.

## Current implementation

- TanStack Start, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Recharts,
  Dexie, Supabase, Vitest, Playwright, and pnpm.
- Real route components exist for `/`, `/transactions`, `/budgets`, and
  `/settings`, mounted under the shared Coin shell.
- Desktop uses a collapsible sidebar. Mobile uses a five-action bottom dock and
  bottom drawers for quick transaction and budget entry.
- The ledger starts at zero and reports net cash flow. Amounts are integer IDR.
  Coin does not model bank balances or separate accounts.
- Mobile overview defaults to Today's net cash flow and shows period-scoped
  income, expenses, category cash flow, and recent activity. Presets support
  today, week, month, year, and custom periods. Custom From and To fields open
  compact shadcn calendar dialogs with direct month and year selectors.
- Desktop overview shows all-time summary cards, a six-month cash-flow chart,
  expense distribution, current-month budget pulse, and recent transactions.
- Transaction entry defaults to expense and the first matching category,
  focuses a visually emphasized amount field, and formats IDR thousands while
  typing. Expense amounts use the semantic negative color in recent lists.
- Transactions can be edited in guest or account mode. The history view shows
  filtered income, expenses, and net movement, groups entries by date, supports
  type and preset/custom date filters, and keeps Edit/Delete in a row menu.
  Compact recent-activity rows on Home expose the same Edit/Delete action menu.
- Period, transaction, and budget drawers use the same overlay treatment.
- Guest mode uses Dexie/IndexedDB. Account mode uses Supabase Postgres. The
  repository boundary keeps finance UI independent of storage.
- A first-time guest starts with an empty ledger. Built-in categories are
  initialized locally, and legacy demo rows are removed without affecting real
  guest transactions.
- Google-only login uses Supabase `signInWithOAuth`. There is no Google iframe,
  Google SDK loader, FedCM integration, direct ID-token exchange, or
  `VITE_GOOGLE_CLIENT_ID`.
- Supabase source includes typed tables, built-in categories, constraints,
  least-privilege grants, and user-owned RLS policies, including owner-scoped
  transaction updates.
- Custom category creation is account-only by current product decision. Guests
  use the built-in category templates.
- Animations are CSS-based. GSAP is not part of the project.

## Verified baseline

TypeScript, ESLint, the production build, 19 unit/component tests, and all 7
Playwright guest/browser tests pass. The authenticated browser workflow is
implemented and skips without dedicated test credentials. The pgTAP suite now
contains 32 assertions and is available as an optional manual
security check, but it still needs execution in an environment with a running
local Supabase stack.
Automated tests do not complete a real Google account login.

## Next work, in order

### P0.1 — Cloud reliability UX (implemented)

The shared shell now distinguishes initial loading, an empty cloud workspace,
offline state, failed load, and failed mutation. Failed loads offer an explicit
retry action without refreshing the browser. Cloud-facing errors use safe
messages, and successful writes are not reported as failed if only the
follow-up refresh fails.

Verified:

- Navigation and guest mode remain usable.
- Cloud failures never look like successful writes.
- Retry reloads the active cloud repository without refreshing the page.
- Error messages avoid exposing tokens, financial details, or internal URLs.

### P0.2 — Authenticated and RLS verification (automation implemented)

Coin uses a local Supabase/pgTAP suite for repeatable RLS verification and an
environment-gated Playwright workflow for account persistence. Remaining
execution:

- Run `pnpm test:db` with Docker and the local Supabase stack available.
- Run `e2e/cloud.spec.ts` with a dedicated synthetic account.
- Complete the documented manual continuity check with an existing Google test
  identity.

### P0.3 — Explicit guest import

Offer import from Settings after sign-in; do not interrupt the first successful
login. Show a preview, exclude any legacy demo rows, require confirmation,
preserve local data, and make retries idempotent. If cloud data already exists,
do not merge until the remaining merge-policy decision is resolved.

### P0.4 — Production OAuth and deployment

Deploy to Vercel, configure the final Supabase Site URL and redirect allow-list,
configure the Google origin and Supabase callback, and complete one real
production login. Consider Google brand verification and a custom Supabase auth
domain before public launch.

## Product improvements after P0

1. Remove/reset budgets and navigate budget months.
2. Rename/delete custom categories with referential-safety rules.
3. Add transaction search; date and type filters are implemented.
4. Apply period controls consistently where desktop users need them.
5. Define export, backup, account deletion, and cloud-data deletion.
6. Replace the boilerplate manifest and add a service worker if PWA support is
   promoted into scope.

## Explicit non-goals

Do not add bank connections, account balances, multi-currency conversion,
shared workspaces, email/password auth, Realtime, or general signed-in offline
sync unless the PRD is intentionally revised. Continue using shadcn and
Tailwind, work directly in this repository, and do not use the Sites skill.

## Key files

- `PRD.md` — product decisions and requirements
- `src/domain/finance.ts` — calculations and IDR semantics
- `src/features/finance/use-finance.ts` — workspace selection and cloud state
- `src/data/finance-repository.types.ts` — storage contract
- `src/data/finance-repository.ts` — Dexie adapter
- `src/data/supabase-finance-repository.ts` — Supabase adapter
- `src/features/auth/auth-provider.tsx` — session and OAuth entry point
- `src/features/finance/coin-app.tsx` — application shell and route views
- `supabase/migrations/` — schema, grants, constraints, and RLS
- `e2e/coin.spec.ts` — browser regression coverage

## Suggested next-session prompt

> Read `AGENTS.md`, `PRD.md`, and `NEXT_STAGE.md`. Implement budget removal and
> month navigation without changing guest/cloud separation or integer-IDR
> semantics. Start the app and verify the result.
