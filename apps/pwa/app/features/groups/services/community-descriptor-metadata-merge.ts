import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { readBotPubkeysFromMetadataField } from "./community-bot-policy";
import { readStewardPubkeysFromMetadataField } from "./community-steward-policy";

/** Merge steward list from sealed/relay descriptor payloads (preserve prior when omitted). */
export const mergeDescriptorStewardPubkeys = (
  incoming: unknown,
  previous: ReadonlyArray<PublicKeyHex> | undefined,
): ReadonlyArray<PublicKeyHex> | undefined => {
  const stewards = readStewardPubkeysFromMetadataField(incoming);
  return stewards.length > 0 ? stewards : previous;
};

/** Merge bot list — explicit empty array clears bots; omitted field keeps previous. */
export const mergeDescriptorBotPubkeys = (
  incoming: unknown,
  previous: ReadonlyArray<PublicKeyHex> | undefined,
): ReadonlyArray<PublicKeyHex> | undefined => {
  if (incoming === undefined) {
    return previous;
  }
  return readBotPubkeysFromMetadataField(incoming);
};
