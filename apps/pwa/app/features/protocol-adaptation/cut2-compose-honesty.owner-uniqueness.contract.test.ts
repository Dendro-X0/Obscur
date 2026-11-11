import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string): string => (
  readFileSync(resolve(process.cwd(), relativePath), "utf8")
);

describe("Cut 2.2 K-COMPOSE-RELAY / K-SEND-FALLBACK owner-uniqueness", () => {
  it("composer shows private-trust transport chrome instead of relays when private_dc", () => {
    const composer = read("app/features/messaging/components/composer.tsx");
    expect(composer).toContain("isPrivateTrustComposeFace");
    expect(composer).toContain("composer-private-trust-transport");
    expect(composer).toContain("privateTrustComposeTransportCopy");
  });

  it("capability chips label private_dc distinctly from Nostr", () => {
    const chips = read("app/features/protocol-adaptation/components/protocol-capability-chips.tsx");
    expect(chips).toContain('protocolId === "private_dc"');
    expect(chips).toContain("protocolDisplayName");
  });

  it("sendDmWithRetry refuses silent Nostr when private-trust face is active", () => {
    const retry = read("app/features/messaging/controllers/v2/dm-send-with-retry.ts");
    expect(retry).toContain("PRIVATE_DC_SILENT_NOSTR_FALLBACK_REFUSED");
    expect(retry).toContain("isPrivateTrustComposeFace");
    expect(retry).toMatch(
      /isPrivateTrustComposeFace\(ProtocolAdaptationLayer\.getActiveProtocolId\(\)\)[\s\S]*PRIVATE_DC_SILENT_NOSTR_FALLBACK_REFUSED/,
    );
  });

  it("layer private_dc T3 failure does not fall through to nostrAdapter", () => {
    const layer = read("app/features/protocol-adaptation/layer.ts");
    expect(layer).toContain("never fall through to nostrAdapter.sendDm");
    expect(layer).toMatch(
      /activeProtocol === "private_dc" && privateDcRequiresT3Wire\(\)[\s\S]*catch \(error\)[\s\S]*return \{[\s\S]*success: false/,
    );
  });
});
