const postcssGlobalData = require("@csstools/postcss-global-data");
const postcssCustomMedia = require("postcss-custom-media");

module.exports = {
  plugins: [
    postcssGlobalData({
      files: ["./styles/breakpoints.css"]
    }),
    postcssCustomMedia({ preserve: false })
  ]
};
