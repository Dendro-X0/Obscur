import { type NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

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

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; ObscurBot/1.0)",
            },
            next: { revalidate: 3600 }, // Cache for 1 hour
        });

        if (!response.ok) {
            return NextResponse.json({ ok: false, message: `Failed to fetch URL: ${response.status}` }, { status: response.status });
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
