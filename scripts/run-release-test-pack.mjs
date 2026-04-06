#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const isWin = process.platform === "win32";
const isEnabled = (value) => value === "1" || value === "true";
const hasArg = (flag) => process.argv.includes(flag);

const run = (cmd, args, cwd = rootDir) => {
  const resolvedCommand = isWin && !cmd.toLowerCase().endsWith(".cmd") ? `${cmd}.cmd` : cmd;
  const result = spawnSync(resolvedCommand, args, {
    cwd,
    stdio: "inherit",
    shell: isWin,
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed`);
  }
};

const runPwaTypecheck = () => {
  const pwaCwd = resolve(rootDir, "apps/pwa");
  if (isWin) {
    run(".\\node_modules\\.bin\\tsc.CMD", ["--noEmit", "--pretty", "false"], pwaCwd);
    return;
  }
  run("pnpm", ["-C", "apps/pwa", "exec", "tsc", "--noEmit", "--pretty", "false"]);
};

const runPwaVitest = (tests) => {
  const pwaCwd = resolve(rootDir, "apps/pwa");
  if (isWin) {
    run(".\\node_modules\\.bin\\vitest.CMD", ["run", ...tests], pwaCwd);
    return;
  }
  run("pnpm", ["-C", "apps/pwa", "exec", "vitest", "run", ...tests]);
};

const main = () => {
  console.log("[release:test-pack] Running release source integrity check...");
  run("pnpm", ["release:integrity-check"]);

  console.log("[release:test-pack] Verifying artifact version parity workflow contract...");
  run("pnpm", ["release:artifact-version-contract-check"]);

  console.log("[release:test-pack] Running apps/pwa typecheck...");
  runPwaTypecheck();

  console.log("[release:test-pack] Checking offline UI asset policy...");
  run("pnpm", ["offline:asset-policy:check"]);

  console.log("[release:test-pack] Checking streaming update manifest contract...");
  run("pnpm", ["release:streaming-update-contract:check"]);

  console.log("[release:test-pack] Running focused reliability/runtime/profile/storage/P2P tests...");
  runPwaVitest([
    "app/features/runtime/runtime-capabilities.test.ts",
    "app/features/runtime/native-adapters.test.ts",
    "app/features/runtime/native-event-adapter.test.ts",
    "app/features/runtime/native-host-adapter.test.ts",
    "app/features/runtime/protocol-core-adapter.test.ts",
    "app/features/runtime/protocol-acl-parity.test.ts",
    "app/features/runtime/components/runtime-activation-manager.test.tsx",
    "app/features/runtime/components/runtime-activation-transport-gate.integration.test.tsx",
    "app/components/pwa-service-worker-registrar.test.tsx",
    "app/features/updates/services/streaming-update-policy.test.ts",
    "app/shared/public-url.test.ts",
    "app/lib/notification-service.test.ts",
    "app/lib/background-service.test.ts",
    "app/features/profiles/services/profile-registry-service.test.ts",
    "app/features/profiles/services/profile-migration-service.test.ts",
    "app/features/auth/services/session-api.test.ts",
    "app/features/auth/services/pin-lock-service.test.ts",
    "app/features/crypto/__tests__/crypto-service-runtime-selection.test.ts",
    "app/features/vault/services/native-local-media-adapter.test.ts",
    "app/features/groups/services/group-tombstone-store.test.ts",
    "app/features/invites/utils/__tests__/profile-manager.test.ts",
    "app/features/invites/utils/__tests__/invite-manager.test.ts",
    "app/features/invites/utils/use-invite-resolver.test.ts",
    "app/features/main-shell/hooks/use-invite-redemption.test.ts",
    "app/features/profile/hooks/use-profile.test.ts",
    "app/features/profile/hooks/use-profile-publisher.test.ts",
    "app/features/profile/hooks/use-resolved-profile-metadata.test.ts",
    "app/features/relays/hooks/enhanced-relay-pool.reliability.test.ts",
    "app/features/relays/hooks/create-relay-websocket.test.ts",
    "app/features/relays/hooks/relay-native-adapter.test.ts",
    "app/features/relays/hooks/native-relay.test.ts",
    "app/features/relays/lib/nostr-core-relay.test.ts",
    "app/features/relays/lib/relay-publish-chaos.test.ts",
    "app/features/relays/lib/publish-outcome-mapper.test.ts",
    "app/features/messaging/lib/sync-checkpoints.test.ts",
    "app/features/messaging/lib/offline-queue-manager.test.ts",
    "app/features/messaging/lib/__tests__/message-queue.test.ts",
    "app/features/messaging/lib/nip96-upload-service.test.ts",
    "app/features/messaging/lib/upload-service.test.ts",
    "app/features/messaging/services/storage-health-service.test.ts",
    "app/features/messaging/controllers/dm-subscription-manager.test.ts",
    "app/features/messaging/controllers/incoming-dm-event-handler.test.ts",
    "app/features/messaging/controllers/enhanced-dm-controller.test.ts",
    "app/features/messaging/controllers/outgoing-dm-publisher.test.ts",
    "app/features/relays/hooks/subscription-manager.test.ts",
    "app/features/relays/lib/relay-nip-probe.test.ts",
    "app/features/search/hooks/use-global-search.test.ts",
    "app/features/search/hooks/use-contact-request-outbox.test.ts",
    "app/features/search/hooks/use-contact-request-outbox.chaos.test.ts",
    "app/features/messaging/services/request-flow-evidence-store.test.ts",
    "app/features/messaging/services/messaging-transport-runtime.test.ts",
    "app/features/messaging/services/request-transport-service.test.ts",
    "app/features/messaging/services/request-transport-deterministic.integration.test.ts",
    "app/features/messaging/services/dm-delivery-deterministic.integration.test.ts",
    "app/features/messaging/providers/runtime-messaging-transport-owner-provider.test.tsx",
    "app/features/messaging/hooks/use-requests-inbox.test.ts",
    "app/features/messaging/hooks/use-requests-inbox.integration.test.ts",
    "app/features/account-sync/services/account-event-reducer.test.ts",
    "app/features/account-sync/services/account-projection-selectors.test.ts",
    "app/features/account-sync/services/account-sync-drift-detector.test.ts",
    "app/features/account-sync/services/account-sync-cross-device-deterministic.integration.test.ts",
    "app/features/search/services/contact-card.test.ts",
    "app/features/search/services/friend-code-v2.test.ts",
    "app/features/search/services/friend-code-v3.test.ts",
    "app/features/search/services/identity-resolver.test.ts",
  ]);

  const skipPreflight = hasArg("--skip-preflight") || isEnabled(process.env.RELEASE_TEST_PACK_SKIP_PREFLIGHT);
  if (!skipPreflight) {
    console.log("[release:test-pack] Running release preflight...");
    const allowDirty = isEnabled(process.env.RELEASE_TEST_PACK_ALLOW_DIRTY);
    const configuredTag = process.env.RELEASE_TEST_TAG;
    const rootVersion = JSON.parse(readFileSync(resolve(rootDir, "package.json"), "utf8")).version;
    const preflightScriptArgs = [];
    if (configuredTag) {
      preflightScriptArgs.push("--tag", configuredTag);
    } else if (process.env.CI !== "true") {
      // Local deterministic dry-run preflight should not fail on existing published release tags.
      preflightScriptArgs.push("--tag", `v${rootVersion}-dryrun`);
    }
    if (allowDirty) {
      preflightScriptArgs.push("--allow-dirty", "1");
    }

    const preflightArgs = ["release:preflight"];
    if (preflightScriptArgs.length > 0) {
      preflightArgs.push("--", ...preflightScriptArgs);
    }
    run("pnpm", preflightArgs);
  } else {
    console.log("[release:test-pack] Skipping release preflight (CI mode).");
  }

  console.log("[release:test-pack] Running release artifact matrix workflow assertion...");
  run("pnpm", ["release:artifact-matrix-check"]);

  console.log("[release:test-pack] Passed.");
};

try {
  main();
} catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`[release:test-pack] Failed: ${msg}`);
  process.exit(1);
}
