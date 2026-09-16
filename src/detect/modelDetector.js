/**
 * 语言检测模型的浏览器端封装。
 *
 * 用的是 @vscode/vscode-languagedetection —— VS Code 自己用来做「粘贴时自动识别语言」
 * 的那个模型（guesslang 的 ML 模型，54 类）。
 *
 * 两个必须自己处理的点：
 * 1. 该包默认用 Node 的 fs 读 model/model.json 与权重文件，浏览器里没有 fs，
 *    因此必须通过 modelJsonLoaderFunc / weightsLoaderFunc 注入浏览器端的加载方式。
 * 2. 包内打进了 tfjs，其中 Node 专用的 io 代码静态引用了 fs/http/zlib 等模块，
 *    需要由 craco 里的 resolve.fallback 把它们指向空模块（那些代码路径我们不会走到）。
 *
 * 整个模型按需加载：只有真正需要识别、且结构化规则判不出来时才会下载，
 * 不占首屏体积。
 */
import { MODEL_LANGUAGE_LABELS, MODEL_LANGUAGE_MAP } from './languageCatalog';

/** 内容短于该长度时模型判断不可靠，直接跳过 */
export const MIN_CONTENT_LENGTH = 30;

/** 低于该置信度宁可不切换语言，也不要改错 */
export const MIN_CONFIDENCE = 0.2;

let operationsPromise = null;

function loadOperations() {
  if (operationsPromise) return operationsPromise;

  operationsPromise = Promise.all([
    import('@vscode/vscode-languagedetection'),
    import('@vscode/vscode-languagedetection/model/model.json'),
    import('@vscode/vscode-languagedetection/model/group1-shard1of1.bin'),
  ])
    .then(([pkg, modelJsonModule, weightsModule]) => {
      // JSON 模块与资源模块的默认导出分别是「已解析的对象」和「资源 URL」
      const modelJson = modelJsonModule.default || modelJsonModule;
      const weightsUrl = weightsModule.default || weightsModule;

      return new pkg.ModelOperations({
        modelJsonLoaderFunc: async () => modelJson,
        weightsLoaderFunc: async () => {
          const response = await fetch(weightsUrl);
          if (!response.ok) {
            throw new Error(`检测模型权重加载失败（HTTP ${response.status}）`);
          }
          return response.arrayBuffer();
        },
        minContentSize: MIN_CONTENT_LENGTH,
        maxContentSize: 100000,
        normalizeNewline: true,
      });
    })
    .catch((error) => {
      // 加载失败必须清掉缓存，否则一次网络抖动会让自动识别永久失效
      operationsPromise = null;
      throw error;
    });

  return operationsPromise;
}

/** 模型是否已经加载过（用于提示当前状态，不触发加载） */
export function isModelLoaded() {
  return operationsPromise !== null;
}

/**
 * 用模型识别语言。
 * @returns {Promise<{language: string|null, label: string, confidence: number, source: 'model', reason: string, candidates: Array}|null>}
 *          null 表示内容太短或置信度不足，无法给出结论
 */
export async function detectByModel(text) {
  if (!text || text.length < MIN_CONTENT_LENGTH) return null;

  const operations = await loadOperations();
  const results = await operations.runModel(text);
  if (!results || results.length === 0) return null;

  const [best] = results;
  if (!best || best.confidence < MIN_CONFIDENCE) return null;

  return {
    language: MODEL_LANGUAGE_MAP[best.languageId] || null,
    label: MODEL_LANGUAGE_LABELS[best.languageId] || best.languageId,
    confidence: best.confidence,
    source: 'model',
    reason: `模型置信度 ${Math.round(best.confidence * 100)}%`,
    candidates: results.slice(0, 3).map((item) => ({
      label: MODEL_LANGUAGE_LABELS[item.languageId] || item.languageId,
      language: MODEL_LANGUAGE_MAP[item.languageId] || null,
      confidence: item.confidence,
    })),
  };
}
