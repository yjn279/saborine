import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.expo/**",
      "**/.wrangler/**",
      "**/web-build/**",
      "**/*.config.js",
      "**/*.config.mjs",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/scripts/**/*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // PWAのService Worker。ブラウザのSWランタイムでだけ動くため、専用のグローバルを与える。
    files: ["app/public/sw.js"],
    languageOptions: {
      globals: globals.serviceworker,
    },
  },
);
