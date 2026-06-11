import { describe, expect, it } from "vitest";
import {
  resolveDmKernelStorageConversationId,
  resolveDmKernelThreadQueryConversationIds,
} from "./dm-kernel-thread-query";

const myPublicKeyHex = "a".repeat(64);
const peerPublicKeyHex = "b".repeat(64);
const canonicalConversationId = [myPublicKeyHex, peerPublicKeyHex].sort().join(":");

describe("dm-kernel thread query", () => {
  it("resolves canonical storage id from legacy peer-only conversation id", () => {
    expect(resolveDmKernelStorageConversationId({
      conversationId: peerPublicKeyHex,
      myPublicKeyHex,
    })).toBe(canonicalConversationId);
  });

  it("includes canonical and legacy ids in sqlite query aliases", () => {
    const ids = resolveDmKernelThreadQueryConversationIds({
      conversationId: peerPublicKeyHex,
      myPublicKeyHex,
    });
    expect(ids).toContain(peerPublicKeyHex);
    expect(ids).toContain(canonicalConversationId);
  });
});
