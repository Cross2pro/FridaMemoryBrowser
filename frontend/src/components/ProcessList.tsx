import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { debounce } from 'lodash'  // 请确保安装了 lodash: npm install lodash @types/lodash

const socket = io('http://localhost:5000')

interface Process {
  pid: number;
  name: string;
}

const ProcessList: React.FC = () => {
  const [processes, setProcesses] = useState<Process[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortKey, setSortKey] = useState<'pid' | 'name'>('pid')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const navigate = useNavigate()

  useEffect(() => {
    fetchProcesses()
  }, [])

  const fetchProcesses = async () => {
    try {
      const response = await fetch('http://localhost:5000/processes')
      const data = await response.json()
      setProcesses(data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching processes:', error)
      setLoading(false)
    }
  }

  const handleProcessSelect = (pid: number) => {
    socket.emit('attach', { pid })
    navigate(`/process/${pid}`)
  }

  const debouncedSearch = useMemo(
    () => debounce((term: string) => setSearchTerm(term), 300),
    []
  )

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(e.target.value)
  }

  const handleSort = (key: 'pid' | 'name') => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortOrder('asc')
    }
  }

  const filteredAndSortedProcesses = useMemo(() => {
    return processes
      .filter(process => 
        process.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        process.pid.toString().includes(searchTerm)
      )
      .sort((a, b) => {
        if (a[sortKey] < b[sortKey]) return sortOrder === 'asc' ? -1 : 1
        if (a[sortKey] > b[sortKey]) return sortOrder === 'asc' ? 1 : -1
        return 0
      })
  }, [processes, searchTerm, sortKey, sortOrder])

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">进程列表</h1>
      <input
        type="text"
        placeholder="搜索进程..."
        onChange={handleSearchChange}
        className="w-full p-2 mb-4 border rounded"
      />
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        {filteredAndSortedProcesses.length === 0 ? (
          <p className="p-4 text-center text-gray-500">No processes found</p>
        ) : (
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-100">
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('pid')}
                >
                  PID {sortKey === 'pid' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('name')}
                >
                  Name {sortKey === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedProcesses.map((process) => (
                <tr
                  key={process.pid}
                  className="hover:bg-gray-50 cursor-pointer transition duration-150 ease-in-out"
                  onClick={() => handleProcessSelect(process.pid)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{process.pid}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{process.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default ProcessList