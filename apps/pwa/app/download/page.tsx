"use client";

import { useEffect, useState } from "react";
import { PageShell } from "../components/page-shell";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Apple, Download, Monitor, Smartphone, Terminal } from "lucide-react";
import { useTranslation } from "react-i18next";

type Asset = {
  name: string;
  browser_download_url: string;
  size: number;
};

type Release = {
  tag_name: string;
  assets: Asset[];
  body: string;
};

const ESSENTIAL_EXTENSIONS = ['.exe', '.dmg', '.AppImage'];

export default function DownloadPage() {
  const { t } = useTranslation();
  const [release, setRelease] = useState<Release | null>(null);
  const [os] = useState<"win" | "mac" | "linux" | "unknown">(() => {
    if (typeof window === "undefined") return "unknown";
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (userAgent.includes("win")) return "win";
    if (userAgent.includes("mac")) return "mac";
    if (userAgent.includes("linux")) return "linux";
    return "unknown";
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("https://api.github.com/repos/Dendro-X0/Obscur/releases/latest")
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch release");
        return res.json();
      })
      .then(data => {
        setRelease(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const getBestAsset = () => {
    if (!release) return null;
    if (os === "win") return release.assets.find(a => a.name.toLowerCase().endsWith("_x64-setup.exe"));
    if (os === "mac") return release.assets.find(a => a.name.toLowerCase().endsWith(".dmg"));
    if (os === "linux") return release.assets.find(a => a.name.toLowerCase().endsWith(".appimage"));
    return null;
  };

  const getEssentialAssets = () => {
    if (!release) return [];
    return release.assets.filter(a =>
      ESSENTIAL_EXTENSIONS.some(ext => a.name.toLowerCase().endsWith(ext))
    );
  };

  const bestAsset = getBestAsset();
  const essentialAssets = getEssentialAssets();

  return (
    <PageShell title={t("download.title")}>
      <div className="mx-auto w-full max-w-4xl p-4 space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-6 py-12">
          <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
            {t("download.getObscur")}
          </h1>
          <p className="text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto" dangerouslySetInnerHTML={{ __html: t("download.subtitle") }} />

          {/* Auto-update Note */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100/50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 rounded-full text-sm font-medium">
              <CheckCircle className="w-4 h-4" />
              {t("download.autoUpdatesEnabled")}
            </div>
          </div>
        </div>

        {/* Desktop Download */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Monitor className="w-6 h-6 text-zinc-700 dark:text-zinc-300" />
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t("download.desktopApp")}</h2>
          </div>

          <div className="flex flex-col items-center gap-4">
            {loading ? (
              <div className="animate-pulse h-16 w-64 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
            ) : bestAsset ? (
              <Button size="lg" className="h-16 px-10 text-lg gap-3 shadow-xl hover:shadow-2xl transition-all hover:scale-105" asChild>
                <a href={bestAsset.browser_download_url}>
                  {os === "win" && <Monitor className="w-6 h-6" />}
                  {os === "mac" && <Apple className="w-6 h-6" />}
                  {os === "linux" && <Terminal className="w-6 h-6" />}
                  {t("download.for", { os: os === 'win' ? 'Windows' : os === 'mac' ? 'macOS' : 'Linux' })}
                  <span className="ml-2 text-xs opacity-70 font-normal">v{release?.tag_name}</span>
                </a>
              </Button>
            ) : (
              <div className="text-center text-zinc-500">
                {t("download.selectPlatform")}
              </div>
            )}
            <p className="text-sm text-zinc-500">
              {bestAsset
                ? t("download.recommendedForYourDevice", { size: (bestAsset.size / 1024 / 1024).toFixed(1) })
                : t("download.chooseVersion")
              }
            </p>
          </div>

          {/* All Desktop Assets */}
          {essentialAssets.length > 0 && (
            <Card className="p-8 border-none shadow-lg bg-white/50 dark:bg-zinc-900/50 backdrop-blur">
              <h3 className="text-xl font-bold mb-6 text-zinc-900 dark:text-zinc-100">{t("download.allPlatforms")}</h3>
              <div className="grid gap-3">
                {essentialAssets.map(asset => (
                  <div key={asset.name} className="flex justify-between items-center p-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-500">
                        {asset.name.includes(".exe") ? <Monitor className="w-5 h-5" /> :
                          asset.name.includes(".dmg") ? <Apple className="w-5 h-5" /> :
                            <Terminal className="w-5 h-5" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{asset.name}</span>
                        <span className="text-xs text-zinc-500">{(asset.size / 1024 / 1024).toFixed(1)} MB</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a href={asset.browser_download_url}>
                        <Download className="w-4 h-4 mr-2" />
                        {t("common.download")}
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Mobile App - Coming Soon */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Smartphone className="w-6 h-6 text-zinc-700 dark:text-zinc-300" />
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t("download.mobileApp")}</h2>
          </div>

          <Card className="p-8 border-none shadow-lg bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-zinc-900 dark:to-zinc-800">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100/50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-full text-sm font-medium">
                🚧 {t("common.comingSoon")}
              </div>
              <p className="text-zinc-600 dark:text-zinc-400" dangerouslySetInnerHTML={{ __html: t("download.mobileAppDesc") }} />
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

function CheckCircle(props: { className?: string }) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}
