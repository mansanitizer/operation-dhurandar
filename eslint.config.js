import globals from "globals";

export default [
  {
    ignores: ["cdn-assets/**", "public/**", "dist/**", "node_modules/**", "convex/_generated/**"],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", caughtErrors: "none", ignoreRestSiblings: true },
      ],
      "no-undef": "error",
      "no-const-assign": "error",
      "no-var": "error",
      eqeqeq: ["warn", "smart"],
    },
  },
  {
    files: ["convex/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        crypto: "readonly",
      },
    },
  },
];
