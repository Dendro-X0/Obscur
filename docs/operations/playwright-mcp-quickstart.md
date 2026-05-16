# Playwright MCP Quickstart

Use this when you want MCP-driven UI interaction against this workspace.

## Installed Server

- Package: `@playwright/mcp`
- Default script: `pnpm run mcp:playwright`

## Local Launch Commands

```bash
pnpm run mcp:playwright
pnpm run mcp:playwright:headed
pnpm run mcp:playwright:sse
```

Notes:

- `mcp:playwright` runs headless + isolated profile.
- `mcp:playwright:headed` is useful for visually watching automation.
- `mcp:playwright:sse` exposes an SSE endpoint on `127.0.0.1:8931`.

## VS Code Workspace MCP Config

This repo includes:

- `.vscode/mcp.json`

It registers a `playwright` MCP server that runs:

```bash
pnpm run mcp:playwright
```

## Typical Flow for Scroll-Repro Runs

1. Start app:
   - `pnpm dev:pwa`
2. Start MCP server:
   - `pnpm run mcp:playwright:headed`
3. In your MCP client, connect to the `playwright` server and run the repro steps.
