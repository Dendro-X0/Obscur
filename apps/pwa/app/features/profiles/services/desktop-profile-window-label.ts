const PROFILE_WINDOW_LABEL_PATTERN = /^profile-(.+)-(\d{10,})$/u;

/** Parses `profile-{profileId}-{timestamp}` labels assigned by the desktop shell. */
export const parseProfileIdFromWindowLabel = (windowLabel: string): string | null => {
  const normalized = windowLabel.trim();
  if (!normalized || normalized === "main") {
    return null;
  }
  const match = PROFILE_WINDOW_LABEL_PATTERN.exec(normalized);
  return match?.[1]?.trim() || null;
};

export const isSecondaryProfileWindowLabel = (windowLabel: string): boolean => (
  parseProfileIdFromWindowLabel(windowLabel) !== null
);
