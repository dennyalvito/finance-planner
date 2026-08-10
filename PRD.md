# Coin Product Requirements Document

Status: Core MVP and account reliability implemented; import decision pending

Last updated: 2026-08-08

Execution handoff: [NEXT_STAGE.md](./NEXT_STAGE.md)

## 1. Product summary

Coin is a private, local-first personal finance planner for recording income,
expenses, categories, and monthly category budgets in Indonesian rupiah (IDR).
It presents the net movement of the transactions a user has recorded; it does
not claim to know a real bank account balance.

The current MVP is a responsive web application with a unified ledger,
dashboard summaries, cash-flow and spending charts, transaction management,
custom categories, and monthly budgets. Guest data is stored in the browser
with Dexie and IndexedDB. Signed-in users have a separate account-backed
workspace in Supabase Postgres. Using Coin without an account remains a
complete, first-class experience.

## 2. Product principles

1. **Guest mode is real usage, not a demo.** A user can use the core planner
   without creating an account.
2. **Storage mode is understandable.** Coin must clearly communicate whether
   data is stored in this browser or in the signed-in user's cloud workspace.
3. **No silent data movement.** Guest data is never uploaded, merged, or
   deleted without an explicit user action.
4. **Financial values remain exact.** IDR amounts are stored as integer rupiah,
   never floating-point values.
5. **The ledger starts at zero.** Recorded net cash flow is income minus
   expenses, not an account balance.
6. **Authorization is enforced in the database.** UI checks are not treated as
   a security boundary.

## 3. Current product scope

### Implemented

- Responsive desktop sidebar and mobile navigation dock
- Overview, transactions, budgets, and settings routes
- Income and expense transaction creation
- Transaction editing from transaction history and recent overview activity in
  both guest and account workspaces
- Transaction deletion
- Built-in categories for guests and account-owned custom categories
- Monthly category budgets
- Recorded income, expenses, net movement, and savings-rate calculations
- Cash-flow and category-spending charts
- Mobile period filtering defaults to Today, with presets and separate From/To
  calendar dialogs that support direct month and year selection
- Transaction history summaries, date/type filters, date grouping, and row
  actions for editing or deleting an entry
- Semantic negative styling for expense amounts in transaction activity
- A visually emphasized amount field in mobile transaction entry
- Dexie/IndexedDB persistence
- Google-only Supabase OAuth and account-mode cloud persistence
- Storage-mode indicators in navigation, profile, and settings
- Cloud loading, empty, offline, failed-load, failed-mutation, and retry UX
- Transactional RLS tests and an authenticated browser verification workflow
- Empty first-visit guest ledger with built-in transaction categories
- Installable PWA metadata, platform icons, and a service worker that precaches
  the local app shell for offline guest access
- Unit tests for finance calculations
- Playwright coverage for critical guest workflows

### Current limitations

- Guest data is available only in the browser profile where it was created.
- Clearing site data removes the guest ledger.
- Account mode is online-required in the first release.
- There is no guest-to-account import flow yet.
- The authenticated browser workflow needs dedicated test credentials to run.
- The local RLS suite needs Docker and a running local Supabase stack.
- Real Google identity continuity remains a manual verification.
- Budget removal and category rename/delete are absent.
- Realtime synchronization and signed-in offline writes are deferred.

## 4. Goals for the backend stage

### Primary goals

- Establish Supabase project structure and versioned database migrations.
- Add a secure, user-owned cloud data model for transactions, categories, and
  budgets.
- Prepare Supabase Auth without making authentication mandatory.
- Introduce a repository boundary so presentation code does not know whether
  Dexie or Supabase stores the data.
- Preserve all existing guest behavior and guest data.
- Make the active storage mode visible to the user.

### Success criteria

- A guest can continue using Coin with no Supabase configuration or network.
- A signed-in user can only access their own cloud data.
- Signing out returns the browser to its preserved guest workspace.
- No Supabase secret or service-role key is shipped to the browser.
- Database schema and Row Level Security policies are reproducible from source
  control.
