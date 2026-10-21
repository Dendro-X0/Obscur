import { describe, expect, it } from "vitest";
import {
  CommunityNetworkTimeoutError,
  withCommunityNetworkTimeout,
} from "./community-network-timeout";

describe("withCommunityNetworkTimeout", () => {
  it("rejects when operation exceeds timeout", async () => {
    await expect(
      withCommunityNetworkTimeout(new Promise<void>(() => { /* hang */ }), 50),
    ).rejects.toBeInstanceOf(CommunityNetworkTimeoutError);
  });

  it("returns result when operation finishes in time", async () => {
    await expect(withCommunityNetworkTimeout(Promise.resolve("ok"), 1000)).resolves.toBe("ok");
  });
});
