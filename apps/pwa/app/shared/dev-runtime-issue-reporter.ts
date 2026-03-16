export type DevRuntimeIssueDomain =
  | "relay"
  | "messaging"
  | "upload"
  | "runtime"
  | "storage"
  | "unknown";

export type DevRuntimeIssueSeverity = "warn" | "error";

type DevIssueContextValue = string | number | boolean | null;

export type DevRuntimeIssue = Readonly<{
  id: string;
  atUnixMs: number;
  firstSeenAtUnixMs: number;
  lastSeenAtUnixMs: number;
  occurrenceCount: number;
  domain: DevRuntimeIssueDomain;
  operation: string;
  severity: DevRuntimeIssueSeverity;
  reasonCode?: string;
  message: string;
  retryable?: boolean;
  source?: string;
  fingerprint: string;
  context: Readonly<Record<string, DevIssueContextValue>>;
}>;

type DevRuntimeIssueInput = Readonly<{
  domain: DevRuntimeIssueDomain;
  operation: string;
  severity?: DevRuntimeIssueSeverity;
  reasonCode?: string;
  message: string;
  retryable?: boolean;
  source?: string;
  context?: Readonly<Record<string, DevIssueContextValue>>;
  fingerprint?: string;
}>;

type DevRuntimeIssueTools = Readonly<{
  getRecentIssues: () => ReadonlyArray<DevRuntimeIssue>;
  clearIssues: () => void;
}>;

declare global {
  interface Window {
    obscurDevRuntimeIssues?: DevRuntimeIssueTools;
  }
}

const MAX_ISSUES = 200;
const DEDUPE_WINDOW_MS = 8_000;
const REPEAT_SUMMARY_INTERVAL = 10;
let issueIdCounter = 0;
let issues: ReadonlyArray<DevRuntimeIssue> = [];

const shouldCaptureDevIssues = (): boolean => process.env.NODE_ENV !== "production";

const installDevTools = (): void => {
  if (!shouldCaptureDevIssues()) {
    return;
  }
  if (typeof window === "undefined") {
    return;
  }
  window.obscurDevRuntimeIssues = {
    getRecentIssues: () => issues,
    clearIssues: () => {
      issues = [];
      installDevTools();
    },
  };
};

const normalizeContext = (
  value: Readonly<Record<string, DevIssueContextValue>> | undefined
): Readonly<Record<string, DevIssueContextValue>> => {
  if (!value) {
    return {};
  }
  return Object.fromEntries(Object.entries(value));
};

const buildFingerprint = (params: Readonly<{
  domain: DevRuntimeIssueDomain;
  operation: string;
  reasonCode?: string;
  message: string;
  fingerprint?: string;
}>): string => {
  if (params.fingerprint && params.fingerprint.trim().length > 0) {
    return params.fingerprint.trim();
  }
  return [
    params.domain,
    params.operation,
    params.reasonCode ?? "none",
    params.message.trim() || "no_message",
  ].join("|");
};

const announceIssue = (issue: DevRuntimeIssue, repeated: boolean): void => {
  if (!shouldCaptureDevIssues()) {
    return;
  }
  const label = `[DevRuntimeIssue:${issue.severity}] ${issue.domain}.${issue.operation}`;
  if (repeated) {
    if (issue.occurrenceCount === 2 || issue.occurrenceCount % REPEAT_SUMMARY_INTERVAL === 0) {
      console.warn(`${label} repeated x${issue.occurrenceCount}`, issue);
    }
    return;
  }
  console.warn(label, issue);
};

const toIssueId = (): string => {
  issueIdCounter += 1;
  return `dev_issue_${Date.now()}_${issueIdCounter}`;
};

export const reportDevRuntimeIssue = (
  params: DevRuntimeIssueInput
): DevRuntimeIssue | null => {
  if (!shouldCaptureDevIssues()) {
    return null;
  }

  const now = Date.now();
  const fingerprint = buildFingerprint({
    domain: params.domain,
    operation: params.operation,
    reasonCode: params.reasonCode,
    message: params.message,
    fingerprint: params.fingerprint,
  });
  const context = normalizeContext(params.context);
  const severity = params.severity ?? "error";
  const existingIndex = issues.findIndex((issue) =>
    issue.fingerprint === fingerprint
    && now - issue.lastSeenAtUnixMs <= DEDUPE_WINDOW_MS
  );

  if (existingIndex >= 0) {
    const existing = issues[existingIndex];
    const next: DevRuntimeIssue = {
      ...existing,
      atUnixMs: now,
      lastSeenAtUnixMs: now,
      occurrenceCount: existing.occurrenceCount + 1,
      context,
      message: params.message,
      reasonCode: params.reasonCode,
      retryable: params.retryable,
      source: params.source,
      severity,
    };
    issues = [
      ...issues.slice(0, existingIndex),
      next,
      ...issues.slice(existingIndex + 1),
    ];
    installDevTools();
    announceIssue(next, true);
    return next;
  }

  const issue: DevRuntimeIssue = {
    id: toIssueId(),
    atUnixMs: now,
    firstSeenAtUnixMs: now,
    lastSeenAtUnixMs: now,
    occurrenceCount: 1,
    domain: params.domain,
    operation: params.operation,
    severity,
    reasonCode: params.reasonCode,
    message: params.message,
    retryable: params.retryable,
    source: params.source,
    fingerprint,
    context,
  };
  issues = [...issues, issue].slice(-MAX_ISSUES);
  installDevTools();
  announceIssue(issue, false);
  return issue;
};

export const devRuntimeIssueReporterInternals = {
  getIssues: (): ReadonlyArray<DevRuntimeIssue> => issues,
  clearIssues: (): void => {
    issues = [];
  },
  buildFingerprint,
};
