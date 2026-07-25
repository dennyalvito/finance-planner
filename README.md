# Coin

Coin is a local-first finance planner for recording income and expenses in one unified ledger. It uses IDR, optional category budgets, custom categories, cash-flow charts, and reports recorded net movement rather than claiming to know an account balance.

Coin has two separate workspace modes:

- **Guest mode** stores data in Dexie/IndexedDB in the current browser and works without an account.
- **Account mode** uses Google sign-in and stores the signed-in user's data in Supabase Postgres, protected by Row Level Security.

Signing in never uploads or deletes guest data. Signing out returns to the preserved guest workspace.

## Local development

```bash
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm dev
```

Fill these public values in `.env.local` from the Supabase project Connect dialog:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

Open `http://localhost:3000`. If the variables are absent or placeholders, Coin continues in guest mode.

## Supabase and Google OAuth

The database schema and RLS policies are versioned in `supabase/migrations`. The browser receives only the project URL and publishable key; never add a secret or service-role key to a `VITE_` variable.

To finish Google sign-in in the Supabase dashboard:

1. Open **Authentication → Providers → Google** and enable Google.
2. Create OAuth web credentials in Google Cloud. Use the Supabase callback URL shown on the Google provider page as an authorized redirect URI.
3. Put the Google client ID and client secret in the Supabase provider form. These values stay in Supabase, not in this repository or Vercel's public variables.
4. Under **Authentication → URL Configuration**, allow `http://localhost:3000/**` for development and the final Vercel domain for production.

Email/password and email OTP signup are intentionally disabled. Google OAuth does not require SMTP setup.

## Vercel deployment

Add these environment variables to the Vercel project for Production, Preview, and Development as appropriate:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

After the first production deployment, set the Supabase Site URL to the production Vercel URL and add its redirect pattern, for example `https://your-domain.vercel.app/**`. If a custom domain is added later, allow that domain too.

Vercel hosts the application; the Supabase project remains independently owned and can be connected or replaced without binding the database lifecycle to Vercel.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

The app uses TanStack Start, React, TypeScript, Tailwind CSS v4, shadcn/ui, Supabase, Dexie, and Recharts. Finance rules live in `src/domain`, persistence adapters in `src/data`, auth in `src/features/auth`, and product UI in `src/features/finance`.
