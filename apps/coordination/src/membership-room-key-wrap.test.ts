import { describe, expect, it } from "vitest";
import {
  ROOM_KEY_WRAP_SCHEME_V1,
  signMembershipDelta,
  signRoomKeyWrap,
  verifyRoomKeyWrapSignature,
} from "@dweb/coordination-contracts";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { handleMembershipDeltaAppend } from "./membership-directory";
import {
  handleRoomKeyWrapAppend,
  handleRoomKeyWrapsSince,
  matchMembershipRoomKeyWrapPath,
} from "./membership-room-key-wrap";
import { evaluateRoomKeyWrapAcl } from "./membership-room-key-wrap-acl";
import { createEmptyMockD1State, createMockD1 } from "./test-utils/mock-d1";

const stewardPriv = "5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb" as PrivateKeyHex;
const memberPriv = "0000000000000000000000000000000000000000000000000000000000000001" as PrivateKeyHex;
const steward = derivePublicKeyHex(stewardPriv);
const member = derivePublicKeyHex(memberPriv);

const readJson = async (response: Response): Promise<Record<string, unknown>> => (
  JSON.parse(await response.text()) as Record<string, unknown>
);

const joinCommunity = async (
  env: { DB: D1Database },
  communityId: string,
  pubkey: string,
  priv: PrivateKeyHex,
  createdAtUnixMs: number,
): Promise<void> => {
  const signature = await signMembershipDelta({
    communityId,
    action: "join",
    subjectPubkey: pubkey,
    actorPubkey: pubkey,
    createdAtUnixMs,
    actorPrivateKeyHex: priv,
  });
  const response = await handleMembershipDeltaAppend(
    communityId,
    new Request("http://local/membership/delta", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "join",
        subjectPubkey: pubkey,
        actorPubkey: pubkey,
        createdAtUnixMs,
        signature,
      }),
    }),
    env,
  );
  expect(response.status).toBe(200);
};

const buildSignedWrapBody = async (params: Readonly<{
  communityId: string;
  subjectPubkey: string;
  actorPubkey: string;
  actorPrivateKeyHex: PrivateKeyHex;
  wrapSeq: number;
  ciphertext?: string;
  createdAtUnixMs?: number;
}>) => {
  const createdAtUnixMs = params.createdAtUnixMs ?? 1_700_000_100;
  const ciphertext = params.ciphertext ?? "?iv=deadbeef&ciphertext=abc123";
  const signature = await signRoomKeyWrap({
    communityId: params.communityId,
    subjectPubkey: params.subjectPubkey,
    wrapSeq: params.wrapSeq,
    scheme: ROOM_KEY_WRAP_SCHEME_V1,
    ciphertext,
    actorPubkey: params.actorPubkey,
    createdAtUnixMs,
    actorPrivateKeyHex: params.actorPrivateKeyHex,
  });
  return {
    subjectPubkey: params.subjectPubkey,
    scheme: ROOM_KEY_WRAP_SCHEME_V1,
    ciphertext,
    actorPubkey: params.actorPubkey,
    createdAtUnixMs,
    signature,
  };
};

describe("matchMembershipRoomKeyWrapPath", () => {
  it("parses wrap publish and list routes", () => {
    expect(matchMembershipRoomKeyWrapPath("/communities/g1/membership/room-key-wrap")).toEqual({
      communityId: "g1",
      resource: "room-key-wrap",
    });
    expect(matchMembershipRoomKeyWrapPath("/communities/g1/membership/room-key-wraps")).toEqual({
      communityId: "g1",
      resource: "room-key-wraps",
    });
    expect(matchMembershipRoomKeyWrapPath("/communities/g1/membership/head")).toBeNull();
  });
});

describe("room-key-wrap contracts", () => {
  it("sign and verify roundtrip", async () => {
    const createdAtUnixMs = 1_700_000_050;
    const ciphertext = "?iv=001122&ciphertext=deadbeef";
    const signature = await signRoomKeyWrap({
      communityId: "workspace-1",
      subjectPubkey: steward,
      wrapSeq: 1,
      scheme: ROOM_KEY_WRAP_SCHEME_V1,
      ciphertext,
      actorPubkey: steward,
      createdAtUnixMs,
      actorPrivateKeyHex: stewardPriv,
    });
    const valid = await verifyRoomKeyWrapSignature({
      communityId: "workspace-1",
      subjectPubkey: steward,
      wrapSeq: 1,
      scheme: ROOM_KEY_WRAP_SCHEME_V1,
      ciphertext,
      actorPubkey: steward,
      createdAtUnixMs,
      signature,
    });
    expect(valid).toBe(true);
  });
});

describe("evaluateRoomKeyWrapAcl", () => {
  it("allows self-wrap for active member", () => {
    const decision = evaluateRoomKeyWrapAcl({
      existingDeltas: [{
        seq: 1,
        action: "join",
        subjectPubkey: steward,
        actorPubkey: steward,
      }],
      subjectPubkey: steward,
      actorPubkey: steward,
    });
    expect(decision).toEqual({ allowed: true });
  });

  it("allows steward wrap for another active member", () => {
    const decision = evaluateRoomKeyWrapAcl({
      existingDeltas: [
        { seq: 1, action: "join", subjectPubkey: steward, actorPubkey: steward },
        { seq: 2, action: "join", subjectPubkey: member, actorPubkey: member },
      ],
      subjectPubkey: member,
      actorPubkey: steward,
    });
    expect(decision).toEqual({ allowed: true });
  });

  it("denies non-steward wrap for another member", () => {
    const decision = evaluateRoomKeyWrapAcl({
      existingDeltas: [
        { seq: 1, action: "join", subjectPubkey: steward, actorPubkey: steward },
        { seq: 2, action: "join", subjectPubkey: member, actorPubkey: member },
      ],
      subjectPubkey: steward,
      actorPubkey: member,
    });
    expect(decision).toEqual({ allowed: false, error: "wrap_publish_forbidden" });
  });
});

