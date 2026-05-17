import { useEffect, useMemo, useState } from "react";
import type { LinkPreview } from "../lib/link-preview";
import { fetchLinkPreview } from "./fetch-link-preview";

type LinkPreviewState = Readonly<
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; preview: LinkPreview }
  | { status: "error"; message: string }
>;

type CachedEntry = Readonly<{ status: "ok"; preview: LinkPreview } | { status: "error"; message: string }>;

const CACHE: Map<string, CachedEntry> = new Map();

type LastResolved = Readonly<
  | { url: string; entry: CachedEntry }
  | { url: null; entry: null }
>;

const useLinkPreview = (url: string | null): Readonly<{ state: LinkPreviewState }> => {
  const cached: CachedEntry | null = useMemo((): CachedEntry | null => {
    if (!url) {
      return null;
    }
    return CACHE.get(url) ?? null;
  }, [url]);

  const [lastResolved, setLastResolved] = useState<LastResolved>({ url: null, entry: null });

  const derivedState: LinkPreviewState = useMemo((): LinkPreviewState => {
    if (!url) {
      return { status: "idle" };
    }
    if (cached?.status === "ok") {
      return { status: "ok", preview: cached.preview };
    }
    if (cached?.status === "error") {
      return { status: "error", message: cached.message };
    }
    if (lastResolved.url === url && lastResolved.entry?.status === "ok") {
      return { status: "ok", preview: lastResolved.entry.preview };
    }
    if (lastResolved.url === url && lastResolved.entry?.status === "error") {
      return { status: "error", message: lastResolved.entry.message };
    }
    return { status: "loading" };
  }, [cached, lastResolved.entry, lastResolved.url, url]);

  useEffect(() => {
    if (!url) {
      return;
    }
    const existing: CachedEntry | undefined = CACHE.get(url);
    if (existing) {
      return;
    }
    if (lastResolved.url === url) {
      return;
    }
    let cancelled: boolean = false;
    void fetchLinkPreview(url)
      .then((preview: LinkPreview): void => {
        const entry: CachedEntry = { status: "ok", preview };
        CACHE.set(url, entry);
        if (cancelled) {
          return;
        }
        setLastResolved({ url, entry });
      })
      .catch((error: unknown): void => {
        const message: string = error instanceof Error ? error.message : "Unknown error";
        const entry: CachedEntry = { status: "error", message };
        CACHE.set(url, entry);
        if (cancelled) {
          return;
        }
        setLastResolved({ url, entry });
      });
    return () => {
      cancelled = true;
    };
  }, [lastResolved.url, url]);

  return { state: derivedState };
};

export { useLinkPreview };
