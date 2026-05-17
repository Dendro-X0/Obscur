type LinkPreviewType = "web" | "youtube";

type LinkPreview = Readonly<{
  url: string;
  type: LinkPreviewType;
  title: string | null;
  description: string | null;
  siteName: string | null;
  imageUrl: string | null;
  provider: string | null;
}>;

export type { LinkPreview };
