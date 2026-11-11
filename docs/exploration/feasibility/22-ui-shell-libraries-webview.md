# Feasibility — UI shell · libraries · WebView (Next.js vs React+TanStack)

**ID:** F-shell  
**Status:** draft  
**Date (UTC):** 2026-11-09  
**Charter:** `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`  
**Parents:** F-stack · F9 NARROW · F8 · F-PSE · F-hub  
**As-built lean:** Next.js 16 App Router PWA · React 19 · TanStack Query (+ Virtual) · Tauri v2 WebView (Win WebView2 / WKWebView / WebKitGTK) · static `output: "export"` for packaged shells  
**Claim language:** **candidates ranked** ≠ Cut 0 UI rewrite · ≠ Next.js deleted · ≠ Electron adopted

## 1. Scope

- **In:** Which **UI / data / shell libraries** best serve NARROW Cut 0+ (Rust kernel · TS UI · SQLite · private-trust primary); whether to **keep Next.js** or move to **React + TanStack Router/Query**; how **WebView** dependencies behave across OS.
- **Out:** Implementing a framework swap; Soft L3; picking Electron/Flutter; rewriting `apps/website` (marketing may stay Next).

## 2. Basics

Obscur’s product UI is already a **client-first app** wrapped by Tauri:

| Surface | Runtime today |
|---------|---------------|
| Dev desktop | Tauri loads `next dev` (or static-dev shell) in WebView |
| Packaged desktop / mobile | `TAURI_BUILD=true` → Next **static export** into WebView |
| Browser PWA | Next + service worker (`@ducanh2912/next-pwa`) |

Next.js is used mainly as **bundler + file routes + Image/Link**, not as a classical SSR product. Server routes (`app/api/*`) exist for browser/dev helpers; packaged shells do not rely on a Node server inside the WebView.

F-stack law: **UI framework ≠ platform**. Kernel owns auth/CRM/DB; UI must stay thin.

## 3. Capabilities map — library benefit ranking

### 3.1 Keep / strengthen (high benefit for NARROW)

| Library / layer | Role | Why keep |
|-----------------|------|----------|
| **Tauri v2** + plugins (fs, dialog, http, notification, shell, upload, deep-link, updater) | Native shell + IPC | Matches F-stack; lighter than Electron; already profile/WebView isolation work |
| **React 19** | UI | Team fluency; ui-kit/Radix already React |
| **`@tanstack/react-query`** | Server/async cache · profile-scoped | Already in tree with rollout + diagnostics; fits “UI reads kernel ports” |
| **`@tanstack/react-virtual`** | Long lists (chat/CRM) | Perf win without rewriting lists in native |
| **Radix / ui-kit / Tailwind** | Accessible primitives | Presentation only — keep |
| **`@noble/curves` · `nostr-tools` (adapter edge)** | Wire helpers until Rust ports absorb | Accept short-term; shrink JS crypto long-term (F5/F8) |
| **i18next** | Localization | Keep |
| **Vitest · Playwright** | L1/L2 | Keep |
| **Rust: tokio · serde · keyring · aes-gcm · reqwest(rustls) · nostr crate** | Desktop/native plane | Aligns with kernel direction; keep |

### 3.2 Keep with constraints (useful but taxed)

| Library / layer | Constraint |
|-----------------|------------|
| **Next.js 16** | Valuable for **dev DX + PWA + marketing site**; **tax** for packaged WebView (static export mode split, `useSearchParams` fragility, RSC/"use client" noise, API routes that don’t exist offline) |
| **framer-motion** | Motion OK if budgeted (F-PSE); don’t grow into animation framework dependency for every surface |
| **@ffmpeg/ffmpeg (WASM)** | Heavy; sandbox/media path — keep behind feature gates |
| **emoji-picker-react · qr-scanner · jsqr** | Feature-local; isolate imports (already partial via `optimizePackageImports`) |
| **Hono** | Fine for small workers/gateways — not the desktop UI spine |
| **Workspace `@obscur/*` / `@dweb/*` engines** | Bridge era — **subtract dual ownership** as Cut 0 moves logic to Rust; do not add more JS domain engines |

### 3.3 Reject / defer for core UI rewrite

| Candidate | Verdict |
|-----------|---------|
| **Electron** | Reject for core — heavier; duplicates WebView problem; no F-stack win |
| **Flutter / RN as primary shell** | Defer — second UI stack; conflicts with one TS UI |
| **Redux / Zustand as global domain store** | Reject as CRM/auth owner; local UI state OK |
| **GraphQL client as CRM** | Reject — wrong plane |
| **matrix-js-sdk in UI root** | Lab/adapter only (F3); never auth root |
| **OPFS/IndexedDB as sole durable CRM** | Reject for Cut 0 spine (F8 — SQLite + vault) |

## 4. Fit to planes — Next.js vs React + TanStack

| Plane | Next.js today | React + TanStack Router/Query candidate |
|-------|---------------|----------------------------------------|
| Auth door | Client screens in App Router | Same React; routing irrelevant to PDK |
| Profile windows | URL + Tauri window label | TanStack Router fine; **must** keep profileId from native oracle |
| Storage | Not owned by Next | Unchanged — kernel/SQLite |
| Relationship / Message | Feature modules under `app/features` | Move as plain React routes; Query for read models |
| Transport | Tauri http/WebSocket + adapters | Unchanged |

### Decision lean (Cut 0 / Cut UI)

