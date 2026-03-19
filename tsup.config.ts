import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  banner: ({ format }) => {
    if (format === "esm") {
      return { js: "" };
    }
    return {};
  },
});
