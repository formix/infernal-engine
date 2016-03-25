var webpack = require('webpack');

module.exports = {
  entry: {
    "infernal-engine": "./lib/index.js",
    "infernal-engine.min": "./lib/index.js"
  },
  devtool: "source-map",
  output: {
    path: "./dist",
    filename: "[name].js",
    libraryTarget: "umd",
    library: "InfernalEngine"
  },
  plugins: [
    new webpack.optimize.UglifyJsPlugin({
      include: /\.min\.js$/,
      minimize: true
    })
  ]
};