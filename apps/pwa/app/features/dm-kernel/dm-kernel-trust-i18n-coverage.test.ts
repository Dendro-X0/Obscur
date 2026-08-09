import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveTrustCopyKey } from "./dm-kernel-trust-copy-keys";
import { BUNDLE_SE_COLD } from "./dm-kernel-trust-assessment-port";

const enLocalePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../lib/i18n/locales/en.json",
);

const loadEnFlat = (): Record<string, string> => {
  const parsed = JSON.parse(readFileSync(enLocalePath, "utf8")) as {
    translation?: Record<string, string>;
  };
  return parsed.translation ?? (parsed as Record<string, string>);
};

describe("trust notice i18n coverage", () => {
  it("resolves off-platform copy keys that exist in en.json", () => {
    const en = loadEnFlat();
    const copyKey = resolveTrustCopyKey(
      ["contact.cold", "thread.off_platform_redirect"],
      BUNDLE_SE_COLD,
      "elevated",
    );
    expect(copyKey).toBe("messaging.trust.seOffPlatformCold");
    expect(en[copyKey]?.length).toBeGreaterThan(10);
    expect(en["messaging.trust.signal.thread.off_platform_redirect"]?.length).toBeGreaterThan(5);
    expect(en[copyKey]).not.toBe(copyKey);
  });
});
