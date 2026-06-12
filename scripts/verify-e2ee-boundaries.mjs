#!/usr/bin/env node
/**
 * SEC-V1 — E2EE boundary audit (grep + structural checks).
 * Ensures DM/group wire publish uses pre-encrypted events and trust paths stay local.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const WIRE_PUBLISH_OWNER_PATHS = [
  "apps/pwa/app/features/messaging/controllers/outgoing-dm-publisher.ts",
  "apps/pwa/app/features/messaging/controllers/v2/dm-send-pipeline.ts",
  "apps/pwa/app/features/messaging/controllers/v2/dm-relay-transport.ts",
  "apps/pwa/app/features/messaging/services/publish-dm-nostr-event.ts",
  "apps/pwa/app/features/groups/services/community-team-relay-transport.ts",
  "apps/pwa/app/features/groups/services/sealed-community-relay-scope.ts",
  "apps/pwa/app/features/groups/services/sealed-community-relay-publish-retry.ts",
  "apps/pwa/app/features/groups/services/community-leave-outbox-retry.ts",
  "apps/pwa/app/features/groups/services/community-leave-proof-service.ts",
  "apps/pwa/app/features/main-shell/hooks/use-chat-actions.ts",
];

const ENCRYPT_BEFORE_PUBLISH_PATHS = [
  {
    relativePath: "apps/pwa/app/features/messaging/controllers/dm-event-builder.ts",
    requiredPatterns: [/encryptGiftWrap/, /encryptDM/],
  },
  {
    relativePath: "apps/pwa/app/features/messaging/controllers/v2/dm-send-pipeline.ts",
    requiredPatterns: [/encryptGiftWrap/],
  },
  {
    relativePath: "apps/pwa/app/features/groups/services/group-service.ts",
    requiredPatterns: [/encryptGroupMessage/],
  },
];

const RECIPIENT_LOCAL_TRUST_PATHS = [
  "apps/pwa/app/features/dm-kernel/dm-kernel-trust-assessment-port.ts",
  "apps/pwa/app/features/dm-kernel/dm-kernel-trust-thread-state.ts",
  "apps/pwa/app/features/dm-kernel/dm-kernel-trust-peer-state.ts",
  "apps/pwa/app/features/dm-kernel/dm-kernel-trust-spam-signals.ts",
];

const ANALYTICS_SCAN_ROOTS = [
  "apps/pwa/app/features/messaging",
  "apps/pwa/app/features/dm-kernel",
  "apps/pwa/app/features/crypto",
  "apps/pwa/app/features/groups/services",
];

const ANALYTICS_FORBIDDEN_PATTERNS = [
  /segment\.(?:io|com)/i,
  /sentry\.io/i,
  /amplitude\.com/i,
  /mixpanel\.com/i,
  /posthog\.com/i,
  /googletagmanager\.com/i,
  /google-analytics\.com/i,
  /fullstory\.com/i,
  /heap\.io/i,
  /datadoghq\.com/i,
  /bugsnag\.com/i,
];

const LOG_CONTEXT_FORBIDDEN_KEYS = [
  "plaintext",
  "messageBody",
  "messageContent",
  "decryptedContent",
  "decryptedBody",
];

const IGNORE_SUFFIXES = [".test.ts", ".test.tsx", ".test.mjs", "/__tests__/"];

const ALLOWED_EVENT_WIRE_LINE = /JSON\.stringify\(\["EVENT",\s*(?:params\.)?(?:message\.)?(?:build\.)?(?:builtAck\.)?(?:signedEvent|event|createdEvent|hideEvent|nip29Join|sealedJoin)\b/;

const normalizePath = (relativePath) => relativePath.replace(/\\/g, "/");

const readRepoFile = async (relativePath) => readFile(path.join(repoRoot, relativePath), "utf8");

const walkTsFiles = async (dirRelative, base = "") => {
  const dirAbs = path.join(repoRoot, dirRelative);
  const entries = await readdir(dirAbs, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = base ? `${base}/${entry.name}` : entry.name;
    const normalized = normalizePath(`${dirRelative}/${relative}`.replace(`${dirRelative}/`, dirRelative.endsWith("/") ? "" : `${dirRelative.split("/").pop()}/`));
    const fullRelative = normalizePath(path.join(dirRelative, relative).replace(repoRoot, "").replace(/^\//, ""));
    if (entry.isDirectory()) {
      files.push(...await walkTsFiles(path.join(dirRelative, entry.name), relative));
      continue;
    }
    if (!/\.(ts|tsx|mjs)$/.test(entry.name)) {
      continue;
    }
    const rel = normalizePath(path.join(dirRelative, entry.name));
    if (IGNORE_SUFFIXES.some((suffix) => rel.includes(suffix))) {
      continue;
    }
    files.push(rel);
  }
  return files;
};

const auditWirePublishOwners = async () => {
  const violations = [];
  for (const relativePath of WIRE_PUBLISH_OWNER_PATHS) {
    const source = await readRepoFile(relativePath);
    const lines = source.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line.includes('JSON.stringify(["EVENT"')) {
        continue;
      }
      if (!ALLOWED_EVENT_WIRE_LINE.test(line)) {
        violations.push(`${relativePath}:${index + 1} wire publish must reference pre-signed encrypted event`);
      }
    }
  }
  return violations;
};

const auditEncryptBeforePublish = async () => {
  const violations = [];
  for (const entry of ENCRYPT_BEFORE_PUBLISH_PATHS) {
    const source = await readRepoFile(entry.relativePath);
    for (const pattern of entry.requiredPatterns) {
      if (!pattern.test(source)) {
        violations.push(`${entry.relativePath} missing required encrypt path ${pattern}`);
      }
    }
  }
  return violations;
};

const auditRecipientLocalTrust = async () => {
  const violations = [];
  for (const relativePath of RECIPIENT_LOCAL_TRUST_PATHS) {
    const source = await readRepoFile(relativePath);
    if (/fetch\s*\(/.test(source)) {
      violations.push(`${relativePath} must not fetch trust scores over the network`);
    }
    if (/XMLHttpRequest/.test(source)) {
      violations.push(`${relativePath} must not use XMLHttpRequest for trust scoring`);
    }
    if (/navigator\.sendBeacon/.test(source)) {
      violations.push(`${relativePath} must not beacon trust scores`);
    }
  }
  return violations;
};

const auditAnalyticsImports = async () => {
  const violations = [];
  for (const root of ANALYTICS_SCAN_ROOTS) {
    const files = await walkTsFiles(root);
    for (const relativePath of files) {
      const source = await readRepoFile(relativePath);
      for (const pattern of ANALYTICS_FORBIDDEN_PATTERNS) {
        if (pattern.test(source)) {
          violations.push(`${relativePath} matches forbidden analytics pattern ${pattern}`);
        }
      }
    }
  }
  return violations;
};

const auditLogAppEventContext = async () => {
  const violations = [];
  const roots = [
    "apps/pwa/app/features/messaging/controllers",
    "apps/pwa/app/features/main-shell/hooks",
    "apps/pwa/app/features/dm-kernel",
  ];
  for (const root of roots) {
    const files = await walkTsFiles(root);
    for (const relativePath of files) {
      const source = await readRepoFile(relativePath);
      const blocks = source.match(/logAppEvent\(\{[\s\S]*?\}\);/g) ?? [];
      for (const block of blocks) {
        for (const key of LOG_CONTEXT_FORBIDDEN_KEYS) {
          const pattern = new RegExp(`context:\\s*\\{[\\s\\S]*\\b${key}\\s*:`, "i");
          if (pattern.test(block)) {
            violations.push(`${relativePath} logAppEvent context must not include ${key}`);
          }
        }
      }
    }
  }
  return violations;
};

const auditLogAppEventTransport = async () => {
  const source = await readRepoFile("apps/pwa/app/shared/log-app-event.ts");
  const violations = [];
  if (/fetch\s*\(/.test(source)) {
    violations.push("log-app-event.ts must not upload events over fetch");
  }
  if (/navigator\.sendBeacon/.test(source)) {
    violations.push("log-app-event.ts must not upload events via sendBeacon");
  }
  return violations;
};

const main = async () => {
  const sections = [
    ["wire publish owners", auditWirePublishOwners],
    ["encrypt-before-publish owners", auditEncryptBeforePublish],
    ["recipient-local trust modules", auditRecipientLocalTrust],
    ["analytics vendor patterns", auditAnalyticsImports],
    ["logAppEvent sensitive context keys", auditLogAppEventContext],
    ["logAppEvent transport", auditLogAppEventTransport],
  ];

  const allViolations = [];
  for (const [label, audit] of sections) {
    const violations = await audit();
    if (violations.length > 0) {
      console.error(`\n[verify-e2ee-boundaries] ${label}:`);
      for (const violation of violations) {
        console.error(`  - ${violation}`);
      }
      allViolations.push(...violations);
    }
  }

  if (allViolations.length > 0) {
    console.error(`\n[verify-e2ee-boundaries] FAILED with ${allViolations.length} violation(s).`);
    process.exitCode = 1;
    return;
  }

  console.log("[verify-e2ee-boundaries] PASS — E2EE wire paths and no vendor upload patterns.");
};

void main();
