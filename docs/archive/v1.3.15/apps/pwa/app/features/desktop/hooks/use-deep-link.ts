"use client";

import { useEffect } from "react";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useIsDesktop } from "./use-tauri";
import { listenToNativeEvent } from "@/app/features/runtime/native-event-adapter";
import { getPublicGroupHref } from "@/app/features/navigation/public-routes";

/**
 * Hook to handle deep links in desktop app
 * Supports obscur:// protocol for invite links and navigation
 */
export function useDeepLink() {
  const isDesktop = useIsDesktop();
  const router = useRouter();
  const lastHandledRef = useRef<Readonly<{ url: string; atUnixMs: number }> | null>(null);

  useEffect(() => {
    if (!isDesktop) return;

    // Listen for deep link events from Tauri
    const handleDeepLink = (event: CustomEvent<{ url: string }>) => {
      const url = event.detail.url;
      const nowUnixMs = Date.now();
      const previous = lastHandledRef.current;
      if (previous && previous.url === url && (nowUnixMs - previous.atUnixMs) < 2_000) {
        return;
      }
      lastHandledRef.current = { url, atUnixMs: nowUnixMs };
      console.log("Deep link received:", url);

      try {
        const parsed = new URL(url);
        
        // Handle obscur:// protocol
        if (parsed.protocol === "obscur:") {
          const path = parsed.pathname;
          
          // Handle invite links: obscur://invite?code=...
          if (path === "//invite" || path === "/invite") {
            const code = parsed.searchParams.get("code");
            if (code) {
              router.push(`/invite?code=${encodeURIComponent(code)}`);
            } else {
              router.push("/invite");
            }
            return;
          }

          // Handle direct message links: obscur://dm?pubkey=...
          if (path === "//dm" || path === "/dm") {
            const pubkey = parsed.searchParams.get("pubkey");
            if (pubkey) {
              router.push(`/?dm=${encodeURIComponent(pubkey)}`);
            }
            return;
          }

          // Handle group links: obscur://group?id=...
          if (path === "//group" || path === "/group") {
            const id = parsed.searchParams.get("id");
            if (id) {
              router.push(getPublicGroupHref(id));
            }
            return;
          }

          // Ignore unknown obscur:// paths; avoid forcing navigation that can
          // race with user-initiated sidebar route changes.
        }
      } catch (error) {
        console.error("Failed to parse deep link:", error);
      }
    };

    // Register event listener
    const listener = (event: Event) => {
      handleDeepLink(event as CustomEvent<{ url: string }>);
    };

    window.addEventListener("deep-link", listener);

    // Also listen via Tauri event system
    let disposed = false;
    let detach: (() => void) | null = null;
    void listenToNativeEvent<{ url?: string }>("deep-link", (event) => {
      const url = event.payload?.url;
      if (url) {
        handleDeepLink(new CustomEvent("deep-link", { detail: { url } }));
      }
    }).then((unlisten) => {
      if (disposed) {
        unlisten();
        return;
      }
      detach = unlisten;
    });

    return () => {
      disposed = true;
      window.removeEventListener("deep-link", listener);
      detach?.();
    };

  }, [isDesktop, router]);
}
