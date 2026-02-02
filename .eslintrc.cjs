module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    "eslint:recommended",
    "plugin:import/recommended",
    "prettier"
  ],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  settings: {
    "import/resolver": {
      node: {
        extensions: [".js", ".mjs"]
      }
    }
  },
  rules: {
    "import/order": [
      "warn",
      {
        groups: ["builtin", "external", "internal", "parent", "sibling", "index", "object", "type"],
        "newlines-between": "always",
        alphabetize: { order: "asc", caseInsensitive: true }
      }
    ],
    "no-unused-vars": [
      "warn",
      { args: "after-used", argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
    ]
  },
  overrides: [
    {
      files: ["**/*.test.js", "**/*.spec.js", "tests/**/*.{js,mjs}", "**/__tests__/**/*.{js,mjs}"],
      env: { node: true },
      globals: {
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        vi: "readonly"
      }
    },
    {
      files: ["Reliquary/reliquary.js"],
      rules: {
        "no-unused-vars": "off",
        "import/order": "off"
      }
    }
  ],
  ignorePatterns: [
    "dist/",
    "Downloads/",
    "downloads/",
    "Assets/",
    "Data/",
    "node_modules/",
    "package-lock.json"
  ]
};
