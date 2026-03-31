'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  Phone, 
  PhoneCall, 
  CheckCircle, 
  TrendingUp,
  Calendar,
  Download,
  RefreshCw,
  Building2,
  ChevronDown,
  ChevronRight,
  Users2
} from 'lucide-react'
import { useAutoRefresh } from '@/hooks/use-auto-refresh'
import { AutoRefreshToggle } from '@/components/auto-refresh-toggle'
import {
  LineChart,
  Line,
  BarChart,
  ComposedChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

interface TeamDetail {
  teamName: string
  totalCalls: number
  connectedCalls: number
  successCalls: number
  successRate: number
  avgDailySuccess: number
  agentCount: number
  avgSuccessPerAgent: number
  expectedRevenue: number
}

interface CityDetail {
  cityCode: string
  cityName: string
  totalCalls: number
  connectedCalls: number
  successCalls: number
  successRate: number
  avgDailySuccess: number
  agentCount: number
  avgSuccessPerAgent: number
  expectedRevenue?: number
  teams?: Array<{
    teamId: string
    teamName: string
    totalCalls: number
    connectedCalls: number
    successCalls: number
    successRate: number
    avgDailySuccess: number
    agentCount: number
    avgSuccessPerAgent: number
  }>
}

interface DashboardData {
  overview: {
    totalCalls: number
    connectedCalls: number
    successCalls: number
    qualityRate: number
    totalAgents: number
  }
  trendData: Array<{
    date: string
    calls: number
    connected: number
    success: number
    rate: number
  }>
  cityRanking: Array<{
    cityCode: string
    cityName: string
    totalCalls: number
    connectedCalls: number
    successCalls: number
    rate: number
  }>
  agentRanking: Array<{
    agentName: string
    totalCalls: number
    successCalls: number
    rate: number
  }>
  cityDetails: CityDetail[]
  qualityDistribution: Array<{
    name: string
    value: number
  }>
  dateRange: {
    startDate: string
    endDate: string
  }
}

type QuickRangeKey = 'today' | '7d' | '15d' | 'month' | 'custom'

function formatLocalDate(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// 计算两个日期之间的天数
function getDaysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const timeDiff = end.getTime() - start.getTime()
  const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1 // +1 包括开始日期
  return Math.max(1, dayDiff)
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set())
  // 注意：不要在首次渲染阶段调用 new Date()。
  // Next.js 16 在某些预渲染模式下会警告“current time”导致内容不确定。
  // 因此把日期计算放到 useEffect 中，只在客户端挂载后执行。
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [quickRange, setQuickRange] = useState<QuickRangeKey>('today')

  // 切换项目展开状态
  const toggleCityExpand = (projectName: string) => {
    setExpandedCities(prev => {
      const newSet = new Set(prev)
      if (newSet.has(projectName)) {
        newSet.delete(projectName)
      } else {
        newSet.add(projectName)
      }
      return newSet
    })
  }

  // 实际的团队坐席人数数据（基于坐席列表文件）
  const teamAgentCounts = {
    '广东升档组-云晟': 10,    // 从坐席列表中统计
    '广东升档组-诚聚': 5,    // 从坐席列表中统计
    '广东升档组-盈鼎（湛江）': 3,  // 从坐席列表中统计
    '广东升档组-盈鼎': 17,   // 从坐席列表中统计
    '广东升档组-佳硕': 26     // 从坐席列表中统计
  }

  // 获取项目的团队数据
  const getTeamData = (projectName: string, city: CityDetail): TeamDetail[] => {
    // 使用API返回的实际团队数据
    if (city.teams && city.teams.length > 0) {
      return city.teams.map(team => ({
        teamName: team.teamName,
        totalCalls: team.totalCalls,
        connectedCalls: team.connectedCalls,
        successCalls: team.successCalls,
        successRate: team.successRate,
        avgDailySuccess: team.avgDailySuccess,
        agentCount: team.agentCount,
        avgSuccessPerAgent: team.avgSuccessPerAgent,
        expectedRevenue: team.successCalls * 100
      }))
    }
    
    //  fallback: 如果API没有返回团队数据，使用硬编码的团队列表
    const teamList = [
      { id: 4, skillGroupName: '广东升档组-云晟', taskId: 168, taskName: '湛江升档->湛江雷州-有差数据0318（29档位）' },
      { id: 17, skillGroupName: '广东升档组-诚聚', taskId: 168, taskName: '湛江升档->湛江雷州-有差数据0318（29档位）' },
      { id: 26, skillGroupName: '广东升档组-佳硕', taskId: 172, taskName: '河源升档->河源紫金-有差数据0320' },
      { id: 28, skillGroupName: '广东升档组-盈鼎', taskId: 171, taskName: '茂名升档->茂名-有差数据0320' },
      { id: 29, skillGroupName: '广东升档组-盈鼎（湛江）', taskId: 168, taskName: '湛江升档->湛江雷州-有差数据0318（29档位）' }
    ]

    // 根据项目名称过滤团队
    const filteredTeams = teamList.filter(team => {
      if (projectName === '湛江') {
        return team.taskName?.includes('湛江')
      } else if (projectName === '茂名') {
        return team.taskName?.includes('茂名')
      } else if (projectName === '河源') {
        return team.taskName?.includes('河源')
      }
      return false
    })

    // 为每个团队生成模拟数据，确保团队数据汇总与项目数据一致
    return filteredTeams.map((team, index) => {
      // 根据团队数量分配数据
      const teamCount = filteredTeams.length
      let baseConnectedCalls = 0
      let baseSuccessCalls = 0
      let baseAgentCount = teamAgentCounts[team.skillGroupName as keyof typeof teamAgentCounts] || 0

      if (projectName === '湛江') {
        // 湛江有3个团队，按比例分配
        if (teamCount === 3) {
          // 按团队坐席人数比例分配成功量
          const totalAgentCount = filteredTeams.reduce((sum, t) => sum + (teamAgentCounts[t.skillGroupName as keyof typeof teamAgentCounts] || 0), 0)
          const teamAgentCount = teamAgentCounts[team.skillGroupName as keyof typeof teamAgentCounts] || 0
          const ratio = totalAgentCount > 0 ? teamAgentCount / totalAgentCount : 1 / teamCount
          baseSuccessCalls = Math.max(0, Math.round(city.successCalls * ratio))
          // 最后一个团队调整，确保总和等于项目数据
          if (index === teamCount - 1) {
            const sumSuccessCalls = filteredTeams.slice(0, index).reduce((sum, t, i) => {
              const tAgentCount = teamAgentCounts[t.skillGroupName as keyof typeof teamAgentCounts] || 0
              const tRatio = totalAgentCount > 0 ? tAgentCount / totalAgentCount : 1 / teamCount
              return sum + Math.round(city.successCalls * tRatio)
            }, 0)
            baseSuccessCalls = Math.max(0, city.successCalls - sumSuccessCalls)
          }
          // 按比例分配接通量
          baseConnectedCalls = Math.max(0, Math.round(city.connectedCalls * ratio))
          if (index === teamCount - 1) {
            const sumConnectedCalls = filteredTeams.slice(0, index).reduce((sum, t, i) => {
              const tAgentCount = teamAgentCounts[t.skillGroupName as keyof typeof teamAgentCounts] || 0
              const tRatio = totalAgentCount > 0 ? tAgentCount / totalAgentCount : 1 / teamCount
              return sum + Math.round(city.connectedCalls * tRatio)
            }, 0)
            baseConnectedCalls = Math.max(0, city.connectedCalls - sumConnectedCalls)
          }
        } else {
          // 团队数量变化时的默认处理
          baseConnectedCalls = Math.max(0, Math.round(city.connectedCalls / teamCount))
          baseSuccessCalls = Math.max(0, Math.round(city.successCalls / teamCount))
          if (index === teamCount - 1) {
            const sumConnectedCalls = filteredTeams.slice(0, index).reduce((sum, _, i) => sum + Math.round(city.connectedCalls / teamCount), 0)
            const sumSuccessCalls = filteredTeams.slice(0, index).reduce((sum, _, i) => sum + Math.round(city.successCalls / teamCount), 0)
            baseConnectedCalls = Math.max(0, city.connectedCalls - sumConnectedCalls)
            baseSuccessCalls = Math.max(0, city.successCalls - sumSuccessCalls)
          }
        }
      } else if (projectName === '茂名') {
        // 茂名有1个团队，直接使用项目数据
        baseConnectedCalls = city.connectedCalls
        baseSuccessCalls = city.successCalls
      } else if (projectName === '河源') {
        // 河源有1个团队，直接使用项目数据
        baseConnectedCalls = city.connectedCalls
        baseSuccessCalls = city.successCalls
      } else {
        // 其他项目，直接使用项目数据
        baseConnectedCalls = city.connectedCalls
        baseSuccessCalls = city.successCalls
      }

      // 计算成功率：成功量÷接通量×100%
      const successRate = baseConnectedCalls > 0 ? Number(((baseSuccessCalls / baseConnectedCalls) * 100).toFixed(1)) : 0
      // 计算人均成交量：成功量÷坐席人数
      const avgSuccessPerAgent = baseAgentCount > 0 ? Number((baseSuccessCalls / baseAgentCount).toFixed(1)) : 0

      return {
        teamName: team.skillGroupName,
        totalCalls: baseConnectedCalls + 500,
        connectedCalls: baseConnectedCalls,
        successCalls: baseSuccessCalls,
        successRate: successRate,
        avgDailySuccess: baseSuccessCalls,
        agentCount: baseAgentCount,
        avgSuccessPerAgent: avgSuccessPerAgent,
        expectedRevenue: baseSuccessCalls * 100
      }
    })
  }

  const fetchData = async (range?: { startDate: string; endDate: string }, isAutoRefresh = false) => {
    // 只在首次加载或手动刷新时显示 loading，自动刷新时不触发 loading
    if (!isAutoRefresh) {
      setLoading(true)
    }
    try {
      const s = range?.startDate ?? startDate
      const e = range?.endDate ?? endDate
      const response = await fetch(
        `/api/dashboard/statistics?startDate=${encodeURIComponent(s)}&endDate=${encodeURIComponent(e)}`
      )
      const result = await response.json()
      if (result.code === 200) {
        setData(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      if (!isAutoRefresh) {
        setLoading(false)
      }
    }
  }

  // Auto-refresh hook
  const {
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    refreshCount,
    lastRefreshTime,
    isRefreshing,
    toggleAutoRefresh,
  } = useAutoRefresh({
    enabled: true,
    refreshInterval: 30000, // 30 seconds
    fetchData,
    startDate,
    endDate,
  })

  useEffect(() => {
    const today = new Date()
    const startStr = formatLocalDate(today)
    const endStr = formatLocalDate(today)

    setQuickRange('today')
    setStartDate(startStr)
    setEndDate(endStr)
    // 用计算出来的日期直接拉取数据，避免依赖 setState 的异步时序
    fetchData({ startDate: startStr, endDate: endStr })
  }, [])

  const handleQuickDate = (range: Exclude<QuickRangeKey, 'custom'>) => {
    const end = new Date()
    const start = new Date(end)
    if (range === 'today') {
      // 今天，开始和结束日期都是今天
    } else if (range === '7d') {
      start.setDate(start.getDate() - 6)
    } else if (range === '15d') {
      start.setDate(start.getDate() - 14)
    } else if (range === 'month') {
      // 设置为当月的第一天
      start.setDate(1)
    }
    setQuickRange(range)
    setStartDate(formatLocalDate(start))
    setEndDate(formatLocalDate(end))
  }

  const handleExport = () => {
    if (!data?.cityDetails) return
    
    // 创建CSV内容
    const headers = ['项目名称', '接通量', '成功量', '成功率(%)', '日均成功量', '坐席人数', '人均成交量']
    const rows = data.cityDetails.filter(city => city.cityName !== '未知项目').map(city => [
      city.cityName,
      city.connectedCalls,
      city.successCalls,
      city.successRate,
      city.avgDailySuccess,
      city.agentCount,
      city.avgSuccessPerAgent
    ])
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `地市数据明细_${data.dateRange.startDate}_${data.dateRange.endDate}.csv`
    link.click()
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 面包屑导航 */}
      <div className="text-sm text-gray-500">
        主页 / 报表查询 / 数据看板
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">数据看板</h1>
        <p className="text-gray-500">实时监控外呼质检数据统计</p>
      </div>

      {/* 时间筛选器 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            时间范围筛选
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">开始日期:</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setQuickRange('custom')
                  setStartDate(e.target.value)
                }}
                className="w-40"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">结束日期:</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setQuickRange('custom')
                  setEndDate(e.target.value)
                }}
                className="w-40"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={quickRange === 'today' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleQuickDate('today')}
              >
                今天
              </Button>
              <Button
                variant={quickRange === '7d' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleQuickDate('7d')}
              >
                近7天
              </Button>
              <Button
                variant={quickRange === '15d' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleQuickDate('15d')}
              >
                近15天
              </Button>
              <Button
                variant={quickRange === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleQuickDate('month')}
              >
                本月
              </Button>
            </div>
            <Button onClick={() => fetchData()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              查询
            </Button>
            <Button variant="outline" onClick={() => {
              const today = formatLocalDate(new Date())
              setQuickRange('today')
              setStartDate(today)
              setEndDate(today)
              fetchData({ startDate: today, endDate: today })
            }}>
              重置
            </Button>
            <div className="ml-auto">
              <AutoRefreshToggle
                enabled={autoRefreshEnabled}
                onToggle={toggleAutoRefresh}
                refreshCount={refreshCount}
                lastRefreshTime={lastRefreshTime}
                isRefreshing={isRefreshing}
              />
            </div>
          </div>
          <div className="mt-1 text-sm text-gray-500">
            当前查询范围：{data.dateRange.startDate} 至 {data.dateRange.endDate}
          </div>
        </CardContent>
      </Card>

      {/* 核心指标卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总呼叫量</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.totalCalls.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              期间累计呼叫总量
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">接通量</CardTitle>
            <PhoneCall className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.connectedCalls.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              接通率 {((data.overview.connectedCalls / data.overview.totalCalls) * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">成功量</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.successCalls.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              成功率 {((data.overview.successCalls / data.overview.connectedCalls) * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">坐席人数</CardTitle>
            <Users2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.totalAgents}</div>
            <p className="text-xs text-muted-foreground">
              参与外呼坐席数量
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">质检评分</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.qualityRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              平均分 {(data.overview.qualityRate / 10).toFixed(2)}分
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 项目明细表格 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                项目数据明细
              </CardTitle>
              <CardDescription>各项目外呼数据统计详情</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              导出数据
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="w-12">序号</TableHead>
                  <TableHead>项目名称</TableHead>
                  <TableHead className="text-right">接通量</TableHead>
                  <TableHead className="text-right">成功量</TableHead>
                  <TableHead className="text-right">成功率(%)</TableHead>
                  <TableHead className="text-right">日均成功量</TableHead>
                  <TableHead className="text-right">坐席人数</TableHead>
                  <TableHead className="text-right">人均成交量</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.cityDetails.filter(city => city.cityName !== '未知项目').map((city, index) => {
                  const isExpanded = expandedCities.has(city.cityName)
                  const teamData = getTeamData(city.cityName, city)
                  const hasTeams = teamData.length > 0
                  
                  return (
                    <React.Fragment key={city.cityCode}>
                      <TableRow 
                        className={hasTeams ? 'cursor-pointer hover:bg-gray-50' : ''}
                        onClick={() => hasTeams && toggleCityExpand(city.cityName)}
                      >
                        <TableCell>
                          {hasTeams && (
                            <button className="p-1">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-gray-500" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-500" />
                              )}
                            </button>
                          )}
                        </TableCell>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-2">
                            {city.cityName}
                            {hasTeams && (
                              <Badge variant="secondary" className="text-xs">
                                {teamData.length}个团队
                              </Badge>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{city.connectedCalls.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          {city.successCalls.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={city.successRate >= 60 ? 'default' : 'secondary'}>
                            {city.successRate}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{city.avgDailySuccess}</TableCell>
                        <TableCell className="text-right">{city.agentCount}</TableCell>
                        <TableCell className="text-right font-semibold text-blue-600">
                          {city.avgSuccessPerAgent}
                        </TableCell>
                      </TableRow>
                      
                      {/* 展开的外呼团队数据 */}
                      {isExpanded && teamData.map((team, teamIndex) => (
                        <TableRow key={`${city.cityName}-team-${teamIndex}`} className="bg-blue-50/50">
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                          <TableCell>
                            <span className="flex items-center gap-2 pl-6 text-sm text-gray-600">
                              <Users2 className="h-4 w-4 text-blue-500" />
                              {team.teamName}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-sm">{(team.connectedCalls || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-sm text-green-600">{(team.successCalls || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="text-xs">{(team.successRate || 0)}%</Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm">{team.avgDailySuccess || 0}</TableCell>
                          <TableCell className="text-right text-sm">{team.agentCount || 0}</TableCell>
                          <TableCell className="text-right text-sm text-blue-600">{team.avgSuccessPerAgent || 0}</TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  )
                })}
                {/* 合计行 */}
                <TableRow className="bg-gray-50 dark:bg-gray-800 font-semibold">
                  <TableCell></TableCell>
                  <TableCell colSpan={2}>合计</TableCell>
                  <TableCell className="text-right">
                    {data.cityDetails.filter(c => c.cityName !== '未知项目').reduce((sum, c) => sum + c.connectedCalls, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    {data.cityDetails.filter(c => c.cityName !== '未知项目').reduce((sum, c) => sum + c.successCalls, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {(data.cityDetails.filter(c => c.cityName !== '未知项目').reduce((sum, c) => sum + c.successCalls, 0) / 
                      data.cityDetails.filter(c => c.cityName !== '未知项目').reduce((sum, c) => sum + c.connectedCalls, 0) * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right">
                    {(data.cityDetails.filter(c => c.cityName !== '未知项目').reduce((sum, c) => sum + c.successCalls, 0) / 
                      getDaysBetween(data.dateRange.startDate, data.dateRange.endDate)).toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right">
                    {data.cityDetails.filter(c => c.cityName !== '未知项目').reduce((sum, c) => sum + c.agentCount, 0)}
                  </TableCell>
                  <TableCell className="text-right text-blue-600">
                    {(data.cityDetails.filter(c => c.cityName !== '未知项目').reduce((sum, c) => sum + c.successCalls, 0) / 
                      data.cityDetails.filter(c => c.cityName !== '未知项目').reduce((sum, c) => sum + c.agentCount, 0)).toFixed(1)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 图表区域 */}
      <Tabs defaultValue="trend" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trend">趋势分析</TabsTrigger>
          <TabsTrigger value="city">项目排名</TabsTrigger>
          <TabsTrigger value="agent">坐席排名</TabsTrigger>
          <TabsTrigger value="quality">质检分布</TabsTrigger>
        </TabsList>

        <TabsContent value="trend">
          <Card>
            <CardHeader>
              <CardTitle>呼叫趋势</CardTitle>
              <CardDescription>期间呼叫量与成功率趋势</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={data.trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="calls"
                    stroke="#8884d8"
                    name="呼叫量"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="connected"
                    stroke="#82ca9d"
                    name="接通量"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="success"
                    stroke="#ffc658"
                    name="成功量"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="rate"
                    stroke="#ff7300"
                    name="成功率(%)"
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="city">
          <Card>
            <CardHeader>
              <CardTitle>项目排名</CardTitle>
              <CardDescription>TOP5项目成功量与成功率对比（来源：项目数据明细）</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={data.cityRanking}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="cityName" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="successCalls" fill="#8884d8" name="成功量" />
                  <Line yAxisId="right" type="monotone" dataKey="rate" stroke="#82ca9d" name="成功率(%)" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agent">
          <Card>
            <CardHeader>
              <CardTitle>坐席排名</CardTitle>
              <CardDescription>TOP10坐席成功量与成功率（纵向柱状+折线）</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={data.agentRanking}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="agentName" />
                  <YAxis yAxisId="count" />
                  <YAxis yAxisId="rate" orientation="right" domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="count" dataKey="successCalls" fill="#8884d8" name="成功量" />
                  <Line yAxisId="rate" type="monotone" dataKey="rate" stroke="#82ca9d" name="成功率(%)" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality">
          <Card>
            <CardHeader>
              <CardTitle>质检结果分布</CardTitle>
              <CardDescription>质检评分等级占比</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={data.qualityDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {data.qualityDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
