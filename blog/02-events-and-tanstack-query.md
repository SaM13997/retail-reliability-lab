---
title: "Events Are Not a Cache: Reconciling Streams with TanStack Query"
description: "Use events to target, patch, or invalidate server state; do not mistake socket traffic for an authoritative client database."
series: "Reliability Frontend Notes"
part: 2
date: 2026-08-19
tags: [react, typescript, tanstack-query, server-state, real-time]
---

# Events Are Not a Cache: Reconciling Streams with TanStack Query

**Thesis:** TanStack Query should remain the client’s coherent view of server state. Events are evidence that something changed; they are not, by themselves, a replacement for query keys, fetching rules, mutations, or reconciliation.

That distinction prevents a familiar failure: the socket updates a detail panel while the table, count, and derived risk summary remain quietly old. The system looked live because one widget moved. It was inconsistent because there was no cache strategy.

## Separate responsibilities before choosing an API

```text
HTTP snapshot                 event stream                 mutation response
     |                              |                              |
     v                              v                              v
Query function ---------> Query cache <--------- setQueryData / invalidate
                                  |
                                  v
                         React components render
```

- A **query function** obtains a recoverable snapshot and has an explicit loading/error contract.
- An **event** identifies an entity change, possibly carries a safe partial patch, and needs dedupe/reconnect handling.
- A **mutation response** is the strongest immediate evidence for a user-initiated change, but still must agree with later server snapshots.

The intended hook boundary is **expected from a parallel lane:** [`apps/operator-console/src/features/stores/queries.ts`](../apps/operator-console/src/features/stores/queries.ts). The exact file is not yet present in this writing checkout; the link records the intended repository path rather than claiming a completed implementation.

## Give cache keys a vocabulary

Avoid stringly-typed keys scattered across handlers. A small key factory makes targeted invalidation discoverable:

```ts
export const storeKeys = {
  all: ["stores"] as const,
  lists: () => [...storeKeys.all, "list"] as const,
  list: (filters: StoreFilters) => [...storeKeys.lists(), filters] as const,
  details: () => [...storeKeys.all, "detail"] as const,
  detail: (storeId: string) => [...storeKeys.details(), storeId] as const,
  inventory: (storeId: string) => [...storeKeys.detail(storeId), "inventory"] as const,
};

export function useStore(storeId: string) {
  return useQuery({
    queryKey: storeKeys.detail(storeId),
    queryFn: () => api.getStore(storeId),
    staleTime: 30_000,
  });
}
```

A key should describe the data identity, not the component that currently needs it. If the inventory list is scoped by store, sort order, and filter, all three belong in the query identity or in a clearly documented server-side policy. Accidentally sharing `['inventory']` between two stores is a correctness bug with an innocent-looking type signature.

## Choose among patching, invalidating, and refetching

There is no universal “real-time update” method. Choose based on the event’s completeness and the cost of being wrong.

| Event situation | Preferred response | Why |
| --- | --- | --- |
| A new transaction has all fields required by the visible feed | Patch that narrow, ordered feed after dedupe | Immediate and bounded |
| A store-health event has only an ID and sequence | Invalidate that store’s detail and dependent summaries | Server remains authoritative |
| Inventory count changed but filtering/sorting/risk are server-derived | Invalidate relevant list(s) | A local patch can violate server rules |
| Reconnect after an unknown gap | Refetch from a cursor or invalidate affected keys | Repairs loss and reordering |

A conservative handler may be only a few lines:

```ts
function onStoreEvent(event: StoreEvent, queryClient: QueryClient) {
  if (event.type === "store.health.changed") {
    queryClient.invalidateQueries({ queryKey: storeKeys.detail(event.storeId) });
    queryClient.invalidateQueries({ queryKey: storeKeys.lists() });
  }
}
```

This is often better than a clever patch. It asks the server to reapply permissions, joins, risk thresholds, and any business rules not contained in an event payload. The tradeoff is extra request volume and a short interval before a background refetch resolves. If that interval affects a risky workflow, disable or label the action based on the event’s known state until reconciliation completes.

## Patch only with an explicit merge contract

When a feed event truly contains a complete item, patch immutably and idempotently. Use an event ID, not object equality, for dedupe.

```ts
type TransactionPage = { items: Transaction[]; nextCursor?: string };

function prependTransaction(old: TransactionPage | undefined, tx: Transaction): TransactionPage | undefined {
  if (!old || old.items.some((item) => item.id === tx.id)) return old;
  return { ...old, items: [tx, ...old.items] };
}

function onTransactionCreated(event: TransactionCreated, client: QueryClient) {
  client.setQueryData<TransactionPage>(
    ["transactions", "feed", { storeId: event.storeId }],
    (old) => prependTransaction(old, event.transaction),
  );
}
```

This example intentionally does not patch every filtered page. A transaction’s membership can depend on a time range, search term, authorization scope, or server-calculated flag. Prefer invalidation if the membership rule is not fully available and tested on the client.

## Connect streams at the application boundary

A socket in every row or detail component creates duplicated subscriptions and inconsistent cleanup. Subscribe once per authenticated application session or feature scope, then route typed events to cache operations.

