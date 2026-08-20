# Verification matrix

This is the release evidence contract. A check is not complete because a control exists; it is complete only when its command, scenario, result, and artifact are recorded against the commit SHA.

| Area | Minimum coverage | Gate / evidence | Pass rule |
| --- | --- | --- | --- |
| Domain rules | Inventory thresholds, unsafe health, currency rounding, empty/invalid carts, checkout guard reasons, event ordering, fixture determinism | Focused unit tests in `packages/domain`; CI test output | Every named edge has a deterministic assertion; no UI dependency is imported. |
| Operator Console | Loading, empty, error/retry, stale, offline, table/filter behavior, incident optimistic success and rollback, live-feed pause/resume/detail | Vitest + Testing Library; Cypress smoke | Assertions use user-visible behavior and stable roles/labels, not implementation state. |
| Store POS | Scan/search, cart totals, unsafe checkout block, processing/approved/declined/timeout/retry, offline completion and recovery | Unit/component tests plus Expo web manual or automated smoke | A blocked checkout names the reason; queued sale persists through reload and leaves only after acknowledgement. |
| Accessibility | Keyboard order, visible focus, dialogs, semantic tables, errors/status changes, touch targets, reduced motion | Automated `axe` scan plus keyboard screen-reader-informed checklist | No critical/serious automated violation; keyboard workflow completes without pointer; status changes have appropriate announcement. |
| Performance | Initial console render, inventory interaction, event burst handling, POS list/cart responsiveness | DevTools/React Profiler trace with reproducible fixture seed | Record device/browser, throttle, seed, steps, metric, and before/after trace. Never claim production latency or universal thresholds. |
| Memory | Route/unmount cleanup, event subscription cleanup, timers, paused feed, repeated navigation | Browser heap comparison and subscription-count test where practical | Three repeatable cycles show no monotonically retained app-owned listeners/timers; attach snapshots or explain tool limits. |
| Offline/resilience | Offline banner, disabled unsafe paths, cached/queued state, reconnect retry, duplicate acknowledgement | Cypress network interception and/or deterministic simulator evidence | Network failure is intentional and visible; queue retains failed work; duplicate sync does not duplicate a sale. |
| Build/release | Typecheck, lint where configured, unit tests, production build/web export | GitHub Actions logs for the commit | All required jobs pass on a clean `npm ci`; no secrets are printed. |

## Required evidence record

For each non-trivial scenario, add a concise test note to the PR or issue using this exact shape:

```text
Commit: <40-character SHA>
Surface: <domain | operator-console | store-pos>
Scenario: <named workflow and deterministic seed/scenario>
Command or steps: <exact command, or numbered manual steps>
Environment: <OS, browser/device, Node and npm versions; throttle if used>
Expected: <observable result>
Actual: <observable result>
Artifact: <CI run URL, screenshot, video, trace, or `not captured` with reason>
Result: PASS | FAIL | BLOCKED
```

Rules:

1. “Works”, “looks good”, screenshots without steps, and test output without the commit SHA are not evidence.
2. A manual claim requires the exact browser/device and reproduction steps. Use deterministic fixture seed/scenario when data is involved.
3. Performance and memory evidence must state methodology and scope. Do not extrapolate demo measurements to users, devices, or production traffic.
4. Accessibility evidence combines automation with keyboard verification; an axe pass alone is insufficient.
5. Offline evidence must identify the interception/simulator condition and show both failure preservation and recovery.
6. A blocked or skipped check is reported as `BLOCKED`, with owner and next action; it is never reported as passing.
7. Cypress smoke is intentionally narrow: critical happy/error/offline paths on Chromium in CI. Broader browser/device checks are scheduled before portfolio release.

## CI command contract

The workflow expects root `package-lock.json` and these scripts when the workspace is added:

- `npm --workspace packages/domain run typecheck` and `test`
- `npm --workspace apps/operator-console run typecheck`, `lint`, `test`, `build`, and `cypress:run`
- `npm --workspace apps/store-pos run typecheck`, `test`, and `web`

`cypress:run` must start the built or previewed console, wait for its health URL, run deterministic Chromium smoke specs, and stop the server. It must not depend on a live external service.
