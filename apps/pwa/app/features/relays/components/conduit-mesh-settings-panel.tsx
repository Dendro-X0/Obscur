"use client";

import { Network } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/app/lib/utils";
import {
  buildConduitMeshSettingsSnapshot,
  conduitMeshDialectI18nKey,
  conduitMeshPoolOwnerI18nKey,
} from "@/app/features/transport-kernel/conduit-mesh-settings-snapshot";
import { useConduitMeshTorSettingsState } from "@/app/features/transport-kernel/use-conduit-mesh-tor-settings-state";

type ConduitMeshSettingsPanelProps = Readonly<{
  relays: ReadonlyArray<Readonly<{ url: string; enabled: boolean }>>;
}>;

export function ConduitMeshSettingsPanel({ relays }: ConduitMeshSettingsPanelProps) {
  const { t } = useTranslation();
  const snapshot = useMemo(() => buildConduitMeshSettingsSnapshot(relays), [relays]);
  const torState = useConduitMeshTorSettingsState();

  const poolOwnerLabel = t(conduitMeshPoolOwnerI18nKey(snapshot.poolOwner), {
    defaultValue: snapshot.poolOwner,
  });

  const enabledEndpoints = snapshot.endpoints.filter((entry) => entry.enabled);

  return (
    <div
      id="conduit-mesh-settings"
      className="space-y-4 rounded-2xl border border-black/5 p-5 dark:border-white/5 bg-white dark:bg-black/20"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-violet-500/10 p-2 text-violet-600 dark:text-violet-300">
          <Network className="h-4 w-4" />
        </div>
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {t("settings.conduits.title", { defaultValue: "Conduit transport" })}
          </h3>
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            {t("settings.conduits.desc", {
              defaultValue: "Obscur encrypts messages on your device. Conduits are the infrastructure you configure to carry ciphertext — Nostr relays, team servers, or custom gateways.",
            })}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
            snapshot.poolOwner === "conduit_mesh"
              ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-200"
              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
          )}
        >
          {t("settings.conduits.poolLabel", { defaultValue: "Pool" })}: {poolOwnerLabel}
        </span>
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
          {t("settings.conduits.e2eeBadge", { defaultValue: "E2EE on device" })}
        </span>
        {snapshot.meshOptOut ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
            {t("settings.conduits.meshOptOutBadge", { defaultValue: "Mesh opt-out active" })}
          </span>
        ) : null}
        {torState.configured ? (
          <span
            className={cn(
              "rounded-full px-2.5 py-1",
              torState.ready
                ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-200"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200",
            )}
          >
            {torState.ready
              ? t("settings.conduits.torReadyBadge", { defaultValue: "Tor ready" })
              : t("settings.conduits.torNotReadyBadge", { defaultValue: "Tor not ready" })}
          </span>
        ) : null}
      </div>

      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        {t("settings.conduits.metadataHonesty", {
          defaultValue: "Operators can see routing metadata (URLs, timing, sizes). They cannot read message plaintext without your keys.",
        })}
      </p>

        {snapshot.meshOptOut ? (
          <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">
            {t("settings.conduits.meshOptOutHint", {
              defaultValue: "Desktop is using the legacy enhanced pool hook. Remove NEXT_PUBLIC_OBSCUR_CONDUIT_MESH_POOL=0 and restart to restore Conduit Mesh.",
            })}
          </p>
        ) : null}

      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        {t("settings.conduits.teamGatewayHint", {
          defaultValue: "Run a private team gateway at http://127.0.0.1:8788 (relay-gateway mesh HTTP) or any server implementing /mesh/v1/* — add its URL as an enabled relay.",
        })}
      </p>

      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        {t("settings.conduits.torPolicyHint", {
          defaultValue: "Tor-required conduits fail closed when Tor is not ready. Enable Tor in Security settings.",
        })}
      </p>

      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
          {t("settings.conduits.endpointsTitle", {
            defaultValue: "Configured conduits ({{count}} enabled)",
            count: snapshot.enabledEndpointCount,
          })}
        </p>
        {enabledEndpoints.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {t("settings.conduits.endpointsEmpty", {
              defaultValue: "Enable at least one relay URL below to activate DM transport.",
            })}
          </p>
        ) : (
          <ul className="space-y-2">
            {enabledEndpoints.map((entry) => (
              <li
                key={entry.url}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/5 bg-zinc-50 px-3 py-2 dark:border-white/10 dark:bg-zinc-900/50"
              >
                <span className="min-w-0 truncate font-mono text-[11px] text-zinc-700 dark:text-zinc-200">
                  {entry.url}
                </span>
                <span className="shrink-0 rounded-md bg-black/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500 dark:bg-white/10 dark:text-zinc-300">
                  {t(conduitMeshDialectI18nKey(entry.dialect), { defaultValue: entry.dialect })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
