import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'

const socket = io('http://localhost:5000')

const ProcessList: React.FC = () => {
  const [processes, setProcesses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
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

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">进程列表</h1>
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        {processes.length === 0 ? (
          <p className="p-4 text-center text-gray-500">No processes found</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {processes.map((process) => (
              <li
                key={process.pid}
                className="p-4 hover:bg-gray-50 cursor-pointer transition duration-150 ease-in-out"
                onClick={() => handleProcessSelect(process.pid)}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{process.name}</span>
                  <span className="text-sm text-gray-500">PID: {process.pid}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default ProcessList