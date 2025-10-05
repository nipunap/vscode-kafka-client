const globals = require("globals");
const typescriptEslint = require("@typescript-eslint/eslint-plugin");
const typescriptParser = require("@typescript-eslint/parser");

module.exports = [
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        project: "./tsconfig.json",
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": typescriptEslint,
    },
    rules: {
      ...typescriptEslint.configs.recommended.rules,
      "@typescript-eslint/naming-convention": [
        "warn",
        {
          "selector": "import",
          "format": ["camelCase", "PascalCase"]
        }
      ],
      "curly": "warn",
      "eqeqeq": "warn",
      "no-throw-literal": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "@typescript-eslint/no-require-imports": "off"
    },
  },
  {
    ignores: [
      "out/**",
      "dist/**",
      "**/*.d.ts",
      "node_modules/**",
      ".vscode-test/**",
      "mics/**",
      "scripts/**/*.js"
    ]
  }
];

