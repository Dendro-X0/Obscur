"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

type RelayListItem = Readonly<{
  url: string;
  enabled: boolean;
}>;

type RelayListState = Readonly<{
  relays: ReadonlyArray<RelayListItem>;
}>;

type UseRelayListParams = Readonly<{
  publicKeyHex: PublicKeyHex | null;
}>;

type MoveRelayDirection = "up" | "down";

type UseRelayListResult = Readonly<{
  state: RelayListState;
  addRelay: (params: Readonly<{ url: string }>) => void;
  removeRelay: (params: Readonly<{ url: string }>) => void;
  setRelayEnabled: (params: Readonly<{ url: string; enabled: boolean }>) => void;
  moveRelay: (params: Readonly<{ url: string; direction: MoveRelayDirection }>) => void;
}>;

const getE2eRelayOverride = (): ReadonlyArray<RelayListItem> | null => {
  const raw: string = (process.env.NEXT_PUBLIC_E2E_RELAYS ?? "").trim();
  if (!raw) {
    return null;
  }
  const urls: string[] = raw
    .split(",")
    .map((value: string): string => value.trim())
    .filter((value: string): boolean => value.length > 0);
  if (urls.length === 0) {
    return null;
  }
  return urls.map((url: string): RelayListItem => ({ url, enabled: true }));
};

const DEFAULT_RELAYS: ReadonlyArray<RelayListItem> = [
  { url: "wss://relay.primal.net", enabled: true },
  { url: "wss://relay.damus.io", enabled: true },
  { url: "wss://nos.lol", enabled: true },
];

const getRelayListStorageKey = (publicKeyHex: PublicKeyHex): string => {
  return `obscur.relay_list.v1.${publicKeyHex}`;
};

const normalizeRelayUrl = (url: string): string => {
  return url.trim();
};

const loadRelayListFromStorage = (publicKeyHex: PublicKeyHex): ReadonlyArray<RelayListItem> => {
  const override: ReadonlyArray<RelayListItem> | null = getE2eRelayOverride();
  if (override) {
    return override;
  }
  if (typeof window === "undefined") {
    return DEFAULT_RELAYS;
  }
  try {
    const raw: string | null = window.localStorage.getItem(getRelayListStorageKey(publicKeyHex));
    if (!raw) {
      return DEFAULT_RELAYS;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return DEFAULT_RELAYS;
    }
    const items: RelayListItem[] = parsed
      .map((candidate: unknown): RelayListItem | null => {
        if (!candidate || typeof candidate !== "object") {
          return null;
        }
        const record = candidate as Record<string, unknown>;
        const url = typeof record.url === "string" ? record.url : "";
        const enabled = typeof record.enabled === "boolean" ? record.enabled : true;
        const normalizedUrl = normalizeRelayUrl(url);
        if (!normalizedUrl) {
          return null;
        }
        return { url: normalizedUrl, enabled };
      })
      .filter((item: RelayListItem | null): item is RelayListItem => item !== null);
    return items.length > 0 ? items : DEFAULT_RELAYS;
  } catch {
    return DEFAULT_RELAYS;
  }
};

const saveRelayListToStorage = (publicKeyHex: PublicKeyHex, relays: ReadonlyArray<RelayListItem>): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(getRelayListStorageKey(publicKeyHex), JSON.stringify(relays));
  } catch {
    return;
  }
};

export const useRelayList = (params: UseRelayListParams): UseRelayListResult => {
  const [relays, setRelays] = useState<ReadonlyArray<RelayListItem>>((): ReadonlyArray<RelayListItem> => {
    const override: ReadonlyArray<RelayListItem> | null = getE2eRelayOverride();
    if (override) {
      return override;
    }
    if (!params.publicKeyHex) {
      return DEFAULT_RELAYS;
    }
    return loadRelayListFromStorage(params.publicKeyHex);
  });
  useEffect((): void => {
    queueMicrotask((): void => {
      const override: ReadonlyArray<RelayListItem> | null = getE2eRelayOverride();
      if (override) {
        setRelays(override);
        return;
      }
      if (!params.publicKeyHex) {
        setRelays(DEFAULT_RELAYS);
        return;
      }
      setRelays(loadRelayListFromStorage(params.publicKeyHex));
    });
  }, [params.publicKeyHex]);
  useEffect((): void => {
    if (!params.publicKeyHex) {
      return;
    }
    saveRelayListToStorage(params.publicKeyHex, relays);
  }, [params.publicKeyHex, relays]);
  const addRelay = useCallback((addParams: Readonly<{ url: string }>): void => {
    const normalizedUrl = normalizeRelayUrl(addParams.url);
    if (!normalizedUrl) {
      return;
    }
    setRelays((prev: ReadonlyArray<RelayListItem>): ReadonlyArray<RelayListItem> => {
      if (prev.some((r: RelayListItem): boolean => r.url === normalizedUrl)) {
        return prev;
      }
      return [...prev, { url: normalizedUrl, enabled: true }];
    });
  }, []);
  const removeRelay = useCallback((removeParams: Readonly<{ url: string }>): void => {
    const normalizedUrl = normalizeRelayUrl(removeParams.url);
    if (!normalizedUrl) {
      return;
    }
    setRelays((prev: ReadonlyArray<RelayListItem>): ReadonlyArray<RelayListItem> => {
      return prev.filter((r: RelayListItem): boolean => r.url !== normalizedUrl);
    });
  }, []);
  const setRelayEnabled = useCallback((enabledParams: Readonly<{ url: string; enabled: boolean }>): void => {
    const normalizedUrl = normalizeRelayUrl(enabledParams.url);
    if (!normalizedUrl) {
      return;
    }
    setRelays((prev: ReadonlyArray<RelayListItem>): ReadonlyArray<RelayListItem> => {
      return prev.map((r: RelayListItem): RelayListItem => {
        if (r.url !== normalizedUrl) {
          return r;
        }
        return { url: r.url, enabled: enabledParams.enabled };
      });
    });
  }, []);
  const moveRelay = useCallback((moveParams: Readonly<{ url: string; direction: MoveRelayDirection }>): void => {
    const normalizedUrl = normalizeRelayUrl(moveParams.url);
    if (!normalizedUrl) {
      return;
    }
    setRelays((prev: ReadonlyArray<RelayListItem>): ReadonlyArray<RelayListItem> => {
      const index: number = prev.findIndex((r: RelayListItem): boolean => r.url === normalizedUrl);
      if (index < 0) {
        return prev;
      }
      const targetIndex: number = moveParams.direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) {
        return prev;
      }
      const next: RelayListItem[] = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  }, []);
  const state: RelayListState = useMemo((): RelayListState => {
    return { relays };
  }, [relays]);
  return { state, addRelay, removeRelay, setRelayEnabled, moveRelay };
};
