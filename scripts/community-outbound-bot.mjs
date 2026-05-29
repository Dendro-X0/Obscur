#!/usr/bin/env node
/**
 * B1 — publish one outbound sealed announcement to a managed workspace relay.
 *
 * @example
 * OBSCUR_BOT_NSEC=nsec1… \
 * OBSCUR_BOT_RELAY_URL=ws://127.0.0.1:7000 \
 * OBSCUR_BOT_GROUP_ID=<group-id> \
 * OBSCUR_BOT_ROOM_KEY_HEX=<64-hex> \
 * OBSCUR_BOT_ALLOWED_PUBKEYS=<bot-pubkey-hex> \
 * node scripts/community-outbound-bot.mjs --message "CI deploy succeeded"
 */
import {
  assertBotPubkeyAllowlisted,
  buildSealedCommunityAnnouncementEvent,
  decodePrivateKeyInput,
  derivePublicKeyHexFromPrivate,
  publishEventToRelay,
} from "./lib/community-bot-crypto.mjs";

const parseArgs = (argv) => {
  const flags = new Set();
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      flags.add("dry-run");
      continue;
    }
    if (arg === "--message" || arg === "-m") {
      options.message = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (arg.startsWith("--message=")) {
      options.message = arg.slice("--message=".length);
    }
  }
  return { flags, options };
};

const readEnv = (key, fallback = "") => (process.env[key] ?? fallback).trim();

const main = async () => {
  const { flags, options } = parseArgs(process.argv.slice(2));
  const dryRun = flags.has("dry-run");

  const nsecOrHex = readEnv("OBSCUR_BOT_NSEC");
  const relayUrl = readEnv("OBSCUR_BOT_RELAY_URL");
  const groupId = readEnv("OBSCUR_BOT_GROUP_ID");
  const roomKeyHex = readEnv("OBSCUR_BOT_ROOM_KEY_HEX");
  const message = (options.message || readEnv("OBSCUR_BOT_MESSAGE")).trim();
  const allowedRaw = readEnv("OBSCUR_BOT_ALLOWED_PUBKEYS");

  if (!nsecOrHex || !relayUrl || !groupId || !roomKeyHex || !message) {
    console.error(`[community-outbound-bot] Missing required env/args.
  OBSCUR_BOT_NSEC          Bot signing key (nsec or hex)
  OBSCUR_BOT_RELAY_URL      Operator workspace relay (wss:// or ws://)
  OBSCUR_BOT_GROUP_ID       Sealed community group id
  OBSCUR_BOT_ROOM_KEY_HEX   Room key from steward export
  OBSCUR_BOT_MESSAGE        Announcement text (or --message)
  OBSCUR_BOT_ALLOWED_PUBKEYS  Optional comma-separated allowlist (recommended)
`);
    process.exit(1);
  }

  const privateKeyHex = decodePrivateKeyInput(nsecOrHex);
  if (!privateKeyHex) {
    console.error("[community-outbound-bot] Invalid OBSCUR_BOT_NSEC");
    process.exit(1);
  }

  const allowedBotPubkeys = allowedRaw
    ? allowedRaw.split(/[,\s]+/).filter(Boolean)
    : [];

  const allowlist = assertBotPubkeyAllowlisted({
    privateKeyHex,
    allowedBotPubkeys,
  });
  const botPubkey = derivePublicKeyHexFromPrivate(privateKeyHex);

  const event = await buildSealedCommunityAnnouncementEvent({
    privateKeyHex,
    groupId,
    roomKeyHex,
    content: message,
  });

  console.log("[community-outbound-bot] bot pubkey", botPubkey);
  console.log("[community-outbound-bot] group", groupId);
  console.log("[community-outbound-bot] relay", relayUrl);
  console.log("[community-outbound-bot] event id", event.id);
  if (!allowlist.skipped) {
    console.log("[community-outbound-bot] allowlist check OK");
  } else {
    console.log("[community-outbound-bot] allowlist check skipped (set OBSCUR_BOT_ALLOWED_PUBKEYS)");
  }

  if (dryRun) {
    console.log("[community-outbound-bot] dry-run — event built, not published");
    return;
  }

  const result = await publishEventToRelay({ relayUrl, event });
  console.log("[community-outbound-bot] published:", result.message ?? "ok");
};

main().catch((error) => {
  console.error(
    "[community-outbound-bot] failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
