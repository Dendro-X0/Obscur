# Unified Media Backend Design
**Goal**: Enable file uploads across Web (Vercel), Desktop (Tauri), and Mobile (Capacitor/Native) using a single, unified backend infrastructure.

## Architecture

We will leverage the existing **Cloudflare Worker** (`apps/coordination`) as the unified backend service. It is perfectly positioned to handle this because:
1.  **Global Edge**: Low latency for all users.
2.  **Cost Effective**: Cloudflare R2 has zero egress fees (unlike AWS S3), making it ideal for media hosting.
3.  **Serverless**: No servers to manage.

### The Stack

*   **API Gateway**: Cloudflare Worker (`apps/coordination`)
*   **Storage**: Cloudflare R2 Bucket (`obscur-media`)
*   **Protocol**: [NIP-96](https://github.com/nostr-protocol/nips/blob/master/96.md) (HTTP File Upload)
*   **Authentication**: [NIP-98](https://github.com/nostr-protocol/nips/blob/master/98.md) (HTTP Auth)

## Implementation Steps

### 1. Infrastructure (User Action Required)
You will need to verify your Cloudflare setup and create the R2 bucket:
```bash
npx wrangler r2 bucket create obscur-media
```

### 2. Backend Changes (`apps/coordination`)
We will update the worker to:
1.  **Bind R2 Bucket**: Update `wrangler.toml` to access the `obscur-media` bucket.
2.  **Add Authentication**: Implement NIP-98 verification to ensure only *you* (or authorized users) can upload.
3.  **Implement NIP-96**: Add the `POST /api/upload` (or `/nip96/upload`) endpoint that:
    *   Validates the NIP-98 header.
    *   Streams the file `Body` directly to R2.
    *   Returns the public URL (e.g., `https://media.yourdomain.com/filename.ext`).

### 3. Frontend Integration
The frontend is *already* capable of using this!
*   The `Nip96UploadService` class in `apps/pwa` is designed for exactly this.
*   **Action**: We just need to configure the **Settings > Storage** URL to point to your worker (e.g., `https://coordination.your-project.workers.dev/api/upload`).

## Why this approach?
*   **Single Codebase**: The exact same API logic serves Web, Desktop, and Mobile.
*   **Zero Vercel Dependency**: The upload traffic goes `Client -> Cloudflare`, bypassing Vercel entirely. This avoids Vercel's payload limits and function timeouts.
*   **Standard Compliant**: By using NIP-96, your backend is compatible with *other* Nostr clients too, if you choose to open it up.
