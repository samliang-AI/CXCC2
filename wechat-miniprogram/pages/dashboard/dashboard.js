// dashboard.js
const app = getApp()
const utils = require('../../utils/util.js')
const api = require('../../api/api.js')

Page({
  data: {
    overview: {
      totalCalls: 0,
      connectedCalls: 0,
      successCalls: 0,
      qualityRate: 0,
      totalAgents: 0
    },
    projectDetails: [],
    totalStats: {
      connectedCalls: 0,
      successCalls: 0,
      successRate: 0,
      agentCount: 0,
      avgSuccessPerAgent: 0
    },
    trendData: [],
    date: '',
    today: '',
    loading: true,
    error: '',
    timeRangeOptions: ['7天', '15天', '30天'],
    timeRangeIndex: 0
  },

  onLoad() {
    // 初始化日期
    const today = new Date()
    const dateStr = utils.formatDate(today)
    
    // 更新全局日期
    const app = getApp()
    if (!app.globalData.selectedDate) {
      app.globalData.selectedDate = dateStr
    }
    
    this.setData({
      date: app.globalData.selectedDate,
      today: dateStr
    })
    
    // 加载数据，包括趋势数据
    this.loadData(true)
    
    // 启动自动刷新，每30秒刷新一次
    this.startAutoRefresh()
  },

  onShow() {
    // 从全局获取日期
    const app = getApp()
    if (app.globalData.selectedDate) {
      const oldDate = this.data.date
      const newDate = app.globalData.selectedDate
      if (oldDate !== newDate) {
        this.setData({
          date: newDate
        })
        // 日期变化时重新加载数据，包括趋势数据
        this.loadData(true)
      }
    }
    // 启动自动刷新
    this.startAutoRefresh()
  },

  onHide() {
    // 页面隐藏时停止自动刷新
    this.stopAutoRefresh()
  },

  onUnload() {
    // 页面卸载时停止自动刷新
    this.stopAutoRefresh()
  },

  // 启动自动刷新
  startAutoRefresh() {
    console.log('启动自动刷新，每30秒刷新一次')
    // 先清除已有的定时器
    this.stopAutoRefresh()
    
    // 设置新的定时器
    this.autoRefreshTimer = setInterval(() => {
      console.log('自动刷新数据...')
      this.loadData()
    }, 30000) // 30秒
  },

  // 停止自动刷新
  stopAutoRefresh() {
    if (this.autoRefreshTimer) {
      console.log('停止自动刷新')
      clearInterval(this.autoRefreshTimer)
      this.autoRefreshTimer = null
    }
  },

  // 日期选择器变化
  bindDateChange(e) {
    const selectedDate = e.detail.value
    this.setData({
      date: selectedDate
    })
    
    // 更新全局日期
    const app = getApp()
    app.globalData.selectedDate = selectedDate
    
    // 日期变化时重新加载数据，包括趋势数据
    this.loadData(true)
  },

  // 时间范围选择变化
  bindTimeRangeChange(e) {
    this.setData({
      timeRangeIndex: e.detail.value
    })
    // 时间范围变化时重新加载趋势数据
    this.loadData(true)
  },

  // 加载数据
  loadData(loadTrend = false) {
    this.setData({
      loading: true,
      error: ''
    })

    console.log('开始加载数据看板数据...')
    const date = this.data.date
    console.log('请求日期:', date)
    
    // 调用API获取数据
    api.getDashboardData(date, date).then(res => {
      console.log('API返回数据:', res)
      if (res.code === 200) {
        const data = res.data
        
        // 计算合计数据
        const totalStats = this.calculateTotalStats(data.cityDetails || [])
        console.log('totalStats:', totalStats)
        
        this.setData({
          overview: data.overview || {},
          projectDetails: data.cityDetails || [],
          totalStats: totalStats,
          loading: false
        }, () => {
          console.log('数据设置完成，页面应该更新了')
        })
        
        // 只有在需要时才加载趋势数据
        if (loadTrend) {
          // 调用loadTrendData获取趋势数据
          this.loadTrendData(date)
        }
      } else {
        console.log('API返回错误:', res)
        this.setData({
          error: '数据加载失败',
          loading: false
        })
      }
    }).catch(err => {
      console.log('网络错误:', err)
      this.setData({
        error: '网络连接失败',
        loading: false
      })
    })
  },

  // 加载趋势数据
  loadTrendData(endDate) {
    // 根据选择的时间范围计算开始日期
    const timeRanges = [7, 15, 30] // 7天、15天、30天
    const selectedRange = timeRanges[this.data.timeRangeIndex]
    
    const end = new Date(endDate)
    const start = new Date(end)
    start.setDate(start.getDate() - (selectedRange - 1)) // 包括今天
    const startDate = utils.formatDate(start)
    
    console.log('加载趋势数据，时间范围:', selectedRange, '天，开始日期:', startDate, '结束日期:', endDate)
    
    api.getDashboardData(startDate, endDate).then(res => {
      console.log('趋势数据API返回结果:', res)
      if (res.code === 200) {
        const data = res.data
        // 处理趋势数据
        const trendData = this.processTrendData(data)
        this.setData({
          trendData: trendData
        })
        
        // 绘制趋势图表
        this.drawTrendChart()
      } else {
        console.log('趋势数据API返回错误:', res)
      }
    }).catch(err => {
      console.log('趋势数据网络错误:', err)
    })
  },

  // 处理趋势数据
  processTrendData(data) {
    // 这里需要根据实际API返回的数据结构进行处理
    // 只使用真实的API返回数据，不生成模拟数据
    const trendData = []
    
    console.log('处理趋势数据，原始数据:', JSON.stringify(data))
    
    // 处理API返回的每日数据（适配后端返回的格式）
    if (data && data.trendData && data.trendData.length > 0) {
      console.log('发现trendData字段，数据条数:', data.trendData.length)
      data.trendData.forEach(day => {
        // 转换日期格式，确保格式为YYYY-MM-DD
        let formattedDate = day.date
        if (formattedDate && formattedDate.length === 5) { // 格式为MM-DD
          const year = new Date().getFullYear()
          formattedDate = `${year}-${formattedDate}`
        }
        
        trendData.push({
          date: formattedDate,
          totalCalls: day.calls || 0,
          connectedCalls: day.connected || 0,
          successCalls: day.success || 0,
          successRate: day.successRate || (day.connected > 0 ? (day.success / day.connected * 100).toFixed(1) : 0)
        })
      })
    } else if (data && data.dailyStats && data.dailyStats.length > 0) {
      // 兼容旧格式
      console.log('发现dailyStats字段，数据条数:', data.dailyStats.length)
      data.dailyStats.forEach(day => {
        trendData.push({
          date: day.date,
          totalCalls: day.totalCalls || 0,
          connectedCalls: day.connectedCalls || 0,
          successCalls: day.successCalls || 0,
          successRate: day.successRate || 0
        })
      })
    } else {
      console.log('未找到趋势数据字段，data字段:', Object.keys(data || {}))
    }
    
    console.log('处理后的趋势数据:', trendData)
    return trendData
  },

  // 绘制趋势图表
  drawTrendChart() {
    const trendData = this.data.trendData
    
    // 获取canvas元素的实际宽度
    const query = wx.createSelectorQuery()
    let canvasWidth = 300 // 默认宽度
    let canvasHeight = 266 // 高度缩小1/3（原来400，现在约266）
    const padding = 40
    
    // 使用同步方式获取canvas宽度
    try {
      const res = wx.getSystemInfoSync()
      const screenWidth = res.screenWidth
      // 计算canvas宽度，考虑padding和容器宽度
      canvasWidth = screenWidth - 64 // 减去左右padding和margin
    } catch (e) {
      console.error('获取系统信息失败:', e)
    }
    
    console.log('绘制趋势图表，canvas宽度:', canvasWidth, '数据条数:', trendData ? trendData.length : 0)
    
    if (!trendData || trendData.length === 0) {
      // 如果没有数据，绘制空图表
      const ctx = wx.createCanvasContext('trendChart')
      
      // 绘制网格
      ctx.setStrokeStyle('#e0e0e0')
      ctx.setLineWidth(1)
      
      // 水平网格线
      for (let i = 0; i <= 5; i++) {
        const y = padding + (canvasHeight - 2 * padding) * i / 5
        ctx.beginPath()
        ctx.moveTo(padding, y)
        ctx.lineTo(canvasWidth - padding, y)
        ctx.stroke()
      }
      
      // 绘制提示文字
      ctx.setFillStyle('#999')
      ctx.setFontSize(14)
      ctx.setTextAlign('center')
      ctx.fillText('暂无趋势数据', canvasWidth / 2, canvasHeight / 2)
      
      ctx.draw()
      return
    }
    
    const ctx = wx.createCanvasContext('trendChart')
    
    // 计算数据范围 - 只考虑成功量数据
    let maxValue = 0
    trendData.forEach(item => {
      maxValue = Math.max(maxValue, item.successCalls || 0)
    })
    maxValue = Math.ceil(maxValue * 1.1) // 留一些余量
    if (maxValue === 0) maxValue = 10 // 防止除以零
    
    // 绘制网格
    ctx.setStrokeStyle('#e0e0e0')
    ctx.setLineWidth(1)
    
    // 水平网格线
    for (let i = 0; i <= 5; i++) {
      const y = padding + (canvasHeight - 2 * padding) * i / 5
      ctx.beginPath()
      ctx.moveTo(padding, y)
      ctx.lineTo(canvasWidth - padding, y)
      ctx.stroke()
      
      // 绘制数值标签
      ctx.setFillStyle('#999')
      ctx.setFontSize(10)
      ctx.setTextAlign('left')
      const value = Math.round(maxValue * (1 - i / 5))
      ctx.fillText(value, padding - 30, y + 4)
    }
    
    // 垂直网格线
    for (let i = 0; i < trendData.length; i++) {
      const x = padding + (canvasWidth - 2 * padding) * i / (trendData.length - 1)
      ctx.beginPath()
      ctx.moveTo(x, padding)
      ctx.lineTo(x, canvasHeight - padding)
      ctx.stroke()
    }
    
    // 绘制数据线
    // 只显示成功量（柱状图）
    const color = '#2ecc71' // 绿色-成功量
    
    // 绘制成功量 - 柱状图
    const barWidth = (canvasWidth - 2 * padding) / trendData.length * 0.6
    
    trendData.forEach((item, i) => {
      const x = padding + (canvasWidth - 2 * padding) * i / (trendData.length - 1) - barWidth / 2
      const barHeight = ((item.successCalls || 0) / maxValue) * (canvasHeight - 2 * padding)
      const y = canvasHeight - padding - barHeight
      
      // 绘制柱状图
      ctx.setFillStyle(color)
      ctx.fillRect(x, y, barWidth, barHeight)
      
      // 绘制数据标签
      ctx.setFillStyle(color)
      ctx.setFontSize(10)
      ctx.setTextAlign('center')
      ctx.fillText(item.successCalls || 0, x + barWidth / 2, y - 10)
      
      // 绘制日期标签 - 只显示日，不显示月份
      ctx.setFillStyle('#666')
      ctx.setFontSize(9)
      ctx.setTextAlign('center')
      let day = ''
      if (item.date) {
        const dateParts = item.date.split('-')
        if (dateParts.length >= 3) {
          day = parseInt(dateParts[2])
          if (isNaN(day)) {
            day = ''
          }
        }
      }
      ctx.fillText(day, x + barWidth / 2, canvasHeight - padding + 15)
    })
    

    
    // 绘制图表标题
    const timeRanges = [7, 15, 30] // 7天、15天、30天
    const selectedRange = timeRanges[this.data.timeRangeIndex]
    ctx.setFillStyle('#333')
    ctx.setFontSize(14)
    ctx.setTextAlign('center')
    ctx.fillText(`过去${selectedRange}天成功量趋势`, canvasWidth / 2, 20)
    
    ctx.draw()
  },

  // 计算合计数据
  calculateTotalStats(projectDetails) {
    let totalConnectedCalls = 0
    let totalSuccessCalls = 0
    let totalAgentCount = 0
    
    projectDetails.forEach(project => {
      totalConnectedCalls += project.connectedCalls || 0
      totalSuccessCalls += project.successCalls || 0
      totalAgentCount += project.agentCount || 0
    })
    
    const successRate = totalConnectedCalls > 0 ? (totalSuccessCalls / totalConnectedCalls * 100).toFixed(1) : '0.0'
    const avgSuccessPerAgent = totalAgentCount > 0 ? (totalSuccessCalls / totalAgentCount).toFixed(1) : '0.0'
    
    return {
      connectedCalls: totalConnectedCalls,
      successCalls: totalSuccessCalls,
      successRate: successRate,
      agentCount: totalAgentCount,
      avgSuccessPerAgent: avgSuccessPerAgent
    }
  },




})