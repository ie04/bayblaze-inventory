import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      injectRegister: false,
      registerType: "autoUpdate",
      includeAssets: [
        "bayblaze-inventory-icon.png",
        "favicon-32x32.png",
        "apple-touch-icon.png",
        "icons/bayblaze-inventory-icon-192.png",
        "icons/bayblaze-inventory-icon-512.png"
      ],
      manifest: {
        name: "BayBlaze Inventory",
        short_name: "BB Inventory",
        description: "BayBlaze inventory app for Medusa products, variants, stock, and vehicle assignment.",
        theme_color: "#f26a1b",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/icons/bayblaze-inventory-icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/icons/bayblaze-inventory-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true
      }
    })
  ]
});
