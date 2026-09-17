/**
 * Interface copy (English).
 *
 * Keys must stay exactly in sync with zh.js — a missing key falls back to the
 * Chinese string (see i18n/index.js), which is visible on purpose: a silent
 * fallback is how half-translated UIs happen.
 *
 * Named const + default export, not `export default {…}` — the latter trips
 * import/no-anonymous-default-export, and this project builds with zero warnings.
 */
const en = {
  // ── Brand & header ──────────────────────────────────────
  tagline: 'Paste it. See it clearly.',
  uiLangLabel: 'Interface language',
  newPage: 'New page',
  newPageTitle: 'Save the current content to history, then start a new page',

  // ── Toolbar ─────────────────────────────────────────────
  format: 'Format',
  formatTitle: 'Format {language} with {formatter} (selection only, if any)',
  formatDisabled: 'Formatting is not supported for {language}',
  unescape: 'Unescape',
  unescapeTitle: 'Remove one level of escape characters (selection only, if any)',
  compress: 'Compress',
  compressTitle: 'Compress into single-line JSON (selection only, if any)',
  compressDisabled: 'Compress only applies to JSON',
  autoDetect: 'Auto detect',
  autoDetectTitle: 'Detect the language and switch automatically when pasting',
  autoDetectPaused: 'paused',

  // ── Status bar ──────────────────────────────────────────
  ready: 'Ready',
  working: 'Working…',
  detecting: 'Detecting…',
  formatting: 'Formatting…',
  statusError: 'Error',
  lineCol: 'Ln {line}, Col {col}',
  sizeLabel: 'Size',
  formatterLabel: 'Formatter',
  pickLanguage: 'Select language',
  groupCore: 'Common',
  groupExtra: 'Auto-detectable',
  draftRestored: 'Restored content that had not been saved',

  // ── History panel ───────────────────────────────────────
  history: 'History',
  historyEmpty: 'Nothing here yet',
  clear: 'Clear',
  collapseHistory: 'Collapse history',
  expandHistory: 'Expand history',
  deleteItem: 'Delete this item',
  loadHistory: 'Open this item (overwrites the current content)',
  clearConfirm: 'Clear {count} history items? This cannot be undone.',
  clearConfirmRecent: '{count} of them are from the last 10 minutes',
  overwriteConfirm: 'Loading a history item will overwrite the current content.',

  // ── Relative time for history items ─────────────────────
  timeJustNow: 'just now',
  timeMinutes: '{count} min ago',
  timeHours: '{count} hr ago',
  timeYesterday: 'Yesterday',
  timeDays: '{count} d ago',

  // ── Empty state ─────────────────────────────────────────
  emptyTitle: 'Just paste your content',
  emptyHintSuffix: 'the language is detected for you',
  sampleJson: 'Try a JSON sample',
  sampleLog: 'Try a log sample',
  sampleConfig: 'Try a config sample',

  // ── Notices, errors, confirmations ──────────────────────
  dismiss: 'Got it',
  cancel: 'Cancel',
  confirm: 'Confirm',
  continueLabel: 'Continue',
  errFormatFailed: 'Format failed: {msg}',
  errInvalidJson: 'Invalid JSON: {msg}',
  errUnescapeFailed: 'Unescape failed: {msg}',
  atLineCol: 'Position: line {line}, column {column}',
  contentKept: 'your content was left unchanged',
  largeContent: 'Large content ({size}) — detection and formatting may take a few seconds',
  largeContentWhy: 'detection runs once, on paste',
  historyTrimmed: 'History exceeded its limit — the {count} oldest items were removed',
  historySaveFallback: 'Storage is nearly full — only the {count} most recent items were kept',
  historySaveFailed: 'Could not save history: browser storage is full, recent items may be lost',
  historyLoadFailed: 'Could not read history — starting from an empty list',

  // ── Automatic language detection results ────────────────
  detectSwitched: 'Detected as {label}',
  detectSame: 'Confirmed as {label}',
  detectUnknown: 'Could not detect the language — keeping the current selection',
  detectUnsupported: 'Detected {label} — no highlighting available, switched to plain text',
  detectError: 'Language detection failed: {msg}',
  detectManual: 'Language set manually — auto detect is paused',

  // ── Formatter names ─────────────────────────────────────
  formatterMonaco: 'Monaco built-in',
};

export default en;
