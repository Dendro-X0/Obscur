/**
 * Global Window stubs for tombstoned Dev Lab API.
 * Runtime remains undefined after Phase 3; loose type keeps e2e helpers compiling.
 *
 * @see specs/backend/dev-lab-phase3-deletion-design-2026-07.md
 */

export {};

declare global {
  interface Window {
    __OBSCUR_DEV_LAB__?: boolean;
    /** Tombstoned — always undefined at runtime after Phase 3. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    obscurDevLab?: any;
  }
}
