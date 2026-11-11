import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HostEnginePort } from "@obscur/engine-contracts";
import {
  PRIVATE_DC_T3_PLAINTEXT_REFUSED,
  privateDcRequiresT3Wire,
} from "./private-trust-send-policy";
import {
  resetPrivateTrustT3FetchForTests,
  sendPrivateTrustT3Message,
  setPrivateTrustT3FetchForTests,
  setPrivateTrustT3HostForTests,
} from "./private-trust-t3-send";
import { clearPrivateDcSession, writePrivateDcSession } from "./private-dc-session";
import { privateDcAdapter, resetPrivateDcFetchImplForTests } from "./private-dc-adapter";

const read = (relativePath: string): string => (
  readFileSync(resolve(process.cwd(), relativePath), "utf8")
);

describe("Cut 1.4 K-SEND-FACE / K-PROTO-PLAIN owner-uniqueness", () => {
  it("private_dc adapter refuses plaintext sendMessage under T3 policy", () => {
    const adapter = read("app/features/protocol-adaptation/private-dc-adapter.ts");
    expect(adapter).toContain("privateDcRequiresT3Wire");
    expect(adapter).toContain("PRIVATE_DC_T3_PLAINTEXT_REFUSED");
    expect(adapter).toContain("sendEnvelope");
    expect(privateDcRequiresT3Wire()).toBe(true);
  });

  it("layer sendDm routes private_dc through sendPrivateTrustT3Message", () => {
    const layer = read("app/features/protocol-adaptation/layer.ts");
    expect(layer).toContain("sendPrivateTrustT3Message");
    expect(layer).toMatch(
      /activeProtocol === "private_dc" && privateDcRequiresT3Wire\(\)[\s\S]*sendPrivateTrustT3Message/,
    );
  });
});

describe("Cut 1.4 T3 send path (mocked host + home)", () => {
  afterEach(() => {
    setPrivateTrustT3HostForTests(null);
    resetPrivateTrustT3FetchForTests();
    resetPrivateDcFetchImplForTests();
    clearPrivateDcSession("default");
  });

  it("prepare → envelope POST → completeT3HomeAck without plaintext body", async () => {
    writePrivateDcSession({ baseUrl: "https://home.example.com", bearerToken: "t" }, "default");
    const invoke = vi.fn(async (request: { method: string }) => {
      if (request.method === "prepareT3Outbound") {
        return {
          ok: true,
          data: {
            clientMessageId: "t3-abc",
            conversationId: "peer",
            envelope: "sealed-xyz",
            status: "sending",
          },
        };
      }
      if (request.method === "completeT3HomeAck") {
        return { ok: true, data: { acked: true, status: "accepted" } };
      }
      return { ok: false, errorMessage: `unexpected ${request.method}` };
    });
    setPrivateTrustT3HostForTests({
      invoke,
      getSnapshot: async () => ({ engine: "privateTrust", scope: { profileId: "default" }, phase: "ready", revision: 1 }),
      subscribe: () => () => {},
    } as HostEnginePort);

    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body));
      expect(payload).toEqual({ envelope: "sealed-xyz", clientMessageId: "t3-abc" });
      expect(payload.body).toBeUndefined();
      return new Response(JSON.stringify({
        message: {
          id: "home-1",
          conversationId: "peer",
          envelope: "sealed-xyz",
          clientMessageId: "t3-abc",
          sentAtUnixMs: 99,
          direction: "out",
          status: "accepted",
        },
      }), { status: 200 });
    }) as unknown as typeof fetch;
    setPrivateTrustT3FetchForTests(fetchImpl);

    await expect(sendPrivateTrustT3Message({
      profileId: "default",
      conversationId: "peer",
      peerPubkey: "b".repeat(64),
      plaintext: "secret hi",
    })).resolves.toMatchObject({
      id: "home-1",
      conversationId: "peer",
      body: "",
      status: "sent",
    });

    expect(invoke).toHaveBeenCalledWith(expect.objectContaining({ method: "prepareT3Outbound" }));
    expect(invoke).toHaveBeenCalledWith(expect.objectContaining({ method: "completeT3HomeAck" }));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("adapter sendMessage throws plaintext refused", async () => {
    writePrivateDcSession({ baseUrl: "https://home.example.com" }, "default");
    await expect(privateDcAdapter.sendMessage({
      profileId: "default",
      conversationId: "peer",
      body: "nope",
    })).rejects.toThrow(PRIVATE_DC_T3_PLAINTEXT_REFUSED);
  });
});
