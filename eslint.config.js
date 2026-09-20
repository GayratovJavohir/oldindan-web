import js from "@eslint/js";
import globals from "globals";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";

export default defineConfig([
  // FIX: global ignores MUST be a config object that contains ONLY `ignores`.
  // Previously `ignores` was mixed with `rules`, so it was treated as a
  // per-config filter and the minified `dist/` bundle was linted
  // (300+ bogus errors).
  {
    ignores: ["dist/**", "build/**", "coverage/**", "node_modules/**"],
  },

  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  },

  // Vite/ESLint config files run in Node, not the browser.
  {
    files: ["*.config.js", "vite.config.js", "eslint.config.js", "scripts/**/*.js"],
    languageOptions: { globals: globals.node },
  },

  pluginReact.configs.flat.recommended,

  {
    files: ["**/*.{js,jsx}"],
    // FIX: the codebase uses `// eslint-disable-next-line react-hooks/exhaustive-deps`
    // in several files, but the plugin defining that rule was never installed,
    // which turned every one of those comments into an error.
    plugins: { "react-hooks": pluginReactHooks },
    settings: { react: { version: "detect" } },
    rules: {
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
]);
