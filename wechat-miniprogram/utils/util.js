// util.js

/**
 * 格式化日期
 * @param {Date} date - 日期对象
 * @returns {string} 格式化后的日期字符串 (YYYY-MM-DD)
 */
function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 格式化时间
 * @param {Date} date - 日期对象
 * @returns {string} 格式化后的时间字符串 (HH:MM:SS)
 */
function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

/**
 * 格式化日期时间
 * @param {Date} date - 日期对象
 * @returns {string} 格式化后的日期时间字符串 (YYYY-MM-DD HH:MM:SS)
 */
function formatDateTime(date) {
  return `${formatDate(date)} ${formatTime(date)}`
}

/**
 * 计算两个日期之间的天数
 * @param {Date} startDate - 开始日期
 * @param {Date} endDate - 结束日期
 * @returns {number} 天数
 */
function getDaysBetween(startDate, endDate) {
  const oneDay = 24 * 60 * 60 * 1000
  const diffMs = Math.abs(endDate - startDate)
  return Math.round(diffMs / oneDay)
}

/**
 * 生成指定范围内的日期数组
 * @param {Date} startDate - 开始日期
 * @param {Date} endDate - 结束日期
 * @returns {Array} 日期数组
 */
function generateDateRange(startDate, endDate) {
  const dates = []
  const currentDate = new Date(startDate)
  while (currentDate <= endDate) {
    dates.push(formatDate(new Date(currentDate)))
    currentDate.setDate(currentDate.getDate() + 1)
  }
  return dates
}

/**
 * 格式化数字，添加千位分隔符
 * @param {number} num - 数字
 * @returns {string} 格式化后的数字字符串
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * 格式化百分比
 * @param {number} value - 数值
 * @param {number} total - 总数
 * @param {number} decimals - 小数位数
 * @returns {string} 格式化后的百分比字符串
 */
function formatPercentage(value, total, decimals = 1) {
  if (total === 0) return '0%'
  const percentage = (value / total) * 100
  return `${percentage.toFixed(decimals)}%`
}

module.exports = {
  formatDate,
  formatTime,
  formatDateTime,
  getDaysBetween,
  generateDateRange,
  formatNumber,
  formatPercentage
}