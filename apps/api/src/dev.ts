import { serve } from "@hono/node-server";
import app from "../api/index";

const port: number = 8787;

serve({
  fetch: app.fetch,
  port
});
