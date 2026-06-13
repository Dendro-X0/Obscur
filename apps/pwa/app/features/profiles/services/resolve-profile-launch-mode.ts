import type { ProfileLaunchMode } from "./profile-isolation-contracts";
import { isSecondaryProfileWindowLabel } from "./desktop-profile-window-label";

/** Secondary profile windows should land on sign-in, not the startup picker grid. */
export const resolveProfileLaunchMode = (
  windowLabel: string,
  launchMode?: ProfileLaunchMode,
): ProfileLaunchMode => {
  if (launchMode === "new_window") {
    return "new_window";
  }
  if (isSecondaryProfileWindowLabel(windowLabel)) {
    return "new_window";
  }
  return launchMode ?? "existing";
};
