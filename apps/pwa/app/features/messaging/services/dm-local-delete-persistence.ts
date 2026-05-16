/**
 * @deprecated Import from `@/app/features/messaging/services/messaging-client-operations`.
 */
import {
  messagingClientOperations,
} from "@/app/features/messaging/services/messaging-client-operations";

export const persistDmDeleteForMeSuppression = messagingClientOperations.persistDmSuppressionOnly;

export const executeDmDeleteForMe = messagingClientOperations.deleteDmForMe;

/** @deprecated Use `messagingClientOperations.deleteDmForMe`. */
export const applyDmDeleteForMePersistence = executeDmDeleteForMe;

/** @deprecated Use `messagingClientOperations.persistDmSuppressionOnly`. */
export const persistDmLocalDeleteIdentities = persistDmDeleteForMeSuppression;
