export type AuthUnlockContext =
  | "create"
  | "import"
  | "unlock"
  | "raw_unlock"
  | "assistant";

export type AuthUnlockOptions = Readonly<{
  profileId: string;
  staySignedIn?: boolean;
  context: AuthUnlockContext;
}>;

export const resolveStaySignedInFromOptions = (options: AuthUnlockOptions): boolean => (
  options.staySignedIn !== false
);
