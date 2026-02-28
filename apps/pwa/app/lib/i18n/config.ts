import i18next, { type i18n } from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
// trigger HMR for new translations

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
  void instance
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: RESOURCES,
      fallbackLng: "en",
      interpolation: { escapeValue: false },
      returnNull: false,
      detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage']
      }
    });
  return instance;
};

export const i18nInstance: i18n = i18next.isInitialized ? i18next : createInstance();
