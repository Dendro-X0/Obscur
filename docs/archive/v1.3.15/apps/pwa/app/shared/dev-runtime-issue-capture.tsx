"use client";

import { useEffect } from "react";
import { reportDevRuntimeIssue } from "@/app/shared/dev-runtime-issue-reporter";

const DEV_MODE_KEY = "obscur_dev_mode";

const isDevModeStorageEnabled = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    if (window.localStorage.getItem(DEV_MODE_KEY) === "true") {
      return true;
    }
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key) continue;
      if (!key.endsWith(`:${DEV_MODE_KEY}`)) continue;
      if (window.localStorage.getItem(key) === "true") {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
};

const isCaptureEnabled = (): boolean => {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }
  return isDevModeStorageEnabled();
};

const normalizeUnknownErrorMessage = (value: unknown): string => {
  if (value instanceof Error) {
    return value.message || value.name || "Unknown runtime error";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "Unknown runtime error";
  }
};

const getWindowErrorMessage = (event: Event): string => {
  const errorEvent = event as ErrorEvent;
  if (typeof errorEvent.message === "string" && errorEvent.message.trim().length > 0) {
    return errorEvent.message;
  }
  return normalizeUnknownErrorMessage(errorEvent.error);
};

const readTargetDescriptor = (event: Event): string | null => {
  const target = event.target as (Element | null);
  if (!target || typeof target !== "object") {
    return null;
  }
  if ("tagName" in target && typeof target.tagName === "string") {
    const tag = target.tagName.toLowerCase();
    if ("id" in target && typeof target.id === "string" && target.id.trim().length > 0) {
      return `${tag}#${target.id}`;
    }
    return tag;
  }
  return null;
};

export const DevRuntimeIssueCapture = (): null => {
  useEffect(() => {
    if (!isCaptureEnabled()) {
      return;
    }

    const onError = (event: Event): void => {
      const message = getWindowErrorMessage(event);
      const targetDescriptor = readTargetDescriptor(event);
      reportDevRuntimeIssue({
        domain: "runtime",
        operation: "window_error",
        severity: "error",
        reasonCode: "unhandled_error",
        message: message || "Unhandled runtime error captured by window.onerror.",
        retryable: false,
        source: "dev-runtime-issue-capture",
        context: {
          fileName: (event as ErrorEvent).filename ?? null,
          lineNumber: typeof (event as ErrorEvent).lineno === "number" ? (event as ErrorEvent).lineno : null,
          columnNumber: typeof (event as ErrorEvent).colno === "number" ? (event as ErrorEvent).colno : null,
          target: targetDescriptor,
        },
        fingerprint: ["runtime", "window_error", message || "unknown"].join("|"),
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent): void => {
      const reason = normalizeUnknownErrorMessage(event.reason);
      reportDevRuntimeIssue({
        domain: "runtime",
        operation: "unhandled_promise_rejection",
        severity: "error",
        reasonCode: "unhandled_rejection",
        message: reason || "Unhandled promise rejection.",
        retryable: false,
        source: "dev-runtime-issue-capture",
        context: {
          hasReason: event.reason != null,
        },
        fingerprint: ["runtime", "unhandled_rejection", reason || "unknown"].join("|"),
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
};

export const devRuntimeIssueCaptureInternals = {
  isDevModeStorageEnabled,
  isCaptureEnabled,
  normalizeUnknownErrorMessage,
  getWindowErrorMessage,
};
