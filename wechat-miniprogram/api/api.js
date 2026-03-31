// api.js
// 注意：在小程序中，getApp()需要在页面生命周期中调用
// 这里直接定义基础URL，确保API调用正常
// 使用本地IP地址，确保手机预览时能访问到后端服务
const apiBaseUrl = 'http://192.168.100.15:8000/api'

/**
 * 发起网络请求
 * @param {string} url - 请求URL
 * @param {Object} options - 请求选项
 * @returns {Promise} 返回Promise对象
 */
function request(url, options = {}) {
  // 构建完整URL
  const fullUrl = apiBaseUrl + url
  console.log('请求URL:', fullUrl)
    
  return new Promise((resolve, reject) => {
    wx.request({
      url: fullUrl,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        ...options.header
      },
      success: (res) => {
        console.log('API响应:', res)
        if (res.statusCode === 200) {
          resolve(res.data)
        } else {
          reject(new Error(`请求失败: ${res.statusCode}`))
        }
      },
      fail: (err) => {
        console.log('API请求失败:', err)
        reject(err)
      }
    })
  })
}

/**
 * 获取看板数据
 * @param {string} startDate - 开始日期 (YYYY-MM-DD)
 * @param {string} endDate - 结束日期 (YYYY-MM-DD)
 * @returns {Promise} 返回Promise对象
 */
function getDashboardData(startDate, endDate) {
  return request(`/dashboard/statistics?startDate=${startDate}&endDate=${endDate}`)
}

/**
 * 获取团队数据
 * @param {string} startDate - 开始日期 (YYYY-MM-DD)
 * @param {string} endDate - 结束日期 (YYYY-MM-DD)
 * @returns {Promise} 返回Promise对象
 */
function getTeamData(startDate, endDate) {
  return request(`/dashboard/statistics?startDate=${startDate}&endDate=${endDate}`)
}

/**
 * 获取坐席数据
 * @param {string} startDate - 开始日期 (YYYY-MM-DD)
 * @param {string} endDate - 结束日期 (YYYY-MM-DD)
 * @returns {Promise} 返回Promise对象
 */
function getAgentData(startDate, endDate) {
  return request(`/dashboard/statistics?startDate=${startDate}&endDate=${endDate}`)
}

module.exports = {
  request,
  getDashboardData,
  getTeamData,
  getAgentData
}