import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { profileSlotHasLocalAccountData } from "./profile-slot-login-guard";

export type GreenfieldAuthIntent = "create" | "restore";

/** Desktop profile windows need an empty slot before create or restore onboarding. */
export const requiresFreshProfileWindowForGreenfieldAuth = (profileId: string): boolean => {
  if (!hasNativeRuntime()) {
    return false;
  }
  return profileSlotHasLocalAccountData(profileId);
};

export const greenfieldAuthWindowLabel = (intent: GreenfieldAuthIntent): string => (
  intent === "create" ? "New identity" : "Restore backup"
);
