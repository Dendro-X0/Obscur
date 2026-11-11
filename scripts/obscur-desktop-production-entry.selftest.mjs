#!/usr/bin/env node
/**
 * Cut 5.3 — production cutover resolver selftest (≠ Soft L3).
 */
import {
  COMMITTED_PRODUCTION_FRONTEND_DIST,
  NEXT_ROLLBACK_FRONTEND_DIST,
  isCommittedProductionStillNext,
  isCommittedProductionVite,
  resolveDesktopProductionEntryId,
  resolveDesktopProductionFrontend,
  resolveDesktopProductionTauriArgs,
} from "./obscur-desktop-production-entry.mjs";

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

assert(resolveDesktopProductionEntryId({}) === "vite", "default production entry is vite after 5.3");
assert(
  resolveDesktopProductionEntryId({ OBSCUR_DESKTOP_UI_AS_DEFAULT: "1" }) === "vite",
  "vestigial opt-in still resolves vite",
);
assert(
  resolveDesktopProductionEntryId({ OBSCUR_DESKTOP_PRODUCTION_ENTRY: "next" }) === "next",
  "explicit rollback to next",
);
assert(
  resolveDesktopProductionFrontend({}).frontendDist === "../../desktop-ui/dist",
  "vite frontendDist",
);
assert(
  resolveDesktopProductionFrontend({ OBSCUR_DESKTOP_PRODUCTION_ENTRY: "next" }).frontendDist
    === "../../pwa/out",
  "next rollback frontendDist",
);
assert(
  isCommittedProductionVite(COMMITTED_PRODUCTION_FRONTEND_DIST),
  "committed dist helper recognizes Vite",
);
assert(
  !isCommittedProductionVite(NEXT_ROLLBACK_FRONTEND_DIST),
  "committed dist helper rejects Next path",
);
assert(
  isCommittedProductionStillNext(NEXT_ROLLBACK_FRONTEND_DIST),
  "legacy helper still recognizes Next rollback path",
);

const viteDev = resolveDesktopProductionTauriArgs("dev", {});
assert(
  viteDev.includes("src-tauri/tauri.vite.lab.conf.json"),
  "vite default dev uses vite lab overlay",
);
const viteBuild = resolveDesktopProductionTauriArgs("build", {});
assert(
  viteBuild.length === 1 && viteBuild[0] === "build",
  "vite default build uses committed config",
);
const nextDev = resolveDesktopProductionTauriArgs("dev", { OBSCUR_DESKTOP_PRODUCTION_ENTRY: "next" });
assert(
  nextDev.includes("src-tauri/tauri.dev.conf.json"),
  "next rollback dev uses tauri.dev.conf.json",
);
const nextBuild = resolveDesktopProductionTauriArgs("build", {
  OBSCUR_DESKTOP_PRODUCTION_ENTRY: "next",
});
assert(
  nextBuild.includes("src-tauri/tauri.next.rollback.conf.json"),
  "next rollback build uses next rollback overlay",
);

console.log("obscur-desktop-production-entry.selftest: Pass (≠ Soft L3 Fixed)");
