# Obscur Documentation

This folder is the source of truth for engineers and maintenance agents working on Obscur.

## Audience

- Core contributors implementing features/fixes.
- Maintainers preparing alpha releases.
- Language models assisting with long-term code maintenance.

## Read This First

1. [Project Overview](./01-project-overview.md)
2. [Repository Map](./02-repository-map.md)
3. [Runtime Architecture](./03-runtime-architecture.md)
4. [Messaging and Groups](./04-messaging-and-groups.md)
5. [Performance and Load Testing](./05-performance-and-load-testing.md)
6. [Testing and Quality Gates](./06-testing-and-quality-gates.md)
7. [Operations and Release Flow](./07-operations-and-release-flow.md)
8. [Maintainer Playbook](./08-maintainer-playbook.md)
9. [Security and Privacy Model](./09-security-and-privacy-model.md)
10. [Feature Change Maps (Deep References)](./10-feature-change-maps.md)
11. [Runtime Contracts and Invariants](./11-runtime-contracts-and-invariants.md)
12. [Data Models and Persistence](./12-data-models-and-persistence.md)
13. [Operational Runbooks Per App](./13-operational-runbooks-per-app.md)
14. [Regression Playbooks](./14-regression-playbooks.md)
15. [On-Call Quickstart (15-Minute Triage)](./15-on-call-quickstart.md)
16. [Glossary and Canonical Terms](./16-glossary-and-canonical-terms.md)
17. [Decision Log](./17-decision-log.md)
18. [Docs Maintenance Standard](./18-docs-maintenance-standard.md)
19. [v0.8.0 Release Readiness Plan](./19-v0.8.0-release-readiness-plan.md)
20. [Threat Model and Security Checklist (v0.8.0)](./20-threat-model-and-security-checklist-v0.8.0.md)
21. [Dependency Audit Triage (v0.8.0)](./21-dependency-audit-triage-v0.8.0.md)
22. [v0.8.1 Ticketized Roadmap](./22-v0.8.1-roadmap.md)
23. [v0.8.2 Ticketized Roadmap](./23-v0.8.2-roadmap.md)
24. [v0.8.3 Ticketized Roadmap](./24-v0.8.3-roadmap.md)

## Quick Paths By Task

1. Chat performance and load behavior:
   [Performance and Load Testing](./05-performance-and-load-testing.md),
   [Feature Change Maps](./10-feature-change-maps.md),
   [Runtime Contracts](./11-runtime-contracts-and-invariants.md),
   [Regression Playbooks](./14-regression-playbooks.md)
2. Messaging or groups feature changes:
   [Messaging and Groups](./04-messaging-and-groups.md),
   [Feature Change Maps](./10-feature-change-maps.md),
   [Data Models and Persistence](./12-data-models-and-persistence.md)
3. Release or incident handling:
   [Operations and Release Flow](./07-operations-and-release-flow.md),
   [Operational Runbooks](./13-operational-runbooks-per-app.md),
   [On-Call Quickstart](./15-on-call-quickstart.md),
   [v0.8.0 Release Readiness Plan](./19-v0.8.0-release-readiness-plan.md),
   [v0.8.1 Ticketized Roadmap](./22-v0.8.1-roadmap.md),
   [v0.8.3 Ticketized Roadmap](./24-v0.8.3-roadmap.md)
4. Terminology and policy checks:
   [Glossary](./16-glossary-and-canonical-terms.md),
   [Security and Privacy Model](./09-security-and-privacy-model.md),
   [Threat Model and Security Checklist](./20-threat-model-and-security-checklist-v0.8.0.md),
   [Dependency Audit Triage](./21-dependency-audit-triage-v0.8.0.md),
   [Docs Maintenance Standard](./18-docs-maintenance-standard.md)

## Legacy Docs

Previous docs were archived on 2026-03-03.

- [Legacy Archive Index](./archive/README.md)

## Docs QA Command

Run docs validation before merging doc changes:

```bash
pnpm docs:check
```

## Release QA Commands

Run these during release preparation:

```bash
pnpm version:sync
pnpm version:check
pnpm docs:check
pnpm release:preflight
pnpm security:audit
```



