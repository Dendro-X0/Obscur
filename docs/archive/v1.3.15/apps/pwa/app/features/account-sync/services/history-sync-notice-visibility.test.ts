import { describe, expect, it } from "vitest";
import {
  FIRST_LOGIN_HISTORY_SYNC_NOTICE_MIN_VISIBLE_MS,
  resolveHistorySyncNoticeVisible,
  shouldStartFirstLoginHistorySyncNoticeHold,
} from "./history-sync-notice-visibility";

describe("historySyncNoticeVisibility", () => {
  it("starts first-login hold only when identity is unlocked, history sync notice is active, and chat history is empty", () => {
    expect(shouldStartFirstLoginHistorySyncNoticeHold({
      isIdentityUnlocked: true,
      showInitialHistorySyncNotice: true,
      hasVisibleConversations: false,
      accountPublicKeyHex: "f".repeat(64),
      hasSeenFirstLoginNotice: false,
    })).toBe(true);

    expect(shouldStartFirstLoginHistorySyncNoticeHold({
      isIdentityUnlocked: true,
      showInitialHistorySyncNotice: true,
      hasVisibleConversations: true,
      accountPublicKeyHex: "f".repeat(64),
      hasSeenFirstLoginNotice: false,
    })).toBe(false);

    expect(shouldStartFirstLoginHistorySyncNoticeHold({
      isIdentityUnlocked: true,
      showInitialHistorySyncNotice: false,
      hasVisibleConversations: false,
      accountPublicKeyHex: "f".repeat(64),
      hasSeenFirstLoginNotice: false,
    })).toBe(false);
  });

  it("suppresses first-login hold when this account already showed the minimum-duration notice once", () => {
    expect(shouldStartFirstLoginHistorySyncNoticeHold({
      isIdentityUnlocked: true,
      showInitialHistorySyncNotice: true,
      hasVisibleConversations: false,
      accountPublicKeyHex: "f".repeat(64),
      hasSeenFirstLoginNotice: true,
    })).toBe(false);
  });

  it("keeps notice visible while the hold timer is active even after policy visibility turns off", () => {
    const now = 1_700_000_000_000;
    const holdUntil = now + FIRST_LOGIN_HISTORY_SYNC_NOTICE_MIN_VISIBLE_MS;

    expect(resolveHistorySyncNoticeVisible({
      policyVisible: false,
      holdVisibleUntilUnixMs: holdUntil,
      nowUnixMs: now + 5_000,
    })).toBe(true);

    expect(resolveHistorySyncNoticeVisible({
      policyVisible: false,
      holdVisibleUntilUnixMs: holdUntil,
      nowUnixMs: holdUntil + 1,
    })).toBe(false);
  });

  it("always honors direct policy visibility regardless of timer state", () => {
    expect(resolveHistorySyncNoticeVisible({
      policyVisible: true,
      holdVisibleUntilUnixMs: null,
      nowUnixMs: Date.now(),
    })).toBe(true);
  });
});

