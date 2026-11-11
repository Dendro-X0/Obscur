# CI investigation — Full Release 42991775280

**Date:** 2026-11-11  
**Run:** https://github.com/Dendro-X0/Obscur/actions/runs/42991775280  
**Cut:** v2.0.0-beta.10 remaster publish  
**Primary failure class:** typecheck (PWA)

```text
JOBS:  Build Web/PWA · Build Android (both fail on same PWA typecheck)
STEP:  next build / Build PWA static export
ERROR: ./app/features/network/hooks/use-peer-trust.ts:389:12
       Type error: Type '() => void' is not assignable to type 'void'.
DESKTOP: all 4 matrix targets Pass (windows/macOS/linux)
```

## Fix (this iteration only)

Correct the use-peer-trust.ts:389 return type so Next typecheck accepts it. Re-run Full Release.

## Not claimed

Soft L3 Fixed · Continuity Pass · Tor Verified · Matrix promote
