# v1.3.0 Manual Verification Checklist

Mark each gate after completing manual replay on the target runtime/device mix.

## Runtime and Auth

- [ ] Startup completes without infinite loading on cold launch.
- [ ] Remember-me/session restore behavior matches expected policy.
- [ ] Account switching does not corrupt profile scope or boot ownership.

## Messaging and Groups

- [ ] DM history includes self-authored and peer-authored messages after sync.
- [ ] Group membership and display name remain stable after account/device replay.
- [ ] Group sendability works (no false room-key missing block) for joined members.
- [ ] End-to-end delete convergence works for text and voice notes.

## Media and Search

- [ ] Historical media (image/video/audio/voice-note) renders after restore.
- [ ] Message search navigation scrolls to target message deterministically.
- [ ] Voice-note cards show expected compact UI and metadata.

## Performance and UX

- [ ] Page navigation remains responsive under multi-page switching.
- [ ] Chat scrolling remains smooth on larger histories.
- [ ] No unrecoverable blank-page or frozen UI state in stress replay.

## Final Manual Verdict

- [ ] Manual verification pass accepted for `v1.3.0` closeout.
- Notes:
  - 
