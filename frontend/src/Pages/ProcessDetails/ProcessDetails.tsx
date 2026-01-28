import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import MemoryInfo from './MemoryView/MemoryInfo'
import ModuleInfo from './ModuleView/ModuleInfo'
import ScriptInfo from './ScriptView/ScriptInfo'
import IL2CPPHierarchy from './IL2CPPView/IL2CPPHierarchy'

const ProcessDetails: React.FC = () => {
  const { pid } = useParams<{ pid: string }>()
  const [activeTab, setActiveTab] = useState('memory')
  const [isIL2CPPDetected, setIsIL2CPPDetected] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    const socketInstance = io('http://localhost:5000')
    setSocket(socketInstance)
    setIsIL2CPPDetected(true)
    socketInstance.on('il2cpp_detected', (data) => {
      if (data.success && data.pid === Number(pid)) {
        // setIsIL2CPPDetected(data.detected)
       
      }
    })

    socketInstance.emit('detect_il2cpp', { pid: Number(pid) })

    return () => {
      socketInstance.close()
    }
  }, [pid])

  const baseTabs = [
    { id: 'memory', name: '内存信息' },
    { id: 'modules', name: '模块信息' },
    { id: 'scripts', name: '自定义脚本' },
  ]

  const tabs = isIL2CPPDetected
    ? [...baseTabs, { id: 'il2cpp', name: 'IL2CPP层级' }]
    : baseTabs

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-2 text-center">
        进程详情 (PID: {pid})
      </h1>
      <div className="mb-6">
        <nav className="flex space-x-4 justify-center">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`px-4 py-2 font-medium text-sm rounded-md transition duration-150 ease-in-out ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>
      <div className="bg-white shadow-md rounded-lg p-6">
        {activeTab === 'memory' && <MemoryInfo pid={Number(pid)} />}
        {activeTab === 'modules' && <ModuleInfo pid={Number(pid)} />}
        {activeTab === 'scripts' && <ScriptInfo pid={Number(pid)} />}
        {activeTab === 'il2cpp' && isIL2CPPDetected && <IL2CPPHierarchy pid={Number(pid)} />}
      </div>
    </div>
  )
}

export default ProcessDetails
