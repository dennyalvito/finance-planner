import { defineConfig } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"
import tailwindcss from "@tailwindcss/vite"

const pwaBuildRevision =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.GITHUB_SHA ??
  process.env.npm_package_version ??
  "development"

// Nitro deploys Vercel static assets from the Build Output API directory.
const pwaOutDir =
  process.env.VERCEL === "1" || process.env.NITRO_PRESET === "vercel"
    ? ".vercel/output/static"
    : ".output/public"

const config = defineConfig(async ({ mode }) => ({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart({
      spa: {
        enabled: true,
      },
    }),
    ...(mode === "test" ? [] : [nitro()]),
    viteReact(),
    ...(mode === "production"
      ? [
          (await import("vite-plugin-pwa")).VitePWA({
            outDir: pwaOutDir,
            injectRegister: false,
            includeAssets: [
              "favicon.ico",
              "favicon.svg",
              "apple-touch-icon-180x180.png",
            ],
            manifest: {
              id: "/",
              name: "Coin",
              short_name: "Coin",
              description:
                "A private finance planner for income, expenses, and monthly budgets.",
              lang: "en",
              start_url: "/",
              scope: "/",
              display: "standalone",
              background_color: "#0d100e",
              theme_color: "#0d100e",
              categories: ["finance", "productivity"],
              prefer_related_applications: false,
              icons: [
                {
                  src: "/pwa-64x64.png",
                  sizes: "64x64",
                  type: "image/png",
                },
                {
                  src: "/pwa-192x192.png",
                  sizes: "192x192",
                  type: "image/png",
                },
                {
                  src: "/pwa-512x512.png",
                  sizes: "512x512",
                  type: "image/png",
                  purpose: "any",
                },
                {
                  src: "/maskable-icon-512x512.png",
                  sizes: "512x512",
                  type: "image/png",
                  purpose: "maskable",
                },
              ],
              shortcuts: [
                {
                  name: "Transactions",
                  short_name: "Transactions",
                  description: "Review and manage recorded transactions",
                  url: "/transactions",
                  icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }],
                },
                {
                  name: "Budgets",
                  short_name: "Budgets",
                  description: "Review monthly category budgets",
                  url: "/budgets",
                  icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }],
                },
              ],
            },
            workbox: {
              cleanupOutdatedCaches: true,
              globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
              globIgnores: [
                "**/apple-touch-icon-180x180.png",
                "**/favicon.*",
                "**/manifest.webmanifest",
                "**/maskable-icon-512x512.png",
                "**/pwa-*.png",
              ],
              maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
              additionalManifestEntries: [
                { url: "/_shell.html", revision: pwaBuildRevision },
              ],
              navigateFallback: "/_shell.html",
              navigateFallbackDenylist: [
                /^\/api(?:\/|$)/,
                /^\/auth(?:\/|$)/,
                /^\/_serverFn(?:\/|$)/,
              ],
            },
          }),
        ]
      : []),
  ],
  server: {
    port: 3000,
    strictPort: true,
  },
  preview: {
    port: 5000,
    strictPort: true,
  },
}))

export default config
