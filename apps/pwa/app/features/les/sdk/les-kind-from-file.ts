import type { LesKind } from "./les-native-sdk";

/** Map a File (or mime) onto LES kind — pure, no store owners. */
export const lesKindFromFile = (file: Pick<File, "name" | "type">): LesKind => {
  const contentType = (file.type || "").trim().toLowerCase();
  const name = (file.name || "").trim().toLowerCase();
  if (contentType.startsWith("image/") || /\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(name)) {
    return "image";
  }
  if (contentType.startsWith("video/") || /\.(mp4|webm|mov|mkv|avi)$/i.test(name)) {
    return "video";
  }
  if (
    contentType.startsWith("audio/")
    || /\.(mp3|wav|ogg|m4a|aac|opus|flac)$/i.test(name)
  ) {
    return "audio";
  }
  return "file";
};