describe("room-key-wrap handlers", () => {
  it("appends signed self-wrap after join and lists wraps", async () => {
    const state = createEmptyMockD1State();
    const env = { DB: createMockD1(state) };
    const communityId = "workspace-wrap-1";

    await joinCommunity(env, communityId, steward, stewardPriv, 1_700_000_000);

    const wrapBody = await buildSignedWrapBody({
      communityId,
      subjectPubkey: steward,
      actorPubkey: steward,
      actorPrivateKeyHex: stewardPriv,
      wrapSeq: 1,
    });

    const appendResponse = await handleRoomKeyWrapAppend(
      communityId,
      new Request("http://local/membership/room-key-wrap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(wrapBody),
      }),
      env,
    );
    const appendJson = await readJson(appendResponse);
    expect(appendResponse.status).toBe(200);
    expect(appendJson.ok).toBe(true);
    expect((appendJson.data as Record<string, unknown>).wrapSeq).toBe(1);

    const listResponse = await handleRoomKeyWrapsSince(communityId, 0, env);
    const listJson = await readJson(listResponse);
    const wraps = (listJson.data as Record<string, unknown>).wraps as ReadonlyArray<Record<string, unknown>>;
    expect(wraps).toHaveLength(1);
    expect(wraps[0]?.wrapSeq).toBe(1);
    expect(wraps[0]?.subjectPubkey).toBe(steward.toLowerCase());
  });

  it("increments wrap_seq on re-wrap", async () => {
    const state = createEmptyMockD1State();
    const env = { DB: createMockD1(state) };
    const communityId = "workspace-wrap-2";

    await joinCommunity(env, communityId, steward, stewardPriv, 1_700_000_000);

    for (const wrapSeq of [1, 2]) {
      const wrapBody = await buildSignedWrapBody({
        communityId,
        subjectPubkey: steward,
        actorPubkey: steward,
        actorPrivateKeyHex: stewardPriv,
        wrapSeq,
        ciphertext: `?iv=seq${wrapSeq}&ciphertext=abc`,
        createdAtUnixMs: 1_700_000_000 + wrapSeq,
      });
      const response = await handleRoomKeyWrapAppend(
        communityId,
        new Request("http://local/membership/room-key-wrap", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(wrapBody),
        }),
        env,
      );
      expect(response.status).toBe(200);
    }

    const listResponse = await handleRoomKeyWrapsSince(communityId, 1, env);
    const listJson = await readJson(listResponse);
    const wraps = (listJson.data as Record<string, unknown>).wraps as ReadonlyArray<Record<string, unknown>>;
    expect(wraps).toHaveLength(1);
    expect(wraps[0]?.wrapSeq).toBe(2);
  });

  it("rejects invalid signature", async () => {
    const state = createEmptyMockD1State();
    const env = { DB: createMockD1(state) };
    const communityId = "workspace-wrap-3";

    await joinCommunity(env, communityId, steward, stewardPriv, 1_700_000_000);

    const response = await handleRoomKeyWrapAppend(
      communityId,
      new Request("http://local/membership/room-key-wrap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subjectPubkey: steward,
          scheme: ROOM_KEY_WRAP_SCHEME_V1,
          ciphertext: "?iv=bad&ciphertext=sig",
          actorPubkey: steward,
          createdAtUnixMs: 1_700_000_000,
          signature: "00".repeat(128),
        }),
      }),
      env,
    );
    expect(response.status).toBe(401);
  });

  it("rejects plaintext roomKeyHex in body", async () => {
    const state = createEmptyMockD1State();
    const env = { DB: createMockD1(state) };
    const communityId = "workspace-wrap-4";

    await joinCommunity(env, communityId, steward, stewardPriv, 1_700_000_000);

    const response = await handleRoomKeyWrapAppend(
      communityId,
      new Request("http://local/membership/room-key-wrap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subjectPubkey: steward,
          scheme: ROOM_KEY_WRAP_SCHEME_V1,
          ciphertext: "a".repeat(64),
          actorPubkey: steward,
          createdAtUnixMs: 1_700_000_000,
          signature: "00".repeat(128),
          roomKeyHex: "b".repeat(64),
        }),
      }),
      env,
    );
    expect(response.status).toBe(400);
    const body = await readJson(response);
    expect(body.error).toBe("plaintext_room_key_forbidden");
  });

  it("rejects wrap when subject is not active", async () => {
    const state = createEmptyMockD1State();
    const env = { DB: createMockD1(state) };
    const communityId = "workspace-wrap-5";

    const wrapBody = await buildSignedWrapBody({
      communityId,
      subjectPubkey: steward,
      actorPubkey: steward,
      actorPrivateKeyHex: stewardPriv,
      wrapSeq: 1,
    });

    const response = await handleRoomKeyWrapAppend(
      communityId,
      new Request("http://local/membership/room-key-wrap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(wrapBody),
      }),
      env,
    );
    expect(response.status).toBe(403);
    const body = await readJson(response);
    expect(body.error).toBe("subject_not_active");
  });
});
