# Security surface (OFP4)

- **ready:** true
- **denyProductionHosts:** true

## Checks

- `health.allowlist.missing` **honesty** — OH3 health allowlist missing
  - proves: fail_closed_without_silent_prod_scan
  - doesNotProve: api_up, db_up
  - detail: Create .codactrl/health.allowlist.yaml for local probes
- `health.loopback_gate` **pass** — Health probe loopback gate clean
  - proves: loopback_only_health_probe
  - doesNotProve: auth_secure, tls_posture
- `health.probe.no_allowlist` **honesty** — Health probe without allowlist
  - proves: 
  - doesNotProve: api_up
  - detail: No targets probed
- `honesty.cdp_open` **honesty** — CDP open ≠ auth secure
  - proves: claim_discipline_documented
  - doesNotProve: auth_secure, session_isolation, secret_hygiene
  - detail: client_session_connect / CDP attach proves attach wiring only — not authentication security
- `honesty.stack_preflight` **honesty** — Stack preflight ≠ security audit
  - proves: claim_discipline_documented
  - doesNotProve: auth_secure, network_isolation, cve_absence
  - detail: client_stack_preflight proves local port/CDP readiness — not pen-test coverage
- `honesty.no_cloud_scanner` **pass** — No cloud scanner / mandatory egress
  - proves: local_first_security_surface
  - doesNotProve: internet_vuln_db, hosted_pen_test
  - detail: OFP4 does not call external CVE feeds or SaaS scanners
- `security.allowlist.absent` **honesty** — Optional security.allowlist absent
  - proves: fail_closed_without_extra_probes
  - doesNotProve: full_security_posture
  - detail: Optional — create .codactrl/security.allowlist.yaml for extra loopback probes; OH3 health.allowlist remains primary

## Global doesNotProve

- CDP open ≠ auth secure
- Health ping ≠ production security posture
- Stack preflight ≠ pen-test or CVE scan
- Local allowlist pass ≠ cloud APM / hosted scanner
- Security surface ≠ Obscur product complete

## Hub

- module: `verify`
- json: `.codectx/verify/security-surface-latest.json`
- report: `.codectx/verify/security-surface-report.md`
- agent: `.codactrl/verify/security-surface/ (after studio_output_sync modules=[verify])`

