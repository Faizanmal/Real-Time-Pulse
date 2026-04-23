import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import complexityPlugin from "eslint-plugin-complexity";
import importPlugin from "eslint-plugin-import";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import securityPlugin from "eslint-plugin-security";
import sonarjsPlugin from "eslint-plugin-sonarjs";

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
    plugins: {
      import: importPlugin,
      security: securityPlugin,
      complexity: complexityPlugin,
      sonarjs: sonarjsPlugin,
    },
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

      // Import rules for better organization
      "import/order": ["error", {
        groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
        "newlines-between": "always",
        alphabetize: { order: "asc", caseInsensitive: true }
      }],
      "import/no-unresolved": "error",
      "import/no-cycle": "error",
      "import/no-unused-modules": "warn",

      // Accessibility rules (using traditional plugin syntax)
      "max-lines-per-function": ["warn", 50],
      "max-params": ["warn", 4],

      // SonarJS rules for code quality
      "sonarjs/no-duplicate-string": "warn",
      "sonarjs/no-identical-functions": "warn",
      "sonarjs/cognitive-complexity": ["warn", 15],
      "sonarjs/no-collapsible-if": "warn",
      "sonarjs/no-redundant-jump": "warn",
      "sonarjs/prefer-immediate-return": "warn",

      // Additional React rules
      "react/prop-types": "off", // Using TypeScript for prop validation
      "react/jsx-uses-react": "off", // Not needed in React 17+
      "react/react-in-jsx-scope": "off", // Not needed in React 17+
      "react/jsx-props-no-spreading": "warn",
      "react/self-closing-comp": "warn",
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
