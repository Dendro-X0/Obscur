import { describe, expect, it } from "vitest";
import { resolveConversationListAuthority } from "./conversation-list-authority";

describe("resolveConversationListAuthority", () => {
  it("always uses sqlite on native runtime even when SQLite is empty", () => {
    expect(resolveConversationListAuthority({
      isNativeRuntime: true,
      sqliteConversationCount: 0,
      useProjectionReads: true,
      projectionConversationCount: 2,
    })).toEqual({
      authority: "sqlite",
      reason: "sqlite_native",
    });
  });

  it("uses sqlite on native when SQLite has conversations", () => {
    expect(resolveConversationListAuthority({
      isNativeRuntime: true,
      sqliteConversationCount: 3,
      useProjectionReads: true,
      projectionConversationCount: 3,
    })).toEqual({
      authority: "sqlite",
      reason: "sqlite_native",
    });
  });

  it("prefers projection when projection reads are enabled and projection has conversations", () => {
    expect(resolveConversationListAuthority({
      isNativeRuntime: false,
      sqliteConversationCount: 0,
      useProjectionReads: true,
      projectionConversationCount: 2,
    })).toEqual({
      authority: "projection",
      reason: "projection_read_cutover",
    });
  });

  it("falls back to persisted when projection reads are disabled", () => {
    expect(resolveConversationListAuthority({
      isNativeRuntime: false,
      sqliteConversationCount: 0,
      useProjectionReads: false,
      projectionConversationCount: 2,
    })).toEqual({
      authority: "persisted",
      reason: "persisted_fallback",
    });
  });

  it("falls back to persisted when legacy chat-state is richer than projection", () => {
    expect(resolveConversationListAuthority({
      isNativeRuntime: false,
      sqliteConversationCount: 0,
      useProjectionReads: true,
      projectionConversationCount: 2,
      legacyChatStateHasRicherDmContent: true,
    })).toEqual({
      authority: "persisted",
      reason: "legacy_richer_than_projection",
    });
  });

  it("falls back to persisted when projection is enabled but empty", () => {
    expect(resolveConversationListAuthority({
      isNativeRuntime: false,
      sqliteConversationCount: 0,
      useProjectionReads: true,
      projectionConversationCount: 0,
    })).toEqual({
      authority: "persisted",
      reason: "persisted_fallback",
    });
  });
});
