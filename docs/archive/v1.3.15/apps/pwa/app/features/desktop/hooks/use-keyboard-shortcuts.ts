"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIsDesktop } from "./use-tauri";
import { getKeyboardShortcutManager, type KeyboardShortcut } from "../utils/keyboard-shortcuts";

/**
 * Hook to register desktop keyboard shortcuts
 */
export function useKeyboardShortcuts() {
  const isDesktop = useIsDesktop();
  const router = useRouter();

  useEffect(() => {
    if (!isDesktop) return;

    const manager = getKeyboardShortcutManager();

    // Navigation shortcuts
    const shortcuts: Array<[string, KeyboardShortcut]> = [
      [
        "nav-messages",
        {
          key: "1",
          ctrl: true,
          description: "Go to Messages",
          action: () => router.push("/"),
        },
      ],
      [
        "nav-invites",
        {
          key: "2",
          ctrl: true,
          description: "Go to Invites",
          action: () => router.push("/invites"),
        },
      ],
      [
        "nav-search",
        {
          key: "3",
          ctrl: true,
          description: "Go to Search",
          action: () => router.push("/search"),
        },
      ],
      [
        "nav-settings",
        {
          key: "4",
          ctrl: true,
          description: "Go to Settings",
          action: () => router.push("/settings"),
        },
      ],
      [
        "search-focus",
        {
          key: "k",
          ctrl: true,
          description: "Focus Search",
          action: () => {
            const searchInput = document.querySelector<HTMLInputElement>('input[type="search"]');
            searchInput?.focus();
          },
        },
      ],
      [
        "new-message",
        {
          key: "n",
          ctrl: true,
          description: "New Message",
          action: () => {
            const messageInput = document.querySelector<HTMLTextAreaElement>('textarea[placeholder*="message"]');
            messageInput?.focus();
          },
        },
      ],
    ];

    // Register all shortcuts
    shortcuts.forEach(([id, shortcut]) => {
      manager.register(id, shortcut);
    });

    // Cleanup
    return () => {
      shortcuts.forEach(([id]) => {
        manager.unregister(id);
      });
    };
  }, [isDesktop, router]);
}
