import { describe, expect, it } from "vitest";
import en from "@/app/lib/i18n/locales/en.json";
import zh from "@/app/lib/i18n/locales/zh.json";
import es from "@/app/lib/i18n/locales/es.json";
import fr from "@/app/lib/i18n/locales/fr.json";
import de from "@/app/lib/i18n/locales/de.json";

const WRITE_UNLOCK_KEYS = [
  "vault.writeUnlockEyebrow",
  "vault.writeUnlockTitle",
  "vault.writeUnlockDescription",
  "vault.writeUnlockPassphraseLabel",
  "vault.writeUnlockPassphraseRequired",
  "vault.writeUnlockConfirm",
] as const;

describe("vault write unlock i18n", () => {
  it.each([
    ["en", en],
    ["zh", zh],
    ["es", es],
    ["fr", fr],
    ["de", de],
  ] as const)("ships vault.writeUnlock* keys in %s", (_lng, locale) => {
    for (const key of WRITE_UNLOCK_KEYS) {
      const value = locale.translation[key];
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
      expect(value).not.toBe(key);
    }
  });
});
