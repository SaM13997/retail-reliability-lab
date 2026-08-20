---
title: "Trust Is a UI State: Designing Real-Time Operational Interfaces"
description: "Real-time operator software earns trust by exposing freshness, uncertainty, and safe actions—not by making every number move."
series: "Reliability Frontend Notes"
part: 1
date: 2026-08-19
tags: [react, typescript, real-time, accessibility, product-design]
---

# Trust Is a UI State: Designing Real-Time Operational Interfaces

**Thesis:** A real-time operational UI is trustworthy when an operator can answer three questions at a glance: *what is happening, how current is this information, and what will my action change?* Animation and frequent updates do not answer those questions; explicit state modeling does.

Consider a console for unattended retail locations. A store can be healthy, unreachable, still reporting but stale, or currently receiving a delayed event backlog. Collapsing those conditions into a green/red dot turns uncertainty into false confidence. The useful design unit is not a status badge. It is an observable claim with provenance, time, and an action policy.

## Start with an operational state model

A compact model distinguishes domain health from transport freshness and user intent:

```text
                    event received
  unknown ---------------------------------> evaluating
     ^                                         |
     | initial load fails                      | health rule passes
     |                                         v
  unavailable <--- heartbeat timeout --- healthy
       |                                      |
       +---------- manual retry --------------+

  healthy -- age > stale threshold --> stale -- age > offline threshold --> unavailable
```

The arrows matter more than the colors. `stale` is not a softer spelling of `unavailable`: it means the last known value remains useful, but is no longer safe to treat as current. A user should be able to inspect it, while automation and high-impact actions use a stricter guard.

The shared package is the right home for deterministic classification. **Expected from a parallel lane:** [`packages/domain/src/storeHealth.ts`](../packages/domain/src/storeHealth.ts) and its focused tests at [`packages/domain/src/storeHealth.test.ts`](../packages/domain/src/storeHealth.test.ts).

```ts
export type Freshness = "current" | "stale" | "offline";

export function freshnessFor(
  lastObservedAt: number,
  now: number,
  staleAfterMs: number,
  offlineAfterMs: number,
): Freshness {
  const age = Math.max(0, now - lastObservedAt);
  if (age >= offlineAfterMs) return "offline";
  if (age >= staleAfterMs) return "stale";
  return "current";
}

export function canStartCheckout(input: {
  deviceConnected: boolean;
  freshness: Freshness;
  paymentTerminalReady: boolean;
}): boolean {
  return input.deviceConnected
    && input.freshness === "current"
    && input.paymentTerminalReady;
}
```

The `Math.max` is intentional: client clocks can be wrong and an event timestamp can be ahead of the browser. The UI should show a clock anomaly as diagnostic information rather than turning a negative age into evidence of freshness.

## Render facts and uncertainty separately

In a fleet row, show the last observed status as a fact and freshness as a qualifier:

```tsx
function StoreHealthCell({ store, now }: { store: Store; now: number }) {
  const freshness = freshnessFor(store.lastSeenAt, now, 60_000, 300_000);
  const copy = {
    current: "Reporting live",
    stale: `Last report ${formatAge(now - store.lastSeenAt)} ago`,
    offline: `No report for ${formatAge(now - store.lastSeenAt)}`,
  }[freshness];

  return (
    <Stack spacing={0.5}>
      <StatusChip health={store.health} />
      <Typography variant="caption" color={freshness === "current" ? "text.secondary" : "warning.main"}>
        {copy}
      </Typography>
    </Stack>
  );
}
```

A visual chip must not be the only carrier of meaning. Use visible text, a programmatic label, and a high-contrast non-color cue such as an icon or pattern. If a screen reader user encounters “Warning” without the observed time or recommended next step, the status has not been communicated.

For action controls, put the reason for a block next to the action—not in a tooltip that keyboard and touch users may never discover:

```tsx
<Button disabled={!canStartCheckout(guard)} aria-describedby="checkout-guard">
  Start checkout
</Button>
<Typography id="checkout-guard" role="status">
  {guard.freshness !== "current"
    ? "Checkout is unavailable until the store sends a current health report."
    : ""}
</Typography>
```

## Treat the event feed as a reviewable timeline

