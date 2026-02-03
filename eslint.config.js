import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
      "@typescript-eslint/no-import-type-side-effects": "error",
      // Allow numbers in template literals - very common and safe
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
      ],
      // Allow non-null assertions - sometimes necessary with confident knowledge
      "@typescript-eslint/no-non-null-assertion": "off",
      // Require await can be too strict for methods that may need async signature
      "@typescript-eslint/require-await": "off",
      // Allow || for boolean expressions where nullish coalescing isn't appropriate
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      // Allow index signatures where appropriate
      "@typescript-eslint/consistent-indexed-object-style": "off",
      // Allow void in union types for event handlers
      "@typescript-eslint/no-invalid-void-type": "off",
      // Allow empty interfaces for extension points
      "@typescript-eslint/no-empty-object-type": "off",
      // Allow deprecated APIs during migration
      "@typescript-eslint/no-deprecated": "warn",
      // Allow necessary type assertions
      "@typescript-eslint/no-unnecessary-condition": "off",
      // Allow unsafe catch variables in some cases
      "@typescript-eslint/use-unknown-in-catch-callback-variable": "off",
    },
  },
  // Disable type-checked rules for test files (they're excluded from tsconfig)
  {
    files: ["**/*.test.ts", "**/*.spec.ts"],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      // Allow empty functions in test mocks
      "@typescript-eslint/no-empty-function": "off",
    },
  },
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/*.config.js",
      "**/*.config.ts",
      "**/*.js",
      "coverage/**",
    ],
  }
);
