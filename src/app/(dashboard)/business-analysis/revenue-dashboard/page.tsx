'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function RevenueDashboardPage() {
  // 状态
  const [orders, setOrders] = useState([])
  const [ordersTotal, setOrdersTotal] = useState(0)
  const [date, setDate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [selectedRange, setSelectedRange] = useState('today')
  const [loading, setLoading] = useState(false)
  // 静默刷新状态（用于自动刷新，不显示加载指示器）
  const [silentLoading, setSilentLoading] = useState(false)
  // 通话清单数据状态（用于外呼量）
  const [callLogs, setCallLogs] = useState([])
  const [callLogsTotal, setCallLogsTotal] = useState(0)
  // 录音清单数据状态（用于接通量）
  const [recordings, setRecordings] = useState([])
  // 录音总数量状态（用于接通量）
  const [recordingsTotal, setRecordingsTotal] = useState(0)
  // 数据缓存
  const [dataCache, setDataCache] = useState({
    orders: {},
    callLogs: {},
    recordings: {}
  })

  // 计算时间范围的辅助函数
  const getDateRange = (rangeType) => {
    const now = new Date()
    let start, end
    
    switch (rangeType) {
      case 'today':
        start = new Date(now)
        start.setHours(0, 0, 0, 0)
        end = new Date(now)
        end.setHours(23, 59, 59, 999)
        break
      case '7days':
        start = new Date(now)
        start.setDate(start.getDate() - 6)
        start.setHours(0, 0, 0, 0)
        end = new Date(now)
        end.setHours(23, 59, 59, 999)
        break
      case '15days':
        start = new Date(now)
        start.setDate(start.getDate() - 14)
        start.setHours(0, 0, 0, 0)
        end = new Date(now)
        end.setHours(23, 59, 59, 999)
        break
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        start.setHours(0, 0, 0, 0)
        end = new Date(now)
        end.setHours(23, 59, 59, 999)
        break
      default:
        return { start: null, end: null }
    }
    
    // 获取本地时区的日期字符串，确保格式为 YYYY-MM-DD
    const getLocalDateString = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    
    return {
      start: getLocalDateString(start),
      end: getLocalDateString(end)
    }
  }

  // 在useEffect中设置默认日期为当天，避免在服务器端渲染时访问当前时间
  useEffect(() => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const todayStr = `${year}-${month}-${day}`
    setDate(todayStr)
    setStartDate(todayStr)
    setEndDate(todayStr)
  }, [])

  // 预加载常用时间范围的数据
  useEffect(() => {
    const ranges = ['today', '7days', '15days', 'month']
    
    ranges.forEach(rangeType => {
      const { start, end } = getDateRange(rangeType)
      if (start && end) {
        // 预加载数据，不更新UI状态，只更新缓存
        const cacheKey = `${start}_${end}`
        
        // 预加载订单数据
        fetch(`/api/orders?startDate=${start}&endDate=${end}&pageSize=10000`)
          .then(response => response.json())
          .then(data => {
            if (data.code === 0) {
              setDataCache(prev => ({
                ...prev,
                orders: {
                  ...prev.orders,
                  [cacheKey]: {
                    data: data.data,
                    total: data.total || 0
                  }
                }
              }))
            }
          })
          .catch(error => console.error('预加载订单数据失败:', error))
        
        // 预加载通话清单数据
        fetch(`/api/local/call-logs?startDate=${start}&endDate=${end}`)
          .then(response => response.json())
          .then(data => {
            if (data.code === 0) {
              setDataCache(prev => ({
                ...prev,
                callLogs: {
                  ...prev.callLogs,
                  [cacheKey]: {
                    data: data.data || [],
                    total: data.total || 0
                  }
                }
              }))
            }
          })
          .catch(error => console.error('预加载通话清单数据失败:', error))
        
        // 预加载录音清单数据
        fetch(`/api/local/recordings?startDate=${start}&endDate=${end}&pageSize=10000`)
          .then(response => response.json())
          .then(data => {
            if (data.code === 0) {
              setDataCache(prev => ({
                ...prev,
                recordings: {
                  ...prev.recordings,
                  [cacheKey]: {
                    data: data.data?.records || data.rows || [],
                    total: data.total || 0
                  }
                }
              }))
            }
          })
          .catch(error => console.error('预加载录音清单数据失败:', error))
      }
    })
  }, [])

  // 从API获取业务订单数据
  const fetchOrders = useCallback(async (startDate, endDate) => {
    if (!startDate || !endDate) return
    
    // 检查缓存
    const cacheKey = `${startDate}_${endDate}`
    if (dataCache.orders[cacheKey]) {
      const cachedData = dataCache.orders[cacheKey]
      setOrders(cachedData.data)
      setOrdersTotal(cachedData.total)
      return
    }
    
    try {
      setLoading(true)
      const response = await fetch(`/api/orders?startDate=${startDate}&endDate=${endDate}&pageSize=10000`)
      const data = await response.json()
      
      if (data.code === 0) {
        setOrders(data.data)
        setOrdersTotal(data.total || 0)
        // 更新缓存
        setDataCache(prev => ({
          ...prev,
          orders: {
            ...prev.orders,
            [cacheKey]: {
              data: data.data,
              total: data.total || 0
            }
          }
        }))
      } else {
        setOrders([])
        setOrdersTotal(0)
      }
    } catch (error) {
      console.error('加载订单数据失败:', error)
      setOrders([])
      setOrdersTotal(0)
    } finally {
      setLoading(false)
    }
  }, [dataCache.orders])

  // 从API获取通话清单数据（用于外呼量）
  const fetchCallLogs = useCallback(async (startDate, endDate) => {
    if (!startDate || !endDate) return
    
    // 检查缓存
    const cacheKey = `${startDate}_${endDate}`
    if (dataCache.callLogs[cacheKey]) {
      const cachedData = dataCache.callLogs[cacheKey]
      setCallLogs(cachedData.data)
      setCallLogsTotal(cachedData.total)
      return
    }
    
    try {
      setLoading(true)
      // 使用本地通话清单API获取数据
      const response = await fetch(`/api/local/call-logs?startDate=${startDate}&endDate=${endDate}`)
      const data = await response.json()
      
      if (data.code === 0) {
        setCallLogs(data.data || [])
        setCallLogsTotal(data.total || 0)
        // 更新缓存
        setDataCache(prev => ({
          ...prev,
          callLogs: {
            ...prev.callLogs,
            [cacheKey]: {
              data: data.data || [],
              total: data.total || 0
            }
          }
        }))
      } else {
        setCallLogs([])
        setCallLogsTotal(0)
      }
    } catch (error) {
      console.error('加载通话清单数据失败:', error)
      setCallLogs([])
      setCallLogsTotal(0)
    } finally {
      setLoading(false)
    }
  }, [dataCache.callLogs])

  // 从API获取录音清单数据（用于接通量）
  const fetchRecordings = useCallback(async (startDate, endDate) => {
    if (!startDate || !endDate) return
    
    // 检查缓存
    const cacheKey = `${startDate}_${endDate}`
    if (dataCache.recordings[cacheKey]) {
      const cachedData = dataCache.recordings[cacheKey]
      setRecordingsTotal(cachedData.total)
      setRecordings(cachedData.data)
      return
    }
    
    try {
      setLoading(true)
      // 使用本地录音清单API获取数据，设置pageSize为一个大值以获取所有数据
      const response = await fetch(`/api/local/recordings?startDate=${startDate}&endDate=${endDate}&pageSize=10000`)
      const data = await response.json()
      
      if (data.code === 0) {
        // 直接使用API返回的total字段作为接通量
        setRecordingsTotal(data.total || 0)
        setRecordings(data.data?.records || data.rows || [])
        // 更新缓存
        setDataCache(prev => ({
          ...prev,
          recordings: {
            ...prev.recordings,
            [cacheKey]: {
              data: data.data?.records || data.rows || [],
              total: data.total || 0
            }
          }
        }))
      } else {
        setRecordingsTotal(0)
        setRecordings([])
      }
    } catch (error) {
      console.error('加载录音清单数据失败:', error)
      setRecordingsTotal(0)
      setRecordings([])
    } finally {
      setLoading(false)
    }
  }, [dataCache.recordings])

  // 日期变化时重新加载数据
  useEffect(() => {
    if (startDate && endDate) {
      fetchOrders(startDate, endDate)
      fetchCallLogs(startDate, endDate)
      fetchRecordings(startDate, endDate)
    }
  }, [startDate, endDate])

  // 静默刷新数据（不显示加载指示器）
  const silentRefresh = useCallback(async () => {
    if (!startDate || !endDate) return
    
    try {
      setSilentLoading(true)
      await Promise.all([
        fetchOrders(startDate, endDate),
        fetchCallLogs(startDate, endDate),
        fetchRecordings(startDate, endDate)
      ])
    } catch (error) {
      console.error('静默刷新数据失败:', error)
    } finally {
      setSilentLoading(false)
    }
  }, [startDate, endDate, fetchOrders, fetchCallLogs, fetchRecordings])

  // 每30秒自动刷新数据
  useEffect(() => {
    if (!startDate || !endDate) return
    
    // 立即执行一次刷新
    silentRefresh()
    
    // 如果启用了自动刷新，设置30秒定时器
    let intervalId
    if (autoRefresh) {
      intervalId = setInterval(() => {
        silentRefresh()
      }, 30000) // 30秒
    }
    
    // 清理定时器
    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [startDate, endDate, autoRefresh, silentRefresh])

  // 计算统计数据
  const stats = useMemo(() => {
    if (!startDate || !endDate) {
      return {
        totalRevenue: 0,
        successCount: 0,
        connectedCount: 0,
        totalCount: 0,
        teamRevenue: {},
        projectRevenue: {}
      }
    }

    // 计算当日收益（差额总和）
    const totalRevenue = orders.reduce((sum, order) => sum + (order.difference || order.discountAmount || 0), 0)

    // 计算成功量（基于业务订单的总数量）
    const successCount = ordersTotal

    // 外呼量：通话清单总数量
    const totalCount = callLogsTotal

    // 接通量：录音清单总数量
    const connectedCount = recordingsTotal

    // 计算各外呼团队收益（差额总和）
    const teamRevenue = {}
    orders.forEach(order => {
      const team = order.team || '未知团队'
      if (!teamRevenue[team]) {
        teamRevenue[team] = 0
      }
      teamRevenue[team] += (order.difference || order.discountAmount || 0)
    })

    // 计算各项目名称收益（差额总和）
    const projectRevenue = {}
    orders.forEach(order => {
      const project = order.city || order.projectName || '未知项目'
      if (!projectRevenue[project]) {
        projectRevenue[project] = 0
      }
      projectRevenue[project] += (order.difference || order.discountAmount || 0)
    })

    return {
      totalRevenue,
      successCount,
      connectedCount,
      totalCount,
      teamRevenue,
      projectRevenue
    }
  }, [orders, ordersTotal, startDate, endDate, callLogsTotal, recordingsTotal])

  // 时间范围快捷选择
  const handleQuickRange = (rangeType) => {
    const now = new Date()
    let start, end
    
    switch (rangeType) {
      case 'today':
        start = new Date(now)
        start.setHours(0, 0, 0, 0)
        end = new Date(now)
        end.setHours(23, 59, 59, 999)
        break
      case '7days':
        start = new Date(now)
        start.setDate(start.getDate() - 6)
        start.setHours(0, 0, 0, 0)
        end = new Date(now)
        end.setHours(23, 59, 59, 999)
        break
      case '15days':
        start = new Date(now)
        start.setDate(start.getDate() - 14)
        start.setHours(0, 0, 0, 0)
        end = new Date(now)
        end.setHours(23, 59, 59, 999)
        break
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        start.setHours(0, 0, 0, 0)
        end = new Date(now)
        end.setHours(23, 59, 59, 999)
        break
      default:
        return
    }
    
    // 获取本地时区的日期字符串，确保格式为 YYYY-MM-DD
    const getLocalDateString = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    const startStr = getLocalDateString(start)
    const endStr = getLocalDateString(end)
    
    setStartDate(startStr)
    setEndDate(endStr)
    setSelectedRange(rangeType)
  }

  // 重置日期
  const handleReset = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const todayStr = `${year}-${month}-${day}`
    setStartDate(todayStr)
    setEndDate(todayStr)
    setSelectedRange('today')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">收益看板</h1>
        <p className="text-gray-500">BPO经营分析管理系统</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">时间范围筛选</span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">开始日期：</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border rounded-md px-3 py-2"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">结束日期：</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border rounded-md px-3 py-2"
            />
          </div>
          <button
            onClick={() => handleQuickRange('today')}
            className={`px-3 py-1 rounded-md text-sm ${selectedRange === 'today' ? 'bg-black text-white' : 'bg-gray-200 text-gray-800'}`}
          >
            今天
          </button>
          <button
            onClick={() => handleQuickRange('7days')}
            className={`px-3 py-1 rounded-md text-sm ${selectedRange === '7days' ? 'bg-black text-white' : 'bg-gray-200 text-gray-800'}`}
          >
            近7天
          </button>
          <button
            onClick={() => handleQuickRange('15days')}
            className={`px-3 py-1 rounded-md text-sm ${selectedRange === '15days' ? 'bg-black text-white' : 'bg-gray-200 text-gray-800'}`}
          >
            近15天
          </button>
          <button
            onClick={() => handleQuickRange('month')}
            className={`px-3 py-1 rounded-md text-sm ${selectedRange === 'month' ? 'bg-black text-white' : 'bg-gray-200 text-gray-800'}`}
          >
            本月
          </button>
          <button
            onClick={silentRefresh}
            className="px-3 py-1 bg-black text-white rounded-md text-sm flex items-center gap-1"
            disabled={loading || silentLoading}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            查询
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1 bg-gray-200 text-gray-800 rounded-md text-sm"
          >
            重置
          </button>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm">自动刷新</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
        <div className="text-sm text-gray-500">
          当前查询范围：{startDate} 至 {endDate}
        </div>
        {(loading || silentLoading) && <span className="text-sm text-gray-500">加载中...</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">预估收益</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">¥{stats.totalRevenue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">成功量</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{stats.successCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">接通量</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">{stats.connectedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">外呼量</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-600">{stats.totalCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>各外呼团队收益</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(stats.teamRevenue).map(([team, revenue]) => (
              <div key={team} className="flex justify-between items-center p-3 border rounded-lg">
                <span className="font-medium">{team}</span>
                <span className="text-lg font-bold">¥{revenue.toFixed(2)}</span>
              </div>
            ))}
            {Object.keys(stats.teamRevenue).length === 0 && (
              <p className="text-gray-500">暂无数据</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>各项目名称收益核算</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(stats.projectRevenue).map(([project, revenue]) => (
              <div key={project} className="flex justify-between items-center p-3 border rounded-lg">
                <span className="font-medium">{project}</span>
                <span className="text-lg font-bold">¥{revenue.toFixed(2)}</span>
              </div>
            ))}
            {Object.keys(stats.projectRevenue).length === 0 && (
              <p className="text-gray-500">暂无数据</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
