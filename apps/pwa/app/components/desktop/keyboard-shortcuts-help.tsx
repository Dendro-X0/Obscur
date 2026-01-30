"use client";

import { useEffect, useState } from "react";
import { Keyboard, X } from "lucide-react";
import { useIsDesktop } from "@/app/features/desktop/hooks/use-tauri";
import { getKeyboardShortcutManager, formatShortcut, type KeyboardShortcut } from "@/app/features/desktop/utils/keyboard-shortcuts";
import { useTranslation } from "react-i18next";

export function KeyboardShortcutsHelp() {
  const { t } = useTranslation();
  const isDesktop = useIsDesktop();
  const [isOpen, setIsOpen] = useState(false);
  const manager = isDesktop ? getKeyboardShortcutManager() : null;
  const shortcuts: KeyboardShortcut[] = manager ? manager.getShortcuts() : [];

  useEffect(() => {
    if (!isDesktop) return;

    const manager = getKeyboardShortcutManager();

    // Register help shortcut
    manager.register("show-shortcuts", {
      key: "?",
      shift: true,
      description: t("shortcuts.show"),
      action: () => setIsOpen(true),
    });

    return () => {
      manager.unregister("show-shortcuts");
    };
  }, [isDesktop, t]);

  if (!isDesktop) return null;

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-200 dark:hover:bg-zinc-900/40"
        aria-label={t("shortcuts.show")}
        title={`${t("shortcuts.show")} (Shift+?)`}
      >
        <Keyboard className="h-4 w-4" />
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-black/10 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("shortcuts.title")}</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-200 dark:hover:bg-zinc-900/40"
                aria-label={t("shortcuts.close")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              {shortcuts.map((shortcut, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-black/10 bg-zinc-50 px-3 py-2 dark:border-white/10 dark:bg-zinc-950/60"
                >
                  <span className="text-sm text-zinc-700 dark:text-zinc-200">
                    {shortcut.description}
                  </span>
                  <kbd className="rounded border border-black/10 bg-white px-2 py-1 text-xs font-mono text-zinc-700 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-200">
                    {formatShortcut(shortcut)}
                  </kbd>
                </div>
              ))}
            </div>

            <div className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
              {t("shortcuts.toggleHelp")}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
