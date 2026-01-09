import type { RelayUrl } from "./relay-url";

type BootstrapConfig = Readonly<{
  relays: ReadonlyArray<RelayUrl>;
  version: string;
}>;

export type { BootstrapConfig };
