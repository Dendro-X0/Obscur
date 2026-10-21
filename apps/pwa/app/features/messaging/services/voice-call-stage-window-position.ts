/**
 * Desktop video stage window geometry — default corner + clamp while dragging.
 */

export type StageWindowPoint = Readonly<{ left: number; top: number }>;

export type StageWindowSize = Readonly<{ width: number; height: number }>;

export type StageWindowViewport = Readonly<{ width: number; height: number }>;

export type StageCornerAnchor = "bottom-right" | "bottom-left" | "top-right" | "top-left";

export const DEFAULT_STAGE_WINDOW_MARGIN_PX = 16;

export const DEFAULT_STAGE_WINDOW_SIZE: StageWindowSize = {
  width: 576, // ~36rem
  height: 448, // ~28rem
};

export const resolveDefaultStageWindowPosition = (params: Readonly<{
  viewport: StageWindowViewport;
  size: StageWindowSize;
  anchor?: StageCornerAnchor;
  marginPx?: number;
}>): StageWindowPoint => {
  const margin = Math.max(0, params.marginPx ?? DEFAULT_STAGE_WINDOW_MARGIN_PX);
  const width = Math.min(params.size.width, Math.max(120, params.viewport.width - margin * 2));
  const height = Math.min(params.size.height, Math.max(120, params.viewport.height - margin * 2));
  const anchor = params.anchor ?? "bottom-right";
  const maxLeft = Math.max(margin, params.viewport.width - width - margin);
  const maxTop = Math.max(margin, params.viewport.height - height - margin);
  switch (anchor) {
    case "bottom-left":
      return { left: margin, top: maxTop };
    case "top-right":
      return { left: maxLeft, top: margin };
    case "top-left":
      return { left: margin, top: margin };
    case "bottom-right":
    default:
      return { left: maxLeft, top: maxTop };
  }
};

export const clampStageWindowPosition = (params: Readonly<{
  point: StageWindowPoint;
  viewport: StageWindowViewport;
  size: StageWindowSize;
  marginPx?: number;
}>): StageWindowPoint => {
  const margin = Math.max(0, params.marginPx ?? DEFAULT_STAGE_WINDOW_MARGIN_PX);
  const width = Math.min(params.size.width, Math.max(80, params.viewport.width - margin * 2));
  const height = Math.min(params.size.height, Math.max(80, params.viewport.height - margin * 2));
  const maxLeft = Math.max(margin, params.viewport.width - width - margin);
  const maxTop = Math.max(margin, params.viewport.height - height - margin);
  return {
    left: Math.min(maxLeft, Math.max(margin, params.point.left)),
    top: Math.min(maxTop, Math.max(margin, params.point.top)),
  };
};
