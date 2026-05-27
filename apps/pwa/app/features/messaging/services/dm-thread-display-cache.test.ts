import { describe, expect, it } from "vitest";
import {
  readDmThreadDisplayCache,
  resetDmThreadDisplayCacheForTests,
  writeDmThreadDisplayCache,
} from "./dm-thread-display-cache";
import type { Message } from "../types";

const profileId = "profile-1";
const conversationId = "dm:a:b";

const message = (id: string): Message => ({
  id,
  kind: "user",
  content: "test",
  timestamp: new Date(),
  isOutgoing: false,
  status: "delivered",
  conversationId,
});

describe("dm-thread-display-cache", () => {
  it("stores and reads display rows per profile and conversation", () => {
    resetDmThreadDisplayCacheForTests();
    expect(readDmThreadDisplayCache(profileId, conversationId)).toBeNull();
    writeDmThreadDisplayCache(profileId, conversationId, [message("m1")]);
    expect(readDmThreadDisplayCache(profileId, conversationId)?.map((row) => row.id)).toEqual(["m1"]);
  });
});
