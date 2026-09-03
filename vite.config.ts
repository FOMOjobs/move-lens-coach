// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import fs from "node:fs";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// HTTPS tylko lokalnie do testów na telefonie (kamera wymaga secure context).
// Włącza się WYŁĄCZNIE, gdy istnieją lokalne certy w ./certs (gitignore),
// więc na Lovable/produkcji zachowanie pozostaje bez zmian.
// MOVELENS_HTTP=1 wymusza zwykły HTTP (wygodne na kompie: http://localhost
// to i tak secure context, więc kamera działa bez ostrzeżeń o certyfikacie).
const httpsCfg =
  process.env.MOVELENS_HTTP !== "1" &&
  fs.existsSync("./certs/key.pem") &&
  fs.existsSync("./certs/cert.pem")
    ? {
        key: fs.readFileSync("./certs/key.pem"),
        cert: fs.readFileSync("./certs/cert.pem"),
      }
    : undefined;

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  ...(httpsCfg ? { vite: { server: { https: httpsCfg } } } : {}),
});
