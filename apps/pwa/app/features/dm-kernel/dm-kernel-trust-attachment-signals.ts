/**
 * Structural attachment filename signals — no content inspection.
 */

/** Document extension followed by executable extension (Shield R10 shape). */
export const DOUBLE_EXTENSION_PATTERN =
  /\.(?:pdf|doc|docx|xls|xlsx|ppt|pptx|txt|jpg|jpeg|png|gif|zip|rar|7z)\.(?:exe|msi|bat|cmd|com|scr|ps1|vbs|js|jar|app|dmg)$/i;

/** Macro-enabled Office documents (Shield R11 shape). */
export const MACRO_OFFICE_EXTENSION_PATTERN =
  /\.(?:docm|xlsm|pptm|dotm|xltm|potm|ppam|xlam)$/i;

const STANDALONE_EXECUTABLE_EXTENSION_PATTERN =
  /\.(?:exe|msi|scr|bat|cmd|ps1|vbs|jar|com|dmg|app)$/i;

const normalizeFileName = (fileName: string): string => (
  fileName.trim().split(/[/\\]/).pop()?.trim() ?? ""
);

export const classifyAttachmentFilenameRisk = (
  fileName: string,
): Readonly<{ risky: boolean; reason: "double_extension" | "macro_office" | "executable" | null }> => {
  const baseName = normalizeFileName(fileName);
  if (!baseName) {
    return { risky: false, reason: null };
  }
  if (DOUBLE_EXTENSION_PATTERN.test(baseName)) {
    return { risky: true, reason: "double_extension" };
  }
  if (MACRO_OFFICE_EXTENSION_PATTERN.test(baseName)) {
    return { risky: true, reason: "macro_office" };
  }
  if (STANDALONE_EXECUTABLE_EXTENSION_PATTERN.test(baseName)) {
    return { risky: true, reason: "executable" };
  }
  return { risky: false, reason: null };
};

export const isRiskyAttachmentFilename = (fileName: string): boolean => (
  classifyAttachmentFilenameRisk(fileName).risky
);

export const detectRiskyAttachmentFilenames = (
  fileNames: ReadonlyArray<string>,
): boolean => fileNames.some((fileName) => isRiskyAttachmentFilename(fileName));
