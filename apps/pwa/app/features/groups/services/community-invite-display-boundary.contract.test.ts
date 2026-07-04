import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PWA_ROOT = join(__dirname, "../../../..");
const read = (relativePath: string): string => readFileSync(join(PWA_ROOT, relativePath), "utf8");

describe("IRA-5 community invite display boundary contract", () => {
  it("message-list resolves viewer role only through display boundary", () => {
    const source = read("app/features/messaging/components/message-list.tsx");
    expect(source).toContain("community-invite-display-boundary");
    expect(source).toContain("resolveCommunityInviteDisplayViewerRoleFromMessage");
    expect(source).not.toMatch(/from ["'].*community-invite-role-authority["']/);
  });

  it("sidebar preview resolves invite direction through display boundary", () => {
    const source = read("app/features/messaging/services/format-conversation-message-preview.ts");
    expect(source).toContain("community-invite-display-boundary");
    expect(source).toContain("resolveCommunityInvitePreviewFromSelfForContent");
  });

  it("dm-kernel and legacy thread hooks do not import role authority", () => {
    const dmKernel = read("app/features/dm-kernel/use-dm-kernel-thread.ts");
    const legacy = read("app/features/messaging/hooks/use-conversation-messages-legacy.ts");
    expect(dmKernel).not.toMatch(/community-invite-role-authority/);
    expect(legacy).not.toMatch(/community-invite-role-authority/);
    expect(dmKernel).toContain("augmentCommunityDmInviteThreadMessages");
    expect(legacy).toContain("augmentCommunityDmInviteThreadMessages");
  });
});