- Existing finance rules and IDR semantics behave identically in both storage
  modes.

## 5. Non-goals for the first backend release

- Bank connections or automatic transaction ingestion
- Multi-currency support
- Shared, household, or organization workspaces
- Full offline synchronization for signed-in users
- Conflict resolution across devices
- Realtime subscriptions
- Automatic background migration of guest data
- A custom application server when Supabase Auth, Postgres, Data API, and Row
  Level Security satisfy the requirement

## 6. Users and storage modes

### Guest mode

- Authentication: none
- Data store: Dexie/IndexedDB
- Scope: the current browser profile
- Network requirement: none for core finance operations
- Data lifecycle: remains local until the user explicitly clears it or imports
  it into a cloud workspace

### Account mode

- Authentication: Supabase Auth
- Data store: Supabase Postgres through the user-scoped Supabase client
- Scope: the authenticated user
- Network requirement for the first release: required for reads and writes
- Authorization: PostgreSQL Row Level Security

### Switching modes

- Signing in switches the active workspace from guest Dexie data to the user's
  Supabase data.
- Signing out switches back to the existing guest Dexie workspace.
- Switching modes does not delete either workspace.
- Coin must show a storage indicator such as `On this device` or `Cloud
workspace` to prevent confusion.

This is a dual-workspace model, not automatic bidirectional synchronization.

## 7. First-login and guest-data strategy

The first time a user signs in on a browser that contains meaningful guest
data, Coin should present an explicit choice:

1. **Import guest data to the cloud** — copy eligible local records into the
   user's cloud workspace after showing a summary and receiving confirmation.
2. **Keep workspaces separate** — open the existing cloud workspace without
   uploading local data.

Recommended behavior:

- Never import legacy seeded example transactions.
- Import in one database transaction or an idempotent server operation.
- Preserve local guest data after a successful import until the user separately
  chooses to remove it.
- Use stable import identifiers or an import ledger to prevent duplicate
  imports when a request is retried.
- If the cloud workspace already contains data, require a second confirmation
  before merging.

The import flow should be implemented after the base cloud repository and auth
flow are working. Until then, guest and account workspaces remain separate.

## 8. Technical architecture

### Current frontend stack

- TanStack Start and TanStack Router
- React 19 and TypeScript
- Vite
- Tailwind CSS v4
- shadcn/ui with Radix primitives
- Recharts
- Dexie and `dexie-react-hooks`
- Vitest and React Testing Library
- Playwright
- pnpm

### Proposed backend stack

- Supabase Auth for account identity and sessions
- Supabase Postgres as the account-mode system of record
- Supabase Data API through the official JavaScript client
- PostgreSQL Row Level Security for user isolation
- Supabase CLI migrations checked into `supabase/migrations`
- Generated TypeScript database types checked into the repository

### Application boundaries

Finance UI and feature hooks should depend on a `FinanceRepository` contract,
not on Dexie or Supabase directly.

The contract should cover:

- Listing transactions, categories, and budgets
- Adding, updating, and deleting a transaction
- Creating a custom category
- Saving a monthly category budget
- Clearing legacy guest example transactions where supported
- Refreshing or subscribing to repository changes

Two adapters implement that contract:

- `DexieFinanceRepository` for guest mode
- `SupabaseFinanceRepository` for account mode

An auth/session layer selects the active adapter:

```text
No authenticated user -> DexieFinanceRepository
Authenticated user    -> SupabaseFinanceRepository
```

Domain calculations remain in `src/domain` and are shared by both modes.
Presentation components must not call IndexedDB or Supabase directly.

## 9. Proposed cloud data model

The initial schema should contain three finance tables. All timestamps use UTC.

### `categories`

- `id`: text primary key
- `user_id`: nullable UUID referencing `auth.users`
- `name`: text
- `type`: `income` or `expense`
- `is_custom`: boolean
- `created_at`: timestamptz

