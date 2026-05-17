import { getRuntimeCapabilities } from "@/app/features/runtime/runtime-capabilities";
import { getTauriAPI } from "@/app/features/desktop/utils/tauri-api";

const OVERLAY_ICON_SIZE_PX = 32;
const MAX_BADGE_DISPLAY_COUNT = 99;
const BADGE_LABEL_FOR_OVERFLOW = "99+";

const overlayBadgeIconCache = new Map<string, Promise<unknown>>();

const normalizeUnreadCount = (countInput: number): number => {
  if (!Number.isFinite(countInput)) {
    return 0;
  }
  return Math.max(0, Math.floor(countInput));
};

const toBadgeDisplayLabel = (normalizedUnreadCount: number): string => {
  if (normalizedUnreadCount <= 0) {
    return "";
  }
  if (normalizedUnreadCount > MAX_BADGE_DISPLAY_COUNT) {
    return BADGE_LABEL_FOR_OVERFLOW;
  }
  return String(normalizedUnreadCount);
};

const renderBadgeRgba = (badgeLabel: string): Uint8Array | null => {
  if (!badgeLabel || typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = OVERLAY_ICON_SIZE_PX;
  canvas.height = OVERLAY_ICON_SIZE_PX;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.clearRect(0, 0, OVERLAY_ICON_SIZE_PX, OVERLAY_ICON_SIZE_PX);
  context.fillStyle = "#dc2626";
  context.beginPath();
  context.arc(
    OVERLAY_ICON_SIZE_PX / 2,
    OVERLAY_ICON_SIZE_PX / 2,
    (OVERLAY_ICON_SIZE_PX / 2) - 1,
    0,
    Math.PI * 2,
  );
  context.fill();

  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = badgeLabel.length >= 3
    ? '700 12px "Segoe UI", "Arial", sans-serif'
    : '700 16px "Segoe UI", "Arial", sans-serif';
  context.fillText(
    badgeLabel,
    OVERLAY_ICON_SIZE_PX / 2,
    OVERLAY_ICON_SIZE_PX / 2,
  );

  const rgba = context.getImageData(0, 0, OVERLAY_ICON_SIZE_PX, OVERLAY_ICON_SIZE_PX).data;
  return new Uint8Array(rgba.buffer.slice(0));
};

const resolveOverlayBadgeImage = async (badgeLabel: string): Promise<unknown | null> => {
  if (!badgeLabel) {
    return null;
  }
  const cached = overlayBadgeIconCache.get(badgeLabel);
  if (cached) {
    return await cached;
  }

  const creationPromise = (async (): Promise<unknown | null> => {
    const rgba = renderBadgeRgba(badgeLabel);
    if (!rgba) {
      return null;
    }
    const { Image } = await import("@tauri-apps/api/image");
    return await Image.new(rgba, OVERLAY_ICON_SIZE_PX, OVERLAY_ICON_SIZE_PX);
  })();

  overlayBadgeIconCache.set(badgeLabel, creationPromise);
  try {
    return await creationPromise;
  } catch {
    overlayBadgeIconCache.delete(badgeLabel);
    return null;
  }
};

export const applyDesktopUnreadTaskbarBadge = async (unreadCountInput: number): Promise<void> => {
  const capabilities = getRuntimeCapabilities();
  if (!capabilities.isNativeRuntime) {
    return;
  }
  const unreadCount = normalizeUnreadCount(unreadCountInput);
  const badgeLabel = toBadgeDisplayLabel(unreadCount);

  try {
    await getTauriAPI().tray.setUnreadBadgeCount(unreadCount).catch(() => {
      // best effort
    });

    if (!capabilities.supportsWindowControls) {
      return;
    }

    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const appWindow = getCurrentWindow();

    // macOS/Linux app badge path (Windows unsupported by API, safely ignored there).
    await appWindow.setBadgeCount(unreadCount > 0 ? unreadCount : undefined).catch(() => {
      // best effort
    });

    // Windows overlay icon path.
    if (badgeLabel.length === 0) {
      await appWindow.setOverlayIcon(undefined).catch(() => {
        // best effort
      });
      return;
    }
    const overlayBadgeImage = await resolveOverlayBadgeImage(badgeLabel);
    if (!overlayBadgeImage) {
      return;
    }
    await appWindow.setOverlayIcon(overlayBadgeImage as never).catch(() => {
      // best effort
    });
  } catch {
    // runtime does not expose these APIs; ignore safely
  }
};

export const unreadTaskbarBadgeInternals = {
  normalizeUnreadCount,
  toBadgeDisplayLabel,
};
