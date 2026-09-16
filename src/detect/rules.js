/**
 * 结构化规则层：对「结构特征具有决定性」的格式直接下结论，不必动用模型。
 *
 * 设计原则
 * - 只做能一眼判定成立/不成立的检查。规则误判比交给模型更糟，
 *   所以每条规则都要求明确的强特征，拿不准一律返回 null 交给模型。
 * - 单条规则的返回语言为 Monaco 语言 id；若该格式 Monaco 没有对应语言
 *   （如 CSV / TOML），language 返回 null，只给出 label 供界面提示。
 * - 规则命中是确定性结论，confidence 固定为 1。
 */

function hit(language, label, reason) {
  return { language, label, confidence: 1, source: 'rule', reason };
}

// JSON：能被 JSON.parse 完整解析是确定性结论
function ruleJson(text) {
  const trimmed = text.trim();
  if (trimmed.length < 2) return null;
  if (trimmed[0] !== '{' && trimmed[0] !== '[') return null;

  try {
    JSON.parse(trimmed);
  } catch {
    return null;
  }
  return hit('json', 'JSON', '内容可被 JSON.parse 完整解析');
}

// XML 声明是强特征，优先于 HTML 判断（带声明的 SVG/RSS 也走这里）
function ruleXmlDeclaration(text) {
  if (!/^\s*<\?xml[\s>]/i.test(text)) return null;
  return hit('xml', 'XML', '以 <?xml 声明开头');
}

const HTML_TAGS = [
  'html', 'head', 'body', 'div', 'span', 'p', 'script', 'style',
  'meta', 'title', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'form',
  'input', 'button', 'section', 'header', 'footer', 'nav', 'main', 'a',
];

function ruleHtml(text) {
  if (/<!DOCTYPE\s+html/i.test(text)) {
    return hit('html', 'HTML', '含有 <!DOCTYPE html>');
  }
  if (/<html[\s>]/i.test(text)) {
    return hit('html', 'HTML', '含有 <html> 根标签');
  }

  const found = HTML_TAGS.filter((tag) => new RegExp(`<${tag}[\\s>]`, 'i').test(text));
  if (found.length >= 2) {
    return hit('html', 'HTML', `含有 <${found.slice(0, 2).join('>、<')}> 等多个 HTML 标签`);
  }
  return null;
}

// 根标签成对闭合、且不是 HTML 常用标签 → XML（覆盖 SVG / RSS / plist / 配置文件等）
function ruleXml(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith('<')) return null;

  const rootMatch = /^<([A-Za-z_][\w:.-]*)/.exec(trimmed);
  if (!rootMatch) return null;

  const root = rootMatch[1].toLowerCase();
  if (HTML_TAGS.includes(root)) return null;

  const paired = new RegExp(`</${root}\\s*>`, 'i').test(text);
  const selfClosing = new RegExp(`<${root}\\b[^>]*/>`, 'i').test(text);
  if (paired || selfClosing) {
    return hit('xml', 'XML', `根标签 <${root}> 且标签成对闭合`);
  }
  return null;
}

// 表格数据：每行列数一致。列数太少或行数太少容易和普通文本混淆，故设下限
function ruleTableData(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // 排除明显的代码或标记
  if (/[{}<>;=]|\/\*|-->/.test(trimmed)) return null;
  if (/^\s*[-*+]\s/m.test(trimmed)) return null;

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length < 2) return null;

  const delimiter = trimmed.includes('\t') && !trimmed.includes(',') ? '\t' : ',';
  const counts = lines.map((line) => line.split(delimiter).length);
  if (counts[0] < 2) return null;
  if (!counts.every((count) => count === counts[0])) return null;

  // 两行两列可能只是普通文本，要求更明确的规模
  if (lines.length < 3 && counts[0] < 3) return null;

  const label = delimiter === '\t' ? 'TSV' : 'CSV';
  return hit(null, label, `每行 ${counts[0]} 列且列数一致`);
}

