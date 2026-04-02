'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RefreshCw, Search, Users2, Target, DollarSign } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

type Resp = {
  code: number
  message: string
  data?: {
    list: Record<string, unknown>[]
    total: number
    page: number
    pageSize: number
  }
}

type TeamTarget = {
  teamKey: string
  teamName: string
  month: string // YYYY-MM
  targetCalls: number
  targetConnected: number
  targetSuccess: number
  revenuePerSuccess: number
}

// 新增团队数据类型
type NewTeam = {
  teamName: string
  teamKey?: string
}

type ProjectRevenue = {
  cityKey: string
  cityName: string
  projectName?: string
  teamKey: string
  teamName: string
  month: string
  revenuePerSuccess: number
}

export default function TeamsPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    keyword: '',
  })

  // 团队目标与收益相关状态
  const [activeTab, setActiveTab] = useState('teams')
  const [teamTargets, setTeamTargets] = useState<TeamTarget[]>([])
  const [projectRevenues, setProjectRevenues] = useState<ProjectRevenue[]>([])
  const [cities, setCities] = useState<string[]>([])
  const [newCityName, setNewCityName] = useState('')
  const [editingCityIndex, setEditingCityIndex] = useState<number | null>(null)
  const [editingCityName, setEditingCityName] = useState('')
  const [teams, setTeams] = useState<string[]>([]) // 从团队目标数据动态加载
  const [currentMonth, setCurrentMonth] = useState('2026-04')
  const [targetLoading, setTargetLoading] = useState(false)
  const [revenueLoading, setRevenueLoading] = useState(false)
  
  // 编辑对话框状态
  const [editingTarget, setEditingTarget] = useState<TeamTarget | null>(null)
  const [editingRevenue, setEditingRevenue] = useState<ProjectRevenue | null>(null)
  const [showTargetDialog, setShowTargetDialog] = useState(false)
  const [showRevenueDialog, setShowRevenueDialog] = useState(false)
  const [showNewTeamDialog, setShowNewTeamDialog] = useState(false)
  const [newTeam, setNewTeam] = useState<NewTeam>({ teamName: '' })
  const [creatingTeam, setCreatingTeam] = useState(false)

  // 在客户端组件挂载后设置当前月份，避免服务端渲染时访问 Date
  useEffect(() => {
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    setCurrentMonth(month)
  }, [])

  // 从团队目标数据中提取团队列表
  useEffect(() => {
    if (teamTargets.length > 0) {
      const uniqueTeams = Array.from(new Set(teamTargets.map(t => t.teamName)))
      setTeams(uniqueTeams)
    }
  }, [teamTargets])

  const fetchData = async (forcePage?: number) => {
    setLoading(true)
    setError('')
    try {
      const currentPage = forcePage ?? page
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(pageSize),
      })
      if (filters.keyword.trim()) params.set('keyword', filters.keyword.trim())
      const res = await fetch(`/api/local/teams?${params.toString()}`)
      const json: Resp = await res.json()
      if (!res.ok || json.code !== 200 || !json.data) throw new Error(json.message || '加载失败')
      setRows(json.data.list || [])
      setTotal(json.data.total || 0)
      setPage(currentPage)
    } catch (e) {
      setRows([])
      setTotal(0)
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  // 加载团队目标数据
  const loadTeamTargets = async () => {
    setTargetLoading(true)
    try {
      const params = new URLSearchParams({
        month: currentMonth,
      })
      const res = await fetch(`/api/team-targets?${params.toString()}`)
      const json = await res.json()
      if (json.code === 0) {
        setTeamTargets(json.data || [])
      }
    } catch (e) {
      console.error('加载团队目标失败:', e)
    } finally {
      setTargetLoading(false)
    }
  }

  // 加载项目收益配置数据
  const loadProjectRevenues = async () => {
    setRevenueLoading(true)
    try {
      const params = new URLSearchParams({
        month: currentMonth,
      })
      const res = await fetch(`/api/project-revenues?${params.toString()}`)
      const json = await res.json()
      if (json.code === 0) {
        setProjectRevenues(json.data || [])
      }
    } catch (e) {
      console.error('加载项目收益配置失败:', e)
    } finally {
      setRevenueLoading(false)
    }
  }

  // 保存团队目标
  const saveTeamTarget = async (target: TeamTarget) => {
    try {
      const res = await fetch('/api/team-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(target),
      })
      const json = await res.json()
      if (json.code === 0) {
        loadTeamTargets()
        setShowTargetDialog(false)
        setEditingTarget(null)
      }
    } catch (e) {
      console.error('保存团队目标失败:', e)
    }
  }

  // 创建新团队
  const createNewTeam = async () => {
    if (!newTeam.teamName.trim()) {
      return
    }
    
    setCreatingTeam(true)
    try {
      // 生成团队键（拼音或简写）
      const teamKey = newTeam.teamName.trim()
      
      const res = await fetch('/api/local/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName: newTeam.teamName.trim(),
          teamKey: teamKey,
        }),
      })
      
      const json = await res.json()
      if (json.code === 0) {
        // 创建成功后，自动打开该团队的目标编辑对话框
        const newTarget: TeamTarget = {
          teamKey: teamKey,
          teamName: newTeam.teamName.trim(),
          month: currentMonth,
          targetCalls: 0,
          targetConnected: 0,
          targetSuccess: 0,
          revenuePerSuccess: 0,
        }
        setEditingTarget(newTarget)
        setShowNewTeamDialog(false)
        setShowTargetDialog(true)
        setNewTeam({ teamName: '' })
      }
    } catch (e) {
      console.error('创建团队失败:', e)
    } finally {
      setCreatingTeam(false)
    }
  }

  // 添加新城市
  const addNewCity = () => {
    if (!newCityName.trim()) {
      return
    }
    
    const cityName = newCityName.trim()
    if (cities.includes(cityName)) {
      alert('该城市已存在')
      return
    }
    
    setCities([...cities, cityName])
    setNewCityName('')
  }

  // 开始编辑城市
  const startEditCity = (index: number, cityName: string) => {
    setEditingCityIndex(index)
    setEditingCityName(cityName)
  }

  // 保存城市编辑
  const saveEditCity = (index: number) => {
    if (!editingCityName.trim()) {
      return
    }
    
    const newName = editingCityName.trim()
    if (newName !== cities[index]) {
      // 检查是否与其他城市重复
      if (cities.includes(newName)) {
        alert('该城市名称已存在')
        return
      }
      
      // 更新城市列表
      const newCities = [...cities]
      newCities[index] = newName
      setCities(newCities)
      
      // 同时更新项目收益配置中的城市名称
      const updatedRevenues = projectRevenues.map(r => 
        r.cityName === cities[index] 
          ? { ...r, cityName: newName, cityKey: newName }
          : r
      )
      setProjectRevenues(updatedRevenues)
    }
    
    setEditingCityIndex(null)
    setEditingCityName('')
  }

  // 取消编辑城市
  const cancelEditCity = () => {
    setEditingCityIndex(null)
    setEditingCityName('')
  }

  // 删除城市
  const deleteCity = (index: number, cityName: string) => {
    if (confirm(`确定要删除城市 "${cityName}" 吗？删除后该城市的所有收益配置也将被删除。`)) {
      const newCities = cities.filter((_, i) => i !== index)
      setCities(newCities)
      
      // 同时删除项目收益配置中该城市的相关数据
      const updatedRevenues = projectRevenues.filter(r => r.cityName !== cityName)
      setProjectRevenues(updatedRevenues)
    }
  }

  // 保存项目收益配置
  const saveProjectRevenue = async (revenue: ProjectRevenue) => {
    console.log('准备保存项目收益配置:', revenue)
    try {
      const res = await fetch('/api/project-revenues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(revenue),
      })
      
      console.log('API 响应状态:', res.status)
      const json = await res.json()
      console.log('API 响应数据:', json)
      
      if (json.code === 0) {
        console.log('保存成功，刷新列表')
        loadProjectRevenues()
        setShowRevenueDialog(false)
        setEditingRevenue(null)
      } else {
        console.error('保存失败:', json.message)
        alert('保存失败：' + json.message)
      }
    } catch (e) {
      console.error('保存项目收益配置失败:', e)
      alert('保存出错：' + (e instanceof Error ? e.message : String(e)))
    }
  }

  // 获取指定地市和团队的收益值
  const getRevenueValue = (cityName: string, teamName: string) => {
    const revenue = projectRevenues.find(
      r => (r.cityName === cityName || r.projectName === cityName) && 
           r.teamName === teamName && 
           r.month === currentMonth
    )
    console.log('[getRevenueValue] 查找:', { cityName, teamName, currentMonth }, '结果:', revenue)
    return revenue ? revenue.revenuePerSuccess : null
  }

  // 打开编辑对话框
  const openRevenueEdit = (cityName: string, teamName: string) => {
    const existing = projectRevenues.find(
      r => (r.cityName === cityName || r.projectName === cityName) && 
           r.teamName === teamName && 
           r.month === currentMonth
    )
    console.log('[openRevenueEdit] 查找:', { cityName, teamName, currentMonth }, '结果:', existing)
    if (existing) {
      setEditingRevenue(existing)
    } else {
      // 使用城市名和团队名作为键
      setEditingRevenue({
        cityKey: cityName,  // 使用城市名作为 cityKey
        cityName,
        teamKey: teamName,  // 使用团队名作为 teamKey
        teamName,
        month: currentMonth,
        revenuePerSuccess: 0
      })
    }
    setShowRevenueDialog(true)
  }

  useEffect(() => {
    fetchData()
    
    // 每 5 分钟自动同步数据
    const interval = setInterval(() => {
      fetchData(page)
    }, 5 * 60 * 1000)
    
    // 清理定时器
    return () => clearInterval(interval)
  }, [pageSize, page])

  useEffect(() => {
    if (activeTab === 'targets') {
      loadTeamTargets()
    }
  }, [activeTab, currentMonth])

  useEffect(() => {
    if (activeTab === 'revenue') {
      loadProjectRevenues()
    }
  }, [activeTab, currentMonth])

  // 当切换到项目收益配置标签时，如果团队列表为空，先加载团队目标数据
  useEffect(() => {
    if (activeTab === 'revenue' && teams.length === 0) {
      loadTeamTargets()
    }
  }, [activeTab, teams.length])

  const cols = useMemo(
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Users2 className="h-8 w-8" />
          外呼团队管理
        </h1>
        <p className="text-gray-500 mt-1">团队配置、目标管理与收益计算</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="teams">团队列表</TabsTrigger>
          <TabsTrigger value="targets">团队月度目标</TabsTrigger>
          <TabsTrigger value="revenue">项目收益配置</TabsTrigger>
        </TabsList>

        {/* 团队列表 */}
        <TabsContent value="teams" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>查询条件</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="text-sm font-medium mb-2 block">团队名称/关键字</label>
                <Input
                  value={filters.keyword}
                  onChange={(e) => setFilters((p) => ({ ...p, keyword: e.target.value }))}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={() => fetchData(1)}>
                  <Search className="h-4 w-4 mr-2" />
                  查询
                </Button>
                <Button variant="outline" onClick={() => fetchData(page)}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  刷新
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>团队列表</CardTitle>
              <CardDescription>{loading ? '加载中...' : `共 ${total} 条`}</CardDescription>
            </CardHeader>
            <CardContent>
              {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {cols.map((c) => (
                        <TableHead key={c}>{c}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={Math.max(cols.length, 1)} className="text-center py-10 text-gray-500">
                          暂无数据
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((row, idx) => (
                        <TableRow key={String(row.teamKey || idx)}>
                          {cols.map((c) => (
                            <TableCell key={`${String(row.teamKey || idx)}-${c}`}>
                              {row[c] === null || row[c] === undefined || row[c] === ''
                                ? '-'
                                : String(row[c])}
                            </TableCell>
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
                  <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => fetchData(page + 1)}>
                    下一页
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 团队月度目标 */}
        <TabsContent value="targets" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    团队月度目标管理
                  </CardTitle>
                  <CardDescription>配置每个团队当月的目标量</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="default"
                    onClick={() => {
                      setNewTeam({ teamName: '' })
                      setShowNewTeamDialog(true)
                    }}
                  >
                    <span className="text-lg mr-1">+</span>
                    新建团队
                  </Button>
                  <Label>月份：</Label>
                  <Input
                    type="month"
                    value={currentMonth}
                    onChange={(e) => setCurrentMonth(e.target.value)}
                    className="w-40"
                  />
                  <Button onClick={loadTeamTargets} size="sm" variant="outline">
                    <RefreshCw className={`h-4 w-4 mr-2 ${targetLoading ? 'animate-spin' : ''}`} />
                    刷新
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {targetLoading ? (
                <div className="flex items-center justify-center py-10">
                  <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              ) : (
                <>
                  <div className="rounded-md border overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>团队名称</TableHead>
                          <TableHead>目标外呼量</TableHead>
                          <TableHead>目标接通量</TableHead>
                          <TableHead>目标成功量</TableHead>
                          <TableHead>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamTargets.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-10 text-gray-500">
                              暂无配置数据
                            </TableCell>
                          </TableRow>
                        ) : (
                          <>
                            {teamTargets.map((target, idx) => (
                              <TableRow key={`${target.teamKey}-${target.month}`}>
                                <TableCell className="font-medium">{target.teamName}</TableCell>
                                <TableCell>{target.targetCalls.toLocaleString()}</TableCell>
                                <TableCell>{target.targetConnected.toLocaleString()}</TableCell>
                                <TableCell>{target.targetSuccess.toLocaleString()}</TableCell>
                                <TableCell>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingTarget(target)
                                      setShowTargetDialog(true)
                                    }}
                                  >
                                    编辑
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                            {/* 合计行 */}
                            <TableRow className="bg-gray-50 font-semibold">
                              <TableCell>合计</TableCell>
                              <TableCell>
                                {teamTargets.reduce((sum, t) => sum + t.targetCalls, 0).toLocaleString()}
                              </TableCell>
                              <TableCell>
                                {teamTargets.reduce((sum, t) => sum + t.targetConnected, 0).toLocaleString()}
                              </TableCell>
                              <TableCell>
                                {teamTargets.reduce((sum, t) => sum + t.targetSuccess, 0).toLocaleString()}
                              </TableCell>
                              <TableCell>-</TableCell>
                            </TableRow>
                          </>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-4 p-4 bg-blue-50 rounded-md">
                    <p className="text-sm text-blue-700">
                      💡 提示：点击"编辑"按钮可以配置每个团队的目标量。
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 项目收益配置 */}
        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    项目收益配置表
                  </CardTitle>
                  <CardDescription>按地市和团队配置日报毛利单价</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label>月份：</Label>
                  <Input
                    type="month"
                    value={currentMonth}
                    onChange={(e) => setCurrentMonth(e.target.value)}
                    className="w-40"
                  />
                  <Button onClick={loadProjectRevenues} size="sm" variant="outline">
                    <RefreshCw className={`h-4 w-4 mr-2 ${revenueLoading ? 'animate-spin' : ''}`} />
                    刷新
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {revenueLoading ? (
                <div className="flex items-center justify-center py-10">
                  <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              ) : teams.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Target className="h-16 w-16 text-gray-300 mb-4" />
                  <p className="text-gray-500 text-lg font-medium mb-2">暂无团队数据</p>
                  <p className="text-gray-400 text-sm mb-4">请先在"团队月度目标"标签中创建团队并配置目标</p>
                  <Button onClick={() => setActiveTab('targets')}>
                    前往创建团队
                  </Button>
                </div>
              ) : (
                <>
                  <div className="rounded-md border overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-32 sticky left-0 bg-orange-50 font-semibold">毛利单价</TableHead>
                          {teams.map(team => (
                            <TableHead key={team} className="text-center min-w-24 bg-orange-50 font-semibold">
                              {team}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cities.map((city, index) => (
                          <TableRow key={city}>
                            <TableCell className="font-medium sticky left-0 bg-orange-50">
                              {editingCityIndex === index ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={editingCityName}
                                    onChange={(e) => setEditingCityName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        saveEditCity(index)
                                      } else if (e.key === 'Escape') {
                                        cancelEditCity()
                                      }
                                    }}
                                    className="h-8 text-sm"
                                    autoFocus
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => saveEditCity(index)}
                                    className="h-8 px-2"
                                  >
                                    ✓
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={cancelEditCity}
                                    className="h-8 px-2"
                                  >
                                    ✕
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span>{city}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => startEditCity(index, city)}
                                    className="h-6 w-6 p-0 ml-auto"
                                  >
                                    ✎
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteCity(index, city)}
                                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                  >
                                    ✕
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                            {teams.map(team => {
                              const value = getRevenueValue(city, team)
                              return (
                                <TableCell key={`${city}-${team}`} className="text-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`w-full ${value !== null ? 'font-semibold text-green-600' : 'text-gray-400'}`}
                                    onClick={() => openRevenueEdit(city, team)}
                                  >
                                    {value !== null ? `¥${value.toFixed(1)}` : '-'}
                                  </Button>
                                </TableCell>
                              )
                            })}
                          </TableRow>
                        ))}
                        {/* 添加城市行 */}
                        <TableRow>
                          <TableCell className="font-medium sticky left-0 bg-orange-50">
                            <Input
                              value={newCityName}
                              onChange={(e) => setNewCityName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  addNewCity()
                                }
                              }}
                              placeholder="输入城市名称后按回车添加"
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          {teams.map(team => (
                            <TableCell key={`new-${team}`} className="text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full text-gray-300 cursor-not-allowed"
                                disabled
                              >
                                -
                              </Button>
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-4 p-4 bg-blue-50 rounded-md">
                    <p className="text-sm text-blue-700">
                      💡 提示：点击单元格可以配置或修改对应地市和团队的毛利单价。空白表示尚未配置。点击城市名称旁的 ✎ 按钮可以编辑城市名称，点击 ✕ 按钮可以删除城市。在表格底部输入城市名称后按回车可添加新城市。
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 新建团队对话框 */}
      <Dialog open={showNewTeamDialog} onOpenChange={setShowNewTeamDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建团队</DialogTitle>
            <DialogDescription>
              创建新的外呼团队，并配置其月度目标
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="teamName">团队名称</Label>
              <Input
                id="teamName"
                value={newTeam.teamName}
                onChange={(e) => setNewTeam({ ...newTeam, teamName: e.target.value })}
                className="col-span-3"
                placeholder="请输入团队名称，如：诚聚"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    createNewTeam()
                  }
                }}
              />
            </div>
            <div className="p-3 bg-blue-50 rounded-md">
              <p className="text-sm text-blue-700">
                💡 提示：创建团队后，将自动打开该团队的月度目标配置对话框。
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTeamDialog(false)} disabled={creatingTeam}>
              取消
            </Button>
            <Button onClick={createNewTeam} disabled={creatingTeam || !newTeam.teamName.trim()}>
              {creatingTeam ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  创建中...
                </>
              ) : (
                '创建'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 团队目标编辑对话框 */}
      <Dialog open={showTargetDialog} onOpenChange={setShowTargetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑团队月度目标</DialogTitle>
            <DialogDescription>
              配置 {editingTarget?.teamName} 在 {currentMonth} 的目标量
            </DialogDescription>
          </DialogHeader>
          {editingTarget && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="targetCalls">目标外呼量</Label>
                <Input
                  id="targetCalls"
                  type="number"
                  value={editingTarget.targetCalls}
                  onChange={(e) => setEditingTarget({ ...editingTarget, targetCalls: Number(e.target.value) })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="targetConnected">目标接通量</Label>
                <Input
                  id="targetConnected"
                  type="number"
                  value={editingTarget.targetConnected}
                  onChange={(e) => setEditingTarget({ ...editingTarget, targetConnected: Number(e.target.value) })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="targetSuccess">目标成功量</Label>
                <Input
                  id="targetSuccess"
                  type="number"
                  value={editingTarget.targetSuccess}
                  onChange={(e) => setEditingTarget({ ...editingTarget, targetSuccess: Number(e.target.value) })}
                  className="col-span-3"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTargetDialog(false)}>
              取消
            </Button>
            <Button onClick={() => editingTarget && saveTeamTarget(editingTarget)}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 项目收益配置编辑对话框 */}
      <Dialog open={showRevenueDialog} onOpenChange={setShowRevenueDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>配置毛利单价</DialogTitle>
            <DialogDescription>
              {editingRevenue?.cityName} - {editingRevenue?.teamName}
            </DialogDescription>
          </DialogHeader>
          {editingRevenue && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="revPerSuccess">毛利单价 (元)</Label>
                <Input
                  id="revPerSuccess"
                  type="number"
                  step="0.1"
                  value={editingRevenue.revenuePerSuccess}
                  onChange={(e) => setEditingRevenue({ ...editingRevenue, revenuePerSuccess: Number(e.target.value) })}
                  className="col-span-3"
                  placeholder="请输入单价"
                />
              </div>
              <div className="p-3 bg-blue-50 rounded-md">
                <p className="text-sm text-blue-700">
                  💡 提示：设置该地市和团队对应的毛利单价
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevenueDialog(false)}>
              取消
            </Button>
            <Button onClick={() => editingRevenue && saveProjectRevenue(editingRevenue)}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
