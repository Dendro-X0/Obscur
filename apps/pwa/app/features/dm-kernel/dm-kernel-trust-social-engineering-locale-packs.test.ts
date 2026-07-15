import { describe, expect, it } from "vitest";
import {
  mergeSeLocalePatterns,
  matchesSePatternGroup,
  SE_LOCALE_PATTERN_PACKS,
} from "./dm-kernel-trust-social-engineering-locale-packs";

describe("dm-kernel-trust-social-engineering-locale-packs", () => {
  it("detects Spanish credential harvest phrases", () => {
    const patterns = SE_LOCALE_PATTERN_PACKS.es.credentialHarvest;
    expect(matchesSePatternGroup(patterns, "Envíame tu frase semilla para verificar")).toBe(true);
    expect(matchesSePatternGroup(patterns, "Comparte tu clave privada ahora")).toBe(true);
    expect(matchesSePatternGroup(patterns, "Hola, ¿quedamos mañana?")).toBe(false);
  });

  it("detects Chinese authority impersonation phrases", () => {
    const patterns = SE_LOCALE_PATTERN_PACKS.zh.authorityImpersonation;
    expect(matchesSePatternGroup(patterns, "Obscur官方支持：您的账户已被冻结")).toBe(true);
    expect(matchesSePatternGroup(patterns, "我是人事总监，有紧急请求")).toBe(true);
    expect(matchesSePatternGroup(patterns, "明天见")).toBe(false);
  });

  it("merges base English patterns with locale packs", () => {
    const merged = mergeSeLocalePatterns([/\bhello\b/i], "giftCardScam");
    expect(matchesSePatternGroup(merged, "Compra tarjetas de regalo y envíame los códigos")).toBe(true);
    expect(matchesSePatternGroup(merged, "购买礼品卡并把密码发给我")).toBe(true);
  });
});
