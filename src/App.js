import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import './App.css';
import { canCompress, canFormat, formatEditorContent, getFormatterLabel } from './format';
import { CORE_LANGUAGES, EXTRA_LANGUAGES, detectLanguage } from './detect';
import { DEFAULT_UI_LANGUAGE, UI_LANGUAGES, translate } from './i18n';
import { SAMPLES } from './samples';

// 改用本地打包的 monaco 实例（默认会从 CDN 拉取），
// 这样内置格式化能力以及离线/内网部署都不再依赖外网
loader.config({ monaco });

// 语言清单来自 src/detect/languages.json —— 同一份数据也被 craco.config.js 读取，
// 用于告诉 MonacoWebpackPlugin 需要打包哪些语言，避免两处清单不同步导致没有语法高亮
const LANGUAGE_OPTIONS = [...CORE_LANGUAGES, ...EXTRA_LANGUAGES];

// ── 本地存储 ────────────────────────────────────────────────────────────
// history 的 key 沿用历史值，**不要改**：key 一换，老用户已有的历史记录就等于丢了。
const STORAGE_KEY_HISTORY = 'jsonEditorHistory';
// 「界面语言」与「内容语言」是两件事，刻意用不同 key。混用一个 key 早晚出 bug。
const STORAGE_KEY_UI_LANG = 'peek.uiLang';
// 当前编辑内容自动落盘，防刷新/误关丢失
const STORAGE_KEY_DRAFT = 'peek.draft';
// 草稿的语言与内容分开存：peek.draft 里是纯文本（那里存的东西不能动），
// 语言是后加的一项，缺了就当没有（老草稿），见 readDraftLanguage
const STORAGE_KEY_DRAFT_LANG = 'peek.draftLang';

// ── 容量与阈值 ──────────────────────────────────────────────────────────
// localStorage 只有约 5MB，写满后 setItem 抛 QuotaExceededError。
// 早先没有任何上限，超了只打 console —— 用户只会发现「历史莫名少了一段」。
const HISTORY_MAX_ITEMS = 30;
const HISTORY_BUDGET_CHARS = 3_500_000;
const DRAFT_DEBOUNCE_MS = 600;
const LARGE_CONTENT_BYTES = 5 * 1024 * 1024;
// 「2 分钟前」这类相对时间必须定时重渲染，否则放着不动就一直显示旧值
const RELATIVE_TIME_TICK_MS = 60 * 1000;

// 「识别出来了，但编辑器没有这门语言的高亮」时的落点（Groovy / TOML / CSV 等）。
// 取值必须与 languages.json 里 Plain Text 那一项一致。
const PLAIN_TEXT_LANGUAGE = 'text';

// 识别结果的状态 → 文案 key + 状态栏配色。
// 注意存的是 status 而不是成品句子：界面语言切换后文案要跟着变。
const DETECT_META = {
  switched: { key: 'detectSwitched', tone: 'ok' },
  same: { key: 'detectSame', tone: 'ok' },
  unknown: { key: 'detectUnknown', tone: 'warn' },
  unsupported: { key: 'detectUnsupported', tone: 'warn' },
  error: { key: 'detectError', tone: 'error' },
  manual: { key: 'detectManual', tone: 'info' },
};

const FALLBACK_MONO_FONT = "'Cascadia Mono', Consolas, 'SF Mono', Menlo, 'Courier New', monospace";

// ── 纯函数工具 ──────────────────────────────────────────────────────────

function toErrorMessage(error) {
  const raw = typeof error === 'string' ? error : (error && error.message) || String(error);
  return raw.length > 500 ? raw.slice(0, 500) + '…' : raw;
}

