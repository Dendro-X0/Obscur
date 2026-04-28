import { afterEach, describe, expect, it, vi } from "vitest";
import { Nip96UploadService, nip96UploadInternals } from "./nip96-upload-service";
import { UploadError, UploadErrorCode } from "../types";
import { MEDIA_RUNTIME_SAFETY_LIMITS } from "./media-upload-policy";

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

  it("prefers browser upload for oversized native files to avoid byte-buffer pressure", async () => {
    const service = new Nip96UploadService(["https://upload.example"], null, null);
    const uploadViaBrowser = vi.fn(async () => ({
      kind: "video" as const,
      url: "https://upload.example/video.mp4",
      contentType: "video/mp4",
      fileName: "large-video.mp4",
    }));
    const uploadViaTauri = vi.fn(async () => ({
      kind: "video" as const,
      url: "https://upload.example/video.mp4",
      contentType: "video/mp4",
      fileName: "large-video.mp4",
    }));

    (service as any).isTauri = () => true;
    (service as any).resolveFallbackPrivateKeyHex = vi.fn(async () => "f".repeat(64));
    (service as any).uploadViaBrowser = uploadViaBrowser;
    (service as any).uploadViaTauri = uploadViaTauri;
    (service as any).withTimeout = async (promise: Promise<unknown>) => await promise;

    const file = new File(
      [new Uint8Array(MEDIA_RUNTIME_SAFETY_LIMITS.nativeDirectUploadBytes + 1)],
      "large-video.mp4",
      { type: "video/mp4" }
    );

    const attachment = await service.uploadFile(file);

    expect(uploadViaBrowser).toHaveBeenCalledTimes(1);
    expect(uploadViaTauri).not.toHaveBeenCalled();
    expect(attachment.url).toBe("https://upload.example/video.mp4");
  });

  it("rotates provider priority across sequential uploads", async () => {
    const service = new Nip96UploadService([
      "https://provider-one.example",
      "https://provider-two.example",
    ], null, null);
    const attemptedTargets: string[] = [];

    (service as any).isTauri = () => false;
    (service as any).resolveBrowserUploadTargets = vi.fn(async (providerUrl: string) => [providerUrl]);
    (service as any).uploadViaBrowser = vi.fn(async (file: File, targetUrl: string) => {
      attemptedTargets.push(targetUrl);
      return {
        kind: "video" as const,
        url: `${targetUrl}/${file.name}`,
        contentType: "video/mp4",
        fileName: file.name,
      };
    });
    (service as any).withTimeout = async (promise: Promise<unknown>) => await promise;

    const fileA = new File([new Uint8Array(1024)], "clip-a.mp4", { type: "video/mp4" });
    const fileB = new File([new Uint8Array(1024)], "clip-b.mp4", { type: "video/mp4" });

    await service.uploadFile(fileA);
    await service.uploadFile(fileB);

    expect(attemptedTargets[0]).toBe("https://provider-one.example");
    expect(attemptedTargets[1]).toBe("https://provider-two.example");
  });

  it("scales upload timeout with file size for low-bandwidth safety", () => {
    expect(nip96UploadInternals.resolveUploadTimeoutMs({
      fileSizeBytes: 5 * 1024 * 1024,
      baselineTimeoutMs: 60_000,
    })).toBe(60_000);

    expect(nip96UploadInternals.resolveUploadTimeoutMs({
      fileSizeBytes: 100 * 1024 * 1024,
      baselineTimeoutMs: 60_000,
    })).toBeGreaterThan(60_000);
  });

  it("honors the caller-provided browser fetch timeout for large uploads", async () => {
    vi.useFakeTimers();
    const service = new Nip96UploadService(["https://upload.example"], null, null);
    let activeSignal: AbortSignal | null | undefined;
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
      activeSignal = init?.signal;
      return new Promise<Response>((resolve, reject) => {
        resolveFetch = resolve;
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          }, { once: true });
        }
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    (service as any).resolveFallbackPrivateKeyHex = vi.fn(async () => "f".repeat(64));
    (service as any).signNip98Header = vi.fn(async () => "signed-header");

    const file = new File([new Uint8Array(1024)], "clip.mp4", { type: "video/mp4" });
    const uploadPromise = (service as any).uploadViaBrowser(
      file,
      "https://upload.example",
      "f".repeat(64),
      120_000,
    );

    await vi.advanceTimersByTimeAsync(45_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    if (!activeSignal) {
      throw new Error("Expected active fetch signal");
    }
    expect(activeSignal.aborted).toBe(false);

    if (!resolveFetch) {
      throw new Error("Expected fetch resolver to be set");
    }
    resolveFetch(new Response(JSON.stringify({
      status: "success",
      url: "https://upload.example/clip.mp4",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    await expect(uploadPromise).resolves.toMatchObject({
      url: "https://upload.example/clip.mp4",
    });
  });
});
