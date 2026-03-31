// app.js
App({
  onLaunch() {
    // 小程序启动时执行
    console.log('小程序启动');
    
    // 检查网络状态
    wx.getNetworkType({
      success: function(res) {
        console.log('网络状态:', res.networkType);
      }
    });
  },
  onShow() {
    // 小程序显示时执行
    console.log('小程序显示');
  },
  onHide() {
    // 小程序隐藏时执行
    console.log('小程序隐藏');
  },
  globalData: {
    userInfo: null,
    apiBaseUrl: 'http://localhost:5001/api',
    selectedDate: ''
  }
})