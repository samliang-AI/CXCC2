'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  PhoneCall,
  Calendar,
  Download,
  RefreshCw,
  PieChart,
  MapPin,
  Users2,
  User
} from 'lucide-react'
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts'

const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#F59E0B', '#EF4444', '#6366F1', '#F59E0B']

interface StatusData {
  status: string
  count: number
  percentage: number
  isHighlight?: boolean
}

interface FilterOption {
  code: string
  name: string
}

interface FilterData {
  projects: FilterOption[]
  teams: { id: string; name: string }[]
  agents: { code: string; name: string; teamId: string }[]
}

interface OutboundResultData {
  overview: {
    totalCalls: number
    connectedCalls?: number
    successRate: number
    failRate: number
    noAnswerRate: number
  }
  statusDetails: StatusData[]
  filterData?: FilterData
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

export default function OutboundResultPage() {
  const [data, setData] = useState<OutboundResultData | null>(null)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [quickRange, setQuickRange] = useState<QuickRangeKey>('today')
  
  // 筛选相关状态
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [selectedTeam, setSelectedTeam] = useState<string>('all')
  const [selectedAgent, setSelectedAgent] = useState<string>('all')
  const [filterData, setFilterData] = useState<FilterData | null>(null)

  const fetchData = async (range?: { startDate: string; endDate: string }) => {
    const activeStartDate = range?.startDate ?? startDate
    const activeEndDate = range?.endDate ?? endDate
    if (!activeStartDate || !activeEndDate) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        startDate: activeStartDate,
        endDate: activeEndDate
      })
      if (selectedProject && selectedProject !== 'all') {
        params.append('projectName', selectedProject)
      }
      if (selectedTeam && selectedTeam !== 'all') {
        params.append('teamId', selectedTeam)
      }
      if (selectedAgent && selectedAgent !== 'all') {
        params.append('agentCode', selectedAgent)
      }
      
