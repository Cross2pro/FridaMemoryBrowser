import React, { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import { FixedSizeList as List } from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'
import { debounce } from 'lodash'

const socket = io('http://localhost:5000')

interface ImportExport {
  name: string;
  address: string;
}

const ModuleDetails: React.FC = () => {
  const { pid, moduleName } = useParams<{ pid: string; moduleName: string }>()
  const [imports, setImports] = useState<ImportExport[]>([])
  const [exports, setExports] = useState<ImportExport[]>([])
  const [loading, setLoading] = useState(true)
  const [importSearchTerm, setImportSearchTerm] = useState('')
  const [exportSearchTerm, setExportSearchTerm] = useState('')

  useEffect(() => {
    if (pid && moduleName) {
      socket.emit('get_module_details', { pid: Number(pid), moduleName })

      socket.on('module_details', (data: { success: boolean, pid: number, imports: ImportExport[], exports: ImportExport[] }) => {
        if (data.success && data.pid === Number(pid)) {
          setImports(data.imports)
          setExports(data.exports)
          setLoading(false)
        }
      })
    }

    return () => {
      socket.off('module_details')
    }
  }, [pid, moduleName])

  const handleDump = () => {
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = `http://localhost:5000/dump_module?pid=${pid}&moduleName=${moduleName}`;
    link.download = `${moduleName}_${pid}.bin`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const debouncedImportSearch = useMemo(
    () => debounce((term: string) => setImportSearchTerm(term), 300),
    []
  )

  const debouncedExportSearch = useMemo(
    () => debounce((term: string) => setExportSearchTerm(term), 300),
    []
  )

  const filteredImports = useMemo(() => {
    return imports.filter(imp =>
      imp.name.toLowerCase().includes(importSearchTerm.toLowerCase()) ||
      imp.address.toLowerCase().includes(importSearchTerm.toLowerCase())
    )
  }, [imports, importSearchTerm])

  const filteredExports = useMemo(() => {
    return exports.filter(exp =>
      exp.name.toLowerCase().includes(exportSearchTerm.toLowerCase()) ||
      exp.address.toLowerCase().includes(exportSearchTerm.toLowerCase())
    )
  }, [exports, exportSearchTerm])

  if (loading) {
    return <div className="text-center">加载模块详情中...</div>
  }

  const ImportRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const imp = filteredImports[index]
    return (
      <div style={style} className="grid grid-cols-2 gap-4 py-2 px-4 border-b hover:bg-gray-50">
        <div className="truncate">{imp.name}</div>
        <div>{imp.address}</div>
      </div>
    )
  }

  const ExportRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const exp = filteredExports[index]
    return (
      <div style={style} className="grid grid-cols-2 gap-4 py-2 px-4 border-b hover:bg-gray-50">
        <div className="truncate">{exp.name}</div>
        <div>{exp.address}</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-3xl font-bold mb-4">{moduleName} 详情</h2>
      <button onClick={handleDump} className="mb-6 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
        Dump 模块
      </button>
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h3 className="text-xl font-semibold mb-2">导入表 ({filteredImports.length})</h3>
          <input
            type="text"
            placeholder="搜索导入..."
            className="w-full p-2 mb-4 border rounded"
            onChange={(e) => debouncedImportSearch(e.target.value)}
          />
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="grid grid-cols-2 gap-4 py-2 px-4 bg-gray-100 font-semibold">
              <div>名称</div>
              <div>地址</div>
            </div>
            <div className="h-[calc(100vh-400px)]">
              <AutoSizer>
                {({ height, width }) => (
                  <List
                    height={height}
                    itemCount={filteredImports.length}
                    itemSize={35}
                    width={width}
                  >
                    {ImportRow}
                  </List>
                )}
              </AutoSizer>
            </div>
          </div>
        </div>
        <div>
          <h3 className="text-xl font-semibold mb-2">导出表 ({filteredExports.length})</h3>
          <input
            type="text"
            placeholder="搜索导出..."
            className="w-full p-2 mb-4 border rounded"
            onChange={(e) => debouncedExportSearch(e.target.value)}
          />
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="grid grid-cols-2 gap-4 py-2 px-4 bg-gray-100 font-semibold">
              <div>名称</div>
              <div>地址</div>
            </div>
            <div className="h-[calc(100vh-400px)]">
              <AutoSizer>
                {({ height, width }) => (
                  <List
                    height={height}
                    itemCount={filteredExports.length}
                    itemSize={35}
                    width={width}
                  >
                    {ExportRow}
                  </List>
                )}
              </AutoSizer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ModuleDetails
