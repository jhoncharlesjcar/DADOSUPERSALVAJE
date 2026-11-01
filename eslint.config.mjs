import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".tools/**", // Downloaded runtimes and generated local verification artifacts.
  ]),
  // Game components use <img> for animated dice/mascots/effects with dynamic
  // CSS transforms, drop-shadows, and unknown dimensions that next/image can't handle.
  {
    files: ["app/_components/**/*.tsx"],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
