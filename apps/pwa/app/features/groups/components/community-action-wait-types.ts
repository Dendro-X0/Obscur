export type CommunityActionWaitStepStatus =
  | "pending"
  | "active"
  | "done"
  | "skipped"
  | "failed";

export type CommunityActionWaitStep = Readonly<{
  id: string;
  label: string;
  detail?: string;
  status: CommunityActionWaitStepStatus;
}>;

export const buildCommunityActionWaitSteps = (
  stepDefs: ReadonlyArray<Readonly<{ id: string; label: string; detail?: string }>>,
  activeStepId: string | null,
  options?: Readonly<{
    failedStepId?: string;
    skippedStepIds?: ReadonlyArray<string>;
    /** When true, every non-skipped step is marked done (operation finished). */
    allComplete?: boolean;
  }>,
): ReadonlyArray<CommunityActionWaitStep> => {
  const failedId = options?.failedStepId ?? null;
  const skipped = new Set(options?.skippedStepIds ?? []);
  const activeIndex = activeStepId === null
    ? -1
    : stepDefs.findIndex((def) => def.id === activeStepId);

  return stepDefs.map((def, index) => {
    if (failedId === def.id) {
      return { ...def, status: "failed" as const };
    }
    if (skipped.has(def.id)) {
      return { ...def, status: "skipped" as const };
    }
    if (options?.allComplete) {
      return { ...def, status: "done" as const };
    }
    if (activeIndex === -1) {
      return { ...def, status: "pending" as const };
    }
    if (index < activeIndex) {
      return { ...def, status: "done" as const };
    }
    if (index === activeIndex) {
      return { ...def, status: "active" as const };
    }
    return { ...def, status: "pending" as const };
  });
};
