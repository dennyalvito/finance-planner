# Authenticated workspace verification

Coin keeps automated database isolation tests separate from browser credentials.
No hosted account password, OAuth token, or service-role key belongs in source
control.

## Database and RLS

The optional pgTAP suite in
`supabase/tests/database/finance_rls.test.sql` verifies migrations, grants,
anonymous rejection, ownership isolation for all three finance tables,
cross-user mutation rejection, immutable built-in categories, amount
constraints, and unique monthly budgets.

To run it against a hosted project without Docker, open that project's
Supabase SQL Editor, paste the complete test file, and run it. The final result
table contains all 30 TAP assertions. Every row should start with `ok`; copy
any `not ok` row and its diagnostics when investigating a failure. If the SQL
Editor asks whether to enable RLS for the script's temporary results table,
choose **Run without RLS**. That table exists only inside the rolled-back test
transaction; the suite separately confirms RLS on all application tables.

Run it against the local Supabase stack:

```powershell
pnpm dlx supabase@2.110.0 start
pnpm test:db
```

The local-stack option requires Docker. Both methods run the test in a
transaction and roll back its two synthetic users and finance rows. This is a
manual pre-deployment check; it is not part of the normal unit, browser, or
GitHub workflow.

## Authenticated browser workflow

`e2e/cloud.spec.ts` is skipped unless all four dedicated test values exist:

```bash
COIN_E2E_SUPABASE_URL=
COIN_E2E_SUPABASE_PUBLISHABLE_KEY=
COIN_E2E_USER_EMAIL=
COIN_E2E_USER_PASSWORD=
```

The application dev server must receive the same URL and publishable key through
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Use a dedicated
synthetic test user, never a personal account. The test signs in through the
Supabase client, creates cloud data, reloads it, signs out through Coin, and
confirms that the earlier guest workspace returns.

```powershell
pnpm test:e2e e2e/cloud.spec.ts
```

Email/password is used only to establish a repeatable test session. Coin's
product UI remains Google-only.

## Google identity continuity

Provider identity continuity needs one manual check with an existing Google
test identity because CI must not automate a real Google account:

1. Sign in with the same Google identity used before the OAuth flow change.
2. Confirm that its existing cloud transactions, categories, and budgets load.
3. Add one synthetic transaction and reload Coin.
4. Sign out, confirm the preserved guest workspace, then sign in again.
5. Confirm the same cloud workspace returns.

Ownership remains keyed to the Supabase `auth.users.id`. Do not migrate or
rewrite that identifier when changing OAuth presentation or redirect settings.
