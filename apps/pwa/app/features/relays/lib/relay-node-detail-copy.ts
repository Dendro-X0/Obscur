/**
 * TI-4: humanize machine relay detail codes for Settings / Relays UI.
 * Known snake_case codes map to English defaults; unknown codes stay as-is for diagnostics.
 */

const RELAY_NODE_DETAIL_CODE_DEFAULTS: Readonly<Record<string, string>> = {
  websocket_error: "WebSocket connection failed.",
  connection_refused: "Connection refused.",
  connection_timeout: "Connection timed out.",
  tls_error: "TLS handshake failed.",
  dns_error: "DNS lookup failed.",
  proxy_error: "Proxy error while connecting.",
  tor_unreachable: "Tor path unreachable for this relay.",
};

const MACHINE_DETAIL_CODE = /^[a-z][a-z0-9_]{2,63}$/;

/** True when detail looks like a machine code (e.g. websocket_error). */
export const isRelayNodeDetailMachineCode = (value: string): boolean => (
  MACHINE_DETAIL_CODE.test(value.trim())
);

/**
 * Map known machine codes to human copy. Returns null when not a known code
 * (caller may keep prose or show the raw string).
 */
export const humanizeRelayNodeDetailCode = (value: string): string | null => {
  const trimmed = value.trim();
  if (!isRelayNodeDetailMachineCode(trimmed)) {
    return null;
  }
  return RELAY_NODE_DETAIL_CODE_DEFAULTS[trimmed] ?? null;
};

/** i18n key for a known detail code, if any. */
export const relayNodeDetailCodeI18nKey = (value: string): string | null => {
  const trimmed = value.trim();
  if (!(trimmed in RELAY_NODE_DETAIL_CODE_DEFAULTS)) {
    return null;
  }
  // settings.relays.node.detail.websocketError style — camelCase from snake_case
  const camel = trimmed.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  return `settings.relays.node.detail.${camel}`;
};

/** TI-4: omit role chip when empty (disabled uses badge only). */
export const shouldRenderRelayNodeRoleChip = (roleLabel: string): boolean => (
  roleLabel.trim().length > 0
);
