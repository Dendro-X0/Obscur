"use client";

import { ToastContainer, useToasts } from "./ui/toast";

export const ToastProvider = () => {
  const { toasts, removeToast } = useToasts();

  return (
    <ToastContainer
      toasts={toasts}
      onDismiss={removeToast}
      position="top-right"
    />
  );
};