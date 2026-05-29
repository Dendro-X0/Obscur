import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildCompactDeleteSql,
  eventIdToSqlBlob,
} from "./operator-relay-storage-compact.mjs";

describe("operator-relay-storage-compact", () => {
  it("formats event id as sqlite blob literal", () => {
    const id = "a".repeat(64);
    assert.equal(eventIdToSqlBlob(id), `x'${id}'`);
  });

  it("builds DELETE sql for nostr-rs-relay event_hash", () => {
    const id = "b".repeat(64);
    assert.equal(
      buildCompactDeleteSql(id),
      `DELETE FROM event WHERE event_hash = x'${id}';`,
    );
  });

  it("rejects invalid hex", () => {
    assert.throws(() => eventIdToSqlBlob("not-hex"), /Invalid event id/);
  });
});
