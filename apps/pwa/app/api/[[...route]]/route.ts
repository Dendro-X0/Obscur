import { Hono } from "hono";
import type { Context } from "hono";
import { handle } from "hono/vercel";

// Configure runtime for Vercel
export const runtime = "edge";

type RelayUrl = string;

type LinkPreviewType = "web" | "youtube";

type HealthResponse = Readonly<{
    ok: true;
    version: string;
    timeIso: string;
}>;

type LinkPreviewResponse = Readonly<{
    ok: true;
    url: string;
    type: LinkPreviewType;
    title: string | null;
    description: string | null;
    siteName: string | null;
    imageUrl: string | null;
    provider: string | null;
}>;

type ErrorResponse = Readonly<{ ok: false; message: string }>;

type ErrorStatusCode = 400 | 413 | 502;

type YouTubeOEmbedResponse = Readonly<{
    title: string;
    author_name: string;
}>;

type BootstrapResponse = Readonly<{
    relays: ReadonlyArray<RelayUrl>;
    version: string;
}>;

const DEFAULT_RELAYS: ReadonlyArray<RelayUrl> = [
    "wss://relay.damus.io",
    "wss://relay.nostr.band",
    "wss://nostr.wine"
] as const;

const FETCH_TIMEOUT_MS: number = 5000;
const MAX_HTML_BYTES: number = 256_000;

// Helper Functions
const isBlockedHostname = (hostname: string): boolean => {
    const normalized: string = hostname.trim().toLowerCase();
    if (!normalized) return true;

    if (normalized === "localhost" || normalized.endsWith(".localhost") || normalized.endsWith(".local") ||
        normalized === "0.0.0.0" || normalized === "127.0.0.1" || normalized === "::1" ||
        normalized.startsWith("127.") || normalized.startsWith("10.") || normalized.startsWith("192.168.")) {
        return true;
    }

    if (normalized.startsWith("172.")) {
        const parts: ReadonlyArray<string> = normalized.split(".");
        const second: number = Number(parts[1] ?? "");
        if (!Number.isNaN(second) && second >= 16 && second <= 31) {
            return true;
        }
    }
    return false;
};

const getFirstMatch = (value: string, regex: RegExp): string | null => {
    const match: RegExpExecArray | null = regex.exec(value);
    return match?.[1]?.trim() ? match[1].trim() : null;
};

const decodeHtmlEntities = (value: string): string => {
    return value
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim();
};

