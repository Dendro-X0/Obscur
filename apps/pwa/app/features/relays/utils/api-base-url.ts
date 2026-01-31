export const getApiBaseUrl = (): string => {
  const explicitBaseUrl: string | undefined = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (explicitBaseUrl?.trim()) {
    return explicitBaseUrl;
  }

  if (typeof window !== "undefined") {
    return window.location.origin + "/api";
  }

  return "http://localhost:3000/api";
};
