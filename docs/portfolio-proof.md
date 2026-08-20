# Portfolio proof map

This repository is an independent, generated-data demonstration—not a production system or evidence of work for an employer. The links below identify inspectable source rather than implying user counts, production scale, or measured performance.

| Job-relevant skill | Evidence in this repository | Related public work |
| --- | --- | --- |
| React + TypeScript ownership | [`apps/operator-console`](../apps/operator-console) and its production build/tests | [`collectr`](https://github.com/SaM13997/collectr) and [`concave-cms`](https://github.com/SaM13997/concave-cms) are larger React/TanStack projects. |
| Operational product UI | Fleet health, inventory triage, incidents, transaction feed, store details, async/error/stale copy in [`App.tsx`](../apps/operator-console/src/App.tsx) | [`saas-dashboard`](https://github.com/SaM13997/saas-dashboard) is an earlier dashboard-oriented project. |
| React Native / Expo | Checkout, device guards, deterministic payment outcomes, responsive web export, accessible React Native controls in [`apps/store-pos`](../apps/store-pos) | This repository is the clearest focused Expo sample. |
| Shared domain modelling | Zod contracts and pure money, inventory, health, checkout, payment, queue, and fixture rules in [`packages/domain`](../packages/domain) | Both demo apps consume this package through workspace dependencies. |
| Server state and API boundaries | TanStack Query around typed generated-data adapters; TanStack Table for inventory state | [`auto-api-refresh-demo`](https://github.com/SaM13997/auto-api-refresh-demo) is a smaller API-refresh experiment. |
| Resilience and real-time reasoning | Deterministic live feed, pause/stale signals, optimistic rollback, payment timeout/retry, persisted offline sale IDs | [`docs/architecture.md`](architecture.md) states what is simulated and what production would add. |
| Testing and CI | 13 unit/component tests, 2 Cypress workflows, typecheck, Biome lint, two production web builds, GitHub Actions | [`docs/verification.md`](verification.md) distinguishes automated from manual evidence. |
| Technical communication | Four linked engineering articles in [`blog/`](../blog) | Posts separate demonstrated code from broader production recommendations. |

## Evaluation order

1. Run the commands in [`docs/review-guide.md`](review-guide.md).
2. Inspect the shared rules before the UI adapters.
3. Exercise both failure and recovery paths, not only the happy path.
4. Read the architecture boundaries and one article relevant to the role.
5. Treat all metrics as unmeasured unless a reproducible trace is attached.
