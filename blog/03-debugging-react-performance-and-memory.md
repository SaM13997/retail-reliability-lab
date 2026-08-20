---
title: "Measure Before You Memoize: Debugging React Performance and Memory"
description: "A repeatable investigation separates slow renders, slow work, network churn, and retained objects before choosing a fix."
series: "Reliability Frontend Notes"
part: 3
date: 2026-08-19
tags: [react, typescript, performance, memory, debugging, accessibility]
---

# Measure Before You Memoize: Debugging React Performance and Memory

**Thesis:** “React is slow” is not a diagnosis. A defensible fix starts by reproducing one user-visible symptom, classifying the work, collecting evidence, and proving that the proposed change removes the actual bottleneck without breaking behavior.

Operational screens make this discipline visible. A large inventory table can jank because it renders too much, because it recomputes filtering, because a stream invalidates every query, because images decode, or because a browser extension is noisy. A growing memory graph may be a real retained subscription, an intentional cache, or a development-tool artifact. `useMemo` is not a universal antidote to any of those.

This post describes a method, not measured results. No performance figures are claimed for this independent demo.

## Establish the symptom and a controlled scenario

Write a small reproduction card before opening a profiler:

```text
Screen: inventory triage
Action: type "oat" into product filter while updates arrive
Expected: input remains responsive; focused row does not move
Observed: [record from a reproducible run]
Data shape: deterministic fixture set; browser/device/build recorded
```

Use deterministic demo fixtures when comparing runs. A live simulation toggle is valuable for product review, but its timing makes a poor baseline. The intended fixture source is **expected from a parallel lane:** [`packages/domain/src/fixtures.ts`](../packages/domain/src/fixtures.ts).

Then classify the candidate work:

```text
Interaction -> event handler -> state update -> render -> commit -> browser paint
                   |               |             |
                   |               |             +-- too many / too expensive components?
                   |               +-- broad invalidation or derived computation?
                   +-- synchronous parsing, sorting, logging, layout read?

Memory concern -> allocation -> reachability -> garbage collection
                                      |
                                      +-- listener, timer, closure, cache, DOM node, async task?
```

The classification keeps you from optimizing the wrong layer. A long network request is not a render problem; a list that reorders during typing can be a product problem even when CPU time is low.

## A methodical investigation loop

1. **Reproduce** one scenario with route, filters, fixture mode, and steps written down.
2. **Observe** a baseline in the appropriate browser tooling: Performance panel for interaction/long tasks; React Profiler for component commits; Memory panel for retained objects; Network panel for request churn.
3. **Form a narrow hypothesis.** Example: “The feed invalidates all inventory queries per event, causing rows outside the affected store to render.”
4. **Change one variable** in a small, reversible patch.
5. **Re-run the same scenario** and verify the relevant trace, UI semantics, tests, and accessibility behavior.
6. **Keep, refine, or revert** based on evidence. Record the reasoning in the PR or architecture notes; not every helpful result needs a number.

React DevTools tells you which components committed and why. Browser performance traces tell you about scripting, style/layout, paint, and long tasks. Heap snapshots compare object retainers across forced-GC checkpoints. None of them alone proves a root cause.

## Rendering: stabilize boundaries before memoizing leaves

A common anti-pattern is to wrap every cell in `memo` while the parent creates new callbacks, object props, and arrays every render. Start by placing a meaningful render boundary around a unit that is naturally independent, such as an inventory row.

```tsx
type InventoryRowProps = {
  item: InventoryItem;
  selected: boolean;
  onInspect: (id: string) => void;
};

const InventoryRow = React.memo(function InventoryRow({ item, selected, onInspect }: InventoryRowProps) {
  return (
    <TableRow aria-selected={selected}>
      <TableCell>{item.productName}</TableCell>
      <TableCell>{formatQuantity(item.quantity)}</TableCell>
      <TableCell>
        <Button onClick={() => onInspect(item.id)}>Inspect</Button>
      </TableCell>
    </TableRow>
  );
});

function InventoryTable({ items }: { items: InventoryItem[] }) {
  const inspect = useCallback((id: string) => openInspection(id), []);
  return items.map((item) => <InventoryRow key={item.id} item={item} selected={false} onInspect={inspect} />);
}
```

This only helps if `item` identity stays stable for unchanged rows and `inspect` is not semantically stale. Do not use `useCallback` merely to satisfy a memoization pattern: a callback that captures changing state either changes identity or risks reading the wrong value. A reducer, an event argument, or a smaller component boundary can be clearer.

For expensive derived data, measure and then cache a pure computation whose inputs are stable:

```ts
const visibleItems = useMemo(
  () => applyInventoryFilters(items, filters),
  [items, filters],
);
```

Do not put `Date.now()` or mutation in `applyInventoryFilters`; that makes memoization hide changing semantics. Consider server-side filtering/pagination when the full collection is not necessary for the current decision.

The intended inventory surface is **expected from a parallel lane:** [`apps/operator-console/src/features/inventory/InventoryTable.tsx`](../apps/operator-console/src/features/inventory/InventoryTable.tsx). It should pair list scale decisions with keyboard and focus tests rather than treating virtualization as a drop-in performance checkbox.

## Virtualization changes interaction requirements

