/**
 * 各语言的 WASM 格式化器定义。
 *
 * 统一使用各包的 `./web` 入口：该入口内部用 `new URL(..., import.meta.url)` 引用 .wasm，
 * 打包器会把它作为独立资源文件输出、按需加载，因此不会增加首屏体积。
 * 代价是调用 format() 之前必须先 await 一次 init()，所以这里统一封装成
 * 「异步加载 → 返回同步格式化函数」的形式。
 */

// clang-format 靠文件名推断语言，因此每种语言需要各自的占位文件名；
// style 取自 clang-format 内置风格（LLVM/Google/Chromium/Mozilla/WebKit/Microsoft/GNU）
const CLANG_FORMAT_PROFILES = {
  c: { filename: 'main.c', style: 'Google' },
  cpp: { filename: 'main.cpp', style: 'Google' },
  csharp: { filename: 'main.cs', style: 'Microsoft' },
  java: { filename: 'main.java', style: 'Google' },
};

// 同一个 wasm 模块只初始化一次，并发调用共享同一个 Promise
let clangFormatModulePromise = null;
let ruffModulePromise = null;
let gofmtModulePromise = null;

function loadClangFormatModule() {
  if (!clangFormatModulePromise) {
    clangFormatModulePromise = import('@wasm-fmt/clang-format/web').then(async (mod) => {
      await mod.default();
      return mod;
    });
  }
  return clangFormatModulePromise;
}

function loadRuffModule() {
  if (!ruffModulePromise) {
    ruffModulePromise = import('@wasm-fmt/ruff_fmt/web').then(async (mod) => {
      await mod.default();
      return mod;
    });
  }
  return ruffModulePromise;
}

function loadGofmtModule() {
  if (!gofmtModulePromise) {
    gofmtModulePromise = import('@wasm-fmt/gofmt/web').then(async (mod) => {
      await mod.default();
      return mod;
    });
  }
  return gofmtModulePromise;
}

// 返回「异步加载 → 同步格式化函数」的加载器。
// 注意：这里直接返回 async 函数本体，调用方 load() 时才会真正开始加载
function createClangFormatLoader(language) {
  const { filename, style } = CLANG_FORMAT_PROFILES[language];
  return async () => {
    const mod = await loadClangFormatModule();
    return (code) => mod.format(code, filename, style);
  };
}

async function createRuffFormatter() {
  const mod = await loadRuffModule();
  // 与 Ruff / Black 默认一致的 88 列、4 空格缩进
  const config = { line_width: 88, indent_width: 4 };
  return (code) => mod.format(code, 'main.py', config);
}

async function createGofmtFormatter() {
  const mod = await loadGofmtModule();
  return (code) => mod.format(code);
}

// language 使用 Monaco 的语言 id。
// load 是「无参调用后返回 Promise<格式化函数>」的加载器
export const TEXT_FORMATTERS = {
  c: { label: 'clang-format', load: createClangFormatLoader('c') },
  cpp: { label: 'clang-format', load: createClangFormatLoader('cpp') },
  csharp: { label: 'clang-format', load: createClangFormatLoader('csharp') },
  java: { label: 'clang-format', load: createClangFormatLoader('java') },
  python: { label: 'Ruff', load: createRuffFormatter },
  go: { label: 'gofmt', load: createGofmtFormatter },
};

const formatterCache = new Map();

/**
 * 取回某语言的同步格式化函数（首次调用会懒加载对应的 wasm）。
 * @returns {Promise<((code: string) => string) | null>}
 */
export function loadTextFormatter(language) {
  const entry = TEXT_FORMATTERS[language];
  if (!entry) return Promise.resolve(null);

  if (!formatterCache.has(language)) {
    formatterCache.set(language, entry.load());
  }

  return formatterCache.get(language);
}
