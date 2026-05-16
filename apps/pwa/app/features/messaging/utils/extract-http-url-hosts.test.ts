import { describe, expect, it } from "vitest";
import { extractHttpUrlHostsFromText } from "./extract-http-url-hosts";

describe("extractHttpUrlHostsFromText", () => {
  it("returns empty for empty or whitespace", () => {
    expect(extractHttpUrlHostsFromText("")).toEqual([]);
    expect(extractHttpUrlHostsFromText("   ")).toEqual([]);
  });

  it("extracts a single https host", () => {
    expect(extractHttpUrlHostsFromText("see https://example.com/path")).toEqual(["example.com"]);
  });

  it("extracts http host", () => {
    expect(extractHttpUrlHostsFromText("http://api.test.dev/v1")).toEqual(["api.test.dev"]);
  });

  it("dedupes same host and preserves order", () => {
    expect(
      extractHttpUrlHostsFromText("a https://x.com b https://Y.COM c https://x.com/2"),
    ).toEqual(["x.com", "y.com"]);
  });

  it("trims trailing punctuation from captured token", () => {
    expect(extractHttpUrlHostsFromText("link https://a.com). second")).toEqual(["a.com"]);
  });

  it("lists multiple distinct hosts", () => {
    expect(
      extractHttpUrlHostsFromText("one https://a.org two http://b.net"),
    ).toEqual(["a.org", "b.net"]);
  });
});
