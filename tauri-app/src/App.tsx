import { useState, useEffect } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [processes, setProcesses] = useState<Array<{pid: number, name: string}>>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    // 在组件加载时获取进程列表
    fetchProcesses();
  }, []);

  const fetchProcesses = async () => {
    try {
      const response = await fetch('http://localhost:5000/processes');
      const data = await response.json();
      if (response.ok) {
        setProcesses(data);
        setError("");
      } else {
        setError(data.error || "Failed to fetch processes");
      }
    } catch (err) {
      setError("Failed to connect to Python backend");
    }
  };

  return (
    <main className="container">
      <h1>Frida Memory Browser</h1>

      <div className="process-list">
        <h2>进程列表</h2>
        {error && <div className="error">{error}</div>}
        <button onClick={fetchProcesses}>刷新进程列表</button>
        <div className="process-table">
          <table>
            <thead>
              <tr>
                <th>PID</th>
                <th>进程名</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {processes.map((process) => (
                <tr key={process.pid}>
                  <td>{process.pid}</td>
                  <td>{process.name}</td>
                  <td>
                    <button onClick={() => {
                      // 这里添加附加到进程的功能
                      console.log(`Attach to process ${process.pid}`);
                    }}>
                      附加
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

export default App;
