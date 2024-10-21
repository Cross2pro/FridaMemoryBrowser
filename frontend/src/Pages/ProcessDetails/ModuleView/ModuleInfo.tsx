import React, { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import ModuleDetails from './ModuleDetails'

const socket = io('http://localhost:5000')

interface ModuleInfoProps {
  pid: number;
}

interface Module {
  name: string;
  base: string;
  size: number;
  path: string;
}

const ModuleInfo: React.FC<ModuleInfoProps> = ({ pid }) => {
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedModule, setSelectedModule] = useState<Module | null>(null)

  useEffect(() => {
    socket.emit('enumerate_modules', { pid })

    socket.on('modules_list', (data: { success: boolean, pid: number, modules: Module[] }) => {
      if (data.success && data.pid === pid) {
        setModules(data.modules)
        setLoading(false)
      }
    })

    return () => {
      socket.off('modules_list')
    }
  }, [pid])

  const handleModuleClick = (module: Module) => {
    setSelectedModule(module)
  }

  if (loading) {
    return <div className="text-center">加载中...</div>
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">模块信息</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">模块名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">内存范围</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">模块路径</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {modules.map((module, index) => (
                <tr key={index} onClick={() => handleModuleClick(module)} className="cursor-pointer hover:bg-gray-100">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{module.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {module.base} - {(BigInt(module.base) + BigInt(module.size)).toString(16).toUpperCase()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{module.path}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          {selectedModule && <ModuleDetails pid={pid} module={selectedModule} />}
        </div>
      </div>
    </div>
  )
}

export default ModuleInfo
