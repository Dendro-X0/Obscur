/**
 * P4d L2 — private-dc-adapter against live localhost /v1 (real fetch).
 * @see specs/backend/platform-p4d-private-dc-adapter-cdp-soak-2026-11.md
 */
import http from "node:http";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { privateDcAdapter, resetPrivateDcFetchImplForTests } from "./private-dc-adapter";
import { clearPrivateDcSession, writePrivateDcSession } from "./private-dc-session";

const TOKEN = "adapter-l2-token";

type LabHandle = Readonly<{
  baseUrl: string;
  close: () => Promise<void>;
}>;

const startLab = async (): Promise<LabHandle> => {
  const conversations = [{ id: "ops", title: "Ops" }];
  const messages: Record<string, Array<Record<string, unknown>>> = {
    ops: [{
      id: "m-seed-1",
      conversationId: "ops",
      body: "lab seed",
      sentAtUnixMs: 1,
      direction: "in",
      status: "delivered",
    }],
  };

  const server = http.createServer(async (req, res) => {
    const respond = (status: number, body: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if ((req.headers.authorization ?? "") !== `Bearer ${TOKEN}`) {
      respond(401, { error: "unauthorized" });
      return;
    }
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/v1/conversations") {
      respond(200, { conversations });
      return;
    }
    const match = url.pathname.match(/^\/v1\/conversations\/([^/]+)\/messages$/);
    if (match && req.method === "POST") {
      const id = decodeURIComponent(match[1] ?? "");
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as { body?: string };
      const message = {
        id: "m-adapter",
        conversationId: id,
        body: String(parsed.body ?? ""),
        sentAtUnixMs: 50,
        direction: "out",
        status: "sent",
      };
      messages[id] = [...(messages[id] ?? []), message];
      respond(200, { message });
      return;
    }
    if (match && req.method === "GET") {
      const id = decodeURIComponent(match[1] ?? "");
      respond(200, { messages: messages[id] ?? [] });
      return;
    }
    respond(404, { error: "not_found" });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("lab listen failed");
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    }),
  };
};

describe("private-dc-adapter L2 live HTTP", () => {
  let lab: LabHandle;

  beforeAll(async () => {
    lab = await startLab();
  });

  afterEach(() => {
    clearPrivateDcSession();
    resetPrivateDcFetchImplForTests();
  });

  afterAll(async () => {
    await lab.close();
  });

  it("connects, lists, and sends through the adapter", async () => {
    writePrivateDcSession({ baseUrl: lab.baseUrl, bearerToken: TOKEN }, "default");
    await privateDcAdapter.connect("clearnet", "default");
    await expect(privateDcAdapter.listConversations("default")).resolves.toEqual([
      { id: "ops", title: "Ops" },
    ]);
    await expect(privateDcAdapter.listMessages({
      profileId: "default",
      conversationId: "ops",
      myPublicKeyHex: "0".repeat(64),
    })).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ conversationId: "ops", body: expect.any(String) }),
      ]),
    );
    await expect(privateDcAdapter.sendMessage({
      profileId: "default",
      conversationId: "ops",
      body: "adapter-l2",
    })).rejects.toThrow(/private_dc_t3_plaintext_refused/);

    await expect(privateDcAdapter.sendEnvelope({
      profileId: "default",
      conversationId: "ops",
      envelope: "adapter-l2-sealed",
      clientMessageId: "cmid-adapter-l2",
    })).resolves.toMatchObject({
      conversationId: "ops",
      envelope: "adapter-l2-sealed",
      status: "accepted",
    });
  });
});
