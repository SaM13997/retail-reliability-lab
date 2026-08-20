# Portfolio proof map

This repository is a planned, generated-data demonstration—not a production system and not evidence of work for any employer. Evidence below is either planned for this repository or limited to a linked public repository; links are not claims that a repository has been audited for every skill.

| Job-relevant skill | Planned evidence in this repository | Related public repository (limited claim) |
| --- | --- | --- |
| React and TypeScript application ownership | Operator Console and Store POS in separate app boundaries, with shared typed domain rules | [retail-reliability-lab](https://github.com/SaM13997/retail-reliability-lab) is the public repository for this demo. |
| Operational UI and product-quality states | Fleet, inventory, incidents, transaction feed; loading/empty/error/stale/offline/retry states documented and tested | [saas-dashboard](https://github.com/SaM13997/saas-dashboard) is a public dashboard-oriented project; assess its implementation directly. |
| React Native / Expo delivery | POS checkout flow, accessibility labels, large target guidance, and web export | [hermes-workspace-mobile](https://github.com/SaM13997/hermes-workspace-mobile) describes itself as a native web workspace; it is relevant context, not proof of this POS design. |
| Shared domain modelling | `packages/domain` owns validated inputs, money/cart/health rules, fixtures, and focused edge tests | This repository is the primary planned proof. No claim is made that another repository shares this exact model. |
| API boundaries and state management | Typed mock/simulation adapter; validated payloads; Query cache and event reconciliation rules | [auto-api-refresh-demo](https://github.com/SaM13997/auto-api-refresh-demo) is a public API-refresh demo; review its source for its actual scope. |
| Real-time and resilience thinking | Ordered event application, freshness state, pause/resume, optimistic rollback, idempotent offline queue | This repository is planned evidence only until the flows and tests exist. |
| Testing and CI | Domain tests, UI tests, Cypress smoke strategy, typechecks/builds/web export in Actions | [fullstack-assessment](https://github.com/SaM13997/fullstack-assessment) is a public assessment repository; no coverage or CI claim is inferred here. |
| Accessibility and performance discipline | Verification matrix requires keyboard, automated a11y, reproducible performance traces, and memory checks | This repository is planned evidence only; no production metrics will be claimed. |
| Tooling and developer workflow | npm workspace CI, issue/PR evidence templates, deterministic scripts | [hermes-agent](https://github.com/SaM13997/hermes-agent) is a public agent project; its repository should be evaluated independently. |

## How to evaluate this portfolio

1. Read the architecture and verification documents before treating a UI as evidence.
2. Use the CI run for the exact commit, then inspect the corresponding test/spec files.
3. Distinguish demonstrated behavior from planned behavior: a table entry becomes demonstrated only when linked source and passing evidence exist.
4. Treat external repositories as separate public work samples. Their presence here is navigation, not a transfer of ownership, scale, user count, production status, or performance claims.
