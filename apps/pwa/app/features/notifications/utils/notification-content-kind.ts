/**
 * Content-kind glyphs for OS / web notifications.
 * Windows Tauri caches peer https avatars and shows them as circular app-logo icons
 * (not inline image-preview placement). Message title/body may still use emoji kind glyphs;
 * incoming-call presentation uses name + preview without duplicate emoji.
 */

export type NotificationContentKind =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "voice_note"
  | "file"
  | "call";

const CONTENT_KIND_EMOJI: Record<NotificationContentKind, string> = {
  text: "💬",
  image: "🖼️",
  video: "🎬",
  audio: "🎵",
  voice_note: "🎙️",
  file: "📎",
  call: "📞",
};

/** Infer kind from sidebar/notification preview copy (formatConversationMessagePreview). */
export const resolveNotificationContentKindFromPreview = (
  preview: string,
): NotificationContentKind => {
  const trimmed = preview.trim();
  if (!trimmed) {
    return "text";
  }
  if (/^image\b/i.test(trimmed)) {
    return "image";
  }
  if (/^video\b/i.test(trimmed)) {
    return "video";
  }
  if (/^voice note\b/i.test(trimmed)) {
    return "voice_note";
  }
  if (/^audio\b/i.test(trimmed)) {
    return "audio";
  }
  if (/^pdf\b/i.test(trimmed) || /^\.\w{1,8}\s+\S+/i.test(trimmed) || /^file\b/i.test(trimmed)) {
    return "file";
  }
  if (/voice call/i.test(trimmed) || /^call\b/i.test(trimmed)) {
    return "call";
  }
  return "text";
};

export const notificationContentKindEmoji = (
  kind: NotificationContentKind,
): string => CONTENT_KIND_EMOJI[kind];

const svgDataUri = (inner: string, fill: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><rect width="64" height="64" rx="14" fill="${fill}"/>${inner}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

/** Small distinctive glyphs for Notification.icon (web / SW). */
export const notificationContentKindIconDataUri = (
  kind: NotificationContentKind,
): string => {
  switch (kind) {
    case "image":
      return svgDataUri(
        `<path fill="#fff" d="M14 18h36v28H14z"/><circle cx="24" cy="28" r="4" fill="#2563eb"/><path fill="#93c5fd" d="M14 40l10-10 8 8 6-6 12 12H14z"/>`,
        "#1d4ed8",
      );
    case "video":
      return svgDataUri(
        `<rect x="14" y="20" width="28" height="24" rx="3" fill="#fff"/><path fill="#fff" d="M44 26l10-6v24l-10-6z"/>`,
        "#7c3aed",
      );
    case "audio":
      return svgDataUri(
        `<path fill="#fff" d="M22 18v28l20-8V26z"/><rect x="40" y="24" width="4" height="16" rx="1" fill="#fff"/>`,
        "#059669",
      );
    case "voice_note":
      return svgDataUri(
        `<rect x="28" y="14" width="8" height="22" rx="4" fill="#fff"/><path fill="none" stroke="#fff" stroke-width="3" d="M20 30a12 12 0 0024 0"/><path stroke="#fff" stroke-width="3" d="M32 42v8"/>`,
        "#0d9488",
      );
    case "file":
      return svgDataUri(
        `<path fill="#fff" d="M22 12h14l10 10v30H22z"/><path fill="#bfdbfe" d="M36 12v10h10"/>`,
        "#475569",
      );
    case "call":
      return svgDataUri(
        `<path fill="#fff" d="M20 18c2-2 5-2 7 0l4 4c1 1 1 3 0 4l-3 3c2 4 5 7 9 9l3-3c1-1 3-1 4 0l4 4c2 2 2 5 0 7l-2 2c-2 2-5 3-9 2-8-2-16-9-21-17-2-4-1-7 1-9z"/>`,
        "#16a34a",
      );
    case "text":
    default:
      return svgDataUri(
        `<path fill="#fff" d="M16 16h32v24H28l-8 8v-8H16z"/>`,
        "#334155",
      );
  }
};