```tsx
function RealtimeBridge({ children }: React.PropsWithChildren) {
  const client = useQueryClient();

  useEffect(() => {
    const stream = openEventStream({
      onEvent: (event) => routeEvent(event, client),
      onGap: () => client.invalidateQueries({ queryKey: storeKeys.all }),
    });
    return () => stream.close();
  }, [client]);

  return children;
}
```

The expected implementation anchor is **expected from a parallel lane:** [`apps/operator-console/src/app/RealtimeBridge.tsx`](../apps/operator-console/src/app/RealtimeBridge.tsx). It should own subscription lifetime, while feature modules own their query key and event-reconciliation policies.

Be careful with development Strict Mode: effects may mount, clean up, and mount again to surface unsafe side effects. A bridge must close its first connection correctly, and a server must tolerate reconnects. Hiding Strict Mode merely hides lifecycle defects.

## Optimistic mutations need three phases

Assignment of an incident shows why server state and events must cooperate:

```text
cache(previous) -- onMutate --> optimistic cache
      ^                               |
      | onError                       | onSuccess / matching event
      +---------- restore ------------+----> authoritative cache
```

```ts
const assignIncident = useMutation({
  mutationFn: api.assignIncident,
  async onMutate({ incidentId, assigneeId }) {
    await client.cancelQueries({ queryKey: incidentKeys.detail(incidentId) });
    const previous = client.getQueryData<Incident>(incidentKeys.detail(incidentId));
    client.setQueryData<Incident>(incidentKeys.detail(incidentId), (old) =>
      old ? { ...old, assigneeId, assignment: "pending" } : old,
    );
    return { previous };
  },
  onError(_error, { incidentId }, context) {
    client.setQueryData(incidentKeys.detail(incidentId), context?.previous);
  },
  onSettled(_data, _error, { incidentId }) {
    client.invalidateQueries({ queryKey: incidentKeys.detail(incidentId) });
  },
});
```

`onSettled` is not wasted work. It reconciles server-side effects that the mutation response or event may omit. For example, assigning an incident can change queue ordering, SLA status, permissions, or aggregate counts.

A visible pending label and a failure announcement are part of the data design. If the UI reverts without explanation, the operator cannot distinguish rejection from a disconnected stream. Keep focus predictable; do not steal it to a toast, but make errors reachable via an alert region or inline summary.

## Reconnect is a correctness path, not an edge case

A live stream can reconnect after the laptop sleeps, the gateway deploys, or a network changes. Design the protocol and UI around a sequence/cursor:

```ts
type EventEnvelope<T> = {
  id: string;
  sequence: number;
  occurredAt: string;
  payload: T;
};

async function recoverFrom(lastSequence: number) {
  const result = await api.eventsSince({ after: lastSequence });
  for (const event of result.events) routeEvent(event, queryClient);
  if (result.resetRequired) {
    await queryClient.invalidateQueries({ queryKey: storeKeys.all });
  }
}
```

If the backend cannot provide a cursor, full invalidation after reconnect is safer than pretending continuity. Show a compact “Reconnected; refreshing data” status that does not spam assistive technology. Avoid announcing every transaction; announce changes in grouped, user-controlled summaries.

## Failure modes to test deliberately

1. **Event before initial query:** a cache patch may be overwritten by an older fetch response. Cancel/refetch carefully, use sequence-aware data where possible, or invalidate after the initial query settles.
2. **Same mutation response and event:** idempotent upserts prevent duplicate feed rows.
3. **Out-of-order health events:** reject or refetch when an event sequence is older than the cached entity’s known sequence.
4. **Filtered query explosion:** a broad invalidation after every event can make an active dashboard thrash. Batch invalidations or target affected keys, then measure with realistic fixture volume.
5. **Unauthorized cached data:** scope query keys and clear/reset the cache when the access context changes.
6. **Offline optimistic edits:** do not imply completion. Persist a queue only with explicit conflict and retry semantics; otherwise keep the action pending in the session and explain its state.

The event contract itself belongs in the shared domain package: **expected from a parallel lane:** [`packages/domain/src/events.ts`](../packages/domain/src/events.ts). Fixtures should exercise duplicates, gaps, and reorderings, not just the happy path: **expected from a parallel lane:** [`packages/domain/src/fixtures.ts`](../packages/domain/src/fixtures.ts).

## Practical checklist

- [ ] Define stable, typed query keys by data identity.
- [ ] Document whether each event patches, invalidates, or triggers a refetch—and why.
- [ ] Patch only payloads complete enough to preserve all client invariants.
- [ ] Dedupe immutable event IDs and account for ordering or cursors.
- [ ] Centralize stream lifecycle; clean it up correctly under Strict Mode.
- [ ] Roll back optimistic cache changes, then reconcile on settlement.
- [ ] Re-fetch after unknown gaps and make refresh state understandable.
- [ ] Test initial-load races, duplicate events, rejected mutations, filters, reconnects, and access changes.

Next: a correct cache can still feel broken if rendering and memory behavior are guessed at rather than investigated—[debug React performance and memory methodically](./03-debugging-react-performance-and-memory.md).
