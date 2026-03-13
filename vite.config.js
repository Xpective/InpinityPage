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
        index: path.resolve(__dirname, "index.html"),
        features: path.resolve(__dirname, "features.html"),
        game: path.resolve(__dirname, "game.html"),
        mint: path.resolve(__dirname, "mint.html"),
        map: path.resolve(__dirname, "map.html"),
        collaboration: path.resolve(__dirname, "collaboration.html"),
        about: path.resolve(__dirname, "about.html"),
        whitepaper: path.resolve(__dirname, "whitepaper.html"),
        faq: path.resolve(__dirname, "faq.html"),
        guestbook: path.resolve(__dirname, "guestbook.html"),
        advertising: path.resolve(__dirname, "advertising.html"),
        staking: path.resolve(__dirname, "staking.html"),
        contact: path.resolve(__dirname, "contact.html"),
        privacypolicy: path.resolve(__dirname, "privacypolicy.html"),
        termsofuse: path.resolve(__dirname, "termsofuse.html")
      }
    }
  }
});
