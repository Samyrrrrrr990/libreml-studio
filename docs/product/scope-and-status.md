# Product scope and status

## Research Preview boundary

The first release demonstrates one local tabular supervised-learning path:

```text
local tabular import → overview → roles → split → preprocessing
→ linear/logistic baseline → held-out evaluation → report → prediction
```

It also demonstrates a typed acyclic graph, a visible integrity finding, explicit user response, audit/decision history, backend project save/retrieval, and Learning/Research presentation of the same workflow. A complete project-browser/reopen experience remains outside the evidenced preview path.

## Status vocabulary

| Label | Meaning |
| --- | --- |
| Implemented | Code and relevant automated evidence exist on the current branch |
| Preview | Implemented but API, schema, method set, performance, or validation remains unstable |
| Partial | Only the specifically named behavior exists |
| Planned | Design/roadmap only; no user-facing claim |
| Deferred | Deliberately outside the current milestone |

The [README status matrix](../../README.md#feature-status) is the public summary. This document controls scope; tests and release artifacts establish actual status.

## Explicitly outside the preview

- causal inference or causal claims;
- automated test selection or one-click AutoML;
- arbitrary Python/expression execution;
- plugin sandboxing guarantees;
- collaboration, accounts, or managed cloud execution;
- regulated-use certification;
- computer vision, audio, reinforcement learning, LLM training, or arbitrary deep-learning graphs;
- claims of cryptographic audit-log immutability;
- production-scale or frontier-scale training guarantees.

## Product-wide invariants

1. Core workflows function offline and without mandatory accounts, telemetry, paid APIs, or hosted models.
2. Data and artifacts stay local unless the user initiates an identified network action.
3. The graph and every persisted node are typed and versioned.
4. Learned preprocessing fits on training partitions only.
5. Repairs are explained, previewed, approved/rejected, recorded, and followed by stale propagation.
6. Metrics identify direction, baseline, interpretation, and common failure modes.
7. Reports separate recorded fact, software interpretation, user decision, and limitation.
8. Unsupported or unsafe behavior fails explicitly; no decorative success states.

## Full-product direction

The complete tabular/statistics environment, hardened desktop packaging, connectors, and extension SDK follow evidence gates in [ROADMAP.md](../../ROADMAP.md). Future scientific domains require independent contracts, methodology reviews, and threat-model amendments before implementation.
