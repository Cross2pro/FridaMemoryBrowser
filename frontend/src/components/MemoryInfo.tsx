import React, { useState } from 'react'
import { io } from 'socket.io-client'

const socket = io('http://localhost:5000')

const MemoryInfo: React.FC = () => {
  const [address, setAddress] = useState('')
  const [memoryData, setMemoryData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    socket.emit('read_memory', { address: parseInt(address, 16), size: 64 })
  }

  socket.on('memory_data', (data) => {
    setMemoryData(data)
    setLoading(false)
  })

  return (
    <div>
      <form onSubmit={handleAddressSubmit} className="mb-6">
        <div className="flex">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="输入内存地址 (十六进制)"
            className="flex-grow px-4 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            disabled={loading}
          >
            {loading ? '加载中...' : '跳转'}
          </button>
        </div>
      </form>
      {loading ? (
        <div className="text-center">加载中...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">地址</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">数据</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">类型</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {memoryData.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {(parseInt(address, 16) + index * 8).toString(16).toUpperCase()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.data}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default MemoryInfo