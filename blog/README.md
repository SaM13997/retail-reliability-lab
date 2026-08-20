# Reliability Frontend Notes

A four-part engineering series for the Retail Reliability Lab: an independent portfolio project for operational web software and a resilient store POS. The posts deliberately connect product quality, accessibility, and state correctness rather than treating them as polish after the data layer is done.

## Reading order

1. [Trust is a UI State: Designing Real-Time Operational Interfaces](./01-trustworthy-realtime-operational-uis.md)
2. [Events Are Not a Cache: Reconciling Streams with TanStack Query](./02-events-and-tanstack-query.md)
3. [Measure Before You Memoize: Debugging React Performance and Memory](./03-debugging-react-performance-and-memory.md)
4. [One Domain, Two Interfaces: Sharing Behavior Between React and React Native](./04-shared-domain-react-react-native.md)

## Source-link status

This writing lane owns only `blog/`. The application and domain-package lanes were not present in this checkout when these posts were written. Every repository reference points to the intended relative source location described by the product brief and is explicitly marked **expected from a parallel lane** until that target exists. The links are useful review anchors, not claims that source, tests, screenshots, or production results already exist.

No screenshots or demo GIFs are included or implied by this series.

## Project boundaries reflected in the articles

- Operator Console: React, TypeScript, TanStack Query/Table, MUI, typed in-browser API, and test coverage are expected under `../apps/operator-console/`.
- Store POS: Expo, React Native, TypeScript, web export, and component/unit tests are expected under `../apps/store-pos/`.
- Shared behavior: runtime-validated types, pure domain rules, fixtures, and focused tests are expected under `../packages/domain/`.

Read these as design and implementation guidance for an independent demo, not as a record of production deployment or measured performance.
