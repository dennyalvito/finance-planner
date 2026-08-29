# Coin

Coin is a private finance planner for one unified ledger. It
records income, expenses, optional category budgets, and account-owned custom
categories in Indonesian rupiah (IDR). The headline value is recorded net cash
flow—income minus expenses—not a bank account balance.

The responsive interface uses a desktop sidebar and mobile bottom dock. It
includes a compact mobile overview, desktop dashboard, charts, period filters,
transaction activity, budgets, and profile/settings.

## Workspace modes

- **Guest mode** stores data in Dexie/IndexedDB in the current browser and
  works without an account or network.
- **Account mode** uses Google-only Supabase OAuth and stores data in Supabase
  Postgres under Row Level Security. Finance CRUD goes directly to Supabase;
  fetched data is retained only in React memory for the current page session.

These are separate workspaces. Signing in never uploads or deletes guest data,
and signing out restores the preserved guest workspace. Explicit guest import
is planned for the next stage.

If an account user loses connectivity after loading data, that snapshot remains
visible but read-only. A cold offline reload shows the cached PWA shell, offline
status, and finance placeholders until reconnection. Account finance data is
never stored in IndexedDB or queued for later synchronization.

## Local development

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env
pnpm dev
```

Configure only the public Supabase browser values:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

If they are missing or placeholders, Coin continues in guest mode. Never put a
Supabase secret or service-role key in a `VITE_` variable.

## Supabase Google OAuth

Coin renders its own shadcn button and calls
`supabase.auth.signInWithOAuth({ provider: "google" })`. It does not load the
Google Identity Services SDK, render a Google iframe, or require a frontend
Google client ID.

To configure Google:

1. Create a **Web application** OAuth client in Google Auth Platform.
2. Add the Coin origins, such as `http://localhost:3000` and the production
   origin, under **Authorized JavaScript origins**.
3. Add the Supabase callback URL shown under **Authentication → Providers →
   Google** as an **Authorized redirect URI**.
4. Enable Google in Supabase and store the Google client ID and client secret
   there. The secret never enters this repository.
5. Under Supabase **Authentication → URL Configuration**, set the production
   Site URL and allow `http://localhost:3000/**`, the production domain, and
   any intentional preview URLs.

See the
[Supabase Google guide](https://supabase.com/docs/guides/auth/social-login/auth-google)
and [redirect URL guide](https://supabase.com/docs/guides/auth/redirect-urls).
Brand verification and a Supabase custom auth domain can improve the Google
consent-screen presentation before public launch.

## Vercel deployment

Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the appropriate
Vercel environments. After deployment, add the final app origin to Google and
the final return URL pattern to Supabase. Vercel hosts Coin; the Supabase
project remains independently owned.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:db
pnpm test:e2e
pnpm build
```

Finance rules live in `src/domain/`, persistence adapters in `src/data/`, auth
in `src/features/auth/`, routes in `src/routes/`, and product UI in
`src/features/finance/`.

`pnpm test:db` requires a running local Supabase stack and Docker. Authenticated
browser tests require dedicated test credentials and are skipped otherwise.
See [authenticated verification](./AUTHENTICATED_VERIFICATION.md) for physical
deletion/RLS checks, direct cloud persistence, account offline behavior,
sign-out restoration, and Google identity checks.

Read [PRD.md](./PRD.md) for product requirements and
[NEXT_STAGE.md](./NEXT_STAGE.md) for the current implementation handoff and
ordered backlog.
