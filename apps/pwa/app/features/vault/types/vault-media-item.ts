import type { MediaItem } from "@/app/features/messaging/types";

export type VaultMediaItem = Readonly<MediaItem & {
    id: string;
    remoteUrl: string;
    isLocalCached: boolean;
    localRelativePath: string | null;
    sourceConversationId: string | null;
}>;
