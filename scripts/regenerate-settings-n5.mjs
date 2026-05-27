#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import { fileURLToPath } from "node:url";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const originalPath = path.join(repoRoot, "apps/pwa/app/settings/_settings-original.tsx");
const original = fs.readFileSync(originalPath, "utf8");
const lines = original.split(/\r?\n/);
const hooksBody = lines.slice(700, 2425).join("\n");

const names = new Set();
for (const line of hooksBody.split("\n")) {
  const constMatch = line.match(/^  const (\w+)/);
  if (constMatch) {
    names.add(constMatch[1]);
  }
  const destructureMatch = line.match(/^  const \{([^}]+)\}/);
  if (destructureMatch) {
    for (const part of destructureMatch[1].split(",")) {
      const token = part.trim();
      if (!token) continue;
      const alias = token.split(":").pop()?.trim().split("=")[0]?.trim();
      if (alias && /^[A-Za-z_][A-Za-z0-9_]*$/.test(alias)) {
        names.add(alias);
      }
    }
  }
  const stateMatch = line.match(/^  const \[(\w+)\s*,\s*(set\w+)\]/);
  if (stateMatch) {
    names.add(stateMatch[1]);
    names.add(stateMatch[2]);
  }
  const fnMatch = line.match(/^  (?:async )?function (\w+)/);
  if (fnMatch) {
    names.add(fnMatch[1]);
  }
  const handlerMatch = line.match(/^  const (\w+) = useCallback/);
  if (handlerMatch) {
    names.add(handlerMatch[1]);
  }
  const memoMatch = line.match(/^  const (\w+) = useMemo/);
  if (memoMatch) {
    names.add(memoMatch[1]);
  }
}
const COMMON_MODEL_KEYS = [
  "t",
  "i18n",
  "activeTab",
  "TEXT_SCALE_OPTIONS",
  "APP_VERSION",
  "DEFAULT_APP_LANGUAGE",
  "DEFAULT_THEME_PREFERENCE",
  "ENABLE_API_HEALTH_PROBE",
  "INVITE_CODE_PREFIX",
  "INVITE_CODE_SUFFIX_LENGTH",
  "DELETE_ACCOUNT_CONFIRM_TEXT",
  "RELAY_PRESETS",
  "DEFAULT_STABLE_PRESET",
  "profilePublishPhase",
  "profilePublishReport",
  "profilePublishError",
  "isPublishing",
  "publishProfile",
  "getProfilePublishReportSnapshot",
  "deriveRelayNodeStatus",
  "deriveRelayRuntimeStatus",
  "purgeLocalMediaCache",
  "checkStorageHealth",
  "runStorageRecovery",
];
for (const key of COMMON_MODEL_KEYS) names.add(key);
const keys = [...names].sort();
fs.writeFileSync(path.join(repoRoot, "apps/pwa/app/settings/_model-return-keys.json"), JSON.stringify(keys, null, 2));

const TAB_INNER = {
  profile: [2429, 2795],
  appearance: [2799, 2939],
  updates: [2943, 2973],
  identity: [2977, 3254],
  notifications: [3258, 3359],
  relays: [3363, 3815],
  blocklist: [3819, 3949],
  privacy: [3954, 4052],
  security: [4057, 4111],
  storage: [4116, 4652],
};

