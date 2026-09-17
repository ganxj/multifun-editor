/**
 * 语言自动识别统一入口。
 *
 * 顺序：结构化规则优先（确定性的格式，瞬时得出且可解释），
 * 判不出来才交给 ML 模型（按需加载，首次会拉取模型文件），
 * 最后过一遍后处理，纠正模型在语法近似语言上的系统性混淆（见 refine.js）。
 */
import { detectByRules } from './rules';
import { detectByModel, MIN_CONTENT_LENGTH } from './modelDetector';
import { refineDetection } from './refine';

export { MIN_CONTENT_LENGTH, MIN_CONFIDENCE, isModelLoaded } from './modelDetector';
export { getLanguageLabel, CORE_LANGUAGES, EXTRA_LANGUAGES } from './languageCatalog';

/**
 * 识别一段文本的语言。
 *
 * @param {string} text 要识别的代码文本
 * @returns {Promise<{
 *   language: string|null,   // Monaco 语言 id；null 表示识别出来了但编辑器不支持该语言
 *   label: string,           // 展示名
 *   confidence: number,      // 置信度（规则命中的为 1）
 *   source: 'rule'|'model',
 *   reason: string,          // 可读的判定依据
 *   candidates?: Array       // 模型路径下的候选语言
 * }|null>} null 表示无法判断（内容过短、置信度不足）
 */
export async function detectLanguage(text) {
  if (!text || !text.trim()) return null;

  const byRule = detectByRules(text);
  if (byRule) return byRule;

  if (text.trim().length < MIN_CONTENT_LENGTH) return null;

  const byModel = await detectByModel(text);
  return refineDetection(byModel, text);
}

// 这里原本有个 describeDetection()，负责把识别结果拼成一句成品中文文案。
// 已删除，原因是它把「界面措辞」放进了检测层：界面改成中英可切换后，
// 这种在业务代码里拼好的句子翻不了（中英语序不同），查字典也救不回来。
//
// 现在的分工：
//   检测层  → 只回传结构化结果（language / label / confidence / source / reason）
//   i18n 层 → 用「模板 + 参数」组装文案，见 src/i18n 的 detectSwitched 等条目
//
// 也就是说：**不要在这里再加任何面向用户的句子**，哪怕是临时的。
