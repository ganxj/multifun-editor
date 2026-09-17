/**
 * 空状态里的示例内容。
 *
 * 三个示例刻意各走一条不同的识别路径，点一下就能把「粘贴自动识别」这个核心能力演示完整，
 * 而不是放三段 JSON 白占位置：
 *
 *   json   → 结构化规则命中（瞬时、确定性），同时因为没缩进，点「格式化」立刻有东西可看
 *   log    → 规则层认领为 Log，但 Monaco 没有日志语言，所以 language 为 null：
 *            演示的是「认出来但编辑器不支持 → 如实提示、不硬切一个错的语言」这条诚实行为
 *            （以前日志会落到 ML 模型手里、被判成 INI，见 rules.js 的 ruleLog 注释）
 *   config → INI 配置，是规则层里最容易和 TOML 混淆的一类
 *            （`port = 8080` 这种裸数字不算 TOML 特征，算进去会让最常见的 INI 被判成 TOML）
 *
 * labelKey 指向 i18n 词典，不要在这里写死中文按钮文案。
 */
export const SAMPLES = [
  {
    id: 'json',
    labelKey: 'sampleJson',
    content:
      '{"transaction_id":"tx_8f9c1d8e3d","status":"COMPLETED","amount":128.5,"currency":"USD","items":[{"sku":"A-1024","qty":2},{"sku":"B-2048","qty":1}],"meta":{"client":"peek_web_app","version":"v2.1.0","locale":"zh_CN"},"paid":true}',
  },
  {
    id: 'log',
    labelKey: 'sampleLog',
    content: [
      '2026-09-17 14:32:01.482 INFO  [order-service] received order tx_8f9c1d8e3d',
      '2026-09-17 14:32:01.803 WARN  [inventory] sku A-1024 available=1 requested=2',
      '2026-09-17 14:32:02.115 ERROR [inventory] allocate failed: insufficient stock',
      '2026-09-17 14:32:02.688 INFO  [order-service] order tx_8f9c1d8e3d rolled back',
      '2026-09-17 14:32:03.002 INFO  [scheduler] retry scheduled in 30s',
    ].join('\n'),
  },
  {
    id: 'config',
    labelKey: 'sampleConfig',
    content: [
      '[server]',
      'host = 127.0.0.1',
      'port = 8080',
      'workers = 4',
      '',
      '[database]',
      'url = postgres://localhost:5432/orders',
      'pool_size = 10',
      'timeout_seconds = 30',
    ].join('\n'),
  },
];
