import type { LocalSaveLibraryEntry } from "./local-save-contracts";

export const formatLocalSaveModifiedLabel = (modifiedAtUnixMs: number): string => {
  if (!modifiedAtUnixMs || !Number.isFinite(modifiedAtUnixMs)) {
    return "Unknown date";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(modifiedAtUnixMs));
};

export const formatLocalSaveSizeLabel = (payloadBytes: number): string => {
  if (!payloadBytes || payloadBytes <= 0) {
    return "Unknown size";
  }
  if (payloadBytes < 1024) {
    return `${payloadBytes} B`;
  }
  if (payloadBytes < 1024 * 1024) {
    return `${(payloadBytes / 1024).toFixed(payloadBytes < 10_240 ? 1 : 0)} KB`;
  }
  return `${(payloadBytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatPublicKeyAbbreviation = (publicKeyHex: string): string => (
  `${publicKeyHex.slice(0, 8)}…${publicKeyHex.slice(-4)}`
);

export const resolveLocalSaveTypeLabel = (entry: LocalSaveLibraryEntry): string => {
  if (entry.payloadKind === "portable_account_bundle") {
    return "Portable account";
  }
  if (entry.payloadKind === "workspace_bundle") {
    return "Workspace bundle";
  }
  return "Unified account";
};

const labelFromFileName = (fileName: string): string | null => {
  const base = fileName.replace(/\.[^./\\]+$/, "");
  const portableMatch = /^(.+)-portable-/i.exec(base);
  if (portableMatch?.[1] && !portableMatch[1].startsWith("obscur")) {
    return portableMatch[1].replace(/-/g, " ");
  }
  return null;
};

export const resolveLocalSaveDisplayName = (entry: LocalSaveLibraryEntry): string => {
  const profileLabel = entry.profileLabel?.trim();
  if (profileLabel) {
    return profileLabel;
  }
  const fromFileName = labelFromFileName(entry.fileName);
  if (fromFileName) {
    return fromFileName;
  }
  return `Account ${entry.publicKeyHex.slice(0, 8)}`;
};
