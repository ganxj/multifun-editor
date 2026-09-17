/**
 * 界面语言（i18n）子系统。
 *
 * 为什么不引 i18next 之类的库：本项目是零状态管理库、零额外依赖的纯前端，
 * 需求只有「两套静态词典 + 参数替换」，手写 40 行足够，引库反而是负担。
 *
 * 用法（组件里）：
 *   const t = useCallback((key, params) => translate(uiLang, key, params), [uiLang]);
 *   t('detectSwitched', { label: 'Python' })
 */
import zh from './zh';
import en from './en';

/** 可切换的界面语言。label 用各自语言自己的写法，不翻译（否则中文用户会看到「英语」） */
export const UI_LANGUAGES = [
  { id: 'zh', label: '中文' },
  { id: 'en', label: 'EN' },
];

export const DEFAULT_UI_LANGUAGE = 'zh';

const DICTIONARIES = { zh, en };

/**
 * 取文案并替换参数占位符。
 *
 * 缺 key 时**回落到中文**，中文也没有才把 key 原样返回——
 * 这样漏翻译会以「界面上冒出中文」的形式被立刻发现，而不是静默留空。
 */
export function translate(uiLang, key, params) {
  const dictionary = DICTIONARIES[uiLang] || DICTIONARIES[DEFAULT_UI_LANGUAGE];
  let template = dictionary[key];
  if (template === undefined) template = DICTIONARIES[DEFAULT_UI_LANGUAGE][key];
  if (template === undefined) return key;
  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  );
}

/**
 * 两套词典的 key 是否对齐。供自检调用——漏一条不会报错，只会在界面某处
 * 悄悄显示成中文，人眼不一定看得到。
 *
 * @returns {{ missingInEn: string[], missingInZh: string[], extraInEn: string[] }}
 */
export function checkDictionaryParity() {
  const zhKeys = Object.keys(zh);
  const enKeys = Object.keys(en);
  return {
    missingInEn: zhKeys.filter((key) => !(key in en)),
    missingInZh: enKeys.filter((key) => !(key in zh)),
    extraInEn: [],
  };
}
