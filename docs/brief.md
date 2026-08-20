# Product brief

## Goal

Show senior frontend ownership across operational web software, mobile point-of-sale, API boundaries, real-time data, performance, testing, accessibility, and product-quality UX.

## App 1: Operator Console

Build a React + TypeScript web app for operators managing unattended retail locations.

Core workflows:
- Fleet health overview with live store status and stale-data indicators.
- Inventory table with sorting, filtering, virtualization or pagination, and low-stock triage.
- Incident queue with optimistic assignment and rollback on simulated failure.
- Transaction feed with live events, pause/resume, and detail inspection.
- Store detail showing device health, inventory risk, and recent activity.

Required stack:
- Vite, React, TypeScript
- TanStack Query and TanStack Table
- MUI with a small token-driven theme
- Mock Service Worker or an equivalent typed in-browser API
- Vitest + Testing Library
- Cypress end-to-end coverage

Quality requirements:
- Responsive and keyboard accessible
- Loading, empty, error, offline, stale, and retry states
- No fake auth or backend setup required for the demo
- Deterministic demo mode and a live simulation toggle
- Document performance and state architecture choices

## App 2: Store POS

Build an Expo + React Native + TypeScript app for a resilient unattended-store checkout flow.

Core workflows:
- Scan/search generated products and manage a cart.
- Prevent checkout when device/store health is unsafe.
- Simulate payment states: processing, approved, declined, timeout, retry.
- Queue a completed sale while offline and show sync recovery.
- Large tap targets, clear status, and accessible labels.

Required stack:
- Expo, React Native, TypeScript
- TanStack Query where it adds real value
- Shared pure TypeScript domain rules from `packages/domain`
- Unit/component tests
- Web export so reviewers can try it without a phone

## Shared domain package

Own runtime-validated types and pure functions for inventory risk, store health, money, cart totals, checkout guards, events, and deterministic fixtures.

## Writing

Create four substantive, original articles in `blog/`:
1. Designing real-time operational UIs that stay trustworthy.
2. Reconciling server state and events with TanStack Query.
3. Debugging React performance and memory problems methodically.
4. Sharing domain behavior across React and React Native without forcing shared UI.

Each article must include concrete code/pseudocode, tradeoffs, failure modes, and links to exact code in this repository.
