// index.js
const app = getApp()
const utils = require('../../utils/util.js')
const api = require('../../api/api.js')

Page({
  data: {
    overview: {
      totalCalls: 0,
      successCalls: 0,
      qualityRate: 0
    },
    cityRanking: [],
    trendData: [],
    date: '',
    today: '',
    loading: true,
    error: ''
  },

  onLoad() {
    // 初始化日期
    const today = new Date()
    const dateStr = utils.formatDate(today)
    this.setData({
      date: dateStr,
      today: dateStr
    })
    
    // 加载数据
    this.loadData()
  },

  onShow() {
    // 页面显示时执行
  },

  // 日期选择器变化
  bindDateChange(e) {
    this.setData({
      date: e.detail.value
    })
    this.loadData()
  },

  // 加载数据
  loadData() {
    this.setData({
      loading: true,
      error: ''
    })

    console.log('开始加载数据...')
    const date = this.data.date
    console.log('请求日期:', date)
    
    api.getDashboardData(date, date).then(res => {
      console.log('API返回结果:', res)
      if (res.code === 200) {
        const data = res.data
        console.log('数据详情:', data)
        this.setData({
          overview: data.overview,
          cityRanking: data.cityRanking,
          trendData: data.trendData,
          loading: false
        })
        
        // 绘制趋势图表
        this.drawTrendChart(data.trendData)
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
        error: '网络错误，请检查网络连接',
        loading: false
      })
    })
  },

  // 绘制趋势图表
  drawTrendChart(data) {
    const ctx = wx.createCanvasContext('trendChart')
    
    // 设置画布尺寸
    const canvasWidth = wx.getSystemInfoSync().windowWidth - 32
    const canvasHeight = 400
    
    // 准备数据
    const dates = data.map(item => item.date)
    const calls = data.map(item => item.calls)
    const success = data.map(item => item.success)
    
    // 计算最大值
    const maxValue = Math.max(...calls, ...success) * 1.2
    
    // 绘制网格
    ctx.setStrokeStyle('#e8e8e8')
    ctx.setLineWidth(1)
    
    // 绘制Y轴
    for (let i = 0; i <= 5; i++) {
      const y = canvasHeight - (i * canvasHeight / 5)
      ctx.beginPath()
      ctx.moveTo(60, y)
      ctx.lineTo(canvasWidth, y)
      ctx.stroke()
      
      // 绘制Y轴刻度
      ctx.setFillStyle('#999')
      ctx.setFontSize(12)
      ctx.setTextAlign('right')
      ctx.fillText(Math.round(maxValue * i / 5), 55, y + 4)
    }
    
    // 绘制X轴
    for (let i = 0; i < dates.length; i++) {
      const x = 60 + (i * (canvasWidth - 60) / (dates.length - 1))
      ctx.beginPath()
      ctx.moveTo(x, 20)
      ctx.lineTo(x, canvasHeight)
      ctx.stroke()
      
      // 绘制X轴刻度
      ctx.setFillStyle('#999')
      ctx.setFontSize(12)
      ctx.setTextAlign('center')
      ctx.fillText(dates[i], x, canvasHeight + 15)
    }
    
    // 绘制总呼叫量曲线
    ctx.setStrokeStyle('#1890ff')
    ctx.setLineWidth(2)
    ctx.beginPath()
    for (let i = 0; i < calls.length; i++) {
      const x = 60 + (i * (canvasWidth - 60) / (calls.length - 1))
      const y = canvasHeight - (calls[i] / maxValue * canvasHeight)
      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.stroke()
    
    // 绘制成功量曲线
    ctx.setStrokeStyle('#52c41a')
    ctx.setLineWidth(2)
    ctx.beginPath()
    for (let i = 0; i < success.length; i++) {
      const x = 60 + (i * (canvasWidth - 60) / (success.length - 1))
      const y = canvasHeight - (success[i] / maxValue * canvasHeight)
      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.stroke()
    
    // 绘制图例
    ctx.setFillStyle('#1890ff')
    ctx.fillRect(60, 10, 10, 10)
    ctx.setFillStyle('#333')
    ctx.setFontSize(12)
    ctx.setTextAlign('left')
    ctx.fillText('总呼叫量', 80, 20)
    
    ctx.setFillStyle('#52c41a')
    ctx.fillRect(160, 10, 10, 10)
    ctx.setFillStyle('#333')
    ctx.fillText('成功量', 180, 20)
    
    ctx.draw()
  }
})