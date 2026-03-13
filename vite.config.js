import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  root: ".",
  base: "./",
  appType: "mpa",
  server: {
    host: true,
    port: 5173,
    strictPort: true
  },
  build: {
    target: "es2020",
    outDir: "dist",
    emptyOutDir: true,
    assetsDir: "assets",
    sourcemap: true,
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, "index.html")
      }
    }
  }
});