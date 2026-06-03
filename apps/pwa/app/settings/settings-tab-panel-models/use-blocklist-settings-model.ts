"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@dweb/ui-kit";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useBlocklist } from "@/app/features/network/hooks/use-blocklist";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import type { SettingsActionPhase } from "@/app/features/settings/components/settings-action-status";
import type { SettingsTabPanelModel } from "../settings-tab-panel-model-context";

export function useBlocklistSettingsModel(): SettingsTabPanelModel {
  const { t } = useTranslation();
  const identity = useIdentity();
  const displayPublicKeyHex: string = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? "";
  const publicKeyHex: PublicKeyHex | null = (displayPublicKeyHex as PublicKeyHex | null) ?? null;
  const blocklist = useBlocklist({ publicKeyHex });
  const [blocklistQuery, setBlocklistQuery] = useState<string>("");
  const [blocklistInput, setBlocklistInput] = useState<string>("");
  const [moderationActionPhase, setModerationActionPhase] = useState<SettingsActionPhase>("idle");
  const [moderationActionMessage, setModerationActionMessage] = useState<string>("");

  const filteredBlockedKeys = useMemo(() => {
    const query = blocklistQuery.trim().toLowerCase();
    if (!query) return blocklist.state.blockedPublicKeys;
    return blocklist.state.blockedPublicKeys.filter((key) => key.toLowerCase().includes(query));
  }, [blocklist.state.blockedPublicKeys, blocklistQuery]);

  const handleAddBlockedKey = (): void => {
    const input = blocklistInput.trim();
    if (!input) {
      setModerationActionPhase("error");
      setModerationActionMessage("Enter a public key first.");
      return;
    }
    const normalized = normalizePublicKeyHex(input);
    if (!normalized) {
      setModerationActionPhase("error");
      setModerationActionMessage("Invalid public key format.");
      return;
    }
    if (blocklist.state.blockedPublicKeys.includes(normalized)) {
      setModerationActionPhase("success");
      setModerationActionMessage("Key is already blocked.");
      return;
    }
    blocklist.addBlocked({ publicKeyInput: normalized });
    setBlocklistInput("");
    setModerationActionPhase("success");
    setModerationActionMessage("User blocked.");
    toast.success("User blocked.");
  };

  const handleUnblockAll = (): void => {
    if (blocklist.state.blockedPublicKeys.length === 0) {
      setModerationActionPhase("success");
      setModerationActionMessage("Blocklist is already empty.");
      return;
    }
    for (const key of blocklist.state.blockedPublicKeys) {
      blocklist.removeBlocked({ publicKeyHex: key });
    }
    setModerationActionPhase("success");
    setModerationActionMessage("All blocked users removed.");
    toast.success("Blocklist cleared.");
  };

  return {
    blocklist,
    blocklistInput,
    blocklistQuery,
    filteredBlockedKeys,
    handleAddBlockedKey,
    handleUnblockAll,
    moderationActionMessage,
    moderationActionPhase,
    setBlocklistInput,
    setBlocklistQuery,
    setModerationActionMessage,
    setModerationActionPhase,
    t,
  };
}
