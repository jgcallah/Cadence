import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts", "src/index.ts"],
  format: ["esm"],
  dts: false, // Use tsc for declaration files due to composite project
  clean: false, // Don't clean - tsc generates .d.ts files first
  sourcemap: true,
  target: "es2022",
  outDir: "dist",
});
