import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/features/crypto/crypto-service", () => ({
  cryptoService: {
    verifyEventSignature: vi.fn(),
  },
}));

import { cryptoService } from "@/app/features/crypto/crypto-service";
import { Nip65Service } from "./nip65-service";

const buildEvent = (overrides?: Partial<Record<string, unknown>>) => ({
  id: "event-1",
  kind: 10002,
  pubkey: "b".repeat(64),
  sig: "c".repeat(128),
  tags: [["r", "wss://trusted.example", "write"]],
  content: "",
  created_at: 1,
  ...overrides,
});

describe("Nip65Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("accepts a valid signed kind 10002 event and stores trusted relays", async () => {
    vi.mocked(cryptoService.verifyEventSignature).mockResolvedValue(true);
    const service = new Nip65Service();

    const result = await service.ingestVerifiedEvent(buildEvent({
      tags: [
        ["r", "wss://trusted.example/", "write"],
        ["r", "ws://127.0.0.1:7001", "write"],
      ],
    }));

    expect(result.status).toBe("accepted");
    expect(service.getWriteRelays("b".repeat(64) as any)).toEqual(["wss://trusted.example"]);
  });

  it("rejects invalid-signature events without mutating existing cache", async () => {
    const service = new Nip65Service();

    vi.mocked(cryptoService.verifyEventSignature).mockResolvedValue(true);
    await service.ingestVerifiedEvent(buildEvent({
      tags: [["r", "wss://existing.example", "write"]],
    }));

    vi.mocked(cryptoService.verifyEventSignature).mockResolvedValue(false);
    const result = await service.ingestVerifiedEvent(buildEvent({
      id: "event-2",
      tags: [["r", "wss://attacker.example", "write"]],
    }));

    expect(result).toEqual({ status: "ignored_invalid_signature" });
    expect(service.getWriteRelays("b".repeat(64) as any)).toEqual(["wss://existing.example"]);
  });

  it("rejects malformed or wrong-kind events", async () => {
    vi.mocked(cryptoService.verifyEventSignature).mockResolvedValue(true);
    const service = new Nip65Service();

    await expect(service.ingestVerifiedEvent({ kind: 4 })).resolves.toEqual({ status: "ignored_invalid_event" });
    await expect(service.ingestVerifiedEvent(buildEvent({ kind: 3 }))).resolves.toEqual({ status: "ignored_invalid_event" });
  });

  it("ignores events that contain no trusted relays", async () => {
    vi.mocked(cryptoService.verifyEventSignature).mockResolvedValue(true);
    const service = new Nip65Service();

    const result = await service.ingestVerifiedEvent(buildEvent({
      tags: [
        ["r", "ws://127.0.0.1:7001", "write"],
        ["r", "http://bad.example", "read"],
      ],
    }));

    expect(result).toEqual({ status: "ignored_no_trusted_relays" });
    expect(service.getRelayList("b".repeat(64) as any)).toBeUndefined();
  });

  it("verifies signature before mutating cache via updateFromEvent", async () => {
    const service = new Nip65Service();

    vi.mocked(cryptoService.verifyEventSignature).mockResolvedValue(false);
    const result = await service.updateFromEvent(buildEvent({
      tags: [["r", "wss://attacker.example", "write"]],
    }));

    expect(result).toBeNull();
    expect(service.getRelayList("b".repeat(64) as any)).toBeUndefined();
    expect(cryptoService.verifyEventSignature).toHaveBeenCalledTimes(1);
  });
});
