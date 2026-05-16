export type ProfileBusPublicKeyHex = string;

/**
 * Profile-scoped domain events. App-specific payloads use `unknown` so this
 * package stays free of messenger feature types.
 */
export type ProfileBusDomainEvent =
    | Readonly<{
          type: "chat-state-replaced";
          profileId: string;
          publicKeyHex: ProfileBusPublicKeyHex;
      }>
    | Readonly<{
          type: "group-invite-accepted";
          groupId: string;
          memberPubkey: string;
          relayUrl?: string;
          communityId?: string;
          recipientPublicKeyHex?: string;
      }>
    | Readonly<{ type: "group-invite-received"; invite: unknown }>
    | Readonly<{ type: "group-membership-confirmed"; detail: unknown }>
    | Readonly<{ type: "group-membership-snapshot"; detail: unknown }>
    | Readonly<{ type: "community-known-participants-observed"; detail: unknown }>
    | Readonly<{ type: "account-restore-materialization-started"; detail: unknown }>
    | Readonly<{ type: "account-restore-materialization-completed"; detail: unknown }>
    | Readonly<{ type: "community-membership-ledger-updated"; detail: unknown }>
    | Readonly<{ type: "community-operation-log-updated"; detail: unknown }>
    | Readonly<{ type: "community-state-updated"; detail: unknown }>
    | Readonly<{ type: "crdt-membership-gossip"; detail: unknown }>
    | Readonly<{ type: "crdt-anti-entropy-request"; detail: unknown }>
    | Readonly<{ type: "crdt-membership-received"; detail: unknown }>
    | Readonly<{ type: "community-membership-ingress"; detail: unknown }>
    | Readonly<{ type: "peer-interaction-updated"; detail: unknown }>
    | Readonly<{ type: "messages-index-rebuilt"; detail: unknown }>
    | Readonly<{ type: "notification-target-preference-changed" }>
    | Readonly<{ type: "voice-call-overlay-action"; detail: unknown }>
    | Readonly<{ type: "group-removed"; conversationId: string }>
    | Readonly<{ type: "new-message"; conversationId: string; message: unknown }>
    | Readonly<{
          type: "membership-updated";
          groupId: string;
          members: readonly ProfileBusPublicKeyHex[];
      }>
    | Readonly<{ type: "relay-connected"; relayUrl: string }>
    | Readonly<{ type: "relay-disconnected"; relayUrl: string; reason: string }>
    | Readonly<{ type: "incoming-dm"; detail: unknown }>;

export type ProfileBusEventHandler = (event: ProfileBusDomainEvent) => void;

export type ProfileBusUnsubscribe = () => void;

export interface ProfileMessageBus {
    readonly profileId: string;
    publish(event: ProfileBusDomainEvent): void;
    subscribe(handler: ProfileBusEventHandler): ProfileBusUnsubscribe;
    subscribeTo<T extends ProfileBusDomainEvent["type"]>(
        type: T,
        handler: (event: Extract<ProfileBusDomainEvent, { type: T }>) => void
    ): ProfileBusUnsubscribe;
}

export type CreateProfileMessageBusParams = Readonly<{
    profileId: string;
    onSubscriberError?: (error: unknown) => void;
}>;

export function createProfileMessageBus(params: CreateProfileMessageBusParams): ProfileMessageBus {
    const handlers = new Set<ProfileBusEventHandler>();
    const ownerId = params.profileId;

    const report = (error: unknown): void => {
        const fn = params.onSubscriberError ?? ((e: unknown) => console.error(`[ProfileMessageBus ${ownerId}] Handler error`, e));
        fn(error);
    };

    return {
        profileId: ownerId,

        publish(event): void {
            // Defensive: chat-state carries profileId — refuse cross-profile spoofing silently.
            if (event.type === "chat-state-replaced" && event.profileId !== ownerId) {
                return;
            }
            // Restore / ledger events may embed profileId on detail — same isolation rule.
            if (
                event.type === "account-restore-materialization-started"
                || event.type === "account-restore-materialization-completed"
                || event.type === "community-membership-ledger-updated"
                || event.type === "community-operation-log-updated"
                || event.type === "community-state-updated"
                || event.type === "crdt-membership-gossip"
                || event.type === "crdt-anti-entropy-request"
                || event.type === "crdt-membership-received"
                || event.type === "community-membership-ingress"
                || event.type === "peer-interaction-updated"
                || event.type === "messages-index-rebuilt"
            ) {
                const d = event.detail;
                if (d != null && typeof d === "object") {
                    const pid = (d as { profileId?: unknown }).profileId;
                    if (typeof pid === "string" && pid.length > 0 && pid !== ownerId) {
                        return;
                    }
                }
            }
            for (const handler of handlers) {
                try {
                    handler(event);
                } catch (e) {
                    report(e);
                }
            }
        },

        subscribe(handler): ProfileBusUnsubscribe {
            handlers.add(handler);
            return (): void => {
                handlers.delete(handler);
            };
        },

        subscribeTo(type, handler): ProfileBusUnsubscribe {
            const wrapper: ProfileBusEventHandler = (event) => {
                if (event.type === type) {
                    handler(event as Extract<ProfileBusDomainEvent, { type: typeof type }>);
                }
            };
            handlers.add(wrapper);
            return (): void => {
                handlers.delete(wrapper);
            };
        },
    };
}
