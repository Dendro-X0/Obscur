# Voice Note Inline Player — Design (2026-07)

## Goal

Replace the nested card-style `VoiceNoteCard` in message threads with a compact inline player that embeds in the message bubble without double chrome.

## Scope (Phase 1–4)

| In scope | Out of scope (Phase 5+) |
|----------|-------------------------|
| Inline thread player | Lightbox volume row |
| Real peak waveform from decoded audio | Peak persistence in attachment metadata |
| Seek by tapping/dragging waveform | External-open inline button |
| Outgoing / incoming visual tokens | Generic `AudioPlayer` redesign |

## Layout

```
[ Play ] [ seekable peak waveform ................ ] [ time ]
```

- **Play:** 40×40 circle; outgoing = white/20 glass; incoming = purple gradient.
- **Waveform:** 56 peaks; played segment full opacity; unplayed ~30% opacity.
- **Time:** total duration when idle/at zero; elapsed while playing or after seek.

No inline `VOICE NOTE` badge, recorded-at stamp, duplicate timestamps, or external-link icon.

## Peak decode contract

| Field | Value |
|-------|--------|
| Owner | `voice-playback-peaks.ts` |
| Peak count | `VOICE_PLAYBACK_PEAK_COUNT = 56` |
| Input | Attachment URL (`blob:`, `https:`, etc.) |
| Method | `fetch` → `AudioContext.decodeAudioData` → max abs per block |
| Cache | In-memory `Map<src, peaks>` per session |
| Fallback | Deterministic pseudo peaks from URL hash when decode fails |

## Playback hook contract

| Field | Owner |
|-------|--------|
| Audio element ref, play/pause, seek | `use-voice-note-playback.ts` |
| Retry / nocache bypass | Same hook (from legacy `VoiceNoteCard`) |
| Duration fallback | `voiceNoteMetadata.durationSeconds` |

## Components

| Component | Role |
|-----------|------|
| `VoiceNotePlayer` | Canonical inline thread player |
| `VoicePlaybackWaveform` | Bar waveform + seek surface |
| `VoiceNoteCard` | Thin re-export of `VoiceNotePlayer` (compat) |

## Phase 5 — Lightbox + composer preview

| Surface | Component | Chrome |
|---------|-----------|--------|
| Thread | `VoiceNotePlayer` variant `inline` | Play · waveform · time |
| Lightbox / gallery | `VoiceNoteLightboxPlayer` | Header (label + recorded-at) · expanded player · volume · external open |
| Composer pending | `VoiceNoteComposerPreview` | Mini player on blob URL before send |

## Proof (L1)

- `pnpm exec vitest run` on voice-note player/lightbox/composer preview tests
