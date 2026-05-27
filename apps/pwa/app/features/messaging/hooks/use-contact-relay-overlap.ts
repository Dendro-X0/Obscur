"use client";
/**
 * use-contact-relay-overlap.ts
 *
 * Derives whether the local user and a contact share at least one relay in
 * common. On first evaluation it reads the NIP-65 cache; if no data exists it
 * fires a one-shot active fetch via the relay pool and re-evaluates when the
 * result arrives.
 *
 * States:
 *   "unknown"     — fetch in progress or contact published no relays
 *   "overlap"     — at least one relay in common; delivery likely works
 *   "no_overlap"  — contact has a known relay list and none match ours
 */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRelayPoolRef } from "@/app/features/relays/hooks/use-relay-pool-ref";
import { nip65Service } from "@/app/features/relays/utils/nip65-service";
import type { UserRelayList } from "@/app/features/relays/utils/nip65-service";
import { peerRelayEvidenceStore } from "@/app/features/messaging/services/peer-relay-evidence-store";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { NostrFilter } from "@/app/features/messaging/controllers/dm-controller-state";
import type { NostrEvent } from "@dweb/nostr/nostr-event";

export type RelayOverlapStatus = "unknown" | "overlap" | "no_overlap";

export type ContactRelayOverlapResult = Readonly<{
  status: RelayOverlapStatus;
  ourRelays: ReadonlyArray<string>;
  theirRelays: ReadonlyArray<string>;
  sharedRelays: ReadonlyArray<string>;
  suggestedRelay: string | null;
}>;

type Nip65Pool = Readonly<{
  subscribe: (filters: ReadonlyArray<NostrFilter>, onEvent: (event: NostrEvent, url: string) => void) => string;
  unsubscribe: (id: string) => void;
}>;

const normalizeUrl = (url: string): string =>
  url.replace(/\/$/, "").toLowerCase();

const deriveOverlap = (
  ourActiveRelayUrls: ReadonlyArray<string>,
  theirList: UserRelayList | null | undefined,
): ContactRelayOverlapResult => {
  const empty: ContactRelayOverlapResult = {
    status: "unknown",
    ourRelays: ourActiveRelayUrls,
    theirRelays: [],
    sharedRelays: [],
    suggestedRelay: null,
  };

  if (!theirList || theirList.relays.length === 0) return empty;

  const theirRelays = theirList.relays.map((r) => normalizeUrl(r.url));
  const ourNormalized = ourActiveRelayUrls.map(normalizeUrl);
  const sharedSet = new Set(ourNormalized.filter((u) => theirRelays.includes(u)));
  const sharedRelays = Array.from(sharedSet);

  if (sharedRelays.length > 0) {
    return {
      status: "overlap",
      ourRelays: ourActiveRelayUrls,
      theirRelays: theirList.relays.map((r) => r.url),
      sharedRelays,
      suggestedRelay: null,
    };
  }

  const suggestedRelay =
    theirList.relays.find((r) => r.write)?.url ?? theirList.relays[0]?.url ?? null;

  return {
    status: "no_overlap",
    ourRelays: ourActiveRelayUrls,
    theirRelays: theirList.relays.map((r) => r.url),
    sharedRelays: [],
    suggestedRelay,
  };
};

export const useContactRelayOverlap = (
  contactPubkey: string | null | undefined,
  ourActiveRelayUrls: ReadonlyArray<string> | null | undefined,
  pool?: Nip65Pool | null,
): ContactRelayOverlapResult => {
  const ourRelays = ourActiveRelayUrls ?? [];
  const cachedList = contactPubkey
    ? nip65Service.getRelayList(contactPubkey as PublicKeyHex)
    : undefined;

  const [fetchedList, setFetchedList] = useState<UserRelayList | null | undefined>(undefined);
  const poolRef = useRelayPoolRef(pool ?? null);

  const ourRelaysKey = ourRelays.join("|");

  const evidenceSnapshot = useSyncExternalStore(
    useCallback((onChange) => peerRelayEvidenceStore.subscribe(onChange), []),
    useCallback((): string => {
      if (!contactPubkey) {
        return "";
      }
      return peerRelayEvidenceStore.getRelayUrls(contactPubkey, getResolvedProfileId()).join("|");
    }, [contactPubkey]),
    (): string => "",
  );

  const triggerFetch = useCallback(() => {
    const relayPool = poolRef.current;
    if (!contactPubkey || !relayPool) return;
    void nip65Service
      .fetchContactRelayList(contactPubkey as PublicKeyHex, relayPool)
      .then((result) => { setFetchedList(result); });
  }, [contactPubkey, poolRef]);

  useEffect(() => {
    setFetchedList(undefined);
    if (!contactPubkey) return;
    const inCache = nip65Service.getRelayList(contactPubkey as PublicKeyHex);
    if (!inCache) {
      triggerFetch();
    }
  }, [contactPubkey, triggerFetch]);

  return useMemo(() => {
    if (!contactPubkey) {
      return {
        status: "unknown",
        ourRelays,
        theirRelays: [],
        sharedRelays: [],
        suggestedRelay: null,
      };
    }
    const effectiveList = cachedList ?? fetchedList;
    const evidenceUrls = peerRelayEvidenceStore.getRelayUrls(contactPubkey, getResolvedProfileId());
    const nipRelays = effectiveList?.relays ?? [];
    const evidenceOnly = evidenceUrls.filter(
      (u) => !nipRelays.some((r) => normalizeUrl(r.url) === normalizeUrl(u)),
    );
    let mergedList: UserRelayList | null | undefined = effectiveList;
    if (nipRelays.length > 0 || evidenceUrls.length > 0) {
      mergedList = {
        pubkey: (effectiveList?.pubkey ?? contactPubkey) as PublicKeyHex,
        relays: [
          ...nipRelays,
          ...evidenceOnly.map((url) => ({ url, read: true, write: true })),
        ],
        receivedAt: effectiveList?.receivedAt ?? Date.now(),
      };
    }
    return deriveOverlap(ourRelays, mergedList);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactPubkey, ourRelaysKey, cachedList, fetchedList, evidenceSnapshot]);
};
