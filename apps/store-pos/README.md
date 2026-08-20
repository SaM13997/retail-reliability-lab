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

- `packages/domain` owns runtime-validated cart, health, payment-state, and offline-sale rules shared by both demos.
- `src/domain.ts` is a React Native adapter that maps screen-friendly types and copy to those shared rules.
- `src/catalog.ts` provides deterministic generated fixtures and a query-shaped async fetch.
- `App.tsx` owns screen interaction state, persists the offline queue with AsyncStorage, and uses TanStack Query for catalog server-state loading.

## Demo controls

Search or scan a generated item, edit its cart quantity, make health unsafe, choose a deterministic payment outcome, then turn the store connection off/on to observe the completed-sale queue recover. No card charge is ever attempted.
