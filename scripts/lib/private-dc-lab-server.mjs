/**
 * Lab-only Private DC /v1 JSON server (P4c). Bind 127.0.0.1 only.
 * @see specs/backend/platform-p4c-private-dc-l2-lab-soak-2026-11.md
 */
import http from "node:http";

const DEFAULT_PORT = 8791;
const DEFAULT_TOKEN = "lab-bearer-token";

const seedState = () => ({
  conversations: [
    { id: "ops", title: "Ops" },
    { id: "general", title: "General" },
  ],
  messages: {
    ops: [
      {
        id: "m-seed-1",
        conversationId: "ops",
        body: "lab seed",
        sentAtUnixMs: 1_700_000_000_000,
        direction: "in",
        status: "delivered",
      },
    ],
    general: [],
  },
});

const readJson = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};

const sendJson = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end(payload);
};

/**
 * @param {Readonly<{ port?: number; bearerToken?: string; requireBearer?: boolean }>} [options]
 */
export const startPrivateDcLabServer = (options = {}) => {
  const port = options.port ?? Number(process.env.PRIVATE_DC_LAB_PORT ?? DEFAULT_PORT);
  const bearerToken = options.bearerToken ?? process.env.PRIVATE_DC_LAB_TOKEN ?? DEFAULT_TOKEN;
  const requireBearer = options.requireBearer ?? true;
  const state = seedState();

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === "OPTIONS") {
        sendJson(res, 204, {});
        return;
      }

      const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
      if (requireBearer) {
        const auth = req.headers.authorization ?? "";
        if (auth !== `Bearer ${bearerToken}`) {
          sendJson(res, 401, { error: "unauthorized" });
          return;
        }
      }

      if (req.method === "GET" && url.pathname === "/v1/conversations") {
        sendJson(res, 200, { conversations: state.conversations });
        return;
      }

      const messagesMatch = url.pathname.match(/^\/v1\/conversations\/([^/]+)\/messages$/);
      if (messagesMatch) {
        const conversationId = decodeURIComponent(messagesMatch[1]);
        if (!state.conversations.some((row) => row.id === conversationId)) {
          sendJson(res, 404, { error: "conversation_not_found" });
          return;
        }
        if (req.method === "GET") {
          let rows = state.messages[conversationId] ?? [];
          const limit = Number(url.searchParams.get("limit") ?? "0");
          if (Number.isFinite(limit) && limit > 0) {
            rows = rows.slice(-Math.floor(limit));
          }
          sendJson(res, 200, { messages: rows });
          return;
        }
        if (req.method === "POST") {
          const body = await readJson(req);
          const text = typeof body.body === "string" ? body.body.trim() : "";
          if (!text) {
            sendJson(res, 400, { error: "body_required" });
            return;
          }
          const message = {
            id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            conversationId,
            body: text,
            sentAtUnixMs: Date.now(),
            direction: "out",
            status: "sent",
          };
          if (!state.messages[conversationId]) {
            state.messages[conversationId] = [];
          }
          state.messages[conversationId].push(message);
          sendJson(res, 200, { message });
          return;
        }
      }

      sendJson(res, 404, { error: "not_found" });
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      resolve({
        server,
        port,
        bearerToken,
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((resClose, rejClose) => {
          server.close((err) => (err ? rejClose(err) : resClose()));
        }),
      });
    });
  });
};

export const PRIVATE_DC_LAB_DEFAULTS = {
  port: DEFAULT_PORT,
  bearerToken: DEFAULT_TOKEN,
};
