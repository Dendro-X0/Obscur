#!/usr/bin/env node
/**
 * CI import guard mirroring `apps/pwa/eslint.config.mjs` R0/R1/R2 restricted paths.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const featuresRoot = path.join(repoRoot, "apps/pwa/app/features");

/** module path fragment → forbidden named imports (same as ESLint no-restricted-imports) */
const RULES = [
  { module: "default-storage-ports", names: ["getResolvedStoragePorts"] },
  { module: "local-dm-visibility", names: ["localDmVisibilityOwner"] },
  { module: "dm-thread-suppression-prepare", names: ["prepareDmThreadSuppressionIds"] },
  { module: "dm-conversation-hydrate-pipeline", names: ["runDmConversationHydrateReadModelPipeline", "logDmHydrateReadModelTelemetry"] },
  { module: "conversation-message-materialization", names: [
    "filterMessagesBySuppressedIds",
    "mergeHydratedBaseWithLiveOverlayMessages",
    "mergeProjectionFirstWithOverlayMessages",
    "selectMessagesForConversationHistoryAuthority",
  ] },
  { module: "dm-conversation-hydrate-read-model", names: ["assembleDmHydrateThreadReadModel"] },
  { module: "dm-conversation-materialization-load-earlier", names: ["loadEarlierDmConversationMessages"] },
  { module: "dm-conversation-materialization-realtime", names: ["applyRealtimeBufferedEvents", "applyBufferedEvents"] },
  { module: "dm-conversation-projection-evidence-messages", names: ["buildProjectionEvidenceMessagesForConversation"] },
  { module: "dm-conversation-projection-live-merge", names: ["mergeProjectionFirstWithLiveOverlayForDisplay"] },
  { module: "community-visible-members", names: [
    "resolveCommunitySeedMemberPubkeysFromDirectory",
    "resolveActiveCommunityMemberPubkeysFromConversation",
    "resolveAuthorEvidencePubkeysFromCommunityMessages",
    "stabilizeCommunityMemberPubkeys",
  ] },
  { module: "community-known-participants-store", names: ["upsertCommunityKnownParticipantsEntry"] },
  { module: "community-member-roster-projection", names: ["resolveCommunityRosterSnapshotNextMembers"] },
  { module: "community-membership-ledger", names: ["upsertCommunityMembershipLedgerEntry"] },
];

const IGNORE_SUFFIXES = [".test.ts", ".test.tsx", "/__tests__/"];

/** Same owner / bootstrap paths as `apps/pwa/eslint.config.mjs` ignores */
const OWNER_RELATIVE_PATHS = new Set([
  "profiles/services/default-storage-ports.ts",
  "profiles/services/resolve-client-gateway.ts",
  "runtime/services/client-gateway-adapter.ts",
  "messaging/local-dm-visibility/local-dm-visibility-owner.ts",
  "messaging/services/dm-conversation-materialization-owner.ts",
  "messaging/services/dm-conversation-materialization-port.ts",
  "messaging/services/dm-conversation-materialization-load-earlier.ts",
  "messaging/services/dm-conversation-hydrate-pipeline.ts",
  "messaging/services/dm-conversation-hydrate-read-model.ts",
  "messaging/services/dm-thread-read-model.ts",
  "messaging/services/dm-conversation-hydrate-sibling-diagnostics.ts",
  "messaging/services/dm-conversation-hydrate-indexed-scan.ts",
  "messaging/services/dm-conversation-hydrate-indexed-map-rows.ts",
  "messaging/services/dm-conversation-projection-evidence-messages.ts",
  "messaging/services/dm-conversation-projection-live-merge.ts",
  "messaging/services/dm-conversation-materialization-realtime.ts",
  "messaging/services/dm-thread-suppression-prepare.ts",
  "messaging/services/conversation-message-materialization.ts",
  "messaging/services/dm-read-authority-contract.ts",
  "messaging/services/messaging-client-operations.ts",
  "messaging/services/dm-conversation-delete-identity-ids.ts",
  "messaging/services/dm-conversation-message-list-equiv.ts",
  "groups/services/community-roster-materialization-owner.ts",
  "groups/services/community-roster-materialization-port.ts",
  "groups/services/community-member-roster-projection.ts",
  "groups/services/community-visible-members.ts",
  "groups/services/community-roster-persistence.ts",
  "groups/services/community-membership-mutation-owner.ts",
  "groups/services/community-membership-ledger.ts",
  "groups/services/community-transport-owner.ts",
  "groups/services/community-membership-semantic-ingress.ts",
  "groups/services/community-membership-port-owner.ts",
  "profiles/providers/profile-runtime-provider.tsx",
]);

const shouldIgnoreFile = (relativePath) => (
  IGNORE_SUFFIXES.some((s) => relativePath.includes(s))
  || OWNER_RELATIVE_PATHS.has(relativePath)
  || relativePath.startsWith("messaging/local-dm-visibility/")
);

const parseNamedImports = (specifierClause) => {
  const names = [];
  const named = /\{([^}]+)\}/.exec(specifierClause);
  if (!named) {
    return names;
  }
  named[1].split(",").forEach((part) => {
    const chunk = part.trim();
    if (!chunk) return;
    const alias = chunk.split(/\s+as\s+/i);
    names.push((alias[1] ?? alias[0]).trim());
  });
  return names;
};

const parseDefaultOrNamespace = (specifierClause) => {
  const trimmed = specifierClause.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("*")) {
    return [];
  }
  const match = /^([\w$]+)/.exec(trimmed);
  return match ? [match[1]] : [];
};

const extractImports = (content) => {
  const imports = [];
  const staticImport = /import\s+(type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  let match = staticImport.exec(content);
  while (match) {
    const clause = match[2].trim();
    const source = match[3];
    const names = [
      ...parseDefaultOrNamespace(clause),
      ...parseNamedImports(clause),
    ];
    imports.push({ source, names });
    match = staticImport.exec(content);
  }
  return imports;
};

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const files = await walk(featuresRoot);
const violations = [];

for (const file of files) {
  const relative = path.relative(featuresRoot, file).replaceAll("\\", "/");
  if (shouldIgnoreFile(relative)) {
    continue;
  }
  const content = await readFile(file, "utf8");
  for (const { source, names } of extractImports(content)) {
    for (const rule of RULES) {
      if (!source.includes(rule.module)) {
        continue;
      }
      for (const imported of names) {
        if (rule.names.includes(imported)) {
          violations.push(`${relative}: imports \`${imported}\` from "${source}"`);
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error("ClientGateway boundary violations:\n");
  for (const line of violations) {
    console.error(`  - ${line}`);
  }
  process.exit(1);
}

console.log(`ClientGateway import boundaries OK (${files.length} feature files scanned).`);
