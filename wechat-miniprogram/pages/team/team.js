// pages/team/team.js
const app = getApp()
const utils = require('../../utils/util.js')
const api = require('../../api/api.js')

Page({

  /**
   * 页面的初始数据
   */
  data: {
    teamData: [],
    date: '',
    today: '',
    loading: true,
    error: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 初始化日期
    const today = new Date()
    const dateStr = utils.formatDate(today)
    
    // 从全局获取日期
    const app = getApp()
    if (!app.globalData.selectedDate) {
      app.globalData.selectedDate = dateStr
    }
    
    this.setData({
      date: app.globalData.selectedDate,
      today: dateStr
    })
    
    // 加载数据
    this.loadData()
    
    // 启动自动刷新，每30秒刷新一次
    this.startAutoRefresh()
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
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
        // 日期变化时重新加载数据
        this.loadData()
      }
    }
    // 启动自动刷新
    this.startAutoRefresh()
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {
    // 页面隐藏时停止自动刷新
    this.stopAutoRefresh()
  },

  /**
   * 生命周期函数--监听页面卸载
   */
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

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.loadData()
    wx.stopPullDownRefresh()
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

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
    
    this.loadData()
  },

  // 加载数据
  loadData() {
    this.setData({
      loading: true,
      error: ''
    })

    console.log('开始加载团队数据...')
    const date = this.data.date
    console.log('请求日期:', date)
    
    // 调用API获取数据
    api.getTeamData(date, date).then(res => {
      console.log('API返回数据:', res)
      if (res.code === 200) {
        const data = res.data
        // 从cityDetails中提取团队数据
        let teamData = []
        if (data.cityDetails && data.cityDetails.length > 0) {
          data.cityDetails.forEach(city => {
            if (city.teams && city.teams.length > 0) {
              teamData = teamData.concat(city.teams)
            }
          })
        }
        console.log('处理后的团队数据:', teamData)
        this.setData({
          teamData: teamData,
          loading: false
        }, () => {
          console.log('数据设置完成，页面应该更新了')
        })
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
  }
})