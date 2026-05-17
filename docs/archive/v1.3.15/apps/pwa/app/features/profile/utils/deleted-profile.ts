export type DeletedProfileLike = Readonly<{
  displayName?: string | null;
  name?: string | null;
  about?: string | null;
}>;

const normalize = (value: string | null | undefined): string => value?.trim().toLowerCase() ?? "";

export const DELETED_ACCOUNT_DISPLAY_NAME = "deleted account";
export const DELETED_ACCOUNT_ABOUT_TEXT = "this account has been deleted.";

export const isDeletedAccountProfile = (profile: DeletedProfileLike | null | undefined): boolean => {
  if (!profile) {
    return false;
  }
  const displayName = normalize(profile.displayName);
  const name = normalize(profile.name);
  const about = normalize(profile.about);
  return (
    displayName === DELETED_ACCOUNT_DISPLAY_NAME
    || name === DELETED_ACCOUNT_DISPLAY_NAME
    || about === DELETED_ACCOUNT_ABOUT_TEXT
  );
};
