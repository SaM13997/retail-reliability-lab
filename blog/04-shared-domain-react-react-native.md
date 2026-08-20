---
title: "One Domain, Two Interfaces: Sharing Behavior Between React and React Native"
description: "Share validated vocabulary and pure decisions across web and mobile; let each platform own interaction, layout, and accessibility details."
series: "Reliability Frontend Notes"
part: 4
date: 2026-08-19
tags: [typescript, react, react-native, domain-modeling, testing, accessibility]
---

# One Domain, Two Interfaces: Sharing Behavior Between React and React Native

**Thesis:** The most durable web/mobile sharing boundary is domain behavior: validated inputs, deterministic calculations, state transitions, and fixtures. Sharing screens to maximize code reuse usually couples two platforms at exactly the point where their interaction and accessibility needs diverge.

For this project, the Operator Console supports an operator reviewing fleet health and incidents; the Store POS supports a person completing an in-store sale on a touch device. Both need to agree on money, cart totals, store-health safety, inventory risk, and payment/event vocabulary. They should not be forced into the same table, focus behavior, component library, or navigation model.

## Draw the boundary by responsibility

```text
packages/domain                  apps/operator-console              apps/store-pos
-----------------                ---------------------              -------------
runtime schemas  ----------->    web fetch/cache adapter             native fetch/cache adapter
pure policies    ----------->    MUI table, keyboard workflow         Expo views, touch workflow
state transitions ---------->    desktop announcements                 native accessibility labels
fixtures/tests   ----------->    browser component/E2E tests           native component/unit tests
```

The source package lives in [`packages/domain/src/`](../packages/domain/src/). Its two consumers are the [`Operator Console`](../apps/operator-console/src/) and the [`Store POS`](../apps/store-pos/src/); each keeps rendering and platform APIs inside its own app boundary.

A simple rule prevents architecture drift:

> A module belongs in `packages/domain` only if it can be exercised in a plain TypeScript process with no React, browser, Expo, storage, clock, network, or UI-library dependency.

Pass volatile dependencies as arguments. That makes business policy deterministic and easy to test.

## Validate at the boundary, then use precise types

TypeScript types vanish at runtime. Network payloads, QR scans, local persistence, and event streams therefore need runtime validation before domain code relies on them.

```ts
// packages/domain/src/checkout.ts
import { z } from "zod";

export const CartLineSchema = z.object({
  productId: z.string().min(1),
  unitPriceCents: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
});

export const CheckoutInputSchema = z.object({
  storeId: z.string().min(1),
  lines: z.array(CartLineSchema).min(1),
  storeHealth: z.enum(["safe", "unsafe", "unknown"]),
  deviceConnected: z.boolean(),
});

export type CheckoutInput = z.infer<typeof CheckoutInputSchema>;

export function cartTotalCents(lines: readonly CheckoutInput["lines"][number][]): number {
  return lines.reduce((total, line) => total + line.unitPriceCents * line.quantity, 0);
}
```

Use integer minor units for money. Floating-point UI values such as `0.1 + 0.2` are not a safe accounting representation, and locale-specific formatting belongs at the presentation edge:

```ts
export function formatMoney(cents: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}
```

The exact validator need not be Zod; the important contract is that untrusted data becomes a validated domain value at the boundary, with a clear error path. Do not put React hooks or translated error strings inside schemas—those turn a portable rule into a platform dependency.

## Return decision objects, not bare booleans

A boolean answers whether checkout is allowed but not how each UI should explain the answer. Return a stable reason code and let the platform choose copy, layout, focus, and recovery controls.

```ts
export type CheckoutGuard =
  | { allowed: true }
  | { allowed: false; reason: "empty-cart" | "store-unsafe" | "device-offline" };

export function evaluateCheckout(input: CheckoutInput): CheckoutGuard {
  if (input.lines.length === 0) return { allowed: false, reason: "empty-cart" };
  if (input.storeHealth !== "safe") return { allowed: false, reason: "store-unsafe" };
  if (!input.deviceConnected) return { allowed: false, reason: "device-offline" };
  return { allowed: true };
}
```

On the web, the console might render a compact inline explanation. On the POS, it might render a large persistent status panel and a retry connection control:

```tsx
// React web: platform-owned presentation
const guard = evaluateCheckout(input);
<Button disabled={!guard.allowed} aria-describedby="checkout-reason">Checkout</Button>
<span id="checkout-reason">{guard.allowed ? "" : webMessage(guard.reason)}</span>
```

```tsx
// React Native: different interaction and accessible semantics
const guard = evaluateCheckout(input);
<Pressable disabled={!guard.allowed} accessibilityState={{ disabled: !guard.allowed }}>
  <Text>Checkout</Text>
</Pressable>
{!guard.allowed && <Text accessibilityLiveRegion="polite">{nativeMessage(guard.reason)}</Text>}
```

Both call the same safety rule; neither shares a visual abstraction that would compromise tap target, safe-area, typography, pointer/keyboard behavior, or platform conventions.

## Model payment and offline recovery as a state machine

Payment is not a boolean, and mobile connectivity makes that explicit. Model states and legal transitions in the domain package so the web demo, POS, and tests agree on what can happen.

```text
idle -> processing -> approved -> queued-for-sync -> synced
                   |       |             |
                   |       +-> sync-failed -> queued-for-sync
                   +-> declined
                   +-> timed-out -> retrying -> processing
```

