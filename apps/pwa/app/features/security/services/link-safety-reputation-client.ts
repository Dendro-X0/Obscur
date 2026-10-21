/**
 * PB2-C — URL-only reputation fetch (URLHaus).
 * Caller must gate on setting + consent; this module never reads message body.
 */

import {
  buildUrlReputationRequest,
  type UrlReputationRequest,
} from "./link-safety-request-builder";
import { LINK_SAFETY_DEFAULT_PROVIDER_LABEL } from "./link-safety-policy";

export type UrlReputationVerdict =
  | "malicious"
  | "suspicious"
  | "clean"
  | "unknown"
  | "error";

export type UrlReputationLookupResult = Readonly<{
  verdict: UrlReputationVerdict;
  providerLabel: string;
  url: string;
  detail: string;
  queried: boolean;
}>;

export type UrlReputationFetchDeps = Readonly<{
  fetch?: typeof fetch;
  endpointUrl?: string;
}>;

export const URLHAUS_URL_LOOKUP_ENDPOINT = "https://urlhaus-api.abuse.ch/v1/url/";

type UrlHausResponse = Readonly<{
  query_status?: string;
  threat?: string;
  url_status?: string;
  blacklists?: Readonly<Record<string, string>>;
}>;

export const mapUrlHausResponseToVerdict = (
  payload: UrlHausResponse,
): Readonly<{ verdict: UrlReputationVerdict; detail: string }> => {
  const status = (payload.query_status ?? "").trim().toLowerCase();
  if (status === "ok") {
    const threat = (payload.threat ?? payload.url_status ?? "listed").trim();
    return {
      verdict: "malicious",
      detail: threat ? `Listed by URLHaus (${threat})` : "Listed by URLHaus",
    };
  }
  if (status === "no_results") {
    return { verdict: "clean", detail: "No URLHaus listing for this URL" };
  }
  if (status === "invalid_url") {
    return { verdict: "error", detail: "Provider rejected URL as invalid" };
  }
  if (status === "blacklists" || status === "blacklist") {
    return { verdict: "suspicious", detail: "URLHaus blacklist hit" };
  }
  return {
    verdict: "unknown",
    detail: status ? `URLHaus status: ${status}` : "URLHaus returned an empty status",
  };
};

/**
 * Lookup URL reputation. Sends only `url=` form body — never message/contact/key fields.
 */
export const fetchUrlReputation = async (
  rawUrl: string,
  deps: UrlReputationFetchDeps = {},
): Promise<UrlReputationLookupResult> => {
  const built = buildUrlReputationRequest({
    url: rawUrl,
    providerLabel: LINK_SAFETY_DEFAULT_PROVIDER_LABEL,
  });
  if (!built.ok) {
    return {
      verdict: "error",
      providerLabel: LINK_SAFETY_DEFAULT_PROVIDER_LABEL,
      url: rawUrl,
      detail: `Request rejected: ${built.reason}`,
      queried: false,
    };
  }
  return fetchUrlReputationForRequest(built.request, deps);
};

export const fetchUrlReputationForRequest = async (
  request: UrlReputationRequest,
  deps: UrlReputationFetchDeps = {},
): Promise<UrlReputationLookupResult> => {
  const fetchImpl = deps.fetch ?? fetch;
  const endpoint = deps.endpointUrl ?? URLHAUS_URL_LOOKUP_ENDPOINT;
  const body = new URLSearchParams({ url: request.url }).toString();

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    });
    if (!response.ok) {
      return {
        verdict: "error",
        providerLabel: request.providerLabel,
        url: request.url,
        detail: `Provider HTTP ${response.status}`,
        queried: true,
      };
    }
    const payload = (await response.json()) as UrlHausResponse;
    const mapped = mapUrlHausResponseToVerdict(payload);
    return {
      verdict: mapped.verdict,
      providerLabel: request.providerLabel,
      url: request.url,
      detail: mapped.detail,
      queried: true,
    };
  } catch (error) {
    return {
      verdict: "error",
      providerLabel: request.providerLabel,
      url: request.url,
      detail: error instanceof Error ? error.message : "Reputation lookup failed",
      queried: true,
    };
  }
};

/** L1 helper — assert outbound body is URL-only form encoding. */
export const buildUrlHausFormBody = (url: string): string =>
  new URLSearchParams({ url }).toString();
