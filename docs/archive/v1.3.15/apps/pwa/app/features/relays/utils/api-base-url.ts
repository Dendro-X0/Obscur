export const getApiBaseUrl = (): string => {
  const explicitBaseUrl: string | undefined = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (explicitBaseUrl?.trim()) {
    return explicitBaseUrl;
  }

  if (typeof window !== "undefined") {
    return window.location.origin + "/api";
  }

  return "http://127.0.0.1:3340/api";
};
