#!/usr/bin/env node
/**
 * One-shot: add presetPath + videoCall UI keys missing from all five locales.
 * Run: node scripts/i18n/patch-presetpath-videocall-keys.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, "../../app/lib/i18n/locales");

/** @type {Record<string, Record<string, string>>} */
const supplemental = {
  en: {
    "settings.relays.presetPath.everyday": "Everyday clearnet",
    "settings.relays.presetPath.everydayDesc":
      "Public Nostr relays for day-to-day messaging — the product default path.",
    "settings.relays.presetPath.hybrid": "Public + private",
    "settings.relays.presetPath.hybridDesc":
      "Mix public Nostr relays with a private mesh gateway on one profile.",
    "settings.relays.presetPath.local": "Local only",
    "settings.relays.presetPath.localDesc":
      "Private local relay — no public Nostr dependency (relay service must be running).",
    "settings.relays.presetPath.tor": "Tor onion",
    "settings.relays.presetPath.torDesc":
      "Onion mesh gateway — enable Tor in Security before publishing.",
    "messaging.videoCall": "Video call",
    "messaging.videoCallUnavailable": "Video unavailable",
    "messaging.mediaConsent.videoCall":
      "Obscur needs camera and microphone access for this video call. Conferencing with more than two people is not supported.",
    "messaging.videoCallInvite": "Video Call Invite",
    "messaging.videoCallInviteSending": "Sending video call invitation…",
    "messaging.videoCallInviteSendFailed": "Failed to send video call invitation.",
    "messaging.videoCallInviteSent": "Video call invitation sent.",
    "messaging.videoCallInviteSentCard": "Video call invitation sent.",
    "messaging.videoCallInviteSentPartial": "Video call invite sent with partial relay coverage.",
    "messaging.videoCallInviteQueued":
      "Video call invite queued due to relay instability. Please retry when relays reconnect.",
    "messaging.videoCallInviteReceived": "Incoming video invitation",
    "messaging.videoCallInviteNoOpenRelay":
      "No open relays — enable a relay in Settings → Relays, then retry the video call.",
    "messaging.videoCallInvitePeerOffline":
      "This contact looks offline — they may not see the invite until they reconnect.",
    "messaging.videoCallMediaPermissionDenied":
      "Camera or microphone permission is required for a video call.",
    "messaging.videoCallMediaUnavailable":
      "Camera and microphone are unavailable on this device.",
    "messaging.videoCallPanePlaceholder": "Camera unavailable",
    "messaging.videoCallPaneLocal": "You",
    "messaging.videoCallPaneRemote": "Peer",
    "messaging.videoCallEnterFullscreen": "Full screen",
    "messaging.videoCallExitFullscreen": "Exit full screen",
    "messaging.videoCallCameraUnavailableBanner": "Camera unavailable — continuing with voice",
    "messaging.videoCallLabCanvasBanner":
      "Lab canvas stand-in — not a camera. Not a product demo.",
  },
  zh: {
    "settings.relays.presetPath.everyday": "日常公网",
    "settings.relays.presetPath.everydayDesc": "面向日常消息的公共 Nostr 中继 — 产品默认路径。",
    "settings.relays.presetPath.hybrid": "公网 + 私有",
    "settings.relays.presetPath.hybridDesc": "在同一配置中混合公共 Nostr 中继与私有网格网关。",
    "settings.relays.presetPath.local": "仅本地",
    "settings.relays.presetPath.localDesc": "私有本地中继 — 不依赖公共 Nostr（需中继服务正在运行）。",
    "settings.relays.presetPath.tor": "Tor 洋葱",
    "settings.relays.presetPath.torDesc": "洋葱网格网关 — 发布前请在「安全」中启用 Tor。",
    "messaging.videoCall": "视频通话",
    "messaging.videoCallUnavailable": "视频不可用",
    "messaging.mediaConsent.videoCall":
      "此视频通话需要摄像头和麦克风权限。不支持两人以上的会议。",
    "messaging.videoCallInvite": "视频通话邀请",
    "messaging.videoCallInviteSending": "正在发送视频通话邀请…",
    "messaging.videoCallInviteSendFailed": "发送视频通话邀请失败。",
    "messaging.videoCallInviteSent": "视频通话邀请已发送。",
    "messaging.videoCallInviteSentCard": "视频通话邀请已发送。",
    "messaging.videoCallInviteSentPartial": "视频通话邀请已发送，但中继覆盖不完整。",
    "messaging.videoCallInviteQueued": "由于中继不稳定，视频通话邀请已加入队列。请在中继重新连接后重试。",
    "messaging.videoCallInviteReceived": "收到视频邀请",
    "messaging.videoCallInviteNoOpenRelay":
      "当前没有已打开的中继 — 请在「设置 → 中继」启用至少一个中继后再发起视频通话。",
    "messaging.videoCallInvitePeerOffline": "此联系人似乎离线 — 对方重新连接前可能看不到邀请。",
    "messaging.videoCallMediaPermissionDenied": "视频通话需要摄像头或麦克风权限。",
    "messaging.videoCallMediaUnavailable": "此设备上无法使用摄像头和麦克风。",
    "messaging.videoCallPanePlaceholder": "摄像头不可用",
    "messaging.videoCallPaneLocal": "你",
    "messaging.videoCallPaneRemote": "对方",
    "messaging.videoCallEnterFullscreen": "全屏",
    "messaging.videoCallExitFullscreen": "退出全屏",
    "messaging.videoCallCameraUnavailableBanner": "摄像头不可用 — 继续使用语音",
    "messaging.videoCallLabCanvasBanner": "实验室画布占位 — 不是摄像头。不是产品演示。",
  },
  es: {
    "settings.relays.presetPath.everyday": "Clearnet diario",
    "settings.relays.presetPath.everydayDesc":
      "Relés Nostr públicos para mensajería diaria — la ruta predeterminada del producto.",
    "settings.relays.presetPath.hybrid": "Público + privado",
    "settings.relays.presetPath.hybridDesc":
      "Combina relés Nostr públicos con una puerta de enlace mesh privada en un perfil.",
    "settings.relays.presetPath.local": "Solo local",
    "settings.relays.presetPath.localDesc":
      "Relé local privado — sin dependencia de Nostr público (el servicio de relé debe estar en ejecución).",
    "settings.relays.presetPath.tor": "Tor onion",
    "settings.relays.presetPath.torDesc":
      "Puerta de enlace mesh onion — activa Tor en Seguridad antes de publicar.",
    "messaging.videoCall": "Videollamada",
    "messaging.videoCallUnavailable": "Vídeo no disponible",
    "messaging.mediaConsent.videoCall":
      "Obscur necesita acceso a la cámara y al micrófono para esta videollamada. No se admiten conferencias con más de dos personas.",
    "messaging.videoCallInvite": "Invitación a videollamada",
    "messaging.videoCallInviteSending": "Enviando invitación a videollamada…",
    "messaging.videoCallInviteSendFailed": "No se pudo enviar la invitación a videollamada.",
    "messaging.videoCallInviteSent": "Invitación a videollamada enviada.",
    "messaging.videoCallInviteSentCard": "Invitación a videollamada enviada.",
    "messaging.videoCallInviteSentPartial":
      "Invitación a videollamada enviada con cobertura parcial de relés.",
    "messaging.videoCallInviteQueued":
      "Invitación a videollamada en cola por inestabilidad del relé. Reintenta cuando se reconecten.",
    "messaging.videoCallInviteReceived": "Invitación de vídeo entrante",
    "messaging.videoCallInviteNoOpenRelay":
      "No hay relés abiertos — activa un relé en Ajustes → Relés y reintenta la videollamada.",
    "messaging.videoCallInvitePeerOffline":
      "Este contacto parece estar desconectado — puede que no vea la invitación hasta que se reconecte.",
    "messaging.videoCallMediaPermissionDenied":
      "Se necesita permiso de cámara o micrófono para una videollamada.",
    "messaging.videoCallMediaUnavailable":
      "La cámara y el micrófono no están disponibles en este dispositivo.",
    "messaging.videoCallPanePlaceholder": "Cámara no disponible",
    "messaging.videoCallPaneLocal": "Tú",
    "messaging.videoCallPaneRemote": "Interlocutor",
    "messaging.videoCallEnterFullscreen": "Pantalla completa",
    "messaging.videoCallExitFullscreen": "Salir de pantalla completa",
    "messaging.videoCallCameraUnavailableBanner": "Cámara no disponible — continuando con voz",
    "messaging.videoCallLabCanvasBanner":
      "Lienzo de laboratorio — no es una cámara. No es una demo de producto.",
  },
  fr: {
    "settings.relays.presetPath.everyday": "Clearnet quotidien",
    "settings.relays.presetPath.everydayDesc":
      "Relais Nostr publics pour la messagerie quotidienne — le chemin par défaut du produit.",
    "settings.relays.presetPath.hybrid": "Public + privé",
    "settings.relays.presetPath.hybridDesc":
      "Mélangez des relais Nostr publics avec une passerelle mesh privée sur un profil.",
    "settings.relays.presetPath.local": "Local uniquement",
    "settings.relays.presetPath.localDesc":
      "Relais local privé — sans dépendance Nostr publique (le service relais doit tourner).",
    "settings.relays.presetPath.tor": "Tor onion",
    "settings.relays.presetPath.torDesc":
      "Passerelle mesh onion — activez Tor dans Sécurité avant de publier.",
    "messaging.videoCall": "Appel vidéo",
    "messaging.videoCallUnavailable": "Vidéo indisponible",
    "messaging.mediaConsent.videoCall":
      "Obscur a besoin de l'accès à la caméra et au micro pour cet appel vidéo. Les conférences à plus de deux personnes ne sont pas prises en charge.",
    "messaging.videoCallInvite": "Invitation d'appel vidéo",
    "messaging.videoCallInviteSending": "Envoi de l'invitation d'appel vidéo…",
    "messaging.videoCallInviteSendFailed": "Échec de l'envoi de l'invitation d'appel vidéo.",
    "messaging.videoCallInviteSent": "Invitation d'appel vidéo envoyée.",
    "messaging.videoCallInviteSentCard": "Invitation d'appel vidéo envoyée.",
    "messaging.videoCallInviteSentPartial":
      "Invitation d'appel vidéo envoyée avec une couverture de relais partielle.",
    "messaging.videoCallInviteQueued":
      "Invitation d'appel vidéo mise en file à cause de l'instabilité du relais. Réessayez après reconnexion.",
    "messaging.videoCallInviteReceived": "Invitation vidéo entrante",
    "messaging.videoCallInviteNoOpenRelay":
      "Aucun relais ouvert — activez un relais dans Paramètres → Relais, puis réessayez l'appel vidéo.",
    "messaging.videoCallInvitePeerOffline":
      "Ce contact semble hors ligne — il peut ne pas voir l'invitation avant de se reconnecter.",
    "messaging.videoCallMediaPermissionDenied":
      "L'autorisation caméra ou micro est requise pour un appel vidéo.",
    "messaging.videoCallMediaUnavailable":
      "La caméra et le micro sont indisponibles sur cet appareil.",
    "messaging.videoCallPanePlaceholder": "Caméra indisponible",
    "messaging.videoCallPaneLocal": "Vous",
    "messaging.videoCallPaneRemote": "Correspondant",
    "messaging.videoCallEnterFullscreen": "Plein écran",
    "messaging.videoCallExitFullscreen": "Quitter le plein écran",
    "messaging.videoCallCameraUnavailableBanner": "Caméra indisponible — poursuite en audio",
    "messaging.videoCallLabCanvasBanner":
      "Toile labo de substitution — pas une caméra. Pas une démo produit.",
  },
  de: {
    "settings.relays.presetPath.everyday": "Alltag Clearnet",
    "settings.relays.presetPath.everydayDesc":
      "Öffentliche Nostr-Relays für den Alltag — der Produkt-Standardpfad.",
    "settings.relays.presetPath.hybrid": "Öffentlich + privat",
    "settings.relays.presetPath.hybridDesc":
      "Öffentliche Nostr-Relays mit einem privaten Mesh-Gateway in einem Profil mischen.",
    "settings.relays.presetPath.local": "Nur lokal",
    "settings.relays.presetPath.localDesc":
      "Privates lokales Relay — ohne öffentliche Nostr-Abhängigkeit (Relay-Dienst muss laufen).",
    "settings.relays.presetPath.tor": "Tor Onion",
    "settings.relays.presetPath.torDesc":
      "Onion-Mesh-Gateway — Tor unter Sicherheit aktivieren, bevor Sie senden.",
    "messaging.videoCall": "Videoanruf",
    "messaging.videoCallUnavailable": "Video nicht verfügbar",
    "messaging.mediaConsent.videoCall":
      "Obscur benötigt Kamera- und Mikrofonzugriff für diesen Videoanruf. Konferenzen mit mehr als zwei Personen werden nicht unterstützt.",
    "messaging.videoCallInvite": "Videoanruf-Einladung",
    "messaging.videoCallInviteSending": "Videoanruf-Einladung wird gesendet…",
    "messaging.videoCallInviteSendFailed": "Videoanruf-Einladung konnte nicht gesendet werden.",
    "messaging.videoCallInviteSent": "Videoanruf-Einladung gesendet.",
    "messaging.videoCallInviteSentCard": "Videoanruf-Einladung gesendet.",
    "messaging.videoCallInviteSentPartial":
      "Videoanruf-Einladung mit teilweiser Relay-Abdeckung gesendet.",
    "messaging.videoCallInviteQueued":
      "Videoanruf-Einladung wegen Relay-Instabilität in der Warteschlange. Bitte nach erneuter Verbindung erneut versuchen.",
    "messaging.videoCallInviteReceived": "Eingehende Videoeinladung",
    "messaging.videoCallInviteNoOpenRelay":
      "Keine offenen Relays — aktivieren Sie ein Relay unter Einstellungen → Relays und versuchen Sie den Videoanruf erneut.",
    "messaging.videoCallInvitePeerOffline":
      "Dieser Kontakt scheint offline — die Einladung wird möglicherweise erst nach der erneuten Verbindung gesehen.",
    "messaging.videoCallMediaPermissionDenied":
      "Für einen Videoanruf ist Kamera- oder Mikrofonberechtigung erforderlich.",
    "messaging.videoCallMediaUnavailable":
      "Kamera und Mikrofon sind auf diesem Gerät nicht verfügbar.",
    "messaging.videoCallPanePlaceholder": "Kamera nicht verfügbar",
    "messaging.videoCallPaneLocal": "Sie",
    "messaging.videoCallPaneRemote": "Gegenstelle",
    "messaging.videoCallEnterFullscreen": "Vollbild",
    "messaging.videoCallExitFullscreen": "Vollbild beenden",
    "messaging.videoCallCameraUnavailableBanner": "Kamera nicht verfügbar — Weiter mit Sprache",
    "messaging.videoCallLabCanvasBanner":
      "Lab-Canvas-Platzhalter — keine Kamera. Keine Produktdemo.",
  },
};

const requiredKeys = Object.keys(supplemental.en);

function mergeLocale(locale) {
  const filePath = join(localesDir, `${locale}.json`);
  const data = JSON.parse(readFileSync(filePath, "utf8"));
  const keys = supplemental[locale] ?? supplemental.en;
  let added = 0;
  for (const [key, value] of Object.entries(keys)) {
    if (!(key in data.translation)) {
      added += 1;
    }
    data.translation[key] = value;
  }
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return { locale, added, total: Object.keys(data.translation).length };
}

for (const locale of ["en", "zh", "es", "fr", "de"]) {
  const result = mergeLocale(locale);
  console.log(`${result.locale}: ${result.total} keys (${result.added} new)`);
}

for (const locale of ["en", "zh", "es", "fr", "de"]) {
  const data = JSON.parse(readFileSync(join(localesDir, `${locale}.json`), "utf8"));
  const missing = requiredKeys.filter((key) => !data.translation[key]);
  if (missing.length) {
    console.error(`FAIL ${locale}: still missing`, missing);
    process.exitCode = 1;
  } else {
    console.log(`OK ${locale}: ${requiredKeys.length} required keys present`);
  }
}
