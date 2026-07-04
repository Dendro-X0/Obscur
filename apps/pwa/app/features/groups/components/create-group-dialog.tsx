"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { useTranslation } from "react-i18next";
import { Users, Camera, X, Check, Globe, Lock, Building2, ChevronDown } from "lucide-react";
import { ActionButtonSpinner } from "@/app/components/ui/action-button-spinner";
import { CommunityActionWaitRing } from "./community-action-wait-ring";
import { buildCommunityActionWaitSteps, type CommunityActionWaitStep, } from "./community-action-wait-types";
import { useUploadService } from "@/app/features/messaging/lib/upload-service";
import { useRelayList } from "@/app/features/relays/hooks/use-relay-list";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from "../../../components/ui/dropdown-menu";
import { cn } from "@/app/lib/utils";
import Image from "next/image";
import type { GroupAccessMode, CommunityMode, RelayCapabilityTier } from "../types";
import { assessRelayCapability, isManagedWorkspaceRelayGateBlocking, isPublicDefaultRelayHost, resolveManagedWorkspaceRelayGate, type RelayCapabilityAssessment, } from "../services/community-mode-contract";
import { probeCoordinationHealth } from "../services/community-coordination-health";
import { assessWorkspaceCommunityTrust } from "../services/community-trust-policy";
import { hasWritableCommunityRelayTransport } from "../services/community-relay-transport";
import { pickDefaultCommunityCreateRelayHost, resolveCommunityCreateRelayOptions, } from "../services/community-create-relay-catalog";
import { isCoordinationGateSatisfied, isCoordinationOnlyWorkspaceDevMode, } from "../services/community-dev-flags";
import { useWorkspaceDevFlagsRevision } from "../hooks/use-workspace-dev-flags-revision";
import { isCoordinationConfigured } from "../services/community-membership-sync-mode";
import { LOCAL_DEV_RELAY_URL } from "@/app/features/relays/hooks/use-relay-list";
import { normalizeWorkspaceRelayUrl } from "../services/workspace-relay-url";
import { operatorTrustBundleHostFromRelayUrl, readOperatorTrustBundleSnapshot, } from "../services/operator-trust-bundle-audit";
import { isNewSovereignRoomCreationAllowed, isWorkspaceCommunityCreateAllowed, WORKSPACE_KERNEL_CREATE_DEFERRED_MESSAGE, } from "@/app/features/workspace-kernel/workspace-kernel-sovereign-create-policy";
const hostFromRelayUrl = (relayUrl: string): string => (relayUrl.replace(/^wss?:\/\//i, "").replace(/\/$/, ""));

const MANAGED_WORKSPACE_GUARANTEE_KEYS = [
    "groups.mode.managedWorkspace.guarantee1",
    "groups.mode.managedWorkspace.guarantee2",
    "groups.mode.managedWorkspace.guarantee3",
] as const;
export interface GroupCreateInfo {
    host: string;
    groupId: string;
    name: string;
    about: string;
    avatar?: string;
    access: GroupAccessMode;
    relayCapabilityTier: RelayCapabilityTier;
    communityMode: CommunityMode;
}
export type CommunityCreateWaitPhase = "local" | "relay" | "directory" | "done";
interface CreateGroupDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (info: GroupCreateInfo) => void;
    isCreating?: boolean;
    createWaitPhase?: CommunityCreateWaitPhase | null;
}
export function CreateGroupDialog({ isOpen, onClose, onCreate, isCreating, createWaitPhase = null, }: CreateGroupDialogProps) {
    const router = useRouter();
    const { t } = useTranslation();
    const { uploadFile, pickFiles } = useUploadService();
    const [isUploading, setIsUploading] = useState(false);
    const identity = useIdentity();
    const relayList = useRelayList({ publicKeyHex: identity.state.publicKeyHex || null });
    const { relayPool } = useRelay();
    const relayPoolRef = React.useRef(relayPool);
    React.useEffect(() => {
        relayPoolRef.current = relayPool;
    }, [relayPool]);
    const relayConnectionSignature = React.useMemo(() => relayPool.connections.map((connection) => `${connection.url}:${connection.status}`).join("|"), [relayPool.connections]);
    const [info, setInfo] = useState<GroupCreateInfo>(() => ({
        host: "",
        groupId: typeof crypto !== "undefined" ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(36).substring(2),
        name: "",
        about: "",
        avatar: "",
        access: "invite-only",
        relayCapabilityTier: "managed_intranet",
        communityMode: "managed_workspace",
    }));
    const [coordinationHealthy, setCoordinationHealthy] = useState<boolean | null>(null);
    const devFlagsRevision = useWorkspaceDevFlagsRevision();
    React.useEffect(() => {
        if (!isOpen) {
            return;
        }
        let cancelled = false;
        const pool = relayPoolRef.current;
        const catalog = resolveCommunityCreateRelayOptions({
            relays: relayList.state.relays,
            connections: pool.connections,
            getHealth: (url) => pool.getRelayHealth(url),
            forManagedWorkspace: true,
            allowDisconnectedPrivateRelays: isCoordinationOnlyWorkspaceDevMode(),
        });
        const bundleSnapshot = readOperatorTrustBundleSnapshot();
        const operatorPreferredHost = bundleSnapshot.workspaceRelayUrl
            ? operatorTrustBundleHostFromRelayUrl(bundleSnapshot.workspaceRelayUrl)
            : null;
        const defaultHost = pickDefaultCommunityCreateRelayHost(catalog, operatorPreferredHost);
        if (defaultHost) {
            setInfo((prev) => (prev.host.trim().length > 0 ? prev : { ...prev, host: defaultHost }));
        }
        else if (isCoordinationOnlyWorkspaceDevMode()) {
            setInfo((prev) => (prev.host.trim().length > 0 ? prev : {
                ...prev,
                host: hostFromRelayUrl(LOCAL_DEV_RELAY_URL),
            }));
        }
        const probeWritableRelays = async (): Promise<void> => {
            const probeTarget = catalog.find((option) => option.selectable && option.host === defaultHost)
                ?? catalog.find((option) => option.selectable);
            if (!probeTarget || cancelled) {
                return;
            }
            if (typeof pool.addTransientRelay === "function") {
                pool.addTransientRelay(probeTarget.relayUrl);
            }
            if (typeof pool.reconnectRelay === "function") {
                pool.reconnectRelay(probeTarget.relayUrl);
            }
            if (!cancelled && typeof pool.waitForScopedConnection === "function") {
                await pool.waitForScopedConnection([probeTarget.relayUrl], 4000);
            }
        };
        void probeWritableRelays();
        void probeCoordinationHealth({ force: true }).then((snapshot) => {
            if (!cancelled) {
                setCoordinationHealthy(snapshot.healthy);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [isOpen, relayList.state.relays, relayConnectionSignature, devFlagsRevision]);
    const coordinationGateSatisfied = React.useMemo(() => isCoordinationGateSatisfied(coordinationHealthy), [coordinationHealthy, devFlagsRevision]);
    const relayAssessment: RelayCapabilityAssessment = React.useMemo(() => {
        return assessRelayCapability({
            enabledRelayUrls: relayList.state.relays.map((r) => r.url),
            selectedRelayHost: info.host,
        });
    }, [info.host, relayList.state.relays]);
    const managedCreateGate = React.useMemo(() => resolveManagedWorkspaceRelayGate({
        communityMode: info.communityMode,
        enabledRelayUrls: relayList.state.relays.map((r) => r.url),
        communityRelayUrl: normalizeWorkspaceRelayUrl(info.host),
    }), [info.communityMode, info.host, relayList.state.relays]);
    const managedCreateBlocked = isManagedWorkspaceRelayGateBlocking(managedCreateGate);
    const workspaceTrust = React.useMemo(() => assessWorkspaceCommunityTrust({
        communityRelayUrl: normalizeWorkspaceRelayUrl(info.host),
        enabledRelayUrls: relayList.state.relays.map((r) => r.url),
        coordinationHealthy: coordinationHealthy === true
            ? true
            : coordinationHealthy === false
                ? false
                : undefined,
    }), [coordinationHealthy, info.host, relayList.state.relays]);
    const workspaceCreateBlocked = !workspaceTrust.allowed;
    const coordinationOnlyDev = isCoordinationOnlyWorkspaceDevMode();
    const relayCatalog = React.useMemo(() => resolveCommunityCreateRelayOptions({
        relays: relayList.state.relays,
        connections: relayPool.connections,
        getHealth: (url) => relayPool.getRelayHealth(url),
        forManagedWorkspace: true,
        allowDisconnectedPrivateRelays: coordinationOnlyDev,
    }), [coordinationOnlyDev, relayList.state.relays, relayPool.connections, relayPool.getRelayHealth]);
    const selectedRelayOption = React.useMemo(() => relayCatalog.find((option) => option.host === info.host.trim()), [info.host, relayCatalog]);
    const normalizedCreateRelayUrl = React.useMemo(() => normalizeWorkspaceRelayUrl(info.host), [info.host]);
    const createRelayTransportReady = hasWritableCommunityRelayTransport(normalizedCreateRelayUrl);
    const coordinationConfigured = isCoordinationConfigured();
    const coordinationUnreachable = coordinationConfigured
        && coordinationHealthy === false
        && !coordinationGateSatisfied;
    const relayHostAllowed = coordinationOnlyDev
        ? info.host.trim().length > 0 || coordinationGateSatisfied
        : selectedRelayOption
            ? selectedRelayOption.selectable
            : createRelayTransportReady && !isPublicDefaultRelayHost(info.host);
    const workspaceCreateBlockedEffective = workspaceCreateBlocked;
    const workspaceKernelCreateDeferred = !isWorkspaceCommunityCreateAllowed();
    const sovereignCreateBlocked = !isNewSovereignRoomCreationAllowed();
    const isValid = info.groupId.trim().length > 0 &&
        info.name.trim().length > 0 &&
        relayHostAllowed &&
        coordinationGateSatisfied &&
        !workspaceCreateBlockedEffective &&
        !managedCreateBlocked &&
        !workspaceKernelCreateDeferred &&
        sovereignCreateBlocked &&
        (coordinationOnlyDev || (info.host.trim().length > 0 && createRelayTransportReady));
    const createActionLabel = t("groups.createAction");
    const creatingActionLabel = t("groups.creatingAction");
    const isCreateBusy = Boolean(isCreating || isUploading);
    const createWaitSteps: ReadonlyArray<CommunityActionWaitStep> = React.useMemo(() => buildCommunityActionWaitSteps([
        {
            id: "local",
            label: t("groups.create.waitStep.local.label"),
            detail: t("groups.create.waitStep.local.detail"),
        },
        {
            id: "relay",
            label: t("groups.create.waitStep.relay.label"),
            detail: createRelayTransportReady
                ? t("groups.create.waitStep.relay.detailReady")
                : t("groups.create.waitStep.relay.detailSkipped"),
        },
        {
            id: "directory",
            label: t("groups.create.waitStep.directory.label"),
            detail: coordinationGateSatisfied
                ? t("groups.create.waitStep.directory.detailReady")
                : t("groups.create.waitStep.directory.detailSkipped"),
        },
    ], createWaitPhase === "done" ? null : createWaitPhase, {
        allComplete: createWaitPhase === "done",
        skippedStepIds: [
            ...(createRelayTransportReady ? [] : ["relay"]),
            ...(coordinationGateSatisfied ? [] : ["directory"]),
        ],
    }), [coordinationGateSatisfied, createRelayTransportReady, createWaitPhase, t]);
    const relayBaselineLabel = t(`groups.relayBaseline.${relayAssessment.tier}.label`);
    const relayBaselineSummary = t(`groups.relayBaseline.${relayAssessment.tier}.summary`);
    const workspaceTrustUserMessageKey = !workspaceTrust.allowed && workspaceTrust.reasonCode === "relay_unconfigured" && info.host.trim().length > 0 && !createRelayTransportReady
        ? "groups.workspaceTrust.relay_unreachable.userMessage"
        : `groups.workspaceTrust.${workspaceTrust.reasonCode}.userMessage`;
    const workspaceTrustSettingsHintKey = workspaceTrust.allowed
        ? (isCoordinationOnlyWorkspaceDevMode() && !createRelayTransportReady
            ? "groups.workspaceTrust.coordinationOnlyDev.settingsHint"
            : "groups.workspaceTrust.allowed.settingsHint")
        : workspaceTrust.reasonCode === "relay_unconfigured" && info.host.trim().length > 0 && !createRelayTransportReady
            ? "groups.workspaceTrust.relay_unreachable.settingsHint"
            : `groups.workspaceTrust.${workspaceTrust.reasonCode}.settingsHint`;
    const managedCreateBlockedMessageKey = managedCreateGate.reasonCode === "relay_tier_insufficient" && relayAssessment.tier === "public_default"
        ? "groups.managedWorkspaceGate.publicRelay.userMessage"
        : managedCreateGate.reasonCode === "relay_tier_insufficient"
            ? "groups.managedWorkspaceGate.relayTierInsufficient.userMessage"
            : `groups.managedWorkspaceGate.${managedCreateGate.reasonCode}.userMessage`;
    if (!isOpen)
        return null;
    return (<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-3xl max-h-[90vh] bg-[#fafafa] dark:bg-[#121214] border border-zinc-200 dark:border-[#1a1a1c] shadow-2xl overflow-hidden rounded-[20px] flex flex-col">
                {isCreating ? (<div className="absolute inset-0 z-20 flex items-center justify-center bg-[#fafafa]/95 dark:bg-[#121214]/95 backdrop-blur-sm" data-testid="create-group-wait-ring">
                        <CommunityActionWaitRing title={t("groups.createWaitTitle")} subtitle={t("groups.createWaitSubtitle")} steps={createWaitSteps}/>
                    </div>) : null}
                {/* Header - Compact */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-[#1a1a1c] bg-zinc-50/50 dark:bg-[#0f0f11]/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary"/>
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-zinc-900 dark:text-white tracking-tight">{t("groups.createTitle")}</h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("groups.createDescription")}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} disabled={isCreating} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-[#1a1a1c] transition-colors">
                        <X className="h-5 w-5 text-zinc-500"/>
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left Column - Identity & Basics */}
                        <div className="space-y-5">
                            {/* Avatar & Name - Horizontal Layout */}
                            <div className="flex gap-4">
                                <button type="button" disabled={isUploading || isCreating} onClick={async () => {
            setIsUploading(true);
            try {
                const files = await pickFiles();
                const file = files?.[0];
                if (file) {
                    const result = await uploadFile(file);
                    setInfo(prev => ({ ...prev, avatar: result.url }));
                }
            }
            catch (error) {
                console.error("Failed to upload avatar:", error);
            }
            finally {
                setIsUploading(false);
            }
        }} className={cn("group relative h-20 w-20 shrink-0 rounded-2xl flex items-center justify-center border-2 border-dashed transition-all duration-300 overflow-hidden shadow-sm", info.avatar
            ? "bg-transparent border-transparent"
            : "bg-zinc-50 dark:bg-[#121214] border-zinc-200 dark:border-[#222224] hover:border-primary/50")}>
                                    {info.avatar ? (<Image src={info.avatar} alt={t("groups.create.avatarAlt")} fill unoptimized className="object-cover rounded-2xl"/>) : (<Camera className="h-6 w-6 text-zinc-400 dark:text-zinc-600 group-hover:text-primary transition-colors"/>)}
                                    {isUploading && (<div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center rounded-2xl">
                                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"/>
                                        </div>)}
                                </button>
                                <div className="flex-1 space-y-2">
                                    <Label htmlFor="group-name" className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">
                                        {t("groups.nameLabel")}
                                    </Label>
                                    <Input id="group-name" value={info.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInfo(prev => ({ ...prev, name: e.target.value }))} placeholder={t("groups.create.namePlaceholder")} className="bg-zinc-50 dark:bg-[#121214] border-zinc-200 dark:border-[#222224] text-zinc-900 dark:text-white rounded-xl h-11 focus-visible:ring-primary/40 text-sm font-medium"/>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                <Label htmlFor="group-about" className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">
                                    {t("groups.aboutLabel")}
                                </Label>
                                <Textarea id="group-about" value={info.about} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInfo(prev => ({ ...prev, about: e.target.value }))} placeholder={t("groups.create.aboutPlaceholder")} className="bg-zinc-50 dark:bg-[#121214] border-zinc-200 dark:border-[#222224] text-zinc-900 dark:text-white rounded-xl min-h-[80px] py-3 resize-none focus-visible:ring-primary/40 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-sm"/>
                            </div>

                            {/* Host Section */}
                            <div className="space-y-2">
                                <Label htmlFor="group-host" className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">
                                    {t("groups.hostLabel")}
                                </Label>
                                <div className="relative">
                                    <Input id="group-host" value={info.host} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInfo(prev => ({ ...prev, host: e.target.value }))} placeholder={t("groups.create.hostPlaceholder")} className="bg-zinc-50 dark:bg-[#121214] border-zinc-200 dark:border-[#222224] text-zinc-900 dark:text-white rounded-xl h-11 focus-visible:ring-primary/40 pr-28 text-sm font-medium"/>
                                    <div className="absolute inset-y-1.5 right-1.5 flex items-center">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button type="button" className="inline-flex h-8 min-w-[96px] items-center justify-center gap-1.5 rounded-lg border border-transparent bg-zinc-100 px-3 text-[10px] font-black uppercase tracking-wider text-zinc-800 transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:bg-[#2a2b33] dark:text-zinc-100 dark:hover:bg-[#343641]">
                                                    {t("common.select")}
                                                    <ChevronDown className="ml-1.5 h-3 w-3"/>
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" sideOffset={8} className="z-[5100] w-56 rounded-2xl p-2 bg-white dark:bg-[#0f0f11] border border-zinc-200 dark:border-[#1a1a1c] shadow-2xl">
                                                <div className="px-3 py-2 text-[9px] font-black uppercase tracking-[0.15em] text-zinc-400">
                                                    {t("groups.availableRelays")}
                                                </div>
                                                <div className="max-h-[200px] overflow-y-auto scrollbar-hide space-y-0.5">
                                                    {relayCatalog.length === 0 ? (<p className="px-3 py-2 text-xs text-zinc-500">
                                                            {t("groups.noSelectableRelays")}
                                                        </p>) : null}
                                                    {relayCatalog.map((relay) => (<DropdownMenuItem key={relay.relayUrl} disabled={!relay.selectable} onClick={() => {
                if (!relay.selectable) {
                    return;
                }
                setInfo((prev) => ({ ...prev, host: relay.host }));
            }} className={cn("flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors duration-150 ease-out", !relay.selectable
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer", info.host === relay.host
                ? "bg-primary/10 text-primary"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#121214]")}>
                                                            <span className="min-w-0 truncate font-medium">{relay.host}</span>
                                                            <span className={cn("shrink-0 text-[9px] font-black uppercase tracking-wide", relay.status === "healthy"
                ? "text-emerald-600 dark:text-emerald-400"
                : relay.status === "degraded" || relay.status === "recovering"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-rose-600 dark:text-rose-400")}>
                                                                {relay.badge}
                                                            </span>
                                                        </DropdownMenuItem>))}
                                                </div>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                                <p className="text-[10px] text-zinc-500 dark:text-zinc-500 leading-relaxed">
                                    {selectedRelayOption?.selectable
            ? t("groups.hostHint")
            : selectedRelayOption?.disabledReason
                ?? t("groups.hostInvalidRelay")}
                                </p>
                                {selectedRelayOption && selectedRelayOption.selectable && selectedRelayOption.status !== "healthy" ? (<p className="text-[10px] text-amber-700 dark:text-amber-300">
                                        {selectedRelayOption.detail}
                                    </p>) : null}
                                {coordinationOnlyDev && !createRelayTransportReady ? (<p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[10px] text-emerald-900 dark:text-emerald-100" data-testid="create-group-coordination-only-dev">
                                        {t("groups.create.coordinationOnlyDevBanner")}
                                    </p>) : null}
                                {coordinationOnlyDev && createRelayTransportReady ? (<p className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-[10px] text-sky-900 dark:text-sky-100" data-testid="create-group-managed-relay-required">
                                        {t("groups.create.managedRelayRequiredBanner")}
                                    </p>) : null}
                                {coordinationOnlyDev && coordinationHealthy === null ? (<p className="text-[10px] text-zinc-500">
                                        {t("groups.create.coordinationProbing")}
                                    </p>) : null}
                            </div>

                            {/* Privacy Policy */}
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400 block">
                                    {t("groups.privacyLabel")}
                                </Label>
                                <div className="flex bg-zinc-50 dark:bg-[#121214] border border-zinc-200 dark:border-[#222224] rounded-xl p-1 gap-1 shadow-inner">
                                    <button type="button" onClick={() => setInfo(prev => ({ ...prev, access: "open" }))} className={cn("flex-1 flex flex-col items-center justify-center py-2.5 rounded-lg transition-all duration-200", info.access === "open"
            ? "bg-white dark:bg-[#222224] text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200 dark:border-zinc-700/50"
            : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}>
                                        <Globe className={cn("h-4 w-4 mb-1 transition-transform", info.access === "open" ? "text-primary scale-110" : "opacity-40")}/>
                                        <span className={cn("text-[10px] tracking-wide", info.access === "open" ? "font-bold" : "font-medium opacity-60")}>{t("groups.create.privacyOpen")}</span>
                                    </button>
                                    <button type="button" onClick={() => setInfo(prev => ({ ...prev, access: "discoverable" }))} className={cn("flex-1 flex flex-col items-center justify-center py-2.5 rounded-lg transition-all duration-200", info.access === "discoverable"
            ? "bg-white dark:bg-[#222224] text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200 dark:border-zinc-700/50"
            : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}>
                                        <Users className={cn("h-4 w-4 mb-1 transition-transform", info.access === "discoverable" ? "text-primary scale-110" : "opacity-40")}/>
                                        <span className={cn("text-[10px] tracking-wide", info.access === "discoverable" ? "font-bold" : "font-medium opacity-60")}>{t("groups.create.privacyPublic")}</span>
                                    </button>
                                    <button type="button" onClick={() => setInfo(prev => ({ ...prev, access: "invite-only" }))} className={cn("flex-1 flex flex-col items-center justify-center py-2.5 rounded-lg transition-all duration-200", info.access === "invite-only"
            ? "bg-white dark:bg-[#222224] text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200 dark:border-zinc-700/50"
            : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}>
                                        <Lock className={cn("h-4 w-4 mb-1 transition-transform", info.access === "invite-only" ? "text-rose-500 scale-110" : "opacity-40")}/>
                                        <span className={cn("text-[10px] tracking-wide", info.access === "invite-only" ? "font-bold" : "font-medium opacity-60")}>{t("groups.create.privacySecret")}</span>
                                    </button>
                                </div>
                                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center leading-relaxed">
                                    {info.access === "open" && t("groups.accessOpenDesc")}
                                    {info.access === "discoverable" && t("groups.accessDiscoverableDesc")}
                                    {info.access === "invite-only" && t("groups.accessInviteOnlyDesc")}
                                </p>
                            </div>
                        </div>

                        {/* Right Column - Community Mode & Advanced */}
                        <div className="space-y-4">
                            {/* Relay Baseline Card */}
                            {relayAssessment.tier === "public_default" ? (<div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-950 dark:text-amber-100" role="status" data-testid="create-group-public-relay-honesty">
                                    <p className="font-semibold">
                                        {t("groups.create.publicRelayRosterTitle")}
                                    </p>
                                    <p className="mt-1 opacity-90">
                                        {t("groups.create.publicRelayRosterNostrHint")}
                                    </p>
                                    <p className="mt-1 opacity-80">
                                        {t("groups.create.publicRelayRosterCoordinationHint")}
                                    </p>
                                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest opacity-90">
                                        {t("groups.create.sovereignLegacyNote")}
                                    </p>
                                </div>) : null}

                            <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 dark:border-[#222224] dark:bg-[#121214]/50">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">
                                        {t("groups.relayBaselineLabel")}
                                    </p>
                                    <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-zinc-500 dark:border-zinc-700 dark:bg-[#0a0a0c] dark:text-zinc-400">
                                        {relayAssessment.enabledRelayCount > 0
            ? t("groups.create.relayCountEnabled", { count: relayAssessment.enabledRelayCount })
            : t("groups.create.relayCountNone")}
                                    </span>
                                </div>
                                <p className="mt-1 text-sm font-bold text-zinc-900 dark:text-white">
                                    {relayBaselineLabel}
                                </p>
                                <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-500">
                                    {relayBaselineSummary}
                                </p>
                            </div>

                            <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-[11px] leading-relaxed text-sky-900 dark:text-sky-100" role="status" data-testid="create-group-workspace-trust-panel">
                                <p className="font-semibold">
                                    {t("groups.create.workspaceTrustTitle")}
                                </p>
                                <p className="mt-1 opacity-90">
                                    {workspaceTrust.allowed
            ? t(workspaceTrustSettingsHintKey)
            : t(workspaceTrustUserMessageKey)}
                                </p>
                                {!workspaceTrust.allowed ? (<p className="mt-1 text-[10px] opacity-80">{t(workspaceTrustSettingsHintKey)}</p>) : null}
                                <button type="button" className="mt-2 text-[10px] font-bold uppercase tracking-widest underline" onClick={() => {
            onClose();
            router.push("/settings?tab=relays#membership-sync-settings");
        }}>
                                    {t("groups.create.openMembershipSyncSettings")}
                                </button>
                            </div>

                            {/* Workspace mode (fixed) */}
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 px-1">
                                    {t("groups.modeLabel")}
                                </Label>
                                <div className="w-full rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3">
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 shrink-0 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                            <Building2 className="h-4 w-4 text-emerald-500"/>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-zinc-900 dark:text-white">
                                                {t("groups.mode.managedWorkspace.label")}
                                            </p>
                                            <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                                                {t("groups.mode.managedWorkspace.shortDescription")}
                                            </p>
                                        </div>
                                        <Check className="h-4 w-4 text-emerald-500 shrink-0"/>
                                    </div>
                                </div>

                                {/* Selected Guarantees */}
                                <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-[#222224] dark:bg-[#0f0f11]">
                                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
                                        {t("groups.guaranteesLabel")}
                                    </p>
                                    <p className="mt-1 text-sm font-bold text-zinc-900 dark:text-white">
                                        {t("groups.mode.managedWorkspace.label")}
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {MANAGED_WORKSPACE_GUARANTEE_KEYS.map((guaranteeKey) => (<span key={guaranteeKey} className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:bg-[#161618] dark:text-zinc-300">
                                                {t(guaranteeKey)}
                                            </span>))}
                                    </div>
                                    <p className="mt-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-500">
                                        {t("groups.mode.managedWorkspace.caution")}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {workspaceKernelCreateDeferred ? (<div className="mx-6 mb-0 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100" data-testid="create-group-workspace-kernel-deferred" role="status">
                        <p className="font-semibold">
                            {t("groups.create.workspaceKernelDeferredTitle")}
                        </p>
                        <p className="mt-1 text-xs opacity-90">{WORKSPACE_KERNEL_CREATE_DEFERRED_MESSAGE}</p>
                    </div>) : null}

                {workspaceCreateBlockedEffective || managedCreateBlocked ? (<div className="mx-6 mb-0 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-900 dark:text-rose-100" data-testid="create-group-workspace-blocked">
                        <p className="font-semibold">
                            {workspaceCreateBlockedEffective
                                ? t(workspaceTrustUserMessageKey)
                                : t(managedCreateBlockedMessageKey, {
                                    label: relayBaselineLabel,
                                    summary: relayBaselineSummary,
                                })}
                        </p>
                        <p className="mt-1 text-xs opacity-90">
                            {workspaceCreateBlockedEffective
                                ? t(workspaceTrustSettingsHintKey)
                                : t(`groups.managedWorkspaceGate.${managedCreateGate.reasonCode}.settingsHint`)}
                        </p>
                        {coordinationUnreachable ? (<p className="mt-2 text-xs opacity-90">
                                {t("groups.create.coordinationStartHint")}
                            </p>) : null}
                    </div>) : null}

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-zinc-100 dark:border-[#1a1a1c] bg-zinc-50/50 dark:bg-[#0f0f11]/50 shrink-0">
                    <Button variant="ghost" onClick={onClose} disabled={isCreating}>
                        {t("common.cancel")}
                    </Button>
                    <Button type="button" aria-busy={isCreateBusy} onClick={() => {
            if (isCreateBusy) {
                return;
            }
            onCreate({
                ...info,
                communityMode: "managed_workspace",
                relayCapabilityTier: relayAssessment.tier,
            });
        }} disabled={!isValid || managedCreateBlocked || workspaceCreateBlockedEffective} className={cn("min-w-[10.5rem] relative overflow-hidden", isCreateBusy && "!opacity-100 cursor-wait pointer-events-none !transform-none")}>
                        {isCreateBusy ? (<span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0 animate-pulse"/>) : null}
                        {isCreateBusy ? (<ActionButtonSpinner className="relative z-[1] border-white/35 border-t-white text-white"/>) : null}
                        <span className="relative z-[1]">
                            {isCreating ? creatingActionLabel : isUploading ? t("groups.uploadingAvatar") : createActionLabel}
                        </span>
                    </Button>
                </div>
            </div>
        </div>);
}
