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
  Filter,
  Calendar,
  Download,
  RefreshCw,
  Phone,
  PhoneCall,
  CheckCircle,
  Hash,
  ChevronDown,
  ChevronRight,
  Users2,
  MapPin
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'

interface KeyInfoDetail {
  keyInfo: string
  keyName: string
  teamName: string
  agentName: string
  totalCalls: number
  connectedCalls: number
  noAnswerCalls: number
  connectRate: number
  successCalls: number
  successRate: number
  avgCallDuration: number
  cityDetails: { cityName: string; totalCalls: number; connectedCalls: number; successCalls: number }[]
  teamDetails: { teamName: string; totalCalls: number; connectedCalls: number; successCalls: number }[]
}

interface TypeFilterData {
  overview: {
    totalCalls: number
    connectedCalls: number
    noAnswerCalls: number
    successCalls: number
  }
  keyInfoDetails: KeyInfoDetail[]
  filterData?: {
    projects: { code: string; name: string }[]
    teams: { id: string; name: string; taskName?: string }[]
    tasks: { id: string; name: string; projectCode: string }[]
    agents: { code: string; name: string; teamId: string }[]
    keyInfoList: { code: string; name: string }[]
  }
  dateRange: {
    startDate: string
    endDate: string
  }
}

type QuickRangeKey = 'today' | '7d' | '15d' | '30d' | 'month' | '90d' | 'custom'

