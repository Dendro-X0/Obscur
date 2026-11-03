/**
 * P4c L2 — private-dc-client against a live localhost /v1 lab server (real fetch).
 * @see specs/backend/platform-p4c-private-dc-l2-lab-soak-2026-11.md
 */
import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PRIVATE_DC_HTTP_ERROR,
  privateDcListConversations,
  privateDcListMessages,
  privateDcSendMessage,
} from "./private-dc-client";
import type { PrivateDcSession } from "./private-dc-session";

const TOKEN = "vitest-lab-token";

type LabHandle = Readonly<{
  baseUrl: string;
  close: () => Promise<void>;
}>;

const startLab = async (): Promise<LabHandle> => {
  const conversations = [{ id: "ops", title: "Ops" }];
  const messages: Record<string, Array<Record<string, unknown>>> = {
    ops: [{
      id: "m1",
      conversationId: "ops",
      body: "seed",
      sentAtUnixMs: 10,
      direction: "in",
      status: "delivered",
    }],
  };

  const server = http.createServer(async (req, res) => {
    const auth = req.headers.authorization ?? "";
    const respond = (status: number, body: unknown) => {
      const payload = JSON.stringify(body);
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(payload);
    };
    if (auth !== `Bearer ${TOKEN}`) {
      respond(401, { error: "unauthorized" });
      return;
    }
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/v1/conversations") {
      respond(200, { conversations });
      return;
    }
    const match = url.pathname.match(/^\/v1\/conversations\/([^/]+)\/messages$/);
    if (match && req.method === "GET") {
      const id = decodeURIComponent(match[1] ?? "");
      respond(200, { messages: messages[id] ?? [] });
      return;
    }
    if (match && req.method === "POST") {
      const id = decodeURIComponent(match[1] ?? "");
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as { body?: string };
      const message = {
        id: "m-out",
        conversationId: id,
        body: String(parsed.body ?? ""),
        sentAtUnixMs: 99,
        direction: "out",
        status: "sent",
      };
      messages[id] = [...(messages[id] ?? []), message];
      respond(200, { message });
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

describe("private-dc-client L2 lab HTTP", () => {
  let lab: LabHandle;
  let session: PrivateDcSession;

  beforeAll(async () => {
    lab = await startLab();
    session = { baseUrl: lab.baseUrl, bearerToken: TOKEN };
  });

  afterAll(async () => {
    await lab.close();
  });

  it("lists, sends, and re-lists over live localhost", async () => {
    await expect(privateDcListConversations(session)).resolves.toEqual([
      { id: "ops", title: "Ops" },
    ]);
    await expect(privateDcListMessages(session, { conversationId: "ops" })).resolves.toEqual([
      expect.objectContaining({ id: "m1", body: "seed" }),
    ]);
    await expect(privateDcSendMessage(session, {
      conversationId: "ops",
      body: "hello-l2",
    })).resolves.toMatchObject({
      id: "m-out",
      body: "hello-l2",
      conversationId: "ops",
      direction: "out",
    });
  });

  it("fail-closes on 401 from live lab", async () => {
    await expect(privateDcListConversations({
      baseUrl: lab.baseUrl,
      bearerToken: "wrong",
    })).rejects.toThrow(new RegExp(`${PRIVATE_DC_HTTP_ERROR}_401`));
  });
});
