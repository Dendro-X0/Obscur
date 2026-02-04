
export interface StorageProvider {
    name: string;
    url: string;
    description: string;
    maxSize?: string;
}

export const RECOMMENDED_STORAGE_PROVIDERS: ReadonlyArray<StorageProvider> = [
    {
        name: "nostr.build",
        url: "https://nostr.build/api/v2/upload/files",
        description: "The most popular Nostr media host. Fast, reliable, and supports long-term storage.",
        maxSize: "10MB (Free)"
    },
    {
        name: "void.cat",
        url: "https://void.cat/api/v1/nip96",
        description: "Privacy-centric storage with no tracking. Great for sensitive attachments.",
        maxSize: "50MB"
    },
    {
        name: "sovbit",
        url: "https://sovbit.host/api/v2/upload/files",
        description: "High-performance Nostr-native hosting provider.",
        maxSize: "25MB"
    },
    {
        name: "pixel.fed",
        url: "https://pixel.fed/api/v1/media",
        description: "Decentralized media sharing endpoint.",
    }
];
