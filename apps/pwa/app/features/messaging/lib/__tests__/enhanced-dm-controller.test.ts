import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useEnhancedDMController } from "../../controllers/enhanced-dm-controller";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { parsePublicKeyInput } from "@/app/features/profile/utils/parse-public-key-input";
import { cryptoService } from "@/app/features/crypto/crypto-service";

const { mockMessageQueueInstance } = vi.hoisted(() => ({
  mockMessageQueueInstance: {
    persistMessage: vi.fn(),
    updateMessageStatus: vi.fn(),
    getMessage: vi.fn(),
    getMessages: vi.fn(),
    queueOutgoingMessage: vi.fn(),
    getQueuedMessages: vi.fn(),
    removeFromQueue: vi.fn(),
    getAllMessages: vi.fn(),
  },
}));

vi.mock("../message-queue", () => ({
  MessageQueue: vi.fn(function () {
    return mockMessageQueueInstance;
  }),
}));

vi.mock("@/app/features/profile/utils/parse-public-key-input", () => ({
  parsePublicKeyInput: vi.fn(),
}));

vi.mock("@/app/features/settings/services/privacy-settings-service", () => ({
  PrivacySettingsService: {
    getSettings: vi.fn(() => ({
      useModernDMs: false,
      encryptStorageAtRest: false,
      dmPrivacy: "everyone",
    })),
  },
}));

vi.mock("@/app/features/crypto/crypto-service", () => ({
  cryptoService: {
    encryptGiftWrap: vi.fn(),
    decryptGiftWrap: vi.fn(),
    encryptDM: vi.fn(),
    decryptDM: vi.fn(),
    signEvent: vi.fn(),
    verifyEventSignature: vi.fn(),
  },
}));

vi.mock("@/app/features/relays/utils/nip65-service", () => ({
  nip65Service: {
    getWriteRelays: vi.fn(() => []),
    updateFromEvent: vi.fn(),
  },
}));

vi.mock("../nostr-safety-limits", () => ({
  NOSTR_SAFETY_LIMITS: {
    maxDmPlaintextChars: 1000,
  },
}));

