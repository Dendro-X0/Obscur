import { type NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const DIRECT_MEDIA_EXTENSIONS = [
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg",
    ".mp4", ".webm", ".mov", ".m4v", ".ogv",
    ".mp3", ".wav", ".m4a", ".ogg", ".aac", ".flac", ".opus",
    ".pdf", ".txt", ".csv", ".rtf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods", ".odp"
] as const;

const isDirectMediaLikeUrl = (rawUrl: string): boolean => {
    try {
        const parsed = new URL(rawUrl);
        const pathname = parsed.pathname.toLowerCase();
        if (pathname.includes("/uploads/")) return true;
        return DIRECT_MEDIA_EXTENSIONS.some((ext) => pathname.endsWith(ext));
    } catch {
        return false;
    }
};

/**
 * GET /api/link-preview?url=...
 * Server-side proxy to fetch metadata from a URL to avoid CORS issues.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
        return NextResponse.json({ ok: false, message: "URL is required" }, { status: 400 });
    }

    if (isDirectMediaLikeUrl(url)) {
        return NextResponse.json({ ok: false, message: "Direct media URL does not require link preview" }, { status: 200 });
    }

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; ObscurBot/1.0)",
            },
            next: { revalidate: 3600 }, // Cache for 1 hour
        });

        if (!response.ok) {
            return NextResponse.json({ ok: false, message: `Failed to fetch URL: ${response.status}` }, { status: 200 });
        }

        const html = await response.text();

        // Basic regex-based parsing to avoid heavy dependencies on edge runtime
        const getMetaValue = (pattern: RegExp): string | null => {
            const match = html.match(pattern);
            return match ? match[1] || match[2] : null;
        };

        const titlePattern = /<title[^>]*>(.*?)<\/title>/i;
        const ogTitlePattern = /<meta\s+(?:property|name)=["']og:title["']\s+content=["'](.*?)["']/i;
        const ogDescriptionPattern = /<meta\s+(?:property|name)=["']og:description["']\s+content=["'](.*?)["']/i;
        const descriptionPattern = /<meta\s+name=["']description["']\s+content=["'](.*?)["']/i;
        const ogImagePattern = /<meta\s+(?:property|name)=["']og:image["']\s+content=["'](.*?)["']/i;
        const ogSiteNamePattern = /<meta\s+(?:property|name)=["']og:site_name["']\s+content=["'](.*?)["']/i;

        const title = getMetaValue(ogTitlePattern) || getMetaValue(titlePattern) || null;
        let description = getMetaValue(ogDescriptionPattern) || getMetaValue(descriptionPattern) || null;
        const imageUrl = getMetaValue(ogImagePattern) || null;
        const siteName = getMetaValue(ogSiteNamePattern) || null;

        if (description && description.length > 200) {
            description = `${description.slice(0, 200)}...`;
        }

        return NextResponse.json({
            ok: true,
            url,
            type: "web",
            title,
            description,
            siteName,
            imageUrl,
            provider: siteName,
        });
    } catch (error) {
        console.error("Link preview API error:", error);
        return NextResponse.json({ ok: false, message: "Internal server error" }, { status: 500 });
    }
}
