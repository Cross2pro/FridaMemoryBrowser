import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { FixedSizeList as List } from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'
import { debounce } from 'lodash'

const socket = io('http://localhost:5000')

interface ModuleInfoProps {
  pid: number;
}

interface Module {
  name: string;
  base: string;
  size: number;
  path: string;
  importCount: number;
  exportCount: number;
}

const ModuleInfo: React.FC<ModuleInfoProps> = ({ pid }) => {
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const navigate = useNavigate()

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
    navigate(`/process/${pid}/module/${encodeURIComponent(module.name)}`)
  }

  const debouncedSearch = useMemo(
    () => debounce((term: string) => setSearchTerm(term), 300),
    []
  )

  const filteredModules = useMemo(() => {
    return modules.filter(module =>
      module.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      module.path.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [modules, searchTerm])

  if (loading) {
    return <div className="text-center">加载中...</div>
  }

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const module = filteredModules[index]
    return (
      <div style={style} onClick={() => handleModuleClick(module)} className="cursor-pointer hover:bg-gray-100">
        <div className="grid grid-cols-5 gap-4 py-2 px-4 items-center">
          <div className="truncate font-medium">{module.name}</div>
          <div className="text-sm text-gray-600">{module.base} - {(BigInt(module.base) + BigInt(module.size)).toString(16).toUpperCase()}</div>
          <div className="truncate text-sm text-gray-600">{module.path}</div>
          <div className="text-sm text-blue-600">导入: {module.importCount}</div>
          <div className="text-sm text-green-600">导出: {module.exportCount}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">模块信息</h2>
      <input
        type="text"
        placeholder="搜索模块..."
        className="w-full p-2 mb-4 border rounded"
        onChange={(e) => debouncedSearch(e.target.value)}
      />
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="grid grid-cols-5 gap-4 py-2 px-4 bg-gray-100 font-semibold">
          <div>模块名</div>
          <div>内存范围</div>
          <div>路径</div>
          <div>导入数</div>
          <div>导出数</div>
        </div>
        <div className="h-[calc(100vh-250px)]">
          <AutoSizer>
            {({ height, width }) => (
              <List
                height={height}
                itemCount={filteredModules.length}
                itemSize={35}
                width={width}
              >
                {Row}
              </List>
            )}
          </AutoSizer>
        </div>
      </div>
    </div>
  )
}

export default ModuleInfo
