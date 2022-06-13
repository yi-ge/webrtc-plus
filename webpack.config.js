const path = require('path');

module.exports = {
  mode: "production",
  entry: {
    'WebRTCPlus': './lib/WebRTCPlus.ts'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', ".tsx", '.js'],
  },
  output: {
    filename: "[name].js",
    libraryTarget: "umd",
    library: "WebRTCPlus",
    umdNamedDefine: true,
    path: path.resolve(__dirname, 'dist'),
    libraryExport: "default",
  },
};