import {
  getIdentityDiagnosticsSnapshot,
  getIdentitySnapshot,
  subscribeIdentityStore,
} from "@/app/features/auth/hooks/use-identity";
import { desktopProfileRuntime } from "@/app/features/profiles/services/desktop-profile-runtime";
import { windowRuntimeSupervisor } from "@/app/features/runtime/services/window-runtime-supervisor";

let reconcileScheduled = false;

/** Single canonical reconcile path — identity + desktop profile → supervisor bind. */
export function reconcileWindowRuntimeBinding(): void {
  const identity = getIdentitySnapshot();
  if (identity.status === "unlocked" && identity.publicKeyHex) {
    windowRuntimeSupervisor.promoteUnlockedSession();
  }
  const diagnostics = getIdentityDiagnosticsSnapshot();
  if (diagnostics?.startupState) {
    windowRuntimeSupervisor.syncIdentity({
      startupState: diagnostics.startupState,
    });
  }
  windowRuntimeSupervisor.bindProfile(desktopProfileRuntime.getSnapshot());
}

function scheduleReconcileWindowRuntimeBinding(): void {
  if (reconcileScheduled) {
    return;
  }
  reconcileScheduled = true;
  queueMicrotask(() => {
    reconcileScheduled = false;
    reconcileWindowRuntimeBinding();
  });
}

/**
 * Mount once at app root. Subscribes to identity + desktop profile stores and
 * forwards changes to the window runtime supervisor — never per-consumer hooks.
 */
export function startWindowRuntimeBinding(): () => void {
  const unsubscribeIdentity = subscribeIdentityStore(
    scheduleReconcileWindowRuntimeBinding,
  );
  const unsubscribeDesktop = desktopProfileRuntime.subscribe(
    scheduleReconcileWindowRuntimeBinding,
  );
  scheduleReconcileWindowRuntimeBinding();
  return () => {
    unsubscribeIdentity();
    unsubscribeDesktop();
  };
}
