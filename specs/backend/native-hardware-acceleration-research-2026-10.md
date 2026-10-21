# Research — Responsible hardware acceleration for Obscur

**Date (UTC):** 2026-10-13  
**Status:** Research closed · standards deltas proposed  
**Companions:** [native-shell-performance-research-2026-10.md](./native-shell-performance-research-2026-10.md) · [native-perf-public-inspiration-2026-10.md](./native-perf-public-inspiration-2026-10.md) · [obscur-native-performance-standards.md](../../docs/program/obscur-native-performance-standards.md)

---

```text
HANDOFF ATOMIC STEP:  Research responsible HW acceleration (study only)
PAUSED / CANCELLED:   M1–M3 · dialects · ASE-2 · SF-B · shell-lag soak until N0 accept
CANONICAL OWNER:      apps/desktop WebView2 · apps/pwa messaging / globals.css
PROOF BEFORE DONE:    This research + standards § hardware (L0)
SURFACE:              WebView2 GPU process · compositor · media decode
```

---

## 1. Goal

Use the GPU where it **cheaply** buys smoothness (compositor scroll, media decode, a few animated overlays) **without** turning every message into a texture, forcing discrete GPUs, or masking the real freeze class (IPC / main-thread JS).

**North star:** accelerate the *right* work; starve the *wrong* work. Hardware accel is a budget, not a turbo button.

## 2. Evidence already in hand

| Observation | Implication |
|-------------|-------------|
| Track L Task Manager: WebView2 renderer **~30% CPU**, GPU process **~7.8%** / ~10 MB | Freeze was **not** GPU starvation; more GPU promo would not have fixed IPC storms |
| CDP: **121 style recalcs / 2s** while ghost public relays thrashed | Style/layout thrash burns CPU *and* forces GPU to re-raster tiles |
| Dual unlocked WebViews | Each WebView2 control → own browser + renderer + **GPU** process set (MS docs) — dual-profile **doubles** GPU overhead |
| `message-list` `highLoadMode` | Already cuts transitions / swipe / overscan under load — correct direction |
| `globals.css` uses `will-change: transform` + heavy `backdrop-filter` | Permanent layer promotion + blur = GPU memory / bandwidth tax |
| Desktop browser args | Dev: SmartScreen/OOUI disable + CDP; **no** `--disable-gpu` (good) · release: no extra GPU flags |

## 3. What “hardware acceleration” means here

| Layer | Who | What Obscur should want |
|-------|-----|-------------------------|
| **WebView2 GPU process** | Chromium/Edge | Default **ON** — compositing, video decode, WebGL when needed |
| **Compositor** | Blink | Scroll/transform few layers without main-thread paint |
| **Raster** | GPU/CPU tiles | Paint only near viewport; skip offscreen |
| **Media decode** | HW decoder when available | Video/voice playback — legitimate GPU use |
| **JS main thread** | Not GPU | Crypto, hydrate, React reconcile — **cannot** be “accelerated” by `translateZ(0)` |

Mozilla’s classic warning still applies: **`translateZ` / `will-change` do not “turn on” HW accel** — they promote layers. Blind promotion **increases** GPU memory and can make scroll *worse*.

## 4. Policy: accelerate without burden

### 4.1 Keep platform GPU on (default)

- **Do not** ship `--disable-gpu` except as a documented troubleshooting escape hatch.  
- MS WebView2 guidance: GPU rendering is **critical**; disabling is for debug only.  
- Expect GPU process memory/buffers as the cost of smooth compositor — budget it; don’t fight it.

### 4.2 Do not force discrete GPU by default

- Dual-GPU laptops: Chromium often prefers **integrated** for battery.  
- `--force_high_performance_gpu` (Chromium ≥145, via AdditionalBrowserArguments) is for **measured** WebGL/WebGPU or video stress — not chat chrome.  
- Default Obscur: **integrated / OS preference**. Optional advanced setting only if L2 proves need.

### 4.3 Layer budget (the real lever)

Promote to compositor layers **only** when:

1. The element **actually animates** (transform/opacity) for a bounded time, **or**  
2. It is **sticky chrome** that must not repaint with the scroll content, **or**  
3. Measurement shows paint cost > promotion cost.

**Anti-patterns (forbidden as defaults):**

| Pattern | Why it burdens hardware |
|---------|-------------------------|
| `will-change: transform` on every message row | N textures · GPU memory ceiling |
| `translateZ(0)` “hack” on list items | Same |
| Permanent `backdrop-filter: blur` on large surfaces during scroll | Expensive per-frame sampling |
| Framer-motion on every bubble while scrolling | Main-thread + layer churn |
| Multiple simultaneous video autoplay in thread | Decoder + compositor contention |
| Dual-profile always both fully active GPU-heavy UIs | 2× WebView GPU processes |

### 4.4 Prefer cheap compositor paths

