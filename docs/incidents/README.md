# Runtime incident records

Captured evidence from **running** Obscur (desktop/Tauri), separate from CI and chat.

**Process:** [testing-and-issue-tracking-spec.md](../program/testing-and-issue-tracking-spec.md) §4–§5.

## When to add a file

- User-visible bug reproduced at least once
- M0 or manual JSON bundle saved **before** app restart
- You are about to change code or ask an agent to patch

## Naming

- `YYYY-MM-DD-<short-slug>.md` — narrative (use template in [runtime-investigation-and-capture.md](../program/runtime-investigation-and-capture.md))
- `YYYY-MM-DD-<short-slug>.json` — optional raw bundle (`obscur.m0.capture.v1` or `obscur.manual.capture.v1`)

## Do not commit

- `nsec`, recovery phrases, backup ciphertext, full message bodies with PII

## Forward use

These files are the interim evidence store until CodaCtrl fault import exists. Keep symptom IDs (O-1…O-5) in markdown for traceability to the [Obscur case study](file:///E:/Experimental%20projects/codactrl/docs/case-studies/obscur-green-ci-red-runtime.md).