| Option | Fit | Cost | Recommendation |
|--------|-----|------|----------------|
| **A. Stay on Next (static export for shells)** | Works today | Ongoing WebView/SSR mismatch tax | **Default through Cut 0** — do not block account spine on a framework swap |
| **B. React + Vite + TanStack Router + Query** | Best long-term for **client-only** desktop/mobile shell | Migration of 100+ `next/navigation` / `next/image` / `next/link` call sites; rebuild PWA story | **Preferred shell target after Cut 0** (or parallel Cut UI) once ports stabilize |
| **C. Hybrid** — Next for `apps/website` + browser marketing; **Vite SPA** for `apps/pwa` desktop shell | Clean split | Two front-end build pipelines | **Strong NARROW fit** if website stays Next |

**TanStack Query:** keep and **expand** (already started).  
**TanStack Router:** adopt **with** option B/C — not required to keep Query.  
**Do not** treat “React + TanStack” as replacing Rust kernel work.

```text
NARROW sequencing
  Cut 0   → auth/profile/schema spine (framework-agnostic)
  Cut UI  → optional: Vite + TanStack Router SPA for WebView shells
  Keep    → Next for public website / optional browser PWA until C lands
```

## 5. Libraries / stacks — WebView across OS

Tauri v2 embeds OS WebViews (not Chromium everywhere):

| OS | Engine | Obscur as-built notes |
|----|--------|------------------------|
| **Windows** | **WebView2** (Edge/Chromium) | Per-profile `EBWebView` dirs; orphan `msedgewebview2` cleanup scripts; media permission hooks; RAM cap on live profile windows |
| **macOS** | **WKWebView** | Keychain + LocalAuthentication; different storage paths than EBWebView |
| **Linux** | **WebKitGTK** | More version skew; keyring linux-native; deny-webview-data paths in capabilities |
| **Android** | Tauri mobile WebView | Build scripts exist; treat as **secondary** until desktop Cut 0 proven |
| **iOS** | WKWebView (mobile) | Same “secondary” posture |

### Cross-OS WebView risks (must stay on the Cut checklist)

1. **Profile isolation** — one WebView data dir per `profileId`; never share localStorage/IndexedDB across profiles (already hard-won on Windows).  
2. **Stale shell** — static-dev stamp mismatch banners; rebuild discipline.  
3. **API surface drift** — features that assume Chromium-only APIs fail on WKWebView/WebKitGTK; prefer Tauri plugins + feature detect.  
4. **Media / WebRTC** — OS permission bridges differ (`webview_media_permissions`); calls remain exploration debt.  
5. **Filesystem secrets** — `fs:deny-webview-data-*` capabilities must stay; tokens → keychain (F8 Cut 0b).  
6. **Multi-window** — each window ≈ WebView cost; cap concurrent profiles (already noted in Rust).  
7. **Service workers** — PWA SW in browser ≠ desktop WebView; don’t assume SW caching inside packaged shells.

### Dependency rule for “runs on all OS”

| Prefer | Avoid |
|--------|--------|
| Tauri plugin APIs (`plugin-fs`, `plugin-http`, dialogs) | Raw Node-only or Chromium-only assumptions in feature code |
| Capability-scoped IPC | Broad `withGlobalTauri` / unchecked FS |
| Feature detection + degraded UX | Shipping “Windows-only works” as Pass |
| Static assets in `frontendDist` | Relying on `next start` inside the package |

## 6. Feasibility verdict

**`fit-with-adapter`** for the current stack as a **bridge**, with a clear UI-shell target:

| Verdict | Detail |
|---------|--------|
| **Keep for Cut 0** | Tauri v2 · React 19 · TanStack Query/Virtual · Radix/ui-kit · Next static-export shells |
| **Preferred UI evolution** | **React + Vite + TanStack Router/Query** as the **WebView app shell**; Next retained for website (option C) |
| **WebView** | Stay on Tauri WebViews; invest in **profile isolation + capability + OS matrix soaks** — do not chase Electron for “same Chromium everywhere” |
| **`reject-for-core`** | Electron swap; UI-owned CRM/auth; framework migration **before** Cut 0 account spine; Matrix/Nostr SDKs as root login |

Next.js is **not** a hard blocker and **not** the long-term ideal for a packaged sovereign client. Switching mid–Cut 0 is the wrong tax. Ranked benefit: **kernel ports + Query-backed read models + WebView OS discipline** beat a router brand change.

## 7. Risks / traps

- Big-bang “delete Next” while Soft L3 / CRM spine unfinished.  
- Expanding TanStack Query into a second source of truth parallel to SQLite.  
- Assuming WebView2 behavior = WKWebView = WebKitGTK.  
- Growing WASM/ffmpeg/emoji weight on cold start.  
- Adding more `@obscur/*` JS engines instead of subtracting toward Rust.

## 8. Open questions

1. Cut UI timing: immediately after Cut 0 design, or after private-trust messaging skim?  
2. Browser PWA: remain Next+SW, or same Vite SPA with adapter?  
3. `next/image` replacement strategy (plain `<img>` + own CDN rules)?  
4. Linux CI WebKitGTK version pin for L2 soaks?  
5. Android/iOS: same SPA binary pipeline as desktop, or deferred shell?

## 9. References

- `docs/exploration/feasibility/09-ideal-stack-thought-experiment.md`  
- `docs/exploration/feasibility/99-synthesis-decision.md`  
- `docs/exploration/feasibility/08-universal-auth-profile-db.md`  
- `apps/pwa/package.json` · `apps/pwa/next.config.ts`  
- `apps/desktop/package.json` · `apps/desktop/src-tauri/Cargo.toml`  
- `apps/desktop/src-tauri/src/profiles.rs` (WebView profile isolation)  
