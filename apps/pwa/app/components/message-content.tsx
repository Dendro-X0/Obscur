"use client";

import React, { useMemo } from "react";
import { cn } from "@/app/lib/utils";

type TextToken = Readonly<
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "italic"; value: string }
  | { kind: "code"; value: string }
>;

type Segment = Readonly<
  | { kind: "tokens"; tokens: ReadonlyArray<TextToken> }
  | { kind: "link"; url: string }
>;

type ParseResult = Readonly<{
  segments: ReadonlyArray<Segment>;
}>;

const URL_REGEX: RegExp = /(https?:\/\/[^\s]+)/g;

const parseInlineTokens = (input: string): ReadonlyArray<TextToken> => {
  const tokens: TextToken[] = [];
  let i: number = 0;
  const pushText = (value: string): void => {
    if (!value) {
      return;
    }
    const last: TextToken | undefined = tokens[tokens.length - 1];
    if (last?.kind === "text") {
      tokens[tokens.length - 1] = { kind: "text", value: `${last.value}${value}` };
      return;
    }
    tokens.push({ kind: "text", value });
  };
  while (i < input.length) {
    const remaining: string = input.slice(i);
    if (remaining.startsWith("`")) {
      const end: number = input.indexOf("`", i + 1);
      if (end === -1) {
        pushText(input.slice(i));
        break;
      }
      const value: string = input.slice(i + 1, end);
      tokens.push({ kind: "code", value });
      i = end + 1;
      continue;
    }
    if (remaining.startsWith("**")) {
      const end: number = input.indexOf("**", i + 2);
      if (end === -1) {
        pushText(input.slice(i));
        break;
      }
      const value: string = input.slice(i + 2, end);
      tokens.push({ kind: "bold", value });
      i = end + 2;
      continue;
    }
    if (remaining.startsWith("*")) {
      const end: number = input.indexOf("*", i + 1);
      if (end === -1) {
        pushText(input.slice(i));
        break;
      }
      const value: string = input.slice(i + 1, end);
      tokens.push({ kind: "italic", value });
      i = end + 1;
      continue;
    }
    pushText(input[i] ?? "");
    i += 1;
  }
  return tokens;
};

const splitIntoSegments = (value: string): ParseResult => {
  const segments: Segment[] = [];
  const matches: ReadonlyArray<RegExpMatchArray> = Array.from(value.matchAll(URL_REGEX));
  if (matches.length === 0) {
    return { segments: [{ kind: "tokens", tokens: parseInlineTokens(value) }] };
  }
  let cursor: number = 0;
  matches.forEach((match: RegExpMatchArray): void => {
    const url: string = match[0] ?? "";
    const index: number = match.index ?? -1;
    if (index < 0 || !url) {
      return;
    }
    const before: string = value.slice(cursor, index);
    if (before) {
      segments.push({ kind: "tokens", tokens: parseInlineTokens(before) });
    }
    segments.push({ kind: "link", url });
    cursor = index + url.length;
  });
  const tail: string = value.slice(cursor);
  if (tail) {
    segments.push({ kind: "tokens", tokens: parseInlineTokens(tail) });
  }
  return { segments };
};

type MessageContentProps = Readonly<{
  content: string;
  isOutgoing: boolean;
}>;

const MessageContent = (props: MessageContentProps): React.JSX.Element | null => {
  const lines: ReadonlyArray<string> = useMemo((): ReadonlyArray<string> => {
    return props.content.split("\n");
  }, [props.content]);
  if (props.content.trim().length === 0) {
    return null;
  }
  return (
    <p className="wrap-break-word whitespace-pre-wrap text-sm leading-relaxed">
      {lines.map((line: string, lineIndex: number): React.JSX.Element => {
        const parsed: ParseResult = splitIntoSegments(line);
        return (
          <span key={`line-${lineIndex}`}>
            {parsed.segments.map((segment: Segment, segmentIndex: number): React.ReactNode => {
              if (segment.kind === "link") {
                return (
                  <a
                    key={`seg-${lineIndex}-${segmentIndex}`}
                    href={segment.url}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      "underline underline-offset-2",
                      props.isOutgoing ? "text-white/90 dark:text-zinc-900" : "text-zinc-900 dark:text-zinc-100"
                    )}
                  >
                    {segment.url}
                  </a>
                );
              }
              return segment.tokens.map((token: TextToken, tokenIndex: number): React.ReactNode => {
                const key: string = `tok-${lineIndex}-${segmentIndex}-${tokenIndex}`;
                if (token.kind === "bold") {
                  return (
                    <strong key={key}>
                      {token.value}
                    </strong>
                  );
                }
                if (token.kind === "italic") {
                  return (
                    <em key={key}>
                      {token.value}
                    </em>
                  );
                }
                if (token.kind === "code") {
                  return (
                    <code key={key} className={cn("rounded px-1 py-0.5 font-mono text-[0.9em]", props.isOutgoing ? "bg-white/15 dark:bg-black/10" : "bg-black/5 dark:bg-white/10")}>
                      {token.value}
                    </code>
                  );
                }
                return <React.Fragment key={key}>{token.value}</React.Fragment>;
              });
            })}
            {lineIndex < lines.length - 1 ? <br /> : null}
          </span>
        );
      })}
    </p>
  );
};

export { MessageContent };
