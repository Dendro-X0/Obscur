const TRAILING_PUNCTUATION_REGEX: RegExp = /[),.?!:;\]]+$/;

const extractFirstUrl = (text: string): string | null => {
  const match: RegExpMatchArray | null = text.match(/https?:\/\/[^\s<>()]+/i);
  const raw: string | undefined = match?.[0];
  if (!raw) {
    return null;
  }
  const trimmed: string = raw.replace(TRAILING_PUNCTUATION_REGEX, "");
  try {
    const parsed: URL = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
};

export { extractFirstUrl };
