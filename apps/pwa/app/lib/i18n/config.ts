import i18next, { type i18n } from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
// trigger HMR for new translations — vault.writeUnlock* 2026-08-04

import en from "./locales/en.json";
import zh from "./locales/zh.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import de from "./locales/de.json";

const RESOURCES = {
  en,
  zh,
  es,
  fr,
  de,
} as const;

type TranslationResources = typeof en;

const mergeLatestTranslationBundles = (instance: i18n): void => {
  (Object.entries(RESOURCES) as Array<[keyof typeof RESOURCES, TranslationResources]>).forEach(
    ([lng, bundle]) => {
      instance.addResourceBundle(lng, "translation", bundle.translation, true, true);
    },
  );
};

const createInstance = (): i18n => {
  const instance: i18n = i18next.createInstance();
  void instance
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: RESOURCES,
      supportedLngs: ["en", "zh", "es", "fr", "de"],
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

const resolveI18nInstance = (): i18n => {
  if (i18next.isInitialized) {
    mergeLatestTranslationBundles(i18next);
    return i18next;
  }
  return createInstance();
};

export const i18nInstance: i18n = resolveI18nInstance();
