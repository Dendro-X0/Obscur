type NostrEvent = Readonly<{
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: ReadonlyArray<ReadonlyArray<string>>;
  content: string;
  sig: string;
}>;

export type { NostrEvent };
