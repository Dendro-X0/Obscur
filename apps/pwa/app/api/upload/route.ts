import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            console.error("[Upload] No file found in FormData");
            return NextResponse.json({ ok: false, message: "No file uploaded" }, { status: 400 });
        }

        console.log(`[Upload] Processing: ${file.name} (${file.size} bytes, ${file.type})`);

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Create unique filename
        const extension = file.name.split(".").pop() || "bin";
        const fileName = `${crypto.randomUUID()}.${extension}`;

        // Use absolute path from process.cwd()
        const uploadDir = join(process.cwd(), "public", "uploads");

        console.log(`[Upload] Saving to: ${uploadDir}`);

        // Ensure directory exists
        try {
            await mkdir(uploadDir, { recursive: true });
        } catch (dirError) {
            console.error("[Upload] Failed to create directory:", dirError);
        }

        const filePath = join(uploadDir, fileName);
        await writeFile(filePath, buffer);

        const publicUrl = `/uploads/${fileName}`;

        console.log(`[Upload] Success: ${publicUrl}`);

        return NextResponse.json({
            ok: true,
            url: publicUrl,
            fileName: file.name,
            fileSize: file.size,
            contentType: file.type // Changed back to contentType to match LocalUploadService expectations
        });
    } catch (error) {
        console.error("[Upload] Critical error:", error);
        return NextResponse.json({
            ok: false,
            message: error instanceof Error ? error.message : "Upload failed"
        }, { status: 500 });
    }
}
