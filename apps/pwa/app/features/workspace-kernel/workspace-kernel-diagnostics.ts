import { logAppEvent } from "@/app/shared/log-app-event";

export type WorkspaceKernelDiagnosticEvent =
  | "workspace.membership.load"
  | "workspace.leave.rejected"
  | "workspace.thread.hydrate"
  | "workspace.path_conflict"
  | "workspace.legacy_path_blocked"
  | "workspace.backup.collect"
  | "workspace.backup.restore";

export const logWorkspaceKernelDiagnostic = (
  name: WorkspaceKernelDiagnosticEvent,
  context?: Record<string, unknown>,
): void => {
  logAppEvent({
    name,
    level: "info",
    scope: { feature: "workspace-kernel", action: "diagnostic" },
    context,
  });
};
