module.exports = {
  env: {
    es6: true,
    node: true,
    commonjs: true,
  },
  globals: {
    process: "readonly",
    exports: "readonly",
    require: "readonly",
  },
  parserOptions: {
    ecmaVersion: "latest",
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  rules: {
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
    "quotes": ["error", "double", {"allowTemplateLiterals": true}],
  },
  overrides: [
    {
      files: ["**/*.spec.*"],
      env: {
        mocha: true,
      },
      rules: {},
    },
  ],
};
