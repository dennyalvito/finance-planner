# Coin

Coin is a local-first finance planner for recording income and expenses in one unified ledger. It uses IDR, optional category budgets, custom categories, cash-flow charts, and reports recorded net movement rather than claiming to know an account balance.

Coin has two separate workspace modes:

- **Guest mode** stores data in Dexie/IndexedDB in the current browser and works without an account.
- **Account mode** uses Google sign-in and stores the signed-in user's data in Supabase Postgres, protected by Row Level Security.

Signing in never uploads or deletes guest data. Signing out returns to the preserved guest workspace.

## Local development

```bash
pnpm install --frozen-lockfile
Copy-Item .env.example .env
pnpm dev
```

Fill these public values in `.env` (or `.env.local`) from the Supabase project Connect dialog and Google Cloud:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Both files are ignored by this repository. Vite loads `.env` for every mode and lets `.env.local` override it locally. Open `http://localhost:3000`. If the Supabase variables are absent or placeholders, Coin continues in guest mode.

## Supabase and Google OAuth

The database schema and RLS policies are versioned in `supabase/migrations`. The browser receives only public configuration; never add a secret or service-role key to a `VITE_` variable.

To finish Google sign-in in the Supabase dashboard:

1. Open **Authentication → Providers → Google** and enable Google.
2. Create OAuth web credentials in Google Cloud. Under **Authorized JavaScript origins**, add exactly `http://localhost:3000` for local development. If you intentionally open the app through `http://127.0.0.1:3000`, add that separately because Google treats it as a different origin. Use the Supabase callback URL shown on the Google provider page as an authorized redirect URI.
3. Put the Google client ID and client secret in the Supabase provider form. The client secret stays in Supabase. The client ID is public and is also used as `VITE_GOOGLE_CLIENT_ID` so Google can render its official button.
4. Under **Authentication → URL Configuration**, allow `http://localhost:3000/**` for development and the final Vercel domain for production.

Email/password and email OTP signup are intentionally disabled. Google OAuth does not require SMTP setup.

Coin uses Google's official pre-built button and sends the returned ID token to Supabase with nonce validation.

## Vercel deployment

Add these environment variables to the Vercel project for Production, Preview, and Development as appropriate:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_GOOGLE_CLIENT_ID`

After the first production deployment, set the Supabase Site URL to the production Vercel URL and add its redirect pattern, for example `https://your-domain.vercel.app/**`. If a custom domain is added later, allow that domain too.

Also add the production origin, for example `https://your-domain.vercel.app`, to the Google OAuth client's authorized JavaScript origins. Google origins do not include a path or trailing wildcard.

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
