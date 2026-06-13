import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDevLabZombiePersona,
  devLabPersonaInternals,
  listDevLabPersonas,
  resolveDevLabPersona,
  teardownAllDevLabPersonas,
  teardownDevLabPersona,
} from "./dev-lab-persona";

vi.mock("./dev-lab-policy", () => ({
  isDevLabEnabled: vi.fn(() => true),
}));

describe("dev-lab-persona", () => {
  beforeEach(() => {
    devLabPersonaInternals.setRegistry(devLabPersonaInternals.createRegistry());
  });

  it("creates ephemeral zombie personas with distinct keys", () => {
    const first = createDevLabZombiePersona({ label: "abuse" });
    const second = createDevLabZombiePersona({ label: "abuse" });

    expect(first.id).not.toBe(second.id);
    expect(first.publicKeyHex).not.toBe(second.publicKeyHex);
    expect(first.label).toBe("zombie:abuse");
    expect(listDevLabPersonas()).toHaveLength(2);
  });

  it("teardown removes personas reversibly", () => {
    const persona = createDevLabZombiePersona({ label: "temp" });
    expect(teardownDevLabPersona(persona.id)).toBe(true);
    expect(resolveDevLabPersona(persona.id)).toBeNull();
    expect(listDevLabPersonas()).toHaveLength(0);
  });

  it("teardownAll clears the registry", () => {
    createDevLabZombiePersona({ label: "a" });
    createDevLabZombiePersona({ label: "b" });
    expect(teardownAllDevLabPersonas()).toBe(2);
    expect(listDevLabPersonas()).toHaveLength(0);
  });
});
