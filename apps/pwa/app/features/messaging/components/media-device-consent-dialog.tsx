"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, Loader2, Mic, X } from "lucide-react";
import { Button } from "@dweb/ui-kit/button";
import {
  displayLabelForMediaDevice,
  listMediaInputDevices,
  requestMediaStream,
  type MediaAccessReasonCode,
  type MediaConsentKind,
  type MediaConsentPurpose,
  type MediaInputDeviceInfo,
} from "../services/media-device-access";

const COPY = {
  micTitle: "Enable microphone",
  camTitle: "Enable camera",
  voiceNote: "Obscur needs microphone access to record a voice note. Detected devices are listed below.",
  voiceCall: "Obscur needs microphone access for this voice call. Video conferencing is not supported.",
  qrScan: "Obscur needs camera access to scan invite QR codes. Video conferencing is not supported.",
  devices: "Detected devices",
  devicesEmpty: "No devices detected yet. Allow access so Obscur can list the hardware connected to this computer.",
  allow: "Allow",
  notNow: "Not now",
  selectDevice: "Input device",
  denied: "Permission was denied. Enable the microphone in your system or browser settings for Obscur, then try again.",
  notFound: "No microphone was detected. Plug one in and try again.",
  unavailable: "Microphone is unavailable. Another app may be using it.",
  failed: "Could not access the device. Try again.",
  unsupported: "This runtime cannot access media devices.",
} as const;

export type MediaDeviceConsentDialogProps = Readonly<{
  isOpen: boolean;
  kind: MediaConsentKind;
  purpose: MediaConsentPurpose;
  onClose: () => void;
  onGranted: (stream: MediaStream) => void | Promise<void>;
}>;

const purposeDescription = (purpose: MediaConsentPurpose): string => {
  if (purpose === "voice_call") return COPY.voiceCall;
  if (purpose === "qr_scan") return COPY.qrScan;
  return COPY.voiceNote;
};

const errorCopy = (reason: MediaAccessReasonCode): string => {
  if (reason === "permission_denied") return COPY.denied;
  if (reason === "not_found") return COPY.notFound;
  if (reason === "unavailable") return COPY.unavailable;
  if (reason === "unsupported") return COPY.unsupported;
  return COPY.failed;
};

export function MediaDeviceConsentDialog({
  isOpen,
  kind,
  purpose,
  onClose,
  onGranted,
}: MediaDeviceConsentDialogProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<ReadonlyArray<MediaInputDeviceInfo>>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    let cancelled = false;
    setError(null);
    setIsLoadingDevices(true);
    void (async () => {
      const next = await listMediaInputDevices(kind);
      if (cancelled) return;
      setDevices(next);
      setSelectedDeviceId(next[0]?.deviceId ?? "");
      setIsLoadingDevices(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, kind]);

  if (!isOpen) {
    return null;
  }

  const title = kind === "microphone"
    ? t("messaging.mediaConsent.micTitle", COPY.micTitle)
    : t("messaging.mediaConsent.camTitle", COPY.camTitle);
  const descriptionKey = purpose === "voice_call"
    ? "messaging.mediaConsent.voiceCall"
    : purpose === "qr_scan"
      ? "messaging.mediaConsent.qrScan"
      : "messaging.mediaConsent.voiceNote";
  const description = t(descriptionKey, purposeDescription(purpose));
  const Icon = kind === "microphone" ? Mic : Camera;

  const allow = async (): Promise<void> => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await requestMediaStream({
        kind,
        deviceId: selectedDeviceId || null,
      });
      if (!result.ok) {
        setError(t(`messaging.mediaConsent.error.${result.reasonCode}`, errorCopy(result.reasonCode)));
        const refreshed = await listMediaInputDevices(kind);
        setDevices(refreshed);
        return;
      }
      const refreshed = await listMediaInputDevices(kind);
      setDevices(refreshed);
      await onGranted(result.stream);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[170] flex items-center justify-center bg-transparent p-4"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
      data-testid="media-device-consent-dialog"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-device-consent-title"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-300">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                {t("messaging.mediaConsent.eyebrow", "Device access")}
              </p>
              <h2 id="media-device-consent-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label={t("common.close", "Close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-300">{description}</p>

        <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-950/60">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
            {t("messaging.mediaConsent.devices", COPY.devices)}
          </p>
          {isLoadingDevices ? (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("common.loading", "Loading…")}
            </div>
          ) : devices.length === 0 ? (
            <p className="text-sm text-zinc-500">
              {t("messaging.mediaConsent.devicesEmpty", COPY.devicesEmpty)}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {devices.map((device, index) => (
                <li
                  key={device.deviceId}
                  className="truncate text-sm text-zinc-800 dark:text-zinc-200"
                >
                  {displayLabelForMediaDevice(device, index, kind)}
                </li>
              ))}
            </ul>
          )}
          {devices.length > 1 ? (
            <label className="mt-3 block space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                {t("messaging.mediaConsent.selectDevice", COPY.selectDevice)}
              </span>
              <select
                className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                value={selectedDeviceId}
                onChange={(event) => setSelectedDeviceId(event.target.value)}
                disabled={isSubmitting}
              >
                {devices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {displayLabelForMediaDevice(device, index, kind)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {error ? (
          <p className="mb-3 text-sm text-rose-600 dark:text-rose-400" role="alert">{error}</p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            {t("messaging.mediaConsent.notNow", COPY.notNow)}
          </Button>
          <Button type="button" onClick={() => { void allow(); }} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("messaging.mediaConsent.allow", COPY.allow)}
          </Button>
        </div>
      </div>
    </div>
  );
}
