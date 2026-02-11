import type { LinkPreview } from "../lib/link-preview";

export const fetchLinkPreview = async (url: string): Promise<LinkPreview> => {
  const normalizedUrl: string = url.trim();
  if (!normalizedUrl) {
    throw new Error("URL is required");
  }

  try {
    // Use allorigins as a CORS proxy to fetch the page content
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(normalizedUrl)}`;
    const response = await fetch(proxyUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch via proxy: ${response.status}`);
    }

    const data = await response.json();
    const html = data.contents;

    if (!html) {
      throw new Error("No content received from proxy");
    }

    // Parse the HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Extract OG tags and basic meta tags
    const getMeta = (name: string) => {
      return doc.querySelector(`meta[property="${name}"]`)?.getAttribute("content") ||
        doc.querySelector(`meta[name="${name}"]`)?.getAttribute("content") ||
        doc.querySelector(`meta[property="og:${name}"]`)?.getAttribute("content");
    };

    const title = getMeta("og:title") || getMeta("title") || doc.title || null;
    const description = getMeta("og:description") || getMeta("description") || null;
    const siteName = getMeta("og:site_name") || null;
    const imageUrl = getMeta("og:image") || getMeta("image") || null;

    return {
      url: normalizedUrl,
      type: "web",
      title,
      description: description ? (description.length > 200 ? `${description.slice(0, 200)}...` : description) : null,
      siteName,
      imageUrl: imageUrl ? (imageUrl.startsWith("/") ? new URL(imageUrl, normalizedUrl).href : imageUrl) : null,
      provider: siteName,
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