Built-in categories use the existing stable text identifiers, such as `salary`
and `food`, with `user_id = null`, and are readable by every authenticated
user. Custom categories use globally unique text identifiers and must be owned
by a user. This preserves the current domain identifiers and referential
integrity.

### `transactions`

- `id`: UUID primary key
- `user_id`: UUID referencing `auth.users`
- `type`: `income` or `expense`
- `amount`: bigint with `amount > 0`
- `category_id`: foreign key to `categories`
- `date`: date
- `note`: text
- `created_at`: timestamptz

The application must only convert `amount` to a JavaScript number after
ensuring it is within JavaScript's safe integer range.

### `budgets`

- `id`: UUID primary key
- `user_id`: UUID referencing `auth.users`
- `category_id`: foreign key to `categories`
- `month`: date normalized to the first day of the month
- `amount`: bigint with `amount > 0`
- `updated_at`: timestamptz
- Unique constraint on `(user_id, month, category_id)`

The unique constraint makes budget saving an upsert instead of creating
duplicates.

### Database invariants

- Finance tables have Row Level Security enabled.
- Authenticated users can select, insert, update, and delete only rows where
  `user_id = auth.uid()`.
- Anonymous API requests cannot access private finance rows.
- Custom category writes require `user_id = auth.uid()`.
- Built-in categories are readable but cannot be changed by application users.
- Ownership columns are indexed.
- Transaction dates and category/type compatibility are validated by the
  repository and, where practical, by database constraints or triggers.

## 10. Authentication strategy

Authentication is optional at the product level but required for account mode.

### Provider decision

Coin uses Google authentication through Supabase Auth. The primary entry point
is Coin's own branded application button, which calls
`supabase.auth.signInWithOAuth({ provider: "google" })`. Supabase Auth owns the
browser redirect to Google and the return to Coin. The application does not
load Google Identity Services, render a Google iframe, or perform a direct
ID-token exchange. There is no email/password, magic-link, or email OTP signup
in the first release. Guest mode remains the alternative for users who do not
want to use Google or create a cloud workspace. SMTP configuration is
therefore not required.

### Session behavior

- Auth state is exposed through a single React provider/hook.
- The provider has explicit `loading`, `guest`, and `authenticated` states.
- Repository selection waits for the initial session check to avoid briefly showing the wrong workspace.
- Expired or signed-out sessions return the app to guest mode without deleting local data.
- OAuth returns users to the Coin route where they initiated sign-in.
- Redirect URLs are allow-listed in Supabase for local development and production.

### Client and server session scope

The current finance experience is browser-driven, so the first release uses a browser Supabase client for authenticated data access. Before introducing authenticated server rendering or protected server routes, Coin should adopt cookie-based SSR session handling and validate users on the server.

No module-level server client may contain user-specific session state.

## 11. Security and privacy requirements

- Use only the Supabase project URL and publishable key in browser environment
  variables.
- Never expose a Supabase secret or service-role key to client code.
- Enable Row Level Security before account-mode data access is enabled.
- Scope every account query by `user_id` in addition to relying on RLS.
- Keep real financial data and credentials out of source control and test
  fixtures.
- Provide safe placeholders in `.env.example`; keep real values in ignored
  local environment files.
- Treat migrations and RLS policies as reviewed application code.
- Test that one authenticated user cannot read or mutate another user's rows.
- Avoid logging transaction notes, amounts, access tokens, or refresh tokens.

## 12. Configuration

Expected public client configuration:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

The application must detect missing configuration and continue in guest mode
without throwing or attempting cloud requests.

The Google OAuth client ID and secret are configured only in Supabase Auth.
Neither value is required by Coin's frontend runtime.

Project-specific secrets used by CI, migration tooling, or future server code
must not use the `VITE_` prefix.

## 13. Delivery plan

### Phase 0 — Product strategy (implemented)

- Storage-mode behavior, Google-only auth, and the Settings-based import entry
  point are decided and recorded.
