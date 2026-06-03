"use client";

import type React from "react";
import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/app/lib/utils";
import { Label } from "@dweb/ui-kit";
import { useMobileCompactLayout } from "@/app/features/runtime/use-mobile-compact-layout";
import type { TextScale } from "@/app/features/settings/hooks/use-accessibility-preferences";
import type { ProfilePublishPhase } from "@/app/features/profile/hooks/use-profile-publisher";
import { SettingsActionStatus, type SettingsActionPhase } from "@/app/features/settings/components/settings-action-status";
import { nip19 } from "nostr-tools";
import { getLocalMediaIndexSnapshot } from "@/app/features/vault/services/local-media-store";
import {
  INVITE_CODE_PREFIX,
  INVITE_CODE_SUFFIX_LENGTH,
  buildInviteCodeFromSuffix,
  extractInviteCodeSuffix,
  generateRandomInviteCode,
  isCanonicalInviteCode,
  normalizeInviteCodeSuffixInput,
} from "@/app/features/invites/utils/invite-code-format";
import { isSupportedPublicUrl, normalizePublicUrl } from "@/app/shared/public-url";


export const APP_VERSION: string = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
export const ENABLE_API_HEALTH_PROBE =
  process.env.NEXT_PUBLIC_ENABLE_API_HEALTH_PROBE === "1"
  || process.env.NEXT_PUBLIC_ENABLE_API_HEALTH_PROBE === "true";

export type ApiHealthState = Readonly<
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok"; latencyMs: number; timeIso: string; baseUrl: string }
  | { status: "disabled"; message: string; baseUrl: string }
  | { status: "error"; message: string; baseUrl: string }
>;

export type InviteCodeAvailabilityStatus =
  | "idle"
  | "checking"
  | "available"
  | "claimed_by_other"
  | "unverified";

export const toSettingsActionPhase = (phase: ProfilePublishPhase): SettingsActionPhase => {
  if (phase === "waiting_relays") return "waiting";
  if (phase === "preparing") return "preparing";
  if (phase === "mining" || phase === "signing") return "working";
  if (phase === "publishing") return "publishing";
  if (phase === "success") return "success";
  if (phase === "error") return "error";
  return "idle";
};

type ProfileValidationResult = Readonly<{
  usernameError?: string;
  aboutError?: string;
  nip05Error?: string;
  avatarUrlError?: string;
  inviteCodeError?: string;
  isValid: boolean;
}>;

export const NIP05_IDENTIFIER_PATTERN = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const DEFAULT_APP_LANGUAGE = "en";
export const DEFAULT_THEME_PREFERENCE = "system" as const;
export const TEXT_SCALE_OPTIONS: ReadonlyArray<TextScale> = [90, 100, 110, 120];
export const PRIVATE_KEY_REVEAL_WINDOW_MS = 20_000;
export const PROFILE_PUBLISH_UI_TIMEOUT_MS = 20_000;
export const DELETE_ACCOUNT_CONFIRM_TEXT = "WIPE ACCOUNT";
const ACCOUNT_DELETE_UNKNOWN_RELAY_SENTINELS = new Set(["unknown", "null", "undefined", "n/a", "none"]);

const normalizeScopedRelayUrlForDelete = (relayUrl: string): string => relayUrl.trim().toLowerCase();

export const toScopedRelayUrlForDelete = (relayUrl: string): string | null => {
  const normalized = normalizeScopedRelayUrlForDelete(relayUrl);
  if (normalized.length === 0 || ACCOUNT_DELETE_UNKNOWN_RELAY_SENTINELS.has(normalized)) {
    return null;
  }
  return /^wss?:\/\/.+/.test(normalized) ? normalized : null;
};

export type IdentityStorageMode = "native" | "encrypted_local" | "session_only" | "unknown";
export type IdentityIntegrityState = "ok" | "mismatch" | "unknown";
export type SecurityPosture = "strong" | "moderate" | "weak";
export type CapabilityState = "supported" | "unavailable" | "error";
export type RelayPresetId = "default_stable" | "high_redundancy" | "low_latency";
type RelayFailureHint = "timeout" | "network" | "tls" | "rate_limited" | "unknown";
export type StorageMode = "nip96" | "local_vault" | "hybrid" | "disabled";
export type StorageStats = Readonly<{ itemCount: number; totalBytes: number; lastSavedAtUnixMs?: number }>;

type RelayPreset = Readonly<{
  id: RelayPresetId;
  label: string;
  relays: ReadonlyArray<string>;
}>;

