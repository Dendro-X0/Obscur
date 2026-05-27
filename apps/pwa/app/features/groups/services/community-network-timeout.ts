export const COMMUNITY_NETWORK_OPERATION_TIMEOUT_MS = 12_000;

export class CommunityNetworkTimeoutError extends Error {
  constructor(message = "community_network_timeout") {
    super(message);
    this.name = "CommunityNetworkTimeoutError";
  }
}

export const withCommunityNetworkTimeout = async <T>(
  operation: Promise<T>,
  timeoutMs: number = COMMUNITY_NETWORK_OPERATION_TIMEOUT_MS,
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new CommunityNetworkTimeoutError());
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};
