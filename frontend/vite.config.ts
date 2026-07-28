import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        tanstackRouter({ target: "react", autoCodeSplitting: true }),
        react(),
        tailwindcss(),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        port: 3001,
    },
    preview: {
        host: true,
        port: 3000,
        // domínio real vem só do .env (gitignored), nunca hardcoded no repo
        allowedHosts: process.env.VITE_PREVIEW_ALLOWED_HOST
            ? [process.env.VITE_PREVIEW_ALLOWED_HOST]
            : undefined,
    },
})
