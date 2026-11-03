import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Platform rewrite band K4 — fence singular `profile` (social display/publish)
 * vs plural `profiles` (slots / isolation / registry). Docs + import ownership.
 */
describe("platform K4 profile vs profiles fence", () => {
  const featuresRoot = path.resolve(__dirname, "..");
  const profileRoot = path.join(featuresRoot, "profile");
  const profilesRoot = path.join(featuresRoot, "profiles");

  const collectProductionTs = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === "node_modules") {
          continue;
        }
        out.push(...collectProductionTs(full));
        continue;
      }
      if (/\.(ts|tsx)$/.test(entry) && !entry.includes(".test.") && !entry.includes(".spec.")) {
        out.push(full);
      }
    }
    return out;
  };

  it("ships README ownership fences for both trees", () => {
    const profileReadme = path.join(profileRoot, "README.md");
    const profilesReadme = path.join(profilesRoot, "README.md");
    expect(existsSync(profileReadme)).toBe(true);
    expect(existsSync(profilesReadme)).toBe(true);

    const singular = readFileSync(profileReadme, "utf8");
    expect(singular).toMatch(/social display/i);
    expect(singular).toContain("use-profile-publisher");
    expect(singular).toMatch(/Does not own/i);
    expect(singular).toMatch(/slots/i);

    const plural = readFileSync(profilesReadme, "utf8");
    expect(plural).toMatch(/slots/i);
    expect(plural).toContain("ProfileRegistryService");
    expect(plural).toMatch(/Does not own/i);
    expect(plural).toMatch(/kind-0|publish/i);
    expect(plural).toContain("use-profile-publisher");
  });

  it("keeps slot/isolation modules out of singular profile/", () => {
    const forbiddenName = /(slot|isolation|registry-service|wipe-profile|desktop-profile-runtime)/i;
    const violations = collectProductionTs(profileRoot)
      .map((file) => path.relative(profileRoot, file).replace(/\\/g, "/"))
      .filter((rel) => forbiddenName.test(rel));
    expect(violations).toEqual([]);
  });

  it("forbids singular profile production from importing slot owners", () => {
    const forbidden = [
      "desktop-profile-runtime",
      "wipe-profile-workspace",
      "profile-slot-login-guard",
      "profile-slot-account-switch",
      "delete-current-profile-window",
      "can-remove-desktop-profile",
      "profile-registry-service",
    ];
    const violations: string[] = [];
    for (const file of collectProductionTs(profileRoot)) {
      const source = readFileSync(file, "utf8");
      const rel = path.relative(profileRoot, file).replace(/\\/g, "/");
      for (const token of forbidden) {
        // Allow PROFILE_CHANGED_EVENT-only import lines that mention the registry module.
        if (token === "profile-registry-service") {
          if (
            /from\s+["'][^"']*profile-registry-service["']/.test(source)
            && !/PROFILE_CHANGED_EVENT/.test(source)
          ) {
            violations.push(`${rel}: ${token}`);
          } else if (
            /from\s+["'][^"']*profile-registry-service["']/.test(source)
            && /ProfileRegistryService/.test(source)
          ) {
            violations.push(`${rel}: ProfileRegistryService`);
          }
          continue;
        }
        if (new RegExp(`from\\s+["'][^"']*${token}["']`).test(source)) {
          violations.push(`${rel}: ${token}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("allows PROFILE_CHANGED_EVENT listen-only from profile registry", () => {
    const useProfile = readFileSync(path.join(profileRoot, "hooks/use-profile.ts"), "utf8");
    expect(useProfile).toContain("PROFILE_CHANGED_EVENT");
    expect(useProfile).toMatch(/from\s+["'][^"']*profile-registry-service["']/);
    expect(useProfile).not.toContain("ProfileRegistryService");
  });

  it("forbids plural profiles from importing social publish owner", () => {
    const violations: string[] = [];
    for (const file of collectProductionTs(profilesRoot)) {
      const source = readFileSync(file, "utf8");
      if (/from\s+["'][^"']*use-profile-publisher["']/.test(source)) {
        violations.push(path.relative(profilesRoot, file).replace(/\\/g, "/"));
      }
    }
    expect(violations).toEqual([]);
  });
});
