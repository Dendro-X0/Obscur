import type { BootstrapConfig } from "@dweb/core/bootstrap-config";
import { getApiBaseUrl } from "@/app/features/relays/utils/api-base-url";
import { parseBootstrapConfig } from "./parse-bootstrap-config";

type FetchBootstrapConfigResult = Readonly<{
  data?: BootstrapConfig;
  error?: string;
}>;

const buildBootstrapUrl = (): string => {
  const baseUrl: string = getApiBaseUrl();
  return `${baseUrl}/v1/bootstrap`;
};

export const fetchBootstrapConfig = async (): Promise<FetchBootstrapConfigResult> => {
  const url: string = buildBootstrapUrl();
  try {
    const response: Response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      return { error: `Request failed: ${response.status} ${response.statusText}` };
    }
    const data: unknown = await response.json();
    const parsed: Readonly<{ data?: BootstrapConfig; error?: string }> = parseBootstrapConfig(data);
    if (parsed.error) {
      return { error: parsed.error };
    }
    return { data: parsed.data };
  } catch (error: unknown) {
    const message: string = error instanceof Error ? error.message : "Unknown error";
    return { error: message };
  }
};
