# Store POS — independent demo

A self-contained Expo + React Native + TypeScript demonstration of a resilient unattended-store checkout. It uses generated catalog data and deterministic simulation controls; it is **not connected to a real store, payment provider, or device fleet**.

## Setup

Supported runtime: Node 20+ and npm 10+.

```sh
cd apps/store-pos
npm install
npm run typecheck
npm test
npm run export:web
```

To run interactively:

```sh
npm run web
```

## Architecture

- `src/domain.ts` is the deliberately temporary, app-local pure domain boundary. It exposes checkout guards, cart money rules, payment transitions, and offline queue eligibility. Replace this import boundary with `@portfolio/domain` when that independently-owned package is available.
- `src/catalog.ts` provides deterministic generated fixtures and a query-shaped async fetch.
- `App.tsx` owns screen-local interaction state and uses TanStack Query for catalog server-state loading.

## Demo controls

Search or scan a generated item, edit its cart quantity, make health unsafe, choose a deterministic payment outcome, then turn the store connection off/on to observe the completed-sale queue recover. No card charge is ever attempted.
