import type { BootstrapConfig } from "@dweb/core/bootstrap-config";

type UnknownRecord = Record<string, unknown>;

type ParseBootstrapConfigResult = Readonly<{
  data?: BootstrapConfig;
  error?: string;
}>;

const isRecord = (value: unknown): value is UnknownRecord => {
  return typeof value === "object" && value !== null;
};

const isStringArray = (value: unknown): value is ReadonlyArray<string> => {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === "string");
};

export const parseBootstrapConfig = (value: unknown): ParseBootstrapConfigResult => {
  if (!isRecord(value)) {
    return { error: "Invalid response: not an object" };
  }
  const relays: unknown = value.relays;
  const version: unknown = value.version;
  if (!isStringArray(relays)) {
    return { error: "Invalid response: relays must be an array of strings" };
  }
  if (typeof version !== "string") {
    return { error: "Invalid response: version must be a string" };
  }
  const data: BootstrapConfig = {
    relays,
    version
  };
  return { data };
};
