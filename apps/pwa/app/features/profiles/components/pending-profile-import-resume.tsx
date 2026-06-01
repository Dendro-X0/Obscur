"use client";

import type React from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { useUnifiedImportFlow } from "@/app/features/profiles/hooks/use-unified-import-flow";

type Props = Readonly<{
  publicKeyHex: PublicKeyHex | null;
  resolveActivePrivateKeyHex: () => Promise<PrivateKeyHex | null>;
}>;

/** Opens the import preflight dialog after unlock when a staged backup matches the active account. */
export function PendingProfileImportResume(props: Props): React.JSX.Element {
  const importFlow = useUnifiedImportFlow({
    publicKeyHex: props.publicKeyHex,
    resolveActivePrivateKeyHex: props.resolveActivePrivateKeyHex,
    autoResumeOnUnlock: true,
  });

  return importFlow.preflightDialog;
}
