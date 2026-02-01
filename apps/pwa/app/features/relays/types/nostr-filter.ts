export type NostrFilter = Readonly<{
  kinds?: ReadonlyArray<number>;
  authors?: ReadonlyArray<string>;
  since?: number;
  limit?: number;
  "#p"?: ReadonlyArray<string>;
  "#h"?: ReadonlyArray<string>;
  "#d"?: ReadonlyArray<string>;
}>;
