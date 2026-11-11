#!/usr/bin/env node
/**
 * Cut 3.4 — headless selftest for lab entry resolver (vitest cannot reliably
 * dynamic-import repo scripts/ on Windows paths with spaces).
 */
import assert from "node:assert/strict";
import {
  DESKTOP_ENTRY_CONFIG,
  resolveDesktopLabEntryId,
} from "./obscur-desktop-lab-entry.mjs";

assert.equal(resolveDesktopLabEntryId({}, { labContext: true }), "vite");
assert.equal(resolveDesktopLabEntryId({ OBSCUR_TAURI_LAB_UI: "1" }), "vite");
assert.equal(
  resolveDesktopLabEntryId({
    OBSCUR_TAURI_LAB_UI: "1",
    OBSCUR_DESKTOP_LAB_ENTRY: "next",
  }),
  "next",
);
assert.equal(resolveDesktopLabEntryId({}), "next");
assert.equal(
  DESKTOP_ENTRY_CONFIG.vite.tauriConfig,
  "src-tauri/tauri.vite.lab.conf.json",
);
assert.equal(
  DESKTOP_ENTRY_CONFIG.next.tauriConfig,
  "src-tauri/tauri.dev.conf.json",
);

console.log("obscur-desktop-lab-entry.selftest: Pass");
