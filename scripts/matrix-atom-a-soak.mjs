#!/usr/bin/env node
/**
 * Headless L2 Atom A — Matrix HS login → sync rooms → optional send.
 * Credentials from env only (never commit). See:
 *   specs/backend/protocol-adaptation-l2-matrix-tor-soak-2026-10.md
 *
 * Auth (one of):
 *   Password path:
 *     OBSCUR_MATRIX_HS_URL   e.g. https://matrix.org
 *     OBSCUR_MATRIX_USER     localpart or @user:server
 *     OBSCUR_MATRIX_PASSWORD
 *   Access-token path (SSO / Element — preferred when no password):
 *     OBSCUR_MATRIX_HS_URL
 *     OBSCUR_MATRIX_ACCESS_TOKEN
 *     OBSCUR_MATRIX_USER     optional hint (whoami wins)
 * Optional:
 *   OBSCUR_MATRIX_ROOM_ID  !room:server — enables A3 send
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const loadDotEnvLocal = () => {
  const envPath = path.join(root, "apps/pwa/.env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
};

loadDotEnvLocal();

const hs = (process.env.OBSCUR_MATRIX_HS_URL || "").trim().replace(/\/+$/, "");
const user = (process.env.OBSCUR_MATRIX_USER || "").trim();
const password = process.env.OBSCUR_MATRIX_PASSWORD || "";
const accessTokenEnv = (process.env.OBSCUR_MATRIX_ACCESS_TOKEN || "").trim();
const roomId = (process.env.OBSCUR_MATRIX_ROOM_ID || "").trim();
const useTokenPath = accessTokenEnv.length > 0;

const stamp = (atom, result, note) => {
  console.log(`[Atom A] ${atom}: ${result}${note ? ` — ${note}` : ""}`);
};

if (!hs) {
  stamp("creds", "Blocked", "set OBSCUR_MATRIX_HS_URL in apps/pwa/.env.local");
  process.exit(2);
}

if (!useTokenPath && (!user || !password)) {
  stamp(
    "creds",
    "Blocked",
    "set OBSCUR_MATRIX_ACCESS_TOKEN (SSO) or OBSCUR_MATRIX_USER + OBSCUR_MATRIX_PASSWORD",
  );
  process.exit(2);
}

const localpart = user.replace(/^@/, "").split(":")[0] ?? user;

const matrixFetch = async (accessToken, pathSuffix, init = {}) => {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${hs}${pathSuffix}`, { ...init, headers });
  const text = await response.text();
  let body = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }
  if (!response.ok) {
    const errcode = typeof body.errcode === "string" ? body.errcode : "M_UNKNOWN";
    const error = typeof body.error === "string" ? body.error : response.statusText;
    throw new Error(`Matrix ${errcode}: ${error}`);
  }
  return body;
};

try {
  let accessToken;
  let userId;

  if (useTokenPath) {
    const whoami = await matrixFetch(accessTokenEnv, "/_matrix/client/v3/account/whoami", {
      method: "GET",
    });
    accessToken = accessTokenEnv;
    userId = typeof whoami.user_id === "string" ? whoami.user_id : user;
    if (!userId) throw new Error("whoami missing user_id");
    stamp("A1 login", "Pass", `${userId} (access-token / whoami)`);
  } else {
    const login = await matrixFetch(null, "/_matrix/client/v3/login", {
      method: "POST",
      body: JSON.stringify({
        type: "m.login.password",
        identifier: { type: "m.id.user", user: localpart },
        password,
        initial_device_display_name: "Obscur-AtomA-Soak",
      }),
    });
    accessToken = login.access_token;
    userId = login.user_id || user;
    if (!accessToken) throw new Error("missing access_token");
    stamp("A1 login", "Pass", `${userId} (password)`);
  }

  const filter = encodeURIComponent(
    JSON.stringify({
      room: { timeline: { limit: 5 }, state: { lazy_load_members: true } },
    }),
  );
  const sync = await matrixFetch(
    accessToken,
    `/_matrix/client/v3/sync?timeout=0&filter=${filter}`,
    { method: "GET" },
  );
  const joined = Object.keys(sync?.rooms?.join ?? {});
  stamp("A2 sync", "Pass", `${joined.length} joined room(s)`);

  if (!roomId) {
    stamp("A3 send", "Skipped", "set OBSCUR_MATRIX_ROOM_ID to exercise send");
    stamp("Atom A", "Pass (partial)", "login+sync; UI switch A4/A5 still desktop");
    process.exit(0);
  }

  const txnId = `obscur-atom-a-${Date.now()}`;
  const encodedRoom = encodeURIComponent(roomId);
  const encodedTxn = encodeURIComponent(txnId);
  const sent = await matrixFetch(
    accessToken,
    `/_matrix/client/v3/rooms/${encodedRoom}/send/m.room.message/${encodedTxn}`,
    {
      method: "PUT",
      body: JSON.stringify({
        msgtype: "m.text",
        body: `Obscur Atom A soak ${new Date().toISOString()}`,
      }),
    },
  );
  if (!sent.event_id) throw new Error("missing event_id");
  stamp("A3 send", "Pass", sent.event_id);
  stamp("Atom A", "Pass", "login+sync+send (A4/A5 still desktop UI)");
  process.exit(0);
} catch (error) {
  stamp("Atom A", "Fail", error instanceof Error ? error.message : String(error));
  process.exit(1);
}
