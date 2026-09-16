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
if (new URLSearchParams(window.location.search).has('selftest')) {
  Promise.all([import('./formatSelfTest'), import('./detectSelfTest')]).then(() => {
    document.title = 'SELFTEST-READY';
  });
}