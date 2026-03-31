'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogClose } from '@/components/ui/dialog'
import { Search, RefreshCw, Plus, Download, Upload, X, Clock } from 'lucide-react'
import { getProjectIdNameMap } from '@/lib/project-id-name-map'
import { useAutoRefresh } from '@/hooks/use-auto-refresh'

/**
 * 业务订单页面组件
 * 功能：展示外呼订单明细，支持筛选、搜索、分页、添加、编辑、删除、导入导出等操作
 * 性能优化：使用useMemo和useCallback缓存计算结果和函数，减少不必要的渲染
 */
export default function OrdersPage() {
  // 筛选条件状态
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    phone: '',
    businessType: '',
    city: 'all',
    team: 'all'
  })
  
  // 在useEffect中设置默认日期为当天，避免在服务器端渲染时访问当前时间
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    setFilters(prev => ({
      ...prev,
      startDate: today,
      endDate: today,
      team: 'all'
    }))
  }, [])

  // 订单数据状态
  const [orders, setOrders] = useState([])
  // 搜索功能
  const [filteredOrders, setFilteredOrders] = useState([])
  // 新增订单的状态
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState(null)
  const [newOrder, setNewOrder] = useState({
    phone: '',
    city: '',
    businessType: '',
    plan: '',
    presetAmount: '',
    actualAmount: '',
    discountAmount: '0', // 优惠金额
    name: '', // 坐席名称
    agentId: '', // 坐席工号
    team: '' // 外呼团队
  })

  // 外呼团队选项
  const [teamOptions, setTeamOptions] = useState([])
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  // 加载状态
  const [loading, setLoading] = useState(false)
  // 加载更多状态
  const [loadingMore, setLoadingMore] = useState(false)
  // 总记录数
  const [totalCount, setTotalCount] = useState(0)
  
  // 一键修改功能状态
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false)
  const [bulkEditConfig, setBulkEditConfig] = useState({
    field: 'presetAmount', // 要修改的字段：presetAmount或actualAmount
    value: '', // 新值
    scope: 'all' // 修改范围：all或specific
  })
  
  // 团队数据缓存
  const teamCache = useMemo(() => new Map(), [])
  
  // 项目名称映射缓存
  const projectIdNameMap = useMemo(() => getProjectIdNameMap(), [])
  
  // 自动刷新配置
  const { autoRefreshEnabled, toggleAutoRefresh, lastRefreshTime, refreshCount } = useAutoRefresh({
    enabled: true,
    refreshInterval: 30000, // 30秒刷新一次
    fetchData: async (_, isAutoRefresh) => {
      // 静默刷新，不显示加载状态
      if (isAutoRefresh) {
        try {
          // 同步成功客户数据
          await fetchSuccessCustomers()
          // 刷新订单数据
          await fetchOrdersFromAPI()
        } catch (error) {
          console.error('自动刷新失败:', error)
        }
      }
    }
  })
  
  // 根据坐席工号和名称查询所属的外呼团队
  const getAgentTeam = useCallback(async (agentId, agentName) => {
    // 生成缓存键
    const cacheKey = `${agentId}-${agentName}`
    
    // 检查缓存中是否已有数据
    if (teamCache.has(cacheKey)) {
      return teamCache.get(cacheKey)
    }
    
    try {
      const response = await fetch(`/api/agents/team?agentId=${agentId}&agentName=${agentName}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      const teamName = data.code === 0 && data.data ? data.data.teamName : '诚服'
      
      // 缓存结果
      teamCache.set(cacheKey, teamName)
      
      return teamName
    } catch (error) {
      console.error('获取坐席团队失败:', error)
      // 缓存默认值
      teamCache.set(cacheKey, '诚服')
      return '诚服' // 默认团队
    }
  }, [teamCache])
  
  const handleSearch = async () => {
    // 实现根据筛选条件查询的逻辑
    console.log('搜索条件:', filters)
    
    // 调用新的fetchOrdersFromAPI函数，它会自动处理筛选和分页
    await fetchOrdersFromAPI(1, pageSize)
  }
  
  // 初始化时，将filteredOrders设置为所有订单
  useEffect(() => {
    setFilteredOrders(orders)
  }, [orders])
  
  // 计算当前页显示的数据
  const getCurrentPageData = () => {
    // 由于已经在服务器端进行了分页，直接返回所有数据
    return filteredOrders
  }
  
  // 计算总页数
  const getTotalPages = () => {
    // 使用从API返回的总记录数计算总页数
    return Math.ceil(totalCount / pageSize)
  }
  
  // 自动同步录音清单中客户状态为"成功客户"的数据
  const fetchSuccessCustomers = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const response = await fetch(`/api/recordings/success-customers?startDate=${today}&endDate=${today}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.code === 0) {
        // 先处理所有数据转换（不含团队查询）
        const recordingsWithBasicData = data.data.map((recording: any) => {
          // 处理日期时间格式，确保保留完整时间（将UTC时间转换为本地时间）
          let dateTime = recording.start_time
          // 解析UTC时间字符串并转换为本地时间
          const utcDate = new Date(dateTime)
          const year = utcDate.getFullYear()
          const month = String(utcDate.getMonth() + 1).padStart(2, '0')
          const day = String(utcDate.getDate()).padStart(2, '0')
          const hours = String(utcDate.getHours()).padStart(2, '0')
          const minutes = String(utcDate.getMinutes()).padStart(2, '0')
          const seconds = String(utcDate.getSeconds()).padStart(2, '0')
          dateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
          
          return {
            date: dateTime,
            phone: recording.called_phone,
            city: projectIdNameMap[recording.project_id] || recording.project_id, // 映射项目ID到项目名称
            businessType: '套餐升档', // 这里需要根据实际情况设置业务类型
            plan: '裸升', // 这里需要根据实际情况设置方案
            presetAmount: 59, // 这里需要根据实际情况设置原套餐金额
            actualAmount: 89, // 这里需要根据实际情况设置现套餐金额
            discountAmount: 30, // 这里需要根据实际情况计算优惠金额
            difference: 30, // 这里需要根据实际情况计算差额
            name: recording.agent_name,
            agentId: recording.agent,
            agentIdStr: String(recording.agent),
            agentName: recording.agent_name
          }
        })
        
        // 并行查询所有坐席的团队信息
        const teamPromises = recordingsWithBasicData.map(recording => 
          getAgentTeam(recording.agentIdStr, recording.agentName)
        )
        const teams = await Promise.all(teamPromises)
        
        // 合并团队信息到订单数据
        const ordersFromRecordings = recordingsWithBasicData.map((recording, index) => ({
          ...recording,
          team: teams[index], // 使用并行查询的团队结果
          agentId: recording.agentId, // 恢复原始agentId类型
          dataSource: '系统生成'
        }))
        
        // 移除临时字段
        const finalOrders = ordersFromRecordings.map(({ agentIdStr, agentName, ...order }) => order)
        
        // 批量保存到API
        const success = await saveOrdersToAPI(finalOrders, 'POST')
        const successCount = success ? finalOrders.length : 0
        
        // 重新加载订单数据
        await fetchOrdersFromAPI()
        
        console.log(`成功同步 ${successCount} 条订单数据`)
      }
    } catch (error) {
      console.error('同步成功客户数据失败:', error)
    }
  }, [getAgentTeam, projectIdNameMap, fetchOrdersFromAPI])
  
  // 从项目ID名称映射中获取项目名称选项
  const projectOptions = useMemo(() => {
    return Object.entries(projectIdNameMap).map(([code, name]) => ({
      value: name,
      label: name
    }))
  }, [projectIdNameMap])
  
  // 从API获取外呼团队数据
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const response = await fetch('/api/teams', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        
        if (data.code === 0 && data.data) {
          const options = data.data.map((team: any) => ({
            value: team.teamName || team.name,
            label: team.teamName || team.name
          }))
          setTeamOptions(options)
        }
      } catch (error) {
        console.error('加载外呼团队数据失败:', error)
      }
    }
    
    fetchTeams()
  }, [])
  
