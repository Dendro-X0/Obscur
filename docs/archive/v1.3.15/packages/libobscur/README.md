# libobscur

This package holds the shared Rust core for the Obscur project. 

## Purpose
It encapsulates business logic, cryptography, data synchronization, and state management in a memory-safe, high-performance, cross-platform core.

## Integration
- **Desktop**: Consumed natively by the Tauri application (`apps/desktop`).
- **Future Mobile**: Will be exposed via `uniffi` to generate Kotlin (Android) and Swift (iOS) bindings.
- **Future Web**: Can potentially be compiled to WebAssembly for web clients (`apps/pwa`, `apps/website`) if needed.
