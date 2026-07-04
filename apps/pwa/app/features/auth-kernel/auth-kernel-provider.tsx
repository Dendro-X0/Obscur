"use client";

import React, { createContext, useContext, useMemo } from "react";
import { isAuthKernelAuthority } from "./auth-kernel-policy";
import { createAuthKernelPorts, type AuthKernelPorts } from "./auth-kernel-ports";

export type AuthKernelContextValue = Readonly<{
  active: boolean;
  ports: AuthKernelPorts;
}>;

const AuthKernelContext = createContext<AuthKernelContextValue | null>(null);

/**
 * AUTH-K-AUTHORITY provider — exposes auth-kernel ports when authority is enabled.
 */
export function AuthKernelProvider(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  const active = isAuthKernelAuthority();
  const ports = useMemo(() => createAuthKernelPorts(), []);

  const value = useMemo<AuthKernelContextValue>(() => ({
    active,
    ports,
  }), [active, ports]);

  if (!active) {
    return <>{props.children}</>;
  }

  return (
    <AuthKernelContext.Provider value={value}>
      {props.children}
    </AuthKernelContext.Provider>
  );
};

export const useAuthKernel = (): AuthKernelContextValue => {
  const context = useContext(AuthKernelContext);
  if (!context) {
    throw new Error("useAuthKernel must be used within AuthKernelProvider");
  }
  return context;
};

export const useAuthKernelOptional = (): AuthKernelContextValue | null => (
  useContext(AuthKernelContext)
);

export const useAuthKernelPorts = (): AuthKernelPorts => {
  const context = useAuthKernelOptional();
  return context?.ports ?? createAuthKernelPorts();
};
