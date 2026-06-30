/**
 * Dev / production server for the OTA dashboard.
 *
 *   bun run dev     -> hot-reload server (development)
 *   bun run start   -> production server  (adds  --prod)
 *
 * Port resolution order:
 *   1. PORT env var            (e.g.  PORT=4000 bun run dev)
 *   2. 3000 (default)
 * If the chosen port is busy, the next free port is used automatically
 * instead of crashing with EADDRINUSE.
 *
 * NOTE: the bare `bun ./index.html` form ignores the `--port` flag, which is
 * why this wrapper exists — set the port with the PORT env var above.
 */
import index from "../index.html";

const isProd = process.argv.includes("--prod");
const basePort = Number(process.env.PORT ?? 3000);

function startOn(port: number, attemptsLeft: number) {
  try {
    const server = Bun.serve({
      port,
      development: !isProd,
      routes: { "/*": index },
    });
    console.log(`OTA dashboard (${isProd ? "production" : "development"}) ready at ${server.url.href}`);
    return server;
  } catch (err: any) {
    if (err?.code === "EADDRINUSE" && attemptsLeft > 0) {
      console.warn(`Port ${port} is in use, trying ${port + 1}...`);
      return startOn(port + 1, attemptsLeft - 1);
    }
    throw err;
  }
}

startOn(basePort, 10);
