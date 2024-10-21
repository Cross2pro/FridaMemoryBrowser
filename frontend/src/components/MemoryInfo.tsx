import React, { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { toast } from 'react-toastify'; // 请确保已安装 react-toastify

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

const DISPLAY_SIZE = 128; // 显示的内存大小
const READ_BUFFER = 512; // 实际读取的内存大小

const MemoryInfo: React.FC<MemoryInfoProps> = ({ pid }) => {
  const [address, setAddress] = useState('')
  const [displayAddress, setDisplayAddress] = useState('')
  const [memoryData, setMemoryData] = useState<MemoryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [moduleRanges, setModuleRanges] = useState<ModuleRange[]>([]);

  const containerRef = useRef<HTMLDivElement>(null)
  const [memoryRows, setMemoryRows] = useState<MemoryRow[]>([])
  const [currentAddress, setCurrentAddress] = useState<number>(0)

  useEffect(() => {
    socket.emit('get_base_address', { pid })
    socket.on('base_address', (baseAddressPacket: { success: boolean, pid: number, address: string }) => {
      if (baseAddressPacket.success) {
        setAddress(baseAddressPacket.address)
        setDisplayAddress(baseAddressPacket.address)
        handleMemoryRead(baseAddressPacket.address)
      }
    })

    socket.on('memory_data', (data: MemoryData) => {
      setMemoryData(data)
      setLoading(false)
    })

    socket.on('module_ranges', (data: { success: boolean, pid: number, module_ranges: ModuleRange[] }) => {
      if (data.success) {
        setModuleRanges(data.module_ranges);
      }
    })

    // 获取模块范围
    socket.emit('get_module_ranges', { pid });

    return () => {
      socket.off('base_address')
      socket.off('memory_data')
      socket.off('module_ranges')
    }
  }, [pid])

  const isAddressValid = (addr: number): boolean => {
    return moduleRanges.some(range => {
      const rangeStart = parseInt(range.base, 16);
      const rangeEnd = rangeStart + range.size;
      return addr >= rangeStart && addr < rangeEnd;
    });
  }

  const handleMemoryRead = (addr: string, direction: 'up' | 'down' = 'down') => {
    const addrNum = parseInt(addr, 16);
    const readAddress = direction === 'up' ? addrNum - READ_BUFFER : addrNum;
    
    if (isAddressValid(readAddress)) {
      setLoading(true);
      socket.emit('read_memory', { pid, address: readAddress, size: READ_BUFFER });
    } else {
      toast.error('无效的内存地址!');
    }
  }

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleMemoryRead(address)
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    if (scrollHeight - scrollTop <= clientHeight + 1) {
      // 滚动到底部，加载更多数据
      const newAddress = currentAddress + DISPLAY_SIZE;
      if (isAddressValid(newAddress)) {
        handleMemoryRead(newAddress.toString(16), 'down');
      }
    } else if (scrollTop === 0) {
      // 滚动到顶部，加载更多数据
      const newAddress = currentAddress - DISPLAY_SIZE;
      if (isAddressValid(newAddress)) {
        handleMemoryRead(newAddress.toString(16), 'up');
      }
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
      updatedRows[i].value = formatValue(new DataView(memoryData!.data), parseInt(updatedRows[i].address, 16) - parseInt(displayAddress, 16), updatedRows[i].dataType);
    }
    
    setMemoryRows(updatedRows);
  }

  useEffect(() => {
    if (memoryData && memoryData.success) {
      const view = new DataView(memoryData.data);
      const rows: MemoryRow[] = [];
      let currentOffset = 0;

      while (currentOffset < READ_BUFFER) {
        const addr = (parseInt(displayAddress, 16) + currentOffset).toString(16).toUpperCase().padStart(16, '0');
        const value = formatValue(view, currentOffset, 'QWORD');
        
        rows.push({
          address: addr,
          value: value,
          dataType: 'QWORD'
        });

        currentOffset += getTypeSize('QWORD');
      }

      setMemoryRows(rows);
      setCurrentAddress(parseInt(displayAddress, 16));
      setLoading(false);

      // 保持滚动位置
      if (containerRef.current) {
        containerRef.current.scrollTop = (READ_BUFFER - DISPLAY_SIZE) / 2;
      }
    }
  }, [memoryData, displayAddress]);

  const renderMemoryData = () => {
    if (!memoryData || !memoryData.success) {
      return <div>No data available</div>
    }

    return memoryRows.map((row, index) => (
      <tr key={index} className="hover:bg-gray-50">
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
          {row.address}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {row.dataType === 'POINTER' ? (
            <button
              onClick={() => handleMemoryRead(row.value.slice(2))}
              className="text-blue-500 hover:underline"
            >
              {row.value}
            </button>
          ) : (
            row.value
          )}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
        </td>
      </tr>
    ))
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
        <div 
          ref={containerRef}
          className="overflow-auto max-h-96"
          onScroll={handleScroll}
        >
          <table className="min-w-full bg-white">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">地址</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">数据</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">类型</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {renderMemoryData()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default MemoryInfo
