/**
 * 识别结果后处理：纠正模型在「语法高度重合」的语言对上的系统性混淆。
 *
 * 目前只处理 JavaScript / TypeScript 这一对，因为它是实测唯一稳定出错的：
 * guesslang 训练集里 JS 与 TS 的样本分布几乎相同，一段**完全没有类型标注**的
 * JS 会被判成 TypeScript（实测置信度 0.43，而真正的 TS 是 0.59，两者都远高于
 * MIN_CONFIDENCE，光靠阈值拦不住）。
 *
 * 好在二者的差异可以很便宜地判定：TS 一定带有 JS 不可能出现的语法。
 * 所以这里不看模型分数，只做「找得到 TS 专有语法吗」这一个检查：
 *   - 模型说是 TS、但一个专有语法都没有 → 就是 JS
 *   - 模型说是 JS、但出现了专有语法       → 就是 TS
 * 对高亮而言这样纠正是安全的：不带任何 TS 语法的文件本来就是合法 JS。
 */
import { getLanguageLabel } from './languageCatalog';

/** TS 专有语法（这些写法在合法 JS 里不可能出现） */
const TYPESCRIPT_ONLY = [
  { re: /\binterface\s+[A-Za-z_$][\w$]*\s*(<[^>{}]*>)?\s*\{/, name: 'interface 声明' },
  { re: /\btype\s+[A-Za-z_$][\w$]*\s*(<[^>{}]*>)?\s*=/, name: 'type 类型别名' },
  { re: /\benum\s+[A-Za-z_$][\w$]*\s*\{/, name: 'enum 声明' },
  { re: /\bnamespace\s+[A-Za-z_$][\w$]*\s*\{/, name: 'namespace 声明' },
  { re: /^\s*(export\s+)?(declare|abstract)\s+/m, name: 'declare/abstract 声明' },
  { re: /\b(implements|satisfies)\b/, name: 'implements/satisfies' },
  { re: /\bas\s+(const|unknown|any|[A-Z][\w$.]*(\[\])?)\b/, name: 'as 类型断言' },
  // 参数、属性、返回值的类型标注：`: 类型名` 后面紧跟分隔符或行尾
  { re: /:\s*(string|number|boolean|void|any|unknown|never|object|symbol|bigint|undefined)\b/, name: '基础类型标注' },
  { re: /\)\s*:\s*[A-Za-z_$][\w$<>,[\]|.\s]*(\{|=>|$)/m, name: '返回值类型标注' },
  { re: /\b(?:function\s+[A-Za-z_$][\w$]*|const\s+[A-Za-z_$][\w$]*)\s*<[^<>{}()]{1,40}>\s*[(=]/, name: '泛型参数' },
  { re: /[A-Za-z_$][\w$]*\s*\?\s*:\s*[A-Za-z_$]/, name: '可选属性/参数' },
  { re: /\b(private|public|protected|readonly)\s+[A-Za-z_$][\w$]*\s*[:?]/, name: '成员修饰符' },
];

/** 找出第一个命中的 TS 专有语法 */
function findTypescriptMarker(text) {
  for (const item of TYPESCRIPT_ONLY) {
    if (item.re.test(text)) return item.name;
  }
  return null;
}

/**
 * 对模型结果做一次 JS/TS 纠正；其余语言原样返回。
 *
 * @param {{language: string|null, label: string, confidence: number, source: string, reason: string}|null} result
 * @param {string} text 原始文本
 * @returns 同上
 */
export function refineDetection(result, text) {
  if (!result || !result.language || !text) return result;

  if (result.language !== 'javascript' && result.language !== 'typescript') {
    return result;
  }

  const marker = findTypescriptMarker(text);
  const looksLikeTypescript = marker !== null;
  const target = looksLikeTypescript ? 'typescript' : 'javascript';

  if (result.language === target) return result;

  // 注意：这里 target 已经是 Monaco 语言 id，必须用 getLanguageLabel 取展示名；
  // MODEL_LANGUAGE_LABELS 的键是模型的短 id（js / ts），拿 Monaco id 去查会查空。
  const label = getLanguageLabel(target);
  const reason = looksLikeTypescript
    ? `发现 ${marker}，按 TypeScript 处理（模型判为 ${result.label}）`
    : `未发现任何 TypeScript 专有语法，按 JavaScript 处理（模型判为 ${result.label}）`;

  return { ...result, language: target, label, reason };
}
