/**
 * Skip *enabling* a live workspace relay only when lab skip is on and the
 * Workspace Relay field is empty. A typed URL still gets enabled on Save.
 * Advanced checkboxes are persisted as selected (do not mutate them on apply).
 */
export const resolveOperatorApplySkipRelay = (params: Readonly<{
  testWithoutRelay: boolean;
  normalizedWorkspaceRelayUrl: string | null;
}>): boolean => (
  params.testWithoutRelay && !params.normalizedWorkspaceRelayUrl
);

export const resolveOperatorPersistLabFlags = (params: Readonly<{
  testWithoutRelay: boolean;
  assumeLocalCoordination: boolean;
}>): Readonly<{
  persistSkipRelay: boolean;
  persistAssumeLocal: boolean;
}> => ({
  persistSkipRelay: params.testWithoutRelay,
  persistAssumeLocal: params.assumeLocalCoordination,
});
