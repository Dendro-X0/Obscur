export type MediaPan = Readonly<{ x: number; y: number }>;

export type MediaViewerState = Readonly<{
  activeIndex: number;
  zoom: number;
  pan: MediaPan;
  isPinching: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
}>;

export type SwipeDirection = "prev" | "next" | null;

export const MEDIA_VIEWER_MIN_ZOOM = 1;
export const MEDIA_VIEWER_MAX_ZOOM = 4;

export const clampZoom = (zoom: number, min = MEDIA_VIEWER_MIN_ZOOM, max = MEDIA_VIEWER_MAX_ZOOM): number => {
  if (!Number.isFinite(zoom)) return min;
  return Math.max(min, Math.min(max, zoom));
};

export const buildMediaViewerState = (params: Readonly<{
  activeIndex: number;
  zoom: number;
  pan: MediaPan;
  isPinching: boolean;
}>): MediaViewerState => {
  const zoom = clampZoom(params.zoom);
  return {
    activeIndex: Math.max(0, params.activeIndex),
    zoom,
    pan: params.pan,
    isPinching: params.isPinching,
    canZoomIn: zoom < MEDIA_VIEWER_MAX_ZOOM,
    canZoomOut: zoom > MEDIA_VIEWER_MIN_ZOOM,
  };
};

export const nextMediaIndex = (activeIndex: number, total: number): number => {
  if (total <= 0) return 0;
  return (activeIndex + 1) % total;
};

export const prevMediaIndex = (activeIndex: number, total: number): number => {
  if (total <= 0) return 0;
  return (activeIndex - 1 + total) % total;
};

export const getTouchDistance = (points: ReadonlyArray<Readonly<{ x: number; y: number }>>): number | null => {
  if (points.length < 2) return null;
  const dx = points[0].x - points[1].x;
  const dy = points[0].y - points[1].y;
  return Math.hypot(dx, dy);
};

export const computePinchZoom = (params: Readonly<{
  startDistance: number;
  currentDistance: number;
  startZoom: number;
  min?: number;
  max?: number;
}>): number => {
  if (params.startDistance <= 0 || params.currentDistance <= 0) {
    return clampZoom(params.startZoom, params.min, params.max);
  }
  return clampZoom((params.startZoom * params.currentDistance) / params.startDistance, params.min, params.max);
};

export const detectSwipeDirection = (deltaX: number, minDistance = 40): SwipeDirection => {
  if (Math.abs(deltaX) < minDistance) return null;
  return deltaX > 0 ? "prev" : "next";
};