| Prefer | Over |
|--------|------|
| CSS `transform` / `opacity` on **few** overlays | JS-driven layout animation of many nodes |
| Virtualizer + (optional) `content-visibility` discipline | Full-list paint |
| `highLoadMode` → `transition-none`, no swipe gesture layers | Always-on motion |
| `prefers-reduced-motion` / community safe mode | Ignoring OS accessibility |
| HW video decode for **one** active player | Many decoded streams |
| Static posters when reduced-motion | Ambient looping video (website already does this) |

### 4.5 Skip work offscreen (CPU + GPU)

- Virtualization already limits DOM.  
- Complementary: avoid painting/raster of offscreen subtrees (`content-visibility: auto` + intrinsic size) **only where** it does not fight TanStack measure (design carefully; Element/Signal invest in height stability first).  
- Pause canvas/waveform/`requestAnimationFrame` when not visible (`IntersectionObserver` / `contentvisibilityautostatechange`).

### 4.6 Dual WebView / background windows

MS: each WebView2 instance costs browser + renderer + GPU. For secondary profile windows:

- Prefer **suspend / low memory target** when unfocused (WebView2 `TrySuspend` / `MemoryUsageTargetLevel.Low` where Tauri allows).  
- Do not keep both profiles scrolling animated media at once without an explicit operator action.

### 4.7 What HW accel will **not** fix

- `engine_invoke` storms / PostMessage floods (T1)  
- Always-on presence/lease ticks (T2)  
- 10k messages in React state (T3)  
- Sync JSON stringify on UI thread  

Those remain N1–N2 work. GPU policy is **N0 additive**, not a substitute.

## 5. Obscur surface inventory

| Surface | Current | Responsible direction |
|---------|---------|------------------------|
| WebView2 GPU | Default on | Keep; never disable in prod |
| Browser args | Dev CDP + feature disables | No `--force_high_performance_gpu` by default |
| Message list | TanStack Virtual + `highLoadMode` | Keep; cut row-level motion under load (done partially) |
| Framer-motion | Toasts, lightbox, video chrome, swipe reply | Bound to overlays; off in `highLoadMode` |
| `globals.css` `will-change` | Several permanent rules | Audit → promote only during animation |
| `backdrop-filter` | Notifications, sticky headers, glass | Reduce size/blur on low-end / highLoad; solid fallback |
| Video/audio players | motion wrappers | One active decode; poster when offscreen |
| Waveform RAF | Recording UI | Stop when unmounted / not visible |
| Dual profile | Two WebViews | Suspend background; Quiet dial already process-capped |

## 6. Proposed budgets (standards)

| Signal | Pass |
|--------|------|
| WebView2 GPU enabled in release | **Required** (no `--disable-gpu`) |
| Discrete GPU force | **Off** by default |
| Concurrent compositor-promoted chat rows | Prefer **≤ ~viewport + overscan**; no per-row permanent `will-change` |
| Concurrent HW-decoded videos in one thread | **≤1** autoplay; others poster/paused |
| Backdrop blur on scroll-critical chrome | Prefer solid/low-blur under `highLoadMode` or reduced-motion |
| Dual-profile idle GPU | Background window not continuously decoding media |
| Idle GPU process (single profile, chat open, not scrolling) | Should stay modest (order of prior ~10 MB / low %); investigate sustained **>15%** GPU with flat IPC |

## 7. Phased work (after N0 accept)

| Slice | Work | Proof |
|-------|------|-------|
| **H0** | Document policy in standards (this research) | L0 |
| **H1** | Audit `will-change` / permanent blur; gate under highLoad + reduced-motion | L1 CSS/contract · L2 scroll GPU% |
| **H2** | Media: single active decoder; pause offscreen players | L1 · L3 scroll past videos |
| **H3** | Secondary WebView suspend / low memory when unfocused | L2 dual-profile idle |
| **H4** | Optional: `content-visibility` experiment **after** sliding window (N2) | L2 measure; abort if scroll jump |

## 8. Public anchors

- [WebView2 performance best practices](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/performance) — enable HW accel; share environments; reduce host↔web chatty IPC  
- [WebView2 browser flags](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/webview-features-flags) — `disable-gpu` troubleshooting only  
- Mozilla Gfx — layers ≠ “enable GPU”  
- MDN `content-visibility` / containment  
- Obscur CPU canvas (2026-10-11) — GPU secondary to renderer CPU  

## 9. Conclusions

1. **Keep** WebView2 hardware acceleration on — it is the compositor’s cheap path.  
2. **Burden** comes from **too many layers**, **blur**, **many decoders**, and **many WebViews** — not from leaving GPU enabled.  
3. Obscur’s freeze class remains **CPU/IPC**; HW policy is complementary hygiene.  
4. Align UI motion with existing `highLoadMode` / reduced-motion; treat GPU like a **VRAM/layer budget** the same way N0 treats IPC.  

_Last updated: 2026-10-13T13:35:00Z_
