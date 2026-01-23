"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import zh from "./locales/zh.json";
import es from "./locales/es.json";

// Resources object
export const resources = {
    en: { translation: en },
    zh: { translation: zh },
    es: { translation: es }
} as const;

// Initialize i18next
i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: "en",
        debug: process.env.NODE_ENV === "development",

        interpolation: {
            escapeValue: false, // React already safe from XSS
        },

        detection: {
            order: ['queryString', 'cookie', 'localStorage', 'navigator', 'htmlTag'],
            caches: ['localStorage', 'cookie'],
        }
    });

export default i18n;
