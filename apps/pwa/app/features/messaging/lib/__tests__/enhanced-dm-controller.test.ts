import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useEnhancedDMController } from "../../controllers/enhanced-dm-controller";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { parsePublicKeyInput } from "@/app/features/profile/utils/parse-public-key-input";
import { cryptoService } from "@/app/features/crypto/crypto-service";
import { getV090RolloutPolicy } from "@/app/features/settings/services/v090-rollout-policy";
import { protocolCoreAdapter } from "@/app/features/runtime/protocol-core-adapter";
import { nip65Service } from "@/app/features/relays/utils/nip65-service";
import { messagingTransportRuntime } from "../../services/messaging-transport-runtime";

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
    ingestVerifiedEvent: vi.fn(async () => ({ status: "accepted" })),
  },
}));

vi.mock("@/app/features/settings/services/v090-rollout-policy", () => ({
  getV090RolloutPolicy: vi.fn(() => ({
    stabilityModeEnabled: false,
    deterministicDiscoveryEnabled: false,
    protocolCoreEnabled: false,
    x3dhRatchetEnabled: false,
  })),
}));

vi.mock("@/app/features/runtime/protocol-core-adapter", () => ({
  protocolCoreAdapter: {
    runX3DHHandshake: vi.fn(async () => ({ ok: false, reason: "unsupported", message: "x3dh disabled" })),
    getRatchetSession: vi.fn(async () => ({ ok: false, reason: "unsupported", message: "x3dh disabled" })),
    publishWithQuorum: vi.fn(async () => ({ ok: false, reason: "unsupported", message: "protocol publish disabled" })),
  },
}));

vi.mock("@/app/features/relays/services/relay-recovery-policy", () => ({
  hasWritableRelayCapacity: vi.fn(() => true),
}));

vi.mock("../nostr-safety-limits", () => ({
  NOSTR_SAFETY_LIMITS: {
    maxDmPlaintextChars: 1000,
  },
}));

