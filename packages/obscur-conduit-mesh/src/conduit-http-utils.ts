/** Injectable fetch for headless drivers and host ports. */
export type ConduitMeshFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export const normalizeConduitBaseUrl = (endpoint: string): string => (
  endpoint.replace(/\/$/, "")
);

export const encodeCiphertextBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
};

export const decodeCiphertextBase64 = (encoded: string): Uint8Array => {
  const binary = atob(encoded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
};