```ts
export type PaymentState =
  | { kind: "idle" }
  | { kind: "processing"; attempt: number }
  | { kind: "approved"; receiptId: string }
  | { kind: "declined"; reason: string }
  | { kind: "timed-out"; attempt: number }
  | { kind: "queued-for-sync"; saleId: string }
  | { kind: "synced"; saleId: string };

export function transitionPayment(state: PaymentState, event: PaymentEvent): PaymentState {
  // Exhaustive switch: reject impossible transitions rather than inventing UI behavior.
  // Implementation is intentionally pure and receives no network or navigation objects.
  return reducePaymentState(state, event);
}
```

The UI should not silently convert `approved` into `synced`. Approval means payment succeeded; syncing means a completed-sale record reached the service. Separating them lets the POS truthfully show an offline queue and retry recovery, while preventing duplicate completion by using a durable sale ID/idempotency key at the API boundary.

The payment event contract currently lives in [`packages/domain/src/index.ts`](../packages/domain/src/index.ts). Splitting it into a payment-specific module would be reasonable as the package grows; do not create a generic `utils.ts` dumping ground.

## Keep effects in adapters, not rules

A portable domain function should not know whether data came from TanStack Query, `fetch`, Expo SecureStore, AsyncStorage, a barcode scanner, or a mock service worker. Build adapters in each app:

```ts
// apps/store-pos/src/domain.ts — platform adapter around shared rules
export async function submitSale(input: CheckoutInput): Promise<PaymentState> {
  const guard = evaluateCheckout(input);
  if (!guard.allowed) throw new CheckoutBlockedError(guard.reason);

  const sale = makeSale(input); // pure domain construction
  try {
    return await paymentApi.charge(sale); // platform/app boundary
  } catch (error) {
    if (isOffline(error)) {
      await localSaleQueue.enqueue(sale); // native persistence boundary
      return { kind: "queued-for-sync", saleId: sale.id };
    }
    throw error;
  }
}
```

The console can use a different adapter to assign incidents or display inventory risk without importing native persistence. Conversely, the POS can use TanStack Query where server-state caching helps, without moving its UI state or touch interaction into the shared package.

## Share fixtures as contracts, not screens

Deterministic fixtures allow web and native tests to assert the same policy cases:

```ts
export const unsafeStoreFixture = {
  id: "store-unsafe",
  health: "unsafe",
  deviceConnected: true,
} as const;

it("blocks checkout for unsafe stores", () => {
  const result = evaluateCheckout({
    storeId: unsafeStoreFixture.id,
    lines: [{ productId: "p-1", unitPriceCents: 350, quantity: 1 }],
    storeHealth: unsafeStoreFixture.health,
    deviceConnected: unsafeStoreFixture.deviceConnected,
  });
  expect(result).toEqual({ allowed: false, reason: "store-unsafe" });
});
```

The fixture generator and checkout rules live in [`packages/domain/src/index.ts`](../packages/domain/src/index.ts), with edge cases in [`packages/domain/test/domain.test.ts`](../packages/domain/test/domain.test.ts). Fixtures should name the business condition they represent (`timedOutPayment`, `lowStockStore`), not the UI screen that happened to first use them.

Do not share component snapshots across platforms as a proxy for behavioral testing. Test pure domain transitions in the package; test web keyboard/error semantics in the Operator Console; test POS tap targets, labels, and recovery copy in Expo/React Native. The overlap is intentional, but the tools and assertions differ.

## Tradeoffs and failure modes

### Useful duplication beats leaky abstraction

Two platform-specific message maps duplicate a small amount of copy selection, but they permit different language length, layout, and action affordances. A shared `CheckoutButton` that branches on `Platform.OS` usually creates a third, harder-to-test UI rather than a reusable domain rule.

### Versioning and package boundaries matter

A shared package can slow both apps if every change is a breaking API. Export narrow public functions and types; keep internals unexported. Ensure the monorepo package build and TypeScript module resolution work for Expo web as well as the browser app. Do not assume Node-only APIs, DOM globals, or native modules are available everywhere.

### Time and randomness can corrupt determinism

Accept a clock or seed as input to fixtures/rules. A domain function that calls `Date.now()` or `Math.random()` makes edge cases flaky and makes web/mobile disagreement hard to reproduce.

### Errors must remain actionable

Reason codes are a contract. Adding an `unknown` reason without handling it in either UI produces a vague “something went wrong” message where a POS operator needs a safe next step. Exhaustive TypeScript switches and focused tests catch this early.

### Accessibility is platform-specific at the edge

Semantic HTML, focus management, and keyboard shortcuts are web responsibilities. React Native needs roles, labels, state, announcements, and comfortably sized targets. Shared domain data can carry a reason code; it should not dictate an `aria-*` attribute or a native accessibility prop.

## Practical checklist

- [ ] Put only runtime-validated types, pure calculations, policies, transitions, and deterministic fixtures in `packages/domain`.
- [ ] Keep React, React Native, browser, Expo, network, storage, and translation imports out of domain modules.
- [ ] Represent money in integer minor units and format at the UI edge.
- [ ] Return typed decision/reason objects so each platform can explain and recover appropriately.
- [ ] Make payment approval, local queueing, synchronization, failure, and retry distinct states.
- [ ] Give completed sales durable IDs and use idempotent API semantics for retry paths.
- [ ] Test domain edge cases once in plain TypeScript; test each platform’s interaction and accessibility separately.
- [ ] Prefer small platform-specific duplication over a shared UI component with conditional platform behavior.
- [ ] Verify package resolution and web export without assuming platform globals.

This boundary completes the series: trustworthy interfaces ([part 1](./01-trustworthy-realtime-operational-uis.md)) depend on coherent server state ([part 2](./02-events-and-tanstack-query.md)), evidence-led performance work ([part 3](./03-debugging-react-performance-and-memory.md)), and behavior that both applications can agree on without pretending their UIs are the same.
