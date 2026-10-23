import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

// MOBILE=1 builds a static bundle for Capacitor (no Worker); the API is then reached via VITE_API_BASE.
const mobile = process.env.MOBILE === "1";

export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
    ...(mobile ? [] : [cloudflare()]),
  ],
  build: mobile ? { outDir: "dist-mobile" } : undefined,
});
