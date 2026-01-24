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
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "react/no-unescaped-entities": "error",
      // Disable React Compiler/hooks strict rules for existing codebase
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "error", 
      "react-hooks/use-memo": "error",
      "react-compiler/react-compiler": "off",
      // Additional rules for better code quality
      "prefer-const": "error",
      "@typescript-eslint/no-inferrable-types": "warn",
      "react/jsx-key": "error",
      "@typescript-eslint/explicit-function-return-type": ["off", { allowExpressions: true }],
      "@typescript-eslint/no-magic-numbers": ["off", { ignore: [0, 1, -1] }],
      "react/jsx-no-duplicate-props": "warn",
      "react/jsx-no-undef": "warn",
    },
  },
  // Disable any for test/mocks files
  {
    files: ["src/mocks/**", "**/*.test.ts", "**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);

export default eslintConfig;
