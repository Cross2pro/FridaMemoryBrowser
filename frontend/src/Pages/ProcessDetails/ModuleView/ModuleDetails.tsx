import React, { useState, useEffect } from 'react'
import { io } from 'socket.io-client'

const socket = io('http://localhost:5000')

interface ModuleDetailsProps {
  pid: number;
  module: {
    name: string;
    base: string;
    size: number;
    path: string;
  };
}

interface ImportExport {
  name: string;
  address: string;
}

const ModuleDetails: React.FC<ModuleDetailsProps> = ({ pid, module }) => {
  const [imports, setImports] = useState<ImportExport[]>([])
  const [exports, setExports] = useState<ImportExport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    socket.emit('get_module_details', { pid, moduleName: module.name })

    socket.on('module_details', (data: { success: boolean, pid: number, imports: ImportExport[], exports: ImportExport[] }) => {
      if (data.success && data.pid === pid) {
        setImports(data.imports)
        setExports(data.exports)
        setLoading(false)
      }
    })

    return () => {
      socket.off('module_details')
    }
  }, [pid, module.name])

  const handleDump = () => {
    // 创建一个隐藏的 <a> 元素来触发文件下载
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = `http://localhost:5000/dump_module?pid=${pid}&moduleName=${module.name}`;
    link.download = `${module.name}_${pid}.bin`;
    
    // 将链接添加到文档并模拟点击
    document.body.appendChild(link);
    link.click();
    
    // 清理
    document.body.removeChild(link);
  }

  if (loading) {
    return <div>加载模块详情中...</div>
  }

  return (
    <div>
      <h3 className="text-xl font-bold mb-2">{module.name} 详情</h3>
      <button onClick={handleDump} className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
        Dump 模块
      </button>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-lg font-semibold mb-2">导入表</h4>
          <ul className="list-disc list-inside">
            {imports.map((imp, index) => (
              <li key={index}>{imp.name} - {imp.address}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-lg font-semibold mb-2">导出表</h4>
          <ul className="list-disc list-inside">
            {exports.map((exp, index) => (
              <li key={index}>{exp.name} - {exp.address}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default ModuleDetails
