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
        loader: 'ts-loader',
        exclude: /node_modules/,
        options: {
          transpileOnly: true   // 关键的一行，跳过类型检查
        }
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