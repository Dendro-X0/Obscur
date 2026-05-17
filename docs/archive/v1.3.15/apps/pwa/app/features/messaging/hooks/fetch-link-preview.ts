import type { LinkPreview } from "../lib/link-preview";
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";

type LinkPreviewErrorBody = Readonly<{
  ok?: boolean;
  message?: string;
}>;

const toFallbackPreview = (url: string): LinkPreview => ({
  url,
  type: "web",
  title: null,
  description: null,
  siteName: null,
  imageUrl: null,
  provider: null,
});

export const fetchLinkPreview = async (url: string): Promise<LinkPreview> => {
  const normalizedUrl: string = url.trim();
  if (!normalizedUrl) {
    throw new Error("URL is required");
  }

  try {
    // Use our internal API route which handles server-side fetching and parsing
    const apiUrl = `/api/link-preview?url=${encodeURIComponent(normalizedUrl)}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      let body: LinkPreviewErrorBody | null = null;
      try {
        body = (await response.json()) as LinkPreviewErrorBody;
      } catch {
        body = null;
      }
      logRuntimeEvent(
        "messaging.link_preview.fetch_non_ok",
        "degraded",
        ["[LinkPreview] Preview endpoint returned non-OK; using fallback card.", { url: normalizedUrl, status: response.status, message: body?.message ?? null }],
        { windowMs: 20_000, maxPerWindow: 2, summaryEverySuppressed: 20 }
      );
      return toFallbackPreview(normalizedUrl);
    }

    const data = await response.json();
    if (!data.ok) {
      logRuntimeEvent(
        "messaging.link_preview.fetch_api_not_ok",
        "degraded",
        ["[LinkPreview] Preview API returned ok=false; using fallback card.", { url: normalizedUrl, message: data.message ?? null }],
        { windowMs: 20_000, maxPerWindow: 2, summaryEverySuppressed: 20 }
      );
      return toFallbackPreview(normalizedUrl);
    }

    return {
      url: normalizedUrl,
      type: data.type || "web",
      title: data.title,
      description: data.description,
      siteName: data.siteName,
      imageUrl: data.imageUrl,
      provider: data.provider,
    };
  } catch (error) {
    logRuntimeEvent(
      "messaging.link_preview.fetch_failed",
      "degraded",
      ["[LinkPreview] Unexpected preview fetch failure; using fallback card.", { url: normalizedUrl, error: error instanceof Error ? error.message : String(error) }],
      { windowMs: 20_000, maxPerWindow: 2, summaryEverySuppressed: 20 }
    );
    return toFallbackPreview(normalizedUrl);
  }
};
