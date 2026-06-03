#!/usr/bin/env node
/**
 * N5 — Split monolithic settings-tab-panel-model into loadable chunks:
 * - settings-tab-panel-shared.tsx (UI + formatters)
 * - settings-tab-panel-model-context.tsx (context hook only)
 * - settings-tab-panel-model-provider.tsx (heavy provider — lazy loaded)
 * - settings-tab-panel-model.ts (barrel for shared + context only)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const settingsDir = path.join(repoRoot, "apps/pwa/app/settings");
const sourcePath = path.join(settingsDir, "settings-tab-panel-model.tsx");
const lines = fs.readFileSync(sourcePath, "utf8").split(/\r?\n/);

const providerHeaderEnd = lines.findIndex((line) => line.startsWith("const APP_VERSION:"));
const sharedStart = providerHeaderEnd;
const contextImportLine = lines.findIndex((line) => line.includes("import { createContext, useContext"));
const sharedEnd = contextImportLine - 1;
const providerStart = lines.findIndex((line) => line.startsWith("export function SettingsTabPanelModelProvider"));
const providerImports = lines.slice(0, sharedStart).join("\n");
const sharedBody = lines.slice(sharedStart, sharedEnd + 1).join("\n");
const contextBlock = lines.slice(contextImportLine, providerStart).join("\n");
const providerBody = lines.slice(providerStart).join("\n");

const sharedImports = `"use client";

import type React from "react";
import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/app/lib/utils";
import { Label } from "@dweb/ui-kit";
import { useMobileCompactLayout } from "@/app/features/runtime/use-mobile-compact-layout";
import type { TextScale } from "@/app/features/settings/hooks/use-accessibility-preferences";
import type { ProfilePublishPhase } from "@/app/features/profile/hooks/use-profile-publisher";
import { SettingsActionStatus, type SettingsActionPhase } from "@/app/features/settings/components/settings-action-status";
import { nip19 } from "nostr-tools";
import { getLocalMediaIndexSnapshot } from "@/app/features/vault/services/local-media-store";
import {
  INVITE_CODE_PREFIX,
  INVITE_CODE_SUFFIX_LENGTH,
  buildInviteCodeFromSuffix,
  extractInviteCodeSuffix,
  generateRandomInviteCode,
  isCanonicalInviteCode,
  normalizeInviteCodeSuffixInput,
} from "@/app/features/invites/utils/invite-code-format";
import { isSupportedPublicUrl, normalizePublicUrl } from "@/app/shared/public-url";
`;

const sharedFile = `${sharedImports}

${sharedBody}
`;

const contextFile = `"use client";

${contextBlock}
`;

const providerFile = `"use client";

${providerImports}
import { SettingsTabPanelModelContext, type SettingsTabPanelModel } from "./settings-tab-panel-model-context";
import {
  SettingsToggle,
  SettingsToggleCard,
  toSettingsActionPhase,
  validateProfileInput,
  formatBytes,
  formatRatioPercent,
} from "./settings-tab-panel-shared";

${providerBody.replace(
  "SettingsTabPanelModelContext",
  "SettingsTabPanelModelContext",
)}
`;

const barrelFile = `"use client";

export * from "./settings-tab-panel-shared";
export * from "./settings-tab-panel-model-context";
`;

fs.writeFileSync(path.join(settingsDir, "settings-tab-panel-shared.tsx"), sharedFile);
fs.writeFileSync(path.join(settingsDir, "settings-tab-panel-model-context.tsx"), contextFile);
fs.writeFileSync(path.join(settingsDir, "settings-tab-panel-model-provider.tsx"), providerFile);
fs.writeFileSync(path.join(settingsDir, "settings-tab-panel-model.ts"), barrelFile);

console.log("Split settings model:", {
  sharedLines: sharedFile.split("\n").length,
  contextLines: contextFile.split("\n").length,
  providerLines: providerFile.split("\n").length,
});
