import { describe, expect, it } from "vitest";
import { decodeRouteToken, resolveGroupRouteToken } from "./group-route-token";

describe("group-route-token", () => {
  it("prefers query id over route param", () => {
    expect(resolveGroupRouteToken({
      routeParam: ["view"],
      queryId: "community%3Adelta%3Awss%3A%2F%2Frelay.delta",
    })).toBe("community:delta:wss://relay.delta");
  });

  it("uses route param when query id is absent", () => {
    expect(resolveGroupRouteToken({
      routeParam: ["community%3Aalpha%3Awss%3A%2F%2Frelay.alpha"],
      queryId: null,
    })).toBe("community:alpha:wss://relay.alpha");
  });

  it("treats /groups/view route param as empty placeholder", () => {
    expect(resolveGroupRouteToken({
      routeParam: ["view"],
      queryId: "",
    })).toBe("");
  });

  it("decodes safely and preserves undecodable tokens", () => {
    expect(decodeRouteToken("community%3Abeta")).toBe("community:beta");
    expect(decodeRouteToken("%E0%A4%A")).toBe("%E0%A4%A");
  });
});
