import { describe, expect, it } from "vitest";
import {
  classifyAttachmentFilenameRisk,
  detectRiskyAttachmentFilenames,
  isRiskyAttachmentFilename,
} from "./dm-kernel-trust-attachment-signals";

describe("dm-kernel-trust-attachment-signals", () => {
  it("flags double-extension disguised executables", () => {
    expect(isRiskyAttachmentFilename("Project-Brief.pdf.exe")).toBe(true);
    expect(classifyAttachmentFilenameRisk("invoice.docx.js").reason).toBe("double_extension");
  });

  it("flags macro-enabled office documents", () => {
    expect(isRiskyAttachmentFilename("contract.docm")).toBe(true);
    expect(classifyAttachmentFilenameRisk("payroll.xlsm").reason).toBe("macro_office");
  });

  it("flags standalone executable attachments", () => {
    expect(isRiskyAttachmentFilename("setup.exe")).toBe(true);
    expect(classifyAttachmentFilenameRisk("installer.msi").reason).toBe("executable");
  });

  it("ignores benign filenames", () => {
    expect(detectRiskyAttachmentFilenames(["notes.txt", "photo.jpg"])).toBe(false);
  });
});