/** UTF-8 字节数。注意不能用 text.length —— 那是字符数，一个中文占 3 字节，直接用会算错 */
function byteSize(text) {
  if (!text) return 0;
  try {
    return new Blob([text]).size;
  } catch (error) {
    return text.length;
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * 从 JSON.parse 的报错里捞出位置。
 * 新版 V8 直接给「at line X column Y」，老版本只给字符偏移，
 * 后者需要原文才能换算成行列，所以 text 是必需的。
 */
function locateJsonError(message, text) {
  const lineMatch = /line (\d+) column (\d+)/.exec(message);
  if (lineMatch) return { line: Number(lineMatch[1]), column: Number(lineMatch[2]) };

  const positionMatch = /position (\d+)/.exec(message);
  if (!positionMatch || typeof text !== 'string') return null;

  const before = text.slice(0, Number(positionMatch[1]));
  const lines = before.split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function selectJsonError(editor, position, hasSelection, selection) {
  // 有选区时不动光标：用户正在选区里操作，跳走会打断他
  if (hasSelection) return;
  const target = { lineNumber: position.line, column: position.column };
  try {
    editor.setPosition(target);
    editor.revealPositionInCenter(target);
    editor.focus();
  } catch (error) {
    /* 定位失败不影响报错提示，忽略 */
  }
}

function formatRelativeTime(createdAt, now, t) {
  const diff = Math.max(0, now - createdAt);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return t('timeJustNow');
  if (diff < hour) return t('timeMinutes', { count: Math.floor(diff / minute) });
  if (diff < day) return t('timeHours', { count: Math.floor(diff / hour) });
  if (diff < 2 * day) return t('timeYesterday');
  return t('timeDays', { count: Math.floor(diff / day) });
}

function truncateContent(content) {
  const lines = content.split('\n');
  const first = lines[0];
  if (lines.length > 1) {
    return first.substring(0, 50) + (first.length > 50 ? '...' : '') + '...';
  }
  return content.substring(0, 50) + (content.length > 50 ? '...' : '');
}

/** 历史记录裁剪：先按条数、再按体积，返回被丢弃的条数好让界面如实告知 */
function fitHistory(items) {
  let kept = items.slice(0, HISTORY_MAX_ITEMS);
  let dropped = items.length - kept.length;

  while (kept.length > 1 && JSON.stringify(kept).length > HISTORY_BUDGET_CHARS) {
    kept = kept.slice(0, -1);
    dropped += 1;
  }

  return { kept, dropped };
}

// localStorage 在隐私模式/被禁用时读写都会抛，所有访问都要兜住
function readStoredHistory() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      ...item,
      language: item.language || 'json',
      // 老数据没有 createdAt，但 id 本来就是 Date.now()，直接拿它当时间戳，
      // 因此不需要做数据迁移，旧记录也能显示相对时间
      createdAt:
        typeof item.id === 'number' ? item.id : Date.parse(item.timestamp) || Date.now(),
    }));
  } catch (error) {
    return null; // null 表示读失败，与「读到了但是空」区分开
  }
}

function readUiLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_UI_LANG);
    return UI_LANGUAGES.some((item) => item.id === saved) ? saved : DEFAULT_UI_LANGUAGE;
  } catch (error) {
    return DEFAULT_UI_LANGUAGE;
  }
}

function readDraft() {
  try {
    return localStorage.getItem(STORAGE_KEY_DRAFT) || '';
  } catch (error) {
    return '';
  }
}

/**
 * 读草稿的语言。
 *
 * 为什么语言要跟草稿一起存：语言原先只是 state 的初始值（json），刷新后草稿回来了、
 * 语言却没回来 —— 一段 Markdown 会被拿 JSON 的配色渲染（配色是错的，比没有高亮
 * 更容易看错）。语言是内容的一个属性，由「粘贴时识别」和「手动指定」两处产生，
 * 都该跟内容一起落盘（历史记录一直就是这么存的：{content, language}）。
 *
 * 只认清单里存在的语言 id：清单里删掉的语言、被改坏的存储值，一律当作没存过，
 * 由调用方回落到默认值 / 补算，而不是把非法 id 塞给 Monaco。
 *
 * @returns {string|null} null 表示没存过或值无效
 */
function readDraftLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_DRAFT_LANG);
    return LANGUAGE_OPTIONS.some((option) => option.value === saved) ? saved : null;
  } catch (error) {
    return null;
  }
}

function readMonacoFontFamily() {
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--font-mono');
    return value && value.trim() ? value.trim() : FALLBACK_MONO_FONT;
  } catch (error) {
    return FALLBACK_MONO_FONT;
  }
}

// ── 图标（内联 SVG，不引图标库：本项目零图标依赖）───────────────────────

