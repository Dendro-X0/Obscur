import { describe, expect, it } from "vitest";
import {
  areSealedCommunityRouteSurfacesExclusive,
  isChatRoutePathname,
  isGroupCommunityHomePathname,
  resolveGroupHomeGroupThreadRelayIngestEnabled,
  resolveGroupHomeSealedCommunityEnabled,
  resolveGroupManagementSealedCommunityEnabled,
  resolveMainShellGroupThreadRelayIngestEnabled,
  resolveMainShellSealedCommunityEnabled,
} from "./sealed-community-instance-policy";

describe("sealed-community-instance-policy", () => {
  it("identifies chat and group-home pathnames", () => {
    expect(isChatRoutePathname("/")).toBe(true);
    expect(isChatRoutePathname("/groups/foo")).toBe(false);
    expect(isGroupCommunityHomePathname("/groups/foo")).toBe(true);
    expect(isGroupCommunityHomePathname("/groups/leave")).toBe(false);
    expect(isGroupCommunityHomePathname("/")).toBe(false);
  });

  it("main shell enables sidebar group chat but not on group-home routes", () => {
    expect(resolveMainShellSealedCommunityEnabled({
      selectedConversationKind: "group",
      pathname: "/",
      hasRelayTransport: true,
    })).toBe(true);
    expect(resolveMainShellSealedCommunityEnabled({
      selectedConversationKind: "group",
      pathname: "/groups/workspace",
      hasRelayTransport: true,
    })).toBe(false);
    expect(resolveMainShellSealedCommunityEnabled({
      selectedConversationKind: "dm",
      pathname: "/",
      hasRelayTransport: true,
    })).toBe(false);
  });

  it("group home owns sealed-community when context and relay are ready", () => {
    expect(resolveGroupHomeSealedCommunityEnabled({
      hasCommunityContext: true,
      hasRelayTransport: true,
    })).toBe(true);
    expect(resolveGroupHomeSealedCommunityEnabled({
      hasCommunityContext: false,
      hasRelayTransport: true,
    })).toBe(false);
  });

  it("group thread relay ingest stays enabled when sealed-community hook would be gated", () => {
    const mainShellParams = {
      selectedConversationKind: "group" as const,
      pathname: "/",
      hasRelayTransport: true,
    };
    expect(resolveMainShellGroupThreadRelayIngestEnabled(mainShellParams)).toBe(true);
    expect(resolveMainShellGroupThreadRelayIngestEnabled({
      ...mainShellParams,
      pathname: "/groups/workspace",
    })).toBe(false);

    expect(resolveGroupHomeGroupThreadRelayIngestEnabled({
      hasCommunityContext: true,
      hasRelayTransport: true,
    })).toBe(true);
    expect(resolveGroupHomeGroupThreadRelayIngestEnabled({
      hasCommunityContext: false,
      hasRelayTransport: true,
    })).toBe(false);
  });

  it("management dialog reuses parent controller when provided", () => {
    expect(resolveGroupManagementSealedCommunityEnabled({
      isOpen: true,
      hasParentController: true,
    })).toBe(false);
    expect(resolveGroupManagementSealedCommunityEnabled({
      isOpen: true,
      hasParentController: false,
    })).toBe(true);
  });

  it("chat route and group-home route are mutually exclusive surfaces", () => {
    expect(areSealedCommunityRouteSurfacesExclusive("/")).toBe(true);
    expect(areSealedCommunityRouteSurfacesExclusive("/groups/alpha")).toBe(true);
    expect(areSealedCommunityRouteSurfacesExclusive("/network")).toBe(true);
  });
});
