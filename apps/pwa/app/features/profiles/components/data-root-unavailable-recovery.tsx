"use client";
import type React from "react";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Button, ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label } from "@dweb/ui-kit";
import { HardDrive, FolderOpen, RefreshCw, Settings, Shield, FolderPlus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { buildObscurDataRootTargetPath, DEFAULT_OBSCUR_DATA_SUBFOLDER, getObscurDataRootConfig, pickObscurDataRootPath, planObscurDataRootChange, bindObscurDataRootForRecovery, resolveObscurDataRootPick, validateObscurDataSubfolderName, type ObscurDataRootChangePlan, type ObscurDataRootConfig, } from "@/app/features/profiles/services/obscur-data-root-service";
import { requestNativeAppRestart } from "@/app/features/runtime/native-adapters";
import { markDesktopShellBootReady } from "@/app/features/profiles/services/desktop-window-boot";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { useTranslation } from "react-i18next";
const formatPath = (path: string | null | undefined): string => (path ?? "").replace(/^\\\\\?\\/, "");
type GateState = Readonly<{
    kind: "loading";
}> | Readonly<{
    kind: "ready";
    config: ObscurDataRootConfig;
}> | Readonly<{
    kind: "unavailable";
    config: ObscurDataRootConfig;
}>;
type RecoveryDialog = "none" | "fresh" | "reconnect" | "subfolder";
function isStorageSettingsRoute(pathname: string | null, tab: string | null): boolean {
    return pathname === "/settings" && tab === "storage";
}
function DataRootGateLoadingFallback(): React.JSX.Element {
    return (<div className="flex min-h-0 flex-1 items-center justify-center bg-[#090a0e] px-6 text-center text-zinc-300">
      <div className="space-y-2">
        <RefreshCw className="mx-auto h-6 w-6 animate-spin text-violet-300"/>
        <p className="text-sm">Checking data folder…</p>
      </div>
    </div>);
}
export function DataRootUnavailableGate(props: Readonly<{
    children: React.ReactNode;
}>): React.JSX.Element {
    return (<Suspense fallback={<DataRootGateLoadingFallback />}>
      <DataRootUnavailableGateContent>{props.children}</DataRootUnavailableGateContent>
    </Suspense>);
}
function DataRootUnavailableGateContent(props: Readonly<{
    children: React.ReactNode;
}>): React.JSX.Element {
    const { t } = useTranslation();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const storageTab = searchParams.get("tab");
    const allowStorageSettings = isStorageSettingsRoute(pathname, storageTab);
    const [gate, setGate] = useState<GateState>({ kind: "loading" });
    const [isWorking, setIsWorking] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [activeDialog, setActiveDialog] = useState<RecoveryDialog>("none");
    const [pendingTargetPath, setPendingTargetPath] = useState("");
    const [pendingPlan, setPendingPlan] = useState<ObscurDataRootChangePlan | null>(null);
    const [pendingParentPath, setPendingParentPath] = useState("");
    const [pendingSubfolderName, setPendingSubfolderName] = useState(DEFAULT_OBSCUR_DATA_SUBFOLDER);
    const [pendingTargetPreview, setPendingTargetPreview] = useState("");
    const loadConfig = useCallback(async (): Promise<void> => {
        if (!hasNativeRuntime()) {
            setGate({ kind: "ready", config: await getObscurDataRootConfig() });
            return;
        }
        const config = await getObscurDataRootConfig();
        if (config.physicalPathAvailable === false) {
            setGate({ kind: "unavailable", config });
            return;
        }
        setGate({ kind: "ready", config });
    }, []);
    useEffect(() => {
        let cancelled = false;
        void loadConfig()
            .catch(() => {
            if (!cancelled) {
                setGate({ kind: "ready", config: { effectivePath: "", physicalPathAvailable: true } as ObscurDataRootConfig });
            }
        })
            .finally(() => {
            if (!cancelled) {
                markDesktopShellBootReady();
            }
        });
        return () => {
            cancelled = true;
        };
    }, [loadConfig]);
    const resetPendingChange = (): void => {
        setPendingTargetPath("");
        setPendingPlan(null);
        setPendingParentPath("");
        setPendingSubfolderName(DEFAULT_OBSCUR_DATA_SUBFOLDER);
        setPendingTargetPreview("");
        setActiveDialog("none");
    };
    const restartAfterDataRootChange = async (message: string): Promise<void> => {
        setStatusMessage(message);
        const restart = await requestNativeAppRestart();
        if (!restart.ok) {
            setStatusMessage(t("storage.dataRootRecovery.restartManual"));
        }
    };
    const continueRecoveryChange = async (targetPath: string): Promise<void> => {
        const plan = await planObscurDataRootChange(targetPath);
        if (plan.pathsEquivalent) {
            setStatusMessage(t("storage.dataRootRecovery.alreadyBound"));
            return;
        }
        setPendingTargetPath(targetPath);
        setPendingPlan(plan);
        if (plan.targetHasObscurData) {
            setActiveDialog("reconnect");
            return;
        }
        setActiveDialog("fresh");
    };
    const handleFolderPick = async (intent: "change" | "reconnect"): Promise<void> => {
        if (gate.kind !== "unavailable") {
            return;
        }
        setIsWorking(true);
        setStatusMessage(null);
        try {
            const selected = await pickObscurDataRootPath();
            if (!selected) {
                return;
            }
            const resolution = await resolveObscurDataRootPick(selected, intent);
            if (resolution.showSubfolderDialog) {
                setPendingParentPath(resolution.parentPath);
                setPendingSubfolderName(resolution.subfolderName);
                setPendingTargetPreview(resolution.targetPath);
                setActiveDialog("subfolder");
                return;
            }
            await continueRecoveryChange(resolution.targetPath);
        }
        catch (error) {
            setStatusMessage(error instanceof Error ? error.message : "Failed to pick data folder.");
        }
        finally {
            setIsWorking(false);
        }
    };
    const confirmSubfolderSelection = async (): Promise<void> => {
        const validationError = validateObscurDataSubfolderName(pendingSubfolderName);
        if (validationError) {
            setStatusMessage(validationError);
            return;
        }
        setIsWorking(true);
        setStatusMessage(null);
        try {
            const targetPath = await buildObscurDataRootTargetPath(pendingParentPath, pendingSubfolderName);
            setActiveDialog("none");
            await continueRecoveryChange(targetPath);
        }
        catch (error) {
            setStatusMessage(error instanceof Error ? error.message : "Failed to prepare data folder.");
        }
        finally {
            setIsWorking(false);
        }
    };
    const confirmFreshStart = async (): Promise<void> => {
        if (!pendingTargetPath) {
            return;
        }
        setIsWorking(true);
        setStatusMessage(null);
        try {
            await bindObscurDataRootForRecovery(pendingTargetPath, false);
            const targetPath = pendingTargetPath;
            resetPendingChange();
            await restartAfterDataRootChange(t("storage.dataRootRecovery.freshStartSuccess", { path: formatPath(targetPath) }));
        }
        catch (error) {
            setStatusMessage(error instanceof Error ? error.message : "Failed to set data folder.");
        }
        finally {
            setIsWorking(false);
        }
    };
    const confirmReconnect = async (): Promise<void> => {
        if (!pendingTargetPath) {
            return;
        }
        setIsWorking(true);
        setStatusMessage(null);
        try {
            await bindObscurDataRootForRecovery(pendingTargetPath, true);
            const targetPath = pendingTargetPath;
            resetPendingChange();
            await restartAfterDataRootChange(t("storage.dataRootRecovery.reconnectSuccess", { path: formatPath(targetPath) }));
        }
        catch (error) {
            setStatusMessage(error instanceof Error ? error.message : "Failed to reconnect data folder.");
        }
        finally {
            setIsWorking(false);
        }
    };
    const handleRetry = async (): Promise<void> => {
        setStatusMessage(null);
        await loadConfig();
    };
    useEffect(() => {
        if (activeDialog !== "subfolder" || !pendingParentPath) {
            return;
        }
        let cancelled = false;
        void buildObscurDataRootTargetPath(pendingParentPath, pendingSubfolderName)
            .then((targetPath) => {
            if (!cancelled) {
                setPendingTargetPreview(targetPath);
            }
        })
            .catch(() => {
            if (!cancelled) {
                setPendingTargetPreview("");
            }
        });
        return () => {
            cancelled = true;
        };
    }, [activeDialog, pendingParentPath, pendingSubfolderName]);
    if (gate.kind === "loading") {
        return (<div className="flex min-h-0 flex-1 items-center justify-center bg-[#090a0e] px-6 text-center text-zinc-300">
        <div className="space-y-2">
          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-violet-300"/>
          <p className="text-sm">
            {t("storage.dataRootRecovery.checking")}
          </p>
        </div>
      </div>);
    }
    if (gate.kind === "ready" || allowStorageSettings) {
        return <>{props.children}</>;
    }
    const { config } = gate;
    const issue = config.physicalPathIssue
        ?? t("storage.dataRootRecovery.defaultIssue");
    return (<>
      <div className="flex min-h-0 flex-1 items-center justify-center bg-[#090a0e] px-6 py-10 text-zinc-100">
        <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[#11131d] p-8 shadow-2xl">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300">
            <HardDrive className="h-7 w-7"/>
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            {t("storage.dataRootRecovery.title")}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">{issue}</p>

          <div className="mt-5 rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              {t("storage.dataRootRecovery.configuredPath")}
            </div>
            <div className="mt-1 break-all font-mono text-sm text-zinc-200">
              {formatPath(config.effectivePath) || "—"}
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm text-zinc-400">
            <p>
              {t("storage.dataRootRecovery.body")}
            </p>
            {config.recoverableCustomPath ? (<p className="text-emerald-300/90">
                {t("storage.dataRootRecovery.recoverableHint", { path: formatPath(config.recoverableCustomPath) })}
              </p>) : null}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button type="button" disabled={isWorking} onClick={() => void handleFolderPick("change")} className="gap-2">
              <FolderPlus className="h-4 w-4"/>
              {t("storage.dataRootRecovery.chooseNewAction")}
            </Button>
            <Button type="button" variant="secondary" disabled={isWorking} onClick={() => void handleFolderPick("reconnect")} className="gap-2">
              <FolderOpen className="h-4 w-4"/>
              {t("storage.dataRootRecovery.reconnectAction")}
            </Button>
            <Button type="button" variant="secondary" disabled={isWorking} onClick={() => void handleRetry()} className="gap-2">
              <RefreshCw className="h-4 w-4"/>
              {t("storage.dataRootRecovery.retryAction")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.push("/settings?tab=storage")} className="gap-2">
              <Settings className="h-4 w-4"/>
              {t("storage.dataRootRecovery.settingsAction")}
            </Button>
          </div>

          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-violet-500/20 bg-violet-500/5 px-4 py-3 text-xs text-violet-100/90">
            <Shield className="mt-0.5 h-4 w-4 shrink-0"/>
            <p>
              {t("storage.dataRootRecovery.exportHint")}
            </p>
          </div>

          {statusMessage ? (<p className="mt-4 text-sm text-amber-200">{statusMessage}</p>) : null}
        </div>
      </div>

      <Dialog open={activeDialog === "subfolder"} onOpenChange={(open) => {
            if (!open) {
                resetPendingChange();
            }
        }}>
        <DialogContent className="w-[min(32rem,calc(100vw-2rem))]">
          <DialogHeader>
            <DialogTitle>
              {t("storage.dataRootRecovery.subfolderTitle")}
            </DialogTitle>
            <DialogDescription className="text-left">
              {t("storage.dataRootRecovery.subfolderDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recovery-data-root-parent">
                {t("storage.dataRootRecovery.subfolderParent")}
              </Label>
              <Input id="recovery-data-root-parent" readOnly value={formatPath(pendingParentPath)} className="font-mono text-sm"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="recovery-data-root-name">
                {t("storage.dataRootRecovery.subfolderName")}
              </Label>
              <Input id="recovery-data-root-name" value={pendingSubfolderName} onChange={(event) => setPendingSubfolderName(event.target.value)} placeholder={DEFAULT_OBSCUR_DATA_SUBFOLDER} className="font-mono text-sm"/>
            </div>
            <div className="rounded-xl border border-black/5 bg-zinc-50/80 px-4 py-3 text-sm dark:border-white/5 dark:bg-zinc-900/50">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                {t("storage.dataRootRecovery.subfolderPreview")}
              </div>
              <div className="mt-1 break-all font-mono text-zinc-800 dark:text-zinc-200">
                {formatPath(pendingTargetPreview) || "—"}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="ghost" onClick={resetPendingChange} disabled={isWorking}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={() => void confirmSubfolderSelection()} disabled={isWorking}>
              {t("storage.dataRootRecovery.subfolderContinue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog isOpen={activeDialog === "fresh"} onClose={resetPendingChange} onConfirm={() => void confirmFreshStart()} title={t("storage.dataRootRecovery.freshStartTitle")} description={t("storage.dataRootRecovery.freshStartDesc", { path: formatPath(pendingTargetPath) || "the selected folder" })} confirmLabel={t("storage.dataRootRecovery.freshStartConfirm")} cancelLabel={t("common.cancel")} isLoading={isWorking}/>

      <ConfirmDialog isOpen={activeDialog === "reconnect"} onClose={resetPendingChange} onConfirm={() => void confirmReconnect()} title={t("storage.dataRootRecovery.reconnectTitle")} description={t("storage.dataRootRecovery.reconnectDesc", pendingPlan?.anchorWouldBeReplaced
            ? "Obscur will use the data already at {{path}}. The broken app bind will be replaced. Nothing is copied. Obscur restarts after you confirm."
            : "Obscur will use the data already at {{path}}. Nothing is copied. Obscur restarts after you confirm.", { path: formatPath(pendingTargetPath) || "the selected folder" })} confirmLabel={t("storage.dataRootRecovery.reconnectConfirm")} cancelLabel={t("common.cancel")} isLoading={isWorking}/>
    </>);
}
