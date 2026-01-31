# Vercel Monorepo Deployment Plan

Since the PWA and API are separate applications within the monorepo, they must be deployed as **two separate Vercel projects**. This ensures that the API can scale independently and that the PWA receives the correct configuration at build time.

## Project 1: API Service (Deploy this first)

The API service is a Hono application that will serve as the backend for the PWA.

### 1. Create New Project in Vercel
- **Import Git Repository**: Select your `Dendro-X0/Obscur` repository.
- **Project Name**: `obscur-api` (or similar)
- **Framework Preset**: select `Other` (or `Vite` if auto-detected, but `Other` is fine for Hono/Node).
- **Root Directory**: `apps/api` (Click "Edit" next to Root Directory and select `apps/api`).
- **Build Command**: `npm run build` (or `tsc`) if not auto-detected.
- **Output Directory**: `dist` (if prompted, but Vercel Functions usually don't need this if setup correctly).

### 2. Environment Variables
Configure these variables in the Vercel project settings:
- `CORS_ORIGIN`: `https://obscur-lovat.vercel.app` (This allows your PWA to talk to the API. You can add more origins separated by commas if needed, or `*` for testing, but typically this should match your PWA's production URL).

### 3. Deploy
- Click **Deploy**.
- Once deployed, copy the **Deployment URL** (e.g., `https://obscur-api-xyz.vercel.app`). You will need this for the PWA.

---

## Project 2: PWA (Frontend)

The PWA is a Next.js application that provides the user interface.

### 1. Create New Project in Vercel (or Update Existing)
- **Import Git Repository**: Select the same `Dendro-X0/Obscur` repository.
- **Project Name**: `obscur-pwa` (or keep existing `obscur-lovat`).
- **Framework Preset**: `Next.js` (should be auto-detected).
- **Root Directory**: `apps/pwa` (Click "Edit" and select `apps/pwa`).

### 2. Environment Variables
This is the most critical step. The PWA needs to know where the API lives *at build time* for some static generation and *at runtime* for client-side requests.

- `NEXT_PUBLIC_API_BASE_URL`: `https://obscur-api-xyz.vercel.app` (Paste the URL from the API deployment above. **Important**: Do not include a trailing slash).

***Note**: If you have other variables like `NEXT_PUBLIC_E2E_RELAYS`, add them here as well.*

### 3. Deploy
- Click **Deploy** (or Redeploy if updating).
- Vercel will build the PWA. During the build, it will bake in the `NEXT_PUBLIC_API_BASE_URL`.

---

## Verification

1. **Check API Health**: Visit `https://obscur-api-xyz.vercel.app/v1/health`. You should see a JSON response with `"ok": true`.
2. **Check PWA Health**: Open the PWA, go to **Settings > Health**.
    - The **API Status** should check against your new API URL.
    - It should show "Connected" or "Open".
    - The "Base URL" displayed should match what you set in `NEXT_PUBLIC_API_BASE_URL`.

## Troubleshooting

- **CORS Errors**: If the PWA cannot fetch data, check the `CORS_ORIGIN` variable in the **API** project. It must match the domain the PWA is running on.
- **Microservice Routing**: If you prefer a single domain (e.g., `obscur.app` serving both), you can use Vercel Rewrites in the PWA's `vercel.json` to proxy `/api/*` requests to the API deployment, but the two-project approach above is simpler and more robust for now.
