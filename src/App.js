import React, { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import './App.css';

function App() {
  const [code, setCode] = useState('');
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(true);
  const [language, setLanguage] = useState('json'); // 新增语言状态
  const editorRef = useRef();
  
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

  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor;
  }

  function handleFormatJson() {
    try {
      // 获取编辑器实例
      const editor = editorRef.current;
      if (!editor) return;
      
      // 获取选中的文本
      const selection = editor.getSelection();
      let selectedText = editor.getModel().getValueInRange(selection);
      
      // 如果没有选中文本，则对整个编辑器内容进行格式化
      if (!selectedText || selectedText.trim() === '') {
        const currentValue = editor.getValue();
        const formattedJson = JSON.stringify(JSON.parse(currentValue), null, 2);
        editor.setValue(formattedJson);
        return;
      }
      
      // 对选中的文本进行格式化
      const formattedJson = JSON.stringify(JSON.parse(selectedText), null, 2);
      
      // 替换选中的文本为格式化后的内容
      editor.executeEdits('', [{
        range: selection,
        text: formattedJson
      }]);
      
      // 移动光标到格式化后的内容末尾
      const endLineNumber = selection.endLineNumber;
      const endColumn = formattedJson.split('\n').pop().length + 1;
      editor.setPosition({ lineNumber: endLineNumber, column: endColumn });
      editor.focus();
    } catch (error) {
      alert('Invalid JSON format: ' + error.message);
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
    setLanguage(historyItem.language || 'json');
    if (editorRef.current) {
      editorRef.current.setValue(historyItem.content);
      // 更新编辑器的语言模式
      editorRef.current.getModel().setLanguage(historyItem.language || 'json');
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

  // 配置Monaco Editor以支持IP访问
  function handleEditorWillMount(monaco) {
    monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);
  }

  // 处理语言变更
  function handleLanguageChange(newLanguage) {
    setLanguage(newLanguage);
    if (editorRef.current) {
      editorRef.current.getModel().setLanguage(newLanguage);
    }
  }

  return (
    <div className="App">
      <header className="App-header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img src={`${process.env.PUBLIC_URL}/img/logo.png`} alt="Logo" className="logo" />
          <h1>Multifunctional JSON Editor</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* 语言选择下拉框 */}
          <select 
            value={language} 
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="language-select"
          >
            <option value="json">JSON</option>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="html">HTML</option>
            <option value="css">CSS</option>
            <option value="java">Java</option>
            <option value="python">Python</option>
            <option value="go">Go</option>
            <option value="c">C</option>
            <option value="cpp">C++</option>
            <option value="csharp">C#</option>
            <option value="php">PHP</option>
            <option value="ruby">Ruby</option>
            <option value="sql">SQL</option>
            <option value="yaml">YAML</option>
            <option value="xml">XML</option>
            <option value="text">Plain Text</option>
          </select>
          <button onClick={handleNewPage} className="new-page-button">
            新页面
          </button>
        </div>
      </header>
      
      {/* 工具栏区域 */}
      <div className="toolbar">
        <button onClick={handleFormatJson} className="format-button">
          格式化JSON
        </button>
        <button onClick={handleRemoveEscape} className="format-button">
          去除转义
        </button>
        <button onClick={handleCompressJson} className="format-button">
          压缩
        </button>
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