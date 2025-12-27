import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/**",
  ]),
  {
    rules: {
      // Relax strict rules for production codebase
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "react/no-unescaped-entities": "off",
      // Disable React Compiler/hooks strict rules for existing codebase
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off", 
      "react-hooks/use-memo": "off",
      "react-compiler/react-compiler": "off",
    },
  },
  // Disable React Compiler plugin errors entirely
  {
    files: ["**/*.tsx", "**/*.ts"],
    rules: {
      "react-compiler/react-compiler": "off",
    },
  },
]);

export default eslintConfig;
