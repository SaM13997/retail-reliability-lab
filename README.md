# Retail Reliability Lab

Two production-minded frontend demos for trustworthy unattended-retail operations: a data-rich React operator console and a resilient Expo point-of-sale flow.

> Independent portfolio project by [Sarthak Malhotra](https://github.com/SaM13997). All stores, products, incidents, transactions, and payment outcomes are generated. This project is not affiliated with an employer or retailer.

## What this demonstrates

| Surface | Product problem | Stack and evidence |
| --- | --- | --- |
| **Operator Console** | Make fleet health, inventory risk, incidents, and live activity fast to understand without hiding stale or failed work | React, TypeScript, MUI, TanStack Query/Table, optimistic rollback, Vitest, Cypress |
| **Store POS** | Keep checkout understandable through unsafe devices, declines, timeouts, connection loss, and sync recovery | Expo, React Native, TypeScript, TanStack Query, AsyncStorage, Jest, web export |
| **Shared domain** | Keep money, inventory, health, checkout, payment, and queue behavior consistent across platforms | Zod runtime contracts, pure functions, deterministic fixtures, edge-case tests |
| **Writing** | Explain the architecture and tradeoffs rather than relying on screenshots | Four original, code-linked articles in [`blog/`](blog) |

## Quick review

Requirements: Node 20+ and npm 10+.

```sh
npm ci
npm run verify
npm run e2e
```

Run either demo:

```sh
npm run dev:console   # Vite Operator Console
npm run dev:pos       # Expo Store POS; press w for web
```

Follow the **[15-minute reviewer guide](docs/review-guide.md)** for exact happy, failure, offline, recovery, responsive, and keyboard flows.

## Architecture

```text
apps/operator-console ─┐
                       ├── packages/domain (validated platform-neutral rules)
apps/store-pos ─ adapter┘
       └── AsyncStorage offline-sale queue
```

- TanStack Query owns generated remote-style snapshots and catalog data.
- TanStack Table owns inventory sorting while filters remain local UI state.
- Incident assignment captures a rollback snapshot before optimistic mutation.
- Store POS maps React Native screen types into shared domain rules.
- Deterministic controls make decline, timeout, rollback, offline, and live-feed behavior reproducible.

Read [`docs/architecture.md`](docs/architecture.md) for data/state diagrams and explicit simulation boundaries.

## Verified quality gates

The current local verification covers:

- TypeScript checks for all workspaces.
- Biome lint and formatting.
- **13 passing** unit/component tests.
- **2 passing** Cypress end-to-end workflows.
- Vite production build.
- Expo web export.
- Keyboard, responsive, offline, and recovery steps documented for manual review.

See [`docs/verification.md`](docs/verification.md) for what is automated versus manual. CI repeats the clean-install quality gates on pushes and pull requests.

## Project map

```text
apps/
  operator-console/   React/MUI operational dashboard
  store-pos/          Expo/React Native checkout demo
packages/
  domain/             Shared contracts, rules, fixtures, and tests
blog/                  Four engineering articles
.github/workflows/     Clean-install CI gates
docs/                  Architecture, proof map, verification, review guide
```

## Engineering articles

1. [Designing real-time operational UIs that stay trustworthy](blog/01-trustworthy-realtime-operational-uis.md)
2. [Reconciling event streams with TanStack Query server state](blog/02-events-and-tanstack-query.md)
3. [Debugging React performance and memory problems methodically](blog/03-debugging-react-performance-and-memory.md)
4. [Sharing domain behavior across React and React Native without forcing shared UI](blog/04-shared-domain-react-react-native.md)

## Deliberate limits

This lab uses in-browser/generated adapters so reviewers need no secrets or backend. The transaction stream is a timer simulation, and POS recovery uses a simulated acknowledgement. The articles describe how sequence validation, richer idempotency records, telemetry, and measured performance budgets would extend these boundaries in production.
