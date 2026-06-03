const STRUCTURED_TYPE_LABELS: Readonly<Record<string, string>> = {
  "community-invite": "Community invitation",
  "community-invite-response": "Invitation response",
  "voice-call-invite": "Voice call invitation",
  "voice-call-signal": "Voice call update",
};

export function formatStructuredMessagePreview(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as { type?: unknown };
    const type = typeof parsed?.type === "string" ? parsed.type : null;
    if (!type) {
      return "System message";
    }
    return STRUCTURED_TYPE_LABELS[type] ?? `System: ${type}`;
  } catch {
    return null;
  }
}
