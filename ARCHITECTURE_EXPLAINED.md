# Architecture: Private Decentralized Messaging

This project uses a **Serverless Nostr Architecture**. This means you do NOT need to deploy a complex, always-on backend server.

## 1. The Core Concept (Zero-Backend)
The application leverages the **Nostr Protocol** for all real-time messaging, data storage, and user identity.
*   **Identity**: Your private key (generated locally on your device).
*   **Database**: Decentralized Relay Servers (e.g., `wss://relay.damus.io`). These are public, free-to-use servers run by the community. You are not responsible for hosting them.
*   **Real-time**: Your app maintains a persistent WebSocket connection directly to these relays.

## 2. The "API" Layer (Stateless Utilities)
The "API" you see in the code (now at `/api` in the PWA) is **stateless**. It runs on Vercel Edge Functions (free tier) and handles tasks that the browser cannot do securely or efficiently:
1.  **Link Previews**: Fetches metadata from URLs (OpenGraph tags) to display nice cards in chat. This requires a server-side proxy to avoid CORS issues.
2.  **Bootstrap**: Provides a default list of public relays to new users so they can get started immediately.

## 3. Full-Stack Requirements
To run this application effectively, you only need:
1.  **Static Hosting (Frontend)**: Vercel (Free Tier). This serves the HTML/JS/CSS.
2.  **Edge Functions (API)**: Vercel (Free Tier). This runs the `apps/pwa/app/api` code for utilities.
3.  **Client Device**: The user's browser or Desktop App (which is just a wrapper around the Frontend).

## 4. Why You Don't Need a "Server"
In a traditional app (like WhatsApp), you need a server to route messages. In Obscur:
A sends message -> **Public Relay (Internet)** -> B receives message.
Your Vercel deployment is NOT involved in the message delivery. This is why it scales infinitely for free.

## 5. Deployment Strategy
*   **Web**: Deploy `apps/pwa` to Vercel.
*   **Desktop**: Build locally (`pnpm build:desktop`) and distribute the `.exe`. The desktop app can use the Web API for link previews (via `https://obscur-lovat.vercel.app/api`) or run its own logic.
