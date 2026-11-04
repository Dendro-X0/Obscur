#!/usr/bin/env node
/**
 * One-shot: republish kind 0 + kind 31950 friend-code alias to discovery relays.
 * Usage (do NOT commit secrets):
 *   node scripts/republish-friend-code-discovery.mjs
 * Reads JSON accounts from stdin or --accounts path.
 *
 * Account shape: { username, inviteCode, privateKey }  // hex or nsec
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(scriptDir, "../apps/pwa/node_modules/nostr-tools/lib/nostr.cjs"));
const { finalizeEvent, getPublicKey, nip19 } = require("nostr-tools");

const hexToBytes = (hex) => {
  const normalized = hex.toLowerCase();
  const out = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

const WebSocketImpl = globalThis.WebSocket;
if (typeof WebSocketImpl !== "function") {
  throw new Error("Global WebSocket is required (Node 22+)");
}

const FRIEND_CODE_ALIAS_KIND = 31950;
const FRIEND_CODE_ALIAS_LABEL = "obscur-friend-code";
const RELAYS = [
  "wss://nos.lol",
  "wss://relay.primal.net",
  "wss://relay.damus.io",
];

const parseSecret = (raw) => {
  const trimmed = String(raw ?? "").trim();
  if (trimmed.startsWith("nsec1")) {
    const decoded = nip19.decode(trimmed);
    if (decoded.type !== "nsec") throw new Error("expected nsec");
    return decoded.data;
  }
  if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    throw new Error("private key must be 64-hex or nsec");
  }
  return hexToBytes(trimmed.toLowerCase());
};

const buildKind0 = ({ username, inviteCode, pubkey }) => {
  const code = inviteCode.trim().toUpperCase();
  let about = `Find me on Obscur with this code: ${code}`;
  return {
    kind: 0,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ["code", code],
      ["i", code],
      ["l", "obscur-invite"],
      ["t", "obscur"],
    ],
    content: JSON.stringify({
      name: username,
      display_name: username,
      about,
      inviteCode: code,
      code,
    }),
    pubkey,
  };
};

const buildAlias = ({ inviteCode, pubkey }) => {
  const code = inviteCode.trim().toUpperCase();
  return {
    kind: FRIEND_CODE_ALIAS_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ["d", code],
      ["p", pubkey],
      ["l", FRIEND_CODE_ALIAS_LABEL],
    ],
    content: JSON.stringify({ v: 1, code, pubkey }),
    pubkey,
  };
};

const publishToRelay = (url, event, timeoutMs = 12_000) =>
  new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch { /* ignore */ }
      resolve(result);
    };
    const ws = new WebSocketImpl(url);
    const timer = setTimeout(() => finish({ ok: false, reason: "timeout" }), timeoutMs);
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify(["EVENT", event]));
    });
    ws.addEventListener("message", (msg) => {
      try {
        const data = JSON.parse(typeof msg.data === "string" ? msg.data : msg.data.toString());
        if (Array.isArray(data) && data[0] === "OK" && data[1] === event.id) {
          clearTimeout(timer);
          finish({ ok: Boolean(data[2]), reason: data[3] || (data[2] ? "ok" : "rejected") });
        }
      } catch {
        // ignore
      }
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      finish({ ok: false, reason: "ws_error" });
    });
  });

const loadAccounts = () => {
  const args = process.argv.slice(2);
  const pathIdx = args.indexOf("--accounts");
  if (pathIdx >= 0 && args[pathIdx + 1]) {
    return JSON.parse(readFileSync(args[pathIdx + 1], "utf8"));
  }
  if (!process.stdin.isTTY) {
    return JSON.parse(readFileSync(0, "utf8"));
  }
  throw new Error("Pass --accounts <file.json> or pipe JSON on stdin");
};

const main = async () => {
  const accounts = loadAccounts();
  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error("accounts must be a non-empty array");
  }

  for (const account of accounts) {
    const sk = parseSecret(account.privateKey);
    const pubkey = getPublicKey(sk);
    const kind0 = finalizeEvent(buildKind0({
      username: account.username,
      inviteCode: account.inviteCode,
      pubkey,
    }), sk);
    const alias = finalizeEvent(buildAlias({
      inviteCode: account.inviteCode,
      pubkey,
    }), sk);

    console.log(`\n== ${account.username} ${account.inviteCode} pubkey=${pubkey.slice(0, 12)}…`);
    for (const event of [kind0, alias]) {
      console.log(`  publish kind ${event.kind} id=${event.id.slice(0, 12)}…`);
      for (const relay of RELAYS) {
        const result = await publishToRelay(relay, event);
        console.log(`    ${relay}: ${result.ok ? "OK" : "FAIL"} (${result.reason})`);
      }
    }
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
