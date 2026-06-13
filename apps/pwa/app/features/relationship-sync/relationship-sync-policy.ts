const parseEnvFlag = (raw: string | undefined): boolean => (
  (raw ?? "").trim() === "1" || (raw ?? "").trim().toLowerCase() === "true"
);

/** Opt-in experiment: directory-only community roster + unified drift detection. */
export const isRelationshipSyncExperimentEnabled = (): boolean => (
  parseEnvFlag(process.env.NEXT_PUBLIC_OBSCUR_RELATIONSHIP_SYNC_EXPERIMENT)
);
