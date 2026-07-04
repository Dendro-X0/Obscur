#!/usr/bin/env node
/**
 * Merge supplemental translation keys into all locale JSON files.
 * Usage: node scripts/i18n/add-locale-keys.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, "../../app/lib/i18n/locales");

const supplemental = {
  en: {
    "settings.privacy.dmPolicyTitle": "Direct Message Policy",
    "settings.privacy.dmPolicyHint": "Choose who can reach your inbox by default.",
    "settings.privacy.everyone": "Everyone",
    "settings.privacy.contactsOnly": "Contacts Only",
    "settings.privacy.modernDmsTitle": "Enable Modern DMs (Gift Wraps)",
    "settings.privacy.modernDmsDesc":
      "Adds stronger metadata privacy for compatible clients and relays.",
    "settings.privacy.retentionTitle": "Local Message Retention",
    "settings.privacy.retentionHint": "Limits chat history rendered on this device.",
    "settings.privacy.retentionOff": "Off",
    "settings.privacy.retention30Days": "30 Days",
    "settings.privacy.retention30DaysShort": "30d",
    "settings.privacy.retention90Days": "90 Days",
    "settings.privacy.retention90DaysShort": "90d",
    "settings.privacy.showPubkeyTitle": "Show Public Key Controls In Chat",
    "settings.privacy.showPubkeyDesc":
      "Keeps the chat header focused on usernames unless you explicitly enable Share ID controls.",
    "settings.privacy.summaryTitle": "Privacy Summary",
    "settings.privacy.summary":
      "DM policy: {{dmPolicy}} · Modern DMs: {{modernDms}} · Retention: {{retention}} · Public key controls: {{pubkeyControls}}",
    "settings.privacy.summaryModernDmsEnabled": "enabled",
    "settings.privacy.summaryModernDmsDisabled": "disabled",
    "settings.privacy.summaryPubkeyShown": "shown",
    "settings.privacy.summaryPubkeyHidden": "hidden",
    "settings.privacy.dmPolicyEveryone": "everyone",
    "settings.privacy.dmPolicyContactsOnly": "contacts-only",
    "settings.security.postureTitle": "Security Posture",
    "settings.security.postureDesc": "Current protection status and capability checks.",
    "settings.security.overallPosture": "Overall posture",
    "settings.security.posture.strong": "Strong",
    "settings.security.posture.moderate": "Moderate",
    "settings.security.posture.weak": "Weak",
    "settings.security.capabilityClipboard": "Clipboard",
    "settings.security.capabilityBiometric": "Biometric",
    "settings.security.capabilityTor": "Tor",
    "settings.security.capability.supported": "supported",
    "settings.security.capability.unavailable": "unavailable",
    "settings.security.sessionTitle": "Session Management",
    "settings.security.sessionDesc": "Security settings for your current session.",
    "settings.security.lockNow": "Lock Now",
    "settings.security.sessionActionsTitle": "Security Actions",
    "settings.security.sessionActionsSummary":
      "Use Lock Now for immediate protection; clear local data only when needed.",
    "settings.security.resetLocalHistoryTitle": "Reset Local History (Keep Identity)",
    "settings.security.resetLocalHistoryDesc":
      "This clears local chat history, sync checkpoints, and cached media on this device, but keeps your identity/session and remember-me credentials.",
    "settings.security.resetLocalHistoryConfirm": "Reset Local History",
    "settings.security.verificationTitle": "Security & Verification",
    "settings.security.verificationDesc":
      "Manage your identity verification and security preferences",
    "settings.security.yourIdentity": "Your Identity",
    "settings.security.publicKey": "Public Key",
    "settings.security.loading": "Loading...",
    "settings.security.copyPublicKey": "Copy public key",
    "settings.security.identityVerifiedLocal": "Identity verified (local key)",
    "settings.security.fingerprintHelp":
      "This visual fingerprint is uniquely generated from your public key. Share it with contacts to help them verify your identity.",
    "settings.security.contactVerificationPreview": "Contact Verification Preview",
    "settings.security.demoContact": "Demo Contact",
    "settings.security.securityTipTitle": "Security Tip",
    "settings.security.securityTipBody":
      "Always verify your contacts' visual fingerprints before sharing sensitive information. Ask them to confirm their fingerprint matches what you see in their profile.",
    "profile.friendCodeLabel": "Friend Code",
    "profile.friendCodeHelp": "Use this friend code for quick account discovery.",
    "profile.friendCodeSuffixHelp":
      "Prefix is fixed by app identity; edit only the 6-character suffix.",
    "profile.friendCodeSuffixHelpCompact": "6-character suffix after the fixed prefix.",
    "profile.friendCodeRandom": "Random",
    "profile.friendCodeCopy": "Copy",
    "profile.friendCodeCopied": "Copied friend code.",
    "profile.friendCodeCopyFailed": "Unable to copy friend code.",
    "profile.copyIdentityLink": "Copy identity link",
    "profile.identityLinkCopied": "Copied shareable identity link.",
    "messaging.lastActive": "Last active {{time}}",
    "messaging.lastViewed": "Last viewed {{time}}",
    "messaging.noRecentActivity": "No recent activity",
  },
  zh: {
    "settings.privacy.dmPolicyTitle": "私信策略",
    "settings.privacy.dmPolicyHint": "选择默认谁可以向您的收件箱发送消息。",
    "settings.privacy.everyone": "所有人",
    "settings.privacy.contactsOnly": "仅联系人",
    "settings.privacy.modernDmsTitle": "启用现代私信（礼品包装）",
    "settings.privacy.modernDmsDesc": "为兼容的客户端和中继器提供更强的元数据隐私保护。",
    "settings.privacy.retentionTitle": "本地消息保留",
    "settings.privacy.retentionHint": "限制在此设备上显示的聊天记录。",
    "settings.privacy.retentionOff": "关闭",
    "settings.privacy.retention30Days": "30 天",
    "settings.privacy.retention30DaysShort": "30天",
    "settings.privacy.retention90Days": "90 天",
    "settings.privacy.retention90DaysShort": "90天",
    "settings.privacy.showPubkeyTitle": "在聊天中显示公钥控件",
    "settings.privacy.showPubkeyDesc":
      "除非您明确启用分享 ID 控件，否则聊天标题栏将专注于用户名。",
    "settings.privacy.summaryTitle": "隐私摘要",
    "settings.privacy.summary":
      "私信策略：{{dmPolicy}} · 现代私信：{{modernDms}} · 保留：{{retention}} · 公钥控件：{{pubkeyControls}}",
    "settings.privacy.summaryModernDmsEnabled": "已启用",
    "settings.privacy.summaryModernDmsDisabled": "已禁用",
    "settings.privacy.summaryPubkeyShown": "显示",
    "settings.privacy.summaryPubkeyHidden": "隐藏",
    "settings.privacy.dmPolicyEveryone": "所有人",
    "settings.privacy.dmPolicyContactsOnly": "仅联系人",
    "settings.security.postureTitle": "安全态势",
    "settings.security.postureDesc": "当前保护状态和功能检查。",
    "settings.security.overallPosture": "整体态势",
    "settings.security.posture.strong": "强",
    "settings.security.posture.moderate": "中等",
    "settings.security.posture.weak": "弱",
    "settings.security.capabilityClipboard": "剪贴板",
    "settings.security.capabilityBiometric": "生物识别",
    "settings.security.capabilityTor": "Tor",
    "settings.security.capability.supported": "支持",
    "settings.security.capability.unavailable": "不可用",
    "settings.security.sessionTitle": "会话管理",
    "settings.security.sessionDesc": "当前会话的安全设置。",
    "settings.security.lockNow": "立即锁定",
    "settings.security.sessionActionsTitle": "安全操作",
    "settings.security.sessionActionsSummary":
      "使用「立即锁定」进行即时保护；仅在需要时清除本地数据。",
    "settings.security.resetLocalHistoryTitle": "重置本地历史（保留身份）",
    "settings.security.resetLocalHistoryDesc":
      "这将清除此设备上的本地聊天记录、同步检查点和缓存媒体，但会保留您的身份/会话和记住我凭据。",
    "settings.security.resetLocalHistoryConfirm": "重置本地历史",
    "settings.security.verificationTitle": "安全与验证",
    "settings.security.verificationDesc": "管理您的身份验证和安全偏好",
    "settings.security.yourIdentity": "您的身份",
    "settings.security.publicKey": "公钥",
    "settings.security.loading": "加载中…",
    "settings.security.copyPublicKey": "复制公钥",
    "settings.security.identityVerifiedLocal": "身份已验证（本地密钥）",
    "settings.security.fingerprintHelp":
      "此视觉指纹由您的公钥唯一生成。与联系人分享以帮助他们验证您的身份。",
    "settings.security.contactVerificationPreview": "联系人验证预览",
    "settings.security.demoContact": "演示联系人",
    "settings.security.securityTipTitle": "安全提示",
    "settings.security.securityTipBody":
      "在分享敏感信息之前，请务必验证联系人的视觉指纹。请他们确认其指纹与您在其个人资料中看到的一致。",
    "profile.friendCodeLabel": "好友代码",
    "profile.friendCodeHelp": "使用此好友代码快速发现账户。",
    "profile.friendCodeSuffixHelp": "前缀由应用身份固定；仅可编辑 6 位后缀。",
    "profile.friendCodeSuffixHelpCompact": "固定前缀后的 6 位后缀。",
    "profile.friendCodeRandom": "随机",
    "profile.friendCodeCopy": "复制",
    "profile.friendCodeCopied": "已复制好友代码。",
    "profile.friendCodeCopyFailed": "无法复制好友代码。",
    "profile.copyIdentityLink": "复制身份链接",
    "profile.identityLinkCopied": "已复制可分享的身份链接。",
    "messaging.lastActive": "上次活跃 {{time}}",
    "messaging.lastViewed": "上次查看 {{time}}",
    "messaging.noRecentActivity": "无近期活动",
  },
  fr: {
    "settings.privacy.dmPolicyTitle": "Politique de messages directs",
    "settings.privacy.dmPolicyHint":
      "Choisissez qui peut atteindre votre boîte de réception par défaut.",
    "settings.privacy.everyone": "Tout le monde",
    "settings.privacy.contactsOnly": "Contacts uniquement",
    "settings.privacy.modernDmsTitle": "Activer les MD modernes (Gift Wraps)",
    "settings.privacy.modernDmsDesc":
      "Ajoute une confidentialité des métadonnées renforcée pour les clients et relais compatibles.",
    "settings.privacy.retentionTitle": "Rétention locale des messages",
    "settings.privacy.retentionHint":
      "Limite l'historique de chat affiché sur cet appareil.",
    "settings.privacy.retentionOff": "Désactivé",
    "settings.privacy.retention30Days": "30 jours",
    "settings.privacy.retention30DaysShort": "30j",
    "settings.privacy.retention90Days": "90 jours",
    "settings.privacy.retention90DaysShort": "90j",
    "settings.privacy.showPubkeyTitle":
      "Afficher les contrôles de clé publique dans le chat",
    "settings.privacy.showPubkeyDesc":
      "Garde l'en-tête du chat centré sur les noms d'utilisateur sauf si vous activez explicitement les contrôles Partager l'ID.",
    "settings.privacy.summaryTitle": "Résumé de confidentialité",
    "settings.privacy.summary":
      "Politique MD : {{dmPolicy}} · MD modernes : {{modernDms}} · Rétention : {{retention}} · Contrôles clé publique : {{pubkeyControls}}",
    "settings.privacy.summaryModernDmsEnabled": "activé",
    "settings.privacy.summaryModernDmsDisabled": "désactivé",
    "settings.privacy.summaryPubkeyShown": "affiché",
    "settings.privacy.summaryPubkeyHidden": "masqué",
    "settings.privacy.dmPolicyEveryone": "tout le monde",
    "settings.privacy.dmPolicyContactsOnly": "contacts uniquement",
    "settings.security.postureTitle": "Posture de sécurité",
    "settings.security.postureDesc":
      "État de protection actuel et vérifications des capacités.",
    "settings.security.overallPosture": "Posture globale",
    "settings.security.posture.strong": "Forte",
    "settings.security.posture.moderate": "Modérée",
    "settings.security.posture.weak": "Faible",
    "settings.security.capabilityClipboard": "Presse-papiers",
    "settings.security.capabilityBiometric": "Biométrie",
    "settings.security.capabilityTor": "Tor",
    "settings.security.capability.supported": "pris en charge",
    "settings.security.capability.unavailable": "indisponible",
    "settings.security.sessionTitle": "Gestion de session",
    "settings.security.sessionDesc": "Paramètres de sécurité pour votre session actuelle.",
    "settings.security.lockNow": "Verrouiller maintenant",
    "settings.security.sessionActionsTitle": "Actions de sécurité",
    "settings.security.sessionActionsSummary":
      "Utilisez Verrouiller maintenant pour une protection immédiate ; effacez les données locales uniquement si nécessaire.",
    "settings.security.resetLocalHistoryTitle":
      "Réinitialiser l'historique local (conserver l'identité)",
    "settings.security.resetLocalHistoryDesc":
      "Cela efface l'historique de chat local, les points de contrôle de synchronisation et les médias en cache sur cet appareil, mais conserve votre identité/session et vos identifiants « rester connecté ».",
    "settings.security.resetLocalHistoryConfirm": "Réinitialiser l'historique local",
    "settings.security.verificationTitle": "Sécurité et vérification",
    "settings.security.verificationDesc":
      "Gérez votre vérification d'identité et vos préférences de sécurité",
    "settings.security.yourIdentity": "Votre identité",
    "settings.security.publicKey": "Clé publique",
    "settings.security.loading": "Chargement…",
    "settings.security.copyPublicKey": "Copier la clé publique",
    "settings.security.identityVerifiedLocal": "Identité vérifiée (clé locale)",
    "settings.security.fingerprintHelp":
      "Cette empreinte visuelle est générée de manière unique à partir de votre clé publique. Partagez-la avec vos contacts pour les aider à vérifier votre identité.",
    "settings.security.contactVerificationPreview": "Aperçu de vérification du contact",
    "settings.security.demoContact": "Contact de démonstration",
    "settings.security.securityTipTitle": "Conseil de sécurité",
    "settings.security.securityTipBody":
      "Vérifiez toujours les empreintes visuelles de vos contacts avant de partager des informations sensibles. Demandez-leur de confirmer que leur empreinte correspond à ce que vous voyez dans leur profil.",
    "profile.friendCodeLabel": "Code ami",
    "profile.friendCodeHelp": "Utilisez ce code ami pour découvrir rapidement un compte.",
    "profile.friendCodeSuffixHelp":
      "Le préfixe est fixé par l'identité de l'application ; modifiez uniquement le suffixe de 6 caractères.",
    "profile.friendCodeSuffixHelpCompact": "Suffixe de 6 caractères après le préfixe fixe.",
    "profile.friendCodeRandom": "Aléatoire",
    "profile.friendCodeCopy": "Copier",
    "profile.friendCodeCopied": "Code ami copié.",
    "profile.friendCodeCopyFailed": "Impossible de copier le code ami.",
    "profile.copyIdentityLink": "Copier le lien d'identité",
    "profile.identityLinkCopied": "Lien d'identité partageable copié.",
    "messaging.lastActive": "Dernière activité {{time}}",
    "messaging.lastViewed": "Dernière consultation {{time}}",
    "messaging.noRecentActivity": "Aucune activité récente",
  },
  de: {
    "settings.privacy.dmPolicyTitle": "Direktnachrichten-Richtlinie",
    "settings.privacy.dmPolicyHint":
      "Wählen Sie, wer standardmäßig Ihren Posteingang erreichen kann.",
    "settings.privacy.everyone": "Alle",
    "settings.privacy.contactsOnly": "Nur Kontakte",
    "settings.privacy.modernDmsTitle": "Moderne DMs aktivieren (Gift Wraps)",
    "settings.privacy.modernDmsDesc":
      "Stärkere Metadaten-Privatsphäre für kompatible Clients und Relays.",
    "settings.privacy.retentionTitle": "Lokale Nachrichtenaufbewahrung",
    "settings.privacy.retentionHint":
      "Begrenzt den auf diesem Gerät angezeigten Chatverlauf.",
    "settings.privacy.retentionOff": "Aus",
    "settings.privacy.retention30Days": "30 Tage",
    "settings.privacy.retention30DaysShort": "30T",
    "settings.privacy.retention90Days": "90 Tage",
    "settings.privacy.retention90DaysShort": "90T",
    "settings.privacy.showPubkeyTitle": "Öffentliche Schlüssel-Steuerung im Chat anzeigen",
    "settings.privacy.showPubkeyDesc":
      "Hält den Chat-Header auf Benutzernamen fokussiert, es sei denn, Sie aktivieren explizit die ID-teilen-Steuerung.",
    "settings.privacy.summaryTitle": "Datenschutz-Zusammenfassung",
    "settings.privacy.summary":
      "DM-Richtlinie: {{dmPolicy}} · Moderne DMs: {{modernDms}} · Aufbewahrung: {{retention}} · Öffentliche Schlüssel: {{pubkeyControls}}",
    "settings.privacy.summaryModernDmsEnabled": "aktiviert",
    "settings.privacy.summaryModernDmsDisabled": "deaktiviert",
    "settings.privacy.summaryPubkeyShown": "angezeigt",
    "settings.privacy.summaryPubkeyHidden": "ausgeblendet",
    "settings.privacy.dmPolicyEveryone": "alle",
    "settings.privacy.dmPolicyContactsOnly": "nur Kontakte",
    "settings.security.postureTitle": "Sicherheitslage",
    "settings.security.postureDesc": "Aktueller Schutzstatus und Funktionsprüfungen.",
    "settings.security.overallPosture": "Gesamtlage",
    "settings.security.posture.strong": "Stark",
    "settings.security.posture.moderate": "Mittel",
    "settings.security.posture.weak": "Schwach",
    "settings.security.capabilityClipboard": "Zwischenablage",
    "settings.security.capabilityBiometric": "Biometrie",
    "settings.security.capabilityTor": "Tor",
    "settings.security.capability.supported": "unterstützt",
    "settings.security.capability.unavailable": "nicht verfügbar",
    "settings.security.sessionTitle": "Sitzungsverwaltung",
    "settings.security.sessionDesc": "Sicherheitseinstellungen für Ihre aktuelle Sitzung.",
    "settings.security.lockNow": "Jetzt sperren",
    "settings.security.sessionActionsTitle": "Sicherheitsaktionen",
    "settings.security.sessionActionsSummary":
      "Verwenden Sie Jetzt sperren für sofortigen Schutz; lokale Daten nur bei Bedarf löschen.",
    "settings.security.resetLocalHistoryTitle": "Lokalen Verlauf zurücksetzen (Identität behalten)",
    "settings.security.resetLocalHistoryDesc":
      "Löscht lokalen Chatverlauf, Sync-Checkpoints und zwischengespeicherte Medien auf diesem Gerät, behält aber Identität/Sitzung und Angemeldet-bleiben-Anmeldedaten.",
    "settings.security.resetLocalHistoryConfirm": "Lokalen Verlauf zurücksetzen",
    "settings.security.verificationTitle": "Sicherheit und Verifizierung",
    "settings.security.verificationDesc":
      "Verwalten Sie Ihre Identitätsverifizierung und Sicherheitseinstellungen",
    "settings.security.yourIdentity": "Ihre Identität",
    "settings.security.publicKey": "Öffentlicher Schlüssel",
    "settings.security.loading": "Wird geladen…",
    "settings.security.copyPublicKey": "Öffentlichen Schlüssel kopieren",
    "settings.security.identityVerifiedLocal": "Identität verifiziert (lokaler Schlüssel)",
    "settings.security.fingerprintHelp":
      "Dieser visuelle Fingerabdruck wird eindeutig aus Ihrem öffentlichen Schlüssel generiert. Teilen Sie ihn mit Kontakten, damit sie Ihre Identität verifizieren können.",
    "settings.security.contactVerificationPreview": "Kontaktverifizierungs-Vorschau",
    "settings.security.demoContact": "Demo-Kontakt",
    "settings.security.securityTipTitle": "Sicherheitstipp",
    "settings.security.securityTipBody":
      "Verifizieren Sie immer die visuellen Fingerabdrücke Ihrer Kontakte, bevor Sie sensible Informationen teilen. Bitten Sie sie zu bestätigen, dass ihr Fingerabdruck mit dem in ihrem Profil übereinstimmt.",
    "profile.friendCodeLabel": "Freundescode",
    "profile.friendCodeHelp": "Verwenden Sie diesen Freundescode zur schnellen Kontosuche.",
    "profile.friendCodeSuffixHelp":
      "Das Präfix ist durch die App-Identität festgelegt; bearbeiten Sie nur das 6-stellige Suffix.",
    "profile.friendCodeSuffixHelpCompact": "6-stelliges Suffix nach dem festen Präfix.",
    "profile.friendCodeRandom": "Zufällig",
    "profile.friendCodeCopy": "Kopieren",
    "profile.friendCodeCopied": "Freundescode kopiert.",
    "profile.friendCodeCopyFailed": "Freundescode konnte nicht kopiert werden.",
    "profile.copyIdentityLink": "Identitätslink kopieren",
    "profile.identityLinkCopied": "Teilbaren Identitätslink kopiert.",
    "messaging.lastActive": "Zuletzt aktiv {{time}}",
    "messaging.lastViewed": "Zuletzt angesehen {{time}}",
    "messaging.noRecentActivity": "Keine kürzliche Aktivität",
  },
  es: {
    "settings.privacy.dmPolicyTitle": "Política de mensajes directos",
    "settings.privacy.dmPolicyHint":
      "Elige quién puede llegar a tu bandeja de entrada por defecto.",
    "settings.privacy.everyone": "Todos",
    "settings.privacy.contactsOnly": "Solo contactos",
    "settings.privacy.modernDmsTitle": "Activar MD modernos (Gift Wraps)",
    "settings.privacy.modernDmsDesc":
      "Añade mayor privacidad de metadatos para clientes y relays compatibles.",
    "settings.privacy.retentionTitle": "Retención local de mensajes",
    "settings.privacy.retentionHint":
      "Limita el historial de chat mostrado en este dispositivo.",
    "settings.privacy.retentionOff": "Desactivado",
    "settings.privacy.retention30Days": "30 días",
    "settings.privacy.retention30DaysShort": "30d",
    "settings.privacy.retention90Days": "90 días",
    "settings.privacy.retention90DaysShort": "90d",
    "settings.privacy.showPubkeyTitle":
      "Mostrar controles de clave pública en el chat",
    "settings.privacy.showPubkeyDesc":
      "Mantiene el encabezado del chat centrado en nombres de usuario a menos que habilites explícitamente los controles de compartir ID.",
    "settings.privacy.summaryTitle": "Resumen de privacidad",
    "settings.privacy.summary":
      "Política MD: {{dmPolicy}} · MD modernos: {{modernDms}} · Retención: {{retention}} · Controles de clave pública: {{pubkeyControls}}",
    "settings.privacy.summaryModernDmsEnabled": "activado",
    "settings.privacy.summaryModernDmsDisabled": "desactivado",
    "settings.privacy.summaryPubkeyShown": "visible",
    "settings.privacy.summaryPubkeyHidden": "oculto",
    "settings.privacy.dmPolicyEveryone": "todos",
    "settings.privacy.dmPolicyContactsOnly": "solo contactos",
    "settings.security.postureTitle": "Postura de seguridad",
    "settings.security.postureDesc":
      "Estado de protección actual y comprobaciones de capacidad.",
    "settings.security.overallPosture": "Postura general",
    "settings.security.posture.strong": "Fuerte",
    "settings.security.posture.moderate": "Moderada",
    "settings.security.posture.weak": "Débil",
    "settings.security.capabilityClipboard": "Portapapeles",
    "settings.security.capabilityBiometric": "Biometría",
    "settings.security.capabilityTor": "Tor",
    "settings.security.capability.supported": "compatible",
    "settings.security.capability.unavailable": "no disponible",
    "settings.security.sessionTitle": "Gestión de sesión",
    "settings.security.sessionDesc": "Ajustes de seguridad para tu sesión actual.",
    "settings.security.lockNow": "Bloquear ahora",
    "settings.security.sessionActionsTitle": "Acciones de seguridad",
    "settings.security.sessionActionsSummary":
      "Usa Bloquear ahora para protección inmediata; borra datos locales solo cuando sea necesario.",
    "settings.security.resetLocalHistoryTitle":
      "Restablecer historial local (conservar identidad)",
    "settings.security.resetLocalHistoryDesc":
      "Borra el historial de chat local, puntos de sincronización y medios en caché en este dispositivo, pero conserva tu identidad/sesión y credenciales de recordarme.",
    "settings.security.resetLocalHistoryConfirm": "Restablecer historial local",
    "settings.security.verificationTitle": "Seguridad y verificación",
    "settings.security.verificationDesc":
      "Gestiona tu verificación de identidad y preferencias de seguridad",
    "settings.security.yourIdentity": "Tu identidad",
    "settings.security.publicKey": "Clave pública",
    "settings.security.loading": "Cargando…",
    "settings.security.copyPublicKey": "Copiar clave pública",
    "settings.security.identityVerifiedLocal": "Identidad verificada (clave local)",
    "settings.security.fingerprintHelp":
      "Esta huella visual se genera de forma única a partir de tu clave pública. Compártela con contactos para ayudarles a verificar tu identidad.",
    "settings.security.contactVerificationPreview": "Vista previa de verificación de contacto",
    "settings.security.demoContact": "Contacto de demostración",
    "settings.security.securityTipTitle": "Consejo de seguridad",
    "settings.security.securityTipBody":
      "Verifica siempre las huellas visuales de tus contactos antes de compartir información sensible. Pídeles que confirmen que su huella coincide con lo que ves en su perfil.",
    "profile.friendCodeLabel": "Código de amigo",
    "profile.friendCodeHelp": "Usa este código de amigo para descubrir cuentas rápidamente.",
    "profile.friendCodeSuffixHelp":
      "El prefijo está fijado por la identidad de la app; edita solo el sufijo de 6 caracteres.",
    "profile.friendCodeSuffixHelpCompact": "Sufijo de 6 caracteres después del prefijo fijo.",
    "profile.friendCodeRandom": "Aleatorio",
    "profile.friendCodeCopy": "Copiar",
    "profile.friendCodeCopied": "Código de amigo copiado.",
    "profile.friendCodeCopyFailed": "No se pudo copiar el código de amigo.",
    "profile.copyIdentityLink": "Copiar enlace de identidad",
    "profile.identityLinkCopied": "Enlace de identidad compartible copiado.",
    "messaging.lastActive": "Última actividad {{time}}",
    "messaging.lastViewed": "Última vista {{time}}",
    "messaging.noRecentActivity": "Sin actividad reciente",
  },
};

function mergeLocale(locale) {
  const path = join(localesDir, `${locale}.json`);
  const data = JSON.parse(readFileSync(path, "utf8"));
  const keys = supplemental[locale] ?? supplemental.en;
  let added = 0;
  for (const [key, value] of Object.entries(keys)) {
    if (!(key in data.translation)) {
      added++;
    }
    data.translation[key] = value;
  }
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return { locale, added, total: Object.keys(data.translation).length };
}

for (const locale of ["en", "zh", "fr", "de", "es"]) {
  const result = mergeLocale(locale);
  console.log(`${result.locale}: ${result.total} keys (${result.added} new)`);
}
