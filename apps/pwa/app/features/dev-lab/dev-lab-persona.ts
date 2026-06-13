import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import { generatePrivateKeyHex } from "@dweb/crypto/generate-private-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { isDevLabEnabled } from "./dev-lab-policy";

/** Fixed dev-only passphrase for ephemeral zombie imports — never used in production. */
export const DEV_LAB_ZOMBIE_PASSPHRASE = "DevLabZombie!1" as const;

export type DevLabPersonaKind = "zombie";

export type DevLabPersonaRecord = Readonly<{
  id: string;
  kind: DevLabPersonaKind;
  label: string;
  username: string;
  privateKeyHex: PrivateKeyHex;
  publicKeyHex: PublicKeyHex;
  createdAtUnixMs: number;
}>;

export type DevLabPersonaSnapshot = Readonly<{
  id: string;
  kind: DevLabPersonaKind;
  label: string;
  username: string;
  publicKeyHex: PublicKeyHex;
  createdAtUnixMs: number;
}>;

const REGISTRY_KEY = "__obscur_dev_lab_persona_registry__";

type PersonaRegistry = Readonly<{
  personas: ReadonlyMap<string, DevLabPersonaRecord>;
}>;

const createRegistry = (): PersonaRegistry => ({
  personas: new Map<string, DevLabPersonaRecord>(),
});

const getRegistry = (): PersonaRegistry => {
  const root = globalThis as Record<string, unknown>;
  const existing = root[REGISTRY_KEY];
  if (existing && typeof existing === "object" && "personas" in existing) {
    return existing as PersonaRegistry;
  }
  const created = createRegistry();
  root[REGISTRY_KEY] = created;
  return created;
};

const setRegistry = (next: PersonaRegistry): void => {
  const root = globalThis as Record<string, unknown>;
  root[REGISTRY_KEY] = next;
};

const toSnapshot = (record: DevLabPersonaRecord): DevLabPersonaSnapshot => ({
  id: record.id,
  kind: record.kind,
  label: record.label,
  username: record.username,
  publicKeyHex: record.publicKeyHex,
  createdAtUnixMs: record.createdAtUnixMs,
});

const assertDevLabEnabled = (): void => {
  if (!isDevLabEnabled()) {
    throw new Error("Dev Lab personas are disabled outside dev builds.");
  }
};

const buildPersonaId = (index: number): string => `zombie-${index}-${Date.now().toString(36)}`;

const buildUsername = (label: string, index: number): string => {
  const slug = label.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);
  return slug.length > 0 ? `Zombie-${slug}-${index}` : `Zombie-${index}`;
};

export type CreateDevLabZombiePersonaOptions = Readonly<{
  label?: string;
}>;

/**
 * Ephemeral dev-only identity for abuse/edge-case scenarios.
 * Keys live in memory only until teardown — never merged into production paths.
 */
export const createDevLabZombiePersona = (
  options: CreateDevLabZombiePersonaOptions = {},
): DevLabPersonaRecord => {
  assertDevLabEnabled();
  const registry = getRegistry();
  const index = registry.personas.size + 1;
  const label = (options.label ?? "ephemeral").trim() || "ephemeral";
  const privateKeyHex = generatePrivateKeyHex();
  const publicKeyHex = derivePublicKeyHex(privateKeyHex);
  const record: DevLabPersonaRecord = {
    id: buildPersonaId(index),
    kind: "zombie",
    label: `zombie:${label}`,
    username: buildUsername(label, index),
    privateKeyHex,
    publicKeyHex,
    createdAtUnixMs: Date.now(),
  };
  const nextPersonas = new Map(registry.personas);
  nextPersonas.set(record.id, record);
  setRegistry({ personas: nextPersonas });
  return record;
};

export const resolveDevLabPersona = (personaId: string): DevLabPersonaRecord | null => {
  if (!isDevLabEnabled()) {
    return null;
  }
  return getRegistry().personas.get(personaId.trim()) ?? null;
};

export const listDevLabPersonas = (): ReadonlyArray<DevLabPersonaSnapshot> => {
  if (!isDevLabEnabled()) {
    return [];
  }
  return [...getRegistry().personas.values()].map(toSnapshot);
};

export const teardownDevLabPersona = (personaId: string): boolean => {
  if (!isDevLabEnabled()) {
    return false;
  }
  const registry = getRegistry();
  const id = personaId.trim();
  if (!registry.personas.has(id)) {
    return false;
  }
  const nextPersonas = new Map(registry.personas);
  nextPersonas.delete(id);
  setRegistry({ personas: nextPersonas });
  return true;
};

export const teardownAllDevLabPersonas = (): number => {
  if (!isDevLabEnabled()) {
    return 0;
  }
  const count = getRegistry().personas.size;
  setRegistry(createRegistry());
  return count;
};

export const devLabPersonaInternals = {
  REGISTRY_KEY,
  getRegistry,
  setRegistry,
  createRegistry,
};
