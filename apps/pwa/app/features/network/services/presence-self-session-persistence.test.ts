import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearPresenceSelfSession,
  readOrCreatePresenceSelfSession,
} from "./presence-self-session-persistence";

const PK = "a".repeat(64);

describe("presence-self-session-persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("reuses the same session for the same account", () => {
    const first = readOrCreatePresenceSelfSession(PK as any);
    const second = readOrCreatePresenceSelfSession(PK as any);
    expect(second).toEqual(first);
  });

  it("creates a new session after clearing the stored record", () => {
    const first = readOrCreatePresenceSelfSession(PK as any);
    clearPresenceSelfSession(PK as any);
    const second = readOrCreatePresenceSelfSession(PK as any);
    expect(second.sessionId).not.toBe(first.sessionId);
  });
});
