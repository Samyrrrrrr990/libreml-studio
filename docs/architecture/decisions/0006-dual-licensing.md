# ADR-0006: AGPL community edition with a commercial alternative

- Status: proposed pending qualified legal review
- Date: 2026-07-31

## Context

The founder wants accessible source and free community research use while discouraging closed repackaging and allowing proprietary commercial agreements. A non-commercial restriction would be source-available, not OSI open source.

## Decision

Recommend the unmodified `AGPL-3.0-or-later` for the community edition and separately negotiated commercial terms for organizations that cannot use it under AGPL obligations. Keep the scholarly citation request outside license conditions. Architect clean community/enterprise boundaries.

## Consequences

AGPL remains open source and permits commercial use subject to its terms; it is not a blanket commercial ban. Dual licensing requires sufficient rights in every commercially relicensed contribution. A DCO alone is not necessarily a relicensing grant, so a lawyer-reviewed CLA/ownership/governance policy is a launch gate. Dependency, trademark, distribution, source-offer, and jurisdiction questions also require counsel. See [LICENSING.md](../../../LICENSING.md).
