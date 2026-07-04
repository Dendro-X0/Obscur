import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";

export type AtRestEncryptionUiPolicy = Readonly<{
  /** Browser-only toggle for IndexedDB outbound message queue encryption. */
  showOutboundQueueEncryptionToggle: boolean;
  /** v1.9.8 Phase 3 — native sqlite/vault envelope active on desktop. */
  desktopAtRestEncryptionActive: boolean;
}>;

export const resolveAtRestEncryptionUiPolicy = (): AtRestEncryptionUiPolicy => {
  const native = hasNativeRuntime();
  return {
    showOutboundQueueEncryptionToggle: !native,
    desktopAtRestEncryptionActive: native,
  };
};
