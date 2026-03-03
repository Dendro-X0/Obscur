import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { handleIncomingDmEvent } from "./incoming-dm-event-handler";

vi.mock("@/app/features/crypto/crypto-service", () => ({
    cryptoService: {
        verifyEventSignature: vi.fn(async () => true),
        decryptGiftWrap: vi.fn(async () => ({
            id: "rumor-id",
            pubkey: "sender-pubkey",
            kind: 1059,
            created_at: 1234,
            tags: [],
            content: JSON.stringify({
                type: "community-invite",
                groupId: "group-alpha",
                roomKeyHex: "room-key",
                relayUrl: "wss://relay.example"
            })
        }))
    }
}));

vi.mock("@/app/features/settings/services/privacy-settings-service", () => ({
    PrivacySettingsService: {
        getSettings: () => ({ dmPrivacy: "anyone" })
    }
}));

describe("incoming-dm-event-handler", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("does not auto-create group chats from incoming community invites", async () => {
        const myPublicKeyHex = "my-public-key" as PublicKeyHex;
        const event = {
            id: "event-1",
            pubkey: "sender-pubkey",
            kind: 1059,
            created_at: 1200,
            content: "encrypted",
            tags: [["p", myPublicKeyHex]]
        } as unknown as NostrEvent;

        const dispatchSpy = vi.spyOn(window, "dispatchEvent");
        const onNewMessage = vi.fn();

        await handleIncomingDmEvent({
            event,
            currentParams: {
                myPrivateKeyHex: "private-key",
                myPublicKeyHex,
                onNewMessage
            },
            messageQueue: null,
            processingEvents: new Set<string>(),
            failedDecryptEvents: new Set<string>(),
            existingMessages: [],
            maxMessagesInMemory: 100,
            syncConversationTimestamps: new Map<string, Date>(),
            activeSubscriptions: new Map(),
            scheduleUiUpdate: (fn) => fn(),
            setState: vi.fn(),
            createReadyState: (messages) => ({ messages }),
            messageMemoryManager: { addMessages: vi.fn() },
            uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) }
        });

        expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: "obscur:group-invite" }));
        expect(onNewMessage).toHaveBeenCalledTimes(1);
        expect(onNewMessage.mock.calls[0]?.[0]?.content).toContain("\"community-invite\"");
    });
});
