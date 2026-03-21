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

    it("derives deterministic rumor ids from content", async () => {
        const first = await nativeCryptoServiceInternals.deriveRumorEventId(baseRumor);
        const second = await nativeCryptoServiceInternals.deriveRumorEventId(baseRumor);
        const fallbackA = nativeCryptoServiceInternals.fallbackDigestHex("payload-a");
        const fallbackB = nativeCryptoServiceInternals.fallbackDigestHex("payload-b");

        expect(first).toMatch(/^[0-9a-f]{64}$/);
        expect(first).toBe(second);
        expect(fallbackA).toMatch(/^[0-9a-f]{64}$/);
        expect(fallbackB).toMatch(/^[0-9a-f]{64}$/);
        expect(fallbackB).not.toBe(fallbackA);
    });

    it("prefers explicit rumor ids and falls back when missing", async () => {
        const explicit = await nativeCryptoServiceInternals.resolveRumorEventId({
            ...baseRumor,
            id: "event-123",
        });
        const derived = await nativeCryptoServiceInternals.resolveRumorEventId({
            ...baseRumor,
            id: "",
        });

        expect(explicit).toBe("event-123");
        expect(derived).toMatch(/^[0-9a-f]{64}$/);
    });

    it("falls back to JS decryptGiftWrap with actual native session key", async () => {
        vi.mocked(invokeNativeCommand)
            .mockResolvedValueOnce({ ok: false, message: "native_decrypt_failed" } as any)
            .mockResolvedValueOnce({ ok: true, value: "1".repeat(64) } as any);

        const decryptFallbackSpy = vi
            .spyOn(CryptoServiceImpl.prototype, "decryptGiftWrap")
            .mockResolvedValue({
                id: "rumor",
                pubkey: "a".repeat(64),
                created_at: 1,
                kind: 14,
                tags: [],
                content: "ok",
                sig: "",
            } as any);

        const service = new NativeCryptoService();
        await service.decryptGiftWrap({
            id: "gift",
            pubkey: "b".repeat(64),
            created_at: 1,
            kind: 1059,
            tags: [["p", "c".repeat(64)]],
            content: "invalid",
            sig: "",
        } as any, NATIVE_KEY_SENTINEL);

        expect(decryptFallbackSpy).toHaveBeenCalledTimes(1);
        expect(decryptFallbackSpy.mock.calls[0]?.[1]).toBe("1".repeat(64));
    });

    it("falls back to JS encryptGiftWrap with actual native session key", async () => {
        vi.mocked(invokeNativeCommand)
            .mockResolvedValueOnce({ ok: false, message: "native_encrypt_failed" } as any)
            .mockResolvedValueOnce({ ok: true, value: "2".repeat(64) } as any);

        const encryptFallbackSpy = vi
            .spyOn(CryptoServiceImpl.prototype, "encryptGiftWrap")
            .mockResolvedValue({
                id: "gift",
                pubkey: "d".repeat(64),
                created_at: 1,
                kind: 1059,
                tags: [["p", "e".repeat(64)]],
                content: "wrapped",
                sig: "",
            } as any);

        const service = new NativeCryptoService();
        await service.encryptGiftWrap(
            baseRumor,
            NATIVE_KEY_SENTINEL,
            "f".repeat(64) as any
        );

        expect(encryptFallbackSpy).toHaveBeenCalledTimes(1);
        expect(encryptFallbackSpy.mock.calls[0]?.[1]).toBe("2".repeat(64));
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
