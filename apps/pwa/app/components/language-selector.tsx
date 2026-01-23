"use client";

import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { Button } from "./ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const LANGUAGES = [
    { code: "en", label: "English" },
    { code: "zh", label: "中文 (Chinese)" },
    { code: "es", label: "Español (Spanish)" },
];

export function LanguageSelector({ variant = "default" }: { variant?: "default" | "minimal" }) {
    const { i18n } = useTranslation();

    const handleLanguageChange = (langCode: string) => {
        i18n.changeLanguage(langCode);
        // Optional: Persist to localStorage if i18next-browser-languagedetector doesn't fully handle what we want,
        // but the detector usually handles 'localStorage' caching if configured. I configured it to cache in localStorage.
    };

    const currentLang = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];

    if (variant === "minimal") {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-9 w-9 rounded-full p-0 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                        <Globe className="h-5 w-5" />
                        <span className="sr-only">Change Language</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {LANGUAGES.map((lang) => (
                        <DropdownMenuItem
                            key={lang.code}
                            onClick={() => handleLanguageChange(lang.code)}
                            className={i18n.language === lang.code ? "bg-zinc-100 font-medium dark:bg-zinc-800" : ""}
                        >
                            {lang.label}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2">
                        <Globe className="h-6 w-6" />
                        <span>{currentLang?.label}</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {LANGUAGES.map((lang) => (
                        <DropdownMenuItem
                            key={lang.code}
                            onClick={() => handleLanguageChange(lang.code)}
                            className={i18n.language === lang.code ? "bg-zinc-100 font-medium dark:bg-zinc-800" : ""}
                        >
                            {lang.label}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
