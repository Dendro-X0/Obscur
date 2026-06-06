import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { normalizeWorkspaceRelayUrl } from "@/app/features/groups/services/workspace-relay-url";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { validateRelayUrl } from "../hooks/validate-relay-url";

type RelayListItem = Readonly<{
  url: string;
  enabled: boolean;
}>;

const getRelayListStorageKeyV2 = (publicKeyHex: PublicKeyHex, profileId?: string): string => (
  getScopedStorageKey(`obscur.relay_list.v2.${publicKeyHex}`, profileId ?? getResolvedProfileId())
);

const getRelayListStorageKeyV1Scoped = (publicKeyHex: PublicKeyHex, profileId?: string): string => (
  getScopedStorageKey(`obscur.relay_list.v1.${publicKeyHex}`, profileId ?? getResolvedProfileId())
);

const getRelayListStorageKeyV1Legacy = (publicKeyHex: PublicKeyHex): string => (
  `obscur.relay_list.v1.${publicKeyHex}`
);

const toTrustedRelayUrl = (url: string): string | null => {
  const validated = validateRelayUrl(url, { allowLocalhostWs: true });
  if (!validated?.normalizedUrl) {
    return null;
  }
  return normalizeWorkspaceRelayUrl(validated.normalizedUrl);
};

const parseRelayListPayload = (raw: string): ReadonlyArray<RelayListItem> | null => {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    return null;
  }
  const items: RelayListItem[] = parsed
    .map((candidate: unknown): RelayListItem | null => {
      if (!candidate || typeof candidate !== "object") {
        return null;
      }
      const record = candidate as Record<string, unknown>;
      const url = typeof record.url === "string" ? record.url : "";
      const enabled = typeof record.enabled === "boolean" ? record.enabled : true;
      const trustedUrl = toTrustedRelayUrl(url);
      if (!trustedUrl) {
        return null;
      }
      return { url: trustedUrl, enabled };
    })
    .filter((item: RelayListItem | null): item is RelayListItem => item !== null);
  return items.length > 0 ? items : null;
};

/** Canonical enabled relay URLs — same v2/v1 storage order as `use-relay-list`. */
export const loadEnabledRelayUrlsForIdentity = (
  publicKeyHex: PublicKeyHex,
  profileId?: string,
): ReadonlyArray<string> => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const v2Raw = window.localStorage.getItem(getRelayListStorageKeyV2(publicKeyHex, profileId));
    if (v2Raw) {
      const parsed = parseRelayListPayload(v2Raw);
      if (parsed) {
        return extractEnabledUrls(parsed);
      }
    }

    const legacyRaw =
      window.localStorage.getItem(getRelayListStorageKeyV1Scoped(publicKeyHex, profileId))
      ?? window.localStorage.getItem(getRelayListStorageKeyV1Legacy(publicKeyHex));
    if (!legacyRaw) {
      return [];
    }
    const parsed = parseRelayListPayload(legacyRaw);
    return parsed ? extractEnabledUrls(parsed) : [];
  } catch {
    return [];
  }
};

const extractEnabledUrls = (relays: ReadonlyArray<RelayListItem>): ReadonlyArray<string> => {
  const urls = relays
    .filter((relay) => relay.enabled !== false)
    .map((relay) => relay.url.trim())
    .filter((url) => url.length > 0);
  return Array.from(new Set(urls));
};
