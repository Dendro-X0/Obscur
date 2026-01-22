import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

type UploadResponseBody = Readonly<{
  ok: true;
  url: string;
  contentType: string;
}>;

type UploadErrorResponseBody = Readonly<{
  ok: false;
  error: string;
}>;

const MAX_UPLOAD_BYTES: number = 25 * 1024 * 1024;

const UPLOADS_DIRNAME: string = "uploads";

const getUploadsDirAbsolutePath = (): string => {
  const thisFilePath: string = fileURLToPath(import.meta.url);
  const thisDirPath: string = path.dirname(thisFilePath);
  return path.resolve(thisDirPath, "..", "..", "..", "public", UPLOADS_DIRNAME);
};

const sanitizeFilename = (filename: string): string => {
  const normalized: string = filename.trim().toLowerCase();
  const replaced: string = normalized.replaceAll(/[^a-z0-9._-]/g, "-");
  return replaced.length > 0 ? replaced : "file";
};

export const POST = async (request: NextRequest): Promise<Response> => {
  const formData: FormData = await request.formData();
  const fileValue: FormDataEntryValue | null = formData.get("file");
  if (!(fileValue instanceof File)) {
    return NextResponse.json<UploadErrorResponseBody>({ ok: false, error: "Missing file" }, { status: 400 });
  }
  const file: File = fileValue;
  const contentType: string = file.type || "application/octet-stream";
  if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
    return NextResponse.json<UploadErrorResponseBody>({ ok: false, error: "Only image/video uploads are supported" }, { status: 415 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json<UploadErrorResponseBody>({ ok: false, error: `File too large (max ${MAX_UPLOAD_BYTES} bytes)` }, { status: 413 });
  }
  const arrayBuffer: ArrayBuffer = await file.arrayBuffer();
  const buffer: Buffer = Buffer.from(arrayBuffer);
  const uploadsDirAbsolutePath: string = getUploadsDirAbsolutePath();
  await fs.mkdir(uploadsDirAbsolutePath, { recursive: true });
  const safeOriginalName: string = sanitizeFilename(file.name || "upload");
  const extension: string = path.extname(safeOriginalName);
  const baseName: string = path.basename(safeOriginalName, extension);
  const nonce: string = crypto.randomUUID();
  const storedFilename: string = `${baseName}-${nonce}${extension || ""}`;
  const storedAbsolutePath: string = path.join(uploadsDirAbsolutePath, storedFilename);
  await fs.writeFile(storedAbsolutePath, buffer);
  const url: string = `/${UPLOADS_DIRNAME}/${storedFilename}`;
  return NextResponse.json<UploadResponseBody>({ ok: true, url, contentType }, { status: 200 });
};
