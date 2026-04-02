'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search } from 'lucide-react'
import { maskPhone } from '@/lib/utils/mask'

type ApiResp = {
  code: number
  message: string
  data?: {
    list: Record<string, unknown>[]
    total: number
    rawTotal?: number
    page: number
    pageSize: number
    meta?: {
      source?: string
      sourceFile?: string
    }
  }
}

type QuickRangeKey = 'today' | '7days' | '15days' | 'month'

function toDateValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getRangeValues(type: QuickRangeKey): { startDate: string; endDate: string } {
  const now = new Date()
  const end = new Date(now)
  const start = new Date(now)

  if (type === 'today') {
    // keep today
  } else if (type === '7days') {
    start.setDate(start.getDate() - 6)
  } else if (type === '15days') {
    start.setDate(start.getDate() - 14)
  } else {
    start.setDate(1)
  }

  return {
    startDate: toDateValue(start),
    endDate: toDateValue(end),
  }
}

const defaultTodayRange = getRangeValues('today')
const defaultFilters = {
  startDate: defaultTodayRange.startDate,
  endDate: defaultTodayRange.endDate,
}

export default function CallLogsPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rawTotal, setRawTotal] = useState(0)
  const [sourceInfo, setSourceInfo] = useState('')
  const [loadedFiles, setLoadedFiles] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [filters, setFilters] = useState(defaultFilters)
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters)

  const fetchData = async (forcePage?: number) => {
    setLoading(true)
    setError('')
    try {
      const currentPage = forcePage ?? page
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(pageSize),
      })
      if (appliedFilters.startDate) params.set('startDate', appliedFilters.startDate)
      if (appliedFilters.endDate) params.set('endDate', appliedFilters.endDate)
      const res = await fetch(`/api/data/call-logs?${params.toString()}`)
      const json: ApiResp = await res.json()
      if (!res.ok || json.code !== 200 || !json.data) {
        throw new Error(json.message || '加载失败')
      }
      
      // 递归处理对象，移除或转换DOM元素和循环引用
      function processObject(obj: any, visited: WeakSet<any> = new WeakSet()): any {
        // 检查是否为DOM元素
        if (obj instanceof Element || obj instanceof HTMLElement) {
          return '[DOM Element]'
        }
        
        // 检查是否为基本类型
        if (typeof obj !== 'object' || obj === null) {
          return obj
        }
        
        // 检查是否已经访问过（循环引用）
        if (visited.has(obj)) {
          return '[Object with circular reference]'
        }
        
        // 标记为已访问
        visited.add(obj)
        
        // 处理数组
        if (Array.isArray(obj)) {
          return obj.map((item: any) => processObject(item, visited))
        }
        
        // 处理对象
        const processedObj: { [key: string]: any } = {}
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            processedObj[key] = processObject(obj[key], visited)
          }
        }
        
        return processedObj
      }
      
      // 处理记录，移除或转换DOM元素和循环引用
      const rawRows = json.data.list || []
      const processedRows = rawRows.map(row => processObject(row))
      
      setRows(processedRows)
      setTotal(json.data.total || 0)
      setRawTotal(Number(json.data.rawTotal ?? json.data.total ?? 0))
      setSourceInfo(
        json.data.meta?.source === 'local-file'
          ? `数据来源：本地累计文件（${json.data.meta?.sourceFile || 'local-sync'}）`
          : '数据来源：接口'
      )
      setLoadedFiles((json.data.meta as any)?.loadedFiles || [])
      setPage(currentPage)
    } catch (e) {
      setRows([])
      setTotal(0)
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [pageSize, appliedFilters])

  const columnKeys = useMemo(
    () =>
      rows.reduce<string[]>((acc, row) => {
        Object.keys(row).forEach((k) => {
          if (!acc.includes(k)) acc.push(k)
        })
        return acc
      }, []),
    [rows]
  )

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  // 递归处理对象，移除或转换DOM元素和循环引用
  function processObjectForDisplay(obj: any, visited: WeakSet<any> = new WeakSet()): any {
    // 检查是否为DOM元素
    if (obj instanceof Element || obj instanceof HTMLElement) {
      return '[DOM Element]'
    }
    
    // 检查是否为基本类型
    if (typeof obj !== 'object' || obj === null) {
      return obj
    }
    
    // 检查是否已经访问过（循环引用）
    if (visited.has(obj)) {
      return '[Object with circular reference]'
    }
    
    // 标记为已访问
    visited.add(obj)
    
    // 处理数组
    if (Array.isArray(obj)) {
      return obj.map((item: any) => processObjectForDisplay(item, visited))
    }
    
    // 处理对象
    const processedObj: { [key: string]: any } = {}
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        processedObj[key] = processObjectForDisplay(obj[key], visited)
      }
    }
    
    return processedObj
  }

  const fmt = (key: string, value: unknown) => {
    if (value === null || value === undefined || value === '') return '-'
    if (key.toLowerCase().includes('phone')) return maskPhone(String(value))
    if (typeof value === 'object') {
      // 先处理对象，移除循环引用
      const processedValue = processObjectForDisplay(value)
      try {
        return JSON.stringify(processedValue)
      } catch (e) {
        return '[Object with circular reference]'
      }
    }
    return String(value)
  }

  const [apiLoading, setApiLoading] = useState(false)
  const [apiError, setApiError] = useState('')
  const [apiRows, setApiRows] = useState<Record<string, unknown>[]>([])
  const [apiTotal, setApiTotal] = useState(0)
  const [showApiResults, setShowApiResults] = useState(false)
  const [updateLoading, setUpdateLoading] = useState(false)
  const [updateMessage, setUpdateMessage] = useState('')
  // API查询结果分页状态
  const [apiPagination, setApiPagination] = useState({
    pageNum: 1,
    pageSize: 10,
    total: 0
  })
  const apiTotalPages = Math.max(1, Math.ceil(apiTotal / apiPagination.pageSize))

  const handleSearch = () => {
    const nextApplied = { ...filters }
    setAppliedFilters(nextApplied)
    fetchData(1)
    // 重置API查询的页码到第一页
    setApiPagination(prev => ({ ...prev, pageNum: 1 }))
  }

  const fetchApiData = async (pageNum?: number | React.MouseEvent<HTMLButtonElement>) => {
    // 处理事件对象，确保pageNum是数字
    const currentPage = typeof pageNum === 'number' ? pageNum : apiPagination.pageNum
    setApiLoading(true)
    setApiError('')
    try {
      const response = await fetch('/api/cxcc?action=call-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pageNum: currentPage,
          pageSize: apiPagination.pageSize,
          startTime: `${filters.startDate} 00:00:00`,
          endTime: `${filters.endDate} 23:59:59`,
        }),
      })
      
      if (!response.ok) {
        throw new Error('API请求失败')
      }
      
      const data = await response.json()
      
      console.log('API响应数据:', data)
      
      if (data.code !== 0) {
        throw new Error(data.message || 'API返回错误')
      }
      
      // 尝试多种可能的数据结构
      const records = data.data?.records || data.rows || data.data || []
      const total = data.total || data.data?.total || records.length
      
      console.log('API响应完整数据:', data)
      console.log('原始记录数量:', records.length)
      console.log('第一条记录:', records[0] ? Object.keys(records[0]) : '无数据')
      
      // 检查是否有DOM元素或循环引用
      if (records.length > 0) {
        console.log('检查第一条记录的属性:')
        for (const key in records[0]) {
          if (records[0].hasOwnProperty(key)) {
            const value = records[0][key]
            console.log(`  ${key}:`, typeof value, value instanceof Element ? 'DOM Element' : '')
            if (typeof value === 'object' && value !== null) {
              try {
                JSON.stringify(value)
                console.log(`  ${key} 可以序列化`)
              } catch (e) {
                console.log(`  ${key} 包含循环引用`)
              }
            }
          }
        }
      }
      
      // 递归处理对象，移除或转换DOM元素和循环引用
      function processObject(obj: any, visited: WeakSet<any> = new WeakSet()): any {
        // 检查是否为DOM元素
        if (obj instanceof Element || obj instanceof HTMLElement) {
          console.log('发现DOM元素，替换为占位符')
          return '[DOM Element]'
        }
        
        // 检查是否为基本类型
        if (typeof obj !== 'object' || obj === null) {
          return obj
        }
        
        // 检查是否已经访问过（循环引用）
        if (visited.has(obj)) {
          console.log('发现循环引用，替换为占位符')
          return '[Object with circular reference]'
        }
        
        // 标记为已访问
        visited.add(obj)
        
        // 处理数组
        if (Array.isArray(obj)) {
          return obj.map((item: any) => processObject(item, visited))
        }
        
        // 处理对象
        const processedObj: { [key: string]: any } = {}
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            processedObj[key] = processObject(obj[key], visited)
          }
        }
        
        return processedObj
      }
      
      // 处理记录，移除或转换DOM元素和循环引用
      const processedRecords = records.map((record: any, index: number) => {
        console.log(`处理第 ${index} 条记录`)
        return processObject(record)
      })
      
      console.log('处理后的记录数量:', processedRecords.length)
      console.log('处理后的第一条记录:', processedRecords[0] ? Object.keys(processedRecords[0]) : '无数据')
      
      setApiRows(processedRecords)
      setApiTotal(total)
      setApiPagination(prev => ({
        ...prev,
        pageNum: currentPage,
        total
      }))
      setShowApiResults(true)
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'API查询失败')
      setShowApiResults(true) // 即使出错也要显示错误信息
    } finally {
      setApiLoading(false)
    }
  }

  const updateLocalFile = async () => {
    setUpdateLoading(true)
    setUpdateMessage('')
    try {
      const response = await fetch('/api/cxcc?action=call-logs-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pageNum: 1,
          pageSize: 100000, // 一次获取更多数据
          startTime: `${filters.startDate} 00:00:00`,
          endTime: `${filters.endDate} 23:59:59`,
        }),
      })
      
      if (!response.ok) {
        throw new Error('更新本地文件失败')
      }
      
      const data = await response.json()
      
      if (data.code !== 0) {
        throw new Error(data.message || '更新失败')
      }
      
      setUpdateMessage(data.data?.message || `成功更新本地文件，共处理 ${data.data?.total} 条记录`)
      
      // 重新加载本地数据
      fetchData(1)
    } catch (e) {
      setUpdateMessage('更新失败: ' + (e instanceof Error ? e.message : '未知错误'))
    } finally {
      setUpdateLoading(false)
    }
  }

  const handleReset = () => {
    setFilters(defaultFilters)
    setAppliedFilters(defaultFilters)
    setShowApiResults(false)
    // 重置API查询的页码到第一页
    setApiPagination(prev => ({ ...prev, pageNum: 1 }))
    fetchData(1)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">通话清单</h1>
        <p className="text-gray-500">本地累计通话数据（每1分钟自动同步）</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>查询筛选</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="text-sm font-medium mb-2 block">开始日期</label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((p) => ({ ...p, startDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">结束日期</label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters((p) => ({ ...p, endDate: e.target.value }))}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              查询
            </Button>
            <Button variant="outline" onClick={handleReset}>重置</Button>
            <Button variant="secondary" onClick={fetchApiData} disabled={apiLoading}>
              {apiLoading ? '查询中...' : 'API查询'}
            </Button>
            <Button variant="default" onClick={updateLocalFile} disabled={updateLoading}>
              {updateLoading ? '更新中...' : '更新本地文件'}
            </Button>
          </div>
          {updateMessage && (
            <div className="md:col-span-4 text-sm mt-2 p-2 rounded-md bg-blue-50 text-blue-700">
              {updateMessage}
            </div>
          )}
          <div className="md:col-span-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              const range = getRangeValues('today');
              setFilters((p) => ({ ...p, ...range }));
              setAppliedFilters((p) => ({ ...p, ...range }));
              fetchData(1);
            }}>
              今天
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              const range = getRangeValues('7days');
              setFilters((p) => ({ ...p, ...range }));
              setAppliedFilters((p) => ({ ...p, ...range }));
              fetchData(1);
            }}>
              7天
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              const range = getRangeValues('15days');
              setFilters((p) => ({ ...p, ...range }));
              setAppliedFilters((p) => ({ ...p, ...range }));
              fetchData(1);
            }}>
              15天
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              const range = getRangeValues('month');
              setFilters((p) => ({ ...p, ...range }));
              setAppliedFilters((p) => ({ ...p, ...range }));
              fetchData(1);
            }}>
              本月
            </Button>
          </div>
        </CardContent>
      </Card>

      {showApiResults ? (
        <Card>
          <CardHeader>
            <CardTitle>API查询结果</CardTitle>
            <CardDescription>
              {apiLoading ? '查询中...' : `API实时查询 ${apiTotal} 条`}
            </CardDescription>
            <div className="text-xs text-gray-500">
              数据来源：CXCC API实时查询
            </div>
          </CardHeader>
          <CardContent>
            {apiError ? <p className="text-sm text-red-600 mb-3">{apiError}</p> : null}
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {apiRows.length > 0 ? Object.keys(apiRows[0]).map((k) => (
                      <TableHead key={k}>{k}</TableHead>
                    )) : (
                      <TableHead>无数据</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={Math.max(apiRows.length > 0 ? Object.keys(apiRows[0]).length : 1, 1)} className="text-center py-10 text-gray-500">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    apiRows.map((row, idx) => (
                      <TableRow key={String(row.uuid || row.id || idx)}>
                        {Object.keys(row).map((k) => (
                          <TableCell key={`${String(row.uuid || idx)}-${k}`}>{fmt(k, row[k])}</TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-500">
                第 {apiPagination.pageNum} / {apiTotalPages} 页
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="px-2 py-1 border rounded"
                  value={apiPagination.pageSize}
                  onChange={(e) => {
                    const newPageSize = Number(e.target.value)
                    setApiPagination(prev => ({ ...prev, pageSize: newPageSize, pageNum: 1 }))
                    fetchApiData(1)
                  }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <Button size="sm" variant="outline" disabled={apiPagination.pageNum <= 1 || apiLoading} onClick={() => fetchApiData(apiPagination.pageNum - 1)}>
                  上一页
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={apiPagination.pageNum >= apiTotalPages || apiLoading}
                  onClick={() => fetchApiData(apiPagination.pageNum + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>通话记录</CardTitle>
            <CardDescription>
              {loading ? '加载中...' : `当前筛选 ${total} 条（本地累计 ${rawTotal} 条），当前第 ${page} 页`}
            </CardDescription>
            {!loading && loadedFiles.length > 0 ? (
              <div className="text-xs text-gray-500">
                加载的文件：{loadedFiles.join(', ')}
              </div>
            ) : null}
          </CardHeader>
          <CardContent>
            {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columnKeys.map((k) => (
                      <TableHead key={k}>{k}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={Math.max(columnKeys.length, 1)} className="text-center py-10 text-gray-500">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row, idx) => (
                      <TableRow key={String(row.uuid || row.id || idx)}>
                        {columnKeys.map((k) => (
                          <TableCell key={`${String(row.uuid || idx)}-${k}`}>{fmt(k, row[k])}</TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-500">
                第 {page} / {totalPages} 页
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="px-2 py-1 border rounded"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => fetchData(page - 1)}>
                  上一页
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => fetchData(page + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
