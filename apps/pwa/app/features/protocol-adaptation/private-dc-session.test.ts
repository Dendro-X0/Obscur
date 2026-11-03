import { afterEach, describe, expect, it } from "vitest";
import {
  clearPrivateDcSession,
  hasPrivateDcSession,
  readPrivateDcSession,
  writePrivateDcSession,
} from "./private-dc-session";

describe("private-dc-session (P4)", () => {
  afterEach(() => {
    clearPrivateDcSession("tester-p4");
  });

  it("round-trips a valid https base URL", () => {
    writePrivateDcSession({
      baseUrl: "https://dc.example.com/api/",
      bearerToken: " secret ",
      displayName: "Acme",
    }, "tester-p4");
    expect(hasPrivateDcSession("tester-p4")).toBe(true);
    expect(readPrivateDcSession("tester-p4")).toEqual({
      baseUrl: "https://dc.example.com/api",
      bearerToken: "secret",
      displayName: "Acme",
    });
  });

  it("rejects non-http base URLs", () => {
    expect(() => writePrivateDcSession({
      baseUrl: "ftp://bad.example",
    }, "tester-p4")).toThrow(/http/i);
    expect(hasPrivateDcSession("tester-p4")).toBe(false);
  });
});
