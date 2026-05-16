/**
 * Unified DM controller exports.
 * All callers use the v2 pipeline (controllers/v2/dm-controller.ts).
 * The v1 enhanced-dm-controller.ts is no longer the live integration path.
 */
export { useDmController as useEnhancedDMController, useDmController as useEnhancedDmController } from "../controllers/v2/dm-controller";
export type { UseDmControllerParams as UseEnhancedDMControllerParams, UseDmControllerResult as UseEnhancedDMControllerResult } from "../controllers/v2/dm-controller";

export type {
  Message,
  MessageStatus,
} from "../types";
