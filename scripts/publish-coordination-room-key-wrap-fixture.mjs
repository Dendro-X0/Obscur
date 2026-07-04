#!/usr/bin/env node
/**
 * One-time fixture backfill — publish coordination room-key wrap for NewTest 2 (Slice C L3).
 *
 * @example
 * node scripts/publish-coordination-room-key-wrap-fixture.mjs \
 *   --coordination http://127.0.0.1:8787 \
 *   --community-id "b93f53e23d8c4456835afd3f4d3a627b:ws://localhost:7000"
 *
 * Optional:
 *   --room-key-hex <64-hex>   Use existing key instead of generating
 *   --group-id <id>           Default: NewTest 2 fixture id
 *   --subject-pubkey <hex>    Default: actor pubkey (Tester1 self-wrap)
 *   --actor-key-hex <hex>     Default: Tester1 dev fixture key
 */
import {
  NEWTEST2_GROUP_ID,
  NEWTEST2_RELAY_URL,
  TESTER1_PRIVATE_KEY_HEX,
  deriveLegacyCommunityId,
  publishCoordinationRoomKeyWrapFixture,
} from "./lib/coordination-room-key-wrap-fixture.mjs";

const args = process.argv.slice(2);
const readArg = (flag, fallback = "") => {
  const index = args.indexOf(flag);
  if (index >= 0 && args[index + 1]) {
    return args[index + 1];
  }
  const prefixed = args.find((arg) => arg.startsWith(`${flag}=`));
  if (prefixed) {
    return prefixed.slice(flag.length + 1);
  }
  return fallback;
};

const coordinationBaseUrl = readArg("--coordination", process.env.OBSCUR_COORDINATION_URL ?? "http://127.0.0.1:8787");
const groupId = readArg("--group-id", NEWTEST2_GROUP_ID);
const relayUrl = readArg("--relay", NEWTEST2_RELAY_URL);
const communityId = readArg("--community-id", deriveLegacyCommunityId(groupId, relayUrl));
const roomKeyHex = readArg("--room-key-hex", process.env.OBSCUR_FIXTURE_ROOM_KEY_HEX ?? "");
const actorPrivateKeyHex = readArg("--actor-key-hex", process.env.OBSCUR_FIXTURE_STEWARD_KEY ?? TESTER1_PRIVATE_KEY_HEX);
const subjectPubkey = readArg("--subject-pubkey", "");

const log = (message) => console.log(`[coordination-room-key-wrap-fixture] ${message}`);

try {
  const health = await fetch(`${coordinationBaseUrl.replace(/\/$/, "")}/health`);
  if (!health.ok) {
    throw new Error(`coordination_health_${health.status}`);
  }

  const result = await publishCoordinationRoomKeyWrapFixture({
    coordinationBaseUrl,
    communityId,
    groupId,
    actorPrivateKeyHex,
    ...(roomKeyHex ? { roomKeyHex } : {}),
    ...(subjectPubkey ? { subjectPubkey } : {}),
  });

  console.log(JSON.stringify({ ok: true, ...result }));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    communityId,
    groupId,
  }, null, 2));
  process.exit(1);
}