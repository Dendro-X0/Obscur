"use client";

import type React from "react";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { useIsDesktop } from "@/app/features/desktop/hooks/use-tauri";

type SidebarPortalVariant = "desktop" | "mobileDrawer";

type HostsSnapshot = Readonly<Partial<Record<SidebarPortalVariant, HTMLElement | null>>>;

const EMPTY_HOSTS_SNAPSHOT: HostsSnapshot = {};

const getEmptyHostsSnapshot = (): HostsSnapshot => EMPTY_HOSTS_SNAPSHOT;

const noopSubscribe = (): (() => void) => (): void => {};

type HostsStore = Readonly<{
  getSnapshot: () => HostsSnapshot;
  setHost: (variant: SidebarPortalVariant, element: HTMLElement | null) => void;
  subscribe: (listener: () => void) => () => void;
}>;

function createHostsStore(): HostsStore {
  let hosts: HostsSnapshot = {};
  const listeners = new Set<() => void>();

  return {
    getSnapshot: (): HostsSnapshot => hosts,
    setHost: (variant: SidebarPortalVariant, element: HTMLElement | null): void => {
      if (hosts[variant] === element) {
        return;
      }
      hosts = { ...hosts, [variant]: element };
      listeners.forEach((listener) => {
        listener();
      });
    },
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return (): void => {
        listeners.delete(listener);
      };
    },
  };
}

type SidebarPortalContextValue = Readonly<{
  store: HostsStore;
}>;

const SidebarPortalContext = createContext<SidebarPortalContextValue | null>(null);

export function SidebarPortalProvider(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  const storeRef = useRef<HostsStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = createHostsStore();
  }

  const value = useMemo(
    (): SidebarPortalContextValue => ({ store: storeRef.current as HostsStore }),
    [],
  );

  return (
    <SidebarPortalContext.Provider value={value}>
      {props.children}
    </SidebarPortalContext.Provider>
  );
}

/** Mount point inside AppShell — chat sidebar portals here without React state in the provider. */
export function SidebarPortalHost(props: Readonly<{ variant: SidebarPortalVariant; className?: string }>): React.JSX.Element {
  const context = useContext(SidebarPortalContext);
  const divRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!context) {
      return;
    }
    context.store.setHost(props.variant, divRef.current);
    return (): void => {
      context.store.setHost(props.variant, null);
    };
  }, [context, props.variant]);

  return <div ref={divRef} className={props.className} />;
}

/**
 * Renders the chat sidebar into AppShell. Subscribes via useSyncExternalStore so host
 * registration does not re-render the whole provider tree (avoids ref/setState loops).
 */
export function ChatSidebarPortal(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element | null {
  const context = useContext(SidebarPortalContext);
  const isDesktop = useIsDesktop();
  const store = context?.store;

  const hosts = useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    store?.getSnapshot ?? getEmptyHostsSnapshot,
    getEmptyHostsSnapshot,
  );

  if (!context) {
    return null;
  }

  const target = isDesktop
    ? (hosts.desktop ?? null)
    : (hosts.mobileDrawer ?? null);

  if (!target) {
    return null;
  }

  return createPortal(props.children, target);
}
