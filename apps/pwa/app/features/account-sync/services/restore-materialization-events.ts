import { getProfileRuntimeScope } from "@/app/features/profiles/services/profile-runtime-scope";

export const ACCOUNT_RESTORE_MATERIALIZATION_STARTED_EVENT = "obscur:account-restore-materialization-started";
export const ACCOUNT_RESTORE_MATERIALIZATION_COMPLETED_EVENT = "obscur:account-restore-materialization-completed";

export type AccountRestoreMaterializationEventDetail = Readonly<{
  publicKeyHex: string;
  profileId: string;
}>;

export const dispatchAccountRestoreMaterializationEvent = (
  eventName: typeof ACCOUNT_RESTORE_MATERIALIZATION_STARTED_EVENT | typeof ACCOUNT_RESTORE_MATERIALIZATION_COMPLETED_EVENT,
  detail: AccountRestoreMaterializationEventDetail,
): void => {
  const scope = getProfileRuntimeScope();
  if (scope?.bus && detail.profileId === scope.profileId) {
    const busType =
      eventName === ACCOUNT_RESTORE_MATERIALIZATION_STARTED_EVENT
        ? ("account-restore-materialization-started" as const)
        : ("account-restore-materialization-completed" as const);
    scope.bus.publish({
      type: busType,
      detail,
    });
  }
};

export const withAccountRestoreMaterializationEvents = async <T>(
  detail: AccountRestoreMaterializationEventDetail,
  operation: () => Promise<T>,
): Promise<T> => {
  dispatchAccountRestoreMaterializationEvent(ACCOUNT_RESTORE_MATERIALIZATION_STARTED_EVENT, detail);
  try {
    return await operation();
  } finally {
    dispatchAccountRestoreMaterializationEvent(ACCOUNT_RESTORE_MATERIALIZATION_COMPLETED_EVENT, detail);
  }
};
