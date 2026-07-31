import { defineConfig } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"
import tailwindcss from "@tailwindcss/vite"

const config = defineConfig(({ mode }) => ({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart(),
    ...(mode === "test" ? [] : [nitro()]),
    viteReact(),
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
