import { validateRelayUrl } from "./validate-relay-url";

type ParseInviteParamsOk = Readonly<{
  ok: true;
  relayUrl: string;
  groupId: string;
  host: string;
  identifier: string;
  inviterPublicKeyHex?: string;
  label?: string;
}>;

type ParseInviteParamsError = Readonly<{
  ok: false;
  error: string;
}>;

type ParseInviteParamsResult = ParseInviteParamsOk | ParseInviteParamsError;

const GROUP_ID_REGEX: RegExp = /^[a-z0-9-_]+$/;

const PUBKEY_HEX_REGEX: RegExp = /^[a-f0-9]{64}$/;

const parseHostFromRelayUrl = (relayUrl: string): string | null => {
  try {
    const parsed: URL = new URL(relayUrl);
    if (parsed.protocol !== "wss:") {
      return null;
    }
    const host: string = parsed.host.trim().toLowerCase();
    return host ? host : null;
  } catch {
    return null;
  }
};

export const parseInviteParams = (params: URLSearchParams): ParseInviteParamsResult => {
  const relayInput: string = (params.get("relay") ?? "").trim();
  const groupInput: string = (params.get("group") ?? "").trim().toLowerCase();
  const inviterInput: string = (params.get("inviter") ?? "").trim().toLowerCase();
  const labelInput: string = (params.get("name") ?? "").trim();
  if (!relayInput) {
    return { ok: false, error: "Missing relay parameter." };
  }
  const validatedRelay = validateRelayUrl(relayInput);
  if (!validatedRelay) {
    return { ok: false, error: "Invalid relay URL (must be wss://)." };
  }
  if (!groupInput) {
    return { ok: false, error: "Missing group parameter." };
  }
  if (!GROUP_ID_REGEX.test(groupInput)) {
    return { ok: false, error: "Invalid group id (allowed: a-z0-9-_)." };
  }
  const host: string | null = parseHostFromRelayUrl(validatedRelay.normalizedUrl);
  if (!host) {
    return { ok: false, error: "Could not derive relay host." };
  }
  const inviterPublicKeyHex: string | undefined = inviterInput && PUBKEY_HEX_REGEX.test(inviterInput) ? inviterInput : undefined;
  const label: string | undefined = labelInput.length > 0 && labelInput.length <= 60 ? labelInput : undefined;
  const identifier: string = `${host}'${groupInput}`;
  return { ok: true, relayUrl: validatedRelay.normalizedUrl, groupId: groupInput, host, identifier, inviterPublicKeyHex, label };
}
