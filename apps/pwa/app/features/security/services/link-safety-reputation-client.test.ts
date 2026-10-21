import { describe, expect, it, vi } from "vitest";
import {
  buildUrlHausFormBody,
  fetchUrlReputation,
  mapUrlHausResponseToVerdict,
} from "./link-safety-reputation-client";

describe("link-safety-reputation-client (PB2-C)", () => {
  it("form body contains only the url field", () => {
    const body = buildUrlHausFormBody("https://evil.example/phish");
    expect(body).toBe("url=https%3A%2F%2Fevil.example%2Fphish");
    expect(body).not.toMatch(/body|pubkey|nsec|conversation/i);
  });

  it("maps URLHaus statuses to verdicts", () => {
    expect(mapUrlHausResponseToVerdict({ query_status: "ok", threat: "malware_download" })).toEqual({
      verdict: "malicious",
      detail: "Listed by URLHaus (malware_download)",
    });
    expect(mapUrlHausResponseToVerdict({ query_status: "no_results" }).verdict).toBe("clean");
    expect(mapUrlHausResponseToVerdict({ query_status: "invalid_url" }).verdict).toBe("error");
  });

  it("POSTs URL-only body via injected fetch", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ query_status: "no_results" }),
    })) as unknown as typeof fetch;

    const result = await fetchUrlReputation("https://example.com/path", {
      fetch: fetchMock,
      endpointUrl: "https://urlhaus.test/v1/url/",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(init.method).toBe("POST");
    expect(init.body).toBe("url=https%3A%2F%2Fexample.com%2Fpath");
    expect(String(init.body)).not.toMatch(/message|pubkey|nsec/);
    expect(result.verdict).toBe("clean");
    expect(result.queried).toBe(true);
  });

  it("does not query when request builder rejects the URL", async () => {
    const fetchMock = vi.fn() as unknown as typeof fetch;
    const result = await fetchUrlReputation("obscur://invite/x", { fetch: fetchMock });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.queried).toBe(false);
    expect(result.verdict).toBe("error");
  });
});
