import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "update-imports.js",
    "vitest.setup.ts",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react/no-unescaped-entities": "off",
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // v1.5.0 Phase 1: implicit active profile import is an error outside profile-scope / runtime-scope.
  {
    files: ["app/**/*.{ts,tsx}"],
    ignores: [
      "**/*.test.{ts,tsx}",
      "**/__tests__/**/*.{ts,tsx}",
      "app/features/profiles/services/profile-scope.ts",
      "app/features/profiles/services/profile-runtime-scope.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/app/features/profiles/services/profile-scope",
              importNames: ["readRegistryBackedActiveProfileId"],
              message:
                "Prefer getResolvedProfileId() from profile-runtime-scope under the runtime shell, or pass profileId explicitly (v1.5.0 Phase 1).",
            },
          ],
        },
      ],
    },
  },
  // R0/R1: client mutations and materialization must route through ClientGateway.
  {
    files: ["app/features/**/*.{ts,tsx}"],
    ignores: [
      "**/*.test.{ts,tsx}",
      "**/__tests__/**/*.{ts,tsx}",
      "app/features/profiles/services/default-storage-ports.ts",
      "app/features/profiles/services/resolve-client-gateway.ts",
      "app/features/runtime/services/client-gateway-adapter.ts",
      "app/features/messaging/local-dm-visibility/**",
      "app/features/messaging/services/thread-history/dm-adapter.ts",
      "app/features/messaging/services/thread-history/port.ts",
      "app/features/messaging/services/thread-history/group-adapter.ts",
      "app/features/messaging/services/thread-history/materialization-load-earlier.ts",
      "app/features/messaging/services/thread-history/materialization-realtime.ts",
      "app/features/messaging/services/dm-conversation-hydrate-pipeline.ts",
      "app/features/messaging/services/thread-history/hydrate-read-model.ts",
      "app/features/messaging/services/thread-history/hydrate-indexed-scan.ts",
      "app/features/messaging/services/thread-history/hydrate-indexed-map-rows.ts",
      "app/features/messaging/services/thread-history/projection-evidence-messages.ts",
      "app/features/messaging/services/thread-history/projection-live-merge.ts",
      "app/features/messaging/services/thread-history/native-dm-thread-hydrate.ts",
      "app/features/messaging/services/native-dm-conversation-hydrate-owner.ts",
      "app/features/messaging/hooks/use-conversation-messages-legacy.ts",
      "app/features/messaging/services/dm-thread-read-model.ts",
      "app/features/messaging/services/dm-conversation-delete-identity-ids.ts",
      "app/features/messaging/services/dm-conversation-message-list-equiv.ts",
      "app/features/groups/services/community-roster-materialization-owner.ts",
      "app/features/groups/services/community-member-roster-projection.ts",
      "app/features/groups/services/community-visible-members.ts",
      "app/features/groups/services/community-roster-persistence.ts",
      "app/features/groups/services/community-membership-mutation-owner.ts",
      "app/features/groups/services/community-membership-ledger.ts",
      "app/features/groups/services/community-transport-owner.ts",
      "app/features/groups/services/community-membership-semantic-ingress.ts",
      "app/features/groups/services/community-membership-port-owner.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/app/features/profiles/services/default-storage-ports",
              importNames: ["getResolvedStoragePorts"],
              message:
                "Route through getResolvedClientGateway() (R0). Allowed only in gateway adapter, resolve-client-gateway fallback, and owner implementations.",
            },
            {
              name: "@/app/features/messaging/local-dm-visibility",
              importNames: ["localDmVisibilityOwner"],
              message:
                "Route through getResolvedClientGateway().localDmVisibility (R0).",
            },
            {
              name: "@/app/features/messaging/services/dm-thread-suppression-prepare",
              importNames: ["prepareDmThreadSuppressionIds"],
              message:
                "Route through getResolvedClientGateway().dmConversationMaterialization.prepareThreadSuppressionIds (R1).",
            },
            {
              name: "@/app/features/messaging/services/conversation-message-materialization",
              importNames: [
                "filterMessagesBySuppressedIds",
                "mergeHydratedBaseWithLiveOverlayMessages",
                "mergeProjectionFirstWithOverlayMessages",
                "selectMessagesForConversationHistoryAuthority",
              ],
              message:
                "Route through messagingClientOperations or dmConversationMaterialization port (R1).",
            },
            {
              name: "@/app/features/messaging/services/dm-conversation-hydrate-pipeline",
              importNames: ["runLegacyDmConversationHydrateReadModelPipeline", "logDmHydrateReadModelTelemetry"],
              message:
                "Route through getResolvedClientGateway().dmConversationMaterialization.hydrateThreadReadModel (R1).",
            },
            {
              name: "@/app/features/messaging/services/thread-history/hydrate-read-model",
              importNames: ["assembleDmHydrateThreadReadModel", "assembleLegacyDmHydrateThreadReadModel"],
              message:
                "Route through gateway hydrate pipeline owner (R1).",
            },
            {
              name: "@/app/features/messaging/services/thread-history/materialization-load-earlier",
              importNames: ["loadLegacyEarlierDmConversationMessages", "loadEarlierDmConversationMessages"],
              message:
                "Route through getResolvedClientGateway().dmConversationMaterialization.loadEarlierMessages (R1).",
            },
            {
              name: "@/app/features/messaging/services/thread-history/materialization-realtime",
              importNames: ["applyLegacyRealtimeBufferedEvents", "applyRealtimeBufferedEvents", "applyBufferedEvents"],
              message:
                "Route through getResolvedClientGateway().dmConversationMaterialization.applyRealtimeBufferedEvents (R1).",
            },
            {
              name: "@/app/features/messaging/services/thread-history/projection-evidence-messages",
              importNames: ["buildLegacyProjectionEvidenceMessagesForConversation", "buildProjectionEvidenceMessagesForConversation"],
              message:
                "Route through getResolvedClientGateway().dmConversationMaterialization (R1).",
            },
            {
              name: "@/app/features/messaging/services/thread-history/projection-live-merge",
              importNames: ["mergeLegacyProjectionFirstWithLiveOverlayForDisplay", "mergeProjectionFirstWithLiveOverlayForDisplay"],
              message:
                "Route through getResolvedClientGateway().dmConversationMaterialization (R1).",
            },
            {
              name: "@/app/features/groups/services/community-visible-members",
              importNames: [
                "resolveCommunitySeedMemberPubkeysFromDirectory",
                "resolveAuthorEvidencePubkeysFromCommunityMessages",
              ],
              message:
                "Route through getResolvedClientGateway().communityRoster (R2).",
            },
            {
              name: "@/app/features/groups/services/community-known-participants-store",
              importNames: ["upsertCommunityKnownParticipantsEntry"],
              message:
                "Route through getResolvedClientGateway().communityRoster persist methods (R2).",
            },
            {
              name: "@/app/features/groups/services/community-visible-members",
              importNames: ["resolveActiveCommunityMemberPubkeysFromConversation"],
              message:
                "Route through getResolvedClientGateway().communityRoster (R2).",
            },
            {
              name: "@/app/features/groups/services/community-member-roster-projection",
              importNames: ["resolveCommunityRosterSnapshotNextMembers"],
              message:
                "Route through getResolvedClientGateway().communityRoster.resolveSnapshotNextMembers (R2).",
            },
            {
              name: "@/app/features/groups/services/community-visible-members",
              importNames: ["stabilizeCommunityMemberPubkeys"],
              message:
                "Route through getResolvedClientGateway().communityRoster.stabilizeMemberPubkeys (R2).",
            },
            {
              name: "@/app/features/groups/services/community-membership-ledger",
              importNames: ["upsertCommunityMembershipLedgerEntry"],
              message:
                "Live membership ledger mutations must go through community-membership-mutation-owner (REL-005). Restore bulk may use saveCommunityMembershipLedger.",
            },
            {
              name: "@/app/features/messaging/deletion",
              importNames: ["deleteMessageForMe"],
              message:
                "Delete-for-me must use messagingClientOperations.deleteDmForMe (R1).",
            },
            {
              name: "@/app/features/messaging/services/message-delete-tombstone-store",
              importNames: ["suppressMessageDeleteTombstone", "isMessageDeleteSuppressed"],
              message:
                "Route through messagingClientOperations (R1).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["app/features/dm-kernel/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/app/features/messaging/services/dm-conversation-hydrate-pipeline",
              message: "dm-kernel must not import hydrate pipeline — use dm-kernel-thread-port / write-port only.",
            },
            {
              name: "@/app/features/messaging/services/dm-read-authority-contract",
              message: "dm-kernel must not import hydrate read model.",
            },
            {
              name: "@/app/features/messaging/services/thread-history/hydrate-read-model",
              message: "dm-kernel must not import hydrate read model.",
            },
            {
              name: "@/app/features/messaging/services/conversation-message-materialization",
              message: "dm-kernel must not import projection/merge materialization.",
            },
            {
              name: "@/app/features/messaging/hooks/use-conversation-messages-legacy",
              message: "dm-kernel must not import legacy hydrate hook.",
            },
          ],
          patterns: [
            {
              group: ["**/dm-conversation-hydrate-*", "**/dm-conversation-projection-*"],
              message: "dm-kernel quarantine — no hydrate/projection imports.",
            },
          ],
        },
      ],
    },
  },
  // P4: desktop runtime shell must not import legacy hydrate/projection modules.
  {
    files: [
      "app/features/runtime/**/*.{ts,tsx}",
      "app/features/main-shell/**/*.{ts,tsx}",
      "app/components/app-shell.tsx",
      "app/components/persistent-app-chrome.tsx",
      "app/components/providers.tsx",
    ],
    ignores: [
      "**/*.test.{ts,tsx}",
      "**/__tests__/**/*.{ts,tsx}",
      "app/features/runtime/services/client-gateway-adapter.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/app/features/messaging/hooks/use-conversation-messages-legacy",
              message: "P4 desktop shell — use use-thread-messages / dm-kernel only.",
            },
            {
              name: "@/app/features/messaging/services/thread-history/native-dm-thread-hydrate",
              message: "P4 desktop shell — hydrate quarantined; use dm-kernel-thread-port.",
            },
          ],
          patterns: [
            {
              group: ["**/dm-conversation-hydrate-*", "**/dm-conversation-projection-*", "**/native-dm-thread-hydrate*"],
              message: "P4 desktop shell — no legacy hydrate/projection imports.",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "app/features/messaging/local-dm-visibility/**/*.{ts,tsx}",
      "app/features/messaging/services/messaging-client-operations.ts",
      "app/features/messaging/services/dm-thread-suppression-prepare.ts",
      "app/features/messaging/services/dm-conversation-hydrate-pipeline.ts",
      "app/features/messaging/services/message-delete-tombstone-store.ts",
      "app/features/messaging/services/chat-state-store-legacy.ts",
      "app/features/groups/services/group-client-operations.ts",
      "app/features/messaging/hooks/use-conversation-messages-legacy.ts",
      "app/features/account-sync/services/account-projection-selectors.ts",
      "app/features/account-sync/services/account-event-bootstrap-service.ts",
      "app/features/account-sync/services/account-event-reducer.ts",
      "app/features/account-sync/services/account-projection-runtime.ts",
      "app/features/account-sync/services/restore-materialization.ts",
      "app/features/account-sync/services/restore-materialization-suppression-contract.ts",
      "app/features/account-sync/services/restore-hydrate-indexed-messages.ts",
      "app/features/account-sync/services/encrypted-account-backup-service.ts",
      "app/features/messaging/controllers/v2/dm-receive-pipeline.ts",
      "app/features/messaging/controllers/v2/dm-controller.ts",
      "app/features/messaging/controllers/incoming-dm-event-handler.ts",
      "app/features/messaging/services/conversation-message-visibility.ts",
      "app/features/messaging/services/dm-read-authority-contract.ts",
      "app/features/messaging/services/conversation-message-materialization.ts",
      "app/features/groups/services/community-group-message-suppression.ts",
      "app/features/messaging/controllers/v2/dm-delete-pipeline.ts",
      "app/features/runtime/services/client-gateway-adapter.ts",
      "app/features/profiles/providers/profile-runtime-provider.tsx",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
]);

export default eslintConfig;
