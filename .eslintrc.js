module.exports = {
  env: {
    node: true,
    commonjs: true,
    es6: true, // Enable ES6 features like let, const, and arrow functions
    jest: true, // If you are using Jest for testing
  },
  extends: [
    "airbnb-base", // Use airbnb-base for Node.js projects (without React)
    "prettier"
  ],
  plugins: [
    "import",
    "prettier" // Ensure Prettier works smoothly with Airbnb
  ],
  rules: {
    "import/no-extraneous-dependencies": ["error", {
      "devDependencies": [
        "**/test/**/*.js",
        "**/*.test.js",
        "**/*.spec.js"
      ]
    }],
    "prettier/prettier": "error", // Ensures Prettier formatting is enforced
    "no-console": "off", // Optionally allow console statements in Node.js
  },
};
