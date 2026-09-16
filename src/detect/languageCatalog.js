/**
 * 语言目录：把检测模型的输出 id 映射到 Monaco 的语言 id，并提供下拉框的语言清单。
 *
 * 检测模型（@vscode/vscode-languagedetection，即 VS Code 自己用的 guesslang 模型）
 * 输出 54 个短 id（js / ts / cs / py / rb ...），与 Monaco 的语言 id 不是一套命名，
 * 因此必须经过这里的映射表转换，不能直接把模型输出塞给编辑器。
 *
 * 映射为 null 的表示「模型能识别，但 Monaco 没有对应语言、无法高亮」。
 *
 * 语言清单本身放在 languages.json —— 因为 craco.config.js（Node 侧，负责告诉
 * MonacoWebpackPlugin 要打包哪些语言）无法 import 本模块，但可以 require JSON。
 * 共用一份数据，才不会出现「新增了语言但忘了在 craco 里注册、结果没有高亮」。
 */
import languages from './languages.json';

/** 模型输出 id → Monaco 语言 id；null 表示 Monaco 无此语言 */
export const MODEL_LANGUAGE_MAP = {
  asm: null,
  bat: 'bat',
  c: 'c',
  clj: 'clojure',
  cmake: null,
  cbl: null,
  coffee: 'coffee',
  cs: 'csharp',
  cpp: 'cpp',
  css: 'css',
  csv: null,
  dart: 'dart',
  dm: null,
  dockerfile: 'dockerfile',
  ex: 'elixir',
  erl: null,
  f90: null,
  go: 'go',
  groovy: null,
  hs: null,
  html: 'html',
  ini: 'ini',
  java: 'java',
  jl: 'julia',
  js: 'javascript',
  json: 'json',
  kt: 'kotlin',
  lisp: null,
  lua: 'lua',
  makefile: null,
  matlab: null,
  md: 'markdown',
  ml: null,
  mm: 'objective-c',
  pas: 'pascal',
  pm: 'perl',
  php: 'php',
  prolog: null,
  ps1: 'powershell',
  py: 'python',
  r: 'r',
  rb: 'ruby',
  rs: 'rust',
  scala: 'scala',
  sh: 'shell',
  sql: 'sql',
  swift: 'swift',
  tex: null,
  toml: null,
  ts: 'typescript',
  v: null,
  vba: 'vb',
  xml: 'xml',
  yaml: 'yaml',
};

/** 模型输出 id → 展示名（含 Monaco 不支持的那些，用于给出诚实的提示） */
export const MODEL_LANGUAGE_LABELS = {
  asm: 'Assembly',
  bat: 'Batch',
  c: 'C',
  clj: 'Clojure',
  cmake: 'CMake',
  cbl: 'COBOL',
  coffee: 'CoffeeScript',
  cs: 'C#',
  cpp: 'C++',
  css: 'CSS',
  csv: 'CSV',
  dart: 'Dart',
  dm: 'DM',
  dockerfile: 'Dockerfile',
  ex: 'Elixir',
  erl: 'Erlang',
  f90: 'Fortran',
  go: 'Go',
  groovy: 'Groovy',
  hs: 'Haskell',
  html: 'HTML',
  ini: 'INI',
  java: 'Java',
  jl: 'Julia',
  js: 'JavaScript',
  json: 'JSON',
  kt: 'Kotlin',
  lisp: 'Lisp',
  lua: 'Lua',
  makefile: 'Makefile',
  matlab: 'MATLAB',
  md: 'Markdown',
  ml: 'OCaml',
  mm: 'Objective-C',
  pas: 'Pascal',
  pm: 'Perl',
  php: 'PHP',
  prolog: 'Prolog',
  ps1: 'PowerShell',
  py: 'Python',
  r: 'R',
  rb: 'Ruby',
  rs: 'Rust',
  scala: 'Scala',
  sh: 'Shell',
  sql: 'SQL',
  swift: 'Swift',
  tex: 'LaTeX',
  toml: 'TOML',
  ts: 'TypeScript',
  v: 'V',
  vba: 'VBA',
  xml: 'XML',
  yaml: 'YAML',
};

/** 原本就支持、且有格式化器的语言 */
export const CORE_LANGUAGES = languages.core;

/**
 * 因自动识别而新增的语言：检测模型能识别，且 Monaco 有对应语法高亮。
 * 这些语言没有格式化器，「格式化」按钮会置灰，但粘贴过去能正确上色。
 */
export const EXTRA_LANGUAGES = languages.extra;

// Monaco 语言 id → 展示名，用于把检测结果翻译成界面文案
const LABEL_BY_MONACO_ID = new Map(
  [...CORE_LANGUAGES, ...EXTRA_LANGUAGES].map(({ value, label }) => [value, label])
);

/** 取 Monaco 语言 id 的展示名 */
export function getLanguageLabel(languageId) {
  return LABEL_BY_MONACO_ID.get(languageId) || languageId;
}