function Icon({ path }) {
  return (
    <svg
      className="btn-icon-svg"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

const ICON = {
  lines: 'M3 4h10M3 8h10M3 12h6',
  unescape: 'M5 3L3 12M9 3L7 12M3 13L13 3',
  compress: 'M2 8h5M4 5l2 3-2 3M14 8h-5M12 5l-2 3 2 3',
  plus: 'M8 3v10M3 8h10',
  trash: 'M4 5h8M6 5V3h4v2M5.2 5l.6 8h4.4l.6-8',
};

function App() {
  const [code, setCode] = useState(readDraft);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(true);
  const [language, setLanguage] = useState(() => readDraftLanguage() || 'json');
  const [formatting, setFormatting] = useState(false);
  const [autoDetect, setAutoDetect] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [notice, setNotice] = useState(null); // 最近一次识别结果（状态栏提示）
  const [alert, setAlert] = useState(null); // 错误 / 长内容 / 二次确认，共用一条槽位
  const [cursor, setCursor] = useState({ lineNumber: 1, column: 1 });
  const [uiLang, setUiLang] = useState(readUiLang);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [historyNotice, setHistoryNotice] = useState(null);
  const [draftRestored, setDraftRestored] = useState(() => Boolean(readDraft().trim()));
  /**
   * 「这份草稿没存过语言」——只可能为真一次。
   *
   * peek.draftLang 是后加的，升级上来的第一份草稿没有这一项，刷新后只能停在默认的 JSON，
   * 所以要在编辑器挂载后补算一次（补算出来的语言紧接着就落盘了，之后不再走这条路）。
   * 必须在这里一次算清并固化：落盘 effect 很快会把 draftLang 写上，之后再读就永远是「有语言」。
   */
  const [draftNeedsLanguage] = useState(
    () => Boolean(readDraft().trim()) && readDraftLanguage() === null
  );
  const [largeDismissed, setLargeDismissed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const editorRef = useRef();
  const pickerWrapRef = useRef(null);
  const disposablesRef = useRef([]);
  /**
   * 首次写历史必须跳过。
   *
   * 原因：挂载时 history 还是初始的空数组，而「读历史」是同一个 commit 里的另一个 effect，
   * 要等它的 setState 生效后才有真数据。两个 effect 在同一 commit 内一前一后执行，
   * 于是「写历史」这一趟读到的必然是空数组 —— 不用这个标记拦住，就会用 "[]"
   * 覆盖掉刚刚读出来的历史。ref 在这里是可靠的：它在同一 commit 内同步生效，
   * 先后顺序与 effect 的执行顺序完全一致。
   */
  const skipFirstPersistRef = useRef(true);

  const t = useCallback((key, params) => translate(uiLang, key, params), [uiLang]);
  const monacoFontFamily = useMemo(readMonacoFontFamily, []);

  // 粘贴回调只在挂载时注册一次，回调里要读到最新的语言与开关状态，因此用 ref 同步
  const languageRef = useRef(language);
  const autoDetectRef = useRef(autoDetect);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);
  useEffect(() => {
    autoDetectRef.current = autoDetect;
  }, [autoDetect]);

  const sizeBytes = useMemo(() => byteSize(code), [code]);

  // ── 历史记录：读取（只跑一次）────────────────────────────────────────
  useEffect(() => {
    const loaded = readStoredHistory();
    if (loaded === null) {
      // 读失败只提示，不写回 —— 万一数据只是这次读不出来，不该被空数组盖掉
      setHistoryNotice({ key: 'historyLoadFailed' });
      return;
    }
    setHistory(loaded);
  }, []);

  // ── 历史记录：写入（含容量治理）─────────────────────────────────────
  useEffect(() => {
    if (skipFirstPersistRef.current) {
      skipFirstPersistRef.current = false;
      return undefined;
    }

    const { kept, dropped } = fitHistory(history);
    if (dropped > 0) {
      // 淘汰必须让用户知道，不能静默丢 —— 这正是不做治理时最恼人的地方
      setHistory(kept);
      setHistoryNotice({ key: 'historyTrimmed', params: { count: dropped } });
      return undefined;
    }

    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(kept));
    } catch (error) {
      // 配额仍然不够（别的 key 占了空间）：退一步只留最近几条，并把失败原因显示出来
      const fallback = kept.slice(0, 5);
      try {
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(fallback));
        setHistoryNotice({ key: 'historySaveFallback', params: { count: fallback.length } });
      } catch (innerError) {
        setHistoryNotice({ key: 'historySaveFailed' });
      }
    }
    return undefined;
  }, [history]);

  // ── 当前编辑内容与它的语言自动落盘（防刷新/误关丢失）──────────────────
  // 语言必须跟内容一起存：只恢复内容、不恢复语言，刷新后一段 Markdown 就会被当成
  // 初始的 JSON 上色（错的配色比没有高亮更容易看错）。
  // 两者写在同一个 effect 里，是为了让所有会改语言的路径（粘贴识别、手动指定、
  // 加载历史、加载示例、新页面清空）都自动被覆盖，不必各自记得写一遍。
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (code && code.trim()) {
          localStorage.setItem(STORAGE_KEY_DRAFT, code);
          localStorage.setItem(STORAGE_KEY_DRAFT_LANG, language);
        } else {
          localStorage.removeItem(STORAGE_KEY_DRAFT);
          localStorage.removeItem(STORAGE_KEY_DRAFT_LANG);
        }
      } catch (error) {
        // 存不下草稿就算了，绝不因此干扰用户当前的内容
      }
    }, DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [code, language]);

  // ── 界面语言持久化 + 同步 <html lang> ──────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_UI_LANG, uiLang);
    } catch (error) {
      /* 记不住就算了，不影响本次会话 */
    }
    document.documentElement.lang = uiLang === 'en' ? 'en' : 'zh-CN';
  }, [uiLang]);

  // ── 相对时间每分钟重渲染一次 ────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), RELATIVE_TIME_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // ── 语言选择面板：点击外部或 Esc 关闭 ──────────────────────────────
  useEffect(() => {
    if (!pickerOpen) return undefined;

    const handlePointerDown = (event) => {
      if (pickerWrapRef.current && !pickerWrapRef.current.contains(event.target)) {
        setPickerOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setPickerOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [pickerOpen]);

  // 长内容提示在内容降下来后要能重新出现
  useEffect(() => {
    if (sizeBytes <= LARGE_CONTENT_BYTES) setLargeDismissed(false);
  }, [sizeBytes]);

  // 卸载时释放挂在编辑器上的监听
  useEffect(
    () => () => {
      disposablesRef.current.forEach((disposable) => {
        try {
          if (disposable && typeof disposable.dispose === 'function') disposable.dispose();
        } catch (error) {
          /* 编辑器可能已随组件一起销毁，忽略 */
        }
      });
      disposablesRef.current = [];
    },
    []
  );

  // ── 语言切换 ────────────────────────────────────────────────────────
  function applyLanguage(newLanguage) {
    setLanguage(newLanguage);
    if (editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) model.setLanguage(newLanguage);
    }
  }

  // 手动选择语言：用户的明确意图优先，自动识别让位，
  // 否则下次粘贴又会被自动改掉，反而更难用
  function handleLanguageChange(newLanguage) {
    applyLanguage(newLanguage);
    setPickerOpen(false);
    if (autoDetectRef.current) {
      setAutoDetect(false);
      setNotice({ status: 'manual' });
    } else {
      setNotice(null);
    }
  }

  // 粘贴内容后自动识别语言。
  // 只在「识别出明确结果且编辑器支持该语言」时才切换；拿不准就保持原样。
  async function runDetection(text) {
    if (!text || !text.trim()) return;

    setDetecting(true);
    try {
      const result = await detectLanguage(text);

      if (!result) {
        setNotice({ status: 'unknown' });
        return;
      }

      if (!result.language) {
        // 识别出来了，但 Monaco 没有对应语言（如 Groovy / TOML / CSV）。
        // 这里**必须切走**，不能保留上一个语言：「不作切换」会让右下角语言与
        // 状态栏提示自相矛盾（提示说识别为 Groovy、语言却仍是 JSON），
        // 更要紧的是拿 JSON 的配色去渲染 Groovy —— 颜色是错的，
        // 比没有高亮更容易看错（与「日志一路落到模型手里被判成 INI」同源）。
        // 切到纯文本：既停下错误的着色，又与提示里的说法保持一致。
        if (languageRef.current !== PLAIN_TEXT_LANGUAGE) {
          applyLanguage(PLAIN_TEXT_LANGUAGE);
        }
        setNotice({
          status: 'unsupported',
          params: { label: result.label },
          detail: result.reason,
        });
        return;
      }

      if (result.language === languageRef.current) {
        setNotice({
          status: 'same',
          params: { label: result.label },
          detail: result.reason,
        });
        return;
      }

      applyLanguage(result.language);
      setNotice({
        status: 'switched',
        params: { label: result.label },
        detail: result.reason,
      });
    } catch (error) {
      setNotice({ status: 'error', params: { msg: toErrorMessage(error) } });
    } finally {
      setDetecting(false);
    }
  }

  function handleEditorDidMount(editor) {
    editorRef.current = editor;

    const position = editor.getPosition();
    if (position) {
      setCursor({ lineNumber: position.lineNumber, column: position.column });
    }

    // 老草稿（没有 peek.draftLang 的那一份）在这里补算一次语言，
    // 否则它刷新后只能停在默认的 JSON，与当初粘贴时识别出来的结果不一致。
    // 直接取编辑器里的内容去识别 —— 与粘贴走同一条链路，不另写一套判断。
    if (draftNeedsLanguage) {
      const model = editor.getModel();
      if (model) runDetection(model.getValue());
    }

    // 状态栏的行列显示
    disposablesRef.current.push(
      editor.onDidChangeCursorPosition((event) => {
        setCursor({ lineNumber: event.position.lineNumber, column: event.position.column });
      })
    );

    // 只在粘贴时识别：符合「粘进来一段代码」的使用直觉，
    // 也避免每次敲键都跑一遍检测
    disposablesRef.current.push(
      editor.onDidPaste((event) => {
        if (!autoDetectRef.current) return;
        const model = editor.getModel();
        if (!model) return;
        runDetection(model.getValueInRange(event.range));
      })
    );
  }

  // ── 格式化与数据处理 ────────────────────────────────────────────────

  async function handleFormat() {
    const editor = editorRef.current;
    if (!editor) return;

    setFormatting(true);
    try {
      await formatEditorContent(editor, language);
    } catch (error) {
      // 原来是 alert()：会打断整个页面、内容还复制不了
      setAlert({ tone: 'error', key: 'errFormatFailed', params: { msg: toErrorMessage(error) } });
    } finally {
      setFormatting(false);
    }
  }

  function handleCompressJson() {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;

    const selection = editor.getSelection();
    const selectedText = model.getValueInRange(selection);
    const hasSelection = Boolean(selectedText && selectedText.trim());
    const source = hasSelection ? selectedText : model.getValue();
    if (!source.trim()) return;

    let compressed;
    try {
      compressed = JSON.stringify(JSON.parse(source));
    } catch (error) {
      const message = toErrorMessage(error);
      const position = locateJsonError(message, source);
      if (position) selectJsonError(editor, position, hasSelection, selection);
      setAlert({
        tone: 'error',
        key: 'errInvalidJson',
        params: { msg: message },
        detailKeys: position
          ? [{ key: 'atLineCol', params: position }, { key: 'contentKept' }]
          : [{ key: 'contentKept' }],
      });
      return;
    }

    setAlert(null);
    if (!hasSelection) {
      editor.setValue(compressed);
      return;
    }

    editor.executeEdits('', [{ range: selection, text: compressed }]);
    editor.setPosition({
      lineNumber: selection.endLineNumber,
      column: selection.startColumn + compressed.length,
    });
    editor.focus();
  }

  function handleRemoveEscape() {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;

    // 只移除第一层转义字符（将双反斜杠变为单反斜杠），例如 \\\" 变成 \"
    // 注意：这个实现是两次正则近似替换，嵌套转义会处理错且不幂等。
    // 本轮只改界面，不动这段逻辑（重写属独立一项，见 docs/ui-redesign-spec.html）。
    const removeEscape = (text) => text.replace(/\\"/g, '"').replace(/\\\\/g, '\\');

    try {
      const selection = editor.getSelection();
      const selectedText = model.getValueInRange(selection);

      if (!selectedText || selectedText.trim() === '') {
        editor.setValue(removeEscape(model.getValue()));
        return;
      }

      const processed = removeEscape(selectedText);
      editor.executeEdits('', [{ range: selection, text: processed }]);
      editor.setPosition({
        lineNumber: selection.endLineNumber,
        column: selection.startColumn + processed.length,
      });
      editor.focus();
      setAlert(null);
    } catch (error) {
      setAlert({
        tone: 'error',
        key: 'errUnescapeFailed',
        params: { msg: toErrorMessage(error) },
      });
    }
  }

  function handleNewPage() {
    // 保存当前内容到历史记录：直接从编辑器取，而不是从 state
    const currentContent = editorRef.current ? editorRef.current.getValue() : code;
    if (currentContent && currentContent.trim()) {
      const newHistoryItem = {
        id: Date.now(),
        createdAt: Date.now(),
        timestamp: new Date().toLocaleString(),
        content: currentContent,
        language,
      };
      setHistory((prevHistory) => [newHistoryItem, ...prevHistory]);
    }

    setAlert(null);
    setNotice(null);
    setDraftRestored(false);
    setCode('');
    if (editorRef.current) {
      editorRef.current.setValue('');
    }
  }

  function handleLoadFromHistory(historyItem) {
    const editor = editorRef.current;
    const currentContent = editor ? editor.getValue() : code;

    const doLoad = () => {
      setCode(historyItem.content);
      applyLanguage(historyItem.language || 'json');
      if (editorRef.current) editorRef.current.setValue(historyItem.content);
    };

    // 原来是 window.confirm()：同样的打断问题，换成内联确认
    if (currentContent && currentContent.trim()) {
      setAlert({
        tone: 'confirm',
        key: 'overwriteConfirm',
        confirmKey: 'continueLabel',
        onConfirm: doLoad,
      });
      return;
    }
    doLoad();
  }

  function handleDeleteFromHistory(historyItemId) {
    setHistory((prevHistory) => prevHistory.filter((item) => item.id !== historyItemId));
  }

  function handleClearHistory() {
    if (history.length === 0) return;

    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const recentCount = history.filter((item) => item.createdAt >= tenMinutesAgo).length;

    setAlert({
      tone: 'confirm',
      key: 'clearConfirm',
      params: { count: history.length },
      detailKeys:
        recentCount > 0 ? [{ key: 'clearConfirmRecent', params: { count: recentCount } }] : [],
      confirmKey: 'clear',
      danger: true,
      onConfirm: () => setHistory([]),
    });
  }

  async function handleLoadSample(sample) {
    setAlert(null);
    setCode(sample.content);
    if (editorRef.current) {
      editorRef.current.setValue(sample.content);
      editorRef.current.focus();
    }
    // 示例走与粘贴完全相同的识别路径，点一下就能看到「自动识别」在工作
    if (autoDetectRef.current) {
      await runDetection(sample.content);
    } else {
      setNotice({ status: 'manual' });
    }
  }

  function handleEditorChange(value) {
    setCode(value);
  }

  // 让 JS/TS 语言服务与编辑器模型即时同步（默认按需同步），
  // 保证语言服务始终看到最新内容。
  //
  // 注意：monaco-editor 0.55 起把 css/html/json/typescript 四个语言服务命名空间
  // 从 monaco.languages.* 提升到了顶层 monaco.*；旧位置在 .d.ts 里只留了
  // `{ deprecated: true }` 声明，**运行时该属性实际不存在（undefined）**。
  // 这里两种位置都取，并且逐级判空——此函数在 beforeMount 阶段执行，
  // 一旦抛错会让整个 React 树卸载（整页白屏），必须保证不会抛。
  function handleEditorWillMount(monacoInstance) {
    const typescript =
      monacoInstance.typescript || (monacoInstance.languages && monacoInstance.languages.typescript);
    const defaults = typescript && typescript.javascriptDefaults;

    if (defaults && typeof defaults.setEagerModelSync === 'function') {
      defaults.setEagerModelSync(true);
    }
  }

  // ── 派生显示值 ──────────────────────────────────────────────────────

  const languageLabel =
    (LANGUAGE_OPTIONS.find((option) => option.value === language) || {}).label || language;

  // getFormatterLabel 返回的是稳定标识符（'Monaco' / 'clang-format' / ...），
  // 只有 Monaco 那个需要翻译，其余是专有名词
  const formatterName = getFormatterLabel(language);
  const formatterLabel = formatterName === 'Monaco' ? t('formatterMonaco') : formatterName;

  const formatAllowed = canFormat(language);
  const compressAllowed = canCompress(language);
  const isEditorEmpty = !code || !code.trim();
  const isBusy = formatting || detecting;

  const statusTone = isBusy ? 'busy' : notice && notice.status === 'error' ? 'error' : 'ready';
  const statusText = isBusy
    ? detecting
      ? t('detecting')
      : t('formatting')
    : notice && notice.status === 'error'
      ? t('statusError')
      : t('ready');

  const noticeMeta = notice ? DETECT_META[notice.status] || DETECT_META.unknown : null;

  // 提示槽位优先级：报错/确认 > 长内容。同一时刻只显示一条，避免堆成一片
  const shownAlert =
    alert ||
    (sizeBytes > LARGE_CONTENT_BYTES && !largeDismissed
      ? {
          tone: 'warn',
          key: 'largeContent',
          params: { size: formatBytes(sizeBytes) },
          detailKeys: [{ key: 'largeContentWhy' }],
        }
      : null);

  return (
    <div className="App">
      <header className="app-header" data-testid="app-header">
        <div className="brand">
          <img src={`${process.env.PUBLIC_URL}/img/logo.png`} alt="peek" className="logo" />
          <span className="brand-name">peek</span>
          <span className="brand-tagline">{t('tagline')}</span>
        </div>
        <div className="header-actions">
          <div className="ui-lang-switch" role="group" aria-label={t('uiLangLabel')} data-testid="ui-lang-switch">
            {UI_LANGUAGES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`ui-lang-option${uiLang === item.id ? ' is-active' : ''}`}
                data-ui-lang={item.id}
                aria-pressed={uiLang === item.id}
                onClick={() => setUiLang(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            data-testid="new-page"
            onClick={handleNewPage}
            title={t('newPageTitle')}
          >
            <Icon path={ICON.plus} />
            {t('newPage')}
          </button>
        </div>
      </header>

      <div className="toolbar">
        <button
          type="button"
          className="btn btn-primary"
          data-testid="format"
          onClick={handleFormat}
          disabled={!formatAllowed || formatting}
          title={
            formatAllowed
              ? t('formatTitle', { formatter: formatterLabel, language: languageLabel })
              : t('formatDisabled', { language: languageLabel })
          }
        >
          <Icon path={ICON.lines} />
          {t('format')} {languageLabel}
        </button>
        <button
          type="button"
          className="btn"
          data-testid="unescape"
          onClick={handleRemoveEscape}
          title={t('unescapeTitle')}
        >
          <Icon path={ICON.unescape} />
          {t('unescape')}
        </button>
        <button
          type="button"
          className="btn"
          data-testid="compress"
          onClick={handleCompressJson}
          disabled={!compressAllowed}
          title={compressAllowed ? t('compressTitle') : t('compressDisabled')}
        >
          <Icon path={ICON.compress} />
          {t('compress')}
        </button>

        <span className="toolbar-spacer" />

        <label className="switch-field" title={t('autoDetectTitle')}>
          <input
            type="checkbox"
            role="switch"
            data-testid="auto-detect"
            checked={autoDetect}
            onChange={(event) => {
              setAutoDetect(event.target.checked);
              setNotice(null);
            }}
          />
          <span className="switch-track" aria-hidden="true" />
          <span>{t('autoDetect')}</span>
          {!autoDetect && <span className="switch-chip">{t('autoDetectPaused')}</span>}
        </label>
      </div>

      {shownAlert && (
        <div
          className={`inline-alert alert-${shownAlert.tone}`}
          data-testid="inline-alert"
          data-alert-key={shownAlert.key}
          role={shownAlert.tone === 'error' ? 'alert' : 'status'}
        >
          <span className="alert-text">{t(shownAlert.key, shownAlert.params)}</span>
          {shownAlert.detailKeys && shownAlert.detailKeys.length > 0 && (
            <span className="alert-detail">
              {shownAlert.detailKeys.map((detail) => t(detail.key, detail.params)).join(' · ')}
            </span>
          )}
          <div className="alert-actions">
            {shownAlert.onConfirm && (
              <button
                type="button"
                className={`btn ${shownAlert.danger ? 'btn-danger' : 'btn-primary'}`}
                data-testid="alert-confirm"
                onClick={() => {
                  const run = shownAlert.onConfirm;
                  setAlert(null);
                  run();
                }}
              >
                {t(shownAlert.confirmKey || 'confirm')}
              </button>
            )}
            <button
              type="button"
              className="btn"
              data-testid="alert-dismiss"
              onClick={() => {
                setAlert(null);
                if (shownAlert.tone === 'warn') setLargeDismissed(true);
              }}
            >
              {shownAlert.onConfirm ? t('cancel') : t('dismiss')}
            </button>
          </div>
        </div>
      )}

      <div className="main-content">
        {showHistory ? (
          <aside className="history-panel" data-testid="history-panel">
            <div className="history-header">
              <span className="history-title">{t('history')}</span>
              {history.length > 0 && <span className="history-count">{history.length}</span>}
              <div className="history-header-actions">
                <button
                  type="button"
                  className="link-btn is-danger"
                  data-testid="history-clear"
                  onClick={handleClearHistory}
                  disabled={history.length === 0}
                >
                  {t('clear')}
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  data-testid="history-toggle"
                  onClick={() => setShowHistory(false)}
                  title={t('collapseHistory')}
                  aria-label={t('collapseHistory')}
                >
                  ‹
                </button>
              </div>
            </div>
            <div className="history-list">
              {history.length === 0 && (
                <div className="history-empty" data-testid="history-empty">
                  {t('historyEmpty')}
                </div>
              )}
              {history.map((item) => (
                <div
                  key={item.id}
                  className="history-item"
                  onClick={() => handleLoadFromHistory(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleLoadFromHistory(item);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  title={t('loadHistory')}
                >
                  <div className="history-item-top">
                    <span className="lang-badge">{(item.language || 'json').toUpperCase()}</span>
                    <span className="history-time">
                      {formatRelativeTime(item.createdAt, now, t)}
                    </span>
                    <button
                      type="button"
                      className="history-delete"
                      aria-label={t('deleteItem')}
                      title={t('deleteItem')}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteFromHistory(item.id);
                      }}
                    >
                      <Icon path={ICON.trash} />
                    </button>
                  </div>
                  <div className="history-preview">{truncateContent(item.content)}</div>
                </div>
              ))}
            </div>
          </aside>
        ) : (
          <button
            type="button"
            className="history-rail"
            data-testid="history-toggle"
            onClick={() => setShowHistory(true)}
            title={t('expandHistory')}
            aria-label={t('expandHistory')}
          >
            ›
          </button>
        )}

        <div className="editor-container">
          {isEditorEmpty && (
            <div className="empty-state" data-testid="empty-state">
              <div className="empty-title">{t('emptyTitle')}</div>
              <div className="empty-line">
                <kbd className="kb">Ctrl</kbd>
                <span className="empty-sub">+</span>
                <kbd className="kb">V</kbd>
                <span>{t('emptyHintSuffix')}</span>
              </div>
              <div className="empty-samples">
                {SAMPLES.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    className="sample-chip"
                    data-testid={`sample-${sample.id}`}
                    onClick={() => handleLoadSample(sample)}
                  >
                    {t(sample.labelKey)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Editor
            height="100%"
            language={language}
            value={code}
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            beforeMount={handleEditorWillMount}
            theme="vs"
            options={{
              // 按设计稿关掉：编辑区右缘保持干净（「看一眼」场景下它是干扰）
              minimap: { enabled: false },
              fontSize: 13,
              // Monaco 不读 CSS 的 font-family，必须在这里单独给
              fontFamily: monacoFontFamily,
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>
      </div>

      <footer className="status-bar" data-testid="status-bar">
        <span className={`status-dot is-${statusTone}`} aria-hidden="true" />
        <span className="status-item" data-testid="status-state">
          {statusText}
        </span>

        <span className="status-sep">·</span>
        <span className="status-item">
          {t('lineCol', { line: cursor.lineNumber, col: cursor.column })}
        </span>

        {formatAllowed && (
          <>
            <span className="status-sep">·</span>
            <span className="status-item" data-testid="status-formatter">
              {t('formatterLabel')}: {formatterLabel}
            </span>
          </>
        )}

        {noticeMeta && (
          <span
            className={`status-notice is-${noticeMeta.tone}`}
            data-testid="status-notice"
            data-detect-status={notice.status}
            title={notice.detail || ''}
          >
            {t(noticeMeta.key, notice.params)}
            <button
              type="button"
              className="status-notice-dismiss"
              onClick={() => setNotice(null)}
              aria-label={t('dismiss')}
            >
              ×
            </button>
          </span>
        )}

        {historyNotice && (
          <span className="status-notice is-warn" data-testid="history-notice">
            {t(historyNotice.key, historyNotice.params)}
            <button
              type="button"
              className="status-notice-dismiss"
              onClick={() => setHistoryNotice(null)}
              aria-label={t('dismiss')}
            >
              ×
            </button>
          </span>
        )}

        {draftRestored && (
          <span className="status-notice is-info" data-testid="draft-notice">
            {t('draftRestored')}
            <button
              type="button"
              className="status-notice-dismiss"
              onClick={() => setDraftRestored(false)}
              aria-label={t('dismiss')}
            >
              ×
            </button>
          </span>
        )}

        <span className="status-spacer" />

        <span className="status-item" data-testid="status-size">
          {t('sizeLabel')}: {formatBytes(sizeBytes)}
        </span>

        <span className="status-language-wrap" ref={pickerWrapRef}>
          <button
            type="button"
            className="status-language"
            data-testid="status-language"
            data-language={language}
            aria-expanded={pickerOpen}
            aria-haspopup="dialog"
            title={t('pickLanguage')}
            onClick={() => setPickerOpen((open) => !open)}
          >
            {languageLabel}
            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1.5 3.5L5 7l3.5-3.5" />
            </svg>
          </button>

          {pickerOpen && (
            <div
              className="language-picker"
              data-testid="language-picker"
              role="dialog"
              aria-label={t('pickLanguage')}
            >
              <div className="picker-group">
                <div className="picker-group-title">{t('groupCore')}</div>
                <div className="picker-grid">
                  {CORE_LANGUAGES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`picker-option${option.value === language ? ' is-active' : ''}`}
                      onClick={() => handleLanguageChange(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="picker-group">
                <div className="picker-group-title">{t('groupExtra')}</div>
                <div className="picker-grid">
                  {EXTRA_LANGUAGES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`picker-option${option.value === language ? ' is-active' : ''}`}
                      onClick={() => handleLanguageChange(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </span>

        <span className="status-item status-utf8">UTF-8</span>
      </footer>
    </div>
  );
}

export default App;
