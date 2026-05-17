# 09 — Anti-Patterns

Do not:

- add another compatibility bridge to avoid understanding an existing one,
- mark delivery success from local UI state alone,
- create new hidden singleton state,
- patch over lifecycle races by adding more `useEffect` layers,
- mix legacy and new paths in one user action without naming a canonical owner,
- claim a release blocker is resolved because tests pass while runtime behavior is still divergent.
