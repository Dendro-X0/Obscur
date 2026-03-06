"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIsDesktop } from "./use-tauri";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";

/**
 * Hook to handle deep links in desktop app
 * Supports obscur:// protocol for invite links and navigation
 */
export function useDeepLink() {
  const isDesktop = useIsDesktop();
  const router = useRouter();

  useEffect(() => {
    if (!isDesktop) return;

    // Listen for deep link events from Tauri
    const handleDeepLink = (event: CustomEvent<{ url: string }>) => {
      const url = event.detail.url;
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
              router.push(`/groups/${encodeURIComponent(id)}`);
            }
            return;
          }

          // Default: navigate to home
          router.push("/");
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
    if (hasNativeRuntime()) {
      let disposed = false;
      let detach: (() => void) | null = null;
      void import("@tauri-apps/api/event")
        .then(({ listen }) => listen("deep-link", (event: { payload?: { url?: string } }) => {
          const url = event.payload?.url;
          if (url) {
            handleDeepLink(new CustomEvent("deep-link", { detail: { url } }));
          }
        }))
        .then((unlisten) => {
          if (disposed) {
            unlisten();
            return;
          }
          detach = unlisten;
        })
        .catch(() => {
          // Ignore in runtimes without native event bridge support.
        });

      return () => {
        disposed = true;
        window.removeEventListener("deep-link", listener);
        detach?.();
      };
    }

    return () => {
      window.removeEventListener("deep-link", listener);
    };
  }, [isDesktop, router]);
}
