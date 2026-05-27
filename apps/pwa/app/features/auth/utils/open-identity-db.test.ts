import { describe, expect, it } from "vitest";

import { openIdentityDb } from "./open-identity-db";

describe("openIdentityDb", () => {
  it("opens in-memory identity store without IndexedDB", async () => {
    const db = await openIdentityDb();
    expect(db.objectStoreNames.contains("identity")).toBe(true);
    db.close();
  });
});
