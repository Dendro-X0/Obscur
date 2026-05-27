"use client";

import type React from "react";
import { useCallback, useEffect, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "next/navigation";
import { PageShell } from "@/app/components/page-shell";
import { cn } from "@/app/lib/utils";
import { Button } from "@dweb/ui-kit";
import useNavBadges from "@/app/features/main-shell/hooks/use-nav-badges";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import {
  SettingsSearchField,
  type SettingsSearchNavigateParams,
} from "@/app/features/settings/components/settings-search-field";
import { SettingsTabPanel } from "@/app/settings/components/settings-tab-panel-loader";
import type { SettingsTabId } from "@/app/features/settings/services/settings-search-index";
import { SETTINGS_NAV_GROUPS, SETTINGS_VALID_TABS } from "@/app/settings/settings-nav";
import { dispatchSettingsSearchPrepare } from "@/app/features/settings/services/settings-search-navigate";
import {
  focusSearchTargetById,
  settingsTabPanelElementId,
} from "@/app/shared/search-target-highlight";

export default function SettingsPage(): React.JSX.Element {
  const { t } = useTranslation();
  const identity = useIdentity();
  const searchParams = useSearchParams();
  const displayPublicKeyHex: string = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? "";
  const publicKeyHex: PublicKeyHex | null = (displayPublicKeyHex as PublicKeyHex | null) ?? null;
  const navBadges = useNavBadges({ publicKeyHex });
  const { relayRecovery } = useRelay();
  const relayTransportNeedsAttention = relayRecovery.readiness !== "healthy";

  const [activeTab, setActiveTab] = useState<SettingsTabId>("profile");
  const [showMobileMenu, setShowMobileMenu] = useState(true);

  const handleSettingsSearchNavigate = useCallback((params: SettingsSearchNavigateParams): void => {
    setActiveTab(params.tab as SettingsTabId);
    setShowMobileMenu(false);
    dispatchSettingsSearchPrepare({
      entryId: params.entryId,
      tab: params.tab,
      elementId: params.elementId,
    });
    const targetId = params.elementId?.trim() || settingsTabPanelElementId(params.tab);
    focusSearchTargetById(targetId, {
      scrollDelayMs: 220,
      block: "center",
      maxResolveAttempts: 30,
      resolveRetryMs: 100,
    });
  }, []);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (!requestedTab) return;
    if (!SETTINGS_VALID_TABS.includes(requestedTab as SettingsTabId)) return;
    setActiveTab(requestedTab as SettingsTabId);
    setShowMobileMenu(false);
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const hash = window.location.hash.replace(/^#/, "").trim();
    if (hash.length > 0) {
      focusSearchTargetById(hash, {
        scrollDelayMs: 220,
        block: "center",
        maxResolveAttempts: 30,
        resolveRetryMs: 100,
      });
    }
  }, [activeTab]);

  return (
    <PageShell
      title={t("settings.title")}
      navBadgeCounts={navBadges.navBadgeCounts}
      hideHeader={!showMobileMenu}
    >
      <div className="mx-auto w-full max-w-6xl p-0 md:p-4">
        <div className="flex flex-col gap-8 md:flex-row">
          <aside className="hidden w-64 shrink-0 md:block sticky top-20 self-start h-fit">
            <SettingsSearchField
              className="mb-5"
              onNavigate={handleSettingsSearchNavigate}
            />
            <nav className="flex flex-col gap-6">
              {SETTINGS_NAV_GROUPS.map((group) => (
                <div key={group.id} className="space-y-1">
                  <h3 className="px-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-500">
                    {t(group.labelKey)}
                  </h3>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveTab(item.id as SettingsTabId)}
                          className={cn(
                            "group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-all text-left outline-none",
                            active
                              ? "bg-gradient-primary border-none text-white shadow-md shadow-purple-500/25 font-bold scale-[1.02] active:scale-[0.98] ring-1 ring-white/10 dark:bg-zinc-800 dark:text-zinc-100"
                              : "border-transparent text-zinc-600 hover:bg-black/5 hover:border-black/5 font-semibold dark:text-zinc-400 dark:hover:bg-zinc-900/40 dark:hover:border-white/5",
                          )}
                        >
                          <div
                            className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                              active
                                ? "bg-white/20 shadow-sm dark:bg-black/20"
                                : "bg-zinc-100/50 dark:bg-zinc-800/30 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-800",
                            )}
                          >
                            <Icon className={cn("h-4 w-4", active ? "text-white dark:text-purple-400" : "text-zinc-400")} />
                          </div>
                          <span className="flex min-w-0 flex-1 items-center gap-2">
                            <span className="truncate">{t(item.labelKey)}</span>
                            {item.id === "relays" && relayTransportNeedsAttention ? (
                              <span
                                className="h-2 w-2 shrink-0 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]"
                                aria-label={t("settings.relays.statusDegraded", "Degraded")}
                              />
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          <div className="flex flex-col w-full md:hidden min-h-[calc(100vh-120px)]">
            <AnimatePresence mode="wait">
              {showMobileMenu ? (
                <motion.div
                  key="menu"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex flex-col p-4 space-y-8"
                >
                  <SettingsSearchField onNavigate={handleSettingsSearchNavigate} />
                  {SETTINGS_NAV_GROUPS.map((group) => (
                    <div key={group.id} className="space-y-3">
                      <h3 className="px-1 text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
                        {t(group.labelKey)}
                      </h3>
                      <div className="overflow-hidden rounded-3xl border border-black/5 bg-white/60 backdrop-blur-xl shadow-lg shadow-black/5 dark:border-white/10 dark:bg-zinc-900/60">
                        {group.items.map((item, idx) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setActiveTab(item.id as SettingsTabId);
                                setShowMobileMenu(false);
                              }}
                              className={cn(
                                "flex w-full items-center justify-between px-4 py-4.5 transition-all hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98]",
                                idx < group.items.length - 1 && "border-b border-black/5 dark:border-white/5",
                              )}
                            >
                              <div className="flex items-center gap-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shadow-sm">
                                  <Icon className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col items-start gap-0.5">
                                  <span className="text-sm font-black tracking-tight text-zinc-900 dark:text-zinc-100">{t(item.labelKey)}</span>
                                  <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-500 uppercase tracking-wider">{group.id}</span>
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-zinc-300" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="content"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex flex-col"
                >
                  <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-black/5 bg-white/80 p-4 backdrop-blur-md dark:border-white/80 dark:bg-black/80">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowMobileMenu(true)}
                      className="h-8 w-8 p-0 hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <h2 className="text-sm font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
                      {t(
                        SETTINGS_NAV_GROUPS.flatMap((group) => [...group.items])
                          .find((item) => item.id === activeTab)?.labelKey || "",
                      )}
                    </h2>
                  </div>
                  <div className="p-4 pb-32">
                    <SettingsTabPanel activeTab={activeTab} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <main className="hidden min-w-0 flex-1 md:block">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <SettingsTabPanel activeTab={activeTab} />
            </div>
          </main>
        </div>
      </div>
    </PageShell>
  );
}
