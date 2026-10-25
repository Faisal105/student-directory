import js from "@eslint/js";
import globals from "globals";
export default [
  {
    ignores: [
      "node_modules/**",
      "client/dist/**",
      "tmp/**",
      "test-results/**",
      "playwright-report/**",
      "client/src/**",
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
    rules: { "no-unused-vars": ["error", { argsIgnorePattern: "^_" }] },
  },
];
