import { getApiBaseUrl } from "../../relays/utils/api-base-url";
import type { LinkPreview } from "./link-preview";

type LinkPreviewApiResponse = Readonly<
  | ({ ok: true } & LinkPreview)
  | {
    ok: false;
    message: string;
  }
>;

const fetchLinkPreview = async (url: string): Promise<LinkPreview> => {
  const baseUrl: string = getApiBaseUrl().replace(/\/$/, "");
  const endpoint: string = `${baseUrl}/v1/link-preview?url=${encodeURIComponent(url)}`;
  const response: Response = await fetch(endpoint, { method: "GET" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data: unknown = await response.json();
  if (!data || typeof data !== "object") {
    throw new Error("Invalid JSON response");
  }
  const api = data as LinkPreviewApiResponse;
  if (!api.ok) {
    throw new Error(api.message);
  }
  const preview: LinkPreview = {
    url: api.url,
    type: api.type,
    title: api.title,
    description: api.description,
    siteName: api.siteName,
    imageUrl: api.imageUrl,
    provider: api.provider
  };
  return preview;
};

export { fetchLinkPreview };
