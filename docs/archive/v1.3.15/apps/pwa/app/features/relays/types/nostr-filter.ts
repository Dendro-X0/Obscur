export type NostrFilter = Readonly<{
  kinds?: ReadonlyArray<number>;
  authors?: ReadonlyArray<string>;
  since?: number;
  until?: number;
  limit?: number;
  search?: string;
  "#p"?: ReadonlyArray<string>;
  "#h"?: ReadonlyArray<string>;
  "#d"?: ReadonlyArray<string>;
} & {
  [key in `#${string}`]?: ReadonlyArray<string>;
}>;
