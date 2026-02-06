import i18next, { type i18n } from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import zh from "./locales/zh.json";
import es from "./locales/es.json";

const RESOURCES = {
  en,
  zh,
  es,
} as const;

type TranslationResources = typeof en;
type I18nResources = Readonly<Record<string, TranslationResources>>;

const createInstance = (): i18n => {
  const instance: i18n = i18next.createInstance();
  void instance.use(initReactI18next).init({
    resources: RESOURCES,
    lng: "en",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return instance;
};

export const i18nInstance: i18n = i18next.isInitialized ? i18next : createInstance();
