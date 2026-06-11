"use client";

import { useEffect } from "react";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useRuntimeMessagingTransportOwnerController } from "@/app/features/messaging/providers/runtime-messaging-transport-owner-provider";
import { isDevLabEnabled } from "./dev-lab-policy";
import { registerDevLabMessagingHandlers } from "./dev-lab-install";
import { loadNativeDmSqlitePeerThreadSnapshots } from "@/app/features/messaging/services/native-dm-sqlite-integrity";
import { isNativeDmSqliteReadOwner } from "@/app/features/messaging/services/native-dm-read-policy";
import {
  requestNativeDmRelayBackfillRepair,
  runNativeDmSqliteProfileRepairScan,
} from "@/app/features/messaging/services/native-dm-sqlite-repair";
import { probeNativeDmSqliteWrite } from "@/app/features/messaging/services/native-dm-sqlite-write-probe";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

/** Registers programmatic DM send for Dev Lab scenarios (dev builds only). */
export const DevLabMessagingBridge = (): null => {
  const dmController = useRuntimeMessagingTransportOwnerController();
  const identity = useIdentity();

  useEffect(() => {
    if (!isDevLabEnabled()) {
      return;
    }

    registerDevLabMessagingHandlers({
      sendSyntheticDm: async (params) => {
        const result = await dmController.sendDm({
          peerPublicKeyInput: params.peerPublicKeyHex,
          plaintext: params.text,
        });
        return {
          success: result.success,
          deliveryStatus: result.deliveryStatus,
          messageId: result.messageId,
          error: result.error ?? null,
        };
      },
      getMessagesForPeer: (peerPublicKeyHex) => (
        dmController.getMessagesForPeer(peerPublicKeyHex).map((message) => ({
          id: message.id,
          content: message.content,
          isOutgoing: message.isOutgoing,
          status: message.status,
        }))
      ),
      getSqliteMessagesForPeer: isNativeDmSqliteReadOwner()
        ? async (peerPublicKeyHex) => {
          const myPublicKeyHex = identity.state.publicKeyHex;
          if (!myPublicKeyHex) {
            return [];
          }
          return loadNativeDmSqlitePeerThreadSnapshots({
            peerPublicKeyHex,
            myPublicKeyHex: myPublicKeyHex as PublicKeyHex,
          });
        }
        : undefined,
      scanOneSidedNativeDmConversations: isNativeDmSqliteReadOwner()
        ? async () => {
          const myPublicKeyHex = identity.state.publicKeyHex;
          if (!myPublicKeyHex) {
            return [];
          }
          const report = await runNativeDmSqliteProfileRepairScan({
            myPublicKeyHex: myPublicKeyHex as PublicKeyHex,
            profileId: getResolvedProfileId() || undefined,
            trigger: "dev_lab_scan",
            requestBackfill: false,
          });
          return report.oneSidedConversations;
        }
        : undefined,
      requestNativeDmRelayBackfillRepair: isNativeDmSqliteReadOwner()
        ? async () => {
          const myPublicKeyHex = identity.state.publicKeyHex;
          if (!myPublicKeyHex) {
            return false;
          }
          const report = await runNativeDmSqliteProfileRepairScan({
            myPublicKeyHex: myPublicKeyHex as PublicKeyHex,
            profileId: getResolvedProfileId() || undefined,
            trigger: "dev_lab_repair",
            requestBackfill: true,
          });
          return report.repairRequested;
        }
        : undefined,
      forceNativeDmRelayBackfillSync: isNativeDmSqliteReadOwner()
        ? async () => {
          const myPublicKeyHex = identity.state.publicKeyHex;
          const profileId = getResolvedProfileId()?.trim();
          if (!myPublicKeyHex || !profileId) {
            return false;
          }
          return requestNativeDmRelayBackfillRepair({
            profileId,
            reason: "dev_lab_force",
            conversationIds: [],
            trigger: "dev_lab_force",
            sinceUnixMs: 0,
            skipCooldown: true,
          });
        }
        : undefined,
      probeNativeDmSqliteWrite: isNativeDmSqliteReadOwner()
        ? () => probeNativeDmSqliteWrite()
        : undefined,
      triggerMissedMessageSync: async () => {
        await dmController.syncMissedMessages(new Date(0));
      },
      getControllerStatus: () => dmController.state.status,
      getMyPublicKeyHex: () => identity.state.publicKeyHex ?? null,
    });

    return () => {
      registerDevLabMessagingHandlers(null);
    };
  }, [
    dmController,
    dmController.getMessagesByConversation,
    dmController.getMessagesForPeer,
    dmController.syncMissedMessages,
    dmController.sendDm,
    dmController.state.status,
    identity.state.publicKeyHex,
  ]);

  return null;
};