function formatLocalDate(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export default function TypeFilterPage() {
  const [data, setData] = useState<TypeFilterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [quickRange, setQuickRange] = useState<QuickRangeKey>('today')
  
  // 筛选相关状态
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [selectedTask, setSelectedTask] = useState<string>('all')
  const [selectedTeam, setSelectedTeam] = useState<string>('all')
  const [selectedAgent, setSelectedAgent] = useState<string>('all')
  const [selectedKeyInfo, setSelectedKeyInfo] = useState<string>('all')
  
  // 展开状态
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [expandedType, setExpandedType] = useState<'city' | 'team'>('city')

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
      if (selectedKeyInfo && selectedKeyInfo !== 'all') {
        params.append('keyInfo', selectedKeyInfo)
      }
      if (selectedTask && selectedTask !== 'all') {
        params.append('taskId', selectedTask)
      }
      
      const response = await fetch(
        `/api/reports/type-filter/statistics?${params.toString()}`
      )
      const result = await response.json()
      if (result.code === 200) {
        setData(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch type filter data:', error)
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
    if (range === '30d') start.setDate(start.getDate() - 29)
    if (range === 'month') {
      // 设置为当月的第一天
      start.setDate(1)
    }
    if (range === '90d') start.setDate(start.getDate() - 89)
    setQuickRange(range)
    setStartDate(formatLocalDate(start))
    setEndDate(formatLocalDate(end))
  }

  const handleExport = () => {
    if (!data?.keyInfoDetails) return
    
    const headers = ['类型', '总呼叫量', '接通量', '未接通量', '接通率(%)', '成功量', '成功率(%)', '平均通话时长(秒)']
    const rows = data.keyInfoDetails.map(item => [
      item.keyName,
      item.totalCalls,
      item.connectedCalls,
      item.noAnswerCalls,
      item.connectRate,
      item.successCalls,
      item.successRate,
      item.avgCallDuration
    ])
    // 添加合计行
    rows.push([
      '合计',
      data.keyInfoDetails.reduce((sum, k) => sum + k.totalCalls, 0).toString(),
      data.keyInfoDetails.reduce((sum, k) => sum + k.connectedCalls, 0).toString(),
      data.keyInfoDetails.reduce((sum, k) => sum + k.noAnswerCalls, 0).toString(),
      ((data.overview.connectedCalls / data.overview.totalCalls) * 100).toFixed(1),
      data.keyInfoDetails.reduce((sum, k) => sum + k.successCalls, 0).toString(),
      ((data.overview.successCalls / data.overview.totalCalls) * 100).toFixed(1),
      '-'
    ])
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `类型统计_${startDate}_${endDate}.csv`
    link.click()
  }

  // 切换展开状态
  const toggleExpand = (keyInfo: string) => {
    setExpandedKeys(prev => {
      const newSet = new Set(prev)
      if (newSet.has(keyInfo)) {
        newSet.delete(keyInfo)
      } else {
        newSet.add(keyInfo)
      }
      return newSet
    })
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

  const chartData = data.keyInfoDetails.slice(0, 10).map(item => ({
    name: item.keyName,
    总呼叫量: item.totalCalls,
    接通量: item.connectedCalls,
    成功量: item.successCalls
  }))

  return (
    <div className="space-y-6">
      {/* 面包屑导航 */}
      <div className="text-sm text-gray-500">
        主页 / 报表查询 / 类型筛选
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">类型筛选</h1>
        <p className="text-gray-500">基于通话清单数据，按类型统计各维度数据</p>
      </div>

      {/* 筛选区域 */}
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
                  setSelectedTask('all')
                  setSelectedTeam('all')
                  setSelectedAgent('all')
                }}
                className="px-3 py-2 border rounded-md text-sm min-w-[140px]"
              >
                <option value="all">全部项目</option>
                {data.filterData?.projects.map(project => (
                  <option key={project.code} value={project.code}>{project.name}</option>
                ))}
              </select>
            </div>
            
            {/* 任务名称筛选 */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">任务名称</label>
              <select
                value={selectedTask}
                onChange={(e) => setSelectedTask(e.target.value)}
                disabled={selectedProject === 'all'}
                className="px-3 py-2 border rounded-md text-sm min-w-[160px]"
              >
                <option value="all">{selectedProject === 'all' ? '请先选择项目名称' : '全部任务'}</option>
                {data.filterData?.tasks && data.filterData.tasks
                  .filter(task => selectedProject === 'all' || task.projectCode === selectedProject)
                  .map(task => (
                    <option key={task.id} value={task.id}>{task.name}</option>
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
                {data.filterData?.teams.map(team => (
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
                {data.filterData?.agents
                  .filter(agent => selectedTeam === 'all' || agent.teamId === selectedTeam)
                  .map(agent => (
                    <option key={agent.code} value={agent.code}>{agent.name}</option>
                  ))}
              </select>
            </div>
            
            {/* 类型筛选 */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">类型</label>
              <select
                value={selectedKeyInfo}
                onChange={(e) => setSelectedKeyInfo(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm min-w-[120px]"
              >
                <option value="all">全部类型</option>
                {data.filterData?.keyInfoList.map(key => (
                  <option key={key.code} value={key.code}>{key.name}</option>
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
            <Button variant="outline" size="sm" onClick={() => {
              const today = formatLocalDate(new Date())
              setQuickRange('today')
              setStartDate(today)
              setEndDate(today)
              setSelectedProject('all')
              setSelectedTask('all')
              setSelectedTeam('all')
              setSelectedAgent('all')
              setSelectedKeyInfo('all')
              fetchData({ startDate: today, endDate: today })
            }}>
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
            <CardTitle className="text-sm font-medium">总呼叫量</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.totalCalls.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">统计周期内总呼叫数</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">接通量</CardTitle>
            <PhoneCall className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{data.overview.connectedCalls.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              接通率 {((data.overview.connectedCalls / data.overview.totalCalls) * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">未接通量</CardTitle>
            <PhoneCall className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{data.overview.noAnswerCalls.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              未接通率 {((data.overview.noAnswerCalls / data.overview.totalCalls) * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">成功量</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{data.overview.successCalls.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              成功率 {((data.overview.successCalls / data.overview.connectedCalls) * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 类型统计表格 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>类型统计</CardTitle>
            <CardDescription>
              {startDate} 至 {endDate} 各类型数据统计（数据来源：通话清单）
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 mr-4">
              <span className="text-sm text-gray-500">展开明细：</span>
              <select
                value={expandedType}
                onChange={(e) => setExpandedType(e.target.value as 'city' | 'team')}
                className="px-2 py-1 border rounded text-sm"
              >
                <option value="city">按地市</option>
                <option value="team">按团队</option>
              </select>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              导出
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="w-16">序号</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>外呼团队</TableHead>
                  <TableHead>坐席</TableHead>
                  <TableHead className="text-right">总呼叫量</TableHead>
                  <TableHead className="text-right">接通量</TableHead>
                  <TableHead className="text-right">未接通量</TableHead>
                  <TableHead className="text-right">接通率(%)</TableHead>
                  <TableHead className="text-right">成功量</TableHead>
                  <TableHead className="text-right">成功率(%)</TableHead>
                  <TableHead className="text-right">平均通话时长(秒)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.keyInfoDetails.map((item, index) => {
                  const isExpanded = expandedKeys.has(item.keyInfo)
                  const details = expandedType === 'city' ? item.cityDetails : item.teamDetails
                  
                  return (
                    <React.Fragment key={item.keyInfo}>
                      <TableRow 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => toggleExpand(item.keyInfo)}
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
                          <div className="flex items-center gap-2">
                            <Hash className="h-4 w-4 text-blue-500" />
                            <Badge variant="outline">{item.keyName}</Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{item.teamName || '-'}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{item.agentName || '-'}</span>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{item.totalCalls.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-green-600">{item.connectedCalls.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-red-600">{item.noAnswerCalls.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={item.connectRate >= 50 ? 'default' : item.connectRate >= 30 ? 'secondary' : 'destructive'}>
                            {item.connectRate.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-blue-600">{item.successCalls.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{item.successRate.toFixed(1)}%</Badge>
                        </TableCell>
                        <TableCell className="text-right">{item.avgCallDuration}</TableCell>
                      </TableRow>
                      
                      {/* 展开的明细数据 */}
                      {isExpanded && details.map((detail, detailIndex) => (
                        <TableRow key={`${item.keyInfo}-${detailIndex}`} className="bg-blue-50/50">
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                          <TableCell>
                            <span className="flex items-center gap-2 pl-6 text-sm text-gray-600">
                              {expandedType === 'city' ? (
                                <>
                                  <MapPin className="h-3 w-3" />
                                  {(detail as { cityName: string }).cityName}
                                </>
                              ) : (
                                <>
                                  <Users2 className="h-3 w-3" />
                                  {(detail as { teamName: string }).teamName}
                                </>
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-gray-400">-</TableCell>
                          <TableCell className="text-sm text-gray-400">-</TableCell>
                          <TableCell className="text-right text-sm">{detail.totalCalls.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-sm text-green-600">{detail.connectedCalls.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-sm text-red-600">{(detail.totalCalls - detail.connectedCalls).toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="text-xs">
                              {detail.totalCalls > 0 ? ((detail.connectedCalls / detail.totalCalls) * 100).toFixed(1) : '0.0'}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm text-blue-600">{detail.successCalls.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="text-xs">
                              {detail.totalCalls > 0 ? ((detail.successCalls / detail.totalCalls) * 100).toFixed(1) : '0.0'}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm">-</TableCell>
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
                  <TableCell>-</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell className="text-right">
                    {data.keyInfoDetails.reduce((sum, k) => sum + k.totalCalls, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    {data.keyInfoDetails.reduce((sum, k) => sum + k.connectedCalls, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {data.keyInfoDetails.reduce((sum, k) => sum + k.noAnswerCalls, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="default">
                      {((data.overview.connectedCalls / data.overview.totalCalls) * 100).toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-blue-600">
                    {data.keyInfoDetails.reduce((sum, k) => sum + k.successCalls, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline">
                      {((data.overview.successCalls / data.overview.totalCalls) * 100).toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">-</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 图表区域 */}
      <Card>
        <CardHeader>
          <CardTitle>类型分布</CardTitle>
          <CardDescription>各类型呼叫量、接通量、成功量对比</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="总呼叫量" fill="#94a3b8" />
              <Bar dataKey="接通量" fill="#22c55e" />
              <Bar dataKey="成功量" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
