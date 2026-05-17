export type ProfileId = string;

export type ProfileLaunchMode = "existing" | "new_window";

export type ProfileSessionOwner = Readonly<{
  profileId: ProfileId;
  publicKeyHex?: string;
}>;

export type ProfileWindowBinding = Readonly<{
  windowLabel: string;
  profileId: ProfileId;
  profileLabel: string;
  launchMode: ProfileLaunchMode;
}>;

export type ProfileSummary = Readonly<{
  profileId: ProfileId;
  label: string;
  createdAtUnixMs: number;
  lastUsedAtUnixMs: number;
}>;

export type ProfileIsolationSnapshot = Readonly<{
  currentWindow: ProfileWindowBinding;
  profiles: ReadonlyArray<ProfileSummary>;
  windowBindings: ReadonlyArray<ProfileWindowBinding>;
}>;
