import type { DevLabScenarioDefinition, DevLabSuiteId } from "./dev-lab-types";
import {
  runChatsChromeStep,
  runColdReloadStep,
  runDigestGateStep,
  runDigestMembershipGateStep,
  runDmReloadHistorySeedSteps,
  runDmHistoryMonotonicSteps,
  runDmSendSyntheticSteps,
  runGroupStubSendSteps,
  runM0ApisStep,
  runNavigationMatrixSteps,
  runNetworkChromeStep,
  runRelayToggleStressSteps,
  runRuntimeIssuesStep,
  runSearchProfileJumpSteps,
  runSettingsTabSweepSteps,
  runShellHealthStep,
  runUnlockAndShellStep,
  runVaultChromeStep,
  runMembershipLeaveRejoinZombieSteps,
  runSecBotKeywordFloodSteps,
  runTrustFixturesSteps,
  runTrustColdDmBannerSteps,
  runAuth4ScopeProbeSteps,
} from "./dev-lab-scenario-steps";
import { DEV_LAB_SUITE_MANIFEST } from "./dev-lab-suite-manifest";

export const DEV_LAB_SCENARIOS: ReadonlyArray<DevLabScenarioDefinition> = [
  {
    id: "auth-unlock",
    name: "Auth unlock + shell",
    category: "auth",
    tags: ["core", "smoke"],
    run: async (ctx) => runUnlockAndShellStep(() => ctx.unlock("tester1")),
  },
  {
    id: "shell-health",
    name: "Shell health probe",
    category: "shell",
    tags: ["core", "smoke"],
    run: async () => [await runShellHealthStep()],
  },
  {
    id: "nav-matrix",
    name: "Main navigation matrix",
    category: "navigation",
    tags: ["core"],
    run: async () => runNavigationMatrixSteps(),
  },
  {
    id: "settings-tab-sweep",
    name: "Settings tab sweep (all tabs)",
    category: "settings",
    tags: ["core"],
    run: async () => runSettingsTabSweepSteps(),
  },
  {
    id: "relay-toggle-stress",
    name: "Relay settings toggle stress",
    category: "settings",
    tags: ["core"],
    run: async () => runRelayToggleStressSteps(),
  },
  {
    id: "dm-send-synthetic",
    name: "Synthetic outgoing DM + digest",
    category: "messaging",
    tags: ["core"],
    run: async () => runDmSendSyntheticSteps(),
  },
  {
    id: "dm-history-monotonic",
    name: "DM history monotonic after route change",
    category: "messaging",
    tags: ["core"],
    run: async () => runDmHistoryMonotonicSteps(),
  },
  {
    id: "dm-reload-history",
    name: "DM thread history survives reload",
    category: "messaging",
    tags: ["core", "cli-assisted"],
    run: async () => runDmReloadHistorySeedSteps(),
  },
  {
    id: "two-actor-dm",
    name: "Tester2 → Tester1 DM (CLI dual browser)",
    category: "messaging",
    tags: ["full", "cli-only"],
    run: async () => [{
      id: "cli_only",
      passed: false,
      message: "two-actor-dm runs via pnpm dev:lab:run -- --scenario two-actor-dm",
      durationMs: 0,
    }],
  },
  {
    id: "membership-join-leave",
    name: "Membership join/leave truth probes (CLI dual browser)",
    category: "network",
    tags: ["full", "cli-only"],
    run: async () => [{
      id: "cli_only",
      passed: false,
      message: "membership-join-leave runs via pnpm dev:lab:run -- --scenario membership-join-leave",
      durationMs: 0,
    }],
  },
  {
    id: "dm-native-persist",
    name: "Native DM history survives reload (CDP)",
    category: "messaging",
    tags: ["full", "cli-only", "cdp"],
    run: async () => [{
      id: "cli_only",
      passed: false,
      message: "dm-native-persist runs via pnpm dev:lab:run -- --cdp URL --scenario dm-native-persist",
      durationMs: 0,
    }],
  },
  {
    id: "dm-native-relay-backfill",
    name: "Native DM relay backfill repair (CDP)",
    category: "messaging",
    tags: ["full", "cli-only", "cdp"],
    run: async () => [{
      id: "cli_only",
      passed: false,
      message: "dm-native-relay-backfill runs via pnpm dev:lab:run -- --cdp URL --scenario dm-native-relay-backfill",
      durationMs: 0,
    }],
  },
  {
    id: "chats-chrome",
    name: "Chats route chrome",
    category: "messaging",
    tags: ["core"],
    run: async () => [await runChatsChromeStep()],
  },
  {
    id: "network-chrome",
    name: "Network route chrome",
    category: "network",
    tags: ["core"],
    run: async () => [await runNetworkChromeStep()],
  },
  {
    id: "runtime-m0-apis",
    name: "M0 triage required APIs",
    category: "runtime",
    tags: ["core"],
    run: async () => [await runM0ApisStep()],
  },
  {
    id: "runtime-digest-gates",
    name: "Cross-device digest gates",
    category: "runtime",
    tags: ["core"],
    run: async () => [await runDigestGateStep()],
  },
  {
    id: "digest-membership-gates",
    name: "Membership digest gates",
    category: "runtime",
    tags: ["core"],
    run: async () => [await runDigestMembershipGateStep()],
  },
  {
    id: "runtime-issues-clean",
    name: "Dev runtime issues (no errors)",
    category: "runtime",
    tags: ["full"],
    run: async () => [await runRuntimeIssuesStep()],
  },
  {
    id: "cold-reload",
    name: "Cold reload shell health",
    category: "shell",
    tags: ["core", "terminal"],
    run: async () => [await runColdReloadStep()],
  },
  {
    id: "search-profile-jump",
    name: "Search → profile view",
    category: "navigation",
    tags: ["full"],
    run: async () => runSearchProfileJumpSteps(),
  },
  {
    id: "group-stub-send",
    name: "Group send stub (toast, no crash)",
    category: "messaging",
    tags: ["full"],
    run: async () => runGroupStubSendSteps(),
  },
  {
    id: "vault-unlock",
    name: "Vault route health",
    category: "auth",
    tags: ["full"],
    run: async () => [await runVaultChromeStep()],
  },
  {
    id: "membership-leave-rejoin-zombie",
    name: "Membership leave zombie repair gates",
    category: "network",
    tags: ["full", "security"],
    run: async () => runMembershipLeaveRejoinZombieSteps(),
  },
  {
    id: "sec-bot-keyword-flood",
    name: "SEC-B BOT-1 keyword flood + allowlist",
    category: "security",
    tags: ["full", "security"],
    run: async () => runSecBotKeywordFloodSteps(),
  },
  {
    id: "trust-fixtures",
    name: "TRUST-1..3 synthetic assessment fixtures",
    category: "security",
    tags: ["full", "security"],
    run: async () => runTrustFixturesSteps(),
  },
  {
    id: "trust-cold-dm-banner",
    name: "TRUST-1 cold stranger DM + recipient banner (in-app)",
    category: "security",
    tags: ["full", "security"],
    run: async () => runTrustColdDmBannerSteps(),
  },
  {
    id: "sec-bot-inbound-live",
    name: "SEC-B BOT-1 live inbound runner + flood (CLI)",
    category: "security",
    tags: ["full", "cli-only", "security"],
    run: async () => [{
      id: "cli_only",
      passed: false,
      message: "sec-bot-inbound-live runs via pnpm dev:lab:run -- --scenario sec-bot-inbound-live",
      durationMs: 0,
    }],
  },
  {
    id: "trust-live",
    name: "TRUST-1 live cold financial banner (CLI dual browser)",
    category: "security",
    tags: ["full", "cli-only", "security"],
    run: async () => [{
      id: "cli_only",
      passed: false,
      message: "trust-live runs via pnpm dev:lab:run -- --scenario trust-live",
      durationMs: 0,
    }],
  },
  {
    id: "auth4-scope-probe",
    name: "AUTH-4 profile scope isolation probe",
    category: "auth",
    tags: ["full", "security"],
    run: async () => runAuth4ScopeProbeSteps(),
  },
  {
    id: "auth4-scope-probe-live",
    name: "AUTH-4 profile scope isolation (CLI dual browser)",
    category: "auth",
    tags: ["full", "cli-only", "security"],
    run: async () => [{
      id: "cli_only",
      passed: false,
      message: "auth4-scope-probe-live runs via pnpm dev:lab:run -- --scenario auth4-scope-probe-live",
      durationMs: 0,
    }],
  },
  {
    id: "membership-leave-rejoin-live",
    name: "Membership leave/rejoin live stability (CLI dual browser)",
    category: "network",
    tags: ["full", "cli-only", "security"],
    run: async () => [{
      id: "cli_only",
      passed: false,
      message: "membership-leave-rejoin-live runs via pnpm dev:lab:run -- --scenario membership-leave-rejoin-live",
      durationMs: 0,
    }],
  },
];

export const DEV_LAB_SUITE_SCENARIOS = DEV_LAB_SUITE_MANIFEST.suites;

export const resolveDevLabScenario = (id: string): DevLabScenarioDefinition | null => (
  DEV_LAB_SCENARIOS.find((scenario) => scenario.id === id) ?? null
);

export const resolveDevLabSuiteScenarioIds = (
  suite: DevLabSuiteId,
  options?: Readonly<{ includeTerminal?: boolean }>,
): ReadonlyArray<string> => {
  const ids = DEV_LAB_SUITE_SCENARIOS[suite] ?? DEV_LAB_SUITE_SCENARIOS.core;
  if (options?.includeTerminal === false) {
    return ids.filter((id) => {
      const scenario = resolveDevLabScenario(id);
      return !scenario?.tags.includes("terminal");
    });
  }
  return ids;
};

export const listDevLabScenarios = (): ReadonlyArray<Readonly<{
  id: string;
  name: string;
  category: string;
  tags: ReadonlyArray<string>;
}>> => DEV_LAB_SCENARIOS.map(({ id, name, category, tags }) => ({
  id,
  name,
  category,
  tags,
}));
