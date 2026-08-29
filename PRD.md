# Coin Product Requirements Document

Status: Core MVP and online-first account storage implemented

Last updated: 2026-08-29

Execution handoff: [NEXT_STAGE.md](./NEXT_STAGE.md)

## 1. Product summary

Coin is a private personal finance planner for recording income, expenses,
categories, and monthly category budgets in Indonesian rupiah (IDR). It presents
the net movement of the transactions a user records; it does not claim to know a
real bank account balance.

Coin has two deliberately separate workspaces. Guest mode is a complete
browser-local experience backed by Dexie/IndexedDB and works online or offline.
Account mode is an online-first cloud experience: authenticated finance reads
and writes go directly to Supabase, and fetched data exists only in React memory
for the current page session.

## 2. Product principles

1. **Guest mode is real usage, not a demo.** Core planning works without an
   account or network.
2. **Account mode favors the common online case.** Supabase is the only
   persistent store for authenticated finance data.
3. **Storage mode is understandable.** Coin clearly identifies device and cloud
   workspaces.
4. **No silent data movement.** Guest data is never uploaded, merged, or deleted
   without an explicit user action.
5. **Financial values remain exact.** IDR amounts are integer rupiah, never
   floating-point values.
6. **The ledger starts at zero.** Recorded net cash flow is income minus
   expenses, not an account balance.
7. **Authorization is enforced in the database.** UI checks are not a security
   boundary.

## 3. Implemented capabilities

- Responsive desktop sidebar and mobile navigation dock
- Overview, transactions, budgets, and settings routes
- Transaction create, edit, and delete in guest and account workspaces
- Built-in transaction categories and account-owned custom categories
- Rename and guarded physical deletion for custom categories; stable identity
  and type remain immutable, and foreign keys protect categories in use
- Monthly category budgets with create, adjust, and remove actions
- Recorded income, expenses, net movement, keep-rate calculations, cash-flow
  charts, and category-spending charts
- Transaction summaries, date/type filters, date grouping, and activity actions
- Dexie/IndexedDB persistence for guest finance data
- Google-only Supabase OAuth and direct account-mode Supabase persistence
- Storage-mode indicators in navigation, profile, and settings
- Cloud loading, empty, offline, failed-load, failed-mutation, and retry UX
- Refetch on reconnect, window focus, and document resume/visibility
- Physical cloud deletes protected by least-privilege grants and owner-scoped
  Row Level Security
- Installable PWA metadata and a service worker that precaches the generated
  application shell
- Unit/component, guest browser, offline-PWA, authenticated browser, and pgTAP
  coverage

## 4. Current limitations

- Guest data exists only in the browser profile where it was created; clearing
  site data removes it.
- Guest and account workspaces cannot yet be imported or merged.
- Account finance actions require a network connection.
- A cold offline reload of an authenticated session cannot restore prior cloud
  finance data because account data is intentionally not persisted locally.
- The authenticated browser workflow requires dedicated synthetic credentials.
- Local database and pgTAP verification requires Docker or Podman.
- A real Google identity continuity check remains manual.
- There is no Realtime subscription or service-worker background sync.
- Export, backup, account deletion, and cloud-data deletion policies are not yet
  defined.

## 5. Workspace matrix

| Behavior                     | Guest workspace     | Account workspace                                             |
| ---------------------------- | ------------------- | ------------------------------------------------------------- |
| Authentication               | None                | Supabase Auth                                                 |
| Persistent store             | Dexie/IndexedDB     | Supabase Postgres                                             |
| In-page snapshot             | Dexie live query    | React memory                                                  |
| Finance writes               | Dexie               | Direct awaited Supabase request                               |
| Online use                   | Full CRUD           | Full CRUD                                                     |
| Offline after data is loaded | Full CRUD           | Read-only in-memory snapshot                                  |
| Cold offline reload          | Restores guest data | Shell, offline banner, placeholders, disabled finance actions |
| Reconnect                    | Dexie continues     | Automatically refetches Supabase                              |
| Local account cache/outbox   | None                | None                                                          |