- The local-versus-hosted database test environment remains a Phase 5 decision.

### Phase 1 — Supabase foundation (implemented)

- Initialize Supabase CLI project files.
- Add versioned schema migrations.
- Add built-in category seed data.
- Enable and test Row Level Security policies.
- Add safe environment-variable documentation.
- Generate database TypeScript types.
- Do not change the active frontend data source in this phase.

### Phase 2 — Repository boundary (implemented)

- Define the storage-agnostic repository contract.
- Adapt the existing Dexie implementation without changing guest behavior.
- Implement the Supabase repository.
- Add repository contract and mapping tests.

### Phase 3 — Auth and mode selection (implemented)

- Add auth session provider.
- Add Google-only Supabase OAuth sign-in and sign-out UI.
- Select the repository from resolved auth state.
- Add clear storage-mode indicators and initial loading states.
- Verify that sign-out restores the preserved guest workspace.
- Verify the hosted Supabase authorize endpoint hands off to Google.

Production-domain OAuth and a complete authenticated browser workflow remain
Phase 5 verification work.

### Phase 4 — Guest import

- Detect meaningful guest data.
- Add import preview and confirmation.
- Implement idempotent import and failure recovery.
- Verify that demo data is excluded and local data is preserved.

### Phase 5 — Hardening

- Add RLS isolation tests in CI.
- Add authenticated Playwright workflows.
- Add account-mode error and network-loss UX.
- Document backup, deletion, and account lifecycle behavior.

## 14. Testing requirements

### Unit tests

- Domain calculations remain storage-independent.
- Row-to-domain mapping preserves integer amounts and dates.
- Repository selection returns Dexie for guests and Supabase for authenticated
  users.
- Import planning excludes demo records and is idempotent.

### Repository contract tests

Both repositories should satisfy the same behavioral contract for:

- Transaction creation, update, and deletion
- Category creation
- Budget upsert
- Sorting and filtering expectations
- Validation and useful error propagation

### Database and security tests

- Migrations apply to an empty database.
- Built-in categories are readable and immutable to normal users.
- Unauthenticated requests cannot access finance rows.
- User A cannot read, update, or delete User B's rows.
- Invalid or non-positive amounts are rejected.
- Duplicate monthly budgets are prevented.

### End-to-end tests

- All existing guest workflows continue to pass without Supabase variables.
- A user can sign in, create data, reload, and see the same cloud workspace.
- A user can sign out and see the earlier guest workspace.
- A failed network request does not falsely report a successful finance write.
- The Settings import flow behaves according to the user's explicit choice.

## 15. Product and UX requirements

- Guest mode must not be framed as unsafe or incomplete.
- Account mode should explain its benefit as backup and cross-device access.
- Sign-in must not block the dashboard.
- The active storage location must be visible in Settings and the profile area.
- Destructive or data-moving actions require clear confirmation.
- Cloud loading, empty, offline, and error states must be distinguishable.
- Accessibility requirements of the existing shadcn-based UI continue to apply.

## 16. Open decisions

1. If the cloud workspace already has data, should the first import release
   support merging or require choosing one workspace?
2. Is a local Docker-based Supabase stack required for CI, or will hosted
   database tests be sufficient?
3. What final production/custom domain should be allow-listed after the Vercel
   deployment exists?
4. What is the account and cloud-data deletion policy?

## 17. Recorded initial decisions

- Host the application on Vercel while keeping the Supabase project independently owned.
- Keep guest mode entirely on Dexie.
- Make account mode cloud-first and online-required at first.
- Use Google OAuth only; do not offer email-based signup.
- Keep guest and account workspaces separate until an explicit import phase.
- Offer import from Settings after sign-in rather than interrupting the first successful login.
- Use migrations, least-privilege grants, and Row Level Security from the first database change.
- Ship installable PWA support with a lean browser-managed update lifecycle;
  do not add background sync or signed-in offline writes yet.
- Defer Realtime and general offline sync until there is evidence they are needed.
