/**
 * ENGINE LAB — repo is an experimental workspace, not a shippable product.
 * Legacy integrations are opt-in only. Kernels are default authority.
 *
 * Set NEXT_PUBLIC_OBSCUR_ALLOW_LEGACY=1 to re-enable parallel legacy owners (debug only).
 */
export const isEngineLabStrictMode = (): boolean => (
  process.env.NEXT_PUBLIC_OBSCUR_ALLOW_LEGACY !== "1"
);

/** Legacy parallel owners (hydrate stack, etc.) — debug/archaeology only. */
export const isObscurAllowLegacy = (): boolean => !isEngineLabStrictMode();

export const ENGINE_LAB_BAND = "ENGINE-LAB" as const;
