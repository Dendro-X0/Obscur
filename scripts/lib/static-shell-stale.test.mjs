import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  STATIC_SHELL_SOURCE_ROOTS,
  isStaticShellStale,
  resolveStaticShellSourceRevision,
} from "./static-shell-stale.mjs";

const touch = (filePath, mtimeMs) => {
  mkdirSync(join(filePath, ".."), { recursive: true });
  writeFileSync(filePath, "// test\n", "utf8");
  const atime = new Date(mtimeMs);
  utimesSync(filePath, atime, atime);
};

describe("static-shell-stale", () => {
  it("includes apps/pwa/app in source roots (components, settings, vault)", () => {
    assert.ok(STATIC_SHELL_SOURCE_ROOTS.some((root) => root === "apps/pwa/app"));
  });

  it("includes workspace conduit-mesh packages in source roots", () => {
    assert.ok(STATIC_SHELL_SOURCE_ROOTS.includes("packages/obscur-conduit-mesh"));
    assert.ok(STATIC_SHELL_SOURCE_ROOTS.includes("packages/obscur-conduit-mesh-contracts"));
    assert.ok(STATIC_SHELL_SOURCE_ROOTS.includes("packages/obscur-transport-engine"));
  });

  it("detects staleness when packages/obscur-conduit-mesh changes after out/index.html", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "obscur-shell-stale-pkg-"));
    try {
      const outIndex = join(repoRoot, "apps", "pwa", "out", "index.html");
      const packageSource = join(
        repoRoot,
        "packages",
        "obscur-conduit-mesh",
        "src",
        "index.ts",
      );

      touch(outIndex, Date.UTC(2026, 6, 1, 12, 0, 0));
      touch(packageSource, Date.UTC(2026, 6, 10, 12, 0, 0));

      const stale = isStaticShellStale(repoRoot);
      assert.equal(stale.stale, true);
      assert.match(stale.reason, /obscur-conduit-mesh/);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("detects staleness when app/components changes after out/index.html", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "obscur-shell-stale-"));
    try {
      const outIndex = join(repoRoot, "apps", "pwa", "out", "index.html");
      const component = join(repoRoot, "apps", "pwa", "app", "components", "language-selector.tsx");

      touch(outIndex, Date.UTC(2026, 6, 1, 12, 0, 0));
      touch(component, Date.UTC(2026, 6, 10, 12, 0, 0));

      const stale = isStaticShellStale(repoRoot);
      assert.equal(stale.stale, true);
      assert.match(stale.reason, /language-selector\.tsx/);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("reports current when out/index.html is newer than sources", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "obscur-shell-stale-"));
    try {
      const outIndex = join(repoRoot, "apps", "pwa", "out", "index.html");
      const component = join(repoRoot, "apps", "pwa", "app", "components", "language-selector.tsx");

      touch(component, Date.UTC(2026, 6, 1, 12, 0, 0));
      touch(outIndex, Date.UTC(2026, 6, 10, 12, 0, 0));

      const stale = isStaticShellStale(repoRoot);
      assert.equal(stale.stale, false);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("resolveStaticShellSourceRevision finds newest app file", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "obscur-shell-stale-"));
    try {
      touch(join(repoRoot, "apps", "pwa", "app", "components", "a.tsx"), Date.UTC(2026, 6, 1));
      touch(join(repoRoot, "apps", "pwa", "app", "settings", "b.tsx"), Date.UTC(2026, 6, 9));

      const revision = resolveStaticShellSourceRevision(repoRoot);
      assert.match(revision.relativeNewestPath ?? "", /settings[\\/]b\.tsx/);
      assert.match(revision.stamp, /^shell-/);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
