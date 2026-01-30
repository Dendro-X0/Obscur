export const getApiBaseUrl = (): string => {
  const explicitBaseUrl: string | undefined = process.env.NEXT_PUBLIC_API_BASE_URL;
  return explicitBaseUrl?.trim() ? explicitBaseUrl : "http://localhost:8787";
};
