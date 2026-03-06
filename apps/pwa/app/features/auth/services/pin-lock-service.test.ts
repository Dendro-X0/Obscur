import { beforeEach, describe, expect, it } from "vitest";
import { PinLockService } from "./pin-lock-service";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";

const PUBLIC_KEY = "f".repeat(64);
const LEGACY_KEY = `obscur.pin_lock.v1.${PUBLIC_KEY}`;
const SCOPED_KEY = getScopedStorageKey(LEGACY_KEY);

describe("pin-lock-service storage compatibility", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("detects pin from scoped storage key", () => {
    window.localStorage.setItem(SCOPED_KEY, JSON.stringify({ version: 1 }));
    expect(PinLockService.hasPin(PUBLIC_KEY)).toBe(true);
  });

  it("detects pin from legacy storage key", () => {
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify({ version: 1 }));
    expect(PinLockService.hasPin(PUBLIC_KEY)).toBe(true);
  });

  it("removes both scoped and legacy keys", () => {
    window.localStorage.setItem(SCOPED_KEY, JSON.stringify({ version: 1 }));
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify({ version: 1 }));
    PinLockService.removePin(PUBLIC_KEY);
    expect(window.localStorage.getItem(SCOPED_KEY)).toBeNull();
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull();
  });
});

