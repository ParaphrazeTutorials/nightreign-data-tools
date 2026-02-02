import { defineConfig } from "rollup";

// Minimal bundler for Reliquary; keeps behavior identical and stays Pages-friendly.
export default defineConfig({
  input: "Reliquary/main.js",
  treeshake: false, // preserve side effects; we want a faithful bundle
  output: {
    dir: "dist",
    entryFileNames: "reliquary.bundle.js",
    format: "es",
    sourcemap: true
  }
});
