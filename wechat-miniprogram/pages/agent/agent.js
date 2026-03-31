// pages/agent/agent.js
const app = getApp()
const utils = require('../../utils/util.js')
const api = require('../../api/api.js')

Page({

  /**
   * 页面的初始数据
   */
  data: {
    agentData: [],
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
    this.setData({
      date: dateStr,
      today: dateStr
    })
    
    // 加载数据
    this.loadData()
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

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

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

    const date = this.data.date
    api.getAgentData(date, date).then(res => {
      if (res.code === 200) {
        this.setData({
          agentData: res.data.agentRanking || [],
          loading: false
        })
      } else {
        this.setData({
          error: '数据加载失败',
          loading: false
        })
      }
    }).catch(err => {
      this.setData({
        error: '网络错误，请检查网络连接',
        loading: false
      })
    })
  }
})