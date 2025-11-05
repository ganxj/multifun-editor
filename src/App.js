import React, { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import './App.css';

function App() {
  const [code, setCode] = useState('');
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(true);
  const editorRef = useRef();
  
  // 从localStorage加载历史记录
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('jsonEditorHistory');
      console.log('Loading history from localStorage:', savedHistory);
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
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
      // 获取编辑器中的最新值
      const currentValue = editorRef.current.getValue();
      const formattedJson = JSON.stringify(JSON.parse(currentValue), null, 2);
      // 更新编辑器中的内容
      editorRef.current.setValue(formattedJson);
    } catch (error) {
      alert('Invalid JSON format: ' + error.message);
    }
  }

  function handleCompressJson() {
    try {
      // 获取编辑器中的最新值
      const currentValue = editorRef.current.getValue();
      const compressedJson = JSON.stringify(JSON.parse(currentValue));
      // 更新编辑器中的内容
      editorRef.current.setValue(compressedJson);
    } catch (error) {
      alert('Invalid JSON format: ' + error.message);
    }
  }

  function handleRemoveEscape() {
    try {
      // 获取编辑器中的当前值
      const currentValue = editorRef.current.getValue();
      // 只移除第一层转义字符（将双反斜杠变为单反斜杠）
      // 例如：\\\" 变成 \"
      const removedEscape = currentValue.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      // 更新编辑器中的内容
      editorRef.current.setValue(removedEscape);
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
        content: currentContent
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
    setCode(historyItem.content);
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

  // 配置Monaco Editor以支持IP访问
  function handleEditorWillMount(monaco) {
    monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Multifunctional JSON Editor</h1>
        <button onClick={handleNewPage} className="new-page-button">
          新页面
        </button>
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
                    {truncateContent(item.content)}
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
            defaultLanguage="json"
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