export type RelayUiStatus = "healthy" | "degraded" | "unavailable";

export type RelayRuntimeStatus = Readonly<{
  status: RelayUiStatus;
  label: string;
  actionText: string;
  openCount: number;
  totalCount: number;
}>;

export const deriveRelayRuntimeStatus = (params: Readonly<{ openCount: number; totalCount: number }>): RelayRuntimeStatus => {
  const openCount = Math.max(0, params.openCount);
  const totalCount = Math.max(0, params.totalCount);

  if (totalCount === 0) {
    return {
      status: "unavailable",
      label: "No relay configured",
      actionText: "Add at least one relay in Settings -> Relays.",
      openCount,
      totalCount,
    };
  }

  if (openCount === 0) {
    return {
      status: "unavailable",
      label: "Relays unavailable",
      actionText: "Check network and relay health in Settings -> Relays.",
      openCount,
      totalCount,
    };
  }

  if (openCount < totalCount) {
    return {
      status: "degraded",
      label: "Relay connectivity degraded",
      actionText: "Messaging works with reduced redundancy. Review relay health.",
      openCount,
      totalCount,
    };
  }

  return {
    status: "healthy",
    label: "Relay connectivity healthy",
    actionText: "All enabled relays are connected.",
    openCount,
    totalCount,
  };
};

