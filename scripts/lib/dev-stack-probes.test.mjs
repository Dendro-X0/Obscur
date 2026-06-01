import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_COORDINATION_READY_TIMEOUT_MS,
  resolveReadyTimeoutMs,
  waitForReady,
} from "./dev-stack-probes.mjs";

describe("dev-stack-probes", () => {
  it("uses a longer default coordination timeout on Windows", () => {
    if (process.platform === "win32") {
      assert.ok(DEFAULT_COORDINATION_READY_TIMEOUT_MS >= 180_000);
    } else {
      assert.ok(DEFAULT_COORDINATION_READY_TIMEOUT_MS >= 90_000);
    }
  });

  it("resolveReadyTimeoutMs falls back for invalid env values", () => {
    assert.equal(resolveReadyTimeoutMs(undefined, 90_000), 90_000);
    assert.equal(resolveReadyTimeoutMs("not-a-number", 90_000), 90_000);
    assert.equal(resolveReadyTimeoutMs("150000", 90_000), 150_000);
  });

  it("waitForReady resolves when probe succeeds", async () => {
    let calls = 0;
    const result = await waitForReady("test", async () => {
      calls += 1;
      return calls >= 2;
    }, { maxMs: 5_000, pollMs: 10, progressEveryMs: 1_000 });

    assert.equal(result.ok, true);
    assert.ok(calls >= 2);
  });

  it("waitForReady times out when probe never succeeds", async () => {
    const result = await waitForReady("test", async () => false, {
      maxMs: 40,
      pollMs: 10,
      progressEveryMs: 1_000,
    });

    assert.equal(result.ok, false);
    assert.ok(result.elapsedMs >= 40);
  });
});
