"use client";

import type React from "react";
import { useCallback, useEffect, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
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
import { SETTINGS_NAV_GROUPS, SETTINGS_VALID_TABS, findSettingsNavItem } from "@/app/settings/settings-nav";
import { dispatchSettingsSearchPrepare } from "@/app/features/settings/services/settings-search-navigate";
import {
  focusSearchTargetById,
  settingsTabPanelElementId,
} from "@/app/shared/search-target-highlight";
import { useMobileCompactLayout } from "@/app/features/runtime/use-mobile-compact-layout";

function DeferredSettingsTabPanel(props: Readonly<{ activeTab: SettingsTabId }>): React.JSX.Element {
  const [panelReady, setPanelReady] = useState(false);

  useEffect((): (() => void) => {
    let cancelled = false;
    setPanelReady(false);
    const frameId = window.requestAnimationFrame((): void => {
      if (!cancelled) {
        setPanelReady(true);
      }
    });
    return (): void => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
    };
  }, [props.activeTab]);

  if (!panelReady) {
    return (
      <div
        data-testid="settings-tab-panel-deferred"
        className="min-h-[12rem] animate-pulse rounded-2xl bg-zinc-100/60 dark:bg-zinc-900/40"
        aria-hidden="true"
      />
    );
  }

  return <SettingsTabPanel activeTab={props.activeTab} />;
}

export default function SettingsPage(): React.JSX.Element {
  const { t } = useTranslation();
  const identity = useIdentity();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const displayPublicKeyHex: string = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? "";
  const publicKeyHex: PublicKeyHex | null = (displayPublicKeyHex as PublicKeyHex | null) ?? null;
  const navBadges = useNavBadges({ publicKeyHex });
  const { relayRecovery } = useRelay();
  const relayTransportNeedsAttention = relayRecovery.readiness !== "healthy";
  const compact = useMobileCompactLayout();

  const [activeTab, setActiveTab] = useState<SettingsTabId>("profile");
  const [showMobileMenu, setShowMobileMenu] = useState(true);

  const syncSettingsTabQuery = useCallback((tab: SettingsTabId | null): void => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab) {
      params.set("tab", tab);
    } else {
      params.delete("tab");
    }
    const query = params.toString();
    router.replace(query.length > 0 ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const openMobileSettingsTab = useCallback((tab: SettingsTabId): void => {
    setActiveTab(tab);
    setShowMobileMenu(false);
    syncSettingsTabQuery(tab);
  }, [syncSettingsTabQuery]);

  const returnToMobileSettingsMenu = useCallback((): void => {
    setShowMobileMenu(true);
    syncSettingsTabQuery(null);
  }, [syncSettingsTabQuery]);

  const handleSettingsSearchNavigate = useCallback((params: SettingsSearchNavigateParams): void => {
    const tab = params.tab as SettingsTabId;
    setActiveTab(tab);
    setShowMobileMenu(false);
    syncSettingsTabQuery(tab);
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
  }, [syncSettingsTabQuery]);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (!requestedTab) {
      if (compact) {
        setShowMobileMenu(true);
      }
      return;
    }
    if (!SETTINGS_VALID_TABS.includes(requestedTab as SettingsTabId)) return;
    setActiveTab(requestedTab as SettingsTabId);
    setShowMobileMenu(false);
  }, [compact, searchParams]);

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
      containScroll={compact}
    >
      <div className={cn(
        "mx-auto w-full max-w-6xl p-0",
        compact ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "p-4",
        !compact && "md:p-4",
      )}>
        <div className={cn(
          "flex flex-col gap-8",
          compact ? "min-h-0 flex-1 overflow-hidden" : "md:flex-row",
        )}>
          <aside className={cn(
            "w-64 shrink-0 sticky top-20 self-start h-fit",
            compact ? "hidden" : "block",
          )}>
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
                          data-settings-tab={item.id}
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

          <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", compact ? "flex" : "hidden")}>
            <AnimatePresence mode="wait">
              {showMobileMenu ? (
                <motion.div
                  key="menu"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={cn(
                    "mobile-scroll-region flex min-h-0 flex-1 flex-col overflow-y-auto",
                    compact ? "space-y-5 p-3" : "space-y-8 p-4",
                  )}
                  data-testid="settings-mobile-menu-scroll"
                >
                  <SettingsSearchField onNavigate={handleSettingsSearchNavigate} />
                  {SETTINGS_NAV_GROUPS.map((group) => (
                    <div key={group.id} className={compact ? "space-y-2" : "space-y-3"}>
                      <h3 className={cn(
                        "px-1 font-black uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400",
                        compact ? "text-[10px]" : "text-[11px]",
                      )}>
                        {t(group.labelKey)}
                      </h3>
                      <div className={cn(
                        "overflow-hidden border border-black/5 bg-white/60 backdrop-blur-xl shadow-lg shadow-black/5 dark:border-white/10 dark:bg-zinc-900/60",
                        compact ? "rounded-2xl" : "rounded-3xl",
                      )}>
                        {group.items.map((item, idx) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                openMobileSettingsTab(item.id as SettingsTabId);
                              }}
                              className={cn(
                                "flex w-full items-center justify-between transition-all hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98]",
                                compact ? "px-3 py-3" : "px-4 py-4.5",
                                idx < group.items.length - 1 && "border-b border-black/5 dark:border-white/5",
                              )}
                            >
                              <div className={cn("flex items-center", compact ? "gap-3" : "gap-4")}>
                                <div className={cn(
                                  "flex items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-400",
                                  compact ? "h-9 w-9 rounded-xl" : "h-10 w-10",
                                )}>
                                  <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
                                </div>
                                <div className="flex flex-col items-start gap-0.5">
                                  <span className="text-sm font-black tracking-tight text-zinc-900 dark:text-zinc-100">{t(item.labelKey)}</span>
                                  {!compact ? (
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">{group.id}</span>
                                  ) : null}
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
                  className="flex min-h-0 flex-1 flex-col overflow-hidden"
                >
                  <div className={cn(
                    "sticky top-0 z-10 flex shrink-0 items-center gap-2 border-b border-black/5 bg-white/80 backdrop-blur-md dark:border-white/80 dark:bg-black/80",
                    compact ? "p-3" : "p-4",
                  )}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={returnToMobileSettingsMenu}
                      className="h-8 w-8 p-0 hover:bg-black/5 dark:hover:bg-white/5"
                      aria-label={t("common.back", "Back")}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <h2 className="text-sm font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
                      {t(findSettingsNavItem(activeTab)?.item.labelKey ?? "")}
                    </h2>
                  </div>
                  <div
                    data-testid="settings-mobile-panel-scroll"
                    className={cn(
                      "mobile-scroll-region min-h-0 flex-1 overflow-y-auto",
                      compact ? "p-2" : "p-3 sm:p-4",
                    )}
                  >
                    <DeferredSettingsTabPanel activeTab={activeTab} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <main className={cn("min-w-0 flex-1", compact ? "hidden" : "block")}>
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <DeferredSettingsTabPanel activeTab={activeTab} />
            </div>
          </main>
        </div>
      </div>
    </PageShell>
  );
}
