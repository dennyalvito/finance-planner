# Repository Guidelines

Whatever action you can do yourself, Please do yourself, this includes starting app and verification.

## Project Structure & Module Organization

Coin uses TanStack Start, React, TypeScript, and local-first storage. Organize routes in `src/routes/`, features in `src/features/`, shared UI in `src/components/`, finance rules in `src/domain/`, and adapters in `src/data/`. UI accesses storage only through repositories. Assets belong in `public/`; colocate unit tests and keep browser tests in `e2e/`.

The MVP has one unified ledger starting at zero. Net recorded cash flow equals income minus expenses; it is not a real account balance. Store IDR as integer rupiah, never floating-point values.

## Build, Test, and Development Commands

Expected scripts:

- `npm install` - install locked dependencies.
- `npm run dev` - start the development server.
- `npm run build` - create the production build.
- `npm run typecheck` - check TypeScript without emitting files.
- `npm run lint` - run ESLint and formatting checks.
- `npm test` - run unit and component tests.
- `npm run test:e2e` - run critical browser workflows.

Before review, run all relevant checks.

## Coding Style & Naming Conventions

Use two-space indentation, strict TypeScript, and Prettier. Use PascalCase for components (`BudgetCard.tsx`), `use` prefixes for hooks, camelCase for utilities, and lowercase route directories. Keep persistence and financial logic outside presentation components.

### shadcn/ui

Use shadcn/ui as the component foundation. Before adding UI, run `npx shadcn@latest info --json`, check installed components, search the registry, and run `npx shadcn@latest docs <component>`. Prefer existing components, built-in variants, full composition, and semantic tokens. Forms use `FieldGroup` and `Field`; overlays require accessible titles. Use shadcn's Chart wrapper.

Use the project package runner for additions and updates. Preview updates with `--dry-run` and `--diff`; never overwrite without approval. Review generated files and honor configured aliases, base, and icons.

## Testing Guidelines

Use Vitest and React Testing Library for unit/component tests and Playwright for end-to-end flows. Test calculations, repositories, validation, empty states, and transaction CRUD. Prioritize regression risks.

## Commit & Pull Request Guidelines

With no Git history, use Conventional Commits such as `feat: add transaction form`. Pull requests need a summary, verification commands, applicable issue links, screenshots for visual changes, and notes about schema or architecture changes.

## Security & Configuration

Never commit secrets or real financial data. Keep local values in ignored `.env.local` files and safe placeholders in `.env.example`. Treat future authentication and synchronization as server-side security boundaries.
