import { toast } from "@dweb/ui-kit";
import { GROUP_MESSAGING_STUB_MESSAGE } from "@/app/features/groups/services/group-messaging-stub-policy";
import { isDevLabEnabled, DEV_LAB_VERSION } from "./dev-lab-policy";
import { probeDevLabShellHealth, type DevLabShellHealth } from "./dev-lab-shell-health";
import type { DevLabAccountId } from "./dev-lab-accounts";
import { listDevLabScenarios } from "./dev-lab-scenario-catalog";
import {
  postNativeGateReport,
  runDevLabNativeGate,
} from "./dev-lab-native-gate";
import { runDevLabBenchmark, runDevLabScenario } from "./dev-lab-scenario-runner";
import type { DevLabBenchmarkReport, DevLabScenarioResult, DevLabSuiteId } from "./dev-lab-types";
import { runJoinerMembershipRepairProbe, type DevLabJoinerMembershipProbeResult } from "./dev-lab-joiner-membership-probe";
import { delay, runNavigationMatrixSteps } from "./dev-lab-scenario-steps";

export type DevLabAuthStatus = Readonly<{
  identityStatus: string;
  runtimePhase: string;
  profileId: string;
}>;

export type DevLabSyntheticDmResult = Readonly<{
  success: boolean;
  deliveryStatus: string;
  messageId: string;
  error: string | null;
}>;

export type DevLabMessageSnapshot = Readonly<{
  id: string;
  content: string;
  isOutgoing: boolean;
  status: string;
}>;

export type DevLabGroupStubProbeResult = Readonly<{
  success: boolean;
  message: string;
}>;

export type DevLabJoinerMembershipRepairProbeResult = DevLabJoinerMembershipProbeResult;

type DevLabAuthHandlers = Readonly<{
  unlockAccount: (accountId?: DevLabAccountId) => Promise<void>;
  getAuthStatus: () => DevLabAuthStatus;
}>;

type DevLabMessagingHandlers = Readonly<{
  sendSyntheticDm: (params: Readonly<{ peerPublicKeyHex: string; text: string }>) => Promise<DevLabSyntheticDmResult>;
  getMessagesForPeer: (peerPublicKeyHex: string) => ReadonlyArray<DevLabMessageSnapshot>;
  getSqliteMessagesForPeer?: (peerPublicKeyHex: string) => Promise<ReadonlyArray<DevLabMessageSnapshot>>;
  scanOneSidedNativeDmConversations?: () => Promise<ReadonlyArray<Readonly<{
    conversationId: string;
    peerPublicKeyHex: string;
    missingDirection: "incoming" | "outgoing";
    outgoing: number;
    incoming: number;
    total: number;
  }>>>;
  requestNativeDmRelayBackfillRepair?: () => Promise<boolean>;
  forceNativeDmRelayBackfillSync?: () => Promise<boolean>;
  probeNativeDmSqliteWrite?: () => Promise<Readonly<{
    ok: boolean;
    reason: string;
    errorMessage: string | null;
  }>>;
  triggerMissedMessageSync?: () => Promise<void>;
  getControllerStatus: () => string;
  getMyPublicKeyHex: () => string | null;
}>;

export type DevLabApi = Readonly<{
  version: string;
  listScenarios: typeof listDevLabScenarios;
  probeShellHealth: () => DevLabShellHealth;
  unlock: (accountId?: DevLabAccountId) => Promise<void>;
  getAuthStatus: () => DevLabAuthStatus | null;
  getMessagingStatus: () => string | null;
  sendSyntheticDm: (params: Readonly<{ peerPublicKeyHex: string; text: string }>) => Promise<DevLabSyntheticDmResult>;
  getMessagesForPeer: (peerPublicKeyHex: string) => ReadonlyArray<DevLabMessageSnapshot>;
  getSqliteMessagesForPeer?: (peerPublicKeyHex: string) => Promise<ReadonlyArray<DevLabMessageSnapshot>>;
  scanOneSidedNativeDmConversations?: () => Promise<ReadonlyArray<Readonly<{
    conversationId: string;
    peerPublicKeyHex: string;
    missingDirection: "incoming" | "outgoing";
    outgoing: number;
    incoming: number;
    total: number;
  }>>>;
  requestNativeDmRelayBackfillRepair?: () => Promise<boolean>;
  forceNativeDmRelayBackfillSync?: () => Promise<boolean>;
  probeNativeDmSqliteWrite?: () => Promise<Readonly<{
    ok: boolean;
    reason: string;
    errorMessage: string | null;
  }>>;
  triggerMissedMessageSync?: () => Promise<void>;
  probeGroupSendStub: () => Promise<DevLabGroupStubProbeResult>;
  probeJoinerMembershipRepair: () => DevLabJoinerMembershipRepairProbeResult;
  runScenario: (scenarioId: string) => Promise<DevLabScenarioResult>;
  runBenchmark: (options?: Readonly<{
    suite?: DevLabSuiteId | string;
    scenarioIds?: ReadonlyArray<string>;
    skipUnlock?: boolean;
  }>) => Promise<DevLabBenchmarkReport>;
  runNavigationSoak: () => Promise<ReadonlyArray<Readonly<{ route: string; healthy: boolean; issues: ReadonlyArray<string> }>>>;
  captureBundle: (eventWindowSize?: number) => Readonly<{
    shellHealth: DevLabShellHealth;
    m0: unknown | null;
    digest: unknown | null;
  }>;
  runNativeGate: (options?: Readonly<{ listenerUrl?: string }>) => Promise<unknown>;
  postNativeGateReport: typeof postNativeGateReport;
}>;

declare global {
  interface Window {
    obscurDevLab?: DevLabApi;
  }
}

