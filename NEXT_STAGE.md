# Coin Next-Stage Handoff

Status: Online-first account storage implemented; deployment verification
pending

Baseline date: 2026-08-29

## Purpose

This document preserves the implementation context needed to continue Coin in
a new session. `PRD.md` is the product source of truth; this file is the
ordered execution handoff.

## Current implementation

- TanStack Start, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Recharts,
  Dexie, Supabase, Vitest, Playwright, and pnpm.
- Real route components exist for `/`, `/transactions`, `/budgets`, and
  `/settings` under one responsive Coin shell.
- The ledger starts at zero and reports integer-IDR net cash flow. Coin does not
  model bank balances or separate accounts.
- Guest finance data uses Dexie/IndexedDB and remains fully readable and writable
  online or offline.
- Authenticated finance reads and writes go directly to the user-scoped Supabase
  repository. Cloud snapshots exist only in React memory; account finance data
  is not stored or queued in IndexedDB.
- Cloud mutations are awaited before success is shown, then the active snapshot
  is refetched. A failed write leaves displayed data unchanged.
- Connectivity, focus, and resume listeners refetch account data. Overlapping
  reads are deduplicated and responses from superseded sessions are ignored.
- Loaded account data remains visible but read-only after network loss. A cold
  offline reload shows the PWA shell, offline banner, empty summaries,
  placeholders, and disabled finance actions until reconnection.
- Signing out immediately restores the preserved guest workspace. There is no
  pending-sync guard.
- Google-only login uses Supabase `signInWithOAuth`. There is no Google iframe,
  Google SDK loader, direct ID-token exchange, or product email/password UI.
- Custom category creation remains account-only. Account-owned categories may
  be renamed and physically deleted when no transaction or budget uses them.
- The database uses physical deletes with explicit `DELETE` grants,
  owner-scoped RLS, immutable built-in categories, and restricted category
  foreign keys.
- Offline-sync cache/outbox services, sync metadata, locks, conflict UI,
  conflict resolution, tombstones, revisions, and sync-only timestamps have
  been removed.
- Coin remains installable as a PWA. The service worker precaches the application
  shell and has no background-sync, push, polling, or account-data cache.

## Verified baseline

- TypeScript, focused ESLint, Prettier, production build, and unit/component
  tests pass.
- Guest Playwright workflows and the production offline-PWA reload workflow
  pass when run against directly started Vite servers.
- Authenticated Playwright coverage verifies direct persistence, no account
  IndexedDB database, read-only loaded data offline, reconnection, and immediate
  guest restoration; it skips without dedicated credentials.
- The pgTAP suite contains 42 assertions for grants, physical deletion,
  built-in/category protection, and cross-user isolation.
- Local pgTAP, migration execution, generated-type regeneration, and database
  lint still require an environment with Docker or Podman.
- Automated tests do not complete a real Google account login.

## Next work, in order

### P0.1 — Database deployment verification

1. Start a disposable local Supabase stack or equivalent isolated database.
2. Apply all migrations to an empty schema.
3. Restore a pre-cleanup schema with representative live and tombstoned rows,
   then apply the cleanup migration.
4. Regenerate `src/data/database.types.ts` and confirm there is no diff.
5. Run `pnpm test:db` and `supabase db lint --local`.
6. After deployment, review Supabase security and performance advisors.

Do not apply an unverified migration directly to the production project.

### P0.2 — Authenticated workflow verification

- Run `e2e/cloud.spec.ts` with a dedicated synthetic account.
- Verify a loaded account snapshot becomes read-only offline.
- Reload offline and confirm only shell/placeholders appear.
- Reconnect and confirm the current Supabase snapshot returns.
- Make a change from another device, focus/resume Coin, and confirm it refetches.
- Complete the documented Google identity continuity check.

### P0.3 — Explicit guest import

Offer import from Settings after sign-in. Show a preview, exclude legacy demo
rows, require confirmation, preserve local data, and make retries idempotent.
Do not reintroduce an account outbox to implement import.

### P0.4 — Production OAuth and deployment

Deploy to Vercel, configure the final Supabase Site URL and redirect allow-list,
configure the Google origin and Supabase callback, and complete one production
login with a test identity.

## Product improvements after P0

1. Navigate and review historical budget months.
2. Add transaction search.
3. Apply period controls consistently where desktop users need them.
4. Define export, backup, account deletion, and cloud-data deletion behavior.

## Explicit non-goals

Do not add bank connections, account balances, multi-currency conversion,
shared workspaces, email/password product auth, Realtime, authenticated offline
CRUD, account IndexedDB persistence, or service-worker background sync unless
the PRD is intentionally revised.

## Key files

- `src/features/pwa/pwa-registration.tsx` — lean service-worker registration
- `vite.config.ts` — PWA manifest, app-shell precache, and build integration
- `PRD.md` — product decisions and requirements
- `src/domain/finance.ts` — calculations and integer-IDR semantics
- `src/features/finance/use-finance.ts` — repository selection, in-memory
  cloud snapshot, connectivity state, and refetch coordination
- `src/features/finance/cloud-workspace-status.tsx` — account loading, offline,
  placeholder, and error UX
- `src/data/finance-repository.types.ts` — shared storage contract
- `src/data/finance-repository.ts` — guest Dexie adapter
- `src/data/supabase-finance-repository.ts` — direct account Supabase adapter
- `src/features/auth/auth-provider.tsx` — session and OAuth entry point
- `src/features/finance/coin-app.tsx` — application shell and route views
- `supabase/migrations/` — schema, grants, constraints, and RLS
- `supabase/tests/database/finance_rls.test.sql` — transactional pgTAP suite
- `e2e/coin.spec.ts` — guest browser regression coverage
- `e2e/cloud.spec.ts` — environment-gated account browser coverage
- `e2e-pwa/offline-reload.spec.ts` — production offline guest reload coverage

## Suggested next-session prompt

> Read `AGENTS.md`, `PRD.md`, and `NEXT_STAGE.md`. Verify the online-first
> cleanup migration on an isolated Supabase database with both empty and
> representative populated pre-cleanup states, regenerate types, run pgTAP and
> advisors, then complete the authenticated Playwright workflow. Preserve guest
> Dexie storage, online-only account storage, and integer-IDR semantics.
