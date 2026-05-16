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
      "app/features/messaging/services/dm-conversation-materialization-owner.ts",
      "app/features/messaging/services/dm-conversation-materialization-load-earlier.ts",
      "app/features/messaging/services/dm-conversation-hydrate-pipeline.ts",
      "app/features/messaging/services/dm-conversation-hydrate-read-model.ts",
      "app/features/messaging/services/dm-conversation-hydrate-sibling-diagnostics.ts",
      "app/features/messaging/services/dm-conversation-hydrate-indexed-scan.ts",
      "app/features/messaging/services/dm-conversation-hydrate-indexed-map-rows.ts",
      "app/features/messaging/services/dm-conversation-projection-evidence-messages.ts",
      "app/features/messaging/services/dm-conversation-projection-live-merge.ts",
      "app/features/messaging/services/dm-conversation-delete-identity-ids.ts",
      "app/features/messaging/services/dm-conversation-message-list-equiv.ts",
      "app/features/groups/services/community-roster-materialization-owner.ts",
      "app/features/groups/services/community-member-roster-projection.ts",
      "app/features/groups/services/community-visible-members.ts",
      "app/features/groups/services/community-roster-persistence.ts",
      "app/features/groups/services/community-membership-mutation-owner.ts",
      "app/features/groups/services/community-membership-ledger.ts",
      "app/features/messaging/services/dm-conversation-materialization-realtime.ts",
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
              name: "@/app/features/messaging/services/dm-conversation-hydrate-pipeline",
              importNames: ["runDmConversationHydrateReadModelPipeline", "logDmHydrateReadModelTelemetry"],
              message:
                "Route through getResolvedClientGateway().dmConversationMaterialization.hydrateThreadReadModel (R1).",
            },
            {
              name: "@/app/features/messaging/services/dm-conversation-hydrate-read-model",
              importNames: ["assembleDmHydrateThreadReadModel"],
              message:
                "Route through gateway hydrate pipeline owner (R1).",
            },
            {
              name: "@/app/features/messaging/services/dm-conversation-materialization-load-earlier",
              importNames: ["loadEarlierDmConversationMessages"],
              message:
                "Route through getResolvedClientGateway().dmConversationMaterialization.loadEarlierMessages (R1).",
            },
            {
              name: "@/app/features/messaging/services/dm-conversation-materialization-realtime",
              importNames: ["applyRealtimeBufferedEvents", "applyBufferedEvents"],
              message:
                "Route through getResolvedClientGateway().dmConversationMaterialization.applyRealtimeBufferedEvents (R1).",
            },
            {
              name: "@/app/features/messaging/services/dm-conversation-projection-evidence-messages",
              importNames: ["buildProjectionEvidenceMessagesForConversation"],
              message:
                "Route through getResolvedClientGateway().dmConversationMaterialization (R1).",
            },
            {
              name: "@/app/features/messaging/services/dm-conversation-projection-live-merge",
              importNames: ["mergeProjectionFirstWithLiveOverlayForDisplay"],
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
    files: [
      "app/features/messaging/deletion/**/*.{ts,tsx}",
      "app/features/messaging/local-dm-visibility/**/*.{ts,tsx}",
      "app/features/messaging/services/messaging-client-operations.ts",
      "app/features/messaging/services/dm-local-delete-persistence.ts",
      "app/features/messaging/services/dm-thread-suppression-prepare.ts",
      "app/features/messaging/services/dm-conversation-hydrate-pipeline.ts",
      "app/features/messaging/services/dm-conversation-materialization-owner.ts",
      "app/features/messaging/services/message-delete-tombstone-store.ts",
      "app/features/messaging/services/chat-state-store.ts",
      "app/features/groups/services/group-client-operations.ts",
      "app/features/messaging/hooks/use-conversation-messages.ts",
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
