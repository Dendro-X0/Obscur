# 03 — Runtime and State

1. **One runtime owner per window.**
   - Startup, auth, activation, degradation, and teardown should be owned by one supervisor/controller path.

2. **Signed-out windows stay light.**
   - Do not start relay sync, account rehydrate, messaging subscriptions, or heavy recovery work before identity is actually available.

3. **Profile binding must be resolved before account-scoped services mount.**
   - No store or runtime should read/write account state before knowing which profile owns the window.

4. **Storage keys must be scoped deliberately.**
   - Any account/profile-scoped persistence must derive from explicit scope at access time, not module-load time.

5. **Sync bookkeeping must be evidence-based.**
   - Never advance checkpoints or mark recovery complete on timeout alone.
