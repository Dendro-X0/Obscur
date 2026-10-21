/**
 * Host join-request → offer dispatch must be single-flight per room.
 * Concurrent join signals (relay dupes + joiner retries) otherwise race
 * createOffer/setLocalDescription and tear down a healthy call.
 */

export type HostOfferInFlightMap = Map<string, Promise<boolean>>;

export const runHostOfferDispatchCoalesced = async (params: Readonly<{
  roomId: string;
  inFlight: HostOfferInFlightMap;
  dispatch: () => Promise<boolean>;
}>): Promise<boolean> => {
  const key = params.roomId.trim();
  if (!key) {
    return false;
  }
  const existing = params.inFlight.get(key);
  if (existing) {
    return existing;
  }
  const settle = (async (): Promise<boolean> => {
    try {
      return await params.dispatch();
    }
    finally {
      params.inFlight.delete(key);
    }
  })();
  params.inFlight.set(key, settle);
  return settle;
};

/** RTC invalid-state that means a local offer already exists — resend, do not tear down. */
export const isHaveLocalOfferInvalidState = (errorMessage: string): boolean => (
  /invalid\s*state/i.test(errorMessage)
  || /have-local-offer/i.test(errorMessage)
  || /called in wrong state/i.test(errorMessage)
);