describe("useEnhancedDMController", () => {
  const myPublicKey = "02a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc" as PublicKeyHex;
  const myPrivateKey = "5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb" as PrivateKeyHex;
  const peerPublicKey = "03c2047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5" as PublicKeyHex;

  const buildSignedEvent = (eventId: string, content: string, tags: string[][] = [["p", peerPublicKey]]) => ({
    id: eventId,
    kind: 4,
    created_at: Math.floor(Date.now() / 1000),
    content,
    pubkey: myPublicKey,
    sig: "mock_sig",
    tags,
  });

  let pool: {
    connections: Array<{ url: string; status: "open" | "closed" | "error"; updatedAtUnixMs: number; errorMessage?: string }>;
    sendToOpen: ReturnType<typeof vi.fn>;
    publishToAll: ReturnType<typeof vi.fn>;
    subscribeToMessages: ReturnType<typeof vi.fn>;
    waitForConnection: ReturnType<typeof vi.fn>;
  };

  let incomingHandler: ((params: Readonly<{ url: string; message: string }>) => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();

    incomingHandler = undefined;
    pool = {
      connections: [
        { url: "wss://relay-1.example", status: "open", updatedAtUnixMs: Date.now() },
        { url: "wss://relay-2.example", status: "open", updatedAtUnixMs: Date.now() },
      ],
      sendToOpen: vi.fn(),
      publishToAll: vi.fn().mockResolvedValue({
        success: true,
        successCount: 2,
        totalRelays: 2,
        results: [
          { relayUrl: "wss://relay-1.example", success: true, latency: 4 },
          { relayUrl: "wss://relay-2.example", success: true, latency: 7 },
        ],
      }),
      subscribeToMessages: vi.fn((handler) => {
        incomingHandler = handler;
        return vi.fn();
      }),
      waitForConnection: vi.fn().mockResolvedValue(true),
    };

    vi.mocked(parsePublicKeyInput).mockReturnValue({
      ok: true,
      publicKeyHex: peerPublicKey,
      format: "hex",
    });

    vi.mocked(cryptoService.encryptDM).mockResolvedValue("encrypted_payload");
    vi.mocked(cryptoService.decryptDM).mockResolvedValue("incoming plaintext");
    vi.mocked(cryptoService.verifyEventSignature).mockResolvedValue(true);
    vi.mocked(cryptoService.signEvent).mockImplementation(async (unsigned: any) =>
      buildSignedEvent("event-1", unsigned.content, unsigned.tags)
    );
    vi.mocked(cryptoService.encryptGiftWrap).mockResolvedValue(
      buildSignedEvent("giftwrap-1", "wrapped", [["p", peerPublicKey]])
    );
    vi.mocked(cryptoService.decryptGiftWrap).mockResolvedValue(
      buildSignedEvent("rumor-1", "decrypted wrapped message", [["p", myPublicKey]])
    );

    mockMessageQueueInstance.getAllMessages.mockResolvedValue([]);
    mockMessageQueueInstance.getMessage.mockResolvedValue(null);
    mockMessageQueueInstance.persistMessage.mockResolvedValue(undefined);
    mockMessageQueueInstance.updateMessageStatus.mockResolvedValue(undefined);
    mockMessageQueueInstance.queueOutgoingMessage.mockResolvedValue(undefined);
    mockMessageQueueInstance.getQueuedMessages.mockResolvedValue([]);
    mockMessageQueueInstance.removeFromQueue.mockResolvedValue(undefined);
  });

  it("sends a DM and persists optimistic message state", async () => {
    const { result } = renderHook(() =>
      useEnhancedDMController({
        myPublicKeyHex: myPublicKey,
        myPrivateKeyHex: myPrivateKey,
        pool: pool as any,
      })
    );

    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });

    const sendResult = await act(async () =>
      result.current.sendDm({
        peerPublicKeyInput: peerPublicKey,
        plaintext: "hello",
      })
    );

    expect(sendResult.success).toBe(true);
    expect(sendResult.messageId).toBe("event-1");
    expect(sendResult.relayResults).toHaveLength(2);
    expect(cryptoService.encryptDM).toHaveBeenCalledWith("hello", peerPublicKey, myPrivateKey);
    expect(cryptoService.signEvent).toHaveBeenCalled();
    expect(mockMessageQueueInstance.persistMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "event-1",
        content: "hello",
      })
    );
  });

  it("returns validation error for invalid recipient key", async () => {
    vi.mocked(parsePublicKeyInput).mockReturnValue({ ok: false, reason: "invalid_format" });

    const { result } = renderHook(() =>
      useEnhancedDMController({
        myPublicKeyHex: myPublicKey,
        myPrivateKeyHex: myPrivateKey,
        pool: pool as any,
      })
    );

    const sendResult = await act(async () =>
      result.current.sendDm({
        peerPublicKeyInput: "invalid-key",
        plaintext: "hello",
      })
    );

    expect(sendResult.success).toBe(false);
    expect(sendResult.error).toBe("Invalid recipient public key");
    expect(cryptoService.encryptDM).not.toHaveBeenCalled();
  });

  it("rejects empty messages", async () => {
    const { result } = renderHook(() =>
      useEnhancedDMController({
        myPublicKeyHex: myPublicKey,
        myPrivateKeyHex: myPrivateKey,
        pool: pool as any,
      })
    );

    const sendResult = await act(async () =>
      result.current.sendDm({
        peerPublicKeyInput: peerPublicKey,
        plaintext: "   ",
      })
    );

    expect(sendResult.success).toBe(false);
    expect(sendResult.error).toBe("Message cannot be empty");
  });

  it("queues message when no open relays are available", async () => {
    pool.connections = [
      { url: "wss://relay-offline.example", status: "closed", updatedAtUnixMs: Date.now() },
      { url: "wss://relay-error.example", status: "error", updatedAtUnixMs: Date.now(), errorMessage: "down" },
    ];

    const { result } = renderHook(() =>
      useEnhancedDMController({
        myPublicKeyHex: myPublicKey,
        myPrivateKeyHex: myPrivateKey,
        pool: pool as any,
      })
    );

    const sendResult = await act(async () =>
      result.current.sendDm({
        peerPublicKeyInput: peerPublicKey,
        plaintext: "offline message",
      })
    );

    expect(sendResult.success).toBe(false);
    expect(sendResult.error).toBe("Offline - message queued");
    expect(mockMessageQueueInstance.queueOutgoingMessage).toHaveBeenCalled();
    expect(mockMessageQueueInstance.updateMessageStatus).toHaveBeenCalled();
  });

  it("subscribes with DM + gift-wrap kinds", async () => {
    const { result } = renderHook(() =>
      useEnhancedDMController({
        myPublicKeyHex: myPublicKey,
        myPrivateKeyHex: myPrivateKey,
        pool: pool as any,
      })
    );

    await act(async () => {
      result.current.subscribeToIncomingDMs();
    });

    const reqCall = pool.sendToOpen.mock.calls.find((c) => String(c[0]).includes('"REQ"'));
    expect(reqCall).toBeTruthy();
    const payload = JSON.parse(reqCall![0] as string);
    expect(payload[0]).toBe("REQ");
    expect(payload[2]).toEqual(
      expect.objectContaining({
        kinds: [4, 1059],
        "#p": [myPublicKey],
      })
    );
  });

  it("verifies signature and decrypts incoming DM before persisting", async () => {
    renderHook(() =>
      useEnhancedDMController({
        myPublicKeyHex: myPublicKey,
        myPrivateKeyHex: myPrivateKey,
        pool: pool as any,
      })
    );

    expect(incomingHandler).toBeTruthy();
    const event = {
      ...buildSignedEvent("incoming-1", "ciphertext", [["p", myPublicKey]]),
      pubkey: peerPublicKey,
    };

    await act(async () => {
      await incomingHandler?.({
        url: "wss://relay-1.example",
        message: JSON.stringify(["EVENT", "sub-id", event]),
      });
    });

    expect(cryptoService.verifyEventSignature).toHaveBeenCalledWith(event);
    expect(cryptoService.decryptDM).toHaveBeenCalledWith("ciphertext", peerPublicKey, myPrivateKey);
    expect(mockMessageQueueInstance.persistMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "incoming-1",
        content: "incoming plaintext",
        isOutgoing: false,
      })
    );
  });

  it("rejects incoming events with invalid signature", async () => {
    vi.mocked(cryptoService.verifyEventSignature).mockResolvedValue(false);

    renderHook(() =>
      useEnhancedDMController({
        myPublicKeyHex: myPublicKey,
        myPrivateKeyHex: myPrivateKey,
        pool: pool as any,
      })
    );

    const event = buildSignedEvent("incoming-invalid", "ciphertext", [["p", myPublicKey]]);

    await act(async () => {
      await incomingHandler?.({
        url: "wss://relay-1.example",
        message: JSON.stringify(["EVENT", "sub-id", event]),
      });
    });

    expect(cryptoService.verifyEventSignature).toHaveBeenCalledWith(event);
    expect(cryptoService.decryptDM).not.toHaveBeenCalled();
    expect(mockMessageQueueInstance.persistMessage).not.toHaveBeenCalled();
  });
});
