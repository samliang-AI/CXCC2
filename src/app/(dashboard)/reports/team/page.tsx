'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { 
  Users2,
  Calendar,
  Download,
  RefreshCw,
  Target,
  TrendingUp,
  Phone,
  PhoneCall,
  CheckCircle,
  Eye,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { useAutoRefresh } from '@/hooks/use-auto-refresh'
import { AutoRefreshToggle } from '@/components/auto-refresh-toggle'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

interface AgentData {
  teamName: string
  agentCode: string
  agentName: string
  monthlySuccess: number
  monthlyTarget: number
  completionRate: number
  teamId: string
}

interface DailyDetail {
  date: string
  totalCalls: number
  connectedCalls: number
  successCalls: number
  successRate: number
}

interface TeamSummary {
  teamId: string
  teamName: string
  agentCount: number
  totalMonthlySuccess: number
  totalMonthlyTarget: number
  avgSuccessPerAgent: number
  completionRate: number
  topPerformers: number
}

interface TeamDashboardData {
  overview: {
    totalAgents: number
    totalMonthlySuccess: number
    avgCompletionRate: number
    topPerformers: number
  }
  teamSummary: TeamSummary[]
  agentDetails: AgentData[]
  dateRange: {
    startDate: string
    endDate: string
  }
}