const parseOpenGraph = (html: string): Readonly<{ title: string | null; description: string | null; siteName: string | null; imageUrl: string | null }> => {
    const ogTitle: string | null = getFirstMatch(html, /<meta\s+[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i);
    const ogDescription: string | null = getFirstMatch(
        html,
        /<meta\s+[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i
    );
    const ogSiteName: string | null = getFirstMatch(
        html,
        /<meta\s+[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["'][^>]*>/i
    );
    const ogImage: string | null = getFirstMatch(html, /<meta\s+[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i);

    const twitterTitle: string | null = getFirstMatch(
        html,
        /<meta\s+[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["'][^>]*>/i
    );
    const twitterDescription: string | null = getFirstMatch(
        html,
        /<meta\s+[^>]*name=["']twitter:description["'][^>]*content=["']([^"']+)["'][^>]*>/i
    );
    const twitterImage: string | null = getFirstMatch(
        html,
        /<meta\s+[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["'][^>]*>/i
    );

    const titleTag: string | null = getFirstMatch(html, /<title[^>]*>([^<]{1,200})<\/title>/i);

    const title: string | null = decodeHtmlEntities(ogTitle ?? twitterTitle ?? titleTag ?? "") || null;
    const description: string | null = decodeHtmlEntities(ogDescription ?? twitterDescription ?? "") || null;
    const siteName: string | null = decodeHtmlEntities(ogSiteName ?? "") || null;
    const imageUrl: string | null = decodeHtmlEntities(ogImage ?? twitterImage ?? "") || null;

    return { title, description, siteName, imageUrl };
};

const parseYouTubeVideoId = (url: URL): string | null => {
    const host: string = url.hostname.toLowerCase();
    if (host === "youtu.be") {
        const id: string = url.pathname.replace(/^\//, "").trim();
        return id ? id : null;
    }
    if (host.endsWith("youtube.com")) {
        const id: string | null = url.searchParams.get("v");
        return id?.trim() ? id.trim() : null;
    }
    return null;
};

const fetchYouTubeTitle = async (videoUrl: string): Promise<Readonly<{ title: string | null; authorName: string | null }>> => {
    const controller: AbortController = new AbortController();
    const timeout: NodeJS.Timeout = setTimeout((): void => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const endpoint: string = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(videoUrl)}`;
        const response: Response = await fetch(endpoint, {
            method: "GET",
            redirect: "follow",
            headers: {
                "User-Agent": "ObscurLinkPreview/1.0.0"
            },
            signal: controller.signal
        });
        if (!response.ok) {
            return { title: null, authorName: null };
        }
        const data: unknown = await response.json();
        if (!data || typeof data !== "object") {
            return { title: null, authorName: null };
        }
        const title: unknown = (data as Partial<YouTubeOEmbedResponse>).title;
        const authorName: unknown = (data as Partial<YouTubeOEmbedResponse>).author_name;
        return {
            title: typeof title === "string" && title.trim() ? title.trim() : null,
            authorName: typeof authorName === "string" && authorName.trim() ? authorName.trim() : null
        };
    } catch {
        return { title: null, authorName: null };
    } finally {
        clearTimeout(timeout);
    }
};

const createError = (context: Context, message: string, status: ErrorStatusCode): Response => {
    const response: ErrorResponse = { ok: false, message };
    return context.json(response, status);
};

// Application
const app = new Hono().basePath("/api");

// We don't need CORS middleware here because Next.js handles it or it's same-origin

app.get("/v1/health", (context: Context) => {
    const response: HealthResponse = {
        ok: true,
        version: "1.0.0",
        timeIso: new Date().toISOString()
    };
    return context.json(response);
});

app.get("/v1/link-preview", async (context: Context) => {
    const urlParam: string | undefined = context.req.query("url");
    if (!urlParam?.trim()) {
        return createError(context, "Missing url", 400);
    }

    let parsed: URL;
    try {
        parsed = new URL(urlParam);
    } catch {
        return createError(context, "Invalid url", 400);
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return createError(context, "Only http/https supported", 400);
    }
    if (isBlockedHostname(parsed.hostname)) {
        return createError(context, "Blocked hostname", 400);
    }

    const youtubeId: string | null = parseYouTubeVideoId(parsed);
    if (youtubeId) {
        const youtubeUrl: string = parsed.toString();
        const youtubeMeta: Readonly<{ title: string | null; authorName: string | null }> = await fetchYouTubeTitle(youtubeUrl);
        const response: LinkPreviewResponse = {
            ok: true,
            url: youtubeUrl,
            type: "youtube",
            title: youtubeMeta.title,
            description: null,
            siteName: "YouTube",
            imageUrl: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
            provider: youtubeMeta.authorName ? `YouTube · ${youtubeMeta.authorName}` : "YouTube"
        };
        return context.json(response);
    }

    const controller: AbortController = new AbortController();
    const timeout: NodeJS.Timeout = setTimeout((): void => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const response: Response = await fetch(parsed.toString(), {
            method: "GET",
            redirect: "follow",
            headers: {
                "User-Agent": "ObscurLinkPreview/1.0.0"
            },
            signal: controller.signal
        });

        if (!response.ok) {
            return createError(context, `Upstream HTTP ${response.status}`, 502);
        }

        const contentType: string = response.headers.get("content-type") ?? "";
        if (!contentType.toLowerCase().includes("text/html")) {
            const result: LinkPreviewResponse = {
                ok: true,
                url: parsed.toString(),
                type: "web",
                title: null,
                description: null,
                siteName: parsed.hostname,
                imageUrl: null,
                provider: null
            };
            return context.json(result);
        }

        const buffer: ArrayBuffer = await response.arrayBuffer();
        if (buffer.byteLength > MAX_HTML_BYTES) {
            return createError(context, "HTML too large", 413);
        }
        const html: string = new TextDecoder("utf-8").decode(buffer);
        const og = parseOpenGraph(html);

        const result: LinkPreviewResponse = {
            ok: true,
            url: parsed.toString(),
            type: "web",
            title: og.title,
            description: og.description,
            siteName: og.siteName ?? parsed.hostname,
            imageUrl: og.imageUrl,
            provider: null
        };
        return context.json(result);
    } catch (error: unknown) {
        const message: string = error instanceof Error ? error.message : "Unknown error";
        return createError(context, message, 502);
    } finally {
        clearTimeout(timeout);
    }
});

app.get("/v1/bootstrap", (context: Context) => {
    const response: BootstrapResponse = {
        relays: DEFAULT_RELAYS,
        version: "1.0.0"
    };
    return context.json(response);
});

app.get("/v1/relays/recommended", (context: Context) => {
    const response: BootstrapResponse = {
        relays: DEFAULT_RELAYS,
        version: "1.0.0"
    };
    return context.json(response);
});

export const GET = handle(app);
export const POST = handle(app);
export const OPTIONS = handle(app);
