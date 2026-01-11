"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, Info, X, XCircle } from "lucide-react";
import { cn } from "../../lib/cn";

type ToastType = "success" | "error" | "info" | "warning";

type ToastPosition = "top-right" | "top-center" | "bottom-right" | "bottom-center";

type Toast = Readonly<{
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  position?: ToastPosition;
}>;

type ToastProps = Readonly<{
  toast: Toast;
  onDismiss: (id: string) => void;
}>;

const getToastIcon = (type: ToastType) => {
  const iconClass = "h-5 w-5 shrink-0";
  
  switch (type) {
    case "success":
      return <CheckCircle className={cn(iconClass, "text-emerald-600 dark:text-emerald-400")} />;
    case "error":
      return <XCircle className={cn(iconClass, "text-red-600 dark:text-red-400")} />;
    case "warning":
      return <AlertTriangle className={cn(iconClass, "text-amber-600 dark:text-amber-400")} />;
    case "info":
    default:
      return <Info className={cn(iconClass, "text-blue-600 dark:text-blue-400")} />;
  }
};

const getToastStyles = (type: ToastType): string => {
  switch (type) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100";
    case "error":
      return "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/50 dark:text-red-100";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100";
    case "info":
    default:
      return "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-100";
  }
};

const ToastItem = (props: ToastProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  
  const { onDismiss, toast } = props;

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 200);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, handleDismiss]);

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full max-w-sm transform items-start gap-3 rounded-xl border p-4 shadow-lg backdrop-blur transition-all duration-200",
        getToastStyles(toast.type),
        isVisible && !isExiting 
          ? "translate-x-0 opacity-100" 
          : "translate-x-full opacity-0"
      )}
    >
      {getToastIcon(toast.type)}
      
      <div className="flex-1 min-w-0">
        {toast.title && (
          <div className="font-medium text-sm mb-1">
            {toast.title}
          </div>
        )}
        <div className="text-sm leading-relaxed">
          {toast.message}
        </div>
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 rounded-md p-1 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

type ToastContainerProps = Readonly<{
  toasts: ReadonlyArray<Toast>;
  onDismiss: (id: string) => void;
  position?: ToastPosition;
}>;

const getPositionStyles = (position: ToastPosition): string => {
  switch (position) {
    case "top-center":
      return "top-4 left-1/2 -translate-x-1/2";
    case "bottom-right":
      return "bottom-4 right-4";
    case "bottom-center":
      return "bottom-4 left-1/2 -translate-x-1/2";
    case "top-right":
    default:
      return "top-4 right-4";
  }
};

export const ToastContainer = (props: ToastContainerProps) => {
  const position = props.position ?? "top-right";

  if (props.toasts.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "pointer-events-none fixed z-50 flex flex-col gap-2",
        getPositionStyles(position)
      )}
    >
      {props.toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={props.onDismiss}
        />
      ))}
    </div>
  );
};

// Toast store and hook
let toastId = 0;
const toastListeners = new Set<() => void>();
let toasts: Toast[] = [];

const emitChange = () => {
  toastListeners.forEach(listener => listener());
};

export const addToast = (toast: Omit<Toast, "id">): string => {
  const id = `toast-${++toastId}`;
  const newToast: Toast = {
    id,
    duration: 5000, // Default 5 seconds
    position: "top-right",
    ...toast,
  };
  
  toasts = [...toasts, newToast];
  emitChange();
  return id;
};

export const removeToast = (id: string): void => {
  toasts = toasts.filter(toast => toast.id !== id);
  emitChange();
};

export const useToasts = () => {
  const [currentToasts, setCurrentToasts] = useState<Toast[]>(toasts);

  useEffect(() => {
    const listener = () => setCurrentToasts([...toasts]);
    toastListeners.add(listener);
    return () => {
      toastListeners.delete(listener);
    };
  }, []);

  return {
    toasts: currentToasts,
    addToast,
    removeToast,
  };
};

// Convenience functions
export const toast = {
  success: (message: string, options?: Partial<Omit<Toast, "id" | "type" | "message">>) =>
    addToast({ type: "success", message, ...options }),
  
  error: (message: string, options?: Partial<Omit<Toast, "id" | "type" | "message">>) =>
    addToast({ type: "error", message, ...options }),
  
  info: (message: string, options?: Partial<Omit<Toast, "id" | "type" | "message">>) =>
    addToast({ type: "info", message, ...options }),
  
  warning: (message: string, options?: Partial<Omit<Toast, "id" | "type" | "message">>) =>
    addToast({ type: "warning", message, ...options }),
};