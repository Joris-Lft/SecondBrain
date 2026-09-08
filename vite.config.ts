import { copyFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const repositoryName = "2026";

const { version } = JSON.parse(
  readFileSync(path.resolve(__dirname, "package.json"), "utf-8"),
) as { version: string };

export default defineConfig(({ mode }) => ({
  base: mode === "production" ? `/${repositoryName}/` : "/",
  // Sert de `buster` au cache de requêtes persisté : bumper la version du
  // package invalide les caches des clients déjà déployés.
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(),
    {
      name: "spa-fallback",
      closeBundle() {
        if (mode === "production") {
          copyFileSync(
            path.resolve(__dirname, "dist/index.html"),
            path.resolve(__dirname, "dist/404.html"),
          );
        }
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // Les fonctions testées sont pures : pas besoin de DOM, donc pas de jsdom.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
}));
