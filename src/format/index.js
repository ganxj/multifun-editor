/**
 * 统一的格式化入口：按语言把格式化请求分发到 Monaco 内置语言服务或 WASM 格式化器。
 *
 * 覆盖范围：
 *   Monaco 内置   json / javascript / typescript / html / css
 *   clang-format  c / cpp / csharp / java
 *   Ruff          python
 *   gofmt         go
 */
import { TEXT_FORMATTERS, loadTextFormatter } from './textFormatters';

// Monaco 自带文档/选区格式化能力的语言（由 VSCode 同款语言服务提供）
const MONACO_NATIVE_LANGUAGES = new Set([
  'json',
  'javascript',
  'typescript',
  'html',
  'css',
]);

/** 该语言能否格式化 */
export function canFormat(language) {
  return MONACO_NATIVE_LANGUAGES.has(language) || Boolean(TEXT_FORMATTERS[language]);
}

/** 实际生效的格式化器名称，用于按钮提示；不支持时返回 null */
export function getFormatterLabel(language) {
  // 返回的是**稳定标识符**，不是给人看的文案：'Monaco' 的展示名由 i18n 层给出
  // （中文「Monaco 内置」/ 英文 "Monaco built-in"），其余几个是专有名词、中英一致。
  // 早先这里直接写死 'Monaco 内置'，界面改成双语后就成了漏网的中文。
  if (MONACO_NATIVE_LANGUAGES.has(language)) return 'Monaco';
  const entry = TEXT_FORMATTERS[language];
  return entry ? entry.label : null;
}

/** 「压缩成单行」只有 JSON 有这个语义 */
export function canCompress(language) {
  return language === 'json';
}

function restoreCursor(editor, position) {
  if (!position) return;
  const model = editor.getModel();
  if (!model) return;

  const lineNumber = Math.min(position.lineNumber, model.getLineCount());
  const column = Math.min(position.column, model.getLineMaxColumn(lineNumber));
  editor.setPosition({ lineNumber, column });
}

/**
 * 格式化整个文档或当前选区，原地写回编辑器。
 *
 * 用 executeEdits + pushUndoStop 而不是 setValue，这样格式化操作可以正常撤销。
 *
 * @returns {Promise<string | null>} 实际使用的格式化器名称；内容为空时返回 null
 * @throws {Error} 格式化失败（语法错误、语言不支持等）
 */
export async function formatEditorContent(editor, language) {
  const model = editor.getModel();
  if (!model) return null;

  const selection = editor.getSelection();
  const hasSelection = Boolean(selection) && !selection.isEmpty();

  if (MONACO_NATIVE_LANGUAGES.has(language)) {
    // Monaco 的格式化动作本身区分全文/选区，直接交给语言服务处理
    const actionId = hasSelection
      ? 'editor.action.formatSelection'
      : 'editor.action.formatDocument';
    const action = editor.getAction(actionId);
    if (!action) {
      throw new Error(`当前语言的格式化能力不可用（${language}）`);
    }

    await action.run();
    editor.focus();
    return getFormatterLabel(language);
  }

  const format = await loadTextFormatter(language);
  if (!format) {
    throw new Error(`当前语言暂不支持格式化（${language}）`);
  }

  const source = hasSelection ? model.getValueInRange(selection) : model.getValue();
  if (!source.trim()) return null;

  // await 让格式化器可以是同步也可以是异步实现
  const formatted = await format(source);

  // 守卫：格式化器一旦错位（比如误把加载器当格式化函数调用），
  // 返回值会是一个非字符串，直接写回编辑器会把用户内容毁掉，这里必须拦住
  if (typeof formatted !== 'string') {
    throw new Error('格式化器未返回文本结果，已取消写入');
  }

  if (formatted === source) {
    editor.focus();
    return getFormatterLabel(language);
  }

  const position = editor.getPosition();
  editor.pushUndoStop();
  editor.executeEdits('format', [
    {
      range: hasSelection ? selection : model.getFullModelRange(),
      text: formatted,
      forceMoveMarkers: true,
    },
  ]);
  editor.pushUndoStop();
  restoreCursor(editor, position);
  editor.focus();

  return getFormatterLabel(language);
}
