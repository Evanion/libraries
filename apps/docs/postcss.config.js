// CommonJS, and named .js rather than .mjs: postcss-load-config resolves this
// file for `next build`, and the app's package.json does not set
// "type": "module", so `.js` is CommonJS here.
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
};
