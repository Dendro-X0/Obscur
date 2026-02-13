import type { LinkPreview } from "../lib/link-preview";

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
      throw new Error(`Failed to fetch preview: ${response.status}`);
    }

    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.message || "Unknown API error");
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
    console.error("Link preview fetch failed:", error);
    // Fallback to basic preview
    return {
      url: normalizedUrl,
      type: "web",
      title: null,
      description: null,
      siteName: null,
      imageUrl: null,
      provider: null,
    };
  }
};