describe("useEnhancedDMController", () => {
  const myPublicKey = "a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc" as PublicKeyHex;
  const myPrivateKey = "5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb" as PrivateKeyHex;
  const peerPublicKey = "c2047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5" as PublicKeyHex;

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
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
    resubscribeAll: ReturnType<typeof vi.fn>;
    waitForConnection: ReturnType<typeof vi.fn>;
  };

  let messageHandlers: Array<(params: Readonly<{ url: string; message: string }>) => void>;
  let subscribedEventHandler: ((event: unknown, url: string) => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getV090RolloutPolicy).mockReturnValue({
      stabilityModeEnabled: false,
      deterministicDiscoveryEnabled: false,
      protocolCoreEnabled: false,
      x3dhRatchetEnabled: false,
    });

    messageHandlers = [];
    subscribedEventHandler = undefined;
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
        messageHandlers.push(handler);
        return vi.fn(() => {
          messageHandlers = messageHandlers.filter((entry) => entry !== handler);
        });
      }),
      subscribe: vi.fn((_filters, onEvent) => {
        subscribedEventHandler = onEvent;
        return "sub-1";
      }),
      unsubscribe: vi.fn(),
      resubscribeAll: vi.fn(),
      waitForConnection: vi.fn().mockResolvedValue(true),
    };

    vi.mocked(parsePublicKeyInput).mockImplementation((input: string) => {
      if (typeof input === "string" && /^[0-9a-f]{64}$/i.test(input)) {
        return {
          ok: true,
          publicKeyHex: input.toLowerCase() as PublicKeyHex,
          format: "hex",
        };
      }
      return { ok: false, reason: "invalid_format" } as any;
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

  it("adds v090_x3dr tags when protocol-core x3dh is enabled", async () => {
    vi.mocked(getV090RolloutPolicy).mockReturnValue({
      stabilityModeEnabled: false,
      deterministicDiscoveryEnabled: false,
      protocolCoreEnabled: true,
      x3dhRatchetEnabled: true,
    });
    vi.mocked(protocolCoreAdapter.runX3DHHandshake).mockResolvedValue({
      ok: true,
      value: {
        ok: true,
        sessionId: "x3dr-session-1",
        peerPublicKeyHex: peerPublicKey,
        establishedAtUnixMs: Date.now(),
        usedPrekey: false,
      },
    } as any);
    vi.mocked(protocolCoreAdapter.getRatchetSession).mockResolvedValue({
      ok: true,
      value: {
        sessionId: "x3dr-session-1",
        peerPublicKeyHex: peerPublicKey,
        rootKeyId: "rk-1",
        sendingChainLength: 3,
        receivingChainLength: 0,
        status: "active",
      },
    } as any);

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

    await act(async () =>
      result.current.sendDm({
        peerPublicKeyInput: peerPublicKey,
        plaintext: "hello x3dh",
      })
    );

    expect(protocolCoreAdapter.runX3DHHandshake).toHaveBeenCalledWith(peerPublicKey);
    expect(protocolCoreAdapter.getRatchetSession).toHaveBeenCalledWith("x3dr-session-1");

    const publishPayload = pool.publishToAll.mock.calls.at(-1)?.[0] as string;
    const [, publishedEvent] = JSON.parse(publishPayload) as [string, { tags: string[][] }];
    expect(publishedEvent.tags).toEqual(
      expect.arrayContaining([
        ["obscur-envelope-version", "v090_x3dr"],
        ["obscur-session-id", "x3dr-session-1"],
        ["obscur-counter", "3"],
      ])
    );
  });

  it("falls back to legacy tags when x3dh handshake fails", async () => {
    vi.mocked(getV090RolloutPolicy).mockReturnValue({
      stabilityModeEnabled: false,
      deterministicDiscoveryEnabled: false,
      protocolCoreEnabled: true,
      x3dhRatchetEnabled: true,
    });
    vi.mocked(protocolCoreAdapter.runX3DHHandshake).mockResolvedValue({
      ok: false,
      reason: "failed",
      message: "handshake failed",
    } as any);

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
        plaintext: "hello fallback",
      })
    );

    expect(sendResult.success).toBe(true);
    const publishPayload = pool.publishToAll.mock.calls.at(-1)?.[0] as string;
    const [, publishedEvent] = JSON.parse(publishPayload) as [string, { tags: string[][] }];
    expect(publishedEvent.tags.some((tag) => tag[0] === "obscur-envelope-version")).toBe(false);
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
    expect(sendResult.error).toBe("Invalid recipient public key. Verify the contact key or QR and try again.");
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
    expect(sendResult.error).toBe("No writable relay snapshot available. Message queued and will retry automatically when connection returns.");
    expect(mockMessageQueueInstance.queueOutgoingMessage).toHaveBeenCalled();
    expect(mockMessageQueueInstance.updateMessageStatus).toHaveBeenCalled();
  });

  it("fails deterministically when no evidence-backed publish transport exists", async () => {
    pool.publishToAll = undefined as any;

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
        plaintext: "unsupported transport",
      })
    );

    expect(sendResult.success).toBe(false);
    expect(sendResult.deliveryStatus).toBe("failed");
    expect(sendResult.error).toContain("evidence-backed publish APIs");
    expect(mockMessageQueueInstance.queueOutgoingMessage).not.toHaveBeenCalled();
    expect(mockMessageQueueInstance.updateMessageStatus).toHaveBeenCalledWith(expect.any(String), "failed");
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

    const subscribeCall = pool.subscribe.mock.calls[0];
    expect(subscribeCall).toBeTruthy();
    expect(subscribeCall?.[0]?.[0]).toEqual(
      expect.objectContaining({
        kinds: [4, 1059],
        "#p": [myPublicKey],
      })
    );
  });

  it("does not auto-subscribe when autoSubscribeIncoming is disabled", async () => {
    renderHook(() =>
      useEnhancedDMController({
        myPublicKeyHex: myPublicKey,
        myPrivateKeyHex: myPrivateKey,
        pool: pool as any,
        autoSubscribeIncoming: false,
      })
    );

    await waitFor(() => {
      expect(pool.subscribe).not.toHaveBeenCalled();
    });
  });

  it("keeps transport passive when incoming transport is disabled", async () => {
    const { result } = renderHook(() =>
      useEnhancedDMController({
        myPublicKeyHex: myPublicKey,
        myPrivateKeyHex: myPrivateKey,
        pool: pool as any,
        enableIncomingTransport: false,
      })
    );

    await act(async () => {
      result.current.subscribeToIncomingDMs();
      await result.current.syncMissedMessages();
    });

    expect(pool.subscribe).not.toHaveBeenCalled();
    expect(pool.sendToOpen).not.toHaveBeenCalled();
  });

  it("does not re-register queue processing when relay pool identity churns", async () => {
    const registerQueueProcessorSpy = vi.spyOn(messagingTransportRuntime, "registerQueueProcessor");
    const unregisterQueueProcessorSpy = vi.spyOn(messagingTransportRuntime, "unregisterQueueProcessor");

    const { rerender, unmount } = renderHook(
      ({ relayPool }: { relayPool: typeof pool }) =>
        useEnhancedDMController({
          myPublicKeyHex: myPublicKey,
          myPrivateKeyHex: myPrivateKey,
          pool: relayPool as any,
          enableIncomingTransport: false,
          enableAutoQueueProcessing: true,
          transportOwnerId: "runtime_singleton_owner",
        }),
      {
        initialProps: { relayPool: pool },
      }
    );

    await waitFor(() => {
      expect(registerQueueProcessorSpy).toHaveBeenCalledTimes(1);
    });

    rerender({
      relayPool: {
        ...pool,
        connections: [...pool.connections],
      },
    });

    await waitFor(() => {
      expect(registerQueueProcessorSpy).toHaveBeenCalledTimes(1);
      expect(unregisterQueueProcessorSpy).toHaveBeenCalledTimes(0);
    });

    unmount();

    expect(unregisterQueueProcessorSpy).toHaveBeenCalledTimes(1);
    registerQueueProcessorSpy.mockRestore();
    unregisterQueueProcessorSpy.mockRestore();
  });

  it("replays DM subscriptions when the open relay set changes", async () => {
    const nowUnixMs = 1_773_481_705_000;
    const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(nowUnixMs);
    try {
      pool.sendToOpen.mockImplementation((payload: string) => {
        try {
          const parsed = JSON.parse(payload) as unknown;
          if (!Array.isArray(parsed) || parsed[0] !== "REQ" || typeof parsed[1] !== "string") {
            return;
          }
          const subId = parsed[1];
          queueMicrotask(() => {
            messageHandlers.forEach((handler) => {
              handler({
                url: "wss://relay-2.example",
                message: JSON.stringify(["EOSE", subId]),
              });
            });
          });
        } catch {
          return;
        }
      });

      const { result, rerender } = renderHook(
        ({ relayPool }: { relayPool: typeof pool }) =>
          useEnhancedDMController({
            myPublicKeyHex: myPublicKey,
            myPrivateKeyHex: myPrivateKey,
            pool: relayPool as any,
          }),
        {
          initialProps: { relayPool: pool },
        }
      );

      await act(async () => {
        result.current.subscribeToIncomingDMs();
      });

      pool.sendToOpen.mockClear();
      pool.resubscribeAll.mockClear();
      pool.connections = [
        { url: "wss://relay-2.example", status: "open", updatedAtUnixMs: Date.now() },
        { url: "wss://relay-3.example", status: "open", updatedAtUnixMs: Date.now() },
      ];

      rerender({ relayPool: pool });

      await waitFor(() => {
        expect(pool.resubscribeAll).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(pool.sendToOpen).toHaveBeenCalled();
      });

      const reqMessages = pool.sendToOpen.mock.calls
        .map((call) => {
          const payload = call[0];
          if (typeof payload !== "string") {
            return null;
          }
          try {
            return JSON.parse(payload) as unknown;
          } catch {
            return null;
          }
        })
        .filter((parsed): parsed is [string, string, Record<string, unknown>] => (
          Array.isArray(parsed)
          && parsed[0] === "REQ"
          && typeof parsed[1] === "string"
          && typeof parsed[2] === "object"
          && parsed[2] !== null
        ));

      const forcedSyncReq = reqMessages.find((entry) => {
        const filter = entry[2] as { since?: unknown };
        return typeof filter.since === "number";
      });

      expect(forcedSyncReq).toBeTruthy();
      expect((forcedSyncReq?.[2] as { since?: number }).since).toBe(Math.floor((nowUnixMs - 120_000) / 1000));
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it("routes incoming kind 10002 relay-list events through verified NIP-65 ingestion", async () => {
    renderHook(() =>
      useEnhancedDMController({
        myPublicKeyHex: myPublicKey,
        myPrivateKeyHex: myPrivateKey,
        pool: pool as any,
      })
    );

    const event = {
      ...buildSignedEvent("nip65-1", "", [["r", "wss://recipient.example", "write"]]),
      kind: 10002,
      pubkey: peerPublicKey,
    };

    await act(async () => {
      await Promise.all(messageHandlers.map((handler) => handler({
        url: "wss://relay-1.example",
        message: JSON.stringify(["EVENT", "sub-id", event]),
      })));
    });

    await waitFor(() => {
      expect(nip65Service.ingestVerifiedEvent).toHaveBeenCalledWith(event);
    });
  });

  it("verifies signature and decrypts incoming DM before persisting", async () => {
    renderHook(() =>
      useEnhancedDMController({
        myPublicKeyHex: myPublicKey,
        myPrivateKeyHex: myPrivateKey,
        pool: pool as any,
      })
    );

    expect(subscribedEventHandler).toBeTruthy();
    const event = {
      ...buildSignedEvent("incoming-1", "ciphertext", [["p", myPublicKey]]),
      pubkey: peerPublicKey,
    };

    await act(async () => {
      await subscribedEventHandler?.(event, "wss://relay-1.example");
    });

    await waitFor(() => {
      expect(cryptoService.verifyEventSignature).toHaveBeenCalledWith(event);
      expect(mockMessageQueueInstance.persistMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "incoming-1",
          content: "incoming plaintext",
          isOutgoing: false,
        })
      );
    });
    expect(
      vi.mocked(cryptoService.decryptDM).mock.calls.length +
      vi.mocked(cryptoService.decryptGiftWrap).mock.calls.length
    ).toBeGreaterThan(0);
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
      await subscribedEventHandler?.(event, "wss://relay-1.example");
    });

    expect(cryptoService.verifyEventSignature).toHaveBeenCalledWith(event);
    expect(cryptoService.decryptDM).not.toHaveBeenCalled();
    expect(mockMessageQueueInstance.persistMessage).not.toHaveBeenCalled();
  });
});