Signing in changes the active repository from guest Dexie to the user's
Supabase workspace. Signing out immediately restores the preserved guest
workspace. Neither transition uploads, deletes, or merges guest data.

## 6. Architecture and repository selection

Finance UI depends on the shared `FinanceRepository` contract. Presentation
components do not call Dexie or Supabase directly.

```text
Auth loading          -> no active repository
Guest                 -> localFinanceRepository (Dexie)
Authenticated online  -> SupabaseFinanceRepository
Authenticated offline -> current React snapshot, read-only
```

Authenticated mutations are pessimistic:

1. Send the operation directly to Supabase.
2. Await a confirmed response before reporting success.
3. Refetch the active cloud snapshot.
4. Leave displayed data unchanged when the write fails.

Connectivity, focus, and resume listeners only update read-only state or
refetch. Overlapping reads are deduplicated, a mutation queues a newer snapshot
when necessary, and responses from a superseded authenticated session are
ignored.

Account data must never be written to IndexedDB, a local outbox, Cache Storage,
or the service worker. Supabase Auth may continue to persist its own session;
that session is not finance data.

## 7. Offline and PWA behavior

The service worker precaches the application shell and static assets. It has no
finance background-sync implementation.

- Guest users can cold-launch, reload, read, and mutate their Dexie workspace
  offline.
- If an account user loses connectivity after a successful load, Coin keeps the
  current React snapshot visible as read-only, displays an offline banner, and
  disables finance actions.
- If an authenticated page is reloaded while offline, the in-memory snapshot is
  gone. Coin displays the shell, offline banner, em-dash summaries, chart/list
  placeholders, and disabled finance actions.
- When connectivity returns, Coin automatically reloads the current Supabase
  workspace and restores finance actions after a snapshot is available.
- Focus and resume events refetch online account data so changes made on another
  device become visible without introducing conflict-resolution logic.

## 8. Cloud data model

All account tables use Row Level Security and owner-scoped policies.

### `categories`

- `id`: stable text primary key
- `user_id`: nullable UUID referencing `auth.users`
- `name`: text
- `type`: `income` or `expense`
- `is_custom`: boolean
- `created_at`: timestamptz

Built-in categories have `user_id = null`, stable IDs, and are readable but
immutable. Custom categories are owned by one user. Category identity and type
cannot change after creation.

### `transactions`

- `id`: UUID primary key
- `user_id`: UUID referencing `auth.users`
- `type`: `income` or `expense`
- `amount`: positive safe-integer bigint
- `category_id`: restricted foreign key to `categories`
- `date`: date
- `note`: text
- `created_at`: timestamptz

### `budgets`

- `id`: UUID primary key
- `user_id`: UUID referencing `auth.users`
- `category_id`: restricted foreign key to `categories`
- `month`: first day of the month
- `amount`: positive safe-integer bigint
- `updated_at`: timestamptz retained for the budget domain
- Unique constraint on `(user_id, month, category_id)`

Deletes are physical. Authenticated users have explicit `DELETE` grants but
RLS permits deletion only for their own rows; built-in categories remain
immutable, and category foreign keys reject deletion while a transaction or
budget uses the category. Offline-sync revisions, tombstones, revision triggers,
and sync-only timestamps are not part of the active schema.

## 9. Authentication, security, and privacy

- Authentication is optional at the product level and Google-only for account
  mode.
- Coin uses `supabase.auth.signInWithOAuth({ provider: "google" })`; there is
  no Google SDK, iframe, direct ID-token exchange, or product email/password UI.
- Browser configuration contains only the Supabase URL and publishable key.
- Google credentials stay in Supabase; service-role credentials never ship to
  the browser.
- Every account query is scoped by `user_id` in addition to RLS.
- Production responses restrict framing, MIME sniffing, referrer disclosure,
  unnecessary browser capabilities, and network connections through explicit
  security headers and a Content Security Policy. The generated TanStack shell
  currently requires framework-generated inline bootstrap scripts, while
  inline event handler attributes remain blocked.
