import { describe, expect, it } from "vitest";
import { filterSettingsSearchEntries } from "./settings-search-index";

describe("filterSettingsSearchEntries", () => {
    it("returns empty for blank query", () => {
        expect(filterSettingsSearchEntries("")).toEqual([]);
        expect(filterSettingsSearchEntries("   ")).toEqual([]);
    });

    it("finds membership sync by coordination alias", () => {
        const results = filterSettingsSearchEntries("coordination sync");
        expect(results.some((entry) => entry.id === "membership-sync")).toBe(true);
    });

    it("requires all tokens to match", () => {
        const results = filterSettingsSearchEntries("relay advanced");
        expect(results.some((entry) => entry.id === "relay-advanced")).toBe(true);
        expect(results.some((entry) => entry.id === "tab-relays")).toBe(false);
    });

    it("finds network performance metrics on Relays without Advanced", () => {
        const results = filterSettingsSearchEntries("latency rtt");
        expect(results.some((entry) => entry.id === "relay-performance")).toBe(true);
        const performance = results.find((entry) => entry.id === "relay-performance");
        expect(performance?.elementId).toBe("relay-performance-metrics");
    });

    it("finds Tor settings without false positives from substring matches", () => {
        const results = filterSettingsSearchEntries("tor");
        expect(results.some((entry) => entry.id === "security-tor")).toBe(true);
        expect(results[0]?.id).toBe("security-tor");
        expect(results.some((entry) => entry.id === "operator-trust-setup")).toBe(false);
        expect(results.some((entry) => entry.id === "membership-sync")).toBe(false);
        expect(results.some((entry) => entry.id === "relay-performance")).toBe(false);
    });

    it("finds conduit transport for tor ready keyword phrase", () => {
        const results = filterSettingsSearchEntries("tor ready");
        expect(results.some((entry) => entry.id === "relay-conduit-mesh")).toBe(true);
        expect(results.some((entry) => entry.id === "security-tor")).toBe(false);
    });

    it("navigates relay advanced to expandable panel id", () => {
        const results = filterSettingsSearchEntries("relay advanced");
        const advanced = results.find((entry) => entry.id === "relay-advanced");
        expect(advanced?.elementId).toBe("relay-advanced-settings");
    });
});
