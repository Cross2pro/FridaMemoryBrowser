import React, { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'

const socket = io('http://localhost:5000')

type HierarchyItem = {
  address: string
  name: string
  hasParent: boolean
  parentAddress: string | null
}

type ObjectDetails = {
  address: string
  name: string
  type: string
  components: Array<{ type: string; address: string }>
  transform: null | {
    position?: { x: number; y: number; z: number }
    rotation?: { x: number; y: number; z: number; w: number }
    scale?: { x: number; y: number; z: number }
  }
}

type TreeNode = {
  address: string
  name: string
  parentAddress: string | null
  children: TreeNode[]
}

function normalizeAddress(addr: string): string {
  // Agent returns pointer as string; keep it stable for map keys.
  return (addr || '').toLowerCase()
}

function buildTree(items: HierarchyItem[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>()

  for (const it of items) {
    const address = normalizeAddress(it.address)
    if (!address) continue
    nodes.set(address, {
      address: it.address,
      name: it.name || 'Unknown',
      parentAddress: it.parentAddress ? it.parentAddress : null,
      children: [],
    })
  }

  const roots: TreeNode[] = []
  for (const it of items) {
    const addressKey = normalizeAddress(it.address)
    const node = nodes.get(addressKey)
    if (!node) continue

    const parentKey = it.parentAddress ? normalizeAddress(it.parentAddress) : ''
    const parent = parentKey ? nodes.get(parentKey) : undefined

    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // Sort for stable UI
  const sortRec = (n: TreeNode) => {
    n.children.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    n.children.forEach(sortRec)
  }
  roots.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  roots.forEach(sortRec)

  return roots
}

function TreeRow(props: {
  node: TreeNode
  depth: number
  expanded: Set<string>
  toggleExpanded: (addr: string) => void
  selected: string | null
  onSelect: (addr: string) => void
  filter: string
}): JSX.Element {
  const { node, depth, expanded, toggleExpanded, selected, onSelect, filter } = props
  const key = normalizeAddress(node.address)
  const isExpanded = expanded.has(key)
  const isSelected = selected && normalizeAddress(selected) === key

  const name = node.name || 'Unknown'
  const matches = !filter || name.toLowerCase().includes(filter.toLowerCase())

  // If filtering, auto-render only matching nodes and their matching descendants.
  const filteredChildren = filter
    ? node.children.filter((c) => {
        const cname = (c.name || '').toLowerCase()
        if (cname.includes(filter.toLowerCase())) return true
        // show parent path to matches
        const stack: TreeNode[] = [c]
        while (stack.length) {
          const cur = stack.pop()!
          if ((cur.name || '').toLowerCase().includes(filter.toLowerCase())) return true
          stack.push(...cur.children)
        }
        return false
      })
    : node.children

  const showNode = filter ? matches || filteredChildren.length > 0 : true
  if (!showNode) return <></>

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer select-none ${
          isSelected ? 'bg-blue-100' : 'hover:bg-gray-100'
        }`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => onSelect(node.address)}
        title={node.address}
      >
        <button
          type="button"
          className={`w-5 h-5 flex items-center justify-center rounded border text-xs ${
            node.children.length ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={(e) => {
            e.stopPropagation()
            toggleExpanded(node.address)
          }}
        >
          {isExpanded ? '-' : '+'}
        </button>
        <div className="flex-1 truncate">
          <span className="font-medium">{name}</span>
          <span className="ml-2 text-xs text-gray-500">{node.address}</span>
        </div>
      </div>

      {(filter ? true : isExpanded) &&
        filteredChildren.map((child) => (
          <TreeRow
            key={normalizeAddress(child.address)}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            toggleExpanded={toggleExpanded}
            selected={selected}
            onSelect={onSelect}
            filter={filter}
          />
        ))}
    </div>
  )
}

const IL2CPPHierarchy: React.FC<{ pid: number }> = ({ pid }) => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<HierarchyItem[]>([])
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null)
  const [details, setDetails] = useState<ObjectDetails | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [filter, setFilter] = useState('')

  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const roots = useMemo(() => buildTree(items), [items])

  useEffect(() => {
    console.log('[IL2CPP] mount', { pid })
    setLoading(true)
    setError(null)

    const onConnect = () => console.log('[IL2CPP] socket connected', { id: (socket as any)?.id })
    const onDisconnect = (reason: any) => console.log('[IL2CPP] socket disconnected', { reason })
    const onConnectError = (err: any) => console.log('[IL2CPP] socket connect_error', err)

    const onHierarchy = (data: any) => {
      console.log('[IL2CPP] recv il2cpp_hierarchy', data)
      if (!data || Number(data.pid) !== Number(pid)) {
        console.log('[IL2CPP] ignore il2cpp_hierarchy (pid mismatch)', { expected: pid, got: data?.pid })
        return
      }
      if (!data.success) {
        setError(data.error || 'Failed to get IL2CPP hierarchy')
        setLoading(false)
        return
      }
      setItems(Array.isArray(data.hierarchy) ? data.hierarchy : [])
      setLoading(false)
    }

    const onDetails = (data: any) => {
      console.log('[IL2CPP] recv il2cpp_object_details', data)
      if (!data || Number(data.pid) !== Number(pid)) {
        console.log('[IL2CPP] ignore il2cpp_object_details (pid mismatch)', { expected: pid, got: data?.pid })
        return
      }
      setDetailsLoading(false)
      if (!data.success) {
        setError(data.error || 'Failed to get object details')
        return
      }
      setDetails(data.details || null)
    }

    const timeoutId = window.setTimeout(() => {
      console.log('[IL2CPP] timeout waiting for il2cpp_hierarchy')
      setLoading(false)
      setError('等待后端返回层级数据超时：请检查后端控制台/是否已注入脚本/是否已检测到 IL2CPP')
    }, 8000)

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)

    socket.on('il2cpp_hierarchy', onHierarchy)
    socket.on('il2cpp_object_details', onDetails)

    console.log('[IL2CPP] emit get_il2cpp_hierarchy', { pid })
    socket.emit('get_il2cpp_hierarchy', { pid })

    return () => {
      window.clearTimeout(timeoutId)
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
      socket.off('il2cpp_hierarchy', onHierarchy)
      socket.off('il2cpp_object_details', onDetails)
    }
  }, [pid])

  const toggleExpanded = (addr: string) => {
    const k = normalizeAddress(addr)
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  const requestDetails = (addr: string) => {
    console.log('[IL2CPP] select object', { pid, addr })
    setSelectedAddress(addr)
    setDetails(null)
    setDetailsLoading(true)
    setError(null)
    console.log('[IL2CPP] emit get_il2cpp_object_details', { pid, address: addr })
    socket.emit('get_il2cpp_object_details', { pid, address: addr })
  }

  const refresh = () => {
    console.log('[IL2CPP] refresh', { pid })
    setLoading(true)
    setError(null)
    setItems([])
    setSelectedAddress(null)
    setDetails(null)
    setDetailsLoading(false)
    console.log('[IL2CPP] emit get_il2cpp_hierarchy', { pid })
    socket.emit('get_il2cpp_hierarchy', { pid })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">IL2CPP 层级查看器</h2>
          <p className="text-sm text-gray-500">树状显示 GameObject，并提供 Inspector 查看详情</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="px-3 py-2 text-sm rounded bg-blue-500 text-white hover:bg-blue-600"
        >
          刷新
        </button>
      </div>

      {error && <div className="p-3 rounded bg-red-50 text-red-700 border border-red-200">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-3 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="过滤名称..."
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {loading ? (
            <div className="text-center text-gray-500 py-8">加载层级中...</div>
          ) : items.length === 0 ? (
            <div className="text-center text-gray-500 py-8">未获取到任何对象（可能无场景对象或权限不足）</div>
          ) : (
            <div className="max-h-[70vh] overflow-auto">
              {roots.map((r) => (
                <TreeRow
                  key={normalizeAddress(r.address)}
                  node={r}
                  depth={0}
                  expanded={expanded}
                  toggleExpanded={toggleExpanded}
                  selected={selectedAddress}
                  onSelect={requestDetails}
                  filter={filter}
                />
              ))}
            </div>
          )}
        </div>

        <div className="border rounded-lg p-3 bg-white">
          <h3 className="text-lg font-semibold mb-2">Inspector</h3>

          {!selectedAddress ? (
            <div className="text-gray-500">在左侧选择一个对象查看详情。</div>
          ) : detailsLoading ? (
            <div className="text-gray-500">加载详情中...</div>
          ) : !details ? (
            <div className="text-gray-500">未获取到详情。</div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <div className="text-xs text-gray-500">Name</div>
                  <div className="font-medium">{details.name}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Type</div>
                  <div className="font-mono text-sm break-all">{details.type}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Address</div>
                  <div className="font-mono text-sm break-all">{details.address}</div>
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold mb-1">Components</div>
                {details.components?.length ? (
                  <div className="space-y-1">
                    {details.components.map((c) => (
                      <div key={normalizeAddress(c.address)} className="flex items-center justify-between border rounded px-2 py-1">
                        <div className="truncate">{c.type}</div>
                        <div className="font-mono text-xs text-gray-600">{c.address}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">(none)</div>
                )}
              </div>

              <div>
                <div className="text-sm font-semibold mb-1">Transform</div>
                {details.transform ? (
                  <pre className="text-xs bg-gray-50 border rounded p-2 overflow-auto">{JSON.stringify(details.transform, null, 2)}</pre>
                ) : (
                  <div className="text-gray-500 text-sm">(unavailable)</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default IL2CPPHierarchy
