"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

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
    const blockedPublicKeys: PublicKeyHex[] = blockedRaw.filter((v: unknown): v is PublicKeyHex => typeof v === "string");
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
    return stored.blockedPublicKeys.includes(p.publicKeyHex);
  }, [stored.blockedPublicKeys]);
  const addBlocked = useCallback((p: Readonly<{ publicKeyInput: string }>): void => {
    const trimmed: string = p.publicKeyInput.trim();
    if (!trimmed) {
      return;
    }
    setStored((prev: StoredBlocklist): StoredBlocklist => {
      const publicKeyHex: PublicKeyHex = trimmed as PublicKeyHex;
      if (prev.blockedPublicKeys.includes(publicKeyHex)) {
        return prev;
      }
      return { blockedPublicKeys: [...prev.blockedPublicKeys, publicKeyHex] };
    });
  }, []);
  const removeBlocked = useCallback((p: Readonly<{ publicKeyHex: PublicKeyHex }>): void => {
    setStored((prev: StoredBlocklist): StoredBlocklist => {
      return { blockedPublicKeys: prev.blockedPublicKeys.filter((v: PublicKeyHex): boolean => v !== p.publicKeyHex) };
    });
  }, []);
  const state: BlocklistState = useMemo((): BlocklistState => {
    return { blockedPublicKeys: stored.blockedPublicKeys };
  }, [stored.blockedPublicKeys]);
  return { state, isBlocked, addBlocked, removeBlocked };
};
