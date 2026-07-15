/** True when payload is already a NIP-01 EVENT wire message (DM pipeline passthrough). */
export const isNostrEventWirePayload = (payload: string): boolean => {
  try {
    const parsed = JSON.parse(payload) as unknown;
    return Array.isArray(parsed) && parsed[0] === "EVENT";
  } catch {
    return false;
  }
};
