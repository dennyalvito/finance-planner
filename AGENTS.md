# Repository Guidelines

Whatever action you can do yourself, Please do yourself, this includes starting app and verification.

## Project Structure & Module Organization

Coin uses TanStack Start, React, TypeScript, Dexie guest storage, and Google-only Supabase account storage. Put routes in `src/routes/`, features in `src/features/`, shared UI in `src/components/`, finance rules in `src/domain/`, and adapters in `src/data/`. UI reaches persistence only through repositories. Read `PRD.md` and `NEXT_STAGE.md` before product work.

The MVP has one unified ledger starting at zero. Net recorded cash flow equals income minus expenses; it is not a real account balance. Store IDR as integer rupiah, never floating-point values.

## Build, Test, and Development Commands

- `pnpm install --frozen-lockfile` - install locked dependencies.
- `pnpm dev` - start the development server.
- `pnpm build` - create the production build.
- `pnpm typecheck` - check TypeScript without emitting files.
- `pnpm lint` - run ESLint and formatting checks.
- `pnpm test` - run unit and component tests.
- `pnpm test:e2e` - run critical browser workflows.

Before review, run all relevant checks.

## Coding Style & Naming Conventions

Use two-space indentation, strict TypeScript, and Prettier. Use PascalCase for components (`BudgetCard.tsx`), `use` prefixes for hooks, camelCase for utilities, and lowercase route directories. Keep persistence and financial logic outside presentation components.

### shadcn/ui

Use shadcn/ui as the component foundation. Before adding UI, run `pnpm dlx shadcn@latest info --json`, check installed components, search the registry, and run `pnpm dlx shadcn@latest docs <component>`. Prefer existing components, built-in variants, full composition, and semantic tokens. Forms use `FieldGroup` and `Field`; overlays require accessible titles. Use shadcn's Chart wrapper.

Use the project package runner. Preview updates with `--dry-run` and `--diff`; never overwrite without approval.

## Testing Guidelines

Use Vitest and React Testing Library for unit/component tests and Playwright for end-to-end flows. Test calculations, repositories, validation, empty states, and transaction CRUD.

## Commit & Pull Request Guidelines

With no Git history, use Conventional Commits such as `feat: add transaction form`. Pull requests need a summary, verification commands, applicable issue links, screenshots for visual changes, and notes about schema or architecture changes.

## Security & Configuration

Never commit secrets or real financial data. Browser configuration is limited to the Supabase URL and publishable key; Google credentials stay in Supabase. Preserve RLS ownership checks and never expose service-role credentials. Guest and cloud workspaces remain separate until an explicit, confirmed import flow exists.