export default function TeamDashboardPage() {
  type QuickRangeKey = 'today' | '7d' | '15d' | '30d' | 'month' | 'custom'
  
  const [quickRange, setQuickRange] = useState<QuickRangeKey>('today')
  
  const formatLocalDate = (d: Date) => {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  
  const handleQuickDate = (range: Exclude<QuickRangeKey, 'custom'>) => {
    const end = new Date()
    const start = new Date(end)
    if (range === '7d') start.setDate(start.getDate() - 6)
    if (range === '15d') start.setDate(start.getDate() - 14)
    if (range === '30d') start.setDate(start.getDate() - 29)
    if (range === 'month') {
      // 设置为当月的第一天
      start.setDate(1)
    }
    setQuickRange(range)
    setStartDate(formatLocalDate(start))
    setEndDate(formatLocalDate(end))
  }
  const [data, setData] = useState<TeamDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedTeam, setSelectedTeam] = useState<string>('all')
  const [teamList, setTeamList] = useState<{id: string, name: string}[]>([])
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<AgentData | null>(null)
  const [dailyData, setDailyData] = useState<DailyDetail[]>([])
  const [dailyLoading, setDailyLoading] = useState(false)
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set())

  // 切换团队展开状态
  const toggleTeamExpand = (teamId: string) => {
    setExpandedTeams(prev => {
      const newSet = new Set(prev)
      if (newSet.has(teamId)) {
        newSet.delete(teamId)
      } else {
        newSet.add(teamId)
      }
      return newSet
    })
  }

  const fetchData = async (range?: { startDate: string; endDate: string }, isAutoRefresh = false) => {
    const activeStartDate = range?.startDate ?? startDate
    const activeEndDate = range?.endDate ?? endDate
    if (!activeStartDate || !activeEndDate) return
    
    // 只在首次加载或手动刷新时显示 loading，自动刷新时不触发 loading
    if (!isAutoRefresh) {
      setLoading(true)
    }
    try {
      const params = new URLSearchParams()
      params.append('startDate', activeStartDate)
      params.append('endDate', activeEndDate)
      if (selectedTeam && selectedTeam !== 'all') {
        params.append('teamId', selectedTeam)
      }
      const response = await fetch(
        `/api/reports/team/statistics?${params.toString()}`
      )
      const result = await response.json()
      if (result.code === 200) {
        setData(result.data)
        // 如果返回了团队列表，更新团队下拉框
        if (result.data.teamList) {
          setTeamList(result.data.teamList)
        }
      }
    } catch (error) {
      console.error('Failed to fetch team dashboard data:', error)
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

  const fetchDailyData = async (agent: AgentData) => {
    setDailyLoading(true)
    try {
      const base = startDate || formatLocalDate(new Date())
      const [yearText, monthText] = base.split('-')
      const year = Number(yearText)
      const month = Number(monthText)
      const response = await fetch(
        `/api/reports/team/agent-daily?agentCode=${agent.agentCode}&year=${year}&month=${month}`
      )
      const result = await response.json()
      if (result.code === 200) {
        setDailyData(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch daily data:', error)
    } finally {
      setDailyLoading(false)
    }
  }

  useEffect(() => {
    const today = formatLocalDate(new Date())
    setStartDate(today)
    setEndDate(today)
    fetchData({ startDate: today, endDate: today })
  }, [])

  const handleViewDetail = (agent: AgentData) => {
    setSelectedAgent(agent)
    setDetailDialogOpen(true)
    fetchDailyData(agent)
  }

  const handleExport = () => {
    if (!data?.agentDetails) return
    
    const headers = ['外呼团队', '工号', '名称', '累计成交量', '成交目标', '完成率(%)']
    const rows = data.agentDetails.map(agent => [
      agent.teamName,
      agent.agentCode,
      agent.agentName,
      agent.monthlySuccess,
      agent.monthlyTarget,
      agent.completionRate
    ])
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `团队看板_${data.dateRange.startDate}_${data.dateRange.endDate}.csv`
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
        主页 / 报表查询 / 团队看板
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">团队看板</h1>
        <p className="text-gray-500">统计不同坐席人员外呼数据</p>
      </div>

      {/* 时间筛选器 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            筛选条件
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">外呼团队</label>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm min-w-[160px]"
              >
                <option value="all">全部团队</option>
                {teamList.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">开始日期:</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">结束日期:</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
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
                7天
              </Button>
              <Button
                variant={quickRange === '15d' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleQuickDate('15d')}
              >
                15天
              </Button>
              <Button
                variant={quickRange === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleQuickDate('month')}
              >
                本月
              </Button>
            </div>
            <Button onClick={() => fetchData()} size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              查询
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              const today = formatLocalDate(new Date())
              setQuickRange('today')
              setStartDate(today)
              setEndDate(today)
              setSelectedTeam('all')
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
          <div className="mt-2 text-sm text-gray-500">
            当前查询范围：{data.dateRange.startDate} 至 {data.dateRange.endDate}
          </div>
        </CardContent>
      </Card>

      {/* 概览卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">坐席总人数</CardTitle>
            <Users2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.totalAgents}</div>
            <p className="text-xs text-muted-foreground">参与外呼的坐席数量</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">累计成交量</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.totalMonthlySuccess.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">本月成功外呼总量</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均完成率</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.avgCompletionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">目标完成情况</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">优秀坐席</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.topPerformers}</div>
            <p className="text-xs text-muted-foreground">完成率超过100%的坐席</p>
          </CardContent>
        </Card>
      </div>

      {/* 团队数据汇总 */}
      {data.teamSummary && data.teamSummary.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>团队数据汇总</CardTitle>
              <CardDescription>
                {data.dateRange.startDate} 至 {data.dateRange.endDate} 各团队外呼数据统计
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="w-12">序号</TableHead>
                    <TableHead>团队名称</TableHead>
                    <TableHead className="text-right">坐席人数</TableHead>
                    <TableHead className="text-right">累计成交量</TableHead>
                    <TableHead className="text-right">成交目标</TableHead>
                    <TableHead className="text-right">人均成交量</TableHead>
                    <TableHead className="text-right">完成率(%)</TableHead>
                    <TableHead className="text-right">优秀坐席</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.teamSummary.map((team, index) => {
                    const isExpanded = expandedTeams.has(team.teamId)
                    const teamAgents = data.agentDetails.filter(a => a.teamId === team.teamId)
                    
                    return (
                      <React.Fragment key={team.teamId}>
                        <TableRow 
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => toggleTeamExpand(team.teamId)}
                        >
                          <TableCell>
                            <button className="p-1">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-gray-500" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-500" />
                              )}
                            </button>
                          </TableCell>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell className="font-medium">
                            <span className="flex items-center gap-2">
                              <Users2 className="h-4 w-4 text-blue-500" />
                              {team.teamName}
                              <Badge variant="secondary" className="text-xs">
                                {team.agentCount}人
                              </Badge>
                            </span>
                          </TableCell>
                          <TableCell className="text-right">{team.agentCount}</TableCell>
                          <TableCell className="text-right font-semibold text-green-600">
                            {team.totalMonthlySuccess.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">{team.totalMonthlyTarget.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-semibold text-blue-600">
                            {team.avgSuccessPerAgent}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={team.completionRate >= 100 ? 'default' : team.completionRate >= 80 ? 'secondary' : 'destructive'}>
                              {team.completionRate.toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{team.topPerformers}</TableCell>
                        </TableRow>
                        
                        {/* 展开的坐席数据 */}
                        {isExpanded && teamAgents.map((agent, agentIndex) => (
                          <TableRow key={`${team.teamId}-agent-${agent.agentCode}`} className="bg-blue-50/50">
                            <TableCell></TableCell>
                            <TableCell></TableCell>
                            <TableCell>
                              <span className="flex items-center gap-2 pl-6 text-sm text-gray-600">
                                <Badge variant="outline" className="text-xs">{agent.agentCode}</Badge>
                                {agent.agentName}
                              </span>
                            </TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-right text-sm text-green-600">{agent.monthlySuccess.toLocaleString()}</TableCell>
                            <TableCell className="text-right text-sm">{agent.monthlyTarget.toLocaleString()}</TableCell>
                            <TableCell className="text-right text-sm text-blue-600">-</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline" className="text-xs">{agent.completionRate.toFixed(1)}%</Badge>
                            </TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    )
                  })}
                  {/* 合计行 */}
                  <TableRow className="bg-gray-50 dark:bg-gray-800 font-semibold">
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell>合计</TableCell>
                    <TableCell className="text-right">
                      {data.teamSummary.reduce((sum, t) => sum + t.agentCount, 0)}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {data.teamSummary.reduce((sum, t) => sum + t.totalMonthlySuccess, 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {data.teamSummary.reduce((sum, t) => sum + t.totalMonthlyTarget, 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-blue-600">
                      {(data.teamSummary.reduce((sum, t) => sum + t.totalMonthlySuccess, 0) / 
                        data.teamSummary.reduce((sum, t) => sum + t.agentCount, 0)).toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right">
                      {(data.teamSummary.reduce((sum, t) => sum + t.totalMonthlySuccess, 0) / 
                        data.teamSummary.reduce((sum, t) => sum + t.totalMonthlyTarget, 0) * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {data.teamSummary.reduce((sum, t) => sum + t.topPerformers, 0)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 数据明细表格 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>坐席数据明细</CardTitle>
            <CardDescription>
              {data.dateRange.startDate} 至 {data.dateRange.endDate} 坐席外呼数据统计
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">序号</TableHead>
                  <TableHead>外呼团队</TableHead>
                  <TableHead>工号</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead className="text-right">累计成交量</TableHead>
                  <TableHead className="text-right">成交目标</TableHead>
                  <TableHead className="text-right">完成率(%)</TableHead>
                  <TableHead className="text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.agentDetails.map((agent, index) => (
                  <TableRow key={agent.agentCode}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users2 className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">{agent.teamName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{agent.agentCode}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{agent.agentName}</TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      {agent.monthlySuccess.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {agent.monthlyTarget.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={agent.completionRate >= 100 ? 'default' : agent.completionRate >= 80 ? 'secondary' : 'destructive'}>
                        {agent.completionRate.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleViewDetail(agent)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        查看详情
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {/* 合计行 */}
                <TableRow className="bg-gray-50 dark:bg-gray-800 font-semibold">
                  <TableCell></TableCell>
                  <TableCell colSpan={3}>合计</TableCell>
                  <TableCell className="text-right text-green-600">
                    {data.agentDetails.reduce((sum, a) => sum + a.monthlySuccess, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {data.agentDetails.reduce((sum, a) => sum + a.monthlyTarget, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {(data.agentDetails.reduce((sum, a) => sum + a.monthlySuccess, 0) / 
                      data.agentDetails.reduce((sum, a) => sum + a.monthlyTarget, 0) * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 详情弹窗 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[1400px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>坐席每日数据详情</DialogTitle>
            <DialogDescription>
              {selectedAgent?.agentName}（{selectedAgent?.agentCode}）- {data.dateRange.startDate} 至 {data.dateRange.endDate}
            </DialogDescription>
          </DialogHeader>
          
          {dailyLoading ? (
            <div className="flex items-center justify-center h-48">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* 趋势图表 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">每日数据趋势</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="totalCalls" name="外呼总数" stroke="#8884d8" strokeWidth={2} />
                      <Line type="monotone" dataKey="connectedCalls" name="接通量" stroke="#82ca9d" strokeWidth={2} />
                      <Line type="monotone" dataKey="successCalls" name="成功量" stroke="#ffc658" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 每日数据表格 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">每日数据明细</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>日期</TableHead>
                          <TableHead className="text-right">外呼总数</TableHead>
                          <TableHead className="text-right">接通量</TableHead>
                          <TableHead className="text-right">成功量</TableHead>
                          <TableHead className="text-right">成功率(%)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailyData.map((day) => (
                          <TableRow key={day.date}>
                            <TableCell className="font-medium">{day.date}</TableCell>
                            <TableCell className="text-right">{day.totalCalls.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{day.connectedCalls.toLocaleString()}</TableCell>
                            <TableCell className="text-right text-green-600">{day.successCalls.toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={day.successRate >= 50 ? 'default' : 'secondary'}>
                                {day.successRate.toFixed(1)}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* 合计行 */}
                        <TableRow className="bg-gray-50 dark:bg-gray-800 font-semibold">
                          <TableCell>合计/平均</TableCell>
                          <TableCell className="text-right">
                            {dailyData.reduce((sum, d) => sum + d.totalCalls, 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {dailyData.reduce((sum, d) => sum + d.connectedCalls, 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {dailyData.reduce((sum, d) => sum + d.successCalls, 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {(dailyData.reduce((sum, d) => sum + d.successRate, 0) / dailyData.length).toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
