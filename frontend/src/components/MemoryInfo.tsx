import React, { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { toast } from 'react-toastify'; // 请确保已安装 react-toastify
import { FixedSizeList as List } from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'

const socket = io('http://localhost:5000')

interface MemoryInfoProps {
  pid: number;
}

interface MemoryData {
  success: boolean;
  pid: number;
  data: ArrayBuffer;
}

type DataType = 'QWORD' | 'DWORD' | 'FLOAT' | 'DOUBLE' | 'SHORT' | 'BYTE' | 'POINTER';

interface MemoryRow {
  address: string;
  value: string;
  dataType: DataType;
}

interface ModuleRange {
  base: string;
  size: number;
}



const MemoryInfo: React.FC<MemoryInfoProps> = ({ pid }) => {
  const [address, setAddress] = useState('')
  const [memoryData, setMemoryData] = useState<MemoryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [moduleRanges, setModuleRanges] = useState<ModuleRange[]>([])
  const [memoryRows, setMemoryRows] = useState<MemoryRow[]>([])
  const [currentModuleBase, setCurrentModuleBase] = useState<string>('')
  const [currentModuleSize, setCurrentModuleSize] = useState<number>(0)

  const listRef = useRef<List>(null)

  useEffect(() => {
    socket.on('module_ranges', (data: { success: boolean, pid: number, module_ranges: ModuleRange[] }) => {
      if (data.success) {
        setModuleRanges(data.module_ranges)
        // 自动选择第一个模块并加载其数据
        if (data.module_ranges.length > 0) {
          const firstModule = data.module_ranges[0]
          setCurrentModuleBase(firstModule.base)
          setCurrentModuleSize(firstModule.size)
          setAddress(firstModule.base)
          setLoading(true)
          socket.emit('read_memory', { pid, address: firstModule.base, size: firstModule.size })
        }
      }
    })

    socket.on('memory_data', (data: MemoryData) => {
      setMemoryData(data)
      setLoading(false)
    })

    socket.emit('get_module_ranges', { pid })

    return () => {
      socket.off('module_ranges')
      socket.off('memory_data')
    }
  }, [pid])

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const moduleRange = moduleRanges.find(range => {
      const rangeStart = parseInt(range.base, 16)
      const rangeEnd = rangeStart + range.size
      const targetAddress = parseInt(address, 16)
      return targetAddress >= rangeStart && targetAddress < rangeEnd
    })

    if (moduleRange) {
      setLoading(true)
      setCurrentModuleBase(moduleRange.base)
      setCurrentModuleSize(moduleRange.size)
      socket.emit('read_memory', { pid, address: moduleRange.base, size: moduleRange.size })
    } else {
      toast.error('无效的内存地址!')
    }
  }

  const getTypeSize = (type: DataType): number => {
    switch (type) {
      case 'QWORD':
      case 'DOUBLE':
      case 'POINTER': // 修改：64位程序中指针大小为8字节
        return 8;
      case 'DWORD':
      case 'FLOAT':
        return 4;
      case 'SHORT':
        return 2;
      case 'BYTE':
        return 1;
      default:
        return 8;
    }
  }

  const formatValue = (view: DataView, offset: number, type: DataType): string => {
    switch (type) {
      case 'QWORD':
        return view.getBigUint64(offset, true).toString(16).padStart(16, '0');
      case 'DWORD':
        return view.getUint32(offset, true).toString(16).padStart(8, '0');
      case 'FLOAT':
        return view.getFloat32(offset, true).toFixed(6);
      case 'DOUBLE':
        return view.getFloat64(offset, true).toFixed(6);
      case 'SHORT':
        return view.getInt16(offset, true).toString(16).padStart(4, '0');
      case 'BYTE':
        return view.getUint8(offset).toString(16).padStart(2, '0');
      case 'POINTER':
        return '0x' + view.getUint32(offset, true).toString(16).padStart(8, '0');
      default:
        return '';
    }
  }

  const handleTypeChange = (index: number, newType: DataType) => {
    const updatedRows = [...memoryRows];
    updatedRows[index].dataType = newType;
    
    // 更新此行及后续行的地址
    for (let i = index; i < updatedRows.length; i++) {
      if (i > index) {
        const prevAddress = parseInt(updatedRows[i-1].address, 16);
        const prevSize = getTypeSize(updatedRows[i-1].dataType);
        updatedRows[i].address = (prevAddress + prevSize).toString(16).toUpperCase().padStart(8, '0');
      }
      updatedRows[i].value = formatValue(new DataView(memoryData!.data), parseInt(updatedRows[i].address, 16) - parseInt(currentModuleBase, 16), updatedRows[i].dataType);
    }
    
    setMemoryRows(updatedRows);
  }

  useEffect(() => {
    if (memoryData && memoryData.success) {
      const view = new DataView(memoryData.data)
      const rows: MemoryRow[] = []

      for (let i = 0; i < currentModuleSize; i += 8) {
        const addr = (parseInt(currentModuleBase, 16) + i).toString(16).toUpperCase().padStart(16, '0')
        const value = formatValue(view, i, 'QWORD')
        
        rows.push({
          address: addr,
          value: value,
          dataType: 'QWORD'
        })
      }

      setMemoryRows(rows)
      setLoading(false)

      if (listRef.current) {
        const targetIndex = Math.floor((parseInt(address, 16) - parseInt(currentModuleBase, 16)) / 8)
        listRef.current.scrollToItem(targetIndex, 'center')
      }
    }
  }, [memoryData, currentModuleBase, currentModuleSize, address])

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const row = memoryRows[index]
    if (!row) return null

    return (
      <div style={{...style, height: '50px'}} className="flex hover:bg-gray-50 items-center">
        <div className="flex-1 px-6 whitespace-nowrap text-sm font-medium text-gray-900">
          {row.address}
        </div>
        <div className="flex-1 px-6 whitespace-nowrap text-sm text-gray-500">
          {row.value}
        </div>
        <div className="flex-1 px-6 whitespace-nowrap text-sm text-gray-500">
          <select
            value={row.dataType}
            onChange={(e) => handleTypeChange(index, e.target.value as DataType)}
            className="border rounded px-2 py-1"
          >
            <option value="QWORD">QWORD</option>
            <option value="DWORD">DWORD</option>
            <option value="FLOAT">FLOAT</option>
            <option value="DOUBLE">DOUBLE</option>
            <option value="SHORT">SHORT</option>
            <option value="BYTE">BYTE</option>
            <option value="POINTER">POINTER</option>
          </select>
        </div>
      </div>
    )
  }

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
        <div className="h-96">
          <AutoSizer>
            {({ height, width }) => (
              <List
                ref={listRef}
                height={height}
                itemCount={memoryRows.length}
                itemSize={50}
                width={width}
              >
                {Row}
              </List>
            )}
          </AutoSizer>
        </div>
      )}
    </div>
  )
}

export default MemoryInfo
