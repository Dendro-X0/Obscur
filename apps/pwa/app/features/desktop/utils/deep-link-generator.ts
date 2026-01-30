/**
 * Generate deep links for desktop app
 * These links use the obscur:// protocol
 */

export interface InviteLinkParams {
  code: string;
}

export interface DirectMessageLinkParams {
  pubkey: string;
}

export interface GroupLinkParams {
  id: string;
}

/**
 * Generate an invite deep link
 */
export function generateInviteDeepLink(params: InviteLinkParams): string {
  return `obscur://invite?code=${encodeURIComponent(params.code)}`;
}

/**
 * Generate a direct message deep link
 */
export function generateDirectMessageDeepLink(params: DirectMessageLinkParams): string {
  return `obscur://dm?pubkey=${encodeURIComponent(params.pubkey)}`;
}

/**
 * Generate a group deep link
 */
export function generateGroupDeepLink(params: GroupLinkParams): string {
  return `obscur://group?id=${encodeURIComponent(params.id)}`;
}

/**
 * Check if a URL is a valid Obscur deep link
 */
export function isObscurDeepLink(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "obscur:";
  } catch {
    return false;
  }
}

/**
 * Parse an Obscur deep link
 */
export function parseObscurDeepLink(url: string): {
  type: "invite" | "dm" | "group" | "unknown";
  params: Record<string, string>;
} | null {
  try {
    const parsed = new URL(url);
    
    if (parsed.protocol !== "obscur:") {
      return null;
    }

    const path = parsed.pathname.replace(/^\/+/, "");
    const params: Record<string, string> = {};
    
    parsed.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    if (path === "invite") {
      return { type: "invite", params };
    }

    if (path === "dm") {
      return { type: "dm", params };
    }

    if (path === "group") {
      return { type: "group", params };
    }

    return { type: "unknown", params };
  } catch {
    return null;
  }
}