/**
 * 从API加载订单数据
 * @param page 页码，默认为1
 * @param pageSizeVal 每页大小，默认为当前pageSize状态值
 * @returns Promise<void>
 * 性能优化：使用useCallback缓存函数，避免因依赖变化重复创建
 */
  const fetchOrdersFromAPI = useCallback(async (page = 1, pageSizeVal = pageSize) => {
    const startTime = performance.now()
    try {
      setLoading(true)
      
      // 构建查询参数
      const params = new URLSearchParams()
      params.append('startDate', filters.startDate)
      params.append('endDate', filters.endDate)
      params.append('phone', filters.phone)
      params.append('businessType', filters.businessType)
      params.append('city', filters.city)
      params.append('team', filters.team)
      params.append('page', page.toString())
      params.append('pageSize', pageSizeVal.toString())
      
      const response = await fetch(`/api/orders?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.code === 0) {
        setOrders(data.data)
        setFilteredOrders(data.data)
        setCurrentPage(page)
        setPageSize(data.pageSize)
        setTotalCount(data.total)
      }
    } catch (error) {
      console.error('从API加载订单数据失败:', error)
    } finally {
      setLoading(false)
      const endTime = performance.now()
      console.log(`订单数据加载时间: ${(endTime - startTime).toFixed(2)}ms`)
    }
  }, [filters, pageSize])
  
  // 初始加载时从API获取订单数据并自动同步成功客户数据
  useEffect(() => {
    const initializeData = async () => {
      // 首先加载订单数据，让用户能快速看到页面
      await fetchOrdersFromAPI()
      
      // 然后在后台同步成功客户数据
      const syncData = async () => {
        try {
          await fetchSuccessCustomers()
          // 同步完成后刷新订单数据
          await fetchOrdersFromAPI()
        } catch (error) {
          console.error('后台同步失败:', error)
        }
      }
      
      // 启动后台同步
      syncData()
    }
    
    initializeData()
  }, [])
  
  // 保存数据到API
  const saveOrdersToAPI = async (orderData, method = 'POST') => {
    try {
      // 检查是否是批量请求
      if (Array.isArray(orderData)) {
        // 批量保存或更新
        const response = await fetch('/api/orders', {
          method: method,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(orderData)
        })
        const data = await response.json()
        return data.code === 0
      } else {
        // 单个订单处理
        // 检查是否是新增订单，如果是，先检查是否存在重复数据
        if (method === 'POST') {
          const existingOrders = await readOrdersFromAPI()
          // 根据手机号判断是否存在重复订单
          const isDuplicate = existingOrders.some(order => 
            order.phone === orderData.phone
          )
          if (isDuplicate) {
            console.log('订单已存在，跳过保存:', orderData.phone)
            return true // 跳过重复订单，返回成功
          }
        }
        
        const response = await fetch('/api/orders', {
          method: method,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(orderData)
        })
        const data = await response.json()
        return data.code === 0
      }
    } catch (error) {
      console.error('保存订单数据到API失败:', error)
      return false
    }
  }
  
  // 从API读取订单数据（用于重复检查）
  const readOrdersFromAPI = async () => {
    try {
      const response = await fetch('/api/orders', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      if (data.code === 0) {
        return data.data
      }
      return []
    } catch (error) {
      console.error('从API读取订单数据失败:', error)
      return []
    }
  }
  
  // 删除订单API
  const deleteOrderFromAPI = async (id) => {
    try {
      const response = await fetch(`/api/orders?id=${id}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      return data.code === 0
    } catch (error) {
      console.error('从API删除订单失败:', error)
      return false
    }
  }
  
  // 添加订单
  const handleAddOrder = async () => {
    const discountAmount = Number(newOrder.discountAmount) || 0
    const difference = Number(newOrder.actualAmount) - Number(newOrder.presetAmount) - discountAmount
    
    // 生成完整的日期时间格式 YYYY-MM-DD HH:MM:SS
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')
    const dateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    
    const newOrderData = {
      date: dateTime,
      phone: newOrder.phone,
      city: newOrder.city,
      businessType: newOrder.businessType,
      plan: newOrder.plan,
      presetAmount: Number(newOrder.presetAmount),
      actualAmount: Number(newOrder.actualAmount),
      discountAmount: discountAmount,
      difference: difference,
      name: newOrder.name,
      agentId: newOrder.agentId,
      team: newOrder.team,
      dataSource: '手动录入'
    }
    
    // 保存到API
    const success = await saveOrdersToAPI(newOrderData, 'POST')
    if (success) {
      // 重新加载订单数据
      await fetchOrdersFromAPI()
      setIsAddModalOpen(false)
      
      // 重置表单
      setNewOrder({
        phone: '',
        city: '',
        businessType: '',
        plan: '',
        presetAmount: '',
        actualAmount: '',
        name: '',
        agentId: '',
        team: ''
      })
    } else {
      alert('添加订单失败')
    }
  }
  
  // 删除订单
  const handleDeleteOrder = async (id) => {
    const success = await deleteOrderFromAPI(id)
    if (success) {
      // 重新加载订单数据
      await fetchOrdersFromAPI()
    } else {
      alert('删除订单失败')
    }
  }
  
  // 编辑订单
  const handleEditOrder = (id) => {
    const order = orders.find(order => order.id === id)
    if (order) {
      setEditingOrder(order)
      setIsEditModalOpen(true)
    }
  }
  
  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingOrder) return
    
    const discountAmount = Number(editingOrder.discountAmount) || 0
    const difference = Number(editingOrder.actualAmount) - Number(editingOrder.presetAmount) - discountAmount
    const updatedOrder = {
      ...editingOrder,
      discountAmount: discountAmount,
      difference: difference
    }
    
    // 保存到API
    const success = await saveOrdersToAPI(updatedOrder, 'PUT')
    if (success) {
      // 重新加载订单数据
      await fetchOrdersFromAPI()
      setIsEditModalOpen(false)
      setEditingOrder(null)
    } else {
      alert('更新订单失败')
    }
  }
  
  // 导入功能
  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    // 检查文件类型
    if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
      // 处理CSV文件
      const reader = new FileReader()
      reader.onload = (event) => {
        const csvData = event.target.result
        parseCSV(csvData)
      }
      reader.readAsText(file)
    } else if (file.type.includes('excel') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      // 提示用户将Excel文件保存为CSV格式
      alert('请将Excel文件保存为CSV格式后再导入')
    } else {
      alert('不支持的文件格式，请使用CSV或Excel文件')
    }
  }
  
  // 解析CSV文件
  const parseCSV = async (csvData) => {
    try {
      const lines = csvData.split('\n')
      const headers = lines[0].split(',').map(header => header.trim())
      
      // 检查CSV文件是否包含必要的列
      const requiredColumns = ['手机号', '项目名称', '业务类型', '方案', '原套餐金额', '现套餐金额', '坐席名称', '坐席工号', '外呼团队']
      const hasRequiredColumns = requiredColumns.every(column => headers.includes(column))
      
      if (!hasRequiredColumns) {
        alert('CSV文件格式不正确，缺少必要的列')
        return
      }
      
      // 解析数据行
      const importedOrders = []
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        
        const values = line.split(',').map(value => value.trim())
        const orderData = {}
        
        headers.forEach((header, index) => {
          orderData[header] = values[index]
        })
        
        // 计算优惠金额和差额
        const presetAmount = Number(orderData['原套餐金额'])
        const actualAmount = Number(orderData['现套餐金额'])
        const discountAmount = orderData['优惠金额'] ? Number(orderData['优惠金额']) : (actualAmount - presetAmount)
        const difference = actualAmount - presetAmount - discountAmount
        
        // 生成完整的日期时间格式 YYYY-MM-DD HH:MM:SS
        const now = new Date()
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const day = String(now.getDate()).padStart(2, '0')
        const hours = String(now.getHours()).padStart(2, '0')
        const minutes = String(now.getMinutes()).padStart(2, '0')
        const seconds = String(now.getSeconds()).padStart(2, '0')
        const dateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
        
        // 创建新订单
        const newOrderData = {
          date: dateTime,
          phone: orderData['手机号'],
          city: orderData['项目名称'],
          businessType: orderData['业务类型'],
          plan: orderData['方案'],
          presetAmount: presetAmount,
          actualAmount: actualAmount,
          discountAmount: discountAmount,
          difference: difference,
          name: orderData['坐席名称'],
          agentId: orderData['坐席工号'],
          team: orderData['外呼团队'],
          dataSource: '手动录入'
        }
        
        importedOrders.push(newOrderData)
      }
      
      // 批量保存到API
      const success = await saveOrdersToAPI(importedOrders, 'POST')
      const successCount = success ? importedOrders.length : 0
      
      // 重新加载订单数据
      await fetchOrdersFromAPI()
      
      alert(`成功导入 ${successCount} 条订单数据`)
    } catch (error) {
      console.error('导入失败:', error)
      alert('导入失败，请检查文件格式')
    }
  }
  
  // 下载模板
  const handleDownloadTemplate = () => {
    // 定义CSV列头
    const headers = ['手机号', '项目名称', '业务类型', '方案', '原套餐金额', '现套餐金额', '优惠金额', '坐席名称', '坐席工号', '外呼团队']
    
    // 定义示例数据
    const sampleData = [
      ['13800138000', '茂名', '套餐升档', '裸升', '59', '89', '0', '张三', '1001', '诚服'],
      ['13900139000', '广州', '升档送机', '有差', '79', '129', '20', '李四', '1002', '其他']
    ]
    
    // 构建CSV内容，添加BOM以支持Excel UTF-8编码
    const csvContent = [
      '\ufeff' + headers.join(','),
      ...sampleData.map(row => row.join(','))
    ].join('\n')
    
    // 创建Blob对象
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    
    // 创建下载链接
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    // 设置下载属性
    link.setAttribute('href', url)
    link.setAttribute('download', '订单导入模板.csv')
    link.style.visibility = 'hidden'
    
    // 添加到DOM并触发下载
    document.body.appendChild(link)
    link.click()
    
    // 清理
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
  
  // 导出功能
  const handleExport = () => {
    if (filteredOrders.length === 0) {
      alert('没有数据可导出')
      return
    }
    
    // 定义CSV列头
    const headers = ['外呼日期', '手机号', '项目名称', '业务类型', '方案', '原套餐金额', '现套餐金额', '优惠金额', '差额', '坐席名称', '坐席工号', '外呼团队', '数据来源']
    
    // 构建数据行
    const dataRows = filteredOrders.map(order => [
      order.date,
      order.phone,
      order.city,
      order.businessType,
      order.plan,
      order.presetAmount,
      order.actualAmount,
      order.discountAmount,
      order.difference,
      order.name,
      order.agentId,
      order.team,
      order.dataSource || '手动录入'
    ])
    
    // 构建CSV内容，添加BOM以支持Excel UTF-8编码
    const csvContent = [
      '\ufeff' + headers.join(','),
      ...dataRows.map(row => row.join(','))
    ].join('\n')
    
    // 创建Blob对象
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    
    // 创建下载链接
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    // 设置下载属性
    const timestamp = new Date().toISOString().split('T')[0]
    link.setAttribute('href', url)
    link.setAttribute('download', `订单数据_${timestamp}.csv`)
    link.style.visibility = 'hidden'
    
    // 添加到DOM并触发下载
    document.body.appendChild(link)
    link.click()
    
    // 清理
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
  
  // 一键修改功能
  const handleBulkEdit = async () => {
    try {
      const { field, value, scope } = bulkEditConfig
      const newValue = Number(value)
      
      if (isNaN(newValue)) {
        alert('请输入有效的金额数值')
        return
      }
      
      // 确定要修改的订单范围
      let ordersToUpdate
      if (scope === 'all') {
        // 获取当前查询结果的全部订单数据（使用当前筛选条件）
        try {
          setLoading(true)
          // 构建查询参数，使用当前的筛选条件
          const params = new URLSearchParams()
          params.append('startDate', filters.startDate)
          params.append('endDate', filters.endDate)
          params.append('phone', filters.phone)
          params.append('businessType', filters.businessType)
          params.append('city', filters.city)
          params.append('team', filters.team)
          params.append('pageSize', '10000') // 获取所有数据
          
          const response = await fetch(`/api/orders?${params.toString()}`)
          const data = await response.json()
          if (data.code === 0) {
            ordersToUpdate = data.data
          } else {
            ordersToUpdate = []
          }
        } catch (error) {
          console.error('获取订单数据失败:', error)
          ordersToUpdate = []
        } finally {
          setLoading(false)
        }
      } else {
        // 使用当前筛选结果
        ordersToUpdate = filteredOrders
      }
      
      if (ordersToUpdate.length === 0) {
        alert('没有订单可以修改')
        return
      }
      
      // 准备更新数据
      const updatedOrders = ordersToUpdate.map(order => {
        const updatedOrder = { ...order }
        updatedOrder[field] = newValue
        
        // 重新计算优惠金额和差额
        const discountAmount = updatedOrder.plan === '裸升' ? 0 : (Number(updatedOrder.discountAmount) || 0)
        const difference = Number(updatedOrder.actualAmount) - Number(updatedOrder.presetAmount) - discountAmount
        updatedOrder.discountAmount = discountAmount
        updatedOrder.difference = difference
        
        return updatedOrder
      })
      
      // 批量更新到API
      const success = await saveOrdersToAPI(updatedOrders, 'PUT')
      
      if (success) {
        // 重新加载订单数据
        await fetchOrdersFromAPI()
        setIsBulkEditModalOpen(false)
        
        // 重置表单
        setBulkEditConfig({
          field: 'presetAmount',
          value: '',
          scope: 'all'
        })
        
        alert(`成功修改 ${updatedOrders.length} 条订单数据`)
      } else {
        alert('批量修改失败')
      }
    } catch (error) {
      console.error('批量修改失败:', error)
      alert('批量修改失败，请检查网络连接')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">业务订单</h1>
        <p className="text-gray-500">实时监控外呼订单数据统计</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>外呼订单明细</CardTitle>
        </CardHeader>
        <CardContent>
          {/* 搜索和筛选区域 */}
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">外呼日期：</span>
              <Input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} placeholder="开始日期" className="w-32" />
              <span className="text-sm">-</span>
              <Input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} placeholder="结束日期" className="w-32" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">外呼手机号：</span>
              <Input value={filters.phone} onChange={(e) => setFilters({ ...filters, phone: e.target.value })} placeholder="请输入外呼手机号" className="w-48" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">业务类型：</span>
              <Select value={filters.businessType} onValueChange={(value) => setFilters({ ...filters, businessType: value })}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="请选择业务类型" />
                </SelectTrigger>
                <SelectContent>
                        <SelectItem value="all">全部类型</SelectItem>
                        <SelectItem value="套餐升档">套餐升档</SelectItem>
                        <SelectItem value="升档送机">升档送机</SelectItem>
                        <SelectItem value="融合消费">融合消费</SelectItem>
                        <SelectItem value="小金币">小金币</SelectItem>
                        <SelectItem value="家庭宽带">家庭宽带</SelectItem>
                        <SelectItem value="小福券">小福券</SelectItem>
                      </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">项目名称：</span>
              <Select value={filters.city} onValueChange={(value) => setFilters({ ...filters, city: value })}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="请选择项目名称" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部项目</SelectItem>
                  {projectOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">外呼团队：</span>
              <Select value={filters.team} onValueChange={(value) => setFilters({ ...filters, team: value })}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="请选择外呼团队" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部团队</SelectItem>
                  {teamOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2 mb-4">
            <Button variant="default" size="sm" onClick={handleSearch}>
              <Search className="h-4 w-4 mr-1" />
              查询
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              const today = new Date().toISOString().split('T')[0]
              setFilters({ startDate: today, endDate: today, phone: '', businessType: '', city: 'all', team: 'all' })
              handleSearch() // 重置后自动触发搜索
            }}>
              <RefreshCw className="h-4 w-4 mr-1" />
              重置
            </Button>
            <Button 
              variant={autoRefreshEnabled ? "default" : "outline"} 
              size="sm" 
              onClick={toggleAutoRefresh}
            >
              <Clock className="h-4 w-4 mr-1" />
              {autoRefreshEnabled ? '自动刷新中' : '开启自动刷新'}
            </Button>
            {autoRefreshEnabled && lastRefreshTime && (
              <span className="text-xs text-gray-500 ml-2">
                上次刷新: {lastRefreshTime.toLocaleTimeString()}
              </span>
            )}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogTrigger asChild>
                <Button variant="default" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  新增
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>新增</DialogTitle>
                  <DialogClose className="absolute right-4 top-4">
                    <X className="h-4 w-4" />
                  </DialogClose>
                </DialogHeader>
                <div className="space-y-4 p-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">*办理手机号码</label>
                    <Input 
                      value={newOrder.phone} 
                      onChange={(e) => setNewOrder({ ...newOrder, phone: e.target.value })} 
                      placeholder="请输入办理手机号码" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">*项目名称</label>
                    <Select 
                      value={newOrder.city} 
                      onValueChange={(value) => setNewOrder({ ...newOrder, city: value })} 
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="请选择项目名称" />
                      </SelectTrigger>
                      <SelectContent>
                        {projectOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">*业务类型</label>
                    <Select 
                      value={newOrder.businessType} 
                      onValueChange={(value) => setNewOrder({ ...newOrder, businessType: value })} 
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="请选择业务类型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="套餐升档">套餐升档</SelectItem>
                        <SelectItem value="升档送机">升档送机</SelectItem>
                        <SelectItem value="融合消费">融合消费</SelectItem>
                        <SelectItem value="小金币">小金币</SelectItem>
                        <SelectItem value="家庭宽带">家庭宽带</SelectItem>
                        <SelectItem value="小福券">小福券</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">*方案</label>
                    <Select 
                      value={newOrder.plan} 
                      onValueChange={(value) => setNewOrder({ ...newOrder, plan: value, discountAmount: value === '裸升' ? '0' : newOrder.discountAmount })} 
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="请选择方案" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="裸升">裸升</SelectItem>
                        <SelectItem value="有差">有差</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">*原套餐金额</label>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-10">-</Button>
                      <Input 
                        value={newOrder.presetAmount} 
                        onChange={(e) => setNewOrder({ ...newOrder, presetAmount: e.target.value })} 
                        placeholder="请输入原套餐金额" 
                        className="flex-1" 
                      />
                      <Button variant="outline" size="sm" className="h-10">+</Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">*现套餐金额</label>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-10">-</Button>
                      <Input 
                        value={newOrder.actualAmount} 
                        onChange={(e) => setNewOrder({ ...newOrder, actualAmount: e.target.value })} 
                        placeholder="请输入现套餐金额" 
                        className="flex-1" 
                      />
                      <Button variant="outline" size="sm" className="h-10">+</Button>
                    </div>
                  </div>
                  {newOrder.plan === '有差' && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">*优惠金额</label>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-10">-</Button>
                        <Input 
                          value={newOrder.discountAmount} 
                          onChange={(e) => setNewOrder({ ...newOrder, discountAmount: e.target.value })} 
                          placeholder="请输入优惠金额" 
                          className="flex-1" 
                        />
                        <Button variant="outline" size="sm" className="h-10">+</Button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">*坐席名称</label>
                    <Input 
                      value={newOrder.name} 
                      onChange={(e) => setNewOrder({ ...newOrder, name: e.target.value })} 
                      placeholder="请输入坐席名称" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">*坐席工号</label>
                    <Input 
                      value={newOrder.agentId} 
                      onChange={(e) => setNewOrder({ ...newOrder, agentId: e.target.value })} 
                      placeholder="请输入坐席工号" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">*外呼团队</label>
                    <Select 
                      value={newOrder.team} 
                      onValueChange={(value) => setNewOrder({ ...newOrder, team: value })} 
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="请选择外呼团队" />
                      </SelectTrigger>
                      <SelectContent>
                        {teamOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                    取消
                  </Button>
                  <Button variant="default" onClick={handleAddOrder}>
                    确定
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            {/* 编辑模态框 */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>编辑</DialogTitle>
                  <DialogClose className="absolute right-4 top-4">
                    <X className="h-4 w-4" />
                  </DialogClose>
                </DialogHeader>
                {editingOrder && (
                  <div className="space-y-4 p-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">*办理手机号码</label>
                      <Input 
                        value={editingOrder.phone} 
                        onChange={(e) => setEditingOrder({ ...editingOrder, phone: e.target.value })} 
                        placeholder="请输入办理手机号码" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">*项目名称</label>
                      <Select 
                        value={editingOrder.city} 
                        onValueChange={(value) => setEditingOrder({ ...editingOrder, city: value })} 
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="请选择项目名称" />
                        </SelectTrigger>
                        <SelectContent>
                          {projectOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">*业务类型</label>
                      <Select 
                        value={editingOrder.businessType} 
                        onValueChange={(value) => setEditingOrder({ ...editingOrder, businessType: value })} 
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="请选择业务类型" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="套餐升档">套餐升档</SelectItem>
                          <SelectItem value="升档送机">升档送机</SelectItem>
                          <SelectItem value="融合消费">融合消费</SelectItem>
                          <SelectItem value="小金币">小金币</SelectItem>
                          <SelectItem value="家庭宽带">家庭宽带</SelectItem>
                          <SelectItem value="小福券">小福券</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">*方案</label>
                      <Select 
                        value={editingOrder.plan} 
                        onValueChange={(value) => setEditingOrder({ ...editingOrder, plan: value, discountAmount: value === '裸升' ? 0 : editingOrder.discountAmount })} 
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="请选择方案" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="裸升">裸升</SelectItem>
                          <SelectItem value="有差">有差</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">*原套餐金额</label>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-10" onClick={() => setEditingOrder({ ...editingOrder, presetAmount: Math.max(0, Number(editingOrder.presetAmount) - 1) })}>-</Button>
                        <Input 
                          value={editingOrder.presetAmount} 
                          onChange={(e) => setEditingOrder({ ...editingOrder, presetAmount: e.target.value })} 
                          placeholder="请输入原套餐金额" 
                          className="flex-1" 
                        />
                        <Button variant="outline" size="sm" className="h-10" onClick={() => setEditingOrder({ ...editingOrder, presetAmount: Number(editingOrder.presetAmount) + 1 })}>+</Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">*现套餐金额</label>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-10" onClick={() => setEditingOrder({ ...editingOrder, actualAmount: Math.max(0, Number(editingOrder.actualAmount) - 1) })}>-</Button>
                        <Input 
                          value={editingOrder.actualAmount} 
                          onChange={(e) => setEditingOrder({ ...editingOrder, actualAmount: e.target.value })} 
                          placeholder="请输入现套餐金额" 
                          className="flex-1" 
                        />
                        <Button variant="outline" size="sm" className="h-10" onClick={() => setEditingOrder({ ...editingOrder, actualAmount: Number(editingOrder.actualAmount) + 1 })}>+</Button>
                      </div>
                    </div>
                    {editingOrder.plan === '有差' && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">*优惠金额</label>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" className="h-10" onClick={() => setEditingOrder({ ...editingOrder, discountAmount: Math.max(0, Number(editingOrder.discountAmount) - 1) })}>-</Button>
                          <Input 
                            value={editingOrder.discountAmount} 
                            onChange={(e) => setEditingOrder({ ...editingOrder, discountAmount: e.target.value })} 
                            placeholder="请输入优惠金额" 
                            className="flex-1" 
                          />
                          <Button variant="outline" size="sm" className="h-10" onClick={() => setEditingOrder({ ...editingOrder, discountAmount: Number(editingOrder.discountAmount) + 1 })}>+</Button>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">*坐席名称</label>
                      <Input 
                        value={editingOrder.name} 
                        onChange={(e) => setEditingOrder({ ...editingOrder, name: e.target.value })} 
                        placeholder="请输入坐席名称" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">*坐席工号</label>
                      <Input 
                        value={editingOrder.agentId} 
                        onChange={(e) => setEditingOrder({ ...editingOrder, agentId: e.target.value })} 
                        placeholder="请输入坐席工号" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">*外呼团队</label>
                      <Select 
                        value={editingOrder.team} 
                        onValueChange={(value) => setEditingOrder({ ...editingOrder, team: value })} 
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="请选择外呼团队" />
                        </SelectTrigger>
                        <SelectContent>
                          {teamOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                <DialogFooter className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                    取消
                  </Button>
                  <Button variant="default" onClick={handleSaveEdit}>
                    确定
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            {/* 导入功能 */}
            <div className="relative">
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-1" />
                导入
              </Button>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleImport}
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-1" />
              下载模板
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" />
              导出
            </Button>
            <Dialog open={isBulkEditModalOpen} onOpenChange={setIsBulkEditModalOpen}>
              <DialogTrigger asChild>
                <Button variant="default" size="sm">
                  <RefreshCw className="h-4 w-4 mr-1" />
                  一键修改
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>一键修改</DialogTitle>
                  <DialogClose className="absolute right-4 top-4">
                    <X className="h-4 w-4" />
                  </DialogClose>
                </DialogHeader>
                <div className="space-y-4 p-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">修改字段</label>
                    <Select 
                      value={bulkEditConfig.field} 
                      onValueChange={(value) => setBulkEditConfig({ ...bulkEditConfig, field: value })} 
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="请选择要修改的字段" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="presetAmount">预置金额</SelectItem>
                        <SelectItem value="actualAmount">现实金额</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">新值</label>
                    <Input 
                      value={bulkEditConfig.value} 
                      onChange={(e) => setBulkEditConfig({ ...bulkEditConfig, value: e.target.value })} 
                      placeholder="请输入新的金额" 
                      type="number" 
                      step="1" 
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">修改范围</label>
                    <Select 
                      value={bulkEditConfig.scope} 
                      onValueChange={(value) => setBulkEditConfig({ ...bulkEditConfig, scope: value })} 
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="请选择修改范围" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部订单</SelectItem>
                        <SelectItem value="specific">当前筛选结果</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsBulkEditModalOpen(false)}>
                    取消
                  </Button>
                  <Button variant="default" onClick={handleBulkEdit}>
                    确定修改
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* 数据表格 */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>编号</TableHead>
                  <TableHead>外呼日期</TableHead>
                  <TableHead>手机号码</TableHead>
                  <TableHead>项目名称</TableHead>
                  <TableHead>业务类型</TableHead>
                  <TableHead>方案</TableHead>
                  <TableHead>预置金额</TableHead>
                  <TableHead>现实金额</TableHead>
                  <TableHead>优惠金额</TableHead>
                  <TableHead>差额</TableHead>
                  <TableHead>坐席名称</TableHead>
                  <TableHead>坐席工号</TableHead>
                  <TableHead>外呼团队</TableHead>
                  <TableHead>数据来源</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getCurrentPageData().map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>{order.id}</TableCell>
                    <TableCell>{order.date}</TableCell>
                    <TableCell>{order.phone}</TableCell>
                    <TableCell>{order.city}</TableCell>
                    <TableCell>{order.businessType}</TableCell>
                    <TableCell>{order.plan}</TableCell>
                    <TableCell>{order.presetAmount}</TableCell>
                    <TableCell>{order.actualAmount}</TableCell>
                    <TableCell>{order.discountAmount}</TableCell>
                    <TableCell>{order.difference}</TableCell>
                    <TableCell>{order.name}</TableCell>
                    <TableCell>{order.agentId}</TableCell>
                    <TableCell>{order.team}</TableCell>
                    <TableCell>{order.dataSource || '手动录入'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="text-blue-600 hover:text-blue-700" onClick={() => handleEditOrder(order.id)}>
                          编辑
                        </Button>
                        {(order.dataSource !== '系统生成') && (
                          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleDeleteOrder(order.id)}>
                            删除
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* 分页 */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-600">
              共 {totalCount} 条，当前第 {currentPage} 页
            </div>
            <div className="flex items-center gap-2">
              <Select 
                value={pageSize.toString()} 
                onValueChange={(value) => {
                  const newPageSize = Number(value)
                  setPageSize(newPageSize)
                  // 重新加载第一页数据
                  fetchOrdersFromAPI(1, newPageSize)
                }}
              >
                <SelectTrigger className="w-24">
                  <SelectValue placeholder="10条/页" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10条/页</SelectItem>
                  <SelectItem value="20">20条/页</SelectItem>
                  <SelectItem value="50">50条/页</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage === 1}
                  onClick={() => fetchOrdersFromAPI(currentPage - 1, pageSize)}
                >
                  前一页
                </Button>
                <Button variant="default" size="sm" className="bg-blue-600 text-white">
                  {currentPage}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage === getTotalPages() || loadingMore}
                  onClick={() => {
                    if (currentPage < getTotalPages()) {
                      setLoadingMore(true)
                      fetchOrdersFromAPI(currentPage + 1, pageSize).finally(() => {
                        setLoadingMore(false)
                      })
                    }
                  }}
                >
                  {loadingMore ? '加载中...' : '后一页'}
                </Button>
              </div>
              <div className="text-sm">
                {currentPage} / {getTotalPages()} 页
              </div>
            </div>
          </div>
          
          {/* 加载更多按钮 */}
          {currentPage < getTotalPages() && (
            <div className="flex justify-center mt-4">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={loadingMore}
                onClick={() => {
                  setLoadingMore(true)
                  fetchOrdersFromAPI(currentPage + 1, pageSize).finally(() => {
                    setLoadingMore(false)
                  })
                }}
              >
                {loadingMore ? '加载中...' : '加载更多'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}