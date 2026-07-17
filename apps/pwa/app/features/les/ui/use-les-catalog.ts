"use client";

import { useCallback, useEffect, useState } from "react";
import { resolveVaultProfileId } from "@/app/features/storage/services/vault-at-rest";
import {
  isLesNativeAvailable,
  listLesObjects,
  type LesObjectMeta,
} from "../sdk/les-native-sdk";

export type UseLesCatalogResult = Readonly<{
  items: ReadonlyArray<LesObjectMeta>;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  available: boolean;
}>;

/** Catalog-only Vault list — sole read path for LES R2 grid. */
export function useLesCatalog(): UseLesCatalogResult {
  const available = isLesNativeAvailable();
  const profileId = resolveVaultProfileId();
  const [items, setItems] = useState<ReadonlyArray<LesObjectMeta>>([]);
  const [isLoading, setIsLoading] = useState(available);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isLesNativeAvailable()) {
      setItems([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    try {
      const next = await listLesObjects(resolveVaultProfileId().trim() || undefined);
      setItems(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, profileId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const onChanged = (): void => {
      void refresh();
    };
    window.addEventListener("obscur:les-catalog-changed", onChanged);
    return () => window.removeEventListener("obscur:les-catalog-changed", onChanged);
  }, [refresh]);

  return { items, isLoading, error, refresh, available };
}
