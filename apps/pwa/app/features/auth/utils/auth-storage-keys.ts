import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";

const REMEMBER_ME_BASE_KEY = "obscur_remember_me";
const AUTH_TOKEN_BASE_KEY = "obscur_auth_token";

export const getRememberMeStorageKey = (): string => getScopedStorageKey(REMEMBER_ME_BASE_KEY);

export const getAuthTokenStorageKey = (): string => getScopedStorageKey(AUTH_TOKEN_BASE_KEY);

