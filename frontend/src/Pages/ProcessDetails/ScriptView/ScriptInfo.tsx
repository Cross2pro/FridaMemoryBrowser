import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { debounce } from 'lodash';

const socket = io('http://localhost:5000');

interface ScriptInfoProps {
  pid: number;
}

interface Script {
  name: string;
  content: string;
  path: string;
}

interface LogEntry {
  id: number;
  title: string;
  type: string;
  timestamp: string;
  stackTrace?: string;
  args?: any[];
  returnValue?: any;
  message?: string;
}

const ScriptInfo: React.FC<ScriptInfoProps> = ({ pid }) => {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [selectedScript, setSelectedScript] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isScriptListCollapsed, setIsScriptListCollapsed] = useState(false);

  useEffect(() => {
    fetchScripts();
    setupSocketListeners();

    return () => {
      socket.off('script_loaded');
      socket.off('script_log');
      socket.off('script_logs');
      socket.off('script_logs_cleared');
      socket.off('script_error');
    };
  }, [pid]);

  const fetchScripts = async () => {
    try {
      const response = await fetch('http://localhost:5000/scripts');
      const data = await response.json();
      setScripts(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching scripts:', error);
      setLoading(false);
    }
  };

  const setupSocketListeners = () => {
    socket.on('script_loaded', (data: { success: boolean; pid: number; scriptName: string; error?: string }) => {
      if (data.success && data.pid === pid) {
        console.log(`Script ${data.scriptName} loaded successfully`);
        setError(null);
        socket.emit('get_script_logs', { pid });
      } else if (data.pid === pid) {
        console.error(`Failed to load script: ${data.error}`);
        setError(`加载脚本失败: ${data.error}`);
      }
    });

    socket.on('script_log', (data: { pid: number; log: LogEntry }) => {
      if (data.pid === pid) {
        setLogs(prevLogs => [...prevLogs, data.log]);
      }
    });

    socket.on('script_logs', (data: { success: boolean; pid: number; logs: LogEntry[] }) => {
      if (data.success && data.pid === pid) {
        setLogs(data.logs);
      }
    });

    socket.on('script_logs_cleared', (data: { success: boolean; pid: number }) => {
      if (data.success && data.pid === pid) {
        setLogs([]);
        setSelectedLog(null);
      }
    });

    socket.on('script_error', (data: { pid: number; error: string }) => {
      if (data.pid === pid) {
        setError(`脚本执行错误: ${data.error}`);
      }
    });
  };

  const handleScriptSelect = (scriptName: string) => {
    setSelectedScript(scriptName);
    handleLoadScript(scriptName);
  };

  const handleLoadScript = (scriptName: string) => {
    socket.emit('load_script', { pid, scriptName });
  };

  const handleReloadScript = () => {
    if (selectedScript) {
      handleLoadScript(selectedScript);
    }
  };

  const handleClearLogs = () => {
    socket.emit('clear_script_logs', { pid });
  };

  const handleLogSelect = (log: LogEntry) => {
    setSelectedLog(log);
  };

  const debouncedSearch = debounce((term: string) => setSearchTerm(term), 300);

  const filteredLogs = logs.filter(log =>
    log.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.message && log.message.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return <div className="text-center">加载中...</div>;
  }

  const LogRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const log = filteredLogs[index];
    return (
      <div
        style={style}
        onClick={() => handleLogSelect(log)}
        className={`cursor-pointer hover:bg-gray-100 ${selectedLog?.id === log.id ? 'bg-blue-50' : ''}`}
      >
        <div className="grid grid-cols-4 gap-4 py-2 px-4 items-center">
          <div className="text-gray-600">#{log.id}</div>
          <div className="font-medium">{log.title}</div>
          <div className="text-sm text-gray-600">{log.type}</div>
          <div className="text-sm text-gray-600">{log.timestamp}</div>
        </div>
      </div>
    );
  };

  const getScriptInitial = (scriptName: string) => {
    return scriptName.charAt(0).toUpperCase();
  };

  return (
    <div className="container mx-auto p-4">
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      <div className="flex gap-4 h-[calc(100vh-200px)]">
        {/* 脚本列表 */}
        <div className={`transition-all duration-300 ${isScriptListCollapsed ? 'w-12' : 'w-64'}`}>
          <div className="bg-white shadow-md rounded-lg p-4 h-full">
            <div className="flex justify-between items-center mb-4">
              {!isScriptListCollapsed && <h3 className="text-lg font-semibold">可用脚本</h3>}
              <div className="flex gap-2">
                {selectedScript && !isScriptListCollapsed && (
                  <button
                    onClick={handleReloadScript}
                    className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                    title="重新加载当前脚本"
                  >
                    重新加载
                  </button>
                )}
                <button
                  onClick={() => setIsScriptListCollapsed(!isScriptListCollapsed)}
                  className="p-1 text-gray-500 hover:text-gray-700"
                  title={isScriptListCollapsed ? "展开" : "折叠"}
                >
                  {isScriptListCollapsed ? "→" : "←"}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {scripts.map((script) => (
                <button
                  key={script.name}
                  onClick={() => handleScriptSelect(script.name)}
                  className={`w-full text-left py-2 rounded ${
                    selectedScript === script.name
                      ? 'bg-blue-500 text-white'
                      : 'hover:bg-gray-100'
                  }`}
                  title={isScriptListCollapsed ? script.name : undefined}
                >
                  {isScriptListCollapsed ? (
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                      {getScriptInitial(script.name)}
                    </div>
                  ) : (
                    script.name
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 日志区域 */}
        <div className="flex-1 flex flex-col">
          {/* 搜索和清除按钮 */}
          <div className="flex justify-between items-center mb-4">
            <input
              type="text"
              placeholder="搜索日志..."
              className="flex-1 p-2 border rounded mr-4"
              onChange={(e) => debouncedSearch(e.target.value)}
            />
            <button
              onClick={handleClearLogs}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              清除日志
            </button>
          </div>

          {/* 日志列表 */}
          <div className="flex-1 bg-white shadow-md rounded-lg overflow-hidden mb-4">
            <div className="grid grid-cols-4 gap-4 py-2 px-4 bg-gray-100 font-semibold">
              <div>ID</div>
              <div>标题</div>
              <div>类型</div>
              <div>时间</div>
            </div>
            <div className="h-[calc(100%-40px)]">
              <AutoSizer>
                {({ height, width }) => (
                  <List
                    height={height}
                    itemCount={filteredLogs.length}
                    itemSize={40}
                    width={width}
                  >
                    {LogRow}
                  </List>
                )}
              </AutoSizer>
            </div>
          </div>

          {/* 日志详情 */}
          <div className="bg-white shadow-md rounded-lg p-4 h-96 overflow-auto">
            <h3 className="text-lg font-semibold mb-4">日志详情</h3>
            {selectedLog ? (
              <div className="space-y-4">
                <div>
                  <span className="font-semibold">标题：</span>
                  <span className="break-all">{selectedLog.title}</span>
                </div>
                <div>
                  <span className="font-semibold">类型：</span>
                  <span className="break-all">{selectedLog.type}</span>
                </div>
                <div>
                  <span className="font-semibold">时间：</span>
                  <span className="break-all">{selectedLog.timestamp}</span>
                </div>
                {selectedLog.message && (
                  <div>
                    <span className="font-semibold">消息：</span>
                    <span className="break-all">{selectedLog.message}</span>
                  </div>
                )}
                {selectedLog.args && (
                  <div>
                    <span className="font-semibold">参数：</span>
                    <pre className="bg-gray-50 p-2 rounded mt-1 overflow-auto max-h-32 break-all whitespace-pre-wrap">
                      {JSON.stringify(selectedLog.args, null, 2)}
                    </pre>
                  </div>
                )}
                {selectedLog.returnValue !== undefined && (
                  <div>
                    <span className="font-semibold">返回值：</span>
                    <pre className="bg-gray-50 p-2 rounded mt-1 overflow-auto max-h-32 break-all whitespace-pre-wrap">
                      {JSON.stringify(selectedLog.returnValue, null, 2)}
                    </pre>
                  </div>
                )}
                {selectedLog.stackTrace && (
                  <div>
                    <span className="font-semibold">调用栈：</span>
                    <pre className="bg-gray-50 p-2 rounded mt-1 overflow-auto max-h-32 text-xs break-all whitespace-pre-wrap">
                      {selectedLog.stackTrace}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-500 text-center">
                选择一条日志查看详情
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScriptInfo; 