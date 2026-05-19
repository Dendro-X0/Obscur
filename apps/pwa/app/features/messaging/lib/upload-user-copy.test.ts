import { describe, expect, it } from "vitest";
import {
  getUploadFailureUserMessage,
  getUploadFailureUserMessageFromUnknown,
  inferUploadDeliveryReasonCode,
} from "./upload-user-copy";
import { UploadError, UploadErrorCode } from "../types";

describe("upload-user-copy", () => {
  it("maps network timeout to upload_timeout reason", () => {
    const error = new UploadError(UploadErrorCode.NETWORK_ERROR, "Upload timed out: provider");
    expect(inferUploadDeliveryReasonCode(error)).toBe("upload_timeout");
    expect(getUploadFailureUserMessage(error)).toMatch(/timed out/i);
  });

  it("maps provider errors to upload_provider_failed copy", () => {
    const error = new UploadError(UploadErrorCode.PROVIDER_ERROR, "HTTP 500");
    expect(inferUploadDeliveryReasonCode(error)).toBe("upload_provider_failed");
    expect(getUploadFailureUserMessage(error)).toMatch(/could not be completed/i);
  });

  it("maps session errors to unlock copy", () => {
    expect(getUploadFailureUserMessage(
      new UploadError(UploadErrorCode.NO_SESSION, "native session missing"),
    )).toMatch(/Lock and unlock/i);
  });

  it("appends storage note when requested", () => {
    const message = getUploadFailureUserMessage(
      new UploadError(UploadErrorCode.PROVIDER_ERROR, "fail"),
      { storageNote: "(Storage is best-effort.)" },
    );
    expect(message).toContain("(Storage is best-effort.)");
  });

  it("getUploadFailureUserMessageFromUnknown handles UploadError", () => {
    expect(getUploadFailureUserMessageFromUnknown(
      new UploadError(UploadErrorCode.FILE_TOO_LARGE, "Max 25 MB"),
      "Upload failed.",
    )).toMatch(/25 MB/);
  });
});
