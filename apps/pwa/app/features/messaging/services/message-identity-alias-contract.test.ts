import { describe, expect, it } from "vitest";
import { collectMessageIdentityAliases } from "./message-identity-alias-contract";

describe("message-identity-alias-contract", () => {
  it("collects both id and canonical eventId aliases", () => {
    expect(collectMessageIdentityAliases({
      id: "local-wrapper-id",
      eventId: "canonical-event-id",
    })).toEqual(["local-wrapper-id", "canonical-event-id"]);
  });

  it("dedupes and trims alias values", () => {
    expect(collectMessageIdentityAliases({
      id: "  same-id  ",
      eventId: "same-id",
    })).toEqual(["same-id"]);
  });

  it("ignores missing or invalid identity values", () => {
    expect(collectMessageIdentityAliases({
      id: "   ",
      eventId: 1234,
    })).toEqual([]);
  });
});
