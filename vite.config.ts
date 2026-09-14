import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
// import legacy from "@vitejs/plugin-legacy";
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
    
    // legacy({
    //   targets: ["Safari >= 12", "iOS >= 12"],
    //   modernTargets: ["Safari >= 12", "iOS >= 12"],
    //   modernPolyfills: true,
    //   renderLegacyChunks: true,
    // }),
    VitePWA({
      // "prompt": o service worker novo fica em espera e avisamos o usuário
      // (banner "Nova versão disponível") em vez de trocar por baixo dos panos.
      registerType: "prompt",
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
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
}));
