'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  Search, 
  Play, 
  Download, 
  FileAudio,
  Filter,
  RefreshCw
} from 'lucide-react'
import { maskPhone } from '@/lib/utils/mask'
import { resolveProjectName } from '@/lib/project-id-name-map'

type RecordingFilters = {
  status: string
  projectName: string
  qualityStatus: string
  startTime: string
  endTime: string
}

type QuickRangeKey = 'today' | '7days' | '15days' | 'month'

function toDateTimeLocalValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hour}:${minute}`
}

function getRangeValues(type: QuickRangeKey): { startTime: string; endTime: string } {
  const now = new Date()
  const end = new Date(now)
  end.setHours(23, 59, 0, 0)
  const start = new Date(now)

  if (type === 'today') {
    start.setHours(0, 0, 0, 0)
  } else if (type === '7days') {
    start.setDate(start.getDate() - 6)
    start.setHours(0, 0, 0, 0)
  } else if (type === '15days') {
    start.setDate(start.getDate() - 14)
    start.setHours(0, 0, 0, 0)
  } else {
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
  }

  console.log(`日期范围查询: ${type}`, {
    start: start.toISOString(),
    end: end.toISOString()
  })

  return {
    startTime: toDateTimeLocalValue(start),
    endTime: toDateTimeLocalValue(end),
  }
}

const defaultTodayRange = getRangeValues('today')
const defaultFilters: RecordingFilters = {
  status: 'all',
  projectName: 'all',
  qualityStatus: 'all',
  startTime: defaultTodayRange.startTime,
  endTime: defaultTodayRange.endTime,
}

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<any[]>([])
  const [serverStatusOptions, setServerStatusOptions] = useState<string[]>([])
  const [serverProjectOptions, setServerProjectOptions] = useState<string[]>([])
  const [loadedFiles, setLoadedFiles] = useState<string[]>([])
  const [rawTotal, setRawTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0
  })
  
  const [filters, setFilters] = useState<RecordingFilters>(defaultFilters)
  const [appliedFilters, setAppliedFilters] = useState<RecordingFilters>(defaultFilters)
  const [selectedRecording, setSelectedRecording] = useState<any>(null)
  const [showPlayer, setShowPlayer] = useState(false)
  
  // API查询相关状态
  const [updateLoading, setUpdateLoading] = useState(false)
  const [updateMessage, setUpdateMessage] = useState('')

  // 加载录音列表
  const loadRecordings = async (
    options?: {
      filters?: RecordingFilters
      page?: number
      pageSize?: number
    }
  ) => {
    const activeFilters = options?.filters ?? appliedFilters
    const activePage = options?.page ?? pagination.page
    const activePageSize = options?.pageSize ?? pagination.pageSize

    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(activePage),
        pageSize: String(activePageSize),
      })
      
      // 发送完整的时间范围，包括秒数
      if (activeFilters.startTime) {
        params.set('startTime', `${activeFilters.startTime}:00`)
      }
      if (activeFilters.endTime) {
        params.set('endTime', `${activeFilters.endTime}:59`)
      }
      
      if (activeFilters.status && activeFilters.status !== 'all') params.set('status', activeFilters.status)
      if (activeFilters.projectName && activeFilters.projectName !== 'all') {
        params.set('projectName', activeFilters.projectName)
      }
      if (activeFilters.qualityStatus && activeFilters.qualityStatus !== 'all') {
        params.set('qualityStatus', activeFilters.qualityStatus)
      }

      console.log('请求录音数据，参数:', params.toString())
      const response = await fetch(`/api/local/recordings?${params.toString()}`)

      if (!response.ok) {
        let detail = '加载失败'
        try {
          const errorData = (await response.json()) as {
            message?: string
            error?: string
            details?: string
          }
          detail =
            [errorData.message, errorData.details, errorData.error].find(
              (s) => typeof s === 'string' && s.trim().length > 0
            ) || detail
        } catch {
          detail = `请求失败 HTTP ${response.status}`
        }
        throw new Error(detail)
      }

      const data = await response.json()
      // 本地只读接口返回 rows + total；兼容 list / data 数组 / data.records
      const rawRecordList =
        data.rows ||
        data.list ||
        (Array.isArray(data.data) ? data.data : data.data?.records) ||
        []
      const total = data.total ?? data.count ?? data.data?.total ?? rawRecordList.length

      // 递归处理对象，移除或转换DOM元素和循环引用
      function processObject(obj, visited = new WeakSet()) {
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
          return obj.map(item => processObject(item, visited))
        }
        
        // 处理对象
        const processedObj = {}
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            processedObj[key] = processObject(obj[key], visited)
          }
        }
        
        return processedObj
      }
      
      // 处理记录，移除或转换DOM元素和循环引用
      const processedRecordList = rawRecordList.map(record => processObject(record))

      setRecordings(processedRecordList)
      setServerStatusOptions(Array.isArray(data.statusOptions) ? data.statusOptions : [])
      setServerProjectOptions(Array.isArray(data.projectOptions) ? data.projectOptions : [])
      setRawTotal(Number(data.rawTotal ?? 0))
      setLoadedFiles(data.loadedFiles || [])
      setPagination(prev => ({
        ...prev,
        total
      }))
    } catch (err) {
      console.error('加载录音列表失败:', err)
      setError(err instanceof Error ? err.message : '加载失败')
      setRecordings([])
    } finally {
      setLoading(false)
    }
  }

  // 初始加载和筛选条件变化时重新加载
  useEffect(() => {
    loadRecordings()
  }, [pagination.page, pagination.pageSize, appliedFilters])

  const handlePlay = (recording: any) => {
    setSelectedRecording(recording)
    setShowPlayer(true)
  }

  const handleDownload = (recording: any) => {
    if (!recording?.playUrl) return
    window.open(recording.playUrl, '_blank')
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}分${secs}秒`
  }

  const columnKeys = recordings.reduce<string[]>((keys, row) => {
    Object.keys(row || {}).forEach((k) => {
      if (!keys.includes(k)) keys.push(k)
    })
    return keys
  }, [])

  const hasPlayable = recordings.some(
    (r) => typeof r.playUrl === 'string' && r.playUrl.trim().length > 0
  )

  const statusOptions = useMemo(() => {
    const set = new Set<string>(serverStatusOptions)
    if (set.size === 0) {
      recordings.forEach((r) => {
        const n = String(r?.statusName ?? '').trim()
        if (n) set.add(n)
      })
    }
    if (filters.status !== 'all' && filters.status.trim()) {
      set.add(filters.status.trim())
    }
    return Array.from(set)
  }, [recordings, serverStatusOptions, filters.status])
  const projectOptions = useMemo(() => {
    const set = new Set<string>(serverProjectOptions)
    if (filters.projectName !== 'all' && filters.projectName.trim()) {
      set.add(filters.projectName.trim())
    }
    return Array.from(set)
  }, [serverProjectOptions, filters.projectName])

  const totalPages = Math.max(1, Math.ceil((pagination.total || 0) / pagination.pageSize))

  // 递归处理对象，移除或转换DOM元素和循环引用
  function processObjectForDisplay(obj, visited = new WeakSet()) {
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
      return obj.map(item => processObjectForDisplay(item, visited))
    }
    
    // 处理对象
    const processedObj = {}
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        processedObj[key] = processObjectForDisplay(obj[key], visited)
      }
    }
    
    return processedObj
  }

  const formatCellValue = (key: string, value: unknown) => {
    if (value === null || value === undefined || value === '') return '-'
    if (key === 'answerDuration') return formatDuration(Number(value))
    if (key.toLowerCase().includes('phone')) return maskPhone(String(value))
    // projectId 映射为项目名称
    if (key === 'projectId' || key === 'project_id') {
      return resolveProjectName(value)
    }
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

  // API查询录音数据
  const [apiLoading, setApiLoading] = useState(false)
  const [apiError, setApiError] = useState('')
  const [apiRecordings, setApiRecordings] = useState<any[]>([])
  const [apiTotal, setApiTotal] = useState(0)
  const [showApiResults, setShowApiResults] = useState(false)
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
    if (pagination.page !== 1) {
      setPagination(prev => ({ ...prev, page: 1 }))
      return
    }
    loadRecordings({ filters: nextApplied, page: 1 })
    // 重置API查询的页码到第一页
    setApiPagination(prev => ({ ...prev, pageNum: 1 }))
  }

  const handleQuickRange = (range: QuickRangeKey) => {
    const quickRange = getRangeValues(range)
    const nextFilters: RecordingFilters = {
      ...filters,
      startTime: quickRange.startTime,
      endTime: quickRange.endTime,
    }
    setFilters(nextFilters)
    setAppliedFilters(nextFilters)
    loadRecordings({ filters: nextFilters, page: 1 })
    // 重置API查询的页码到第一页
    setApiPagination(prev => ({ ...prev, pageNum: 1 }))
  }

  const handleReset = () => {
    setFilters(defaultFilters)
    setAppliedFilters(defaultFilters)
    setShowApiResults(false)
    if (pagination.page !== 1) {
      setPagination(prev => ({ ...prev, page: 1 }))
      return
    }
    loadRecordings({ filters: defaultFilters, page: 1 })
    // 重置API查询的页码到第一页
    setApiPagination(prev => ({ ...prev, pageNum: 1 }))
  }
  
  const fetchApiData = async (pageNum?: number | React.MouseEvent<HTMLButtonElement>) => {
    // 处理事件对象，确保pageNum是数字
    const currentPage = typeof pageNum === 'number' ? pageNum : apiPagination.pageNum
    setApiLoading(true)
    setApiError('')
    try {
      // 转换时间格式：从 datetime-local 格式转换为 CXCC API 期望的格式
      const formatTime = (datetimeLocal: string) => {
        // 确保时间格式包含秒，例如：2026-03-23 00:00:00
        const time = datetimeLocal.replace('T', ' ');
        if (time.length === 16) { // 格式为 YYYY-MM-DD HH:MM
          return time + ':00';
        }
        return time;
      };
      
      console.log('API查询参数:', {
        pageNum: currentPage,
        pageSize: apiPagination.pageSize,
        agentNo: '',
        projectId: '',
        startTime: formatTime(filters.startTime),
        endTime: formatTime(filters.endTime),
      });
      
      const response = await fetch('/api/cxcc/recordings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pageNum: currentPage,
          pageSize: apiPagination.pageSize,
          agentNo: '', // 空值表示不限坐席
          projectId: '', // 空值表示不限项目
          startTime: formatTime(filters.startTime),
          endTime: formatTime(filters.endTime),
        }),
      })
      
      console.log('API响应状态:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API响应错误:', errorText);
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log('API响应数据:', data);
      
      if (data.code !== 0) {
        throw new Error(data.message || 'API返回错误')
      }
      
      // 尝试多种可能的数据结构
      const records = data.data?.records || data.rows || []
      const total = data.total || data.data?.total || 0
      
      // 递归处理对象，移除或转换DOM元素和循环引用
      function processObject(obj, visited = new WeakSet()) {
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
          return obj.map(item => processObject(item, visited))
        }
        
        // 处理对象
        const processedObj = {}
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            processedObj[key] = processObject(obj[key], visited)
          }
        }
        
        return processedObj
      }
      
      // 处理记录，移除或转换DOM元素和循环引用
      const processedRecords = records.map(record => processObject(record))
      
      setApiRecordings(processedRecords)
      setApiTotal(total)
      setApiPagination(prev => ({
        ...prev,
        pageNum: currentPage,
        total
      }))
      setShowApiResults(true)
    } catch (e) {
      console.error('API查询错误:', e);
      setApiError(e instanceof Error ? e.message : 'API查询失败')
      setShowApiResults(true) // 即使出错也要显示错误信息
    } finally {
      setApiLoading(false)
    }
  }

  // 更新本地文件
  const updateLocalFile = async () => {
    setUpdateLoading(true)
    setUpdateMessage('')
    try {
      // 转换时间格式：从 datetime-local 格式转换为 CXCC API 期望的格式
      const formatTime = (datetimeLocal: string) => {
        // 确保时间格式包含秒，例如：2026-03-23 00:00:00
        const time = datetimeLocal.replace('T', ' ');
        if (time.length === 16) { // 格式为 YYYY-MM-DD HH:MM
          return time + ':00';
        }
        return time;
      };
      
      const response = await fetch('/api/cxcc/recordings/update-local', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pageNum: 1,
          pageSize: 100000, // 一次获取更多数据
          startTime: formatTime(filters.startTime),
          endTime: formatTime(filters.endTime),
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
      loadRecordings({ filters: appliedFilters, page: 1 })
    } catch (e) {
      setUpdateMessage('更新失败: ' + (e instanceof Error ? e.message : '未知错误'))
    } finally {
      setUpdateLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">录音清单</h1>
          <p className="text-gray-500">本地累计录音数据（每1分钟自动同步）</p>
        </div>
        <Button
          onClick={() => loadRecordings()}
          disabled={loading}
          variant="outline"
          size="icon"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* 筛选区域 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            筛选条件
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
            <div>
              <label className="text-sm font-medium mb-2 block">客户状态</label>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters({ ...filters, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {statusOptions.map((statusName) => (
                    <SelectItem key={statusName} value={statusName}>
                      {statusName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">项目名称</label>
              <Select
                value={filters.projectName}
                onValueChange={(value) => setFilters({ ...filters, projectName: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部项目" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部项目</SelectItem>
                  {projectOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">质检状态</label>
              <Select
                value={filters.qualityStatus}
                onValueChange={(value) => setFilters({ ...filters, qualityStatus: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="0">未质检</SelectItem>
                  <SelectItem value="1">已质检</SelectItem>
                  <SelectItem value="2">质检中</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">开始时间</label>
              <Input
                type="datetime-local"
                value={filters.startTime}
                onChange={(e) => setFilters({ ...filters, startTime: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">结束时间</label>
              <Input
                type="datetime-local"
                value={filters.endTime}
                onChange={(e) => setFilters({ ...filters, endTime: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              查询
            </Button>
            <Button variant="outline" onClick={handleReset}>重置</Button>
            <Button variant="secondary" onClick={() => {
              console.log('点击了API查询按钮');
              console.log('当前filters:', filters);
              fetchApiData();
            }} disabled={apiLoading}>
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
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => handleQuickRange('today')}>
              今天
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickRange('7days')}>
              7天
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickRange('15days')}>
              15天
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickRange('month')}>
              本月
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 错误提示 */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-800">
              <div className="flex-1">
                <p className="font-medium">加载失败</p>
                <p className="text-sm">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => loadRecordings()}>
                重试
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
                    {apiRecordings.length > 0 ? Object.keys(apiRecordings[0]).map((k) => (
                      <TableHead key={k}>{k}</TableHead>
                    )) : (
                      <TableHead>无数据</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiRecordings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={1} className="text-center py-10 text-gray-500">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    apiRecordings.map((row, idx) => (
                      <TableRow key={String(row.uuid || row.id || idx)}>
                        {Object.keys(row).map((k) => (
                          <TableCell key={`${String(row.uuid || idx)}-${k}`}>{formatCellValue(k, row[k])}</TableCell>
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
                <Button
                  size="sm"
                  variant="outline"
                  disabled={apiPagination.pageNum <= 1 || apiLoading}
                  onClick={() => fetchApiData(apiPagination.pageNum - 1)}
                >
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
            <CardTitle className="flex items-center gap-2">
              <FileAudio className="h-5 w-5" />
              录音列表
            </CardTitle>
            <CardDescription>
              {loading
                ? '加载中...'
                : `当前筛选 ${pagination.total} 条（本地累计 ${rawTotal} 条），当前第 ${pagination.page} 页`}
            </CardDescription>

            {!loading && loadedFiles.length > 0 ? (
              <div className="text-xs text-gray-500">
                加载的文件：{loadedFiles.join(', ')}
              </div>
            ) : null}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">加载中...</span>
              </div>
            ) : recordings.length === 0 ? (
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={Math.max(columnKeys.length + (hasPlayable ? 1 : 0), 1)} className="text-center text-gray-500 py-8">
                      暂无录音数据
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {columnKeys.map((key) => (
                      <TableHead key={key}>{key}</TableHead>
                    ))}
                    {hasPlayable && <TableHead>操作</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recordings.map((recording: any, idx: number) => (
                    <TableRow key={recording.uuid || recording.id || `row-${idx}`}>
                      {columnKeys.map((key) => (
                        <TableCell key={`${recording.uuid || recording.id || idx}-${key}`} className={key === 'uuid' ? 'font-medium' : ''}>
                          {formatCellValue(key, recording[key])}
                        </TableCell>
                      ))}
                      {hasPlayable && (
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePlay(recording)}
                              disabled={!recording.playUrl}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownload(recording)}
                              disabled={!recording.playUrl}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-500">
                第 {pagination.page} / {totalPages} 页
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="px-2 py-1 border rounded"
                  value={pagination.pageSize}
                  onChange={(e) =>
                    setPagination((prev) => ({
                      ...prev,
                      pageSize: Number(e.target.value),
                      page: 1,
                    }))
                  }
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pagination.page <= 1 || loading}
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                  }
                >
                  上一页
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pagination.page >= totalPages || loading}
                  onClick={() =>
                    setPagination((prev) => ({
                      ...prev,
                      page: Math.min(totalPages, prev.page + 1),
                    }))
                  }
                >
                  下一页
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 音频播放器对话框 */}
      {showPlayer && selectedRecording && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle>音频播放</CardTitle>
              <CardDescription>
                UUID: {selectedRecording.uuid} | 坐席: {selectedRecording.agentName}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">地市：</span>
                  {selectedRecording.cityName}
                </div>
                <div>
                  <span className="font-medium">被叫号码：</span>
                  {maskPhone(selectedRecording.calledPhone)}
                </div>
                <div>
                  <span className="font-medium">通话时长：</span>
                  {formatDuration(selectedRecording.answerDuration)}
                </div>
                <div>
                  <span className="font-medium">开始时间：</span>
                  {selectedRecording.startTime}
                </div>
                <div>
                  <span className="font-medium">结束时间：</span>
                  {selectedRecording.endTime || '-'}
                </div>
              </div>
              <div className="w-full">
                <audio
                  controls
                  className="w-full"
                  src={selectedRecording.playUrl}
                >
                  您的浏览器不支持音频播放
                </audio>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowPlayer(false)}>
                  关闭
                </Button>
                <Button onClick={() => handleDownload(selectedRecording)}>
                  <Download className="h-4 w-4 mr-2" />
                  下载录音
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
