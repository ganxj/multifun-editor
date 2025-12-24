const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

module.exports = {
  webpack: {
    plugins: [
      new MonacoWebpackPlugin({
        // 指定要包含的语言
        languages: ['json', 'javascript', 'typescript', 'html', 'css']
      })
    ]
  }
};