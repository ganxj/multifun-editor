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