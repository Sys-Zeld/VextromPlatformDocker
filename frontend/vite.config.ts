import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Base "/app/": o SPA convive com o frontend EJS legado, que continua em "/admin/...".
// Em dev, o Vite roda na 5173 e faz proxy das APIs para o Express na 3000.
export default defineConfig({
  plugins: [react()],
  base: "/app/",
  build: {
    outDir: "dist",
    emptyOutDir: true
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/admin/api": { target: "http://localhost:3000", changeOrigin: true },
      "/api": { target: "http://localhost:3000", changeOrigin: true },
      "/public": { target: "http://localhost:3000", changeOrigin: true },
      // Rotas legadas consumidas pelo SPA (iframe de preview, PDF, links legado)
      // e assets de imagens do relatório servidos pelo Express.
      "/admin/report-service": { target: "http://localhost:3000", changeOrigin: true },
      "/service-report": { target: "http://localhost:3000", changeOrigin: true },
      "/docs": { target: "http://localhost:3000", changeOrigin: true }
    }
  }
});
