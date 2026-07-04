"use client";
import React from "react";
import { useTranslation } from "react-i18next";
import { Building2, Check, Server, Wifi } from "lucide-react";
import { ActionButtonSpinner } from "@/app/components/ui/action-button-spinner";
import { Button, Input, Label, toast } from "@dweb/ui-kit";
import { cn } from "@/app/lib/cn";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useRelayList } from "@/app/features/relays/hooks/use-relay-list";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { ensureWorkspaceRelayTransportReady } from "@/app/features/groups/services/workspace-relay-calibrator";
import { clearCoordinationHealthCache, probeCoordinationHealth, } from "@/app/features/groups/services/community-coordination-health";
import { getCoordinationUrlSource, normalizeOperatorRelayUrl, readOperatorCoordinationUrlOverride, readOperatorWorkspaceRelayUrl, resolveCoordinationBaseUrl, writeOperatorCoordinationUrlOverride, writeOperatorWorkspaceRelayUrl, } from "@/app/features/groups/services/operator-trust-config";
import { writeMembershipSyncMode } from "@/app/features/groups/services/community-membership-sync-mode";
import { assessWorkspaceCommunityTrust } from "@/app/features/groups/services/community-trust-policy";
import { readAssumeLocalCoordinationReachable, readCoordinationOnlyWorkspaceDevModeOverride, writeAssumeLocalCoordinationReachable, writeCoordinationOnlyWorkspaceDevModeOverride, } from "@/app/features/groups/services/community-dev-flags";
import { LOCAL_DEV_RELAY_URL } from "@/app/features/relays/hooks/use-relay-list";
type WizardPhase = "idle" | "probing" | "success" | "error";
export function OperatorTrustSetupWizard(): React.JSX.Element {
    const { t } = useTranslation();
    const identity = useIdentity();
    const relayList = useRelayList({ publicKeyHex: identity.state.publicKeyHex ?? null });
    const { relayPool } = useRelay();
    const [coordinationUrl, setCoordinationUrl] = React.useState("");
    const [workspaceRelayUrl, setWorkspaceRelayUrl] = React.useState("ws://localhost:7000");
    const [phase, setPhase] = React.useState<WizardPhase>("idle");
    const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
    const [testWithoutRelay, setTestWithoutRelay] = React.useState(() => readCoordinationOnlyWorkspaceDevModeOverride());
    const [assumeLocalCoordination, setAssumeLocalCoordination] = React.useState(() => readAssumeLocalCoordinationReachable());
    React.useEffect(() => {
        const effective = resolveCoordinationBaseUrl()
            ?? (process.env.NEXT_PUBLIC_COORDINATION_URL ?? "").trim();
        setCoordinationUrl(effective);
        setWorkspaceRelayUrl(readOperatorWorkspaceRelayUrl() ?? "ws://localhost:7000");
    }, []);
    const coordinationSource = getCoordinationUrlSource();
    const buildEnvUrl = (process.env.NEXT_PUBLIC_COORDINATION_URL ?? "").trim();
    const handleApply = async (): Promise<void> => {
        const coord = coordinationUrl.trim();
        const rawRelayInput = testWithoutRelay
            ? LOCAL_DEV_RELAY_URL
            : normalizeOperatorRelayUrl(workspaceRelayUrl);
        if (!coord) {
            setPhase("error");
            setStatusMessage(t("settings.operatorSetup.coordinationRequired"));
            return;
        }
        if (!testWithoutRelay && !rawRelayInput) {
            setPhase("error");
            setStatusMessage(t("settings.operatorSetup.relayRequired"));
            return;
        }
        setPhase("probing");
        setStatusMessage(null);
        writeOperatorCoordinationUrlOverride(coord);
        writeCoordinationOnlyWorkspaceDevModeOverride(testWithoutRelay);
        writeAssumeLocalCoordinationReachable(assumeLocalCoordination);
        clearCoordinationHealthCache();
        const health = await probeCoordinationHealth({ force: true });
        if (!health.healthy && !assumeLocalCoordination) {
            setPhase("error");
            setStatusMessage(t("settings.operatorSetup.coordinationUnreachable"));
            return;
        }
        if (!testWithoutRelay) {
            const calibration = await ensureWorkspaceRelayTransportReady({
                rawUrl: rawRelayInput,
                pool: relayPool,
                timeoutMs: 5000,
            });
            const relay = calibration.canonicalUrl;
            const trust = assessWorkspaceCommunityTrust({
                communityRelayUrl: relay,
                enabledRelayUrls: relayList.state.relays.map((entry) => entry.url),
                coordinationHealthy: true,
            });
            if (!trust.allowed) {
                setPhase("error");
                setStatusMessage(trust.userMessage);
                return;
            }
            writeOperatorWorkspaceRelayUrl(relay);
            relayList.addRelay({ url: relay });
        }
        else {
            writeOperatorWorkspaceRelayUrl(rawRelayInput);
        }
        writeMembershipSyncMode("coordination_preferred");
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("obscur:operator-trust-config-changed"));
        }
        setPhase("success");
        setStatusMessage(testWithoutRelay
            ? t("settings.operatorSetup.successNoRelay")
            : t("settings.operatorSetup.success"));
        toast.success(t("settings.operatorSetup.successToast"));
    };
    return (<div id="operator-trust-setup" className="space-y-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5 dark:border-emerald-500/20 dark:bg-emerald-950/20" data-testid="operator-trust-setup-wizard">
            <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
                    <Building2 className="h-4 w-4"/>
                    {t("settings.operatorSetup.title")}
                </div>
                <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {t("settings.operatorSetup.desc")}
                </p>
                {buildEnvUrl ? (<p className="text-[10px] text-zinc-500">
                        {t("settings.operatorSetup.buildEnv")}
                        {" "}
                        <span className="font-mono">{buildEnvUrl}</span>
                        {coordinationSource === "runtime_override" ? (<span className="ml-2 font-semibold text-emerald-700 dark:text-emerald-300">
                                ({t("settings.operatorSetup.usingOverride")})
                            </span>) : null}
                    </p>) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        <Server className="mr-1 inline h-3 w-3"/>
                        {t("settings.operatorSetup.coordinationLabel")}
                    </Label>
                    <Input value={coordinationUrl} onChange={(event) => setCoordinationUrl(event.target.value)} placeholder="http://127.0.0.1:8787" className="font-mono text-xs" data-testid="operator-setup-coordination-url"/>
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        <Wifi className="mr-1 inline h-3 w-3"/>
                        {t("settings.operatorSetup.relayLabel")}
                    </Label>
                    <Input value={workspaceRelayUrl} onChange={(event) => setWorkspaceRelayUrl(event.target.value)} placeholder="ws://localhost:7000" className="font-mono text-xs" data-testid="operator-setup-workspace-relay"/>
                </div>
            </div>

            {statusMessage ? (<p className={cn("rounded-lg border px-3 py-2 text-xs", phase === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                : "border-rose-500/30 bg-rose-500/10 text-rose-900 dark:text-rose-100")} data-testid="operator-setup-status">
                    {statusMessage}
                </p>) : null}

            <label className="flex items-start gap-3 rounded-xl border border-zinc-200/80 bg-white/50 p-3 dark:border-zinc-800 dark:bg-black/20">
                <input type="checkbox" className="mt-1" checked={assumeLocalCoordination} onChange={(event) => setAssumeLocalCoordination(event.target.checked)} data-testid="operator-setup-assume-coordination"/>
                <span className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                    <span className="font-semibold text-zinc-900 dark:text-white">
                        {t("settings.operatorSetup.assumeCoordinationTitle")}
                    </span>
                    <br />
                    {t("settings.operatorSetup.assumeCoordinationDesc")}
                </span>
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-zinc-200/80 bg-white/50 p-3 dark:border-zinc-800 dark:bg-black/20">
                <input type="checkbox" className="mt-1" checked={testWithoutRelay} onChange={(event) => {
            const enabled = event.target.checked;
            setTestWithoutRelay(enabled);
            if (!enabled) {
                setAssumeLocalCoordination(false);
            }
        }} data-testid="operator-setup-skip-relay"/>
                <span className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                    <span className="font-semibold text-zinc-900 dark:text-white">
                        {t("settings.operatorSetup.skipRelayTitle")}
                    </span>
                    <br />
                    {t("settings.operatorSetup.skipRelayDesc")}
                </span>
            </label>

            <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void handleApply()} disabled={phase === "probing"} className={cn(phase === "probing" && "!opacity-100 cursor-wait")} data-testid="operator-setup-apply">
                    {phase === "probing" ? (<ActionButtonSpinner className="mr-2 border-white/35 border-t-white text-white"/>) : (<Check className="mr-2 h-4 w-4"/>)}
                    {phase === "probing"
            ? t("settings.operatorSetup.applying")
            : t("settings.operatorSetup.apply")}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => {
            writeOperatorCoordinationUrlOverride(null);
            writeOperatorWorkspaceRelayUrl(null);
            writeCoordinationOnlyWorkspaceDevModeOverride(false);
            clearCoordinationHealthCache();
            setCoordinationUrl(buildEnvUrl);
            setWorkspaceRelayUrl("ws://localhost:7000");
            setTestWithoutRelay(false);
            setPhase("idle");
            setStatusMessage(null);
        }}>
                    {t("settings.operatorSetup.resetOverrides")}
                </Button>
            </div>

            {readOperatorCoordinationUrlOverride() ? (<p className="text-[10px] text-zinc-500 font-mono">
                    {t("settings.operatorSetup.overrideActive")}
                    {" "}
                    {readOperatorCoordinationUrlOverride()}
                </p>) : null}
        </div>);
}