export const DEFAULT_STABLE_PRESET: RelayPreset = {
  id: "default_stable",
  label: "Default Stable",
  relays: ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"],
};

const HIGH_REDUNDANCY_PRESET: RelayPreset = {
  id: "high_redundancy",
  label: "High Redundancy",
  relays: [
    "wss://relay.damus.io",
    "wss://nos.lol",
    "wss://relay.primal.net",
    "wss://relay.snort.social",
    "wss://relay.nostr.band",
  ],
};

const LOW_LATENCY_PRESET: RelayPreset = {
  id: "low_latency",
  label: "Low Latency",
  relays: ["wss://relay.primal.net", "wss://relay.damus.io", "wss://nos.lol"],
};

export const RELAY_PRESETS: ReadonlyArray<RelayPreset> = [DEFAULT_STABLE_PRESET, HIGH_REDUNDANCY_PRESET, LOW_LATENCY_PRESET];

export const classifyRelayFailureHint = (message?: string): RelayFailureHint => {
  if (!message) return "unknown";
  const normalized = message.toLowerCase();
  if (normalized.includes("timeout") || normalized.includes("timed out")) return "timeout";
  if (normalized.includes("tls") || normalized.includes("ssl") || normalized.includes("handshake") || normalized.includes("certificate")) return "tls";
  if (normalized.includes("429") || normalized.includes("rate") || normalized.includes("throttle")) return "rate_limited";
  if (
    normalized.includes("network")
    || normalized.includes("dns")
    || normalized.includes("offline")
    || normalized.includes("refused")
    || normalized.includes("failed")
  ) {
    return "network";
  }
  return "unknown";
};

export const deriveStorageMode = (nip96Enabled: boolean, localVaultEnabled: boolean): StorageMode => {
  if (nip96Enabled && localVaultEnabled) return "hybrid";
  if (nip96Enabled) return "nip96";
  if (localVaultEnabled) return "local_vault";
  return "disabled";
};

export const deriveStorageStats = (): StorageStats => {
  const snapshot = getLocalMediaIndexSnapshot();
  const entries = Object.values(snapshot);
  const totalBytes = entries.reduce((sum, entry) => sum + (Number.isFinite(entry.size) ? entry.size : 0), 0);
  const lastSavedAtUnixMs = entries.reduce<number | undefined>((latest, entry) => {
    if (!Number.isFinite(entry.savedAtUnixMs)) return latest;
    if (typeof latest !== "number") return entry.savedAtUnixMs;
    return Math.max(latest, entry.savedAtUnixMs);
  }, undefined);
  return {
    itemCount: entries.length,
    totalBytes,
    lastSavedAtUnixMs,
  };
};

export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** idx;
  return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
};

export const formatRatioPercent = (ratio: number): string => {
  if (!Number.isFinite(ratio)) {
    return "n/a";
  }
  return `${(ratio * 100).toFixed(1)}%`;
};

