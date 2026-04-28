export const shouldUseSafeCommunityRenderMode = (params: Readonly<{
    forceSafeRenderMode: boolean;
    reducedMotion: boolean;
    runtimeConstrained: boolean;
    isDesktop: boolean;
}>): boolean => (
    params.forceSafeRenderMode
    || params.reducedMotion
    || params.runtimeConstrained
    || params.isDesktop
);
