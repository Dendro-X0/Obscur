import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const UPLOADS_DIRNAME: string = "uploads";
const MAX_UPLOAD_BYTES: number = 100 * 1024 * 1024; // Increased to 100MB for videos

interface UploadResponseBody {
    ok: boolean;
    url?: string;
    contentType?: string;
    error?: string;
}

/**
 * Ensures the uploads directory exists and returns its absolute path.
 */
const getUploadsDirAbsolutePath = async (): Promise<string> => {
    // Use process.cwd() to get the project root consistently
    const uploadsPath: string = path.join(process.cwd(), "public", UPLOADS_DIRNAME);
    await fs.mkdir(uploadsPath, { recursive: true });
    return uploadsPath;
};

export const POST = async (request: NextRequest): Promise<Response> => {
    try {
        const formData: FormData = await request.formData();
        const file: FormDataEntryValue | null = formData.get("file");

        if (!file || !(file instanceof File)) {
            return NextResponse.json<UploadResponseBody>({ ok: false, error: "No file provided" }, { status: 400 });
        }

        if (file.size > MAX_UPLOAD_BYTES) {
            return NextResponse.json<UploadResponseBody>(
                { ok: false, error: `File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Max limit: ${MAX_UPLOAD_BYTES / 1024 / 1024}MB` },
                { status: 413 }
            );
        }

        const arrayBuffer: ArrayBuffer = await file.arrayBuffer();
        const buffer: Buffer = Buffer.from(arrayBuffer);

        const uploadsDirAbsolutePath: string = await getUploadsDirAbsolutePath();

        // Generate a secure filename
        const extension: string = path.extname(file.name) || ".bin";
        const storedFilename: string = `file-${uuidv4()}${extension}`;
        const filePath: string = path.join(uploadsDirAbsolutePath, storedFilename);

        await fs.writeFile(filePath, buffer);

        const contentType: string = file.type || "application/octet-stream";
        const url: string = `/${UPLOADS_DIRNAME}/${storedFilename}`;

        return NextResponse.json<UploadResponseBody>(
            {
                ok: true,
                url,
                contentType,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json<UploadResponseBody>(
            { ok: false, error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        );
    }
};
