/** Redact long conversation ids for structured logs (R1 diagnostics). */
export const toConversationIdDiagnosticLabel = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "unknown";
  }
  if (trimmed.length <= 20) {
    return trimmed;
  }
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-8)}`;
};
