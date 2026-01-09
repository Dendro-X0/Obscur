import { validateRelayUrl } from "../validate-relay-url";

type ParseOkResult = Readonly<{
  ok: true;
  host: string;
  groupId: string;
  relayUrl: string;
  identifier: string;
}>;

type ParseErrorResult = Readonly<{
  ok: false;
  error: string;
}>;

type ParseResult = ParseOkResult | ParseErrorResult;

const GROUP_ID_REGEX: RegExp = /^[a-z0-9-_]+$/;

const HOST_REGEX: RegExp = /^[a-z0-9.-]+(?::\d+)?$/;

export const parseNip29GroupIdentifier = (input: string): ParseResult => {
  const trimmed: string = input.trim().toLowerCase();
  if (!trimmed) {
    return { ok: false, error: "Group identifier is required." };
  }
  const parts: ReadonlyArray<string> = trimmed.split("'");
  if (parts.length > 2) {
    return { ok: false, error: "Invalid group identifier format." };
  }
  const host: string = (parts[0] ?? "").trim();
  const groupId: string = ((parts[1] ?? "_").trim() || "_").trim();
  if (!host) {
    return { ok: false, error: "Group host is required." };
  }
  if (!HOST_REGEX.test(host)) {
    return { ok: false, error: "Invalid group host." };
  }
  if (!GROUP_ID_REGEX.test(groupId)) {
    return { ok: false, error: "Invalid group id (allowed: a-z0-9-_)" };
  }
  const relayCandidate: string = `wss://${host}`;
  const validated = validateRelayUrl(relayCandidate);
  if (!validated) {
    return { ok: false, error: "Invalid relay URL derived from host." };
  }
  const identifier: string = `${host}'${groupId}`;
  return { ok: true, host, groupId, relayUrl: validated.normalizedUrl, identifier };
};
