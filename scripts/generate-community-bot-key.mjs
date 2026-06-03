#!/usr/bin/env node
/**
 * Generate a bot signing key for B1/B2 community bot scripts.
 * Uses the same crypto path as scripts/lib/community-bot-crypto.mjs.
 *
 *   pnpm community-bot:generate-key
 *   pnpm community-bot:generate-key -- --nsec
 */
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { decodePrivateKeyInput, derivePublicKeyHexFromPrivate } from "./lib/community-bot-crypto.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requireFromPwa = createRequire(resolve(repoRoot, "apps/pwa/package.json"));
const { nip19 } = requireFromPwa("nostr-tools");

const emitNsec = process.argv.includes("--nsec");
const inputHex = process.argv.find((arg) => /^[0-9a-f]{64}$/i.test(arg));

const privateKeyHex = inputHex?.toLowerCase() ?? randomBytes(32).toString("hex");
const publicKeyHex = derivePublicKeyHexFromPrivate(privateKeyHex);

console.log("Register this pubkey in Manage → General → Outbound bots:");
console.log(`  ${publicKeyHex}`);
console.log("");
console.log("Use as OBSCUR_BOT_NSEC (pick one):");
console.log(`  hex:  ${privateKeyHex}`);
if (emitNsec) {
  console.log(`  nsec: ${nip19.nsecEncode(Buffer.from(privateKeyHex, "hex"))}`);
} else {
  console.log("  (pass --nsec to also print nsec1… form)");
}

if (inputHex && !decodePrivateKeyInput(inputHex)) {
  console.error("[community-bot:generate-key] Ignored invalid hex argument");
  process.exit(1);
}
