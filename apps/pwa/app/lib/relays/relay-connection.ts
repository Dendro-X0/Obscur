import type { RelayConnectionStatus } from "./relay-connection-status";

type RelayConnection = Readonly<{
  url: string;
  status: RelayConnectionStatus;
  updatedAtUnixMs: number;
  errorMessage?: string;
}>;

export type { RelayConnection };
