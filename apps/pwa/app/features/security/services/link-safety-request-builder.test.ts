import { describe, expect, it } from "vitest";
import {
  buildUrlReputationRequest,
  reputationRequestPayloadKeys,
} from "./link-safety-request-builder";

describe("buildUrlReputationRequest (PB2-A)", () => {
  it("builds URL-only request for https links", () => {
    const result = buildUrlReputationRequest({
      url: "https://evil.example/path?q=1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.request.url).toBe("https://evil.example/path?q=1");
    expect(reputationRequestPayloadKeys(result.request)).toEqual([
      "providerLabel",
      "url",
    ]);
  });

  it("rejects empty and invalid URLs", () => {
    expect(buildUrlReputationRequest({ url: "   " }).ok).toBe(false);
    expect(buildUrlReputationRequest({ url: "not a url" })).toEqual({
      ok: false,
      reason: "invalid_url",
    });
  });

  it("rejects non-http schemes", () => {
    expect(buildUrlReputationRequest({ url: "obscur://invite/abc" })).toEqual({
      ok: false,
      reason: "non_http_scheme",
    });
  });

  it("rejects when forbidden message/graph/key fields are present", () => {
    expect(
      buildUrlReputationRequest({
        url: "https://example.com",
        extras: { body: "secret message body" },
      }),
    ).toEqual({ ok: false, reason: "forbidden_fields_present" });

    expect(
      buildUrlReputationRequest({
        url: "https://example.com",
        extras: { conversationId: "dm-1", pubkey: "abc" },
      }),
    ).toEqual({ ok: false, reason: "forbidden_fields_present" });

    expect(
      buildUrlReputationRequest({
        url: "https://example.com",
        extras: { nsec: "nsec1…" },
      }),
    ).toEqual({ ok: false, reason: "forbidden_fields_present" });
  });

  it("allows benign extras that are not forbidden keys", () => {
    const result = buildUrlReputationRequest({
      url: "http://example.com",
      extras: { locale: "en" },
      providerLabel: "URLScan",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.request.providerLabel).toBe("URLScan");
    expect(Object.keys(result.request).sort()).toEqual(["providerLabel", "url"]);
  });
});
