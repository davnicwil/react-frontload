module.exports = (env) => ({
  node: { __dirname: false },
  mode: 'development',
  target: env === 'client' ? 'web' : 'node',
  devtool: 'source-map',
  entry: [`${__dirname}/../${env}.js`],
  output: {
    path: `${__dirname}/../build/`,
    filename: `${env}.bundle.js`
  },
  module: {
    rules: [{
      test: /\.js$/,
      exclude: /node_modules/,
      loaders: [{ loader: 'babel-loader', options: { babelrc: true } }]
    }]
  }
})
