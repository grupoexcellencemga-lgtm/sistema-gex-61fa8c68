import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
const buildDate = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(2, 10).replace(/-/g, ".");

import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  server: {
    host: "::",
    port: Number(process.env.PORT) || 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      // "autoUpdate": o service worker novo ativa automaticamente assim que o
      // usuário fecha todas as abas do app. Evita ficar preso em versão antiga.
      registerType: "autoUpdate",
      // injectManifest: usa SW customizado (src/sw.ts) com suporte a push notifications
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectManifest: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
      includeAssets: ["apple-touch-icon.png", "pwa-192x192.png", "pwa-512x512.png"],
      manifest: {
        name: "Sistema GEx – Grupo Excellence",
        short_name: "GEx",
        description: "Sistema administrativo do Grupo Excellence",
        theme_color: "#1e293b",
        background_color: "#f8fafc",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        // Separar as libs do codigo da aplicacao: elas quase nunca mudam, entao
        // o navegador (e o precache do service worker) so rebaixa o que mudou a
        // cada deploy, em vez de um unico chunk de ~900 kB inteiro.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          // react, react-dom e o router precisam ficar juntos: instancias
          // separadas do React quebram os hooks.
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return "react-vendor";
          }
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@tanstack")) return "react-query";
          if (id.includes("@radix-ui")) return "radix-ui";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("date-fns")) return "date-fns";
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
}));
