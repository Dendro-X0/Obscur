import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ ok: false, message: "No file uploaded" }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Create unique filename
        const extension = file.name.split(".").pop();
        const fileName = `${uuidv4()}.${extension}`;
        const uploadDir = join(process.cwd(), "public", "uploads");

        // Ensure directory exists
        try {
            await mkdir(uploadDir, { recursive: true });
        } catch (e) {
            // Ignore if directory exists
        }

        const path = join(uploadDir, fileName);
        await writeFile(path, buffer);

        const publicUrl = `/uploads/${fileName}`;

        return NextResponse.json({
            ok: true,
            url: publicUrl,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type
        });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ ok: false, message: "Upload failed" }, { status: 500 });
    }
}
