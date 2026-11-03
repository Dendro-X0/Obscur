import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { relayListInternals } from "@/app/features/relays/hooks/use-relay-list";
import { reenableWhenNoRelaysEnabled } from "@/app/features/relays/services/relay-transport-scope";

type RelayListEntry = Readonly<{
  url: string;
  enabled: boolean;
}>;

/**
 * Persist a restored/rehydrated relay list without leaving the profile stuck
 * with zero enabled relays (stale backup / Kind list rows with enabled:false).
 */
export const persistHealedRelayList = (
  publicKeyHex: PublicKeyHex,
  relayList: ReadonlyArray<RelayListEntry>,
  profileId?: string,
): ReadonlyArray<RelayListEntry> => {
  const healed = reenableWhenNoRelaysEnabled(relayList, relayListInternals.DEFAULT_RELAYS);
  relayListInternals.saveRelayListToStorage(publicKeyHex, healed.relays, profileId);
  return healed.relays;
};

/**
 * Union by URL; prefer enabled=true when either side has it so a disabled
 * backup/NIP-65 row cannot undo a local re-enable.
 */
export const mergeRelayListPreferEnabled = (
  current: ReadonlyArray<RelayListEntry> | undefined,
  incoming: ReadonlyArray<RelayListEntry> | undefined,
): ReadonlyArray<RelayListEntry> => {
  const byUrl = new Map<string, RelayListEntry>();
  for (const relay of [...(current ?? []), ...(incoming ?? [])]) {
    const url = relay.url.trim();
    if (!url) {
      continue;
    }
    const previous = byUrl.get(url);
    byUrl.set(url, {
      url,
      enabled: Boolean(previous?.enabled || relay.enabled),
    });
  }
  return Array.from(byUrl.values());
};
