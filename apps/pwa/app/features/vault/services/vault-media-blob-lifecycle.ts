const vaultMediaBlobUrls = new Map<string, string>();

const isBlobUrl = (value: string): boolean => value.trim().startsWith("blob:");

export const registerVaultMediaBlobUrl = (remoteUrl: string, blobUrl: string): string => {
  const normalizedRemoteUrl = remoteUrl.trim();
  if (!normalizedRemoteUrl || !isBlobUrl(blobUrl)) {
    return blobUrl;
  }
  revokeVaultMediaBlobUrl(normalizedRemoteUrl);
  vaultMediaBlobUrls.set(normalizedRemoteUrl, blobUrl);
  return blobUrl;
};

export const revokeVaultMediaBlobUrl = (remoteUrl: string): void => {
  const normalizedRemoteUrl = remoteUrl.trim();
  if (!normalizedRemoteUrl) {
    return;
  }
  const existing = vaultMediaBlobUrls.get(normalizedRemoteUrl);
  if (!existing) {
    return;
  }
  URL.revokeObjectURL(existing);
  vaultMediaBlobUrls.delete(normalizedRemoteUrl);
};

export const revokeAllVaultMediaBlobUrls = (): void => {
  vaultMediaBlobUrls.forEach((blobUrl) => {
    URL.revokeObjectURL(blobUrl);
  });
  vaultMediaBlobUrls.clear();
};

export const getTrackedVaultMediaBlobUrlCount = (): number => vaultMediaBlobUrls.size;
