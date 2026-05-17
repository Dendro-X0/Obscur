export type AppStatusSnapshot = Readonly<{
  identity: Readonly<{ status: "locked" | "unlocked" | "unknown" }>;
  invite: Readonly<{ status: "none" | "pending" | "redeemed" | "expired" | "invalid" | "error" }>;
  request: Readonly<{ status: "none" | "pending" | "accepted" | "declined" | "blocked" }>;
  relay: Readonly<{ status: "offline" | "connecting" | "connected" | "degraded" }>;
  group: Readonly<{ status: "not_member" | "requested" | "member" | "moderator" | "owner" }>;
}>;
