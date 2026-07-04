/**
 * M4 Legacy Deletion and Anti-Drift Tests (AB-13)
 *
 * Exit criteria:
 *   1. Browser-global community mutation events are quarantined when the event
 *      payload's identity does not match the active provider identity.
 *   2. Events without an identity field are still accepted (backward compat).
 *   3. Events with a matching identity are accepted.
 *
 * Verifies the same-process A/B isolation requirement: account A's provider
 * must not apply community mutations dispatched for account B.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { setProfileScopeOverride } from "@/app/features/profiles/services/profile-scope";
import { setProfileRuntimeScope } from "@/app/features/profiles/services/profile-runtime-scope";

const PK_A = "a".repeat(64) as PublicKeyHex;
const PK_B = "b".repeat(64) as PublicKeyHex;
let activePublicKeyHex: PublicKeyHex = PK_A;

const GROUP_ID = "quarantine-test-group";
const RELAY_URL = "wss://relay.quarantine";

// ---------------------------------------------------------------------------
// Module mocks — must be hoisted before imports that use them
// ---------------------------------------------------------------------------

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
  useIdentity: () => ({
    state: {
      status: "unlocked",
      publicKeyHex: activePublicKeyHex,
      stored: { publicKeyHex: activePublicKeyHex },
    },
  }),
}));

vi.mock("@/app/shared/account-sync-mutation-signal", () => ({
  emitAccountSyncMutation: vi.fn(),
}));

const { logAppEventMock } = vi.hoisted(() => ({
  logAppEventMock: vi.fn(),
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: logAppEventMock,
}));

vi.mock("@dweb/storage/indexed-db", () => ({
  messagingDB: {
    put: vi.fn(async () => undefined),
    get: vi.fn(async () => null),
    ensureDB: vi.fn(),
  },
}));

const { upsertLedgerMock } = vi.hoisted(() => ({
  upsertLedgerMock: vi.fn(),
}));

vi.mock("../services/community-membership-ledger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/community-membership-ledger")>();
  return { ...actual, upsertCommunityMembershipLedgerEntry: upsertLedgerMock };
});

const m4TestBus = vi.hoisted(() => {
  const { createProfileMessageBus } =
    require("@dweb/core/profile-message-bus") as typeof import("@dweb/core/profile-message-bus");
  return createProfileMessageBus({ profileId: "default" });
});

vi.mock("@/app/features/profiles/providers/profile-runtime-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/features/profiles/providers/profile-runtime-provider")>();
  return {
    ...actual,
    useOptionalProfileMessageBus: () => m4TestBus,
  };
});

import {
  dispatchGroupInviteResponseAccepted,
  dispatchGroupMembershipConfirmed,
} from "@/app/features/profiles/services/profile-bus-dispatch";
import { LegacyGroupProvider, useGroups } from "@/app/features/groups/providers/group-provider-port";
import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store-legacy";

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(LegacyGroupProvider, null, children);

// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  setProfileScopeOverride(null);
  setProfileRuntimeScope({ profileId: "default", bus: m4TestBus });
  activePublicKeyHex = PK_A;
  const emptyState = {
    version: 2 as const,
    createdConnections: [],
    createdGroups: [],
    unreadByConversationId: {},
    connectionOverridesByConnectionId: {},
    messagesByConversationId: {},
    groupMessages: {},
    connectionRequests: [],
    pinnedChatIds: [],
    hiddenChatIds: [],
  };
  chatStateStoreService.replace(PK_A, emptyState, { emitMutationSignal: false });
  chatStateStoreService.replace(PK_B, emptyState, { emitMutationSignal: false });
});

const isQuarantineEvent = (call: unknown[]) =>
  (call[0] as { name?: string })?.name === "groups.event_quarantined_identity_mismatch";

// ---------------------------------------------------------------------------
// AB-13: identity mismatch quarantine
// ---------------------------------------------------------------------------

describe("AB-13 — browser-global mutation event identity quarantine", () => {
  it("obscur:group-invite-response-accepted is quarantined when recipientPublicKeyHex differs from active identity", async () => {
    renderHook(() => useGroups(), { wrapper });

    act(() => {
      dispatchGroupInviteResponseAccepted({
          groupId: GROUP_ID,
          relayUrl: RELAY_URL,
          memberPubkey: "some-peer-pubkey",
          recipientPublicKeyHex: PK_B,
      });
    });

    await waitFor(() => {
      expect(logAppEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "groups.event_quarantined_identity_mismatch",
        }),
      );
    });

    expect(upsertLedgerMock).not.toHaveBeenCalled();
  });

  it("obscur:group-membership-confirmed is quarantined when publicKeyHex differs from active identity", async () => {
    renderHook(() => useGroups(), { wrapper });

    act(() => {
      dispatchGroupMembershipConfirmed({
          groupId: GROUP_ID,
          relayUrl: RELAY_URL,
          memberPubkeys: [PK_B],
          publicKeyHex: PK_B,
      });
    });

    await waitFor(() => {
      expect(logAppEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "groups.event_quarantined_identity_mismatch",
        }),
      );
    });

    expect(upsertLedgerMock).not.toHaveBeenCalled();
  });

  it("obscur:group-invite-response-accepted is accepted when recipientPublicKeyHex matches active identity", async () => {
    renderHook(() => useGroups(), { wrapper });

    act(() => {
      dispatchGroupInviteResponseAccepted({
          groupId: GROUP_ID,
          relayUrl: RELAY_URL,
          memberPubkey: "some-peer-pubkey",
          recipientPublicKeyHex: PK_A,
      });
    });

    await new Promise((r) => setTimeout(r, 50));
    const quarantineCalls = logAppEventMock.mock.calls.filter(isQuarantineEvent);
    expect(quarantineCalls).toHaveLength(0);
  });

  it("obscur:group-membership-confirmed is accepted when publicKeyHex matches active identity", async () => {
    renderHook(() => useGroups(), { wrapper });

    act(() => {
      dispatchGroupMembershipConfirmed({
          groupId: GROUP_ID,
          relayUrl: RELAY_URL,
          memberPubkeys: [PK_A],
          publicKeyHex: PK_A,
      });
    });

    await new Promise((r) => setTimeout(r, 50));
    const quarantineCalls = logAppEventMock.mock.calls.filter(isQuarantineEvent);
    expect(quarantineCalls).toHaveLength(0);
  });

  it("obscur:group-invite-response-accepted without recipientPublicKeyHex is accepted (backward compat)", async () => {
    renderHook(() => useGroups(), { wrapper });

    act(() => {
      dispatchGroupInviteResponseAccepted({
          groupId: GROUP_ID,
          relayUrl: RELAY_URL,
          memberPubkey: "some-peer-pubkey",
      });
    });

    await new Promise((r) => setTimeout(r, 50));
    const quarantineCalls = logAppEventMock.mock.calls.filter(isQuarantineEvent);
    expect(quarantineCalls).toHaveLength(0);
  });

  it("obscur:group-membership-confirmed without publicKeyHex is accepted (backward compat)", async () => {
    renderHook(() => useGroups(), { wrapper });

    act(() => {
      dispatchGroupMembershipConfirmed({
          groupId: GROUP_ID,
          relayUrl: RELAY_URL,
          memberPubkeys: [PK_A],
      });
    });

    await new Promise((r) => setTimeout(r, 50));
    const quarantineCalls = logAppEventMock.mock.calls.filter(isQuarantineEvent);
    expect(quarantineCalls).toHaveLength(0);
  });
});
