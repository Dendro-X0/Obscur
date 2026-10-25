# Frontend spec — Voice recorder chrome (2026-10)

## Surface

`VoiceRecorder` inside `Composer` primary row (mobile shell / phone preview + desktop).

## Problems (from screenshot)

1. While recording, attach / empty text / emoji / outer send stay visible — recording is a nested pill fighting the input capsule.
2. Cancel (trash) sits at the edge of a nested pill and visually clips outside the composer bar.
3. Waveform + controls are cramped; layout does not read as a dedicated recording mode.

## Layout contract (recording active)

| Region | Behavior |
|--------|----------|
| Composer primary row | **Replace** attach, textarea, emoji, outer send with a single recording chrome that fills the row |
| Left | Cancel (trash) — 44×44 touch target, inside the bar |
| Center | Live dot + timer + waveform (`flex-1`, `min-w-0`) |
| Right | Confirm/send (paper plane) — primary filled circle |
| Idle | Unchanged mic ghost button only |

## Visual

- One surface: no nested rounded pill inside the composer capsule (use transparent / subtle inner track only).
- Recording affordance: rose live dot + mono timer; soft purple accent on confirm only.
- Mobile and desktop share the same recording chrome; idle mic size unchanged.

## Behavior (unchanged)

Cancel discards; send stops recorder and completes upload path via existing `onRecordingComplete`.

## Out of scope

Playback player UI; LES vault; consent dialog redesign; build-stamp placement.
