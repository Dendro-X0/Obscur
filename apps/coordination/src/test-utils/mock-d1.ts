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

export type RoomKeyWrapRow = Readonly<{
  wrap_id: string;
  community_id: string;
  subject_pubkey: string;
  wrap_seq: number;
  scheme: string;
  ciphertext: string;
  actor_pubkey: string;
  created_at_unix_ms: number;
  signature: string;
}>;

export type MockD1State = Readonly<{
  heads: Map<string, MembershipHeadRow>;
  deltas: MembershipDeltaRow[];
  wraps: RoomKeyWrapRow[];
}>;

export const createEmptyMockD1State = (): MockD1State => ({
  heads: new Map(),
  deltas: [],
  wraps: [],
});

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
        if (sql.includes("INSERT INTO community_member_room_key_wraps")) {
          state.wraps.push({
            wrap_id: args[0] as string,
            community_id: args[1] as string,
            subject_pubkey: args[2] as string,
            wrap_seq: args[3] as number,
            scheme: args[4] as string,
            ciphertext: args[5] as string,
            actor_pubkey: args[6] as string,
            created_at_unix_ms: args[7] as number,
            signature: args[8] as string,
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
        if (sql.includes("COALESCE(MAX(wrap_seq)")) {
          const communityId = args[0] as string;
          const subjectPubkey = (args[1] as string).toLowerCase();
          const maxSeq = state.wraps
            .filter((row) => row.community_id === communityId && row.subject_pubkey === subjectPubkey)
            .reduce((max, row) => Math.max(max, row.wrap_seq), 0);
          return { max_seq: maxSeq };
        }
        return null;
      };

      const all = async (): Promise<D1Result<MembershipDeltaRow[] | RoomKeyWrapRow[]>> => {
        if (sql.includes("community_member_room_key_wraps")) {
          const communityId = args[0] as string;
          const sinceWrapSeq = args[1] as number;
          const rows = state.wraps
            .filter((row) => row.community_id === communityId && row.wrap_seq > sinceWrapSeq)
            .sort((a, b) => a.wrap_seq - b.wrap_seq)
            .slice(0, 200);
          return { results: rows, success: true, meta: {} } as D1Result<RoomKeyWrapRow[]>;
        }
        const communityId = args[0] as string;
        const sinceSeq = args.length > 1 ? (args[1] as number) : -1;
        const rows = state.deltas
          .filter((row) => row.community_id === communityId && (sinceSeq < 0 || row.seq > sinceSeq))
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
