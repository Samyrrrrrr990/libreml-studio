# Licensing strategy

> [!CAUTION]
> This is an engineering and product recommendation, not legal advice. Copyright ownership, contributor terms, dependencies, trademarks, distribution, app-store rules, and commercial agreements require review by qualified counsel in the relevant jurisdictions before launch.

## The three concepts

### OSI-approved open source

An open-source license grants rights to inspect, use, modify, and redistribute software and must not discriminate against persons, groups, or fields of endeavor. That means an OSI-approved license cannot simply say “non-commercial use only.” The GNU Affero General Public License v3 is OSI-approved and permits commercial use, subject to its conditions.

### Source-available

A source-available license publishes source but restricts a class of use—for example, offering a competing service or using it commercially without payment. Such a license may fit a business goal, but it is not “open source” under the Open Source Definition and can reduce ecosystem compatibility and trust. LibreML Studio should not use “open source” to describe a source-available edition.

### Dual licensing

The same copyrighted code can be offered under two alternatives when the licensor owns or has sufficient rights to license it that way:

1. the community may comply with `AGPL-3.0-or-later`; or
2. an organization may negotiate a separate commercial agreement with different obligations.

This does not make ordinary commercial use automatically forbidden under AGPL. AGPL users—including businesses—may use the software commercially if they comply. A commercial license is useful to organizations that need proprietary modification, embedding, distribution, warranties, support, or network-service terms incompatible with their AGPL compliance model.

## Recommendation

Offer the community core under the unmodified **GNU Affero General Public License v3.0 or later**, using the SPDX identifier `AGPL-3.0-or-later`, and reserve a separately negotiated commercial-license path.

Why:

- AGPL is a recognized OSI-approved open-source license.
- Its copyleft provisions protect community access to covered modifications, including the specific remote-network interaction obligation in section 13.
- A separate commercial agreement can address closed proprietary deployments without weakening the community license.
- Standard text is materially clearer than inventing a “research/nonprofit/free but commercial-paid” custom license.

Important limits:

- AGPL does not guarantee that every business will purchase a license.
- Private internal use, aggregation, linking boundaries, hosted services, distribution, and Corresponding Source obligations are fact-specific legal questions.
- A product name/logo is a trademark question, separate from copyright licensing.
- Dependencies and bundled assets keep their own licenses and may constrain distribution.
- Enterprise separation is an architecture boundary, not a way to evade obligations of code actually combined with AGPL-covered work.

Authoritative references: [Open Source Definition](https://opensource.org/osd), [GNU AGPL v3 text](https://www.gnu.org/licenses/agpl-3.0.html), and [SPDX AGPL-3.0-or-later identifier](https://spdx.org/licenses/AGPL-3.0-or-later.html).

## Repository application

Unless a file or directory contains a different notice:

- software source is licensed under `AGPL-3.0-or-later`;
- documentation and repository materials are included under the same license for now;
- third-party material remains under its identified license in `LICENSES/` or accompanying notices;
- generated user data, analysis results, and reports are not automatically covered merely because LibreML generated them—the AGPL itself states that output is covered only when the output constitutes a covered work;
- trademarks, project names, and logos are not licensed by the software license except as legally required for truthful attribution.

Every source file need not repeat the full license, but new files should use a concise SPDX header where ecosystem conventions support it:

```text
SPDX-License-Identifier: AGPL-3.0-or-later
```

Do not copy commercial terms into this repository unless counsel approves them. `LICENSES/COMMERCIAL-LICENSE-NOTICE.md` is a notice, not a grant of commercial rights.

## Contributor rights: unresolved launch gate

Dual licensing depends on rights ownership. Accepting an outside contribution under AGPL does not necessarily authorize the project to relicense that contribution under proprietary commercial terms. A Developer Certificate of Origin establishes a provenance representation and license to submit; it is not, by itself, a copyright assignment or universal relicensing grant.

Before accepting substantive third-party code that the founder expects to dual-license, counsel should choose and review one of these models:

- a contributor license agreement granting the specific relicensing rights while contributors retain copyright;
- copyright assignment, where appropriate and acceptable;
- community-license-only treatment for outside contributions, with commercial builds excluding or separately negotiating those contributions;
- a governance model that abandons proprietary relicensing of community contributions.

Until this decision is formalized, maintainers must track provenance and must not promise that all community contributions are commercially relicensable. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Community core and commercial capabilities

Keep stable interfaces between the community core and any separately licensed enterprise packages. Community code must remain fully useful for local research and must not import proprietary modules. Enterprise packaging, administration, identity, managed collaboration, compliance integrations, or support tooling can depend inward on public contracts. Shared files need an unambiguous license and provenance; avoid copy-pasting code across boundaries.

## Citation is separate

The project strongly asks researchers to cite LibreML Studio and include version/provenance in methods sections. Citation is good scholarship and helps the project grow, but it is **not an additional restriction, field-of-use limit, or condition of AGPL permissions**. See [CITATION.md](CITATION.md).

## Release checklist for licensing

- [ ] Counsel approves the license choice and commercial offering.
- [ ] Copyright holder/entity and contact path are confirmed.
- [ ] Contributor agreement/governance decision is published.
- [ ] Dependency and asset license scan is reviewed.
- [ ] Distributions include license and Corresponding Source notices as required.
- [ ] Remote UI includes an appropriate source/legal notice where required.
- [ ] Trademark policy and commercial-license contact are defined.
- [ ] Citation wording remains a request, not a license restriction.
