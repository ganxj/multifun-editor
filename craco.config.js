const webpack = require('webpack');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const languages = require('./src/detect/languages.json');

// 语言清单的唯一来源是 src/detect/languages.json，与 App.js 的下拉框共用同一份数据。
// 之前这份清单要在 App.js 和这里手工同步，漏改就会出现「语言能选但没高亮」的静默问题。
const monacoLanguages = [...languages.core, ...languages.extra]
  .filter((item) => item.monaco)
  .map((item) => item.value);

// 语言检测包（@vscode/vscode-languagedetection）内打包了 tfjs，其中 Node 专用的 io 代码
// 静态引用了下面这些模块。浏览器里不存在、构建时也解析不到，必须显式指向空模块。
// 我们给模型注入了自己的加载器，这些代码路径永远不会被执行到。
const NODE_ONLY_MODULES = [
  'fs',
  'path',
  'crypto',
  'http',
  'https',
  'stream',
  'url',
  'util',
  'zlib',
  'punycode',
  'encoding',
];

// 检测包的 UMD 产物里保留了 Node 环境的 chunk 加载回退分支：
//   r.f.require = (chunkId) => { ... require("./" + r.u(chunkId)) ... }
// webpack 看见 `require("./" + 表达式)` 就会把它编译成一个覆盖 dist/lib/ 整个目录的
// context module。于是同目录下的 index.d.ts 也被当作模块引入，而 .d.ts 不匹配任何
// loader 规则、回落到 javascript/auto 被当 JS 解析，直接失败：
//   Module parse failed: Unexpected token (1:7)  export interface ModelResult {
// 所以要把同目录下的非 JS 文件（.d.ts、*.LICENSE.txt、.map）从该 context 里摘掉。
// 同目录的 .js 必须保留：模型跑在 CPU backend 上，而 MathBackendCPU 只存在于
// 979.js 这个异步 chunk 中，正是靠上面的分支在运行时注册进来的。
const DETECT_PKG_DIR = /@vscode[\\/]vscode-languagedetection[\\/]dist[\\/]lib$/;
const DETECT_PKG = /@vscode[\\/]vscode-languagedetection/;

module.exports = {
  webpack: {
    plugins: [
      new MonacoWebpackPlugin({
        languages: monacoLanguages,
      }),
      new webpack.IgnorePlugin({
        resourceRegExp: /\.(d\.ts|txt|map)$/i,
        contextRegExp: DETECT_PKG_DIR,
      }),
    ],
    configure: (webpackConfig) => {
      // 格式化器（@wasm-fmt/*）以 WebAssembly 形式发布，webpack 5 需要显式开启异步 WASM
      webpackConfig.experiments = {
        ...webpackConfig.experiments,
        asyncWebAssembly: true,
      };

      // 各语言的 wasm 是懒加载的，单个 chunk 体积天然偏大，关掉体积提示避免噪音
      webpackConfig.performance = { hints: false };

      webpackConfig.resolve = {
        ...webpackConfig.resolve,
        fallback: {
          ...(webpackConfig.resolve && webpackConfig.resolve.fallback),
          ...Object.fromEntries(NODE_ONLY_MODULES.map((name) => [name, false])),
        },
      };

      // 该包产物尾部带 sourceMappingURL 注释，却没有随包发布 .map 文件，
      // source-map-loader 会为此刷两条 WARNING，且我们无从修复。这些 map 用不上，
      // 直接在 source-map-loader 的 exclude 里加上该包，保持构建输出干净。
      webpackConfig.module.rules.forEach((rule) => {
        const useList = Array.isArray(rule.use) ? rule.use : [rule.use];
        const loaders = [rule.loader]
          .concat(useList.map((item) => (typeof item === 'string' ? item : item && item.loader)))
          .filter((loader) => typeof loader === 'string');

        if (!loaders.some((loader) => loader.includes('source-map-loader'))) return;

        const existing = [].concat(rule.exclude || []).filter(Boolean);
        rule.exclude = [...existing, DETECT_PKG];
      });

      return webpackConfig;
    }
  }
};
