import React, { useState, useRef, useEffect } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import './App.css';
import { canCompress, canFormat, formatEditorContent, getFormatterLabel } from './format';
import { CORE_LANGUAGES, EXTRA_LANGUAGES, describeDetection, detectLanguage } from './detect';

// 改用本地打包的 monaco 实例（默认会从 CDN 拉取），
// 这样内置格式化能力以及离线/内网部署都不再依赖外网
loader.config({ monaco });

// 语言清单来自 src/detect/languages.json —— 同一份数据也被 craco.config.js 读取，
// 用于告诉 MonacoWebpackPlugin 需要打包哪些语言，避免两处清单不同步导致没有语法高亮
const LANGUAGE_OPTIONS = [...CORE_LANGUAGES, ...EXTRA_LANGUAGES];

function App() {
  const [code, setCode] = useState('');
  const [history, setHistory] = useState([]);
  const [showHistory] = useState(true);
  const [language, setLanguage] = useState('json'); // 新增语言状态
  const [formatting, setFormatting] = useState(false); // 格式化中（首次会懒加载对应格式化器）
  const [autoDetect, setAutoDetect] = useState(true); // 粘贴时是否自动识别语言
  const [detecting, setDetecting] = useState(false); // 识别进行中（首次会拉取检测模型）
  const [detection, setDetection] = useState(null); // 最近一次识别结果，用于工具栏提示
  const editorRef = useRef();

  // 粘贴回调只在挂载时注册一次，回调里要读到最新的语言与开关状态，因此用 ref 同步
  const languageRef = useRef(language);
  const autoDetectRef = useRef(autoDetect);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);
  useEffect(() => {
    autoDetectRef.current = autoDetect;
  }, [autoDetect]);
  
  // 从localStorage加载历史记录
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('jsonEditorHistory');
      console.log('Loading history from localStorage:', savedHistory);
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        // 更新历史记录格式以支持语言信息
        const updatedHistory = parsedHistory.map(item => {
          if (!item.hasOwnProperty('language')) {
            item.language = 'json'; // 为旧的历史记录添加默认语言
          }
          return item;
        });
        setHistory(updatedHistory);
      }
    } catch (error) {
      console.error('Failed to load history from localStorage:', error);
    }
  }, []);

  // 保存历史记录到localStorage
  useEffect(() => {
    try {
      console.log('Saving history to localStorage:', history);
      localStorage.setItem('jsonEditorHistory', JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save history to localStorage:', error);
    }
  }, [history]);

  // 切换语言：同时更新下拉框状态与编辑器模型的 language
  function applyLanguage(newLanguage) {
    setLanguage(newLanguage);
    if (editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) model.setLanguage(newLanguage);
    }
  }

  // 粘贴内容后自动识别语言。
  // 只在「识别出明确结果且编辑器支持该语言」时才切换；拿不准就保持原样，
  // 免得把用户辛苦摆好的语言改错。
  async function runDetection(text) {
    if (!text || !text.trim()) return;

    setDetecting(true);
    try {
      const result = await detectLanguage(text);

      if (!result) {
        setDetection({ status: 'unknown', message: '未能识别出语言，保持当前选择' });
        return;
      }

      if (!result.language) {
        // 识别出来了，但 Monaco 没有对应语言（如 TOML / CSV），如实告知而不乱切
        setDetection({ status: 'unsupported', message: describeDetection(result) });
        return;
      }

      if (result.language === languageRef.current) {
        setDetection({
          status: 'same',
          message: `内容确认为 ${result.label}`,
          detail: result.reason,
        });
        return;
      }

      applyLanguage(result.language);
      setDetection({
        status: 'switched',
        message: describeDetection(result),
        detail: result.reason,
      });
    } catch (error) {
      setDetection({ status: 'error', message: '语言识别失败：' + toErrorMessage(error) });
    } finally {
      setDetecting(false);
    }
  }

  function handleEditorDidMount(editor) {
    editorRef.current = editor;

    // 只在粘贴时识别：符合「粘进来一段代码」的使用直觉，
    // 也避免每次敲键都跑一遍检测
    editor.onDidPaste((event) => {
      if (!autoDetectRef.current) return;
      const model = editor.getModel();
      if (!model) return;
      runDetection(model.getValueInRange(event.range));
    });
  }

  // 各格式化器的报错形态不一致：gofmt 抛 Error，Ruff 抛的是纯字符串，
  // clang-format 则对残缺代码很宽容、通常不报错。这里统一成可读文本
  function toErrorMessage(error) {
    const raw =
      typeof error === 'string' ? error : (error && error.message) || String(error);
    return raw.length > 500 ? raw.slice(0, 500) + '…' : raw;
  }

  // 按当前语言分发到对应的格式化器（有选区则只格式化选区）
  async function handleFormat() {
    const editor = editorRef.current;
    if (!editor) return;

    setFormatting(true);
    try {
      await formatEditorContent(editor, language);
    } catch (error) {
      alert('格式化失败：' + toErrorMessage(error));
    } finally {
      setFormatting(false);
    }
  }

  function handleCompressJson() {
    try {
      // 获取编辑器实例
      const editor = editorRef.current;
      if (!editor) return;
      
      // 获取选中的文本
      const selection = editor.getSelection();
      let selectedText = editor.getModel().getValueInRange(selection);
      
      // 如果没有选中文本，则对整个编辑器内容进行压缩
      if (!selectedText || selectedText.trim() === '') {
        const currentValue = editor.getValue();
        const compressedJson = JSON.stringify(JSON.parse(currentValue));
        editor.setValue(compressedJson);
        return;
      }
      
      // 对选中的文本进行压缩
      const compressedJson = JSON.stringify(JSON.parse(selectedText));
      
      // 替换选中的文本为压缩后的内容
      editor.executeEdits('', [{
        range: selection,
        text: compressedJson
      }]);
      
      // 移动光标到压缩后的内容末尾
      editor.setPosition({ 
        lineNumber: selection.endLineNumber, 
        column: selection.startColumn + compressedJson.length 
      });
      editor.focus();
    } catch (error) {
      alert('Invalid JSON format: ' + error.message);
    }
  }

  function handleRemoveEscape() {
    try {
      // 获取编辑器实例
      const editor = editorRef.current;
      if (!editor) return;
      
      // 获取选中的文本
      const selection = editor.getSelection();
      let selectedText = editor.getModel().getValueInRange(selection);
      
      // 如果没有选中文本，则对整个编辑器内容进行处理
      if (!selectedText || selectedText.trim() === '') {
        const currentValue = editor.getValue();
        // 只移除第一层转义字符（将双反斜杠变为单反斜杠）
        // 例如：\\\" 变成 \"
        const removedEscape = currentValue.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        editor.setValue(removedEscape);
        return;
      }
      
      // 对选中的文本进行转义字符处理
      const removedEscape = selectedText.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      
      // 替换选中的文本为处理后的内容
      editor.executeEdits('', [{
        range: selection,
        text: removedEscape
      }]);
      
      // 移动光标到处理后的内容末尾
      editor.setPosition({ 
        lineNumber: selection.endLineNumber, 
        column: selection.startColumn + removedEscape.length 
      });
      editor.focus();
    } catch (error) {
      alert('Error removing escape character: ' + error.message);
    }
  }

  function handleNewPage() {
    // 保存当前内容到历史记录
    // 直接从编辑器获取内容而不是从state获取
    const currentContent = editorRef.current ? editorRef.current.getValue() : code;
    if (currentContent && currentContent.trim()) {
      const newHistoryItem = {
        id: Date.now(),
        timestamp: new Date().toLocaleString(),
        content: currentContent,
        language: language // 保存当前语言设置
      };
      
      setHistory(prevHistory => [newHistoryItem, ...prevHistory]);
    }
    
    // 清空编辑器
    const newPageContent = '';
    setCode(newPageContent);
    if (editorRef.current) {
      editorRef.current.setValue(newPageContent);
    }
  }

  function handleLoadFromHistory(historyItem) {
    // 检查当前编辑器是否包含内容
    const currentContent = editorRef.current ? editorRef.current.getValue() : code;
    
    // 如果当前编辑器有内容，提示用户确认
    if (currentContent && currentContent.trim()) {
      const userConfirmed = window.confirm('当前编辑器有内容，加载历史记录将覆盖当前内容，是否继续？');
      if (!userConfirmed) {
        return; // 用户取消操作
      }
    }
    
    setCode(historyItem.content);
    // 恢复保存的语言设置，如果不存在则默认为json
    applyLanguage(historyItem.language || 'json');
    if (editorRef.current) {
      editorRef.current.setValue(historyItem.content);
    }
  }

  function handleDeleteFromHistory(historyItemId) {
    setHistory(prevHistory => prevHistory.filter(item => item.id !== historyItemId));
  }

  function handleEditorChange(value) {
    setCode(value);
  }

  function truncateContent(content) {
    const lines = content.split('\n');
    if (lines.length > 1) {
      return lines[0].substring(0, 50) + (lines[0].length > 50 ? '...' : '') + '...';
    }
    return content.substring(0, 50) + (content.length > 50 ? '...' : '');
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

  // 手动选择语言：用户的明确意图优先，自动识别让位，
  // 否则下次粘贴又会被自动改掉，反而更难用
  function handleLanguageChange(newLanguage) {
    applyLanguage(newLanguage);
    if (autoDetectRef.current) {
      setAutoDetect(false);
      setDetection({ status: 'manual', message: '已手动指定语言，自动识别已暂停' });
    } else {
      setDetection(null);
    }
  }

  const languageLabel =
    (LANGUAGE_OPTIONS.find((option) => option.value === language) || {}).label || language;
  const formatterLabel = getFormatterLabel(language);
  const formatAllowed = canFormat(language);
  const compressAllowed = canCompress(language);

  return (
    <div className="App">
      <header className="App-header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img src={`${process.env.PUBLIC_URL}/img/logo.png`} alt="peek" className="logo" />
          <h1>
            peek
            <span className="app-tagline">贴进来，看一眼就够</span>
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* 语言选择下拉框 */}
          <select 
            value={language} 
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="language-select"
            title={autoDetect ? '粘贴代码时会自动识别语言' : '自动识别已暂停'}
          >
            <optgroup label="常用">
              {CORE_LANGUAGES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="自动识别可切换">
              {EXTRA_LANGUAGES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          </select>
          <button onClick={handleNewPage} className="new-page-button">
            新页面
          </button>
        </div>
      </header>
      
      {/* 工具栏区域 */}
      <div className="toolbar">
        <button
          onClick={handleFormat}
          className="format-button"
          disabled={!formatAllowed || formatting}
          title={
            formatAllowed
              ? `用 ${formatterLabel} 格式化当前语言（有选中内容时只格式化选区）`
              : `${languageLabel} 暂不支持格式化`
          }
        >
          {formatting ? '格式化中…' : `格式化 ${languageLabel}`}
        </button>
        <button
          onClick={handleRemoveEscape}
          className="format-button"
          title="移除一层 JSON 转义字符（有选中内容时只处理选区）"
        >
          去除转义
        </button>
        <button
          onClick={handleCompressJson}
          className="format-button"
          disabled={!compressAllowed}
          title={compressAllowed ? '压缩为单行 JSON' : '压缩只对 JSON 有效'}
        >
          压缩
        </button>
        <span className="toolbar-hint">
          {formatAllowed ? `格式化器：${formatterLabel}` : `${languageLabel} 无格式化支持`}
        </span>

        <label className="auto-detect-toggle" title="粘贴代码时自动识别语言并切换">
          <input
            type="checkbox"
            checked={autoDetect}
            onChange={(e) => {
              setAutoDetect(e.target.checked);
              setDetection(null);
            }}
          />
          自动识别语言
        </label>

        {detecting && <span className="detect-notice">识别中…</span>}

        {!detecting && detection && (
          <span
            className={`detect-notice detect-${detection.status}`}
            title={detection.detail || ''}
          >
            {detection.message}
            <button
              type="button"
              className="detect-dismiss"
              onClick={() => setDetection(null)}
              aria-label="关闭提示"
            >
              ×
            </button>
          </span>
        )}
      </div>
      
      <div className="main-content">
        {showHistory && (
          <div className="history-panel">
            <div className="history-header">
              <h3>历史记录</h3>
            </div>
            <div className="history-list">
              {history.map(item => (
                <div 
                  key={item.id} 
                  className="history-item"
                  onClick={() => handleLoadFromHistory(item)}
                >
                  <div className="history-timestamp">{item.timestamp}</div>
                  <div className="history-content" title={item.content}>
                    [{item.language || 'json'}] {truncateContent(item.content)}
                  </div>
                  <div 
                    className="delete-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFromHistory(item.id);
                    }}
                  >
                    ×
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="editor-container">
          <Editor
            height="80vh"
            language={language}
            value={code}
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            beforeMount={handleEditorWillMount}
            theme="vs"
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default App;