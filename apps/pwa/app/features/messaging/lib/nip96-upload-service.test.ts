import { afterEach, describe, expect, it, vi } from "vitest";
import { Nip96UploadService, nip96UploadInternals } from "./nip96-upload-service";
import { UploadError, UploadErrorCode } from "../types";

describe("nip96-upload-service internals", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("maps timeout network errors to upload_timeout and retryable", () => {
    const outcome = nip96UploadInternals.classifyUploadError(
      new UploadError(UploadErrorCode.NETWORK_ERROR, "Upload timed out: native provider")
    );
    expect(outcome.reasonCode).toBe("upload_timeout");
    expect(outcome.retryable).toBe(true);
  });

  it("maps provider failures to upload_provider_failed", () => {
    const outcome = nip96UploadInternals.classifyUploadError(
      new UploadError(UploadErrorCode.PROVIDER_ERROR, "HTTP 500")
    );
    expect(outcome.reasonCode).toBe("upload_provider_failed");
    expect(outcome.retryable).toBe(true);
  });

  it("maps auth/session failures to unsupported_runtime and terminal", () => {
    const outcome = nip96UploadInternals.classifyUploadError(
      new UploadError(UploadErrorCode.NO_SESSION, "No native session")
    );
    expect(outcome.reasonCode).toBe("unsupported_runtime");
    expect(outcome.retryable).toBe(false);
  });

  it("builds root upload URL variants for strict NIP-98 URL matching", () => {
    const variants = nip96UploadInternals.toRootUploadVariants("https://cdn.nostrcheck.me");
    expect(variants).toContain("https://cdn.nostrcheck.me");
    expect(variants).toContain("https://cdn.nostrcheck.me/");
  });

  it("aborts well-known provider discovery when timeout is reached", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_: RequestInfo | URL, init?: RequestInit) => (
      new Promise<Response>((_, reject) => {
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          }, { once: true });
        }
      })
    ));
    vi.stubGlobal("fetch", fetchMock);

    const service = new Nip96UploadService([], null, null);
    const resolvePromise = (
      service as unknown as { resolveApiUrlFromWellKnown(originUrl: string): Promise<string | null> }
    ).resolveApiUrlFromWellKnown("https://upload.example");

    await vi.advanceTimersByTimeAsync(nip96UploadInternals.wellKnownDiscoveryTimeoutMs + 200);
    await expect(resolvePromise).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