A fast transaction feed needs two intentional modes. In **live** mode, incoming items append and a polite live region announces a bounded summary. In **paused** mode, the visible list is stable while new items accumulate in a non-disruptive counter. Auto-moving rows under a pointer, keyboard focus, or screen-reader virtual cursor is a product defect, even if the socket is correct.

```text
               pause                         resume
  LIVE --------------------> PAUSED --------------------> LIVE
   |                         |  ^                         |
   | event                   |  | event                   | event
   v                         v  |                         v
 append visible          increment pending            append batch
```

A reducer makes that behavior testable without involving the transport:

```ts
type FeedState = { mode: "live" | "paused"; visible: TxEvent[]; pending: TxEvent[] };

type FeedAction =
  | { type: "event"; event: TxEvent }
  | { type: "pause" }
  | { type: "resume" };

export function reduceFeed(state: FeedState, action: FeedAction): FeedState {
  if (action.type === "pause") return { ...state, mode: "paused" };
  if (action.type === "event") {
    return state.mode === "live"
      ? { ...state, visible: [action.event, ...state.visible] }
      : { ...state, pending: [action.event, ...state.pending] };
  }
  return { mode: "live", visible: [...state.pending, ...state.visible], pending: [] };
}
```

The intended console seam is **expected from a parallel lane:** [`apps/operator-console/src/features/transactions/TransactionFeed.tsx`](../apps/operator-console/src/features/transactions/TransactionFeed.tsx). Its event reducer can live beside it or in a testable module; the crucial point is that a paused human review is a state, not a CSS freeze.

## Make optimistic actions honest

Incident assignment is a common place to overpromise. The card should immediately show “Assigning to Sam…” and remain clear about whether the server has confirmed it. On rejection, restore the prior owner, focus an error summary, and preserve the operator’s input. Do not silently flip it back and hope the user notices.

```text
unassigned -- click assign --> pending(Sam) -- server confirms --> assigned(Sam)
       ^                         |
       +---- server rejects ------+  (announce why; restore previous state)
```

There is a tradeoff. Optimism reduces perceived latency and keeps a queue flowing, but it requires an error vocabulary: conflict, permission denied, validation error, and offline. If the product cannot explain or recover from those outcomes, a confirmed-only interaction is safer.

## Failure modes worth designing before the demo

- **Duplicate or reordered events:** deduplicate by immutable event ID and compare a monotonic source sequence when available. Arrival order is not domain truth.
- **The tab was asleep:** reconnect from a cursor, then invalidate or refetch the affected query. A “connected” socket does not prove missed events were repaired.
- **A simulation looks like live data:** display deterministic-demo/live-simulation mode in the UI. Reviewers should never have to infer whether movement is generated.
- **A filter hides the urgent item:** preserve a visible “N incidents outside this view” affordance rather than treating filtering as deletion.
- **A stale summary triggers a risky action:** use current freshness in the guard, not just a stale row value that happened to render.

## Product decisions that deserve words

“Offline” can mean a network failure, a powered-off device, or an unknown observation. Those have different operators and remedies. The product language should say what the system knows: “No device report since 10:42,” not “Device is broken.” Similarly, a low-stock indicator should expose its threshold, observed count, and observation time so an operator can decide whether to dispatch someone.

Virtualization is usually appropriate for broad inventory and transaction views, but it changes find-in-page, screen-reader traversal, and focus restoration. Offer precise filtering, a result count, and stable row identity; test keyboard movement across virtualized boundaries. For a short incident queue, a simple fully rendered list may be the more reliable choice.

## Implementation checklist

- [ ] Model `current`, `stale`, and `offline` independently from business health.
- [ ] Display observation time and source uncertainty wherever a status drives a decision.
- [ ] Give blocked actions a visible, accessible reason and a recovery path.
- [ ] Pause live feeds without moving the reviewer’s current content or focus.
- [ ] Make optimistic mutations pending, reversible, and announced on failure.
- [ ] Dedupe event IDs; repair missed history on reconnect.
- [ ] Label deterministic and live simulation modes explicitly.
- [ ] Test keyboard, reduced-motion, contrast, error, empty, offline, and stale states.

Next: [events become useful only when they are reconciled with server state](./02-events-and-tanstack-query.md).
