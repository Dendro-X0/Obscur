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
  /** Cut 9 — opaque Continuity M2 backups keyed by publicKeyHexHint (lowercase). */
  continuityBackups: /** @type {Record<string, Array<{ id: string; publicKeyHexHint: string; sealedEnvelopeJson: string; acceptedAtUnixMs: number; clientBackupId: string }>>} */ ({}),
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

      // Cut 0.6 — H-dc v0.1 health
      if (req.method === "GET" && url.pathname === "/v1/health") {
        sendJson(res, 200, { ok: true, wire: "hdc-v0.1" });
        return;
      }

      if (req.method === "GET" && url.pathname === "/v1/conversations") {
        sendJson(res, 200, { conversations: state.conversations });
        return;
      }

      // Cut 9 — Continuity M2 opaque sealed backups (never plaintext)
      if (req.method === "POST" && url.pathname === "/v1/continuity/backups") {
        const body = await readJson(req);
        const publicKeyHexHint = typeof body.publicKeyHexHint === "string"
          ? body.publicKeyHexHint.trim().toLowerCase()
          : "";
        const sealedEnvelopeJson = typeof body.sealedEnvelopeJson === "string"
          ? body.sealedEnvelopeJson.trim()
          : "";
        const clientBackupId = typeof body.clientBackupId === "string"
          ? body.clientBackupId.trim()
          : "";
        if (!publicKeyHexHint || !sealedEnvelopeJson || !clientBackupId) {
          sendJson(res, 400, { error: "continuity_backup_fields_required" });
          return;
        }
        const backup = {
          id: `cb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          publicKeyHexHint,
          sealedEnvelopeJson,
          acceptedAtUnixMs: Date.now(),
          clientBackupId,
        };
        if (!state.continuityBackups[publicKeyHexHint]) {
          state.continuityBackups[publicKeyHexHint] = [];
        }
        state.continuityBackups[publicKeyHexHint].push(backup);
        sendJson(res, 200, {
          backup: {
            id: backup.id,
            publicKeyHexHint: backup.publicKeyHexHint,
            acceptedAtUnixMs: backup.acceptedAtUnixMs,
            status: "accepted",
          },
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/v1/continuity/backups/latest") {
        const publicKeyHexHint = (url.searchParams.get("publicKeyHexHint") ?? "").trim().toLowerCase();
        if (!publicKeyHexHint) {
          sendJson(res, 400, { error: "publicKeyHexHint_required" });
          return;
        }
        const rows = state.continuityBackups[publicKeyHexHint] ?? [];
        const latest = rows.length > 0 ? rows[rows.length - 1] : null;
        sendJson(res, 200, {
          backup: latest
            ? {
              id: latest.id,
              publicKeyHexHint: latest.publicKeyHexHint,
              sealedEnvelopeJson: latest.sealedEnvelopeJson,
              acceptedAtUnixMs: latest.acceptedAtUnixMs,
            }
            : null,
        });
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
          const since = Number(url.searchParams.get("since") ?? "0");
          if (Number.isFinite(since) && since > 0) {
            rows = rows.filter((row) => Number(row.sentAtUnixMs) > since);
          }
          const limit = Number(url.searchParams.get("limit") ?? "0");
          if (Number.isFinite(limit) && limit > 0) {
            rows = rows.slice(-Math.floor(limit));
          }
          sendJson(res, 200, { messages: rows });
          return;
        }
        if (req.method === "POST") {
          const body = await readJson(req);
          const envelope = typeof body.envelope === "string" ? body.envelope.trim() : "";
          const clientMessageId = typeof body.clientMessageId === "string"
            ? body.clientMessageId.trim()
            : "";
          const text = typeof body.body === "string" ? body.body.trim() : "";

          // Cut 0.6 — ciphertext path (preferred for private-trust T3)
          if (envelope) {
            if (!clientMessageId) {
              sendJson(res, 400, { error: "client_message_id_required" });
              return;
            }
            const message = {
              id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              conversationId,
              envelope,
              clientMessageId,
              sentAtUnixMs: Date.now(),
              direction: "out",
              // Home ACK → accepted only (never delivered)
              status: "accepted",
            };
            if (!state.messages[conversationId]) {
              state.messages[conversationId] = [];
            }
            state.messages[conversationId].push(message);
            sendJson(res, 200, { message });
            return;
          }

          // P4b v0 plaintext lab path (not T3)
          if (!text) {
            sendJson(res, 400, { error: "body_or_envelope_required" });
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
