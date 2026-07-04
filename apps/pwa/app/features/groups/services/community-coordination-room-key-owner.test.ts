import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ROOM_KEY_WRAP_SCHEME_V1,
  signRoomKeyWrap,
  verifyRoomKeyWrapSignature,
} from "@dweb/coordination-contracts";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { RoomKeyStore } from "../../crypto/room-key-store";
import {
  buildRoomKeyWrapInnerPayload,
  fetchCoordinationRoomKeyWrapsSince,
  materializeRoomKeysFromCoordinationWraps,
  parseRoomKeyWrapInnerPayload,
  publishCoordinationRoomKeyWrap,
  resolveNextWrapSeqForSubject,
  resolveRoomKeyForCommunityAction,
  resolveRoomKeyHexForMembershipHealthPanel,
  publishSelfCoordinationRoomKeyWrapAfterJoin,
  publishStewardCoordinationRoomKeyWrapForMember,
  publishStewardCoordinationRoomKeyWrapsForInvitees,
  resolveRoomKeyHexForInviteDistribution,
  ensureRoomKeyHexForInviteDistribution,
  selectLatestWrapForSubject,
  unwrapRoomKeyFromCoordinationCiphertext,
  wrapRoomKeyForCoordination,
  type CoordinationRoomKeyWrapRecord,
} from "./community-coordination-room-key-owner";

const fetchCoordinationWithTimeout = vi.hoisted(() => vi.fn());
const logAppEvent = vi.hoisted(() => vi.fn());

vi.mock("./community-coordination-fetch", () => ({
  CoordinationFetchError: class CoordinationFetchError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "CoordinationFetchError";
    }
  },
  fetchCoordinationWithTimeout,
}));

vi.mock("./community-membership-sync-mode", () => ({
  getCoordinationBaseUrl: () => "http://127.0.0.1:8787",
  isCoordinationConfigured: () => true,
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent,
}));

const actorPriv = "5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb" as PrivateKeyHex;
const actorPub = derivePublicKeyHex(actorPriv);
const roomKeyHex = "a".repeat(64);
const groupId = "group-wrap-test-1";
const communityId = "workspace-wrap-test-1";

const buildWrapRecord = async (params: Readonly<{
  wrapSeq: number;
  ciphertext: string;
  createdAtUnixMs?: number;
}>): Promise<CoordinationRoomKeyWrapRecord> => {
  const createdAtUnixMs = params.createdAtUnixMs ?? 1_700_000_000 + params.wrapSeq;
  const signature = await signRoomKeyWrap({
    communityId,
    subjectPubkey: actorPub,
    wrapSeq: params.wrapSeq,
    scheme: ROOM_KEY_WRAP_SCHEME_V1,
    ciphertext: params.ciphertext,
    actorPubkey: actorPub,
    createdAtUnixMs,
    actorPrivateKeyHex: actorPriv,
  });
  return {
    wrapId: `wrap-${params.wrapSeq}`,
    communityId,
    subjectPubkey: actorPub,
    wrapSeq: params.wrapSeq,
    scheme: ROOM_KEY_WRAP_SCHEME_V1,
    ciphertext: params.ciphertext,
    actorPubkey: actorPub,
    createdAtUnixMs,
    signature,
  };
};