Virtualization reduces mounted rows, not the cost of every operation. It can break native find-in-page, screen-reader traversal expectations, row measurement, and focus when a filtered item disappears. A reliable implementation needs stable item keys, a deliberate overscan policy, an accessible result count, and a focus plan.

```text
filter changes -> selected row no longer matches
       |
       +-> retain focus on filter + announce result count
       +-> do not leave focus pointing at an unmounted row
```

For a short incident queue, rendering all rows may be safer and simpler. For a large transaction feed, virtualize only after the product requires it, and verify the pause/resume behavior from [part 1](./01-trustworthy-realtime-operational-uis.md).

## Find request churn before optimizing JSX

A UI that repeatedly refetches every table query after each event can feel slow even if each component is cheap. In the Network panel, correlate a user action or event with requests. In React Query Devtools (during development), inspect observers, stale state, and cache keys. The correct repair may be narrower invalidation, event batching, or an idempotent cache patch—not memoization.

```ts
// Too broad for high-frequency inventory events:
queryClient.invalidateQueries();

// Still validate the key choice against all dependent summaries:
queryClient.invalidateQueries({ queryKey: inventoryKeys.store(event.storeId) });
```

The reconciliation policy belongs close to the query key factory; see [part 2](./02-events-and-tanstack-query.md). A locally quick patch that leaves an aggregate count wrong is not an optimization.

## Diagnose memory by reachability, not a rising line

A leak is an object that remains reachable after its useful lifetime. Allocate, navigate away, force garbage collection if tooling permits, take a second heap snapshot, and inspect retaining paths. Repeat the scenario enough to distinguish warm caches from unbounded retention.

```tsx
function useTransactionStream(storeId: string, onEvent: (event: TxEvent) => void) {
  useEffect(() => {
    const subscription = subscribeToTransactions(storeId, onEvent);
    return () => subscription.unsubscribe();
  }, [storeId, onEvent]);
}
```

Failure modes to look for:

- A `setInterval` or animation frame continues after unmount.
- A global event emitter holds a listener closure referencing component state.
- A reconnect loop creates a new socket before closing the old one.
- A promise resolves after unmount and retains a large parsed payload in a closure.
- A query cache is configured with an inappropriate lifetime for unbounded live-feed pages.
- A module-level array grows with every event because no retention policy exists.

Avoid the misleading `let mounted = true` pattern as a cleanup substitute. It suppresses a state update but does not cancel fetches, timers, streams, or retained subscriptions. Use cancellation/cleanup mechanisms owned by the resource.

```ts
useEffect(() => {
  const controller = new AbortController();
  void loadDetails({ signal: controller.signal }).catch((error) => {
    if (error.name !== "AbortError") reportError(error);
  });
  return () => controller.abort();
}, [storeId]);
```

A cache is not automatically a leak. TanStack Query intentionally retains inactive data for a configured period. Decide the retention policy based on navigation behavior, data sensitivity, payload size, and offline needs; then test that policy instead of clearing caches indiscriminately.

## Avoid performance fixes that damage product quality

- **Debouncing a search:** it reduces work but can obscure whether results are still updating. Preserve typed text immediately, show pending state honestly, and do not delay validation that prevents a dangerous checkout.
- **Deferring state with `useTransition`:** it can prioritize input over an expensive result update. It does not make the underlying calculation cheaper, and screen-reader announcements must still describe settled results.
- **Removing live announcements:** it can reduce noise, but it can also hide critical state. Group routine updates and reserve assertive announcements for actionable failures.
- **Reducing images or motion:** respect `prefers-reduced-motion`; do not remove the only state cue just to cut paint work.

## Test the lifecycle that produced the bug

A profiler trace guides a regression test; it is not itself a test suite. Test observable contracts:

```tsx
it("closes the stream when the store view unmounts", () => {
  const unsubscribe = vi.fn();
  vi.mocked(subscribeToTransactions).mockReturnValue({ unsubscribe });

  const { unmount } = render(<StoreTransactions storeId="store-1" />);
  unmount();

  expect(unsubscribe).toHaveBeenCalledOnce();
});
```

The intended test location is **expected from a parallel lane:** [`apps/operator-console/src/features/transactions/TransactionFeed.test.tsx`](../apps/operator-console/src/features/transactions/TransactionFeed.test.tsx). Include keyboard navigation and live-region assertions where a rendering “fix” changes user feedback.

## Practical checklist

- [ ] Record a reproducible scenario and fixture/data shape before profiling.
- [ ] Use the tool that matches the symptom: React Profiler, browser performance trace, network view, or heap snapshots.
- [ ] Identify one hypothesis and alter one variable at a time.
- [ ] Check query invalidation and network churn before adding memoization.
- [ ] Memoize only stable, pure boundaries; preserve correct callback semantics.
- [ ] Treat virtualization as an accessibility and focus design project.
- [ ] Prove memory retention through a retaining path and resource cleanup.
- [ ] Re-run tests and verify loading, errors, keyboard behavior, and announcements after the change.
- [ ] Document evidence and tradeoffs without inventing benchmark numbers.

Next: performance and data consistency become easier to preserve when business behavior is pure and portable—[share domain behavior without sharing UI](./04-shared-domain-react-react-native.md).
