import { beforeEach, describe, expect, it, vi } from "vitest";
import { probeDmKernelWrite } from "@/app/features/dm-kernel/dm-kernel-write-port";

vi.mock("@/app/features/dm-kernel/dm-kernel-write-port", () => ({
  probeDmKernelWrite: vi.fn(),
}));

describe("probeNativeDmSqliteWrite", () => {
  beforeEach(() => {
    vi.mocked(probeDmKernelWrite).mockReset();
  });

  it("delegates to dm-kernel write probe", async () => {
    vi.mocked(probeDmKernelWrite).mockResolvedValue({
      ok: true,
      reason: "roundtrip_ok",
      errorMessage: null,
    });
    const { probeNativeDmSqliteWrite } = await import("./native-dm-sqlite-write-probe");
    const result = await probeNativeDmSqliteWrite();
    expect(result.ok).toBe(true);
    expect(result.reason).toBe("roundtrip_ok");
    expect(probeDmKernelWrite).toHaveBeenCalled();
  });

  it("surfaces kernel probe failures", async () => {
    vi.mocked(probeDmKernelWrite).mockResolvedValue({
      ok: false,
      reason: "invoke_failed",
      errorMessage: "db_insert_message not allowed",
    });
    const { probeNativeDmSqliteWrite } = await import("./native-dm-sqlite-write-probe");
    const result = await probeNativeDmSqliteWrite();
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("invoke_failed");
    expect(result.errorMessage).toContain("not allowed");
  });
});
