"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Upload } from "lucide-react";
import { toast } from "@dweb/ui-kit/toast";
import { Button } from "@dweb/ui-kit/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dweb/ui-kit/dialog";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { decodePrivateKey } from "@/app/features/auth/utils/decode-private-key";
import { NATIVE_KEY_SENTINEL } from "@/app/features/crypto/crypto-service";
import { useMessaging } from "@/app/features/messaging/providers/messaging-provider";
import { useNetwork } from "@/app/features/network/providers/network-provider";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useRelayPoolRef } from "@/app/features/relays/hooks/use-relay-pool-ref";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { logAppEvent } from "@/app/shared/log-app-event";
import { runManualAccountSyncRestore } from "../services/account-sync-manual-intent";
import {
  readEmptyDeviceContinuityDismissed,
  shouldOfferEmptyDeviceContinuityGate,
  writeEmptyDeviceContinuityDismissed,
} from "../services/empty-device-continuity-policy";

/**
 * Sticky prompt when unlock skips auto restore and the local graph is empty.
 * Path R = Restore from relays · Path L = Import backup file (Settings).
 */
export function EmptyDeviceContinuityGate(): React.JSX.Element | null {
  const router = useRouter();
  const identity = useIdentity();
  const { peerTrust } = useNetwork();
  const { createdConnections, hasHydrated: messagingHydrated } = useMessaging();
  const { relayPool: pool, enabledRelayUrls } = useRelay();
  const poolRef = useRelayPoolRef(pool);

  const publicKeyHex = (identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null) as PublicKeyHex | null;
  const profileId = getResolvedProfileId() || "default";
  const [dismissed, setDismissed] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!publicKeyHex) {
      setDismissed(false);
      return;
    }
    setDismissed(readEmptyDeviceContinuityDismissed(profileId, publicKeyHex));
  }, [profileId, publicKeyHex]);

  const acceptedPeerCount = peerTrust.state?.acceptedPeers?.length ?? 0;
  const localConnectionCount = createdConnections?.length ?? 0;

  const open = useMemo(() => shouldOfferEmptyDeviceContinuityGate({
    identityReady: Boolean(publicKeyHex),
    peerTrustHydrated: Boolean(peerTrust.hasHydrated),
    messagingHydrated: Boolean(messagingHydrated),
    acceptedPeerCount,
    localConnectionCount,
    dismissed,
  }), [
    acceptedPeerCount,
    dismissed,
    localConnectionCount,
    messagingHydrated,
    peerTrust.hasHydrated,
    publicKeyHex,
  ]);

  const enabledRelayCount = enabledRelayUrls?.length ?? 0;

  useEffect(() => {
    if (!open || !publicKeyHex) {
      return;
    }
    logAppEvent({
      name: "account_sync.empty_device_continuity_offered",
      level: "info",
      scope: { feature: "account-sync", action: "empty_device_continuity" },
      context: {
        profileId,
        enabledRelayCount,
        acceptedPeerCount,
      },
    });
  }, [acceptedPeerCount, enabledRelayCount, open, profileId, publicKeyHex]);

  const dismiss = useCallback((): void => {
    if (publicKeyHex) {
      writeEmptyDeviceContinuityDismissed(profileId, publicKeyHex);
    }
    setDismissed(true);
    logAppEvent({
      name: "account_sync.empty_device_continuity_dismissed",
      level: "info",
      scope: { feature: "account-sync", action: "empty_device_continuity" },
      context: { profileId },
    });
  }, [profileId, publicKeyHex]);

  const resolvePrivateKey = useCallback(async (): Promise<PrivateKeyHex | null> => {
    if (identity.state.privateKeyHex && identity.state.privateKeyHex !== NATIVE_KEY_SENTINEL) {
      return identity.state.privateKeyHex;
    }
    if (identity.state.privateKeyHex !== NATIVE_KEY_SENTINEL) {
      return null;
    }
    const nsecResult = await invokeNativeCommand<string>("get_session_nsec");
    if (!nsecResult.ok || !nsecResult.value) {
      return null;
    }
    return decodePrivateKey(nsecResult.value);
  }, [identity.state.privateKeyHex]);

  const handleRestoreFromRelays = useCallback(async (): Promise<void> => {
    if (!publicKeyHex || restoring) {
      return;
    }
    if (enabledRelayCount < 1) {
      toast.error("Add or enable a relay before restoring from the network.");
      return;
    }
    setRestoring(true);
    try {
      const privateKeyHex = await resolvePrivateKey();
      if (!privateKeyHex) {
        toast.error("Unlock this account before restoring from relays.");
        return;
      }
      const result = await runManualAccountSyncRestore({
        publicKeyHex,
        privateKeyHex,
        pool: poolRef.current,
      });
      if (result.ok) {
        toast.success(result.message);
        dismiss();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Restore failed.");
    } finally {
      setRestoring(false);
    }
  }, [dismiss, enabledRelayCount, poolRef, publicKeyHex, resolvePrivateKey, restoring]);

  const handleImportFile = useCallback((): void => {
    dismiss();
    router.push("/settings?tab=identity");
  }, [dismiss, router]);

  if (!open) {
    return null;
  }

  return (
    <Dialog open onOpenChange={(nextOpen) => { if (!nextOpen) dismiss(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Restore your Obscur data</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-left text-sm text-muted-foreground">
              <p>
                This device has no contacts or chats for this account yet.
                Unlock does not auto-sync — restore from relays or import a backup file.
              </p>
              {enabledRelayCount < 1 ? (
                <p>
                  No relays are enabled. Import a backup file, or enable a relay first, then restore.
                </p>
              ) : null}
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            disabled={restoring || enabledRelayCount < 1}
            onClick={() => void handleRestoreFromRelays()}
          >
            {restoring ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Restoring…</>
            ) : (
              <><Download className="h-4 w-4" /> Restore from relays</>
            )}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={restoring}
            onClick={handleImportFile}
          >
            <Upload className="h-4 w-4" />
            Import backup file
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={restoring} onClick={dismiss}>
            Continue empty
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