      const response = await fetch(
        `/api/reports/outbound-result/statistics?${params.toString()}`
      )
      const result = await response.json()
      if (result.code === 200) {
        setData(result.data)
        // 如果返回了筛选数据，更新筛选选项
        if (result.data.filterData) {
          setFilterData(result.data.filterData)
        }
      }
    } catch (error) {
      console.error('Failed to fetch outbound result data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const today = formatLocalDate(new Date())
    setQuickRange('today')
    setStartDate(today)
    setEndDate(today)
    fetchData({ startDate: today, endDate: today })
  }, [])

  const handleQuickDate = (range: Exclude<QuickRangeKey, 'custom'>) => {
    const end = new Date()
    const start = new Date(end)
    if (range === '7d') start.setDate(start.getDate() - 6)
    if (range === '15d') start.setDate(start.getDate() - 14)
    if (range === 'month') start.setDate(1)
    setQuickRange(range)
    setStartDate(formatLocalDate(start))
    setEndDate(formatLocalDate(end))
  }

  const handleReset = () => {
    const today = formatLocalDate(new Date())
    setQuickRange('today')
    setStartDate(today)
    setEndDate(today)
    setSelectedProject('all')
    setSelectedTeam('all')
    setSelectedAgent('all')
  }

  const handleExport = () => {
    if (!data?.statusDetails) return
    
    const headers = ['客户状态', '数量', '占比(%)']
    const rows = data.statusDetails.map(item => [
      item.status,
      item.count,
      item.percentage.toFixed(1)
    ])
    // 添加合计行
    rows.push(['合计', data.statusDetails.reduce((sum, item) => sum + item.count, 0).toString(), '100.0'])
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `外呼结果统计_${startDate}_${endDate}.csv`
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

  const total = data.statusDetails.reduce((sum, item) => sum + item.count, 0)
  const connectedCalls = Number(data.overview.connectedCalls ?? 0)
  const chartData = data.statusDetails.map(item => ({
    name: item.status,
    value: item.count
  }))

  return (
    <div className="space-y-6">
      {/* 面包屑导航 */}
      <div className="text-sm text-gray-500">
        主页 / 报表查询 / 外呼结果
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">外呼结果</h1>
        <p className="text-gray-500">统计录音清单中客户状态数据</p>
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
            {/* 项目筛选 */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">项目名称</label>
              <select
                value={selectedProject}
                onChange={(e) => {
                  setSelectedProject(e.target.value)
                  setSelectedTeam('all')
                  setSelectedAgent('all')
                }}
                className="px-3 py-2 border rounded-md text-sm min-w-[140px]"
              >
                <option value="all">全部项目</option>
                {filterData?.projects.map(project => (
                  <option key={project.code} value={project.code}>{project.name}</option>
                ))}
              </select>
            </div>
            
            {/* 外呼团队筛选 */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">外呼团队</label>
              <select
                value={selectedTeam}
                onChange={(e) => {
                  setSelectedTeam(e.target.value)
                  setSelectedAgent('all')
                }}
                className="px-3 py-2 border rounded-md text-sm min-w-[160px]"
              >
                <option value="all">全部团队</option>
                {filterData?.teams
                  .map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
              </select>
            </div>
            
            {/* 坐席筛选 */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">坐席</label>
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                disabled={selectedTeam === 'all'}
                className="px-3 py-2 border rounded-md text-sm min-w-[140px]"
              >
                <option value="all">{selectedTeam === 'all' ? '请先选择外呼团队' : '全部坐席'}</option>
                {filterData?.agents
                  .filter(agent => selectedTeam === 'all' || agent.teamId === selectedTeam)
                  .map(agent => (
                    <option key={agent.code} value={agent.code}>{agent.name}</option>
                  ))}
              </select>
            </div>
            
            {/* 时间筛选 */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">开始时间</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setQuickRange('custom')
                  setStartDate(e.target.value)
                }}
                className="px-3 py-2 border rounded-md text-sm"
              />
              <span className="text-gray-400">至</span>
              <label className="text-sm text-gray-500">结束时间</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setQuickRange('custom')
                  setEndDate(e.target.value)
                }}
                className="px-3 py-2 border rounded-md text-sm"
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
            <Button variant="outline" size="sm" onClick={handleReset}>
              重置
            </Button>
          </div>
          <div className="mt-2 text-sm text-gray-500">当前默认：今天</div>
        </CardContent>
      </Card>

      {/* 概览卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">接通量</CardTitle>
            <PhoneCall className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{connectedCalls.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">统计周期内接通总量</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">成功客户</CardTitle>
            <span className="text-green-500 text-xs">成功</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {data.statusDetails.find(s => s.status === '成功客户')?.count || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              占比: {(data.statusDetails.find(s => s.status === '成功客户')?.percentage || 0).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">失败客户</CardTitle>
            <span className="text-red-500 text-xs">失败</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {data.statusDetails.find(s => s.status === '失败客户')?.count || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              占比: {(data.statusDetails.find(s => s.status === '失败客户')?.percentage || 0).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">秒挂无声</CardTitle>
            <span className="text-yellow-500 text-xs">高占比</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {data.statusDetails.find(s => s.status === '秒挂无声')?.count || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              占比: {(data.statusDetails.find(s => s.status === '秒挂无声')?.percentage || 0).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 数据明细表格 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>客户状态统计</CardTitle>
            <CardDescription>
              {startDate} 至 {endDate} 客户状态分布统计
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
                  <TableHead className="w-16">序号</TableHead>
                  <TableHead>客户状态</TableHead>
                  <TableHead className="text-right">计数项:客户状态</TableHead>
                  <TableHead className="text-right">占比</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.statusDetails.map((item, index) => (
                  <TableRow 
                    key={item.status}
                    className={item.isHighlight ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}
                  >
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium">
                      {item.status === '成功客户' ? (
                        <span className="text-green-600">{item.status}</span>
                      ) : item.status === '失败客户' ? (
                        <span className="text-red-600">{item.status}</span>
                      ) : item.isHighlight ? (
                        <span className="text-yellow-600">{item.status}</span>
                      ) : (
                        item.status
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {item.count.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge 
                        variant={item.percentage > 20 ? 'destructive' : item.percentage > 10 ? 'secondary' : 'outline'}
                      >
                        {item.percentage.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {/* 合计行 */}
                <TableRow className="bg-gray-50 dark:bg-gray-800 font-semibold">
                  <TableCell></TableCell>
                  <TableCell>合计</TableCell>
                  <TableCell className="text-right">{total.toLocaleString()}</TableCell>
                  <TableCell className="text-right">100.0%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 图表区域 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>客户状态分布</CardTitle>
            <CardDescription>各状态占比饼图</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>客户状态数量</CardTitle>
            <CardDescription>各状态数量柱状图</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#3B82F6">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
