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

  it("filters deltas since cursor", async () => {
    const state = { heads: new Map(), deltas: [] };
    const env = { DB: createMockD1(state) };
    for (let seq = 1; seq <= 2; seq += 1) {
      const createdAtUnixMs = 1_700_000_000 + seq;
      const signature = await signMembershipDelta({
        communityId: "c1",
        action: "join",
        subjectPubkey: actor,
        actorPubkey: actor,
        createdAtUnixMs,
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
            createdAtUnixMs,
            signature,
          }),
        }),
        env,
      );
    }
    const response = await handleMembershipDeltasSince("c1", 1, env);
    const body = await readJson(response);
    const deltas = (body.data as Record<string, unknown>).deltas as ReadonlyArray<Record<string, unknown>>;
    expect(deltas).toHaveLength(1);
    expect(deltas[0]?.seq).toBe(2);
  });
});
