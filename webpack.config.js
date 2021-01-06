//const webpack = require('webpack');
const path = require('path');

module.exports = {
  entry: {
    "infernal-engine": "./lib/index.js",
  },
  mode: "production",
  //mode: "development",
  devtool: "source-map",
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: "[name].js",
    libraryTarget: "umd",
    library: "InfernalEngine"
  }
};