type Row = Record<string, unknown>;

type MembershipHeadRow = Readonly<{
  community_id: string;
  latest_seq: number;
  head_hash: string;
  updated_at_unix_ms: number;
}>;

type MembershipDeltaRow = Readonly<{
  delta_id: string;
  community_id: string;
  seq: number;
  action: string;
  subject_pubkey: string;
  actor_pubkey: string;
  created_at_unix_ms: number;
  signature: string;
}>;

export type MockD1State = Readonly<{
  heads: Map<string, MembershipHeadRow>;
  deltas: MembershipDeltaRow[];
}>;

export const createMockD1 = (state: MockD1State): D1Database => ({
  prepare: (sql: string) => ({
    bind: (...args: unknown[]) => {
      const run = async (): Promise<D1Result> => {
        if (sql.includes("INSERT INTO community_membership_deltas")) {
          state.deltas.push({
            delta_id: args[0] as string,
            community_id: args[1] as string,
            seq: args[2] as number,
            action: args[3] as string,
            subject_pubkey: args[4] as string,
            actor_pubkey: args[5] as string,
            created_at_unix_ms: args[6] as number,
            signature: args[7] as string,
          });
          return { success: true, meta: {} } as D1Result;
        }
        if (sql.includes("INSERT INTO community_membership_heads")) {
          const communityId = args[0] as string;
          state.heads.set(communityId, {
            community_id: communityId,
            latest_seq: args[1] as number,
            head_hash: args[2] as string,
            updated_at_unix_ms: args[3] as number,
          });
          return { success: true, meta: {} } as D1Result;
        }
        return { success: true, meta: {} } as D1Result;
      };

      const first = async (): Promise<Row | null> => {
        if (sql.includes("community_membership_heads") && sql.includes("latest_seq, head_hash")) {
          const communityId = args[0] as string;
          return state.heads.get(communityId) ?? null;
        }
        if (sql.includes("SELECT latest_seq FROM community_membership_heads")) {
          const communityId = args[0] as string;
          const head = state.heads.get(communityId);
          return head ? { latest_seq: head.latest_seq } : null;
        }
        return null;
      };

      const all = async (): Promise<D1Result<MembershipDeltaRow[]>> => {
        const communityId = args[0] as string;
        const sinceSeq = args[1] as number;
        const rows = state.deltas
          .filter((row) => row.community_id === communityId && row.seq > sinceSeq)
          .sort((a, b) => a.seq - b.seq)
          .slice(0, 200);
        return { results: rows, success: true, meta: {} } as D1Result<MembershipDeltaRow[]>;
      };

      return { first, all, run };
    },
  }),
  batch: async () => [],
  exec: async () => ({ count: 0, duration: 0 }),
  dump: async () => [],
} as D1Database);
