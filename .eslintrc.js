module.exports = {
  env: {
    node: true,
    commonjs: true,
  },
  extends: ["airbnb", "prettier"],
  plugins: [
    "import"
  ],
  rules: {
    "import/no-extraneous-dependencies": ["error", {
      "devDependencies": ["**/test/**/*.js", "**/*.test.js", "**/*.spec.js"]
    }]
  }
};
