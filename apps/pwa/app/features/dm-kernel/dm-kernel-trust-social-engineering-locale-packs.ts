/**
 * Locale-scoped social-engineering phrase packs (TRUST-INT-1c).
 * Structural + English patterns always run; these extend coverage for es/zh prose.
 */

export type SeLocalePackId = "es" | "zh";

export type SeLocalePatternGroups = Readonly<{
  credentialHarvest: ReadonlyArray<RegExp>;
  authorityImpersonation: ReadonlyArray<RegExp>;
  giftCardScam: ReadonlyArray<RegExp>;
  offPlatformRedirect: ReadonlyArray<RegExp>;
  advanceFeeScam: ReadonlyArray<RegExp>;
  remoteAccessTool: ReadonlyArray<RegExp>;
}>;

const ES_PATTERNS: SeLocalePatternGroups = {
  credentialHarvest: [
    /\b(frase semilla|frase de recuperaci[oó]n|clave privada|contrase[nñ]a)\b/i,
    /\b(env[ií]a|comparte|pega|confirma)\b.*\b(clave privada|frase semilla|contrase[nñ]a|c[oó]digo de verificaci[oó]n)\b/i,
    /\b(c[oó]digo de verificaci[oó]n|c[oó]digo de autenticaci[oó]n|contrase[nñ]a de un solo uso)\b/i,
  ],
  authorityImpersonation: [
    /\b(soporte|seguridad|atenci[oó]n al cliente)\b.*\b(obscur|banco|paypal|coinbase|binance)\b/i,
    /\b(su cuenta (?:ha sido|est[aá]|ser[aá]) (?:suspendida|bloqueada|comprometida))\b/i,
    /\b(equipo de soporte|departamento de seguridad|recuperaci[oó]n de cuenta)\b/i,
    /\b(soy (?:el )?(?:director|ceo|recursos humanos|n[oó]mina))\b/i,
  ],
  giftCardScam: [
    /\b(tarjeta(s)? de regalo|tarjeta google play|tarjeta itunes|tarjeta amazon)\b/i,
    /\b(compra|paga|carga)\b.*\b(tarjetas? de regalo|tarjetas? prepago)\b/i,
  ],
  offPlatformRedirect: [
    /\b(continu[aáeéií]|hablamos|escr[ií]beme|cont[aá]ctame)\b.*\b(en|por|v[ií]a|all[ií])\b.*\b(telegram|whatsapp|signal|discord)\b/i,
    /\b(en|por)\s+(telegram|whatsapp|signal|discord)\b/i,
    /\b(a[nñ][aá]deme en|encu[eé]ntrame en)\b.*\b(telegram|whatsapp|signal|discord)\b/i,
  ],
  advanceFeeScam: [
    /\b(paga|env[ií]a|transfiere)\b.*\b(por adelantado|anticipado|antes de empezar)\b/i,
    /\b(tarifa de registro|dep[oó]sito inicial|pago anticipado)\b/i,
  ],
  remoteAccessTool: [
    /\b(instala|descarga|abre)\b.*\b(anydesk|teamviewer|escritorio remoto)\b/i,
    /\b(sesi[oó]n de (?:escritorio remoto|compartir pantalla))\b/i,
  ],
};

const ZH_PATTERNS: SeLocalePatternGroups = {
  credentialHarvest: [
    /(种子短语|助记词|私钥|恢复短语|备份短语)/,
    /(发送|分享|粘贴|提供|输入).{0,12}(私钥|助记词|种子短语|密码|验证码)/,
    /(验证码|双重验证|一次性密码|身份验证码|登录密码)/,
  ],
  authorityImpersonation: [
    /(Obscur|钱包|银行|PayPal|Coinbase).{0,8}(客服|支持|安全|官方)/,
    /(您的账户|你的账户).{0,8}(已被冻结|已被锁定|已被暂停|存在异常)/,
    /(安全团队|官方代表|技术支持|账户恢复)/,
    /(我是|本人是).{0,6}(CEO|人事|财务|总监)/,
  ],
  giftCardScam: [
    /(礼品卡|Google Play 卡|iTunes 卡|亚马逊卡|Steam 卡)/,
    /(购买|充值).{0,8}(礼品卡|预付卡)/,
  ],
  offPlatformRedirect: [
    /(继续|联系|加我).{0,12}(Telegram|WhatsApp|Signal|Discord|微信)/,
    /(在|去).{0,6}(Telegram|WhatsApp|微信).{0,8}(聊|联系|沟通)/,
  ],
  advanceFeeScam: [
    /(预付|提前支付|先付).{0,8}(费用|定金|注册费)/,
    /(支付|转账).{0,8}(培训材料|设备费|入职费用)/,
  ],
  remoteAccessTool: [
    /(安装|下载|打开).{0,8}(AnyDesk|TeamViewer|远程桌面|远程控制)/,
    /(远程桌面|屏幕共享|远程协助)/,
  ],
};

export const SE_LOCALE_PATTERN_PACKS: Readonly<Record<SeLocalePackId, SeLocalePatternGroups>> = {
  es: ES_PATTERNS,
  zh: ZH_PATTERNS,
};

export const mergeSeLocalePatterns = (
  base: ReadonlyArray<RegExp>,
  group: keyof SeLocalePatternGroups,
): ReadonlyArray<RegExp> => [
  ...base,
  ...SE_LOCALE_PATTERN_PACKS.es[group],
  ...SE_LOCALE_PATTERN_PACKS.zh[group],
];

export const matchesSePatternGroup = (
  patterns: ReadonlyArray<RegExp>,
  content: string,
): boolean => patterns.some((pattern) => pattern.test(content));