const dialogs = lines.slice(4654, 4697).join("\n");
const COMPONENT_IMPORTS = `import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { TextScale } from "@/app/features/settings/hooks/use-accessibility-preferences";
import { Card, Button, ConfirmDialog, Input, Label, Textarea, toast } from "@dweb/ui-kit";
import { cn } from "@/app/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { RelayDashboard } from "@/app/components/relay-dashboard";
import { AvatarUpload } from "@/app/components/avatar-upload";
import { DesktopUpdater } from "@/app/components/desktop-updater";
import { ThemeToggle } from "@/app/components/theme-toggle";
import { LanguageSelector } from "@/app/components/language-selector";
import { ProfileCompletenessIndicator } from "@/app/features/profile/components/profile-completeness-indicator";
import { RelayReadinessSettingsBanner } from "@/app/features/relays/components/relay-readiness-settings-banner";
import { CommunityMembershipSyncSettingsPanel } from "@/app/features/settings/components/community-membership-sync-settings-panel";
import { TrustSettingsPanel } from "@/app/features/messaging/components/trust-settings-panel";
import { PasswordResetPanel } from "@/app/features/settings/components/password-reset-panel";
import { AutoLockSettingsPanel } from "@/app/features/settings/components/auto-lock-settings-panel";
import { SecuritySettingsPanel } from "@/app/features/settings/components/security-settings-panel";
import { SettingsActionStatus } from "@/app/features/settings/components/settings-action-status";
import { ProfileSwitcherCard } from "@/app/features/profiles/components/profile-switcher-card";
import {
  SettingsToggle,
  SettingsToggleCard,
  toSettingsActionPhase,
  validateProfileInput,
  formatBytes,
  formatRatioPercent,
} from "../settings-tab-panel-model";
import { getApiBaseUrl } from "@/app/features/relays/utils/api-base-url";
import { deriveRelayNodeStatus, deriveRelayRuntimeStatus } from "@/app/features/relays/lib/relay-runtime-status";
import { checkStorageHealth, runStorageRecovery } from "@/app/features/messaging/services/storage-health-service";
import { Loader2, Activity, ShieldAlert, Shield, Lock, Database, Copy, ChevronDown, Plus, ArrowUp, ArrowDown, Eye, EyeOff, Building2, Wifi, RefreshCcw, Check, X } from "lucide-react";
`;

const panelsDir = path.join(repoRoot, "apps/pwa/app/settings/panels");
for (const [tab, [start, end]] of Object.entries(TAB_INNER)) {
  const jsxBody = lines.slice(start - 1, end).join("\n");
  // Each lazy tab panel receives the full model bag; tab JSX is split for parse cost only.
  const used = keys;
  const needsDialogs = ["relays", "security", "storage", "identity"].includes(tab);
  const content = `"use client";

import type React from "react";
${COMPONENT_IMPORTS}
import { useSettingsTabPanelModel } from "../settings-tab-panel-model";

export default function ${tab.charAt(0).toUpperCase() + tab.slice(1)}SettingsTabPanel(): React.JSX.Element {
  const {
    ${used.join(",\n    ")}
  } = useSettingsTabPanelModel() as Record<string, any>;

  return (
    <>
${jsxBody}
${needsDialogs ? dialogs : ""}
    </>
  );
}
`;
  fs.writeFileSync(path.join(panelsDir, `${tab}-settings-tab-panel.tsx`), content);
}

const header = lines.slice(0, 165).join("\n");
const typesAndUtils = lines.slice(166, 526).join("\n");
let modelFile = `${header}

${typesAndUtils}

import { createContext, useContext, type ReactNode } from "react";

export type SettingsTabPanelModel = Record<string, unknown>;

const SettingsTabPanelModelContext = createContext<SettingsTabPanelModel | null>(null);

export function useSettingsTabPanelModel(): SettingsTabPanelModel {
  const model = useContext(SettingsTabPanelModelContext);
  if (!model) {
    throw new Error("useSettingsTabPanelModel must be used within SettingsTabPanelModelProvider");
  }
  return model;
}

import type { SettingsTabId } from "@/app/features/settings/services/settings-search-index";

export function SettingsTabPanelModelProvider(props: Readonly<{
  activeTab: SettingsTabId;
  children: ReactNode;
}>): React.JSX.Element {
  const activeTab = props.activeTab;
${hooksBody.split("\n").map((l) => "  " + l).join("\n")}
  const model: SettingsTabPanelModel = {
    ${keys.join(",\n    ")},
  };
  return (
    <SettingsTabPanelModelContext.Provider value={model}>
      {props.children}
    </SettingsTabPanelModelContext.Provider>
  );
}
`;
modelFile = modelFile.replace("function SettingsToggle(", "export function SettingsToggle(");
modelFile = modelFile.replace("function SettingsToggleCard(", "export function SettingsToggleCard(");
for (const fn of ["toSettingsActionPhase", "validateProfileInput", "formatBytes", "formatRatioPercent"]) {
  modelFile = modelFile.replace(`export export const ${fn}`, `export const ${fn}`);
  modelFile = modelFile.replace(`const ${fn} =`, `export const ${fn} =`);
}
fs.writeFileSync(path.join(repoRoot, "apps/pwa/app/settings/settings-tab-panel-model.tsx"), modelFile);
console.log("regenerated", keys.length, "keys");
