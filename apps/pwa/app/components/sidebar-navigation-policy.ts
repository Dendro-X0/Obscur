import { isDesktopShellBuild } from "@/app/features/runtime/shell-contract";
import { isExperimentOnlineEnabled } from "@/app/features/runtime/experiment-shell-policy";

/** Dev webpack: pre-compile all sidebar route chunks right after unlock (not after 2s quiescence). */
export const shouldPrewarmDevWebpackNavigationOnBoot = (): boolean => (
  isDesktopShellBuild()
  && process.env.NODE_ENV === "development"
  && isExperimentOnlineEnabled()
);
