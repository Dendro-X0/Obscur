import { describe, expect, it } from "vitest";
import { signMembershipDelta } from "@dweb/coordination-contracts";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import {
  handleMembershipDeltaAppend,
  handleMembershipDeltasSince,
  handleMembershipHead,
  matchMembershipDirectoryPath,
} from "./membership-directory";
import { createMockD1 } from "./test-utils/mock-d1";

const priv = "5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb" as PrivateKeyHex;
const actor = derivePublicKeyHex(priv);

const readJson = async (response: Response): Promise<Record<string, unknown>> => (
  JSON.parse(await response.text()) as Record<string, unknown>
);

describe("matchMembershipDirectoryPath", () => {
  it("parses head, deltas, and delta routes", () => {
    expect(matchMembershipDirectoryPath("/communities/g1/membership/head")).toEqual({
      communityId: "g1",
      resource: "head",
    });
    expect(matchMembershipDirectoryPath("/communities/g1/membership/deltas")).toEqual({
      communityId: "g1",
      resource: "deltas",
    });
    expect(matchMembershipDirectoryPath("/communities/g1/membership/delta")).toEqual({
      communityId: "g1",
      resource: "delta",
    });
    expect(matchMembershipDirectoryPath("/health")).toBeNull();
  });
});

describe("membership directory handlers", () => {
  it("returns empty head when community has no deltas", async () => {
    const state = { heads: new Map(), deltas: [] };
    const env = { DB: createMockD1(state) };
    const response = await handleMembershipHead("workspace-1", env);
    const body = await readJson(response);
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect((body.data as Record<string, unknown>).seq).toBe(0);
  });

  it("appends signed join delta and advances head seq", async () => {
    const state = { heads: new Map(), deltas: [] };
    const env = { DB: createMockD1(state) };
    const createdAtUnixMs = 1_700_000_000;
    const signature = await signMembershipDelta({
      communityId: "workspace-1",
      action: "join",
      subjectPubkey: actor,
      actorPubkey: actor,
      createdAtUnixMs,
      actorPrivateKeyHex: priv,
    });
    const appendResponse = await handleMembershipDeltaAppend(
      "workspace-1",
      new Request("http://local/membership/delta", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "join",
          subjectPubkey: actor,
          actorPubkey: actor,
          createdAtUnixMs,
          signature,
        }),
      }),
      env,
    );
    const appendBody = await readJson(appendResponse);
    expect(appendResponse.status).toBe(200);
    expect(appendBody.ok).toBe(true);
    expect((appendBody.data as Record<string, unknown>).seq).toBe(1);

    const headResponse = await handleMembershipHead("workspace-1", env);
    const headBody = await readJson(headResponse);
    expect((headBody.data as Record<string, unknown>).seq).toBe(1);

    const deltasResponse = await handleMembershipDeltasSince("workspace-1", 0, env);
    const deltasBody = await readJson(deltasResponse);
    const deltas = (deltasBody.data as Record<string, unknown>).deltas as ReadonlyArray<Record<string, unknown>>;
    expect(deltas).toHaveLength(1);
    expect(deltas[0]?.action).toBe("join");
  });

  it("rejects invalid signature on append", async () => {
    const state = { heads: new Map(), deltas: [] };
    const env = { DB: createMockD1(state) };
    const response = await handleMembershipDeltaAppend(
      "workspace-1",
      new Request("http://local/membership/delta", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "leave",
          subjectPubkey: actor,
          actorPubkey: actor,
          createdAtUnixMs: 1,
          signature: "00".repeat(128),
        }),
      }),
      env,
    );
    expect(response.status).toBe(401);
    const body = await readJson(response);
    expect(body.error).toBe("invalid_signature");
  });

  it("rejects leave delta when actor is not subject (steward ACL)", async () => {
    const state = { heads: new Map(), deltas: [] };
    const env = { DB: createMockD1(state) };
    const createdAtUnixMs = 1_700_000_000;
    const bootstrapSig = await signMembershipDelta({
      communityId: "workspace-1",
      action: "join",
      subjectPubkey: actor,
      actorPubkey: actor,
      createdAtUnixMs,
      actorPrivateKeyHex: priv,
    });
    await handleMembershipDeltaAppend(
      "workspace-1",
      new Request("http://local", {
        method: "POST",
        body: JSON.stringify({
          action: "join",
          subjectPubkey: actor,
          actorPubkey: actor,
          createdAtUnixMs,
          signature: bootstrapSig,
        }),
      }),
      env,
    );

    const memberPriv = "4f3edf4ad81639d2b1c5a488f54ce6d870e7a3bf770f1a7ea0a866e5d7a0d6e1" as PrivateKeyHex;
    const memberPubkey = derivePublicKeyHex(memberPriv);
    const memberJoinSig = await signMembershipDelta({
      communityId: "workspace-1",
      action: "join",
      subjectPubkey: memberPubkey,
      actorPubkey: memberPubkey,
      createdAtUnixMs: createdAtUnixMs + 1,
      actorPrivateKeyHex: memberPriv,
    });
    await handleMembershipDeltaAppend(
      "workspace-1",
      new Request("http://local", {
        method: "POST",
        body: JSON.stringify({
          action: "join",
          subjectPubkey: memberPubkey,
          actorPubkey: memberPubkey,
          createdAtUnixMs: createdAtUnixMs + 1,
          signature: memberJoinSig,
        }),
      }),
      env,
    );

    const forgedLeaveSig = await signMembershipDelta({
      communityId: "workspace-1",
      action: "leave",
      subjectPubkey: memberPubkey,
      actorPubkey: actor,
      createdAtUnixMs: createdAtUnixMs + 2,
      actorPrivateKeyHex: priv,
    });
    const response = await handleMembershipDeltaAppend(
      "workspace-1",
      new Request("http://local", {
        method: "POST",
        body: JSON.stringify({
          action: "leave",
          subjectPubkey: memberPubkey,
          actorPubkey: actor,
          createdAtUnixMs: createdAtUnixMs + 2,
          signature: forgedLeaveSig,
        }),
      }),
      env,
    );
    expect(response.status).toBe(403);
    const body = await readJson(response);
    expect(body.error).toBe("leave_requires_self_attestation");
  });

  it("rejects expel from non-bootstrap steward (steward ACL)", async () => {
    const state = { heads: new Map(), deltas: [] };
    const env = { DB: createMockD1(state) };
    const createdAtUnixMs = 1_700_000_000;
    const bootstrapSig = await signMembershipDelta({
      communityId: "workspace-expel",
      action: "join",
      subjectPubkey: actor,
      actorPubkey: actor,
      createdAtUnixMs,
      actorPrivateKeyHex: priv,
    });
    await handleMembershipDeltaAppend(
      "workspace-expel",
      new Request("http://local", {
        method: "POST",
        body: JSON.stringify({
          action: "join",
          subjectPubkey: actor,
          actorPubkey: actor,
          createdAtUnixMs,
          signature: bootstrapSig,
        }),
      }),
      env,
    );

    const memberPriv = "4f3edf4ad81639d2b1c5a488f54ce6d870e7a3bf770f1a7ea0a866e5d7a0d6e1" as PrivateKeyHex;
    const memberPubkey = derivePublicKeyHex(memberPriv);
    const memberJoinSig = await signMembershipDelta({
      communityId: "workspace-expel",
      action: "join",
      subjectPubkey: memberPubkey,
      actorPubkey: memberPubkey,
      createdAtUnixMs: createdAtUnixMs + 1,
      actorPrivateKeyHex: memberPriv,
    });
    await handleMembershipDeltaAppend(
      "workspace-expel",
      new Request("http://local", {
        method: "POST",
        body: JSON.stringify({
          action: "join",
          subjectPubkey: memberPubkey,
          actorPubkey: memberPubkey,
          createdAtUnixMs: createdAtUnixMs + 1,
          signature: memberJoinSig,
        }),
      }),
      env,
    );

    const forgedExpelSig = await signMembershipDelta({
      communityId: "workspace-expel",
      action: "expel",
      subjectPubkey: actor,
      actorPubkey: memberPubkey,
      createdAtUnixMs: createdAtUnixMs + 2,
      actorPrivateKeyHex: memberPriv,
    });
    const response = await handleMembershipDeltaAppend(
      "workspace-expel",
      new Request("http://local", {
        method: "POST",
        body: JSON.stringify({
          action: "expel",
          subjectPubkey: actor,
          actorPubkey: memberPubkey,
          createdAtUnixMs: createdAtUnixMs + 2,
          signature: forgedExpelSig,
        }),
      }),
      env,
    );
    expect(response.status).toBe(403);
    const body = await readJson(response);
    expect(body.error).toBe("expel_requires_bootstrap_steward");
  });

  it("appends self leave delta after two-member join (K-M1 directory path)", async () => {
    const state = { heads: new Map(), deltas: [] };
    const env = { DB: createMockD1(state) };
    const createdAtUnixMs = 1_700_000_000;
    const bootstrapSig = await signMembershipDelta({
      communityId: "k-m1-leave",
      action: "join",
      subjectPubkey: actor,
      actorPubkey: actor,
      createdAtUnixMs,
      actorPrivateKeyHex: priv,
    });
    await handleMembershipDeltaAppend(
      "k-m1-leave",
      new Request("http://local", {
        method: "POST",
        body: JSON.stringify({
          action: "join",
          subjectPubkey: actor,
          actorPubkey: actor,
          createdAtUnixMs,
          signature: bootstrapSig,
        }),
      }),
      env,
    );

    const memberPriv = "4f3edf4ad81639d2b1c5a488f54ce6d870e7a3bf770f1a7ea0a866e5d7a0d6e1" as PrivateKeyHex;
    const memberPubkey = derivePublicKeyHex(memberPriv);
    const memberJoinSig = await signMembershipDelta({
      communityId: "k-m1-leave",
      action: "join",
      subjectPubkey: memberPubkey,
      actorPubkey: memberPubkey,
      createdAtUnixMs: createdAtUnixMs + 1,
      actorPrivateKeyHex: memberPriv,
    });
    await handleMembershipDeltaAppend(
      "k-m1-leave",
      new Request("http://local", {
        method: "POST",
        body: JSON.stringify({
          action: "join",
          subjectPubkey: memberPubkey,
          actorPubkey: memberPubkey,
          createdAtUnixMs: createdAtUnixMs + 1,
          signature: memberJoinSig,
        }),
      }),
      env,
    );

    const leaveSig = await signMembershipDelta({
      communityId: "k-m1-leave",
      action: "leave",
      subjectPubkey: memberPubkey,
      actorPubkey: memberPubkey,
      createdAtUnixMs: createdAtUnixMs + 2,
      actorPrivateKeyHex: memberPriv,
    });
    const leaveResponse = await handleMembershipDeltaAppend(
      "k-m1-leave",
      new Request("http://local", {
        method: "POST",
        body: JSON.stringify({
          action: "leave",
          subjectPubkey: memberPubkey,
          actorPubkey: memberPubkey,
          createdAtUnixMs: createdAtUnixMs + 2,
          signature: leaveSig,
        }),
      }),
      env,
    );
    expect(leaveResponse.status).toBe(200);

    const deltasResponse = await handleMembershipDeltasSince("k-m1-leave", 0, env);
    const deltasBody = await readJson(deltasResponse);
    const deltas = (deltasBody.data as Record<string, unknown>).deltas as ReadonlyArray<Record<string, unknown>>;
    expect(deltas).toHaveLength(3);
    expect(deltas[2]?.action).toBe("leave");
    expect(deltas[2]?.subjectPubkey).toBe(memberPubkey.toLowerCase());
  });

  it("filters deltas since cursor", async () => {
    const state = { heads: new Map(), deltas: [] };
    const env = { DB: createMockD1(state) };
    const joinAt = 1_700_000_001;
    const joinSig = await signMembershipDelta({
      communityId: "c1",
      action: "join",
      subjectPubkey: actor,
      actorPubkey: actor,
      createdAtUnixMs: joinAt,
      actorPrivateKeyHex: priv,
    });
    await handleMembershipDeltaAppend(
      "c1",
      new Request("http://local", {
        method: "POST",
        body: JSON.stringify({
          action: "join",
          subjectPubkey: actor,
          actorPubkey: actor,
          createdAtUnixMs: joinAt,
          signature: joinSig,
        }),
      }),
      env,
    );

    const memberPriv = "4f3edf4ad81639d2b1c5a488f54ce6d870e7a3bf770f1a7ea0a866e5d7a0d6e1" as PrivateKeyHex;
    const memberPubkey = derivePublicKeyHex(memberPriv);
    const memberJoinAt = 1_700_000_002;
    const memberJoinSig = await signMembershipDelta({
      communityId: "c1",
      action: "join",
      subjectPubkey: memberPubkey,
      actorPubkey: memberPubkey,
      createdAtUnixMs: memberJoinAt,
      actorPrivateKeyHex: memberPriv,
    });
    await handleMembershipDeltaAppend(
      "c1",
      new Request("http://local", {
        method: "POST",
        body: JSON.stringify({
          action: "join",
          subjectPubkey: memberPubkey,
          actorPubkey: memberPubkey,
          createdAtUnixMs: memberJoinAt,
          signature: memberJoinSig,
        }),
      }),
      env,
    );
    const response = await handleMembershipDeltasSince("c1", 1, env);
    const body = await readJson(response);
    const deltas = (body.data as Record<string, unknown>).deltas as ReadonlyArray<Record<string, unknown>>;
    expect(deltas).toHaveLength(1);
    expect(deltas[0]?.seq).toBe(2);
  });
});
