#!/usr/bin/env node

/**
 * 录音清单数据回溯同步脚本
 * 用于补完指定日期范围的录音清单数据
 */

const fs = require('fs')
const path = require('path')

const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:5000'
const LOG_DIR = path.join(process.cwd(), 'data', 'local-sync')
const logFile = path.join(LOG_DIR, `backfill_recordings_${Date.now()}.log`)
const errorLogFile = path.join(LOG_DIR, `backfill_recordings_${Date.now()}_error.log`)

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}

function writeLog(message, level = 'INFO') {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] [${level}] ${message}`
  console.log(logMessage)
  fs.appendFileSync(logFile, logMessage + '\n')
  
  if (level === 'ERROR') {
    fs.appendFileSync(errorLogFile, logMessage + '\n')
  }
}

function sendAlert(message) {
  // 这里可以添加告警逻辑，例如发送邮件或通知
  writeLog(`告警: ${message}`, 'ERROR')
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDateRange(startDate, endDate) {
  const dates = []
  let currentDate = new Date(startDate)
  const lastDate = new Date(endDate)
  
  while (currentDate <= lastDate) {
    dates.push(new Date(currentDate))
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  return dates
}

async function makeRequest(url, method = 'GET', body = null, retries = 3) {
  return new Promise((resolve, reject) => {
    const https = url.startsWith('https://') ? require('https') : require('http')
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    }
    
    const req = https.request(url, options, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          resolve(parsed)
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${data}`))
        }
      })
    })
    
    req.on('error', (error) => {
      const errorMsg = `Request error: ${error.message || JSON.stringify(error)}`
      writeLog(errorMsg, 'ERROR')
      reject(new Error(errorMsg))
    })
    req.setTimeout(600000) // 10 minutes timeout
    
    if (body) {
      req.write(JSON.stringify(body))
    }
    req.end()
  })
}

async function syncRecordingDataForDate(date) {
  const dateStr = formatDate(date)
  writeLog(`同步 ${dateStr} 的录音清单数据...`)
  
  try {
    // 构建请求参数
    const body = {
      startTime: `${dateStr} 00:00:00`,
      endTime: `${dateStr} 23:59:59`,
      sliceMinutes: 60,
      pageSize: 200,
      maxPagesPerSlice: 150,
    }
    
    // 调用API获取录音清单数据
    const result = await makeRequest(`${API_BASE_URL}/api/internal/sync/recordings/backfill`, 'POST', body)
    
    if (result.code === 200) {
      writeLog(` ${dateStr} 录音清单同步成功`, 'SUCCESS')
      writeLog(`  - 获取记录数：${result.data.fetched}`)
      writeLog(`  - 入库记录数：${result.data.upserted}`)
      writeLog(`  - 失败记录数：${result.data.failed}`)
      writeLog(`  - 时间窗口数：${result.data.slices}`)
      
      return true
    } else {
      writeLog(` ${dateStr} 录音清单同步失败：${result.message}`, 'ERROR')
      if (result.details) {
        writeLog(`  详情：${result.details}`, 'ERROR')
      }
      sendAlert(` ${dateStr} 录音清单同步失败：${result.message}`)
      return false
    }
  } catch (error) {
    writeLog(` ${dateStr} 录音清单同步异常：${error.message}`, 'ERROR')
    sendAlert(` ${dateStr} 录音清单同步异常：${error.message}`)
    return false
  }
}

async function validateRecordingDataFiles(dates) {
  // 简单的验证逻辑：检查文件是否存在
  let allValid = true
  
  for (const date of dates) {
    const dateStr = formatDate(date)
    const filePath = path.join(LOG_DIR, `qms_recording_list_${dateStr}.json`)
    
    if (!fs.existsSync(filePath)) {
      writeLog(`验证失败：${filePath} 不存在`, 'ERROR')
      allValid = false
    } else {
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const data = JSON.parse(content)
        if (Array.isArray(data) && data.length > 0) {
          writeLog(`验证通过：${filePath} 包含 ${data.length} 条记录`, 'SUCCESS')
        } else {
          writeLog(`验证失败：${filePath} 为空或格式错误`, 'ERROR')
          allValid = false
        }
      } catch (error) {
        writeLog(`验证失败：${filePath} 读取或解析失败: ${error.message}`, 'ERROR')
        allValid = false
      }
    }
  }
  
  return allValid
}

async function main() {
  writeLog('========================================')
  writeLog(`开始录音清单数据回溯同步`)
  writeLog(`日期范围：2026-02-01 至 2026-02-28`)
  writeLog('========================================')
  
  const startDate = new Date('2026-02-01')
  const endDate = new Date('2026-02-28')
  const dates = getDateRange(startDate, endDate)
  writeLog(`共需同步 ${dates.length} 天的数据`)
  
  let successCount = 0
  let failCount = 0
  
  for (const date of dates) {
    const success = await syncRecordingDataForDate(date)
    if (success) {
      successCount++
    } else {
      failCount++
    }
    
    // 避免请求过于频繁
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  const validationResult = await validateRecordingDataFiles(dates)
  
  writeLog('')
  writeLog('========================================')
  writeLog('同步完成总结', 'SUCCESS')
  writeLog('========================================')
  writeLog(`日期范围：2026-02-01 至 2026-02-28`)
  writeLog(`总天数：${dates.length}`)
  writeLog(`成功：${successCount}`)
  writeLog(`失败：${failCount}`)
  writeLog(`数据验证：${validationResult ? '通过' : '失败'}`)
  writeLog(`日志文件：${logFile}`)
  if (fs.existsSync(errorLogFile)) {
    writeLog(`错误日志：${errorLogFile}`)
  }
  writeLog('========================================')
  
  if (failCount > 0 || !validationResult) {
    sendAlert('录音清单数据回溯同步存在失败项，请检查日志')
    process.exit(1)
  } else {
    writeLog('录音清单数据回溯同步全部完成', 'SUCCESS')
    process.exit(0)
  }
}

main().catch(err => {
  writeLog(`未捕获的错误：${err.message}`, 'ERROR')
  sendAlert(`录音清单数据回溯同步脚本异常：${err.message}`)
  process.exit(1)
})
