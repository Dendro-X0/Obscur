
export interface StorageProvider {
    name: string;
    url: string;
    description: string;
    maxSize?: string;
}

export const RECOMMENDED_STORAGE_PROVIDERS: ReadonlyArray<StorageProvider> = [
    {
        name: "nostr.build",
        url: "https://nostr.build/api/v2/nip96/upload",
        description: "The most popular Nostr media host. Fast, reliable, and supports long-term storage.",
        maxSize: "10MB (Free)"
    },
    {
        name: "nostrcheck",
        url: "https://cdn.nostrcheck.me",
        description: "Cloudflare-backed NIP-96 host with broad CORS compatibility.",
        maxSize: "100MB (Free tier)"
    },
    {
        name: "sovbit",
        url: "https://api.sovbit.host/api/upload/files",
        description: "Nostr-native hosting provider (availability may vary by region/network).",
        maxSize: "25MB"
    },
    {
        name: "pixel.fed",
        url: "https://pixel.fed/api/v1/media",
        description: "Decentralized media sharing endpoint.",
    }
];
