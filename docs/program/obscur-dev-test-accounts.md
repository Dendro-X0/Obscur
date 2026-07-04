# Obscur dev test accounts (local fixture)

**Status:** Active — dev / runtime verification only  
**Last updated:** 2026-07-02 (UTC)  
**Canonical automation source:** [`apps/pwa/tests/e2e/helpers/dev-test-accounts.ts`](../../apps/pwa/tests/e2e/helpers/dev-test-accounts.ts)

Two-profile fixture for desktop MCP capture, Playwright runtime capture, and COM-MEM / O-4 verification. **Not production identities.**

---

## Account A — Tester1

| Field | Value |
|-------|--------|
| Username | `Tester1` |
| Device password | `SyI14^ew1E` |
| Public key (npub) | `npub1uplk0h9c5k848vfl69dw2jwrr7ecz736dncw30tfqwaw8sv3aftq3rtdrg` |
| Private key (hex) | `c09832d637eb265d90b29c12eb8dfcfffe165b8fb34094af75236d5be4d97884` |

---

## Account B — Tester2

| Field | Value |
|-------|--------|
| Username | `Tester2` |
| Device password | `HT512#scE8` |
| Public key (npub) | `npub18kc9tdr7qk7lhyyralkqk7hv62sytklhmpju7nv4mxyp0k2xsv8ss7n67a` |
| Private key (nsec) | `nsec1gkv6kg9gyfvrg7h7q60usvaqtjq096dxewaw4vpk9y6krrlcglpqat96ta` |

---

## Usage

| Context | How |
|---------|-----|
| MCP unlock | `role=textbox[name="Enter your password"]` → Tester1/2 password → `locator('form').getByRole('button', { name: 'Log In' })` |
| Playwright | `unlockTester1(page)` / `unlockTester2(page)` from `dev-test-accounts.ts` |
| Community fixture | NewTest 2 · `groupId: b93f53e23d8c4456835afd3f4d3a627b` |
| Stack | `pnpm dev:coordination` (:8787) · optional `pnpm dev:relay:docker` (:7000) · desktop CDP :9230 |

---

## Security

- Dev fixture credentials — treat as **non-secret within this repo** for local verification only.
- Do not use these keys on mainnet relays or production builds.
- Agents: reference this doc for unlock; do not paste keys into chat transcripts or public issues.
