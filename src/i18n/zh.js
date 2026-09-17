/**
 * 界面文案（简体中文）。
 *
 * 两条约定，改的时候别破坏：
 *
 * 1. **state 里存的是这里的 key，不是成品句子。**（例如 notice.status 存 'switched'，
 *    而不是「已识别为 Python」）。否则用户一切换界面语言，已经渲染出来的旧语言文案
 *    不会跟着变，界面上就会出现中英混排。
 * 2. **带 `{xxx}` 的是参数占位符**，由 i18n/index.js 的 translate() 替换。
 *    需要拼装的地方一律走占位符，不要把句子在业务代码里拼好再传进来——
 *    中文和英文的语序不同，拼好的句子翻不了。
 *
 * 用具名 const 再导出，而不是直接 export default {…}：后者会触发
 * import/no-anonymous-default-export 警告（本项目要求构建零警告）。
 */
const zh = {
  // ── 品牌与页头 ──────────────────────────────────────────
  tagline: '贴进来，一次看清',
  uiLangLabel: '界面语言',
  newPage: '新页面',
  newPageTitle: '把当前内容存入历史记录，然后开始新的一页',

  // ── 工具栏 ─────────────────────────────────────────────
  format: '格式化',
  formatTitle: '用 {formatter} 格式化{language}（有选中内容时只格式化选区）',
  formatDisabled: '{language} 暂不支持格式化',
  unescape: '去除转义',
  unescapeTitle: '移除一层转义字符（有选中内容时只处理选区）',
  compress: '压缩',
  compressTitle: '压缩为单行 JSON（有选中内容时只压缩选区）',
  compressDisabled: '压缩只对 JSON 有效',
  autoDetect: '自动检测',
  autoDetectTitle: '粘贴时自动识别语言并切换',
  autoDetectPaused: '已暂停',

  // ── 底部状态栏 ──────────────────────────────────────────
  ready: '就绪',
  working: '处理中…',
  detecting: '识别中…',
  formatting: '格式化中…',
  statusError: '错误',
  lineCol: '行 {line}, 列 {col}',
  sizeLabel: '大小',
  formatterLabel: '格式化器',
  pickLanguage: '选择语言',
  groupCore: '常用',
  groupExtra: '自动识别可切换',
  draftRestored: '已恢复上次未保存的内容',

  // ── 历史面板 ────────────────────────────────────────────
  history: '历史记录',
  historyEmpty: '还没有记录',
  clear: '清空',
  collapseHistory: '收起历史记录',
  expandHistory: '展开历史记录',
  deleteItem: '删除这条记录',
  loadHistory: '打开这条记录（会覆盖当前内容）',
  clearConfirm: '清空 {count} 条历史记录？此操作不可撤销。',
  clearConfirmRecent: '其中 {count} 条是最近 10 分钟内的',
  overwriteConfirm: '加载历史记录会覆盖当前编辑器里的内容。',

  // ── 历史条目的相对时间 ──────────────────────────────────
  timeJustNow: '刚刚',
  timeMinutes: '{count} 分钟前',
  timeHours: '{count} 小时前',
  timeYesterday: '昨天',
  timeDays: '{count} 天前',

  // ── 空状态 ─────────────────────────────────────────────
  emptyTitle: '把内容粘进来就行',
  emptyHintSuffix: '语言会自动认出来',
  sampleJson: '试试 JSON 示例',
  sampleLog: '试试日志示例',
  sampleConfig: '试试配置示例',

  // ── 提示、错误与确认 ────────────────────────────────────
  dismiss: '知道了',
  cancel: '取消',
  confirm: '确定',
  continueLabel: '继续',
  errFormatFailed: '格式化失败：{msg}',
  errInvalidJson: 'JSON 无效：{msg}',
  errUnescapeFailed: '转义处理失败：{msg}',
  atLineCol: '位置：第 {line} 行第 {column} 列',
  contentKept: '原文未做修改',
  largeContent: '内容较大（{size}），识别与格式化可能需要几秒',
  largeContentWhy: '识别只在粘贴时运行一次',
  historyTrimmed: '历史记录超出容量，最早的 {count} 条已自动移除',
  historySaveFallback: '存储空间不足，历史记录只保留了最近 {count} 条',
  historySaveFailed: '历史记录保存失败：浏览器存储已满，最新内容可能没有存下',
  historyLoadFailed: '历史记录读取失败，已从空列表开始',

  // ── 语言自动识别的结果 ──────────────────────────────────
  // 检测层只回传参数（label / msg），句子在这里组装
  detectSwitched: '已识别为 {label}',
  detectSame: '内容确认为 {label}',
  detectUnknown: '未能识别出语言，保持当前选择',
  detectUnsupported: '识别为 {label}，暂无对应高亮，已按纯文本显示',
  detectError: '语言识别失败：{msg}',
  detectManual: '已手动指定语言，自动识别已暂停',

  // ── 格式化器名称 ────────────────────────────────────────
  // 其余几个（clang-format / Ruff / gofmt）是专有名词，中英一致，不必进词典
  formatterMonaco: 'Monaco 内置',
};

export default zh;