- Real credentials and financial data do not belong in source or fixtures.
- Transaction values, notes, access tokens, and refresh tokens must not be
  logged.

## 10. Testing requirements

### Unit and component

- Finance calculations remain storage-independent.
- Repository selection chooses Dexie for guests and Supabase for authenticated
  users.
- Supabase row mapping preserves integer amounts and dates.
- Account delete methods issue physical deletes.
- Offline account status distinguishes a retained snapshot from a cold reload.
- Connectivity listeners refetch without duplicating overlapping requests.

### Database and security

- Migrations apply to empty and previously synchronized/populated schemas.
- Tombstoned child records are purged before tombstoned custom categories.
- Anonymous requests cannot access finance tables.
- Users can select, insert, update, and physically delete only permitted rows.
- Built-in categories are immutable and categories in use remain protected.
- Invalid amounts and duplicate monthly budgets are rejected.
- Generated TypeScript types match the migrated schema.
- Supabase security and performance advisors are reviewed after database
  deployment.

### End to end

- Guest CRUD survives online and offline reloads through Dexie.
- Account CRUD reaches Supabase directly and creates no account IndexedDB
  database or outbox.
- Loaded account data becomes read-only offline.
- A cold offline account reload shows placeholders and disabled actions.
- Reconnection, focus, and resume load current Supabase data.
- Sign-out immediately restores the preserved guest workspace.
- Google identity continuity is verified manually with a non-personal test
  identity.

## 11. Delivery history

- **Foundation:** responsive finance UI, domain rules, guest Dexie repository,
  and guest browser coverage.
- **Supabase foundation:** versioned schema, generated types, built-in
  categories, grants, RLS, auth provider, and direct Supabase repository.
- **PWA:** install metadata, shell precache, and offline guest reload coverage.
- **Former offline account sync:** a per-user Dexie cache/outbox, tombstones,
  revisions, conflict resolution, and pending sign-out guard were implemented
  and later removed.
- **Online-first account refactor (2026-08-29):** authenticated CRUD now goes
  directly to Supabase, cloud snapshots live only in React memory, account
  offline state is read-only, obsolete sync services/UI were removed, and the
  database returned to physical owner-scoped deletes.
- **Online-first database deployment (2026-08-29):** the cleanup migration was
  transactionally validated and deployed with its committed version; obsolete
  tombstones were purged, and live owner/cross-user physical-delete checks
  passed without retaining synthetic verification data.
- **Browser hardening (2026-08-29):** Vercel response headers now constrain
  content sources, framing, referrers, MIME handling, cross-origin behavior,
  and unused browser capabilities.

## 12. Next work

1. Complete the environment-gated authenticated Playwright workflow against
   the migrated deployment.
2. Verify the production security headers, Google redirect, and PWA behavior on
   the final Vercel deployment.
3. Run the full local pgTAP/database-reset regression when Docker or Podman is
   available.
4. Implement explicit, previewed, idempotent guest import without automatic
   merging.
5. Define export, backup, account deletion, and cloud-data deletion behavior.

## 13. Recorded decisions

- Host the application on Vercel while keeping Supabase independently owned.
- Keep guest storage entirely in Dexie and fully usable offline.
- Keep authenticated finance storage online-only in Supabase; do not persist or
  queue account finance data locally.
- Keep the PWA shell and offline guest experience without service-worker
  background sync.
- Use Google OAuth only; do not offer product email-based signup.
- Keep guest and account workspaces separate until an explicit import exists.
- Use direct awaited cloud writes and read-only in-memory snapshots instead of
  optimistic offline account writes or multi-device conflict resolution.
- Use physical deletes with least-privilege grants, owner-scoped RLS, and
  foreign-key category protection.
- Refetch account data on reconnect, focus, and resume; defer Realtime until
  evidence shows it is needed.
