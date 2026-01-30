import type { LinkPreview } from "../lib/link-preview";

export const fetchLinkPreview = async (url: string): Promise<LinkPreview> => {
  const normalizedUrl: string = url.trim();
  if (!normalizedUrl) {
    throw new Error("URL is required");
  }
  return {
    url: normalizedUrl,
    type: "web",
    title: null,
    description: null,
    siteName: null,
    imageUrl: null,
    provider: null,
  };
};
