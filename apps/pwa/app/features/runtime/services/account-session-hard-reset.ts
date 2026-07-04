import { messagingChatStateDurabilityPort } from "@/app/features/messaging/services/messaging-chat-state-durability-port";
import { useProfileInternals } from "@/app/features/profile/hooks/use-profile";
import { logAppEvent } from "@/app/shared/log-app-event";

export type AccountSessionHardResetReason =
  | "account_scope_boundary"
  | "logout"
  | "profile_removed"
  | "manual";

let hardResetScheduled = false;

/**
 * Purges in-memory session owners and reloads the shell so a new account cannot
 * inherit the previous account's React provider state.
 */
export const performAccountSessionHardReset = (params: Readonly<{
  reason: AccountSessionHardResetReason;
  profileId?: string | null;
  previousPublicKeySuffix?: string | null;
  nextPublicKeySuffix?: string | null;
}>): void => {
  if (typeof window === "undefined" || hardResetScheduled) {
    return;
  }
  hardResetScheduled = true;

  logAppEvent({
    name: "runtime.account_session_hard_reset",
    level: "warn",
    scope: { feature: "runtime", action: "account_session" },
    context: {
      reason: params.reason,
      profileId: params.profileId ?? null,
      previousPublicKeySuffix: params.previousPublicKeySuffix ?? null,
      nextPublicKeySuffix: params.nextPublicKeySuffix ?? null,
    },
  });

  try {
    messagingChatStateDurabilityPort.flushAllPending();
    messagingChatStateDurabilityPort.purgeAllMemory();
    useProfileInternals.resetForTests();
  } catch {
    // Continue to reload even if purge fails.
  }

  window.location.reload();
};

export const accountSessionHardResetInternals = {
  resetForTests: (): void => {
    hardResetScheduled = false;
  },
};
