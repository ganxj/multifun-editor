/**
 * 格式化链路自检（仅在 ?selftest=1 时按需加载）。
 *
 * 各语言的 wasm 是独立资源文件、按需拉取，一旦路径或加载方式出问题，
 * 页面不会报错、只会默默不格式化，因此需要一个能一条命令跑完的检查。
 *
 * 用法：打开 `/?selftest=1`，控制台执行 `window.__formatSelfTest()`。
 * 断言的是「输出里必须包含的片段」而不是「内容变没变」——
 * 曾经因为只判断“变了没”，把写坏成 "[object Promise]" 的情况误判为通过。
 */
import * as monaco from 'monaco-editor';
import { canFormat, formatEditorContent, getFormatterLabel } from './format';

// expect 是格式化结果里必须出现的片段；forbid 是绝不能出现的片段
const MONACO_NATIVE_CASES = [
  {
    language: 'json',
    sample: '{"b":1,"a":[1,2,{"c":3}]}',
    expect: ['"b": 1', '"a": ['],
  },
  {
    language: 'javascript',
    sample: 'const f=(a,b)=>{return a+b}',
    expect: ['return a + b'],
  },
  {
    language: 'typescript',
    sample: 'interface A{name:string}\nconst x:A={name:"1"}',
    expect: ['name: string'],
  },
  {
    language: 'html',
    sample: '<!DOCTYPE html><html><head><title>t</title></head><body><p>hi</p></body></html>',
    expect: ['<p>hi</p>'],
  },
  {
    language: 'css',
    sample: '.a{color:red;margin:0}',
    expect: ['color: red'],
  },
];

const WASM_CASES = [
  { language: 'c', sample: 'int main(){int a=1;return 0;}', expect: ['int a = 1;'] },
  {
    language: 'cpp',
    sample: '#include <iostream>\nint main(){std::cout<<"hi"<<std::endl;return 0;}',
    expect: ['std::cout << "hi"'],
  },
  { language: 'csharp', sample: 'class A{static void Main(){int a=1;}}', expect: ['int a = 1;'] },
  {
    language: 'java',
    sample: 'public class A{public static void main(String[] x){int a=1;}}',
    expect: ['int a = 1;', 'public class A {'],
  },
  { language: 'python', sample: 'def f(a,b):\n  return a+b', expect: ['def f(a, b):', 'return a + b'] },
  {
    language: 'go',
    sample: 'package main\nimport "fmt"\nfunc main(){fmt.Println("hi")}',
    expect: ['fmt.Println("hi")'],
  },
];

const FORBIDDEN = ['[object', 'undefined', 'function '];

function createEditor(language, value) {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-9999px;top:0;width:520px;height:220px;';
  document.body.appendChild(host);
  const editor = monaco.editor.create(host, {
    language,
    value,
    automaticLayout: false,
    minimap: { enabled: false },
  });
  return { editor, host };
}

// 语言服务跑在 web worker 里，等它真正就绪再格式化。
// 命名空间位置随 monaco 版本变化（0.55 起从 languages.typescript 提到顶层 monaco.typescript），
// 两处都试；拿不到就跳过等待，不能让自检本身抛错
async function waitForWorker(language) {
  const ts = monaco.typescript || (monaco.languages && monaco.languages.typescript);
  if (!ts) return;
  if (language === 'javascript' && typeof ts.getJavaScriptWorker === 'function') {
    await ts.getJavaScriptWorker();
  }
  if (language === 'typescript' && typeof ts.getTypeScriptWorker === 'function') {
    await ts.getTypeScriptWorker();
  }
}

async function runCase(item, log) {
  const { editor, host } = createEditor(item.language, item.sample);
  const started = Date.now();
  try {
    if (canFormat(item.language)) {
      await waitForWorker(item.language);

      let value = item.sample;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await formatEditorContent(editor, item.language);
        value = editor.getValue();
        if (value !== item.sample) break;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    const value = editor.getValue();
    const changed = value !== item.sample;
    const missing = item.expect.filter((needle) => !value.includes(needle));
    const forbidden = FORBIDDEN.filter((needle) => value.includes(needle));
    const ok = changed && missing.length === 0 && forbidden.length === 0;

    log(
      `[${ok ? 'PASS' : 'FAIL'}] ${item.language} (${getFormatterLabel(item.language)}) ` +
        `${Date.now() - started}ms`
    );
    if (!ok) {
      if (!changed) log('        未发生任何变化');
      if (missing.length) log('        缺少期望片段: ' + JSON.stringify(missing));
      if (forbidden.length) log('        出现非法片段: ' + JSON.stringify(forbidden));
    }
    log('        结果: ' + JSON.stringify(value.slice(0, 100)));
    return ok;
  } catch (error) {
    log(`[FAIL] ${item.language} 抛异常: ${(error && error.message) || String(error)}`);
    return false;
  } finally {
    editor.dispose();
    host.remove();
  }
}

export async function runFormatSelfTest() {
  const lines = [];
  const log = (text) => lines.push(text);
  let passed = 0;
  let total = 0;

  log(`monaco 本地加载: ${typeof monaco.editor.create === 'function'}`);
  log(`未支持语言被拦截: ${canFormat('text') === false}`);

  // App 自身的挂载必须单独算一项：下面的用例都是自建编辑器实例来验证格式化器，
  // 即使 React <Editor> 在 beforeMount/onMount 阶段抛错、整页白屏，
  // 那些用例依旧全绿。这个盲区曾经让「挂载即崩」的问题漏过了一轮验证
  total += 1;
  const root = document.getElementById('root');
  const rootChildren = root ? root.childElementCount : -1;
  const editorInRoot = Boolean(root && root.querySelector('.monaco-editor, textarea'));
  const mountOk = rootChildren > 0 && editorInRoot;
  log(`[${mountOk ? 'PASS' : 'FAIL'}] App 挂载 (root 子节点 ${rootChildren}, 编辑器已渲染 ${editorInRoot})`);
  if (mountOk) passed += 1;

  for (const item of [...MONACO_NATIVE_CASES, ...WASM_CASES]) {
    total += 1;
    if (await runCase(item, log)) passed += 1;
  }

  log(`==== ${passed}/${total} 通过 ====`);
  return lines.join('\n');
}

window.__formatSelfTest = runFormatSelfTest;