describe("community-coordination-room-key-owner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  it("builds and parses inner wrap payload", () => {
    const inner = buildRoomKeyWrapInnerPayload(groupId, roomKeyHex);
    expect(inner).toEqual({ v: 1, groupId, roomKeyHex });
    expect(parseRoomKeyWrapInnerPayload(JSON.stringify(inner))).toEqual(inner);
  });

  it("nip04 wrap and unwrap roundtrip for self-wrap", async () => {
    const wrapped = await wrapRoomKeyForCoordination({
      groupId,
      roomKeyHex,
      subjectPubkey: actorPub,
      actorPrivateKeyHex: actorPriv,
    });
    expect(wrapped.ok).toBe(true);
    if (!wrapped.ok) {
      return;
    }

    const unwrapped = await unwrapRoomKeyFromCoordinationCiphertext({
      ciphertext: wrapped.ciphertext,
      actorPubkey: actorPub,
      recipientPrivateKeyHex: actorPriv,
      expectedGroupId: groupId,
    });
    expect(unwrapped).toEqual({ ok: true, roomKeyHex, groupId });
  });

  it("resolves next wrap seq from existing wraps", async () => {
    const wrapped = await wrapRoomKeyForCoordination({
      groupId,
      roomKeyHex,
      subjectPubkey: actorPub,
      actorPrivateKeyHex: actorPriv,
    });
    expect(wrapped.ok).toBe(true);
    if (!wrapped.ok) {
      return;
    }

    const wraps = [
      await buildWrapRecord({ wrapSeq: 1, ciphertext: wrapped.ciphertext }),
      await buildWrapRecord({ wrapSeq: 2, ciphertext: `${wrapped.ciphertext}-v2` }),
    ];
    expect(resolveNextWrapSeqForSubject(wraps, actorPub)).toBe(3);
    expect(selectLatestWrapForSubject(wraps, actorPub)?.wrapSeq).toBe(2);
  });

  it("fetches wraps since seq from coordination", async () => {
    fetchCoordinationWithTimeout.mockResolvedValue(new Response(
      JSON.stringify({
        ok: true,
        data: {
          wraps: [{
            wrapId: "w1",
            communityId,
            subjectPubkey: actorPub,
            wrapSeq: 1,
            scheme: ROOM_KEY_WRAP_SCHEME_V1,
            ciphertext: "?iv=abc&ciphertext=def",
            actorPubkey: actorPub,
            createdAtUnixMs: 1_700_000_000,
            signature: "c".repeat(128),
          }],
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));

    const result = await fetchCoordinationRoomKeyWrapsSince(communityId, 0);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.wraps).toHaveLength(1);
    }
    expect(fetchCoordinationWithTimeout).toHaveBeenCalledWith(
      `http://127.0.0.1:8787/communities/${encodeURIComponent(communityId)}/membership/room-key-wraps?sinceSeq=0`,
      { method: "GET" },
    );
  });

  it("publishes signed wrap to coordination", async () => {
    fetchCoordinationWithTimeout
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ ok: true, data: { wraps: [] } }),
        { status: 200, headers: { "content-type": "application/json" } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ ok: true, data: { wrapSeq: 1, wrapId: "w1" } }),
        { status: 200, headers: { "content-type": "application/json" } },
      ));

    const result = await publishCoordinationRoomKeyWrap({
      communityId,
      groupId,
      roomKeyHex,
      subjectPubkey: actorPub,
      actorPubkey: actorPub,
      actorPrivateKeyHex: actorPriv,
      createdAtUnixMs: 1_700_000_100,
    });
    expect(result).toEqual({ success: true, wrapSeq: 1 });
    expect(fetchCoordinationWithTimeout).toHaveBeenCalledTimes(2);

    const postCall = fetchCoordinationWithTimeout.mock.calls[1];
    expect(postCall?.[0]).toContain("/membership/room-key-wrap");
    const body = JSON.parse(String(postCall?.[1]?.body));
    const valid = await verifyRoomKeyWrapSignature({
      communityId,
      subjectPubkey: actorPub,
      wrapSeq: 1,
      scheme: ROOM_KEY_WRAP_SCHEME_V1,
      ciphertext: body.ciphertext,
      actorPubkey: actorPub,
      createdAtUnixMs: 1_700_000_100,
      signature: body.signature,
    });
    expect(valid).toBe(true);
    expect(logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
      name: "groups.coordination_room_key_wrap_published",
    }));
  });

  it("materializes latest wrap into room key store", async () => {
    const wrapped = await wrapRoomKeyForCoordination({
      groupId,
      roomKeyHex,
      subjectPubkey: actorPub,
      actorPrivateKeyHex: actorPriv,
    });
    expect(wrapped.ok).toBe(true);
    if (!wrapped.ok) {
      return;
    }

    const store = new RoomKeyStore();
    const wraps = [
      await buildWrapRecord({ wrapSeq: 1, ciphertext: `${wrapped.ciphertext}-old` }),
      await buildWrapRecord({ wrapSeq: 2, ciphertext: wrapped.ciphertext }),
    ];

    const result = await materializeRoomKeysFromCoordinationWraps({
      groupId,
      communityId,
      localPubkey: actorPub as PublicKeyHex,
      localPrivateKeyHex: actorPriv,
      wraps,
      store,
    });
    expect(result).toEqual({ materialized: true, roomKeyHex });
    expect(await store.getRoomKey(groupId)).toBe(roomKeyHex);
    expect(logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
      name: "groups.coordination_room_key_materialized",
    }));
  });

  it("skips materialization when local pubkey is not active", async () => {
    const store = new RoomKeyStore();
    const wrapped = await wrapRoomKeyForCoordination({
      groupId,
      roomKeyHex,
      subjectPubkey: actorPub,
      actorPrivateKeyHex: actorPriv,
    });
    if (!wrapped.ok) {
      throw new Error("wrap failed");
    }
    const wraps = [await buildWrapRecord({ wrapSeq: 1, ciphertext: wrapped.ciphertext })];
    const otherPub = ("b".repeat(64)) as PublicKeyHex;

    const result = await materializeRoomKeysFromCoordinationWraps({
      groupId,
      communityId,
      localPubkey: actorPub as PublicKeyHex,
      localPrivateKeyHex: actorPriv,
      wraps,
      activeMemberPubkeys: [otherPub],
      store,
    });
    expect(result).toEqual({
      materialized: false,
      roomKeyHex: null,
      error: "subject_not_active",
    });
    expect(await store.getRoomKey(groupId)).toBeNull();
  });

  it("resolveRoomKeyForCommunityAction returns hit_local when store has key", async () => {
    const store = new RoomKeyStore();
    await store.saveRoomKey(groupId, roomKeyHex);

    const resolved = await resolveRoomKeyForCommunityAction({
      groupId,
      communityId,
      localPubkey: actorPub as PublicKeyHex,
      localPrivateKeyHex: actorPriv,
      store,
    });
    expect(resolved).toEqual({ roomKeyHex, source: "hit_local" });
    expect(fetchCoordinationWithTimeout).not.toHaveBeenCalled();
  });

  it("resolveRoomKeyForCommunityAction fetches and materializes on miss", async () => {
    const wrapped = await wrapRoomKeyForCoordination({
      groupId,
      roomKeyHex,
      subjectPubkey: actorPub,
      actorPrivateKeyHex: actorPriv,
    });
    if (!wrapped.ok) {
      throw new Error("wrap failed");
    }
    const wrapRecord = await buildWrapRecord({ wrapSeq: 1, ciphertext: wrapped.ciphertext });

    fetchCoordinationWithTimeout.mockResolvedValue(new Response(
      JSON.stringify({ ok: true, data: { wraps: [wrapRecord] } }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));

    const store = new RoomKeyStore();
    const resolved = await resolveRoomKeyForCommunityAction({
      groupId,
      communityId,
      localPubkey: actorPub as PublicKeyHex,
      localPrivateKeyHex: actorPriv,
      activeMemberPubkeys: [actorPub as PublicKeyHex],
      store,
    });
    expect(resolved).toEqual({ roomKeyHex, source: "hit_coordination" });
    expect(await store.getRoomKey(groupId)).toBe(roomKeyHex);
  });

  it("resolveRoomKeyForCommunityAction returns miss when fetch fails", async () => {
    fetchCoordinationWithTimeout.mockRejectedValue(new Error("coordination_unreachable"));
    const store = new RoomKeyStore();

    const resolved = await resolveRoomKeyForCommunityAction({
      groupId,
      communityId,
      localPubkey: actorPub as PublicKeyHex,
      localPrivateKeyHex: actorPriv,
      store,
    });
    expect(resolved).toEqual({ roomKeyHex: null, source: "miss" });
  });

  it("publishSelfCoordinationRoomKeyWrapAfterJoin skips when room key missing", async () => {
    const store = new RoomKeyStore();
    vi.spyOn(store, "getRoomKey").mockResolvedValue(null);

    const result = await publishSelfCoordinationRoomKeyWrapAfterJoin({
      communityId,
      groupId,
      memberPubkey: actorPub as PublicKeyHex,
      actorPubkey: actorPub as PublicKeyHex,
      actorPrivateKeyHex: actorPriv,
    });
    expect(result).toEqual({ ok: false, skipped: true, error: "room_key_missing" });
    expect(fetchCoordinationWithTimeout).not.toHaveBeenCalled();
  });

  it("resolveRoomKeyHexForInviteDistribution prefers hint then local store", async () => {
    const store = new RoomKeyStore();
    await store.saveRoomKey(groupId, roomKeyHex);

    const fromHint = await resolveRoomKeyHexForInviteDistribution({
      groupId,
      communityId,
      localPubkey: actorPub as PublicKeyHex,
      localPrivateKeyHex: actorPriv,
      roomKeyHexHint: "d".repeat(64),
      store,
    });
    expect(fromHint).toEqual({ roomKeyHex: "d".repeat(64), source: "hint" });

    const fromStore = await resolveRoomKeyHexForInviteDistribution({
      groupId,
      communityId,
      localPubkey: actorPub as PublicKeyHex,
      localPrivateKeyHex: actorPriv,
      store,
    });
    expect(fromStore).toEqual({ roomKeyHex, source: "local_store" });
  });

  it("ensureRoomKeyHexForInviteDistribution generates when resolve misses", async () => {
    const store = new RoomKeyStore();
    const generated = "e".repeat(64);
    const result = await ensureRoomKeyHexForInviteDistribution({
      groupId,
      communityId,
      localPubkey: actorPub as PublicKeyHex,
      localPrivateKeyHex: actorPriv,
      generateRoomKey: async () => generated,
      store,
    });
    expect(result).toEqual({ roomKeyHex: generated, source: "generated" });
    expect(await store.getRoomKey(groupId)).toBe(generated);
  });

  it("publishStewardCoordinationRoomKeyWrapForMember posts wrap for invitee subject", async () => {
    const inviteePriv = "0000000000000000000000000000000000000000000000000000000000000002" as PrivateKeyHex;
    const invitee = derivePublicKeyHex(inviteePriv);
    fetchCoordinationWithTimeout
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ ok: true, data: { wraps: [] } }),
        { status: 200, headers: { "content-type": "application/json" } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ ok: true, data: { wrapSeq: 1 } }),
        { status: 200, headers: { "content-type": "application/json" } },
      ));

    const result = await publishStewardCoordinationRoomKeyWrapForMember({
      communityId,
      groupId,
      roomKeyHex,
      subjectPubkey: invitee,
      stewardPubkey: actorPub as PublicKeyHex,
      stewardPrivateKeyHex: actorPriv,
    });
    expect(result).toEqual({ ok: true, wrapSeq: 1 });

    const postCall = fetchCoordinationWithTimeout.mock.calls[1];
    const body = JSON.parse(String(postCall?.[1]?.body));
    expect(body.subjectPubkey).toBe(invitee);
    expect(body.actorPubkey).toBe(actorPub);
  });

  it("publishStewardCoordinationRoomKeyWrapsForInvitees skips without communityId", async () => {
    await publishStewardCoordinationRoomKeyWrapsForInvitees({
      groupId,
      roomKeyHex,
      stewardPubkey: actorPub as PublicKeyHex,
      stewardPrivateKeyHex: actorPriv,
      inviteePubkeys: [actorPub as PublicKeyHex],
    });
    expect(fetchCoordinationWithTimeout).not.toHaveBeenCalled();
  });

  it("resolveRoomKeyHexForMembershipHealthPanel returns local key from any candidate", async () => {
    const store = new RoomKeyStore();
    await store.saveRoomKey(groupId, roomKeyHex);

    const resolved = await resolveRoomKeyHexForMembershipHealthPanel({
      groupIdCandidates: ["other-id", groupId],
      communityId,
      localPubkey: actorPub as PublicKeyHex,
      localPrivateKeyHex: actorPriv,
      store,
    });
    expect(resolved).toBe(roomKeyHex);
    expect(fetchCoordinationWithTimeout).not.toHaveBeenCalled();
  });

  it("resolveRoomKeyHexForMembershipHealthPanel materializes via coordination when local miss", async () => {
    const wrapped = await wrapRoomKeyForCoordination({
      groupId,
      roomKeyHex,
      subjectPubkey: actorPub,
      actorPrivateKeyHex: actorPriv,
    });
    if (!wrapped.ok) {
      throw new Error("wrap failed");
    }
    const wrapRecord = await buildWrapRecord({ wrapSeq: 1, ciphertext: wrapped.ciphertext });

    fetchCoordinationWithTimeout.mockResolvedValue(new Response(
      JSON.stringify({ ok: true, data: { wraps: [wrapRecord] } }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));

    const store = new RoomKeyStore();
    const resolved = await resolveRoomKeyHexForMembershipHealthPanel({
      groupIdCandidates: [groupId],
      communityId,
      localPubkey: actorPub as PublicKeyHex,
      localPrivateKeyHex: actorPriv,
      activeMemberPubkeys: [actorPub as PublicKeyHex],
      store,
    });
    expect(resolved).toBe(roomKeyHex);
    expect(await store.getRoomKey(groupId)).toBe(roomKeyHex);
  });
});