export const withActionTimeout = async <T,>(operation: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export const validateProfileInput = (profile: Readonly<{ username: string; about?: string; nip05?: string; avatarUrl?: string; inviteCode?: string }>): ProfileValidationResult => {
  const username = profile.username.trim();
  const about = (profile.about ?? "").trim();
  const nip05 = (profile.nip05 ?? "").trim();
  const avatarUrl = (profile.avatarUrl ?? "").trim();
  const inviteCode = (profile.inviteCode ?? "").trim();

  let usernameError: string | undefined;
  let aboutError: string | undefined;
  let nip05Error: string | undefined;
  let avatarUrlError: string | undefined;
  let inviteCodeError: string | undefined;

  if (username.length < 3) {
    usernameError = "Username must be at least 3 characters.";
  } else if (username.length > 48) {
    usernameError = "Username is too long (max 48 characters).";
  }
  if (about.length > 280) {
    aboutError = "Description is too long (max 280 characters).";
  }

  if (nip05.length > 0 && !NIP05_IDENTIFIER_PATTERN.test(nip05)) {
    nip05Error = "NIP-05 must use name@domain.tld format.";
  }

  if (avatarUrl.length > 0) {
    const normalizedAvatarUrl = normalizePublicUrl(avatarUrl);
    if (!isSupportedPublicUrl(normalizedAvatarUrl)) {
      avatarUrlError = "Avatar URL must start with /, http://, or https://.";
    }
  }

  if (inviteCode.length > 0 && !isCanonicalInviteCode(inviteCode)) {
    inviteCodeError = `Code must use ${INVITE_CODE_PREFIX}-XXXXXX (6 letters/numbers).`;
  }

  return {
    usernameError,
    aboutError,
    nip05Error,
    avatarUrlError,
    inviteCodeError,
    isValid: !usernameError && !aboutError && !nip05Error && !avatarUrlError && !inviteCodeError,
  };
};

export function SettingsToggle({ checked, onChange, id }: { checked: boolean; onChange: (checked: boolean) => void; id?: string }) {
  const compact = useMobileCompactLayout();

  if (compact) {
    return (
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-[border-color,box-shadow] duration-300",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
          "active:scale-95",
          checked
            ? "border-violet-400/40 shadow-[0_0_0_1px_rgba(139,92,246,0.25)]"
            : "border-zinc-600/45 bg-transparent",
        )}
      >
        <motion.span
          aria-hidden="true"
          className={cn(
            "absolute left-1/2 top-1/2 h-8 w-8 origin-center -translate-x-1/2 -translate-y-1/2 rounded-full transition-[background-color,box-shadow] duration-200",
            checked
              ? "bg-violet-500 shadow-[0_4px_16px_-6px_rgba(139,92,246,0.75)]"
              : "bg-zinc-400/90 shadow-[0_1px_2px_rgba(0,0,0,0.35)]",
          )}
          initial={false}
          animate={{ scale: checked ? 1 : 0.5 }}
          transition={{ duration: 0.22, ease: [0.34, 1.12, 0.64, 1] }}
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "group relative inline-flex shrink-0 cursor-pointer items-center border transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950 active:scale-[0.97]",
        "h-[clamp(1.7rem,4.2vw,1.95rem)] w-[clamp(3.15rem,9vw,3.7rem)] justify-start rounded-full p-[3px]",
        checked
          ? "border-violet-400/55 bg-[linear-gradient(135deg,rgba(168,85,247,0.95),rgba(99,102,241,0.88))] text-violet-100 shadow-[0_10px_24px_-18px_rgba(139,92,246,0.9)]"
          : "border-white/10 bg-[linear-gradient(135deg,rgba(51,51,58,0.96),rgba(35,35,42,0.94))] text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-[3px] rounded-full transition-all duration-300",
          checked
            ? "bg-[radial-gradient(circle_at_35%_50%,rgba(255,255,255,0.18),transparent_58%)] opacity-100"
            : "bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.05),transparent_65%)] opacity-75"
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full transition-all duration-300",
          checked
            ? "scale-0 opacity-0"
            : "bg-zinc-400/70 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute right-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full transition-all duration-300",
          checked
            ? "bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.45)]"
            : "scale-0 opacity-0"
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none relative z-[1] inline-flex h-[calc(clamp(1.6rem,4vw,1.85rem)-6px)] w-[calc(clamp(1.6rem,4vw,1.85rem)-6px)] transform items-center justify-center rounded-full border shadow-lg ring-0 transition-all duration-300 ease-out",
          checked
            ? "translate-x-[calc(clamp(3.15rem,9vw,3.7rem)-clamp(1.6rem,4vw,1.85rem))] border-white/25 bg-white text-violet-600 shadow-[0_10px_22px_-14px_rgba(255,255,255,0.9)]"
            : "translate-x-0 border-white/8 bg-zinc-100 text-zinc-500 shadow-[0_8px_18px_-14px_rgba(0,0,0,0.75)]"
        )}
      >
        {checked ? <Check className="h-3 w-3" /> : <div className="h-2 w-2 rounded-full bg-zinc-500/70" />}
      </span>
    </button>
  );
}

export function SettingsToggleCard(props: Readonly<{
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  highlighted?: boolean;
}>) {
  const compact = useMobileCompactLayout();
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-3 rounded-2xl border",
        compact ? "p-3" : "p-4 sm:p-5",
        props.highlighted
          ? "border-blue-500/20 bg-blue-500/5 dark:border-blue-400/20"
          : "border-black/5 bg-zinc-50/50 dark:border-white/5 dark:bg-zinc-900/50"
      )}
    >
      <div className="min-w-0 space-y-1">
        <Label className={cn("block font-semibold leading-snug", compact ? "text-sm" : "text-sm sm:text-base")}>{props.title}</Label>
        {!compact ? (
          <p className="text-xs leading-relaxed text-zinc-500">{props.description}</p>
        ) : null}
      </div>
      <div className="flex h-full items-start justify-end pt-0.5">
        <SettingsToggle checked={props.checked} onChange={props.onChange} />
      </div>
    </div>
  );
}


