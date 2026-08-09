/**
 * Single owner for shell “N/M relays active” numerators.
 * Open sockets are truth; writable/publish-ready must not green-light Connected.
 */

export type ShellRelayConnectionLike = Readonly<{
  status: string;
}>;

export const countOpenRelayConnections = (
  connections: ReadonlyArray<ShellRelayConnectionLike>,
): number => connections.filter((connection) => connection.status === "open").length;

export const resolveShellRelayActiveCounts = (params: Readonly<{
  connections: ReadonlyArray<ShellRelayConnectionLike>;
  enabledRelayUrls: ReadonlyArray<string>;
}>): Readonly<{ openCount: number; totalCount: number }> => {
  const openCount = countOpenRelayConnections(params.connections);
  const enabledCount = params.enabledRelayUrls
    .map((url) => url.trim())
    .filter((url) => url.length > 0).length;
  const totalCount = Math.max(params.connections.length, enabledCount, openCount);
  return { openCount, totalCount };
};
