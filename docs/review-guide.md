# Reviewer guide

You can review both demos and their failure paths in about 15 minutes. All data and payment outcomes are generated locally.

## 1. Install and verify

Requirements: Node 20+ and npm 10+.

```sh
npm ci
npm run verify
npm run e2e
```

Expected evidence:

- TypeScript passes for all three workspaces.
- Biome reports no errors.
- 13 unit/component tests pass.
- Operator Console and Expo web exports complete.
- 2 Cypress smoke tests pass.

## 2. Review the Operator Console

```sh
npm run dev:console
```

Open the URL Vite prints, normally `http://localhost:5173`.

1. **Fleet health:** open a store’s **Details** dialog. Confirm status, stale signal copy, device health, inventory risk, keyboard focus, and close behavior.
2. **Inventory triage:** search for `water`, toggle **Low stock only**, and sort table columns. Confirm the empty state appears for a query with no match.
3. **Optimistic rollback:** assign **Payment terminal degraded**. The row updates optimistically, then a visible error explains that the deterministic server rejected it and restored the queue.
4. **Success path:** assign **Door sensor intermittent**. Confirm the success notice and assignee.
5. **Live mode:** enable **Live mode**, wait four seconds, then pause and resume the feed. Confirm the paused copy warns that events may be stale.
6. **Offline state:** in browser DevTools, set Network to **Offline** and reload. Confirm the retryable error. Restore Network to **Online**, then select **Retry data load**.
7. **Keyboard:** repeat the core flow using `Tab`, `Shift+Tab`, `Enter`, `Space`, and `Escape`. Focus must remain visible.

## 3. Review the Store POS

```sh
npm run dev:pos
```

Press `w` if Expo does not open the web target automatically.

1. **Catalog and cart:** search products, simulate barcode scans, change quantities, and confirm integer-cent totals.
2. **Checkout guards:** disable the scanner or payment terminal. Confirm checkout is disabled with a specific reason; restore the device.
3. **Decline and retry:** add an item, choose **decline**, start payment, then simulate the decline. Confirm retry is available and no sale completes.
4. **Timeout and retry:** repeat with **timeout**. Confirm the copy explains that retry is safe.
5. **Offline completion:** start an approved payment while online. While it is **Processing**, turn **Store connection** off, then select **Simulate approve**. Confirm the approved sale enters the offline queue.
6. **Persistence and recovery:** either restore **Store connection** or reload the page. Confirm the persisted queued sale receives a simulated sync acknowledgement and the recovery notice appears.
7. **Responsive/accessibility:** resize below 850 px. Panels should stack without horizontal clipping. Check large tap targets and repeat the main flow with the keyboard.

## 4. Inspect the engineering evidence

Recommended reading order:

1. [`packages/domain/src/index.ts`](../packages/domain/src/index.ts) — runtime contracts and shared pure rules.
2. [`apps/store-pos/src/domain.ts`](../apps/store-pos/src/domain.ts) — React Native adapter over shared rules.
3. [`apps/operator-console/src/App.tsx`](../apps/operator-console/src/App.tsx) — query, table, optimistic rollback, live simulator, and accessible workflows.
4. [`docs/architecture.md`](architecture.md) — boundaries and honest simulation limits.
5. [`blog/README.md`](../blog/README.md) — four linked engineering articles.

## Scope notes

- This is an independent portfolio lab, not a copy of an employer product.
- The live feed and sync acknowledgement are deterministic simulations.
- No external backend, payment provider, secret, or customer data is required.
- Performance is intentionally unclaimed until a reproducible trace is attached.
