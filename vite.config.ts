import { defineConfig } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const googleIdentityHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Referrer-Policy": "strict-origin-when-cross-origin",
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
  server: {
    port: 3000,
    strictPort: true,
    headers: googleIdentityHeaders,
  },
  preview: {
    port: 5000,
    strictPort: true,
    headers: googleIdentityHeaders,
  },
})

export default config