function ruleDockerfile(text) {
  const trimmed = text.trim();
  const firstMeaningful = trimmed
    .split(/\r?\n/)
    .find((line) => line.trim() && !line.trim().startsWith('#'));

  if (!firstMeaningful || !/^(FROM|ARG)\s+\S+/i.test(firstMeaningful.trim())) return null;
  if (!/^\s*(RUN|CMD|ENTRYPOINT|COPY|ADD|WORKDIR|ENV|EXPOSE|VOLUME|LABEL|USER|HEALTHCHECK|SHELL)\s/im.test(trimmed)) {
    return null;
  }
  return hit('dockerfile', 'Dockerfile', '以 FROM 开头且含 RUN/COPY 等构建指令');
}

// INI / TOML：二者的语法接近，靠「值是否带类型写法」区分
function ruleIniOrToml(text) {
  const trimmed = text.trim();
  if (/[{}<>]/.test(trimmed)) return null;
  if (/^\s*(select|insert|update|delete)\b/im.test(trimmed)) return null;

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith(';'));
  if (lines.length < 2) return null;

  // 带分号语句结尾的更像代码
  if (/;\s*$/m.test(trimmed)) return null;

  const assignments = lines.filter((line) => /^[^=]+=\s*\S/.test(line));
  if (assignments.length < 2) return null;
  if (assignments.length / lines.length < 0.6) return null;

  if (/^\s*\[\[.+\]\]/m.test(trimmed) || /^[A-Za-z_][\w-]*\.[\w.-]+\s*=/m.test(trimmed)) {
    return hit(null, 'TOML', '含有表数组 [[...]] 或点号分隔的键');
  }

  // 只看「引号 / 布尔 / 数组」这类 TOML 写法。
  // 注意不能把裸数字算进来：`port = 8080` 这种在 INI 里到处都是，
  // 一旦算进去，最常见的那种 INI 会被一律判成 TOML。
  const typedValue = assignments.some((line) =>
    /=\s*(".*"|'.*'|true|false|\[.*\])\s*$/i.test(line)
  );
  if (typedValue) {
    return hit(null, 'TOML', '值使用引号/布尔/数组等类型写法');
  }

  return hit('ini', 'INI', '形如 [节] 与 key=value 的配置写法');
}

// YAML：要求较多样本，避免把 "Note: xxx / Warning: xxx" 这类普通文本误判为 YAML
function ruleYaml(text) {
  const trimmed = text.trim();
  if (/[{}<>]/.test(trimmed)) return null;
  if (/;\s*$/m.test(trimmed)) return null;

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line.trim() && !line.trim().startsWith('#'));
  if (lines.length < 3) return null;

  // 出现等号赋值 → 更像 INI/TOML/代码
  if (lines.some((line) => /=/.test(line))) return null;

  const keyValue = /^(\s*-\s+)?[A-Za-z_$][\w$@.-]*:\s*(\S|$)/;
  const listItem = /^\s*-\s+\S/;
  const matched = lines.filter((line) => keyValue.test(line) || listItem.test(line));
  if (matched.length < 3) return null;
  if (matched.length / lines.length < 0.6) return null;

  const hasDocumentMarker = /^---\s*$/m.test(trimmed);
  const hasNestedBlock = lines.some((line, index) => index > 0 && /^\s{2,}\S/.test(line));
  if (hasDocumentMarker || hasNestedBlock) {
    return hit('yaml', 'YAML', '含 --- 分隔符或缩进嵌套的键值对');
  }
  return hit('yaml', 'YAML', '形如 key: value 的键值对写法');
}

