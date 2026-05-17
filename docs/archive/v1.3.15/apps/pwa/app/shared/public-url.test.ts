import { describe, expect, it } from "vitest";
import { isSupportedPublicUrl, normalizePublicUrl, publicUrlInternals } from "./public-url";

describe("public-url", () => {
  it("keeps absolute http urls unchanged", () => {
    expect(normalizePublicUrl("https://cdn.example.com/avatar.png")).toBe("https://cdn.example.com/avatar.png");
    expect(publicUrlInternals.isAbsoluteHttpUrl("http://localhost:3340/uploads/a.png")).toBe(true);
  });

  it("expands local paths against the current origin", () => {
    expect(normalizePublicUrl("/uploads/avatar.png", { origin: "http://127.0.0.1:3340" })).toBe(
      "http://127.0.0.1:3340/uploads/avatar.png"
    );
  });

  it("preserves local paths when no origin is available", () => {
    expect(normalizePublicUrl("/uploads/avatar.png", { origin: null })).toBe("/uploads/avatar.png");
  });

  it("treats local paths and absolute http urls as supported public urls", () => {
    expect(isSupportedPublicUrl("/uploads/avatar.png")).toBe(true);
    expect(isSupportedPublicUrl("https://cdn.example.com/avatar.png")).toBe(true);
    expect(isSupportedPublicUrl("blob:temp-preview")).toBe(false);
  });
});
