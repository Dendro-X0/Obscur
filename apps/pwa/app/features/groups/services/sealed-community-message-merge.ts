export const SEALED_COMMUNITY_MAX_GROUP_MESSAGES = 200;

export type SealedCommunityGroupMessageEvent = Readonly<{
  id: string;
  pubkey: string;
  created_at: number;
  content: string;
}>;

export const mergeGroupMessagesDescending = (params: Readonly<{
  previous: ReadonlyArray<SealedCommunityGroupMessageEvent>;
  incoming: ReadonlyArray<SealedCommunityGroupMessageEvent>;
}>): ReadonlyArray<SealedCommunityGroupMessageEvent> => {
  if (params.incoming.length === 0) {
    return params.previous;
  }
  if (params.previous.length === 0) {
    return [...params.incoming]
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, SEALED_COMMUNITY_MAX_GROUP_MESSAGES);
  }

  if (params.incoming.length === 1) {
    const incoming = params.incoming[0];
    const existingIndex = params.previous.findIndex((message) => message.id === incoming.id);
    if (existingIndex >= 0) {
      const existing = params.previous[existingIndex];
      if (
        existing.created_at === incoming.created_at
        && existing.content === incoming.content
        && existing.pubkey === incoming.pubkey
      ) {
        return params.previous;
      }

      const replaced = [...params.previous];
      replaced[existingIndex] = incoming;
      const prevIsOrdered = existingIndex === 0 || replaced[existingIndex - 1].created_at >= incoming.created_at;
      const nextIsOrdered = existingIndex === replaced.length - 1 || replaced[existingIndex + 1].created_at <= incoming.created_at;
      if (prevIsOrdered && nextIsOrdered) {
        return replaced.slice(0, SEALED_COMMUNITY_MAX_GROUP_MESSAGES);
      }
    } else {
      if (incoming.created_at >= params.previous[0].created_at) {
        return [incoming, ...params.previous].slice(0, SEALED_COMMUNITY_MAX_GROUP_MESSAGES);
      }
      if (incoming.created_at <= params.previous[params.previous.length - 1].created_at) {
        return [...params.previous, incoming].slice(0, SEALED_COMMUNITY_MAX_GROUP_MESSAGES);
      }
    }
  }

  const byId = new Map<string, SealedCommunityGroupMessageEvent>();
  params.previous.forEach((message) => {
    byId.set(message.id, message);
  });
  params.incoming.forEach((message) => {
    byId.set(message.id, message);
  });
  return Array.from(byId.values())
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, SEALED_COMMUNITY_MAX_GROUP_MESSAGES);
};
