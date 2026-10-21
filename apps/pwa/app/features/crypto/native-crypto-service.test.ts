import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/features/runtime/native-adapters", () => ({
    invokeNativeCommand: vi.fn(),
}));

import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { CryptoServiceImpl } from "./crypto-service-impl";
import { NATIVE_KEY_SENTINEL, NativeCryptoService, nativeCryptoServiceInternals } from "./native-crypto-service";
import type { UnsignedNostrEvent } from "./crypto-interfaces";

const baseRumor: UnsignedNostrEvent = {
    pubkey: "a".repeat(64),
    created_at: 1_700_000_000,
    kind: 14,
    tags: [["p", "b".repeat(64)]],
    content: "hello",
};

describe("native-crypto-service rumor id helpers", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.mocked(invokeNativeCommand).mockReset();
    });

    it("derives rumor ids via native command (fail-closed)", async () => {
        const id = "a".repeat(64);
        vi.mocked(invokeNativeCommand).mockResolvedValueOnce({ ok: true, value: id } as any);
        vi.mocked(invokeNativeCommand).mockResolvedValueOnce({ ok: true, value: id } as any);

        const first = await nativeCryptoServiceInternals.deriveRumorEventId(baseRumor);
        const second = await nativeCryptoServiceInternals.deriveRumorEventId(baseRumor);

        expect(first).toBe(id);
        expect(second).toBe(id);
        expect(invokeNativeCommand).toHaveBeenCalledWith(
            "derive_rumor_event_id",
            expect.objectContaining({
                pubkey: baseRumor.pubkey,
                createdAt: baseRumor.created_at,
                kind: baseRumor.kind,
                content: baseRumor.content,
            }),
            expect.objectContaining({ timeoutMs: expect.any(Number) }),
        );
    });

    it("fail-closes deriveRumorEventId when native returns error", async () => {
        vi.mocked(invokeNativeCommand).mockResolvedValueOnce({
            ok: false,
            message: "native_digest_failed",
        } as any);

        await expect(nativeCryptoServiceInternals.deriveRumorEventId(baseRumor)).rejects.toThrow(
            /native_digest_failed/,
        );
    });

    it("prefers explicit rumor ids and invokes native when missing", async () => {
        const derivedId = "b".repeat(64);
        vi.mocked(invokeNativeCommand).mockResolvedValueOnce({ ok: true, value: derivedId } as any);

        const explicit = await nativeCryptoServiceInternals.resolveRumorEventId({
            ...baseRumor,
            id: "event-123",
        });
        const derived = await nativeCryptoServiceInternals.resolveRumorEventId({
            ...baseRumor,
            id: "",
        });

        expect(explicit).toBe("event-123");
        expect(derived).toBe(derivedId);
        expect(invokeNativeCommand).toHaveBeenCalledTimes(1);
    });

    it("fail-closes decryptGiftWrap on native failure (no JS nsec fallback)", async () => {
        vi.mocked(invokeNativeCommand).mockResolvedValueOnce({
            ok: false,
            message: "native_decrypt_failed",
        } as any);

        const decryptFallbackSpy = vi.spyOn(CryptoServiceImpl.prototype, "decryptGiftWrap");

        const service = new NativeCryptoService();
        await expect(
            service.decryptGiftWrap({
                id: "gift",
                pubkey: "b".repeat(64),
                created_at: 1,
                kind: 1059,
                tags: [["p", "c".repeat(64)]],
                content: "invalid",
                sig: "",
            } as any, NATIVE_KEY_SENTINEL),
        ).rejects.toThrow(/native_decrypt_failed/);

        expect(decryptFallbackSpy).not.toHaveBeenCalled();
        expect(invokeNativeCommand).toHaveBeenCalledTimes(1);
    });

    it("fail-closes encryptGiftWrap on native failure (no JS nsec fallback)", async () => {
        vi.mocked(invokeNativeCommand)
            .mockResolvedValueOnce({ ok: true, value: "c".repeat(64) } as any)
            .mockResolvedValueOnce({
                ok: false,
                message: "native_encrypt_failed",
            } as any);

        const encryptFallbackSpy = vi.spyOn(CryptoServiceImpl.prototype, "encryptGiftWrap");

        const service = new NativeCryptoService();
        await expect(
            service.encryptGiftWrap(
                baseRumor,
                NATIVE_KEY_SENTINEL,
                "f".repeat(64) as any,
            ),
        ).rejects.toThrow(/native_encrypt_failed/);

        expect(encryptFallbackSpy).not.toHaveBeenCalled();
        expect(invokeNativeCommand).toHaveBeenCalledTimes(2);
        expect(invokeNativeCommand).toHaveBeenNthCalledWith(
            1,
            "derive_rumor_event_id",
            expect.anything(),
            expect.anything(),
        );
        expect(invokeNativeCommand).toHaveBeenNthCalledWith(
            2,
            "encrypt_gift_wrap",
            expect.anything(),
            expect.anything(),
        );
    });

    it("fail-closes generateKeyPair on native failure (no web keygen fallback)", async () => {
        vi.mocked(invokeNativeCommand).mockResolvedValueOnce({
            ok: false,
            message: "native_generate_failed",
        } as any);

        const generateFallbackSpy = vi.spyOn(CryptoServiceImpl.prototype, "generateKeyPair");

        const service = new NativeCryptoService();
        await expect(service.generateKeyPair()).rejects.toThrow(/native_generate_failed/);

        expect(generateFallbackSpy).not.toHaveBeenCalled();
        expect(invokeNativeCommand).toHaveBeenCalledTimes(1);
    });

    it("routes group AES through native commands (fail-closed, no JS fallback)", async () => {
        vi.mocked(invokeNativeCommand)
            .mockResolvedValueOnce({ ok: true, value: "a".repeat(64) } as any)
            .mockResolvedValueOnce({ ok: true, value: "cipher?v=1" } as any)
            .mockResolvedValueOnce({ ok: false, message: "native_group_decrypt_failed" } as any);

        const encryptSpy = vi.spyOn(CryptoServiceImpl.prototype, "encryptGroupMessage");
        const decryptSpy = vi.spyOn(CryptoServiceImpl.prototype, "decryptGroupMessage");
        const generateSpy = vi.spyOn(CryptoServiceImpl.prototype, "generateRoomKey");

        const service = new NativeCryptoService();
        await expect(service.generateRoomKey()).resolves.toBe("a".repeat(64));
        await expect(service.encryptGroupMessage("hi", "b".repeat(64))).resolves.toBe("cipher?v=1");
        await expect(service.decryptGroupMessage("cipher?v=1", "b".repeat(64))).rejects.toThrow(
            /native_group_decrypt_failed/,
        );

        expect(invokeNativeCommand).toHaveBeenCalledWith("generate_group_room_key", undefined, expect.anything());
        expect(invokeNativeCommand).toHaveBeenCalledWith(
            "encrypt_group_message",
            { plaintext: "hi", roomKeyHex: "b".repeat(64) },
            expect.anything(),
        );
        expect(generateSpy).not.toHaveBeenCalled();
        expect(encryptSpy).not.toHaveBeenCalled();
        expect(decryptSpy).not.toHaveBeenCalled();
    });

    it("routes generateSecureRandom / generateInviteId / verifyEventSignature natively", async () => {
        vi.mocked(invokeNativeCommand)
            .mockResolvedValueOnce({ ok: true, value: "ab".repeat(16) } as any)
            .mockResolvedValueOnce({ ok: true, value: "cd".repeat(16) } as any)
            .mockResolvedValueOnce({ ok: true, value: true } as any)
            .mockResolvedValueOnce({ ok: false, message: "native_random_failed" } as any);

        const randomSpy = vi.spyOn(CryptoServiceImpl.prototype, "generateSecureRandom");
        const inviteSpy = vi.spyOn(CryptoServiceImpl.prototype, "generateInviteId");
        const verifySpy = vi.spyOn(CryptoServiceImpl.prototype, "verifyEventSignature");
        const service = new NativeCryptoService();

        const bytes = await service.generateSecureRandom(16);
        expect(bytes).toHaveLength(16);
        await expect(service.generateInviteId()).resolves.toBe("cd".repeat(16));
        await expect(
            service.verifyEventSignature({
                id: "e".repeat(64),
                pubkey: "a".repeat(64),
                created_at: 1,
                kind: 1,
                tags: [],
                content: "hi",
                sig: "f".repeat(128),
            } as any),
        ).resolves.toBe(true);
        await expect(service.generateSecureRandom(8)).rejects.toThrow(/native_random_failed/);

        expect(invokeNativeCommand).toHaveBeenCalledWith(
            "generate_secure_random",
            { length: 16 },
            expect.anything(),
        );
        expect(invokeNativeCommand).toHaveBeenCalledWith(
            "verify_nostr_event",
            expect.objectContaining({ content: "hi" }),
            expect.anything(),
        );
        expect(randomSpy).not.toHaveBeenCalled();
        expect(inviteSpy).not.toHaveBeenCalled();
        expect(verifySpy).not.toHaveBeenCalled();
    });

    it("routes deriveSharedSecret through native command (fail-closed)", async () => {
        const digestHex = "ab".repeat(32);
        vi.mocked(invokeNativeCommand)
            .mockResolvedValueOnce({ ok: true, value: digestHex } as any)
            .mockResolvedValueOnce({ ok: false, message: "native_shared_secret_failed" } as any);

        const deriveSpy = vi.spyOn(CryptoServiceImpl.prototype, "deriveSharedSecret");
        const service = new NativeCryptoService();

        const secret = await service.deriveSharedSecret(NATIVE_KEY_SENTINEL, "c".repeat(64) as any);
        expect(Array.from(secret)).toEqual(
            Array.from({ length: 32 }, (_, i) => parseInt(digestHex.slice(i * 2, i * 2 + 2), 16)),
        );
        await expect(
            service.deriveSharedSecret(NATIVE_KEY_SENTINEL, "c".repeat(64) as any),
        ).rejects.toThrow(/native_shared_secret_failed/);

        expect(invokeNativeCommand).toHaveBeenCalledWith(
            "derive_shared_secret",
            { publicKey: "c".repeat(64) },
            expect.anything(),
        );
        expect(deriveSpy).not.toHaveBeenCalled();
    });

    it("routes invite sign/verify through native commands (fail-closed)", async () => {
        const payload = {
            publicKey: "a".repeat(64),
            timestamp: 1_700_000_000_000,
            expirationTime: 1_800_000_000_000,
            inviteId: "card-v1-test",
        };
        vi.mocked(invokeNativeCommand)
            .mockResolvedValueOnce({ ok: true, value: "d".repeat(128) } as any)
            .mockResolvedValueOnce({ ok: true, value: true } as any)
            .mockResolvedValueOnce({ ok: false, message: "native_invite_sign_failed" } as any);

        const signSpy = vi.spyOn(CryptoServiceImpl.prototype, "signInviteData");
        const verifySpy = vi.spyOn(CryptoServiceImpl.prototype, "verifyInviteSignature");

        const service = new NativeCryptoService();
        await expect(service.signInviteData(payload as any, NATIVE_KEY_SENTINEL)).resolves.toBe(
            "d".repeat(128),
        );
        await expect(
            service.verifyInviteSignature(payload as any, "d".repeat(128), "a".repeat(64) as any),
        ).resolves.toBe(true);
        await expect(service.signInviteData(payload as any, NATIVE_KEY_SENTINEL)).rejects.toThrow(
            /native_invite_sign_failed/,
        );

        expect(invokeNativeCommand).toHaveBeenCalledWith(
            "sign_invite_data",
            expect.objectContaining({ canonicalData: expect.stringContaining("inviteId:") }),
            expect.anything(),
        );
        expect(invokeNativeCommand).toHaveBeenCalledWith(
            "verify_invite_signature",
            expect.objectContaining({
                signature: "d".repeat(128),
                publicKey: "a".repeat(64),
            }),
            expect.anything(),
        );
        expect(signSpy).not.toHaveBeenCalled();
        expect(verifySpy).not.toHaveBeenCalled();
    });

    it("routes invite AES through native commands (fail-closed, no JS fallback)", async () => {
        const key = new Uint8Array(32).fill(0xab);
        const keyHex = "ab".repeat(32);
        vi.mocked(invokeNativeCommand)
            .mockResolvedValueOnce({ ok: true, value: "base64cipher" } as any)
            .mockResolvedValueOnce({ ok: false, message: "native_invite_decrypt_failed" } as any);

        const encryptSpy = vi.spyOn(CryptoServiceImpl.prototype, "encryptInviteData");
        const decryptSpy = vi.spyOn(CryptoServiceImpl.prototype, "decryptInviteData");

        const service = new NativeCryptoService();
        await expect(service.encryptInviteData("payload", key)).resolves.toBe("base64cipher");
        await expect(service.decryptInviteData("base64cipher", key)).rejects.toThrow(
            /native_invite_decrypt_failed/,
        );

        expect(invokeNativeCommand).toHaveBeenCalledWith(
            "encrypt_invite_data",
            { plaintext: "payload", keyHex },
            expect.anything(),
        );
        expect(encryptSpy).not.toHaveBeenCalled();
        expect(decryptSpy).not.toHaveBeenCalled();
    });

    it("invokes native session initialization without client timeout overrides", async () => {
        const service = new NativeCryptoService();
        vi.mocked(invokeNativeCommand).mockResolvedValueOnce({
            ok: true,
            value: { success: true, npub: "npub1test" },
        } as any);

        await service.initNativeSession("3".repeat(64));

        expect(invokeNativeCommand).toHaveBeenCalledWith(
            "init_native_session",
            { nsec: "3".repeat(64) }
        );
    });

    it("uses bounded timeout for native session discovery probes", async () => {
        const service = new NativeCryptoService();

        vi.mocked(invokeNativeCommand).mockResolvedValueOnce({
            ok: true,
            value: "npub1probe",
        } as any);
        const hasNativeKey = await service.hasNativeKey();

        expect(hasNativeKey).toBe(true);
        expect(invokeNativeCommand).toHaveBeenCalledWith(
            "get_native_npub",
            undefined,
            { timeoutMs: nativeCryptoServiceInternals.NATIVE_SESSION_DISCOVERY_TIMEOUT_MS }
        );

        vi.mocked(invokeNativeCommand).mockClear();
        vi.mocked(invokeNativeCommand).mockResolvedValueOnce({
            ok: true,
            value: "npub1probe2",
        } as any);
        const npub = await service.getNativeNpub();

        expect(npub).toBe("npub1probe2");
        expect(invokeNativeCommand).toHaveBeenCalledWith(
            "get_native_npub",
            undefined,
            { timeoutMs: nativeCryptoServiceInternals.NATIVE_SESSION_DISCOVERY_TIMEOUT_MS }
        );
    });
});
