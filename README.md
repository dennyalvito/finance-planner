# Coin

Coin is a local-first finance planner for recording income and expenses in one unified ledger. The current MVP uses IDR, optional category budgets, custom categories, cash-flow charts, and browser-local persistence. It deliberately reports recorded net movement rather than claiming to know an account balance.

The responsive product shell uses a collapsible sidebar on desktop and a fixed navigation dock on mobile. The central mobile action opens transaction entry as a bottom drawer.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

The app uses TanStack Start, React, TypeScript, Tailwind CSS v4, shadcn/ui, Dexie, and Recharts. Finance rules live in `src/domain`, local persistence in `src/data`, and the product UI in `src/features/finance`.
