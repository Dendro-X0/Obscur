import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const DESKTOP_UI_SRC = HERE;
const REPO_ROOT = join(HERE, "../../..");

const readText = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

const collectTsFiles = (dir: string): string[] => {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...collectTsFiles(full));
      continue;
    }
    if (/\.(ts|tsx)$/.test(name) && !name.includes(".test.") && !name.includes(".contract.")) {
      out.push(full);
    }
  }
  return out;
};

describe("Official Beta OB2 AuthDoor + ui-kit tokens", () => {
  it("depends on @dweb/ui-kit and Tailwind for remaster face", () => {
    const pkg = JSON.parse(readText("apps/desktop-ui/package.json")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.["@dweb/ui-kit"]).toBeTruthy();
    expect(pkg.devDependencies?.tailwindcss).toBeTruthy();
    expect(pkg.devDependencies?.["@tailwindcss/vite"]).toBeTruthy();

    const vite = readText("apps/desktop-ui/vite.config.ts");
    expect(vite).toContain("@tailwindcss/vite");
    expect(vite).toContain("tailwindcss()");
  });

  it("ports Obscur CSS tokens and ui-kit source into styles.css", () => {
    const css = readText("apps/desktop-ui/src/styles.css");
    expect(css).toContain('@import "tailwindcss"');
    expect(css).toContain("@source \"../../../packages/ui-kit/src\"");
    expect(css).toContain("--gradient-primary");
    expect(css).toContain(".bg-gradient-primary");
    expect(css).toContain(".btn-enhanced");
    expect(css).toContain(".dark");
  });

  it("restyles AuthDoor with ui-kit primitives on remaster ports only", () => {
    const authDoor = readText("apps/desktop-ui/src/auth/AuthDoor.tsx");
    expect(authDoor).toContain('@dweb/ui-kit/button');
    expect(authDoor).toContain('@dweb/ui-kit/input');
    expect(authDoor).toContain('@dweb/ui-kit/label');
    expect(authDoor).toContain("DeviceUnlockPort");
    expect(authDoor).not.toMatch(/from ["']@\/app\/features\//);
    expect(authDoor).not.toContain("usePeerTrust");
    expect(authDoor).not.toContain("MessagingProvider");
    expect(authDoor).not.toContain("auth-button");
    expect(authDoor).not.toContain("auth-input");
  });

  it("drops lab product title", () => {
    const html = readText("apps/desktop-ui/index.html");
    expect(html).toContain("<title>Obscur</title>");
    expect(html).not.toMatch(/desktop-ui lab/i);
    expect(html).toContain('class="dark"');
  });

  it("keeps desktop-ui free of pwa feature imports after OB2", () => {
    const files = collectTsFiles(DESKTOP_UI_SRC);
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (/from ["']@\/app\/features\//.test(text)) {
        hits.push(relative(DESKTOP_UI_SRC, file));
      }
    }
    expect(hits).toEqual([]);
  });

  it("documents OB2 closeout without Soft L3 / Continuity Pass claims", () => {
    const closeout = readText(
      "specs/backend/official-beta-ob2-auth-ui-kit-2026-11-11.md",
    );
    expect(closeout).toContain("CLOSED");
    expect(closeout).toContain("@dweb/ui-kit");
    expect(closeout).toContain("AuthDoor");
    expect(closeout).toContain("≠ Continuity Pass");
    expect(closeout).toContain("Soft L3 Fixed");
    expect(closeout).not.toMatch(/Soft L3 Fixed\s*\*\*Pass\*\*/);
    expect(closeout).not.toMatch(/Continuity Pass\s*\*\*claimed\*\*/);
    expect(closeout).toContain("OB3");
  });
});
