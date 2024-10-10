import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import MemoryInfo from './MemoryInfo'

interface Process {
  pid: number;
  name: string;
}

const ProcessDetails: React.FC = () => {
  const { pid } = useParams<{ pid: string }>()
  const [activeTab, setActiveTab] = useState('memory')
  const [process, setProcess] = useState<Process | null>(null)

  useEffect(() => {
    const fetchProcessDetails = async () => {
      try {
        const response = await fetch(`http://localhost:5000/process/${pid}`)
        const data = await response.json()
        setProcess(data)
      } catch (error) {
        console.error('Error fetching process details:', error)
      }
    }

    fetchProcessDetails()
  }, [pid])

  const tabs = [
    { id: 'memory', name: '内存信息' },
    { id: 'functions', name: '函数信息' },
    { id: 'hooks', name: 'HOOK信息' },
    { id: 'scripts', name: '自定义脚本' },
  ]

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-2 text-center">
        进程详情 {process && `(${process.name})`}
      </h1>
      <h2 className="text-xl mb-6 text-center text-gray-600">PID: {pid}</h2>
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
        {/* 其他标签页的内容 */}
      </div>
    </div>
  )
}

export default ProcessDetails