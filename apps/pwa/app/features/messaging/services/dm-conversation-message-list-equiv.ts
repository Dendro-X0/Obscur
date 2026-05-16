import type { Message } from "../types";

/** Compare two message lists by id order only (skip redundant `setMessages`). */
export const areMessageListsEquivalentById = (
  left: ReadonlyArray<Message>,
  right: ReadonlyArray<Message>,
): boolean => {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index]?.id !== right[index]?.id) {
      return false;
    }
  }
  return true;
};
