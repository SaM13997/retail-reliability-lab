# @retail-reliability/domain

Shared, framework-free TypeScript domain layer for Retail Reliability Lab. It contains runtime-validated contracts (Zod) and pure business rules, so the web console and React Native POS can agree on behavior without sharing UI.

## Requirements

- Node.js 20+
- npm 10+ (or npm bundled with a supported Node release)

## Commands

From the repository root:

```sh
npm install
npm run typecheck
npm test
```

## Public API

`src/index.ts` exports:

- `Money`, money parsing/addition/multiplication utilities using integer minor units.
- Runtime Zod contracts for products, inventory, device health, cart lines, payments, and queued sales.
- Inventory risk and fill-target calculation.
- Store/device health summarization and checkout guards.
- Cart totals with integer minor units and basis-point taxes.
- Payment finite-state-machine events/transitions.
- An idempotent offline completed-sale queue.
- `createSeededFixtures(seed)` for stable generated demo data.

Rules are synchronous and pure: callers provide time and state as data, rather than relying on global time, storage, or randomness.