function ruleSql(text) {
  const strong = /\b(create\s+(or\s+replace\s+)?(table|view|index|procedure|function)|select\s[\s\S]{0,500}?\bfrom\b|insert\s+into\s+\w|update\s+\w+\s+set|delete\s+from\s+\w|alter\s+table\s+\w|drop\s+(table|view|index))\b/i;
  if (!strong.test(text)) return null;

  const isDdl = /create\s+(or\s+replace\s+)?(table|view|index|procedure|function)/i.test(text);
  const hasClause = /\b(where|join|group\s+by|order\s+by|values|having|limit|primary\s+key|not\s+null|varchar|integer|decimal|timestamp)\b/i.test(text);
  if (!isDdl && !hasClause) return null;

  return hit('sql', 'SQL', '含 SELECT ... FROM / CREATE TABLE 等语句结构');
}

// Markdown：`# 注释` 在 shell/ini 里也常见，故要求围栏代码块，或两个以上独立特征
function ruleMarkdown(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const signals = [
    /^\s*```/m.test(trimmed),                       // 围栏代码块
    /^#{1,6}\s+\S/m.test(trimmed),                  // 标题
    /\[[^\]\n]+\]\([^)\n]+\)/.test(trimmed),        // 链接
    /\*\*[^*\n]+\*\*/.test(trimmed),                // 粗体
    /^\s*[-*+]\s+\S/m.test(trimmed),                // 无序列表
    /^\s*\d+\.\s+\S/m.test(trimmed),                // 有序列表
    /^\s*\|.+\|\s*$/m.test(trimmed),                // 表格
    /^\s*>\s+\S/m.test(trimmed),                    // 引用
    /^\s*[-*+]\s+\[[ xX]\]/m.test(trimmed),         // 任务列表
  ].filter(Boolean).length;

  if (/^\s*```/m.test(trimmed)) {
    return hit('markdown', 'Markdown', '含有围栏代码块');
  }
  if (signals >= 2) {
    return hit('markdown', 'Markdown', `同时含有 ${signals} 类 Markdown 标记`);
  }
  return null;
}

// shebang 只在第一行成立，且指向的语言非常明确
function ruleShebang(text) {
  const firstLine = text.replace(/^\s+/, '').split(/\r?\n/, 1)[0] || '';
  if (!firstLine.startsWith('#!')) return null;

  const command = firstLine.slice(2).toLowerCase();
  if (/\bpython/.test(command)) return hit('python', 'Python', '以 python shebang 开头');
  if (/\b(node|deno|bun)\b/.test(command)) return hit('javascript', 'JavaScript', '以 node shebang 开头');
  if (/\bruby\b/.test(command)) return hit('ruby', 'Ruby', '以 ruby shebang 开头');
  if (/\bperl\b/.test(command)) return hit('perl', 'Perl', '以 perl shebang 开头');
  if (/\brscript\b/.test(command)) return hit('r', 'R', '以 Rscript shebang 开头');
  if (/(^|\/)(ba|da|z|k|c|k)?sh(\s|$)|\benv\s+sh\b/.test(command)) {
    return hit('shell', 'Shell', '以 sh/bash shebang 开头');
  }
  return null;
}

/** 规则按顺序依次尝试，命中即返回；全部未命中返回 null（交给模型） */
export const RULES = [
  { name: 'JSON', run: ruleJson },
  { name: 'XML 声明', run: ruleXmlDeclaration },
  { name: 'HTML', run: ruleHtml },
  { name: 'XML', run: ruleXml },
  { name: 'CSV/TSV', run: ruleTableData },
  { name: 'Dockerfile', run: ruleDockerfile },
  { name: 'INI/TOML', run: ruleIniOrToml },
  { name: 'YAML', run: ruleYaml },
  { name: 'SQL', run: ruleSql },
  { name: 'shebang', run: ruleShebang },
  { name: 'Markdown', run: ruleMarkdown },
];

/** @returns {{language: string|null, label: string, confidence: number, source: 'rule', reason: string}|null} */
export function detectByRules(text) {
  if (!text || !text.trim()) return null;

  for (const rule of RULES) {
    const result = rule.run(text);
    if (result) return result;
  }
  return null;
}
