import type { RelayUrl } from "@dweb/core/relay-url";

type RelaySet = Readonly<{
  urls: ReadonlyArray<RelayUrl>;
}>;

export type { RelaySet };
