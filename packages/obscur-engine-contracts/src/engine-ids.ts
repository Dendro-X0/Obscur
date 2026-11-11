/** Stable engine identifiers for the Obscur lab workspace. */
export type EngineId =
  | "auth"
  | "dm"
  | "workspace"
  | "transport"
  | "persistence"
  | "privateTrust";

export type EngineScope = Readonly<{
  profileId: string;
  windowLabel?: string;
}>;
