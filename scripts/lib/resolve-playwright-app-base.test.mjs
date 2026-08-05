import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isHttpReachable,
  playwrightAppBaseDefaults,
  resolvePlaywrightAppBase,
} from "./resolve-playwright-app-base.mjs";

describe("resolve-playwright-app-base", () => {
  it("honors PLAYWRIGHT_BASE_URL without probing", async () => {
    const result = await resolvePlaywrightAppBase({
      env: { PLAYWRIGHT_BASE_URL: "http://127.0.0.1:9999/" },
      fetchImpl: async () => {
        throw new Error("should not probe when env set");
      },
    });
    assert.equal(result.appBase, "http://127.0.0.1:9999");
    assert.equal(result.source, "env");
  });

  it("prefers static :1430 over webpack :3340", async () => {
    const hits = [];
    const result = await resolvePlaywrightAppBase({
      env: {},
      fetchImpl: async (url) => {
        hits.push(String(url));
        if (String(url).includes(":1430")) {
          return { ok: true, status: 200 };
        }
        if (String(url).includes(":3340")) {
          return { ok: true, status: 200 };
        }
        return { ok: false, status: 500 };
      },
    });
    assert.equal(result.appBase, playwrightAppBaseDefaults.STATIC_SHELL);
    assert.equal(result.source, "static_shell");
    assert.equal(result.probed.staticShell, true);
    assert.ok(hits.some((u) => u.includes(":1430")));
    assert.ok(!hits.some((u) => u.includes(":3340")), "must not probe webpack after static hits");
  });

  it("falls back to webpack when static is down", async () => {
    const result = await resolvePlaywrightAppBase({
      env: {},
      fetchImpl: async (url) => {
        if (String(url).includes(":1430")) {
          throw new Error("down");
        }
        if (String(url).includes(":3340")) {
          return { ok: true, status: 200 };
        }
        return { ok: false, status: 500 };
      },
    });
    assert.equal(result.appBase, playwrightAppBaseDefaults.WEBPACK_LIVE);
    assert.equal(result.source, "webpack_live");
  });

  it("defaults to static when nothing is reachable", async () => {
    const result = await resolvePlaywrightAppBase({
      env: {},
      fetchImpl: async () => {
        throw new Error("down");
      },
    });
    assert.equal(result.appBase, playwrightAppBaseDefaults.STATIC_SHELL);
    assert.equal(result.source, "default_static");
  });

  it("isHttpReachable treats 404 as reachable origin", async () => {
    const ok = await isHttpReachable("http://example.test", 100, async () => ({
      ok: false,
      status: 404,
    }));
    assert.equal(ok, true);
  });
});
