"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { normalizePublicKeyHex, normalizePublicKeyHexList } from "@/app/features/profile/utils/normalize-public-key-hex";

type BlocklistState = Readonly<{
  blockedPublicKeys: ReadonlyArray<PublicKeyHex>;
}>;

type UseBlocklistParams = Readonly<{
  publicKeyHex: PublicKeyHex | null;
}>;

type UseBlocklistResult = Readonly<{
  state: BlocklistState;
  isBlocked: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => boolean;
  addBlocked: (params: Readonly<{ publicKeyInput: string }>) => void;
  removeBlocked: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => void;
}>;

type StoredBlocklist = Readonly<{
  blockedPublicKeys: ReadonlyArray<PublicKeyHex>;
}>;

const createDefaultState = (): StoredBlocklist => {
  return { blockedPublicKeys: [] };
};

const getStorageKey = (publicKeyHex: PublicKeyHex): string => {
  return `obscur.blocklist.v1.${publicKeyHex}`;
};

const loadFromStorage = (publicKeyHex: PublicKeyHex): StoredBlocklist => {
  if (typeof window === "undefined") {
    return createDefaultState();
  }
  try {
    const raw: string | null = window.localStorage.getItem(getStorageKey(publicKeyHex));
    if (!raw) {
      return createDefaultState();
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return createDefaultState();
    }
    const record = parsed as Record<string, unknown>;
    const blockedRaw: unknown = record.blockedPublicKeys;
    if (!Array.isArray(blockedRaw)) {
      return createDefaultState();
    }
    const blockedPublicKeys = normalizePublicKeyHexList(
      blockedRaw.filter((v: unknown): v is string => typeof v === "string"),
    );
    return { blockedPublicKeys };
  } catch {
    return createDefaultState();
  }
};

const saveToStorage = (publicKeyHex: PublicKeyHex, value: StoredBlocklist): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(getStorageKey(publicKeyHex), JSON.stringify(value));
  } catch {
    return;
  }
};

export const useBlocklist = (params: UseBlocklistParams): UseBlocklistResult => {
  const [stored, setStored] = useState<StoredBlocklist>(() => {
    if (!params.publicKeyHex) {
      return createDefaultState();
    }
    return loadFromStorage(params.publicKeyHex);
  });
  useEffect((): void => {
    queueMicrotask((): void => {
      if (!params.publicKeyHex) {
        setStored(createDefaultState());
        return;
      }
      setStored(loadFromStorage(params.publicKeyHex));
    });
  }, [params.publicKeyHex]);
  useEffect((): void => {
    if (!params.publicKeyHex) {
      return;
    }
    saveToStorage(params.publicKeyHex, stored);
  }, [params.publicKeyHex, stored]);
  const isBlocked = useCallback((p: Readonly<{ publicKeyHex: PublicKeyHex }>): boolean => {
    const normalized = normalizePublicKeyHex(p.publicKeyHex);
    if (!normalized) {
      return false;
    }
    return stored.blockedPublicKeys.includes(normalized);
  }, [stored.blockedPublicKeys]);
  const addBlocked = useCallback((p: Readonly<{ publicKeyInput: string }>): void => {
    const normalized = normalizePublicKeyHex(p.publicKeyInput);
    if (!normalized) {
      return;
    }
    setStored((prev: StoredBlocklist): StoredBlocklist => {
      if (prev.blockedPublicKeys.includes(normalized)) {
        return prev;
      }
      return { blockedPublicKeys: [...prev.blockedPublicKeys, normalized] };
    });
  }, []);
  const removeBlocked = useCallback((p: Readonly<{ publicKeyHex: PublicKeyHex }>): void => {
    const normalized = normalizePublicKeyHex(p.publicKeyHex);
    if (!normalized) {
      return;
    }
    setStored((prev: StoredBlocklist): StoredBlocklist => {
      return { blockedPublicKeys: prev.blockedPublicKeys.filter((v: PublicKeyHex): boolean => v !== normalized) };
    });
  }, []);
  const state: BlocklistState = useMemo((): BlocklistState => {
    return { blockedPublicKeys: stored.blockedPublicKeys };
  }, [stored.blockedPublicKeys]);
  return useMemo(
    () => ({ state, isBlocked, addBlocked, removeBlocked }),
    [state, isBlocked, addBlocked, removeBlocked]
  );
};
