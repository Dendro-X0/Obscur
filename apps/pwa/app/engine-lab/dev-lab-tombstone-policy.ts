/**
 * Dev Lab tombstone policy — always-false gate for product code.
 * Tree under features/dev-lab deleted (Phase 3). Entry scripts refuse via
 * scripts/dev-lab-tombstone.mjs.
 *
 * @see specs/backend/dev-lab-phase3-deletion-design-2026-07.md
 */

export const DEV_LAB_VERSION = "obscur.dev-lab.v1";

/** Permanent tombstone — Dev Lab is not a validation surface. */
export const DEV_LAB_TOMBSTONED = true;

declare global {
  interface Window {
    __OBSCUR_DEV_LAB__?: boolean;
  }
}

/**
 * Always false. Env flags and NODE_ENV no longer enable Dev Lab.
 */
export const isDevLabEnabled = (): boolean => false;

export const markDevLabBootFlag = (): void => {
  // Tombstoned — never set window.__OBSCUR_DEV_LAB__.
};
