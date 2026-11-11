import { describe, expect, it } from "vitest";
import {
  CHAT_STATE_AS_SOLE_CRM_REFUSED,
  mayInventAcceptedPeersFromChatStateAlone,
  resolveContinuityCrmAuthority,
  resolveContinuityT3Authority,
} from "./t3-authority-policy";

describe("t3-authority-policy (Cut 7.3)", () => {
  it("prefers sqlite T3 on native when evidence present", () => {
    expect(resolveContinuityT3Authority({
      isNativeRuntime: true,
      hasNativeSqliteEvidence: true,
      hasChatStateMessages: true,
    })).toBe("sqlite");
  });

  it("falls back to chat_state_partial when not native / no sqlite", () => {
    expect(resolveContinuityT3Authority({
      isNativeRuntime: false,
      hasNativeSqliteEvidence: false,
      hasChatStateMessages: true,
    })).toBe("chat_state_partial");
  });

  it("refuses inventing CRM from chat-state alone", () => {
    expect(mayInventAcceptedPeersFromChatStateAlone()).toBe(false);
    const result = resolveContinuityCrmAuthority({
      stickyAcceptedPeerCount: 0,
      nativeSqlitePeerHintCount: 0,
      chatStatePeerHintCount: 3,
    });
    expect(result.authority).toBe("none");
    expect(result.refusedChatStateInvention).toBe(true);
    expect(result.reasonCode).toBe(CHAT_STATE_AS_SOLE_CRM_REFUSED);
  });

  it("allows sticky CRM and sqlite residue without chat invention", () => {
    expect(resolveContinuityCrmAuthority({
      stickyAcceptedPeerCount: 2,
      nativeSqlitePeerHintCount: 0,
      chatStatePeerHintCount: 0,
    }).authority).toBe("sticky_crm");
    expect(resolveContinuityCrmAuthority({
      stickyAcceptedPeerCount: 0,
      nativeSqlitePeerHintCount: 1,
      chatStatePeerHintCount: 0,
    }).authority).toBe("sqlite_residue");
  });
});
