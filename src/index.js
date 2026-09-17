import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <App />
);

// 诊断入口：访问 ?selftest=1 时加载自检模块，
// 可在浏览器里执行 window.__formatSelfTest()（逐语言验证格式化链路，见 src/formatSelfTest.js）
// 与 window.__detectSelfTest()（验证语言自动识别，见 src/detectSelfTest.js）
// 以及 window.__i18nCheck()（检查中英词典 key 是否对齐）
if (new URLSearchParams(window.location.search).has('selftest')) {
  Promise.all([import('./formatSelfTest'), import('./detectSelfTest'), import('./i18n')])
    .then(([, , i18n]) => {
      // 词典漏一条不会抛错，只会在界面某处悄没声地回落成中文，
      // 所以把它做成可断言的函数挂出来，交给 cdp-selftest.js 去卡
      window.__i18nCheck = i18n.checkDictionaryParity;
    })
    .then(() => {
      document.title = 'SELFTEST-READY';
    });
}