let authHandlers: DevLabAuthHandlers | null = null;
let messagingHandlers: DevLabMessagingHandlers | null = null;

export const registerDevLabAuthHandlers = (handlers: DevLabAuthHandlers | null): void => {
  authHandlers = handlers;
};

export const registerDevLabMessagingHandlers = (handlers: DevLabMessagingHandlers | null): void => {
  messagingHandlers = handlers;
};

const parseRouteFromNavStepId = (stepId: string): string => {
  const raw = stepId.replace(/^nav_/, "").replace(/_/g, "/");
  if (raw === "home" || raw.length === 0) {
    return "/";
  }
  return raw.startsWith("/") ? raw : `/${raw}`;
};

const runNavigationSoak = async (): Promise<ReadonlyArray<Readonly<{
  route: string;
  healthy: boolean;
  issues: ReadonlyArray<string>;
}>>> => {
  const steps = await runNavigationMatrixSteps();
  return steps.map((entry) => ({
    route: parseRouteFromNavStepId(entry.id),
    healthy: entry.passed,
    issues: entry.passed ? [] : [entry.message],
  }));
};

const captureBundle = (eventWindowSize = 300): Readonly<{
  shellHealth: DevLabShellHealth;
  m0: unknown | null;
  digest: unknown | null;
}> => {
  const shellHealth = probeDevLabShellHealth();
  const m0 = typeof window.obscurM0Triage?.capture === "function"
    ? window.obscurM0Triage.capture(eventWindowSize)
    : null;
  const digest = typeof window.obscurAppEvents?.getCrossDeviceSyncDigest === "function"
    ? window.obscurAppEvents.getCrossDeviceSyncDigest(400)
    : null;
  return { shellHealth, m0, digest };
};

export const installDevLab = (): void => {
  if (typeof window === "undefined" || !isDevLabEnabled()) {
    return;
  }
  if (window.obscurDevLab) {
    return;
  }

  const unlock = async (accountId: DevLabAccountId = "tester1"): Promise<void> => {
    if (!authHandlers) {
      throw new Error("Dev Lab auth bridge not ready — wait for AuthGateway mount.");
    }
    await authHandlers.unlockAccount(accountId);
  };

  window.obscurDevLab = {
    version: DEV_LAB_VERSION,
    listScenarios: listDevLabScenarios,
    probeShellHealth: probeDevLabShellHealth,
    unlock,
    getAuthStatus: () => authHandlers?.getAuthStatus() ?? null,
    getMessagingStatus: () => messagingHandlers?.getControllerStatus() ?? null,
    sendSyntheticDm: async (params) => {
      if (!messagingHandlers) {
        throw new Error("Dev Lab messaging bridge not ready — unlock shell first.");
      }
      return messagingHandlers.sendSyntheticDm(params);
    },
    getMessagesForPeer: (peerPublicKeyHex) => (
      messagingHandlers?.getMessagesForPeer(peerPublicKeyHex) ?? []
    ),
    getSqliteMessagesForPeer: async (peerPublicKeyHex) => {
      if (!messagingHandlers?.getSqliteMessagesForPeer) {
        return [];
      }
      return messagingHandlers.getSqliteMessagesForPeer(peerPublicKeyHex);
    },
    scanOneSidedNativeDmConversations: async () => {
      if (!messagingHandlers?.scanOneSidedNativeDmConversations) {
        return [];
      }
      return messagingHandlers.scanOneSidedNativeDmConversations();
    },
    requestNativeDmRelayBackfillRepair: async () => {
      if (!messagingHandlers?.requestNativeDmRelayBackfillRepair) {
        return false;
      }
      return messagingHandlers.requestNativeDmRelayBackfillRepair();
    },
    forceNativeDmRelayBackfillSync: async () => {
      if (!messagingHandlers?.forceNativeDmRelayBackfillSync) {
        return false;
      }
      return messagingHandlers.forceNativeDmRelayBackfillSync();
    },
    probeNativeDmSqliteWrite: async () => {
      if (!messagingHandlers?.probeNativeDmSqliteWrite) {
        return {
          ok: false,
          reason: "probe_unavailable",
          errorMessage: "Dev Lab messaging bridge not ready — reload after unlock.",
        };
      }
      return messagingHandlers.probeNativeDmSqliteWrite();
    },
    triggerMissedMessageSync: async () => {
      if (!messagingHandlers?.triggerMissedMessageSync) {
        throw new Error("Dev Lab messaging bridge not ready — unlock shell first.");
      }
      await messagingHandlers.triggerMissedMessageSync();
    },
    probeGroupSendStub: async () => {
      toast.info(GROUP_MESSAGING_STUB_MESSAGE);
      return {
        success: true,
        message: GROUP_MESSAGING_STUB_MESSAGE,
      };
    },
    probeJoinerMembershipRepair: () => {
      const publicKeyHex = messagingHandlers?.getMyPublicKeyHex() ?? "";
      return runJoinerMembershipRepairProbe({
        publicKeyHex: publicKeyHex as import("@dweb/crypto/public-key-hex").PublicKeyHex,
      });
    },
    runScenario: async (scenarioId) => runDevLabScenario(scenarioId, { unlock, delay }),
    runBenchmark: async (options) => runDevLabBenchmark(unlock, {
      ...options,
      surface: "in-app",
      baseUrl: window.location.origin,
    }),
    runNavigationSoak,
    captureBundle,
    runNativeGate: async (options) => runDevLabNativeGate(unlock, options),
    postNativeGateReport,
  };

  console.info(
    "[DevLab] Installed as window.obscurDevLab — runBenchmark({ suite: 'core' }) or runNativeGate() for native gate",
  );
};
